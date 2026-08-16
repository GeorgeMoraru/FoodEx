import React, { useRef, useState, useEffect } from 'react';
import { 
  Modal, Box, Typography, Button, CircularProgress, 
  Alert, IconButton, Card, CardActions, CardContent,
  Fade
} from '@mui/material';
import { 
  Close as CloseIcon, CameraAlt as CameraIcon
} from '@mui/icons-material';
import Tesseract from 'tesseract.js';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../utils/firebase';
import { parseDateFromText, preprocessCanvasVariants } from '../utils/dateExtractor';

export { parseDateFromText };

// Optimize high-resolution canvas for fast sub-second OCR while retaining fine character details
function getOptimizedCanvas(sourceCanvas, maxWidth = 1280) {
  if (sourceCanvas.width <= maxWidth) return sourceCanvas;
  const ratio = maxWidth / sourceCanvas.width;
  const opt = document.createElement('canvas');
  opt.width = maxWidth;
  opt.height = Math.round(sourceCanvas.height * ratio);
  const ctx = opt.getContext('2d');
  ctx.drawImage(sourceCanvas, 0, 0, opt.width, opt.height);
  return opt;
}

export default function ScannerModal({ open, onClose, onDateScanned, settings }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [scanEngine, setScanEngine] = useState('');
  const [foundDate, setFoundDate] = useState(null);
  const [error, setError] = useState('');

  // Start Camera with robust fallback chain
  const startCamera = async () => {
    setError('');
    setOcrText('');
    setScanEngine('');
    setFoundDate(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera API is not accessible in this context. Allow camera permissions in your browser.');
      return;
    }

    const constraintList = [
      { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } } },
      { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } },
      { video: { facingMode: { ideal: 'user' } } },
      { video: true }
    ];

    let mediaStream = null;
    let lastError = null;

    for (const constraints of constraintList) {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (mediaStream) break;
      } catch (err) {
        lastError = err;
      }
    }

    if (mediaStream) {
      setStream(mediaStream);
    } else {
      console.error('Camera fallback chain error:', lastError);
      if (lastError && (lastError.name === 'NotAllowedError' || lastError.name === 'PermissionDeniedError')) {
        setError('Camera access permission was denied. Please allow camera access in your browser settings.');
      } else if (lastError && (lastError.name === 'NotFoundError' || lastError.name === 'DevicesNotFoundError')) {
        setError('No camera detected on this device.');
      } else {
        setError('Could not start live camera preview.');
      }
    }
  };

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    if (open) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open]);

  const withTimeout = (promise, ms = 8000) => {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), ms))
    ]);
  };

  const processImageForDate = async (sourceCanvas) => {
    setLoading(true);
    setError('');
    setOcrText('');
    setScanEngine('');
    setFoundDate(null);

    try {
      // Focus on the viewfinder area (middle 80% width x 70% height) where user aligns the stamp
      const cropCanvas = document.createElement('canvas');
      const cropX = Math.round(sourceCanvas.width * 0.1);
      const cropY = Math.round(sourceCanvas.height * 0.15);
      const cropW = Math.round(sourceCanvas.width * 0.8);
      const cropH = Math.round(sourceCanvas.height * 0.7);
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext('2d');
      cropCtx.drawImage(sourceCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      const optCanvas = getOptimizedCanvas(cropCanvas, 1280);
      const base64Data = optCanvas.toDataURL('image/jpeg', 0.94).split(',')[1];

      let rawText = '';
      let aiSuccess = false;
      let engineUsed = '';

      const cleanKey = (key) => {
        if (!key) return null;
        const trimmed = key.trim().replace(/^["']|["']$/g, '');
        const isPlaceholder = !trimmed || trimmed.toLowerCase().includes('your-') || trimmed.toLowerCase().includes('placeholder');
        return !isPlaceholder ? trimmed : null;
      };

      const proxyUrl = import.meta.env.VITE_GEMINI_PROXY_URL;
      const envApiKey = cleanKey(import.meta.env.VITE_GEMINI_API_KEY);
      const apiKey = envApiKey;

      // 1. Primary: Firebase Callable Cloud Function (Server-side Blaze Gemini extraction)
      try {
        const extractDateFn = httpsCallable(functions, 'extractExpirationDate');
        const res = await withTimeout(extractDateFn({ imageBase64: base64Data }), 10000);
        const dateResult = res.data?.date;
        if (dateResult && dateResult.toLowerCase() !== 'null' && dateResult.toLowerCase() !== 'none') {
          rawText = dateResult;
          aiSuccess = true;
          engineUsed = 'Gemini AI Vision (Firebase)';
        }
      } catch (fnErr) {
        console.warn('[FoodEx Scanner] Firebase Cloud Function call error:', fnErr);
      }

      // 2. Secondary: Direct Gemini API or Cloudflare Proxy
      if (!aiSuccess && (proxyUrl || apiKey)) {
        try {
          if (proxyUrl) {
            const response = await withTimeout(fetch(proxyUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: base64Data })
            }), 6000);
            if (response.ok) {
              const result = await response.json();
              rawText = result.result?.date || result.date || '';
              if (rawText && rawText.toLowerCase() !== 'null' && rawText.toLowerCase() !== 'none') {
                aiSuccess = true;
                engineUsed = 'Gemini AI Vision (Proxy)';
              }
            }
          } else if (apiKey) {
            const modelsToTry = [
              'gemini-2.5-flash',
              'gemini-2.0-flash',
              'gemini-1.5-flash',
              'gemini-2.5-pro',
              'gemini-1.5-pro'
            ];

            const promptText = "Analyze this food packaging image. Locate the food expiration date, best before date, use by date, EXP, BB, BBD, VAL, or date stamp (e.g. 2026-11-28, 15/09/2026, 15.08.2026, 14.10.26, 08/26, 24 NOV 2026, VAL 15.08.2026, EXP: 12.11.2026, BB 05/2027). If there are two dates (such as production date PROD and expiration date EXP), return the EXPIRATION date. Return ONLY the date in YYYY-MM-DD format (or exact date string if day is unknown, e.g. 2026-11). If no date is found, reply with 'NONE'.";

            for (const modelName of modelsToTry) {
              try {
                const response = await withTimeout(fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    contents: [{
                      parts: [
                        { text: promptText },
                        { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
                      ]
                    }]
                  })
                }), 6000);

                if (response.ok) {
                  const data = await response.json();
                  const textOutput = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
                  if (textOutput && textOutput.toUpperCase() !== 'NONE' && textOutput.toLowerCase() !== 'null') {
                    rawText = textOutput;
                    aiSuccess = true;
                    engineUsed = `Gemini AI Vision (${modelName})`;
                    break;
                  }
                }
              } catch (fetchErr) {
                console.warn(`[FoodEx Scanner] Error with ${modelName}:`, fetchErr);
              }
            }
          }
        } catch (geminiErr) {
          console.warn('[FoodEx Scanner] Gemini direct error:', geminiErr);
        }
      }

      // 3. Fallback: Smart Multi-Pass Local Tesseract.js OCR
      if (!aiSuccess || !rawText) {
        try {
          console.log('[FoodEx Scanner] Running smart local OCR passes...');
          const variants = preprocessCanvasVariants(cropCanvas, false);

          const ocrResults = await withTimeout(Promise.all([
            Tesseract.recognize(optCanvas, 'eng').catch(() => null),
            Tesseract.recognize(variants.enhanced, 'eng').catch(() => null),
            Tesseract.recognize(variants.inverted, 'eng').catch(() => null),
            Tesseract.recognize(sourceCanvas, 'eng').catch(() => null)
          ]), 9000);

          const combinedTexts = ocrResults
            .map(r => r?.data?.text || '')
            .filter(Boolean);

          rawText = combinedTexts.join('\n');
          engineUsed = 'Local Device OCR';
        } catch (ocrErr) {
          console.error('[FoodEx Scanner] Local OCR error or timeout:', ocrErr);
        }
      }

      setOcrText(rawText);
      setScanEngine(engineUsed || 'Local Scanner');

      // 4. Parse date from output
      if (rawText) {
        let parsedDate = null;
        if (rawText.match(/^\d{4}-\d{2}-\d{2}$/)) {
          parsedDate = new Date(rawText);
        } else {
          parsedDate = parseDateFromText(rawText);
        }

        if (parsedDate && !isNaN(parsedDate.getTime())) {
          setFoundDate(parsedDate);
        } else {
          if (!apiKey) {
            setError('No valid expiration date found. For faint dot-matrix or ink-jet dates on jars/cartons, configure your Google Gemini API Key in Settings for AI Vision.');
          } else {
            setError('No valid expiration date found. Align the package date stamp clearly in the frame.');
          }
        }
      } else {
        if (!apiKey) {
          setError('No date text detected with local scanner. Add your Google Gemini API Key in Settings to enable high-accuracy AI Vision for dot-matrix stamps.');
        } else {
          setError('No date text detected. Hold the camera closer to the date stamp and ensure good lighting.');
        }
      }
    } catch (globalErr) {
      console.error('[FoodEx Scanner] Processing error:', globalErr);
      setError('Scan could not complete. Please hold steady and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    await processImageForDate(canvas);
  };

  const handleAcceptDate = () => {
    if (foundDate) {
      onDateScanned(foundDate);
      onClose();
    }
  };

  return (
    <Modal open={open} onClose={onClose} closeAfterTransition aria-labelledby="scanner-modal-title">
      <Fade in={open} timeout={{ enter: 250, exit: 200 }}>
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) translateZ(0)',
          willChange: 'opacity, transform',
          backfaceVisibility: 'hidden',
          width: { xs: '95%', sm: 500 },
          bgcolor: 'background.paper',
          borderRadius: '4px',
          boxShadow: 24,
          overflow: 'hidden',
          outline: 'none'
        }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: 'primary.main', color: '#ffffff' }}>
            <Box>
              <Typography id="scanner-modal-title" variant="h6" sx={{ fontWeight: 'bold' }}>
                Scan Expiration Date
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                ✨ Powered by Gemini AI Vision
              </Typography>
            </Box>
            <IconButton onClick={onClose} sx={{ color: '#ffffff' }}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Camera Feed & Canvas */}
          <Box sx={{ position: 'relative', width: '100%', pt: '75%', bgcolor: '#000000' }}>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%', 
                objectFit: 'cover',
                display: stream ? 'block' : 'none'
              }}
            />

            {/* Alignment Finder Grid Overlay */}
            {stream && (
              <Box sx={{
                position: 'absolute',
                top: '15%',
                left: '10%',
                width: '80%',
                height: '70%',
                border: '2px dashed rgba(255, 255, 255, 0.7)',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)',
                zIndex: 5,
                pointerEvents: 'none',
                borderRadius: '4px'
              }} />
            )}

            {!stream && (
              <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3, textAlign: 'center', color: '#aaaaaa' }}>
                <CameraIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                <Typography variant="body2">Camera preview inactive or unavailable.</Typography>
                <Typography variant="caption" color="text.secondary">Please allow camera permissions in your browser.</Typography>
              </Box>
            )}

            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </Box>

          {/* Controls & Results */}
          <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
            {error && <Alert severity="warning" sx={{ width: '100%' }}>{error}</Alert>}

            {loading && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={32} />
                <Typography variant="body2" color="text.secondary">Scanning expiration date with OCR & AI...</Typography>
              </Box>
            )}

            {ocrText && !foundDate && !loading && (
              <Box sx={{ width: '100%', bgcolor: 'action.hover', p: 1.5, borderRadius: '4px' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>Scanned Text:</Typography>
                  <Typography variant="caption" color="primary.main" sx={{ fontWeight: 'bold' }}>{scanEngine}</Typography>
                </Box>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', whiteSpace: 'pre-wrap', maxHeight: 80, overflowY: 'auto' }}>
                  {ocrText}
                </Typography>
              </Box>
            )}

            {foundDate && (
              <Card variant="outlined" sx={{ width: '100%', bgcolor: 'success.light', color: 'success.contrastText', p: 1 }}>
                <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Date Detected!</Typography>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>via {scanEngine}</Typography>
                  </Box>
                  <Typography variant="h5" sx={{ fontWeight: 'bold', mt: 0.5 }}>
                    {foundDate.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                  <Button size="small" variant="contained" color="success" onClick={handleAcceptDate}>
                    Confirm Date
                  </Button>
                </CardActions>
              </Card>
            )}

            <Box sx={{ width: '100%' }}>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                startIcon={<CameraIcon />}
                disabled={loading || !stream}
                onClick={handleCapture}
                sx={{ py: 1.5, fontWeight: 'bold' }}
              >
                Capture & Scan
              </Button>
            </Box>
          </Box>
        </Box>
      </Fade>
    </Modal>
  );
}

import React, { useRef, useState, useEffect } from 'react';
import { 
  Modal, Box, Typography, Button, CircularProgress, 
  Alert, IconButton, Card, CardActions, CardContent,
  Fade, TextField, Dialog, DialogTitle, DialogContent,
  DialogActions, Tooltip
} from '@mui/material';
import { 
  Close as CloseIcon, 
  CameraAlt as CameraIcon,
  PhotoCamera as UploadIcon,
  Key as KeyIcon,
  CheckCircle as CheckIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import Tesseract from 'tesseract.js';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../utils/firebase';
import { parseDateFromText, preprocessCanvasVariants } from '../utils/dateExtractor';

// Exported for backwards-compatibility / external references
export { parseDateFromText };

// Resize high-resolution canvas for fast OCR/AI processing while retaining fine details
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
  const fileInputRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [scanEngine, setScanEngine] = useState('');
  const [foundDate, setFoundDate] = useState(null);
  const [editableDateStr, setEditableDateStr] = useState('');
  const [error, setError] = useState('');
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [customApiKey, setCustomApiKey] = useState(() => localStorage.getItem('foodex_gemini_api_key') || '');

  // Start Camera with fallback chain
  const startCamera = async () => {
    setError('');
    setOcrText('');
    setScanEngine('');
    setFoundDate(null);
    setEditableDateStr('');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.warn('Camera API not accessible in this context.');
      return;
    }

    const constraintList = [
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
    } else if (lastError) {
      console.warn('Camera stream could not start:', lastError);
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

  // Paste image support
  useEffect(() => {
    if (!open) return;
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) handleImageFile(file);
          break;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
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
    setEditableDateStr('');

    try {
      const optCanvas = getOptimizedCanvas(sourceCanvas, 1280);
      const base64Data = optCanvas.toDataURL('image/jpeg', 0.92).split(',')[1];

      let rawText = '';
      let aiSuccess = false;
      let engineUsed = '';

      const cleanKey = (key) => {
        if (!key) return null;
        const trimmed = key.trim().replace(/^["']|["']$/g, '');
        const isPlaceholder = !trimmed || trimmed.toLowerCase().includes('your-') || trimmed.toLowerCase().includes('placeholder');
        return !isPlaceholder ? trimmed : null;
      };

      const localApiKey = cleanKey(localStorage.getItem('foodex_gemini_api_key'));
      const proxyUrl = import.meta.env.VITE_GEMINI_PROXY_URL;
      const envApiKey = cleanKey(import.meta.env.VITE_GEMINI_API_KEY);
      const apiKey = localApiKey || envApiKey;

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

      // 3. Fallback: Multi-Pass Local Tesseract.js OCR (Original, Viewfinder Crop, Adaptive Contrast, Inverted)
      if (!aiSuccess || !rawText) {
        try {
          console.log('[FoodEx Scanner] Running smart multi-pass local OCR...');
          const variants = preprocessCanvasVariants(optCanvas, true);

          const ocrResults = await withTimeout(Promise.all([
            Tesseract.recognize(optCanvas, 'eng').catch(() => null),
            Tesseract.recognize(variants.original, 'eng').catch(() => null),
            Tesseract.recognize(variants.enhanced, 'eng').catch(() => null),
            Tesseract.recognize(variants.inverted, 'eng').catch(() => null)
          ]), 9000);

          const combinedTexts = ocrResults
            .map(r => r?.data?.text || '')
            .filter(Boolean);

          rawText = combinedTexts.join('\n');
          engineUsed = 'Smart Local OCR';
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
          setEditableDateStr(parsedDate.toISOString().split('T')[0]);
        } else {
          setError('No valid expiration date found. Align the package date stamp clearly in the frame or upload a clear photo.');
        }
      } else {
        setError('No date text detected. Hold the camera closer to the date stamp, improve lighting, or upload a photo.');
      }
    } catch (globalErr) {
      console.error('[FoodEx Scanner] Processing error:', globalErr);
      setError('Scan could not complete. Please hold steady or upload a clear photo.');
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

  const handleImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        processImageForDate(canvas);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageFile(file);
    }
  };

  const handleAcceptDate = () => {
    if (editableDateStr) {
      const finalDate = new Date(editableDateStr);
      if (!isNaN(finalDate.getTime())) {
        onDateScanned(finalDate);
        onClose();
        return;
      }
    }
    if (foundDate) {
      onDateScanned(foundDate);
      onClose();
    }
  };

  const handleSaveApiKey = () => {
    if (customApiKey.trim()) {
      localStorage.setItem('foodex_gemini_api_key', customApiKey.trim());
    } else {
      localStorage.removeItem('foodex_gemini_api_key');
    }
    setKeyDialogOpen(false);
  };

  return (
    <>
      <Modal open={open} onClose={onClose} closeAfterTransition aria-labelledby="scanner-modal-title">
        <Fade in={open} timeout={{ enter: 250, exit: 200 }}>
          <Box sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) translateZ(0)',
            willChange: 'opacity, transform',
            backfaceVisibility: 'hidden',
            width: { xs: '95%', sm: 520 },
            maxHeight: '92vh',
            bgcolor: 'background.paper',
            borderRadius: '8px',
            boxShadow: 24,
            overflowY: 'auto',
            outline: 'none'
          }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: 'primary.main', color: '#ffffff' }}>
              <Box>
                <Typography id="scanner-modal-title" variant="h6" sx={{ fontWeight: 'bold' }}>
                  Scan Expiration Date
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.9 }}>
                  ✨ Gemini AI Vision & Smart Multi-Pass OCR
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Tooltip title="Configure Gemini API Key">
                  <IconButton size="small" onClick={() => setKeyDialogOpen(true)} sx={{ color: '#ffffff' }}>
                    <KeyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <IconButton size="small" onClick={onClose} sx={{ color: '#ffffff' }}>
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>

            {/* Camera Feed & Canvas */}
            <Box sx={{ position: 'relative', width: '100%', pt: '70%', bgcolor: '#000000' }}>
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
                  border: '2px dashed rgba(255, 255, 255, 0.85)',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)',
                  zIndex: 5,
                  pointerEvents: 'none',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Typography variant="caption" sx={{ color: '#ffffff', bgcolor: 'rgba(0,0,0,0.6)', px: 1, py: 0.5, borderRadius: '4px' }}>
                    Frame Date Stamp Here
                  </Typography>
                </Box>
              )}

              {!stream && (
                <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3, textAlign: 'center', color: '#aaaaaa' }}>
                  <CameraIcon sx={{ fontSize: 48, mb: 1, opacity: 0.6 }} />
                  <Typography variant="body2" sx={{ fontWeight: 'medium' }}>Live Camera Preview Inactive</Typography>
                  <Typography variant="caption" color="text.secondary">Use the Upload Photo button below or paste an image (Ctrl+V).</Typography>
                </Box>
              )}

              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </Box>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />

            {/* Controls & Results */}
            <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
              {error && <Alert severity="warning" sx={{ width: '100%' }}>{error}</Alert>}

              {loading && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, py: 1 }}>
                  <CircularProgress size={32} />
                  <Typography variant="body2" color="text.secondary">Extracting date stamp with AI & OCR...</Typography>
                </Box>
              )}

              {/* Found Date Card */}
              {foundDate && (
                <Card variant="outlined" sx={{ width: '100%', bgcolor: 'success.light', color: 'success.contrastText', p: 1.5, borderRadius: '6px' }}>
                  <CardContent sx={{ py: 0.5, '&:last-child': { pb: 1 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CheckIcon fontSize="small" />
                        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Date Detected!</Typography>
                      </Box>
                      <Typography variant="caption" sx={{ opacity: 0.9, fontWeight: 'medium' }}>{scanEngine}</Typography>
                    </Box>
                    
                    <TextField
                      type="date"
                      fullWidth
                      size="small"
                      value={editableDateStr}
                      onChange={(e) => setEditableDateStr(e.target.value)}
                      sx={{
                        bgcolor: 'background.paper',
                        borderRadius: '4px',
                        '& .MuiInputBase-input': { fontWeight: 'bold', fontSize: '1.1rem' }
                      }}
                    />
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'flex-end', pt: 1 }}>
                    <Button size="medium" variant="contained" color="success" onClick={handleAcceptDate} sx={{ fontWeight: 'bold' }}>
                      Confirm Date
                    </Button>
                  </CardActions>
                </Card>
              )}

              {/* Raw OCR Text Display */}
              {ocrText && !foundDate && !loading && (
                <Box sx={{ width: '100%', bgcolor: 'action.hover', p: 1.5, borderRadius: '4px' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>Detected Text:</Typography>
                    <Typography variant="caption" color="primary.main" sx={{ fontWeight: 'bold' }}>{scanEngine}</Typography>
                  </Box>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', whiteSpace: 'pre-wrap', maxHeight: 100, overflowY: 'auto' }}>
                    {ocrText}
                  </Typography>
                </Box>
              )}

              {/* Action Buttons */}
              <Box sx={{ width: '100%', display: 'flex', gap: 1.5 }}>
                {stream && (
                  <Button
                    fullWidth
                    variant="contained"
                    color="primary"
                    startIcon={<CameraIcon />}
                    disabled={loading}
                    onClick={handleCapture}
                    sx={{ py: 1.2, fontWeight: 'bold' }}
                  >
                    Capture & Scan
                  </Button>
                )}

                <Button
                  fullWidth={!stream}
                  variant={stream ? "outlined" : "contained"}
                  color="primary"
                  startIcon={<UploadIcon />}
                  disabled={loading}
                  onClick={() => fileInputRef.current?.click()}
                  sx={{ py: 1.2, fontWeight: 'bold' }}
                >
                  Upload Photo
                </Button>
              </Box>
            </Box>
          </Box>
        </Fade>
      </Modal>

      {/* Gemini API Key Dialog */}
      <Dialog open={keyDialogOpen} onClose={() => setKeyDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Gemini AI Vision Setup</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Provide your Google Gemini API key to enable high-accuracy AI visual expiration date extraction. Stored securely in your browser.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Gemini API Key"
            type="password"
            value={customApiKey}
            onChange={(e) => setCustomApiKey(e.target.value)}
            placeholder="AIzaSy..."
            helperText="Leave empty to use Smart Local OCR"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setKeyDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveApiKey}>Save Key</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

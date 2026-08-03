import React, { useRef, useState, useEffect } from 'react';
import { 
  Modal, Box, Typography, Button, CircularProgress, 
  Alert, IconButton, Card, CardActions, CardContent,
  Fade
} from '@mui/material';
import { 
  Close as CloseIcon, CameraAlt as CameraIcon,
  FileUpload as UploadIcon 
} from '@mui/icons-material';
import Tesseract from 'tesseract.js';

export function parseDateFromText(text) {
  if (!text) return null;
  const clean = text.toUpperCase().replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ');

  const monthNames = {
    JAN: 0, JANU: 0, JANUARY: 0, IAN: 0,
    FEB: 1, FEBR: 1, FEBRUARY: 1,
    MAR: 2, MARC: 2, MARCH: 2,
    APR: 3, APRI: 3, APRIL: 3,
    MAY: 4, MAI: 4,
    JUN: 5, JUNE: 5, IUN: 5,
    JUL: 6, JULY: 6, IUL: 6,
    AUG: 7, AUGUST: 7, AGO: 7,
    SEP: 8, SEPT: 8, SEPTEMBER: 8,
    OCT: 9, OCTO: 9, OCTOBER: 9, OKT: 9,
    NOV: 10, NOVE: 10, NOVEMBER: 10,
    DEC: 11, DECE: 11, DECEMBER: 11
  };

  // 1. Pattern: YYYY-MM-DD or YYYY.MM.DD or YYYY/MM/DD
  const ymdMatch = clean.match(/\b(202[4-9]|203[0-9])[-./](0[1-9]|1[0-2])[-./](0[1-9]|[12][0-9]|3[01])\b/);
  if (ymdMatch) {
    const d = new Date(parseInt(ymdMatch[1]), parseInt(ymdMatch[2]) - 1, parseInt(ymdMatch[3]));
    if (!isNaN(d.getTime())) return d;
  }

  // 2. Pattern: DD-MM-YYYY or DD.MM.YYYY or DD/MM/YYYY
  const dmyMatch = clean.match(/\b(0[1-9]|[12][0-9]|3[01])[-./](0[1-9]|1[0-2])[-./](202[4-9]|203[0-9])\b/);
  if (dmyMatch) {
    const d = new Date(parseInt(dmyMatch[3]), parseInt(dmyMatch[2]) - 1, parseInt(dmyMatch[1]));
    if (!isNaN(d.getTime())) return d;
  }

  // 3. Pattern: DD MMM YYYY or DD-MMM-YYYY or DD MMM YY
  const monthKeys = Object.keys(monthNames).join('|');
  const dMonYMatch = clean.match(new RegExp(`\\b(0?[1-9]|[12][0-9]|3[01])[-./\\s]+(${monthKeys})[-./\\s]+(202[4-9]|203[0-9]|[2-3][0-9])\\b`));
  if (dMonYMatch) {
    const day = parseInt(dMonYMatch[1]);
    const month = monthNames[dMonYMatch[2]];
    let year = parseInt(dMonYMatch[3]);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // 4. Pattern: MMM DD YYYY
  const monDYMatch = clean.match(new RegExp(`\\b(${monthKeys})[-./\\s]+(0?[1-9]|[12][0-9]|3[01])[-./\\s]+(202[4-9]|203[0-9]|[2-3][0-9])\\b`));
  if (monDYMatch) {
    const month = monthNames[monDYMatch[1]];
    const day = parseInt(monDYMatch[2]);
    let year = parseInt(monDYMatch[3]);
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // 5. Short date DD.MM.YY or MM/DD/YY (e.g. 15.08.26 or 08/15/26)
  const shortDateMatch = clean.match(/\b(0[1-9]|[12][0-9]|3[01])[-./](0[1-9]|1[0-2])[-./](2[4-9]|3[0-9])\b/);
  if (shortDateMatch) {
    const p1 = parseInt(shortDateMatch[1]);
    const p2 = parseInt(shortDateMatch[2]);
    const year = 2000 + parseInt(shortDateMatch[3]);
    let month = p2 - 1;
    let day = p1;
    if (p2 > 12) {
      month = p1 - 1;
      day = p2;
    }
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // 6. Month and Year only (e.g. EXP 08/26 or 08/2026 or EXP 08-2026)
  const monthYearMatch = clean.match(/\b(?:EXP|BB|EXPIRATION|BEST BEFORE)?\s*:?\s*(0[1-9]|1[0-2])[-./](202[4-9]|203[0-9]|[2-3][0-9])\b/);
  if (monthYearMatch) {
    const month = parseInt(monthYearMatch[1]) - 1;
    let year = parseInt(monthYearMatch[2]);
    if (year < 100) year += 2000;
    const d = new Date(year, month + 1, 0); // Last day of month
    if (!isNaN(d.getTime())) return d;
  }

  return null;
}

export default function ScannerModal({ open, onClose, onDateScanned }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [foundDate, setFoundDate] = useState(null);
  const [error, setError] = useState('');

  // Start Camera with robust fallback chain
  const startCamera = async () => {
    setError('');
    setOcrText('');
    setFoundDate(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError('Camera API is not accessible in this context. Use the "Upload Photo of Date" option below to scan an image.');
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
    } else {
      console.error('Camera fallback chain error:', lastError);
      if (lastError && (lastError.name === 'NotAllowedError' || lastError.name === 'PermissionDeniedError')) {
        setError('Camera access permission was denied by your browser. Allow camera access in your browser site settings or upload a photo of the date below.');
      } else if (lastError && (lastError.name === 'NotFoundError' || lastError.name === 'DevicesNotFoundError')) {
        setError('No camera detected on this device. You can upload an image photo of the expiration date below.');
      } else {
        setError('Could not start live camera preview. You can choose a photo of the product date below.');
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

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setLoading(true);
    setError('');
    setOcrText('');
    setFoundDate(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Crop dimensions (center 70% width, 40% height)
    const sWidth = video.videoWidth * 0.7;
    const sHeight = video.videoHeight * 0.4;
    const sx = (video.videoWidth - sWidth) / 2;
    const sy = (video.videoHeight - sHeight) / 2;

    canvas.width = sWidth;
    canvas.height = sHeight;

    ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

    const base64Data = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

    let rawText = '';
    let aiSuccess = false;

    // 1. Try Gemini API / Proxy if configured
    const proxyUrl = import.meta.env.VITE_GEMINI_PROXY_URL;
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

    if (proxyUrl || apiKey) {
      try {
        if (proxyUrl) {
          const response = await fetch(proxyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: { imageBase64: base64Data } })
          });
          if (response.ok) {
            const result = await response.json();
            rawText = result.result?.date || result.date || '';
            aiSuccess = true;
          }
        } else if (apiKey) {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: "Extract the expiration date from this image. Return ONLY the date in YYYY-MM-DD format. If no clear expiration date is found, return 'null'." },
                  { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
                ]
              }]
            })
          });
          if (response.ok) {
            const data = await response.json();
            rawText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
            aiSuccess = true;
          }
        }
      } catch (geminiErr) {
        console.warn('Gemini API call failed, falling back to local OCR:', geminiErr);
      }
    }

    // 2. Fallback to Local Client-side Tesseract.js OCR if AI was not configured or failed
    if (!aiSuccess || !rawText || rawText.toLowerCase() === 'null') {
      try {
        console.log('[FoodEx Scanner] Running local Tesseract.js OCR...');
        const ocrResult = await Tesseract.recognize(canvas, 'eng');
        rawText = ocrResult.data?.text || '';
      } catch (ocrErr) {
        console.error('Tesseract OCR error:', ocrErr);
      }
    }

    setOcrText(rawText);

    // 3. Parse date
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
        setError('No valid expiration date could be extracted from the scanned frame. Please align the date clearly inside the box and try again.');
      }
    } else {
      setError('No readable text found in the frame. Please align the expiration date inside the box.');
    }

    setLoading(false);
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setOcrText('');
    setFoundDate(null);

    try {
      const image = new Image();
      image.src = URL.createObjectURL(file);
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });

      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = image.naturalWidth || image.width;
      canvas.height = image.naturalHeight || image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);

      console.log('[FoodEx Scanner] Running local OCR on uploaded image file...');
      const ocrResult = await Tesseract.recognize(canvas, 'eng');
      const rawText = ocrResult.data?.text || '';
      setOcrText(rawText);

      if (rawText) {
        const parsedDate = parseDateFromText(rawText);
        if (parsedDate && !isNaN(parsedDate.getTime())) {
          setFoundDate(parsedDate);
        } else {
          setError('Could not extract a valid expiration date from the uploaded image. Please try a clearer picture.');
        }
      } else {
        setError('No text detected in the uploaded image file.');
      }
    } catch (fileErr) {
      console.error('File upload OCR error:', fileErr);
      setError('Failed to process the uploaded image file.');
    } finally {
      setLoading(false);
    }
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
            <Typography id="scanner-modal-title" variant="h6" sx={{ fontWeight: 'bold' }}>
              Scan Expiration Date
            </Typography>
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
                top: '30%',
                left: '15%',
                width: '70%',
                height: '40%',
                border: '2px dashed #ffffff',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                zIndex: 5,
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Typography variant="caption" sx={{ color: '#ffffff', bgcolor: 'rgba(0,0,0,0.6)', p: 0.5, borderRadius: 0.5 }}>
                  Align Expiration Date Here
                </Typography>
              </Box>
            )}

            {!stream && (
              <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 3, textAlign: 'center', color: '#aaaaaa' }}>
                <CameraIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                <Typography variant="body2">Camera preview inactive or blocked.</Typography>
                <Typography variant="caption" color="text.secondary">Use the upload button below to select a photo of the date.</Typography>
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
                <Typography variant="caption" color="text.secondary" display="block" sx={{ fontWeight: 'bold' }}>Scanned Text:</Typography>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {ocrText}
                </Typography>
              </Box>
            )}

            {foundDate && (
              <Card variant="outlined" sx={{ width: '100%', bgcolor: 'success.light', color: 'success.contrastText', p: 1 }}>
                <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>Date Detected!</Typography>
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

            <Box sx={{ display: 'flex', gap: 1.5, width: '100%', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<CameraIcon />}
                disabled={loading || !stream}
                onClick={handleCapture}
                sx={{ flex: 1, py: 1.5 }}
              >
                Capture & Scan
              </Button>

              <Button
                variant="outlined"
                component="label"
                startIcon={<UploadIcon />}
                disabled={loading}
                sx={{ flex: 1, py: 1.5 }}
              >
                Upload Photo
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={handleFileUpload}
                />
              </Button>
            </Box>
          </Box>
        </Box>
      </Fade>
    </Modal>
  );
}

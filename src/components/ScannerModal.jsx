import React, { useRef, useState, useEffect } from 'react';
import { 
  Modal, Box, Typography, Button, CircularProgress, 
  Alert, IconButton, Card, CardActions, CardContent,
  Fade
} from '@mui/material';
import { Close as CloseIcon, CameraAlt as CameraIcon } from '@mui/icons-material';
import Tesseract from 'tesseract.js';

export default function ScannerModal({ open, onClose, onDateScanned }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ocrText, setOcrText] = useState('');
  const [foundDate, setFoundDate] = useState(null);
  const [error, setError] = useState('');

  // Start Camera
  const startCamera = async () => {
    setError('');
    setOcrText('');
    setFoundDate(null);
    try {
      const constraints = {
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
    } catch (err) {
      console.error('Error starting camera:', err);
      setError('Could not access your camera. Please ensure permissions are granted.');
    }
  };

  // Attach stream to video element safely
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  // Stop Camera
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

  // Robust date parser with OCR digit correction and two-segment date support
  const extractDate = (text) => {
    const normalized = text.toLowerCase().replace(/\s+/g, ' ');
    
    // Character substitution helper to correct common OCR typos in date segments
    const cleanGroup = (str) => {
      return str
        .replace(/[oO]/g, '0')
        .replace(/[iIl|]/g, '1')
        .replace(/[sS]/g, '5')
        .replace(/[bB]/g, '8')
        .replace(/[gG]/g, '9');
    };

    // Character set class representing digits (including common OCR typos)
    const dClass = '[0-9iIl|sSbBgG]';

    // Helper to calculate the last day of a month
    const getLastDayOfMonth = (year, month) => {
      return new Date(year, month, 0).getDate(); // 0th day of next month is last day of current
    };

    // Separator pattern allowing optional surrounding spaces (supporting: /, ., en-dash, and hyphen)
    const sep = '\\s*[\\/\\.\\–-]\\s*';

    // Pattern 1: DD/MM/YYYY or MM/DD/YYYY (with standard separators or spaces)
    const pattern1 = new RegExp(`\\b(${dClass}{1,2})(${sep}|\\s+)(${dClass}{1,2})(${sep}|\\s+)(${dClass}{2,4})\\b`, 'g');
    let match;
    while ((match = pattern1.exec(normalized)) !== null) {
      let d = parseInt(cleanGroup(match[1]));
      let m = parseInt(cleanGroup(match[2]));
      let y = parseInt(cleanGroup(match[3]));
      
      if (isNaN(d) || isNaN(m) || isNaN(y)) continue;
      if (y < 100) y += 2000; // Assume 21st century

      // Swap day/month if month is out of bounds
      if (m > 12 && d <= 12) {
        const temp = d;
        d = m;
        m = temp;
      }

      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return new Date(y, m - 1, d);
      }
    }

    // Pattern 2: YYYY-MM-DD
    const pattern2 = new RegExp(`\\b(${dClass}{4})(${sep}|\\s+)(${dClass}{1,2})(${sep}|\\s+)(${dClass}{1,2})\\b`, 'g');
    while ((match = pattern2.exec(normalized)) !== null) {
      const y = parseInt(cleanGroup(match[1]));
      const m = parseInt(cleanGroup(match[2]));
      const d = parseInt(cleanGroup(match[3]));
      
      if (isNaN(d) || isNaN(m) || isNaN(y)) continue;
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
        return new Date(y, m - 1, d);
      }
    }

    // Pattern 3: MM/YYYY or MM.YYYY (common for shelf-stable items, e.g., 09.2026 or 12/2027)
    const patternMMYYYY = new RegExp(`\\b(${dClass}{1,2})(${sep})(${dClass}{4})\\b`, 'g');
    while ((match = patternMMYYYY.exec(normalized)) !== null) {
      const m = parseInt(cleanGroup(match[1]));
      let y = parseInt(cleanGroup(match[2]));

      if (isNaN(m) || isNaN(y)) continue;
      if (m >= 1 && m <= 12 && y >= 2000 && y <= 2100) {
        const lastDay = getLastDayOfMonth(y, m);
        return new Date(y, m - 1, lastDay);
      }
    }

    // Pattern 4: YYYY/MM or YYYY.MM
    const patternYYYYMM = new RegExp(`\\b(${dClass}{4})(${sep})(${dClass}{1,2})\\b`, 'g');
    while ((match = patternYYYYMM.exec(normalized)) !== null) {
      let y = parseInt(cleanGroup(match[1]));
      const m = parseInt(cleanGroup(match[2]));

      if (isNaN(m) || isNaN(y)) continue;
      if (m >= 1 && m <= 12 && y >= 2000 && y <= 2100) {
        const lastDay = getLastDayOfMonth(y, m);
        return new Date(y, m - 1, lastDay);
      }
    }

    // Pattern 5: Text Month, e.g. "15 Sep 2026" or "15 Dec 2026" or "15 Iul 2026"
    const months = {
      jan: 0, ian: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4, mai: 4,
      jun: 5, iun: 5,
      jul: 6, iul: 6,
      aug: 7,
      sep: 8, sept: 8,
      oct: 9,
      nov: 10, noi: 10,
      dec: 11
    };
    const monthNames = Object.keys(months).join('|');
    
    // Day Month Year
    const pattern3 = new RegExp(`\\b(\\d{1,2})\\s+(${monthNames})[a-z]*\\s+(\\d{2,4})\\b`, 'i');
    match = pattern3.exec(normalized);
    if (match) {
      const d = parseInt(match[1]);
      const m = months[match[2].toLowerCase()];
      let y = parseInt(match[3]);
      if (y < 100) y += 2000;
      return new Date(y, m, d);
    }

    // Month Day Year
    const pattern4 = new RegExp(`\\b(${monthNames})[a-z]*\\s+(\\d{1,2})\\s*,?\\s*(\\d{2,4})\\b`, 'i');
    match = pattern4.exec(normalized);
    if (match) {
      const m = months[match[1].toLowerCase()];
      const d = parseInt(match[2]);
      let y = parseInt(match[3]);
      if (y < 100) y += 2000;
      return new Date(y, m, d);
    }

    return null;
  };

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    setLoading(true);
    setError('');
    setOcrText('');
    setFoundDate(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Define source crop dimensions (center 60% width, 30% height)
    const sWidth = video.videoWidth * 0.6;
    const sHeight = video.videoHeight * 0.3;
    const sx = (video.videoWidth - sWidth) / 2;
    const sy = (video.videoHeight - sHeight) / 2;

    // Match canvas size to the cropped region size
    canvas.width = sWidth;
    canvas.height = sHeight;

    // Draw only the cropped center region of the video frame to the canvas
    ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

    // Apply basic grayscale processing on the cropped region to help OCR
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const grayscale = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = grayscale;
      data[i+1] = grayscale;
      data[i+2] = grayscale;
    }
    ctx.putImageData(imgData, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg');

    try {
      const result = await Tesseract.recognize(dataUrl, 'eng', {
        logger: m => console.log(m)
      });
      
      const recognizedText = result.data.text;
      setOcrText(recognizedText);

      const parsedDate = extractDate(recognizedText);
      if (parsedDate) {
        setFoundDate(parsedDate);
      } else {
        setError("Could not detect a valid expiration date. Please try again with clear, aligned text.");
      }
    } catch (err) {
      console.error('OCR processing error:', err);
      setError('OCR engine failed to run. Please enter date manually.');
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
    <Modal open={open} onClose={onClose} aria-labelledby="scanner-modal-title">
      <Fade in={open}>
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
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
            <Box sx={{
              position: 'absolute',
              top: '35%',
              left: '20%',
              width: '60%',
              height: '30%',
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

            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </Box>

          {/* Controls & Results */}
          <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
            {error && <Alert severity="warning" sx={{ width: '100%' }}>{error}</Alert>}

            {loading && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={32} />
                <Typography variant="body2" color="text.secondary">Reading image text (OCR)...</Typography>
              </Box>
            )}

            {ocrText && !foundDate && !loading && (
              <Box sx={{ width: '100%', bgcolor: 'action.hover', p: 1.5, borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" display="block">Detected text:</Typography>
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
                    {foundDate.toLocaleDateString()}
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                  <Button size="small" variant="contained" color="success" onClick={handleAcceptDate}>
                    Confirm Date
                  </Button>
                </CardActions>
              </Card>
            )}

            <Button
              variant="contained"
              color="primary"
              startIcon={<CameraIcon />}
              disabled={loading || !stream}
              onClick={handleCapture}
              sx={{ width: '100%', py: 1.5 }}
            >
              Capture and Scan
            </Button>
          </Box>
        </Box>
      </Fade>
    </Modal>
  );
}

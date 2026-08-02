import React, { useRef, useState, useEffect } from 'react';
import { 
  Modal, Box, Typography, Button, CircularProgress, 
  Alert, IconButton, Card, CardActions, CardContent,
  Fade
} from '@mui/material';
import { Close as CloseIcon, CameraAlt as CameraIcon } from '@mui/icons-material';


export default function ScannerModal({ open, onClose, onDateScanned }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(false);

  const [foundDate, setFoundDate] = useState(null);
  const [error, setError] = useState('');

  // Start Camera
  const startCamera = async () => {
    setError('');
    setFoundDate(null);
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



  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setError('VITE_GEMINI_API_KEY is not set in your .env file.');
      return;
    }

    setLoading(true);
    setError('');
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

    // No need to grayscale for Gemini, but we keep it simple. We can just send the raw cropped image.
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const base64Data = dataUrl.split(',')[1]; // Remove 'data:image/jpeg;base64,' prefix

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: "Extract the expiration date from this image. Return ONLY the date in YYYY-MM-DD format. If no clear expiration date is found, return the exact word 'null'."
              },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: base64Data
                }
              }
            ]
          }]
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (textResponse && textResponse.toLowerCase() !== 'null') {
        const parsedDate = new Date(textResponse);
        if (!isNaN(parsedDate.getTime())) {
          setFoundDate(parsedDate);
        } else {
          setError("Could not parse the date returned by the AI.");
        }
      } else {
        setError("Could not detect a valid expiration date. Please try again.");
      }
    } catch (err) {
      console.error('AI processing error:', err);
      setError('AI request failed. Please check your network and API key.');
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
                <Typography variant="body2" color="text.secondary">Analyzing image with AI...</Typography>
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

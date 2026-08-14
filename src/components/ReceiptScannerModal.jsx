import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography,
  Button, TextField, CircularProgress, Alert, Divider, Checkbox,
  IconButton, Table, TableBody, TableCell, TableHead, TableRow,
  Select, MenuItem, FormControl, InputLabel, Paper, LinearProgress, Chip
} from '@mui/material';
import {
  Receipt as ReceiptIcon, Close as CloseIcon,
  Add as AddIcon, CameraAlt as CameraIcon,
  Upload as UploadIcon, CheckBox as CheckBoxIcon
} from '@mui/icons-material';
import Tesseract from 'tesseract.js';

// Shelf life suggestions (days) pulled from FoodKeeper approximate data
const SHELF_LIFE = {
  milk: 7, cream: 5, yogurt: 14, cheese: 21, butter: 45,
  eggs: 35, chicken: 3, beef: 5, pork: 5, fish: 3, shrimp: 3,
  bread: 7, lettuce: 7, spinach: 7, carrot: 21, apple: 30,
  banana: 7, orange: 21, strawberry: 5, grape: 7,
  pasta: 730, rice: 730, flour: 365, sugar: 730,
  coffee: 365, tea: 730, default: 14
};

function guessShelfLife(name) {
  const n = name.toLowerCase();
  for (const [key, days] of Object.entries(SHELF_LIFE)) {
    if (key !== 'default' && n.includes(key)) return days;
  }
  return SHELF_LIFE.default;
}

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().substring(0, 10);
}

function guessLocation(name) {
  const n = name.toLowerCase();
  if (/frozen|ice cream/.test(n)) return 'Freezer';
  if (/milk|cream|butter|cheese|yogurt|egg|meat|beef|chicken|pork|fish|shrimp|fresh/.test(n)) return 'Fridge';
  return 'Pantry';
}

// Parse receipt text into product lines
function parseReceiptLines(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const items = [];
  const skipPatterns = /total|subtotal|tax|vat|tva|change|cash|card|receipt|thank|store|tel|phone|www|date|time|invoice|item|qty|price|amount|discount|store|supermarket|\d{2}[\/\-.]\d{2}[\/\-.]\d{2,4}/i;
  const pricePattern = /[\d]+[.,]\d{2}/;

  for (const line of lines) {
    if (skipPatterns.test(line)) continue;
    if (line.length < 3 || line.length > 60) continue;
    // Remove prices and quantities from the beginning/end
    const cleaned = line
      .replace(/^\d+\s*[xX]\s*/, '')  // remove qty prefix like "2 x"
      .replace(/\s*[\d]+[.,]\d{2}.*$/, '')  // remove trailing price
      .replace(/^[\W\d]+/, '')  // remove leading non-word chars
      .trim();

    if (cleaned.length < 3) continue;
    if (/^\d+$/.test(cleaned)) continue;

    items.push({
      id: Math.random().toString(36).substring(2),
      name: cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase(),
      quantity: 1,
      location: guessLocation(cleaned),
      expirationDate: addDays(guessShelfLife(cleaned)),
      selected: true
    });
  }
  return items.slice(0, 30); // max 30 items
}

// Gemini-based receipt parsing
async function parseWithGemini(base64Data, apiKey) {
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
  for (const model of models) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'This is a grocery store receipt. Extract ONLY the purchased food/product item names, one per line. Exclude prices, totals, taxes, store name, dates, receipt numbers, and any non-food items. Return just the product names, one per line, nothing else.' },
              { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
            ]
          }]
        })
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return text;
      }
    } catch (e) {}
  }
  return null;
}

export default function ReceiptScannerModal({ open, onClose, onItemsAdded, settings }) {
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [phase, setPhase] = useState('capture'); // 'capture' | 'processing' | 'review'
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [engine, setEngine] = useState('');

  const stopCamera = () => {
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
  };

  useEffect(() => {
    if (open) {
      setPhase('capture');
      setItems([]);
      setError('');
      setProgress(0);
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open]);

  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }
      });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch (e) {
      setError('Camera not available. Upload a photo of your receipt instead.');
    }
  };

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  const processImage = async (imageData) => {
    stopCamera();
    setPhase('processing');
    setProgress(10);
    setError('');

    try {
      const apiKey = localStorage.getItem('foodex_gemini_api_key')?.trim();
      let rawText = '';

      if (apiKey) {
        setEngine('Gemini AI Vision');
        setProgress(30);
        const geminiText = await parseWithGemini(imageData, apiKey);
        if (geminiText) {
          rawText = geminiText;
          setProgress(70);
        }
      }

      if (!rawText) {
        setEngine('Local OCR');
        setProgress(40);
        const result = await Tesseract.recognize(
          `data:image/jpeg;base64,${imageData}`, 'eng',
          { logger: m => { if (m.status === 'recognizing text') setProgress(40 + Math.round(m.progress * 40)); } }
        );
        rawText = result.data.text;
        setProgress(85);
      }

      const parsed = parseReceiptLines(rawText);
      setProgress(100);

      if (parsed.length === 0) {
        setError('No food items detected. Try better lighting or upload a clearer photo.');
        setPhase('capture');
        startCamera();
        return;
      }

      setItems(parsed);
      setPhase('review');
    } catch (err) {
      setError('Processing failed: ' + err.message);
      setPhase('capture');
      startCamera();
    }
  };

  const handleCapture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
    processImage(base64);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result.split(',')[1];
      processImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleAddAll = () => {
    const selected = items.filter(i => i.selected && i.name.trim());
    onItemsAdded(selected);
    onClose();
  };

  const toggleItem = (id) => setItems(prev => prev.map(i => i.id === id ? { ...i, selected: !i.selected } : i));
  const updateItem = (id, field, value) => setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  const removeItem = (id) => setItems(prev => prev.filter(i => i.id !== id));
  const selectedCount = items.filter(i => i.selected).length;

  const locations = settings?.locations || ['Fridge', 'Freezer', 'Pantry'];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 'bold' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptIcon color="primary" />
          Receipt Scanner
          {engine && <Chip label={engine} size="small" color="info" variant="outlined" />}
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

        {/* ── Phase 1: Capture ── */}
        {phase === 'capture' && (
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Point the camera at your grocery receipt and tap <strong>Capture Receipt</strong>, or upload a photo.
            </Typography>
            <Box sx={{ position: 'relative', bgcolor: '#000', borderRadius: 2, overflow: 'hidden', mb: 2, maxHeight: 400 }}>
              <video ref={videoRef} style={{ width: '100%', display: 'block' }} autoPlay muted playsInline />
              {!stream && (
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography color="white" variant="body2">Camera unavailable</Typography>
                </Box>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
              <Button variant="contained" startIcon={<CameraIcon />} onClick={handleCapture} disabled={!stream} size="large">
                Capture Receipt
              </Button>
              <Button variant="outlined" startIcon={<UploadIcon />} onClick={() => fileInputRef.current?.click()}>
                Upload Photo
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFileUpload} />
            </Box>
          </Box>
        )}

        {/* ── Phase 2: Processing ── */}
        {phase === 'processing' && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="h6" sx={{ mb: 1 }}>Scanning Receipt…</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {engine ? `Using ${engine}` : 'Initializing OCR engine…'}
            </Typography>
            <LinearProgress variant="determinate" value={progress} sx={{ borderRadius: 2, height: 8 }} />
          </Box>
        )}

        {/* ── Phase 3: Review & Edit ── */}
        {phase === 'review' && (
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="body1">
                <strong>{selectedCount}</strong> of {items.length} items selected
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" onClick={() => setItems(p => p.map(i => ({ ...i, selected: true })))}>Select All</Button>
                <Button size="small" onClick={() => setItems(p => p.map(i => ({ ...i, selected: false })))}>Deselect All</Button>
              </Box>
            </Box>

            <Paper variant="outlined" sx={{ maxHeight: 380, overflowY: 'auto', borderRadius: 2 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell sx={{ fontWeight: 'bold' }}>Product Name</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: 70 }}>Qty</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: 110 }}>Location</TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: 130 }}>Expires</TableCell>
                    <TableCell sx={{ width: 40 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map(item => (
                    <TableRow key={item.id} selected={item.selected} hover>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={item.selected} onChange={() => toggleItem(item.id)} />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small" fullWidth variant="standard"
                          value={item.name}
                          onChange={e => updateItem(item.id, 'name', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small" type="number" variant="standard"
                          value={item.quantity}
                          onChange={e => updateItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                          inputProps={{ min: 1, style: { width: 50 } }}
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          size="small" variant="standard" fullWidth
                          value={item.location}
                          onChange={e => updateItem(item.id, 'location', e.target.value)}
                        >
                          {locations.map(l => <MenuItem key={l} value={l}>{l}</MenuItem>)}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small" type="date" variant="standard"
                          value={item.expirationDate}
                          onChange={e => updateItem(item.id, 'expirationDate', e.target.value)}
                          inputProps={{ style: { fontSize: '0.8rem' } }}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" color="error" onClick={() => removeItem(item.id)}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {phase === 'review' && (
          <>
            <Button onClick={() => { setPhase('capture'); startCamera(); }}>Scan Again</Button>
            <Button
              variant="contained" color="primary"
              startIcon={<AddIcon />}
              onClick={handleAddAll}
              disabled={selectedCount === 0}
            >
              Add {selectedCount} Item{selectedCount !== 1 ? 's' : ''} to Inventory
            </Button>
          </>
        )}
        {phase !== 'review' && <Button onClick={onClose}>Cancel</Button>}
      </DialogActions>
    </Dialog>
  );
}

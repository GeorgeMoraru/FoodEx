import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Box, Typography,
  Button, TextField, CircularProgress, Alert, Divider, Chip,
  IconButton, Card, CardContent, CardMedia
} from '@mui/material';
import {
  QrCodeScanner as ScanIcon, Close as CloseIcon,
  Search as SearchIcon, Add as AddIcon, Check as CheckIcon
} from '@mui/icons-material';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';

// Map OpenFoodFacts categories → FoodEx storage location
function guessLocation(categories = '', productName = '') {
  const text = (categories + ' ' + productName).toLowerCase();
  if (/frozen|ice cream|gelato/.test(text)) return 'Freezer';
  if (/milk|dairy|cheese|yogurt|cream|butter|egg|meat|beef|pork|chicken|fish|seafood|fresh|deli/.test(text)) return 'Fridge';
  return 'Pantry';
}

// Fetch OpenFoodFacts data
async function fetchProductByBarcode(barcode) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,quantity,image_front_url,categories,nutriments`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Network error');
  const data = await res.json();
  if (data.status !== 1) return null;
  const p = data.product || {};
  return {
    name: [p.brands, p.product_name].filter(Boolean).join(' – ') || '',
    quantity: p.quantity || '',
    imageUrl: p.image_front_url || '',
    location: guessLocation(p.categories || '', p.product_name || ''),
    rawName: p.product_name || '',
    brand: p.brands || ''
  };
}

export default function BarcodeScannerModal({ open, onClose, onProductFound }) {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [found, setFound] = useState(null);
  const [lastScanned, setLastScanned] = useState('');

  const stopScanner = useCallback(() => {
    if (readerRef.current) {
      try { readerRef.current.reset(); } catch (e) {}
      readerRef.current = null;
    }
    setScanning(false);
  }, []);

  const lookupBarcode = useCallback(async (barcode) => {
    if (barcode === lastScanned || loading) return;
    setLastScanned(barcode);
    setLoading(true);
    setError('');
    setFound(null);
    stopScanner();
    try {
      const product = await fetchProductByBarcode(barcode);
      if (!product || !product.name) {
        setError(`Barcode ${barcode} not found in OpenFoodFacts. Enter the product name manually.`);
        setFound({ name: '', location: 'Pantry', imageUrl: '', quantity: '', barcode });
      } else {
        setFound({ ...product, barcode });
      }
    } catch (err) {
      setError('Could not fetch product info. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  }, [lastScanned, loading, stopScanner]);

  const startScanner = useCallback(async () => {
    if (!videoRef.current) return;
    setError('');
    setFound(null);
    setLastScanned('');

    try {
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      setScanning(true);

      await reader.decodeFromVideoDevice(undefined, videoRef.current, (result, err) => {
        if (result) {
          lookupBarcode(result.getText());
        }
      });
    } catch (err) {
      setScanning(false);
      setError('Camera access denied or unavailable. Use the manual barcode input below.');
    }
  }, [lookupBarcode]);

  useEffect(() => {
    if (open) {
      setError('');
      setFound(null);
      setManualBarcode('');
      setLastScanned('');
      startScanner();
    } else {
      stopScanner();
    }
    return () => stopScanner();
  }, [open]);

  const handleManualLookup = () => {
    const code = manualBarcode.trim();
    if (!code) return;
    setLastScanned('');
    lookupBarcode(code);
  };

  const handleAdd = () => {
    if (!found) return;
    onProductFound(found);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 'bold' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScanIcon color="primary" />
          Barcode Scanner
        </Box>
        <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 1 }}>
        {error && <Alert severity="warning" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Camera Preview */}
        {!found && (
          <Box sx={{ position: 'relative', bgcolor: '#000', borderRadius: 2, overflow: 'hidden', mb: 2, aspectRatio: '4/3' }}>
            <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} autoPlay muted playsInline />
            {/* Scanning overlay reticle */}
            <Box sx={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '65%', height: '35%',
              border: '3px solid',
              borderColor: scanning ? 'primary.main' : 'grey.500',
              borderRadius: 2,
              boxShadow: scanning ? '0 0 0 2000px rgba(0,0,0,0.4)' : 'none',
              transition: 'border-color 0.3s'
            }} />
            {scanning && (
              <Box sx={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)', bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', px: 1.5, py: 0.5, borderRadius: 2 }}>
                <Typography variant="caption">Hold barcode within the frame</Typography>
              </Box>
            )}
            {loading && (
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(0,0,0,0.6)' }}>
                <CircularProgress color="primary" />
              </Box>
            )}
          </Box>
        )}

        {/* Manual input */}
        {!found && (
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              fullWidth size="small"
              label="Enter barcode number manually"
              placeholder="e.g. 5449000000996"
              value={manualBarcode}
              onChange={e => setManualBarcode(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleManualLookup(); }}
              type="number"
            />
            <Button variant="outlined" startIcon={<SearchIcon />} onClick={handleManualLookup} disabled={loading || !manualBarcode.trim()}>
              Lookup
            </Button>
          </Box>
        )}

        {/* Product Result */}
        {found && (
          <Card elevation={2} sx={{ borderRadius: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, p: 2 }}>
              {found.imageUrl ? (
                <CardMedia
                  component="img"
                  image={found.imageUrl}
                  alt={found.name}
                  sx={{ width: 100, height: 100, objectFit: 'contain', borderRadius: 1, bgcolor: '#f5f5f5' }}
                />
              ) : (
                <Box sx={{ width: 100, height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography sx={{ fontSize: '3rem' }}>🛒</Typography>
                </Box>
              )}
              <CardContent sx={{ p: 0, flex: 1 }}>
                <TextField
                  fullWidth size="small" label="Product Name"
                  value={found.name}
                  onChange={e => setFound({ ...found, name: e.target.value })}
                  sx={{ mb: 1 }}
                />
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label={found.location} color="primary" size="small" />
                  {found.quantity && <Chip label={found.quantity} variant="outlined" size="small" />}
                  <Chip label={`Barcode: ${found.barcode}`} variant="outlined" size="small" color="default" />
                </Box>
              </CardContent>
            </Box>
          </Card>
        )}

        {found && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button variant="outlined" onClick={() => { setFound(null); setLastScanned(''); startScanner(); }}>
              Scan Another
            </Button>
            <Button variant="contained" color="primary" startIcon={<AddIcon />} onClick={handleAdd} disabled={!found.name.trim()}>
              Add to Inventory
            </Button>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {!found && <Button onClick={onClose}>Cancel</Button>}
      </DialogActions>
    </Dialog>
  );
}

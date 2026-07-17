import React, { useState, useEffect, useRef } from 'react';
import { 
  Modal, Box, Typography, TextField, Button, Grid, 
  Select, MenuItem, FormControl, InputLabel, CircularProgress, 
  Alert, IconButton, Card, CardMedia, useTheme, Tooltip, Autocomplete
} from '@mui/material';
import { 
  Close as CloseIcon, CameraAlt as CameraIcon, 
  QrCodeScanner as ScannerIcon, PhotoCamera as ShotIcon 
} from '@mui/icons-material';
import gitHubClient from '../utils/gitHubClient';
import ScannerModal from './ScannerModal';

export default function ProductFormModal({ open, onClose, product, onSuccess }) {
  const isEdit = !!product;

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const [location, setLocation] = useState('Fridge');
  
  // Dates
  const [addedDate, setAddedDate] = useState(new Date().toISOString().split('T')[0]);
  const [expirationDate, setExpirationDate] = useState('');
  
  // Images
  const [base64Image, setBase64Image] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  
  // Camera state (for taking item photo)
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  
  // Scanner Modal state (for scanning dates)
  const [scannerOpen, setScannerOpen] = useState(false);

  // FoodKeeper suggestions dataset
  const [foodkeeper, setFoodkeeper] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const theme = useTheme();

  // Load foodkeeper data from public/foodkeeper.json on mount
  useEffect(() => {
    fetch('/foodkeeper.json')
      .then(res => res.json())
      .then(data => setFoodkeeper(data))
      .catch(err => console.error('Failed to load foodkeeper database:', err));
  }, []);

  // Reset/Initialize state when modal opens or product changes
  useEffect(() => {
    if (open) {
      if (product) {
        setName(product.name || '');
        setQuantity(String(product.quantity || '1'));
        setUnit(product.unit || 'pcs');
        setLocation(product.location || 'Fridge');
        setAddedDate(product.addedDate ? new Date(product.addedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
        setExpirationDate(product.expirationDate ? new Date(product.expirationDate).toISOString().split('T')[0] : '');
        setBase64Image(null);
        setImagePreview(product.imageUrl || '');
      } else {
        setName('');
        setQuantity('1');
        setUnit('pcs');
        setLocation('Fridge');
        setAddedDate(new Date().toISOString().split('T')[0]);
        setExpirationDate('');
        setBase64Image(null);
        setImagePreview('');
      }
      setError('');
    }
    
    // Cleanup camera when modal closes
    return () => {
      stopCamera();
    };
  }, [open, product]);

  // Autocomplete change: auto fill default location and calculate expiration
  const handleFoodkeeperSelect = (selectedName) => {
    setName(selectedName);
    if (!selectedName || isEdit || expirationDate !== '') return;

    const match = foodkeeper.find(f => f.name.toLowerCase() === selectedName.toLowerCase());
    if (match) {
      if (match.defaultLocation) {
        setLocation(match.defaultLocation);
        
        // Auto-calculate expiration date
        const days = match.defaultLocation === 'Fridge' 
          ? (match.fridge || 7) 
          : (match.defaultLocation === 'Pantry' ? (match.pantry || 7) : (match.freezer || 30));
        
        const added = addedDate ? new Date(addedDate) : new Date();
        const exp = new Date(added.getTime() + days * 24 * 60 * 60 * 1000);
        setExpirationDate(exp.toISOString().split('T')[0]);
      }
    }
  };

  const handleNameBlur = () => {
    if (!name || isEdit || expirationDate !== '') return;
    handleFoodkeeperSelect(name);
  };

  // Convert uploaded file to base64
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBase64Image(reader.result);
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Start Camera for capturing product photo
  const startCamera = async () => {
    try {
      setCameraActive(true);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error('Webcam capture access denied:', err);
      setError('Could not access webcam for product photo.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Snap photo
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const dataUrl = canvas.toDataURL('image/jpeg');
    setBase64Image(dataUrl);
    setImagePreview(dataUrl);
    
    stopCamera();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Product name is required');
      return;
    }
    if (!expirationDate) {
      setError('Expiration date is required');
      return;
    }

    setLoading(true);

    try {
      let uploadResult = null;
      if (base64Image) {
        // Upload new image
        uploadResult = await gitHubClient.uploadImage(base64Image);
        
        // If editing and had a previous image, delete the old one
        if (isEdit && product.imagePath) {
          await gitHubClient.deleteImage(product.imagePath);
        }
      }

      await gitHubClient.updateDb((db) => {
        if (isEdit) {
          const idx = db.products.findIndex(p => p.id === product.id);
          if (idx !== -1) {
            db.products[idx] = {
              ...db.products[idx],
              name: name.trim(),
              quantity: parseFloat(quantity),
              unit,
              location,
              addedDate,
              expirationDate,
              imageUrl: uploadResult ? uploadResult.imageUrl : db.products[idx].imageUrl,
              imagePath: uploadResult ? uploadResult.imagePath : db.products[idx].imagePath
            };
          }
        } else {
          db.products.push({
            id: `prod-${Date.now()}`,
            name: name.trim(),
            quantity: parseFloat(quantity),
            unit,
            location,
            addedDate,
            expirationDate,
            imageUrl: uploadResult ? uploadResult.imageUrl : null,
            imagePath: uploadResult ? uploadResult.imagePath : null,
            status: 'ACTIVE'
          });
        }
        return db;
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Submit product error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to save product details.');
    } finally {
      setLoading(false);
    }
  };

  // Set scanned date from ScannerModal
  const handleDateScanned = (scannedDate) => {
    setExpirationDate(scannedDate.toISOString().split('T')[0]);
  };

  return (
    <>
      <Modal open={open} onClose={onClose} aria-labelledby="product-form-title">
        <Box sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: { xs: '95%', sm: 600 },
          maxHeight: '90vh',
          bgcolor: 'background.paper',
          borderRadius: 4,
          boxShadow: 24,
          overflowY: 'auto',
          outline: 'none'
        }}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography id="product-form-title" variant="h5" sx={{ fontWeight: 'bold' }}>
              {isEdit ? 'Edit Product' : 'Add Product'}
            </Typography>
            <IconButton onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Box>

          {/* Form */}
          <Box component="form" onSubmit={handleSubmit} sx={{ p: 3 }}>
            {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

            <Grid container spacing={3}>
              {/* Product Name (Autocomplete from FoodKeeper) */}
              <Grid item xs={12}>
                <Autocomplete
                  freeSolo
                  options={foodkeeper.map(f => f.name)}
                  value={name}
                  onChange={(event, newValue) => handleFoodkeeperSelect(newValue || '')}
                  onInputChange={(event, newInputValue) => setName(newInputValue)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      required
                      label="Product Name (e.g. Milk)"
                      onBlur={handleNameBlur}
                      helperText="Type to see suggestions. Auto-calculates storage and shelf life."
                    />
                  )}
                />
              </Grid>

              {/* Quantity and Unit */}
              <Grid item xs={6}>
                <TextField
                  required
                  fullWidth
                  type="number"
                  inputProps={{ min: '0.01', step: 'any' }}
                  label="Quantity"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Unit</InputLabel>
                  <Select
                    value={unit}
                    label="Unit"
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    <MenuItem value="pcs">pcs (pieces)</MenuItem>
                    <MenuItem value="pack">pack</MenuItem>
                    <MenuItem value="bottle">bottle</MenuItem>
                    <MenuItem value="can">can</MenuItem>
                    <MenuItem value="g">g (grams)</MenuItem>
                    <MenuItem value="kg">kg (kilograms)</MenuItem>
                    <MenuItem value="ml">ml (milliliters)</MenuItem>
                    <MenuItem value="liter">liter</MenuItem>
                    <MenuItem value="oz">oz (ounces)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Storage Location */}
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Storage Location</InputLabel>
                  <Select
                    value={location}
                    label="Storage Location"
                    onChange={(e) => setLocation(e.target.value)}
                  >
                    <MenuItem value="Fridge">Fridge</MenuItem>
                    <MenuItem value="Pantry">Pantry</MenuItem>
                    <MenuItem value="Freezer">Freezer</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Dates */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="Date Added"
                  InputLabelProps={{ shrink: true }}
                  value={addedDate}
                  onChange={(e) => setAddedDate(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    required
                    fullWidth
                    type="date"
                    label="Expiration Date"
                    InputLabelProps={{ shrink: true }}
                    value={expirationDate}
                    onChange={(e) => setExpirationDate(e.target.value)}
                  />
                  <Tooltip title="Scan Expiration Date using Camera">
                    <IconButton 
                      color="secondary" 
                      onClick={() => setScannerOpen(true)}
                      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
                    >
                      <ScannerIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Grid>

              {/* Product Picture Capture/Upload */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Product Image
                </Typography>

                {cameraActive ? (
                  <Box sx={{ position: 'relative', width: '100%', pt: '75%', bgcolor: '#000000', borderRadius: 2, overflow: 'hidden' }}>
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <Box sx={{ position: 'absolute', bottom: 16, left: 0, width: '100%', display: 'flex', justifyContent: 'center', gap: 2 }}>
                      <Button variant="contained" color="success" onClick={capturePhoto} startIcon={<ShotIcon />}>
                        Snap
                      </Button>
                      <Button variant="contained" color="error" onClick={stopCamera}>
                        Cancel
                      </Button>
                    </Box>
                  </Box>
                ) : (
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={8}>
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <Button
                          variant="outlined"
                          component="label"
                          sx={{ flexGrow: 1 }}
                        >
                          Upload File
                          <input
                            type="file"
                            hidden
                            accept="image/*"
                            onChange={handleFileChange}
                          />
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={startCamera}
                          startIcon={<CameraIcon />}
                        >
                          Camera
                        </Button>
                      </Box>
                      {imagePreview && (
                        <Button 
                          variant="text" 
                          color="error" 
                          onClick={() => {
                            setBase64Image(null);
                            setImagePreview('');
                          }}
                        >
                          Clear Image
                        </Button>
                      )}
                    </Grid>
                    <Grid item xs={4}>
                      {imagePreview ? (
                        <Card variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
                          <CardMedia
                            component="img"
                            height="80"
                            image={imagePreview}
                            alt="Product Image Preview"
                            sx={{ objectFit: 'cover' }}
                          />
                        </Card>
                      ) : (
                        <Box sx={{ 
                          height: 80, 
                          border: '1px dashed', 
                          borderColor: 'divider', 
                          borderRadius: 2, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          color: 'text.secondary',
                          fontSize: '0.75rem'
                        }}>
                          No Image
                        </Box>
                      )}
                    </Grid>
                  </Grid>
                )}
              </Grid>
            </Grid>

            {/* Actions */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4, borderTop: '1px solid', borderColor: 'divider', pt: 3 }}>
              <Button onClick={onClose} variant="outlined" disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={loading || cameraActive}>
                {loading ? <CircularProgress size={24} color="inherit" /> : (isEdit ? 'Save Changes' : 'Add Product')}
              </Button>
            </Box>
          </Box>
        </Box>
      </Modal>

      {/* Embedded OCR Expiration Date Scanner */}
      <ScannerModal 
        open={scannerOpen} 
        onClose={() => setScannerOpen(false)} 
        onDateScanned={handleDateScanned} 
      />
    </>
  );
}

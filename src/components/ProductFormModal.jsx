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
import dbClient from '../utils/dbClient';
import ScannerModal from './ScannerModal';

export default function ProductFormModal({ open, onClose, product, settings, onSuccess }) {
  const isEdit = !!product;

  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const locationsList = settings.locations || ['Fridge', 'Freezer'];
  const [location, setLocation] = useState(locationsList[0] || 'Fridge');
  
  // Dates
  const [addedDate, setAddedDate] = useState(new Date().toISOString().split('T')[0]);
  const [expirationDate, setExpirationDate] = useState('');
  
  // Images
  const [imagePreview, setImagePreview] = useState('');
  
  // Scanner Modal state (for scanning dates)
  const [scannerOpen, setScannerOpen] = useState(false);

  // FoodKeeper suggestions dataset
  const [foodkeeper, setFoodkeeper] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const theme = useTheme();

  // Load foodkeeper data from public/foodkeeper.json on mount
  useEffect(() => {
    fetch('foodkeeper.json')
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
        setImagePreview(product.imageUrl || '');
      } else {
        setName('');
        setQuantity('1');
        setUnit('pcs');
        setLocation(locationsList[0] || 'Fridge');
        setAddedDate(new Date().toISOString().split('T')[0]);
        setExpirationDate('');
        setImagePreview('');
      }
      setError('');
    }
  }, [open, product, settings]);

  const fetchWikipediaImage = async (query) => {
    try {
      // Use just the English part if it exists (e.g. "Ouă / Eggs" -> "Eggs")
      let cleanQuery = query;
      if (query.includes('/')) {
        cleanQuery = query.split('/')[1].trim();
      }
      const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(cleanQuery)}&prop=pageimages&format=json&pithumbsize=400&origin=*`;
      const res = await fetch(url);
      const data = await res.json();
      const pages = data.query.pages;
      const pageId = Object.keys(pages)[0];
      if (pageId !== '-1' && pages[pageId].thumbnail) {
        setImagePreview(pages[pageId].thumbnail.source);
      }
    } catch (e) {
      console.error('Failed to fetch Wikipedia image:', e);
    }
  };

  // Autocomplete change: auto fill default location and calculate expiration
  const handleFoodkeeperSelect = (selectedName) => {
    setName(selectedName);
    if (!selectedName || isEdit || expirationDate !== '') return;

    const match = foodkeeper.find(f => {
      const lowerF = f.name.toLowerCase();
      const lowerS = selectedName.toLowerCase().trim();
      return lowerF === lowerS || lowerF.split('/').some(part => part.trim() === lowerS);
    });
    if (match) {
      // Auto-fetch image if found
      fetchWikipediaImage(match.name);

      if (match.defaultLocation) {
        // Only set location if it is in the household's custom locations list
        if (locationsList.includes(match.defaultLocation)) {
          setLocation(match.defaultLocation);
        }
        
        // Auto-calculate expiration date
        const days = match.defaultLocation === 'Fridge' 
          ? (match.fridge || 7) 
          : (match.defaultLocation === 'Pantry' ? (match.pantry || 7) : (match.freezer || 30));
        
        const added = addedDate ? new Date(addedDate) : new Date();
        const exp = new Date(added.getTime() + days * 24 * 60 * 60 * 1000);
        setExpirationDate(exp.toISOString().split('T')[0]);
      }
    } else if (selectedName) {
      fetchWikipediaImage(selectedName);
    }
  };

  const handleNameBlur = () => {
    if (!name || isEdit) return;
    handleFoodkeeperSelect(name);
  };



  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Product name is required');
      return;
    }

    setLoading(true);

    // Solve race condition: calculate expiration date synchronously on submit if blank
    let finalExpirationDate = expirationDate;
    if (!finalExpirationDate) {
      const match = foodkeeper.find(f => {
        const lowerF = f.name.toLowerCase();
        const lowerS = name.toLowerCase().trim();
        return lowerF === lowerS || lowerF.split('/').some(part => part.trim() === lowerS);
      });
      if (match && match.defaultLocation) {
        const days = match.defaultLocation === 'Fridge' 
          ? (match.fridge || 7) 
          : (match.defaultLocation === 'Pantry' ? (match.pantry || 7) : (match.freezer || 30));
        const added = addedDate ? new Date(addedDate) : new Date();
        const exp = new Date(added.getTime() + days * 24 * 60 * 60 * 1000);
        finalExpirationDate = exp.toISOString().split('T')[0];
      }
    }

    try {
      await dbClient.updateDb((db) => {
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
              expirationDate: finalExpirationDate,
              imageUrl: imagePreview || db.products[idx].imageUrl,
              imagePath: null
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
            expirationDate: finalExpirationDate,
            imageUrl: imagePreview || null,
            imagePath: null,
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
                    {locationsList.map((loc) => (
                      <MenuItem key={loc} value={loc}>{loc}</MenuItem>
                    ))}
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
                    fullWidth
                    type="date"
                    label="Expiration Date (Optional)"
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

              {/* Product Picture Auto-generated */}
              <Grid item xs={12}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Product Image
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  {imagePreview ? (
                    <Card variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden', width: 100, height: 100 }}>
                      <CardMedia
                        component="img"
                        height="100"
                        image={imagePreview}
                        alt="Product Image"
                        sx={{ objectFit: 'cover' }}
                      />
                    </Card>
                  ) : (
                    <Box sx={{ 
                      width: 100, 
                      height: 100, 
                      border: '1px dashed', 
                      borderColor: 'divider', 
                      borderRadius: 2, 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: 'text.secondary',
                      fontSize: '0.75rem',
                      textAlign: 'center',
                      p: 1
                    }}>
                      Type a name to fetch image
                    </Box>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    Product image is automatically fetched from Wikipedia based on the food name.
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {/* Actions */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4, borderTop: '1px solid', borderColor: 'divider', pt: 3 }}>
              <Button onClick={onClose} variant="outlined" disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={loading}>
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

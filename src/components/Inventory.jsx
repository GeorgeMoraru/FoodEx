import React, { useState, useMemo } from 'react';
import { 
  Box, Typography, Grid, Card, CardContent, IconButton, 
  Button, TextField, InputAdornment, Select, MenuItem, 
  FormControl, InputLabel, Tooltip, Chip, Paper, useTheme 
} from '@mui/material';
import { 
  Search as SearchIcon, CheckCircle as CheckIcon,
  DeleteForever as DeleteIcon, Edit as EditIcon,
  Cancel as CancelIcon, Kitchen as FridgeIcon, 
  LocalMall as PantryIcon, AcUnit as FreezerIcon, 
  Info as InfoIcon 
} from '@mui/icons-material';
import dbClient from '../utils/dbClient';

export default function Inventory({ products, settings, onEditProduct, onAddProductClick, onRefresh }) {
  // Search & Filter State
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  const theme = useTheme();

  const handleUpdateStatus = async (productId, status) => {
    try {
      await dbClient.updateDb((db) => {
        const prod = db.products.find(p => p.id === productId);
        if (prod) {
          prod.status = status;
        }
        return db;
      });
      onRefresh();
    } catch (err) {
      console.error('Update status error:', err);
      alert('Failed to update product status');
    }
  };

  const handleDeleteProduct = async (productId) => {
    const prodToDelete = products.find(p => p.id === productId);
    if (!prodToDelete) return;

    if (!window.confirm('Are you sure you want to delete this product? This will also delete any uploaded image.')) {
      return;
    }
    
    try {
      if (prodToDelete.imagePath) {
        // External URLs or deleted logic
      }

      // Remove from database
      await dbClient.updateDb((db) => {
        db.products = db.products.filter(p => p.id !== productId);
        return db;
      });

      onRefresh();
    } catch (err) {
      console.error('Delete product error:', err);
      alert('Failed to delete product');
    }
  };

  // Helper to determine food placeholder emoji based on name
  const getFoodEmoji = (name) => {
    const n = name.toLowerCase();
    if (n.includes('milk') || n.includes('cream')) return '🥛';
    if (n.includes('egg')) return '🥚';
    if (n.includes('cheese') || n.includes('yogurt') || n.includes('butter')) return '🧀';
    if (n.includes('chicken') || n.includes('turkey') || n.includes('poultry')) return '🍗';
    if (n.includes('beef') || n.includes('steak') || n.includes('pork') || n.includes('meat')) return '🥩';
    if (n.includes('fish') || n.includes('salmon') || n.includes('tuna') || n.includes('seafood') || n.includes('shrimp')) return '🐟';
    if (n.includes('apple') || n.includes('fruit') || n.includes('banana') || n.includes('strawberry') || n.includes('berry') || n.includes('grapes') || n.includes('orange') || n.includes('lemon')) return '🍎';
    if (n.includes('spinach') || n.includes('salad') || n.includes('lettuce') || n.includes('broccoli') || n.includes('cabbage') || n.includes('carrot') || n.includes('vegetable') || n.includes('pepper') || n.includes('onion') || n.includes('garlic')) return '🥦';
    if (n.includes('bread') || n.includes('loaf') || n.includes('toast') || n.includes('dough') || n.includes('tortilla')) return '🍞';
    if (n.includes('rice') || n.includes('pasta') || n.includes('grain') || n.includes('oats')) return '🍚';
    if (n.includes('beer') || n.includes('wine') || n.includes('soda') || n.includes('juice') || n.includes('coffee') || n.includes('tea')) return '🍹';
    return '🥗';
  };

  // Helper to get location icon
  const getLocationIcon = (loc) => {
    const l = loc ? loc.toLowerCase() : '';
    if (l.includes('fridge')) return <FridgeIcon fontSize="small" />;
    if (l.includes('freezer')) return <FreezerIcon fontSize="small" />;
    return <PantryIcon fontSize="small" />;
  };

  // Expiration countdown calculations
  const getExpirationBadgeInfo = (dateString) => {
    if (!dateString) {
      return {
        text: 'Non-perishable',
        color: theme.palette.grey[600],
        textColor: '#ffffff'
      };
    }
    const expDate = new Date(dateString);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const expDateStart = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
    
    const timeDiff = expDateStart.getTime() - todayStart.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (daysDiff < 0) {
      const positiveDays = Math.abs(daysDiff);
      return {
        text: `Expired ${positiveDays} day${positiveDays > 1 ? 's' : ''} ago`,
        color: theme.palette.error.main,
        textColor: '#ffffff'
      };
    } else if (daysDiff === 0) {
      return {
        text: 'Expires today',
        color: '#d32f2f',
        textColor: '#ffffff'
      };
    } else if (daysDiff === 1) {
      return {
        text: 'Expires tomorrow',
        color: '#ef6c00',
        textColor: '#ffffff'
      };
    } else if (daysDiff <= 3) {
      return {
        text: `Expires in ${daysDiff} days`,
        color: '#fbc02d',
        textColor: '#000000'
      };
    } else {
      return {
        text: `Expires in ${daysDiff} days`,
        color: theme.palette.success.main,
        textColor: '#ffffff'
      };
    }
  };

  // Filter and Sort products client-side
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Filter by status
    if (statusFilter !== 'ALL') {
      result = result.filter(p => {
        const status = p.status || 'ACTIVE';
        return status === statusFilter;
      });
    }

    // Filter by location
    if (locationFilter !== 'All') {
      result = result.filter(p => p.location === locationFilter);
    }

    // Filter by search term
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(query));
    }

    // Sort by expiration date (earliest first), put non-perishables at the end
    result.sort((a, b) => {
      if (!a.expirationDate && !b.expirationDate) return 0;
      if (!a.expirationDate) return 1;
      if (!b.expirationDate) return -1;
      return new Date(a.expirationDate) - new Date(b.expirationDate);
    });

    return result;
  }, [products, statusFilter, locationFilter, search]);

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Inventory</Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your food catalog
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          onClick={onAddProductClick}
          sx={{ py: 1, px: 3 }}
        >
          Add New Product
        </Button>
      </Box>

      {/* Search and Filters bar */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            placeholder="Search food name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
          />
        </Grid>

        <Grid item xs={6} sm={4}>
          <FormControl fullWidth>
            <InputLabel>Location</InputLabel>
            <Select
              value={locationFilter}
              label="Location"
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <MenuItem value="All">All Locations</MenuItem>
              {(settings.locations || ['Fridge', 'Freezer']).map(loc => (
                <MenuItem key={loc} value={loc}>{loc}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={6} sm={4}>
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="ACTIVE">Active Inventory</MenuItem>
              <MenuItem value="CONSUMED">Consumed History</MenuItem>
              <MenuItem value="WASTED">Wasted History</MenuItem>
              <MenuItem value="ALL">All Items</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      {filteredProducts.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 4 }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No products found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Try adjusting your search filters or add a new food item.
          </Typography>
          <Button variant="outlined" onClick={onAddProductClick}>Add Product</Button>
        </Paper>
      ) : (
        /* Pinterest / Plex Grid View */
        <Grid container spacing={3}>
          {filteredProducts.map((p) => {
            const isActive = (p.status || 'ACTIVE') === 'ACTIVE';
            const badge = getExpirationBadgeInfo(p.expirationDate);
            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={p.id}>
                <Card 
                  sx={{ 
                    position: 'relative',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    },
                    '&:hover .quick-actions-overlay': {
                      opacity: 1,
                      transform: 'translateY(0)'
                    }
                  }}
                >
                  {/* Countdown Badge overlay */}
                  {isActive && (
                    <Box 
                      sx={{ 
                        position: 'absolute', 
                        top: 12, 
                        left: 12, 
                        bgcolor: badge.color, 
                        color: badge.textColor,
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 1,
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        zIndex: 10,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}
                    >
                      {badge.text}
                    </Box>
                  )}

                  {/* Location Badge overlay */}
                  <Chip 
                    icon={getLocationIcon(p.location)}
                    label={p.location} 
                    size="small"
                    sx={{ 
                      position: 'absolute', 
                      top: 12, 
                      right: 12, 
                      zIndex: 10,
                      bgcolor: 'rgba(255,255,255,0.85)',
                      color: '#000000',
                      backdropFilter: 'blur(4px)',
                      fontWeight: '500',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                    }} 
                  />

                  {/* Image Container */}
                  <Box sx={{ position: 'relative', width: '100%', pt: '75%', bgcolor: theme.palette.mode === 'light' ? '#eaefe8' : '#252924', overflow: 'hidden' }}>
                    {p.imageUrl ? (
                      <img 
                        src={p.imageUrl} 
                        alt={p.name} 
                        style={{ 
                          position: 'absolute', 
                          top: 0, 
                          left: 0, 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover' 
                        }}
                      />
                    ) : (
                      <Box 
                        sx={{ 
                          position: 'absolute', 
                          top: 0, 
                          left: 0, 
                          width: '100%', 
                          height: '100%', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: '4.5rem'
                        }}
                      >
                        {getFoodEmoji(p.name)}
                      </Box>
                    )}

                    {/* Quick actions overlay - Visible on Hover */}
                    <Box 
                      className="quick-actions-overlay"
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        width: '100%',
                        bgcolor: 'rgba(0,0,0,0.75)',
                        backdropFilter: 'blur(3px)',
                        display: 'flex',
                        justifyContent: 'space-around',
                        py: 1,
                        opacity: 0,
                        transform: 'translateY(100%)',
                        transition: 'opacity 0.25s ease, transform 0.25s ease',
                        zIndex: 20
                      }}
                    >
                      {isActive && (
                        <>
                          <Tooltip title="Consume (Mark as Eaten)">
                            <IconButton 
                              onClick={() => handleUpdateStatus(p.id, 'CONSUMED')}
                              sx={{ color: '#2ecc71', '&:hover': { bgcolor: 'rgba(46,204,113,0.2)' } }}
                            >
                              <CheckIcon />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Waste (Mark as Discarded)">
                            <IconButton 
                              onClick={() => handleUpdateStatus(p.id, 'WASTED')}
                              sx={{ color: '#e67e22', '&:hover': { bgcolor: 'rgba(230,126,34,0.2)' } }}
                            >
                              <CancelIcon />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}

                      {!isActive && (
                        <Tooltip title="Restore to Active">
                          <Button 
                            size="small"
                            variant="outlined"
                            onClick={() => handleUpdateStatus(p.id, 'ACTIVE')}
                            sx={{ color: '#ffffff', borderColor: '#ffffff', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                          >
                            Restore
                          </Button>
                        </Tooltip>
                      )}

                      <Tooltip title="Edit Product">
                        <IconButton 
                          onClick={() => onEditProduct(p)}
                          sx={{ color: '#3498db', '&:hover': { bgcolor: 'rgba(52,152,219,0.2)' } }}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>

                      <Tooltip title="Delete Product Permanently">
                        <IconButton 
                          onClick={() => handleDeleteProduct(p.id)}
                          sx={{ color: '#e74c3c', '&:hover': { bgcolor: 'rgba(231,76,60,0.2)' } }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  <CardContent sx={{ flexGrow: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="h6" component="h3" noWrap sx={{ fontWeight: 'bold', fontSize: '1rem' }} title={p.name}>
                      {p.name}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary">
                      Quantity: <strong>{p.quantity} {p.unit}</strong>
                    </Typography>

                    <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <InfoIcon fontSize="inherit" />
                      {p.expirationDate ? `Expires: ${new Date(p.expirationDate).toLocaleDateString()}` : 'Does not expire'}
                    </Typography>

                    {!isActive && (
                      <Chip 
                        label={p.status} 
                        size="small" 
                        color={p.status === 'CONSUMED' ? 'success' : 'default'} 
                        sx={{ mt: 1, fontWeight: 'bold', height: 20 }}
                      />
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}

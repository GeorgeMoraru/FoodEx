import React, { useState, useMemo } from 'react';
import { 
  Box, Typography, Grid, Card, CardContent, IconButton, 
  Button, TextField, InputAdornment, Tooltip, Chip, Paper, useTheme,
  Tabs, Tab, CardActions
} from '@mui/material';
import { 
  Search as SearchIcon, CheckCircle as CheckIcon,
  DeleteForever as DeleteIcon, Edit as EditIcon,
  Cancel as CancelIcon, Kitchen as FridgeIcon, 
  LocalMall as PantryIcon, AcUnit as FreezerIcon, 
  Info as InfoIcon, Restore as RestoreIcon
} from '@mui/icons-material';
import dbClient from '../utils/dbClient';

export default function Inventory({ products, settings, onEditProduct, onAddProductClick, onRefresh }) {
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('All');
  
  // Tab State: 0: Active Inventory, 1: History Log
  const [tabValue, setTabValue] = useState(0);

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

    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }
    
    try {
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

  const locationsList = settings.locations || ['Fridge', 'Freezer'];

  // Filter and Sort products client-side
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Filter by tab status (0: Active Inventory, 1: History Log)
    if (tabValue === 0) {
      result = result.filter(p => (p.status || 'ACTIVE') === 'ACTIVE');
    } else {
      result = result.filter(p => (p.status || 'ACTIVE') !== 'ACTIVE');
    }

    // Filter by location
    if (locationFilter !== 'All') {
      result = result.filter(p => p.location === locationFilter);
    }

    // Filter by search term
    if (search.trim()) {
      const queryStr = search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(queryStr));
    }

    // Sort by expiration date (earliest first), put non-perishables at the end
    result.sort((a, b) => {
      if (!a.expirationDate && !b.expirationDate) return 0;
      if (!a.expirationDate) return 1;
      if (!b.expirationDate) return -1;
      return new Date(a.expirationDate) - new Date(b.expirationDate);
    });

    return result;
  }, [products, tabValue, locationFilter, search]);

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Inventory</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your household food catalog
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          onClick={onAddProductClick}
          sx={{ py: 1, px: 3, borderRadius: 2 }}
        >
          Add New Product
        </Button>
      </Box>

      {/* Tabs segment: Active vs History */}
      <Tabs 
        value={tabValue} 
        onChange={(e, nv) => setTabValue(nv)} 
        sx={{ mb: 3, borderBottom: '1px solid', borderColor: 'divider' }}
        textColor="primary"
        indicatorColor="primary"
      >
        <Tab label="Active Inventory" sx={{ fontWeight: 'bold' }} />
        <Tab label="History / Logs" sx={{ fontWeight: 'bold' }} />
      </Tabs>

      {/* Search & Location Chip Filters */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
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

        {/* Location Chips Filter */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 1, fontWeight: 'bold' }}>
            Location:
          </Typography>
          <Chip
            label="All Locations"
            clickable
            color={locationFilter === 'All' ? 'primary' : 'default'}
            variant={locationFilter === 'All' ? 'filled' : 'outlined'}
            onClick={() => setLocationFilter('All')}
            sx={{ fontWeight: '500' }}
          />
          {locationsList.map((loc) => (
            <Chip
              key={loc}
              icon={getLocationIcon(loc)}
              label={loc}
              clickable
              color={locationFilter === loc ? 'primary' : 'default'}
              variant={locationFilter === loc ? 'filled' : 'outlined'}
              onClick={() => setLocationFilter(loc)}
              sx={{ fontWeight: '500' }}
            />
          ))}
        </Box>
      </Box>

      {filteredProducts.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', bgcolor: 'background.paper', borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No food items found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {tabValue === 0 
              ? "Your active inventory is empty. Add a new product to get started!"
              : "No consumption or waste log entries match your filters."}
          </Typography>
          {tabValue === 0 && (
            <Button variant="outlined" onClick={onAddProductClick}>Add Product</Button>
          )}
        </Paper>
      ) : (
        /* Native Grid Cards with direct action buttons */
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
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: 'none',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 20px rgba(0,0,0,0.12)',
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
                        px: 1.2,
                        py: 0.4,
                        borderRadius: 1.5,
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        zIndex: 10,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
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
                      bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(30,30,30,0.9)' : 'rgba(255,255,255,0.9)',
                      color: 'text.primary',
                      backdropFilter: 'blur(4px)',
                      fontWeight: 'bold',
                      fontSize: '0.75rem',
                      border: '1px solid',
                      borderColor: 'divider',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
                    }} 
                  />

                  {/* Image Container */}
                  <Box sx={{ position: 'relative', width: '100%', pt: '70%', bgcolor: theme.palette.mode === 'light' ? '#eaefe8' : '#252924', overflow: 'hidden' }}>
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
                  </Box>

                  {/* Content details */}
                  <CardContent sx={{ flexGrow: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="h6" component="h3" noWrap sx={{ fontWeight: 'bold', fontSize: '0.95rem' }} title={p.name}>
                      {p.name}
                    </Typography>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                      Quantity: <strong>{p.quantity} {p.unit}</strong>
                    </Typography>

                    <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto', display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.75rem' }}>
                      <InfoIcon fontSize="inherit" />
                      {p.expirationDate ? `Expires: ${new Date(p.expirationDate).toLocaleDateString()}` : 'Does not expire'}
                    </Typography>

                    {!isActive && (
                      <Chip 
                        label={p.status} 
                        size="small" 
                        color={p.status === 'CONSUMED' ? 'success' : 'warning'} 
                        sx={{ mt: 1, fontWeight: 'bold', height: 22, fontSize: '0.7rem' }}
                      />
                    )}
                  </CardContent>

                  {/* Directly accessible action buttons at bottom of card */}
                  <CardActions sx={{ justifyContent: 'space-between', borderTop: '1px solid', borderColor: 'divider', px: 1, py: 0.5, bgcolor: 'action.hover' }}>
                    {isActive ? (
                      <>
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Consume (Mark Eaten)">
                            <IconButton 
                              size="small"
                              onClick={() => handleUpdateStatus(p.id, 'CONSUMED')}
                              sx={{ color: 'success.main', '&:hover': { bgcolor: 'rgba(46,204,113,0.1)' } }}
                            >
                              <CheckIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Waste (Mark Discarded)">
                            <IconButton 
                              size="small"
                              onClick={() => handleUpdateStatus(p.id, 'WASTED')}
                              sx={{ color: 'warning.main', '&:hover': { bgcolor: 'rgba(230,126,34,0.1)' } }}
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                        
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <Tooltip title="Edit Product">
                            <IconButton 
                              size="small"
                              onClick={() => onEditProduct(p)}
                              sx={{ color: 'info.main', '&:hover': { bgcolor: 'rgba(52,152,219,0.1)' } }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          <Tooltip title="Delete Permanently">
                            <IconButton 
                              size="small"
                              onClick={() => handleDeleteProduct(p.id)}
                              sx={{ color: 'error.main', '&:hover': { bgcolor: 'rgba(231,76,60,0.1)' } }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </>
                    ) : (
                      <>
                        <Tooltip title="Restore to Active Inventory">
                          <Button 
                            size="small"
                            variant="outlined"
                            startIcon={<RestoreIcon />}
                            onClick={() => handleUpdateStatus(p.id, 'ACTIVE')}
                            sx={{ fontSize: '0.75rem', py: 0.2, px: 1 }}
                          >
                            Restore
                          </Button>
                        </Tooltip>

                        <Tooltip title="Delete Permanently">
                          <IconButton 
                            size="small"
                            onClick={() => handleDeleteProduct(p.id)}
                            sx={{ color: 'error.main', '&:hover': { bgcolor: 'rgba(231,76,60,0.1)' } }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}

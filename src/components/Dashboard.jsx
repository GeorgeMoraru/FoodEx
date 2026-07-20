import React, { useMemo, useState } from 'react';
import { 
  Box, Grid, Paper, Typography, Card, CardContent, 
  Button, useTheme, Collapse, List, ListItem, 
  Divider, IconButton, Chip, Tooltip
} from '@mui/material';
import { 
  Add as AddIcon, Warning as WarningIcon, 
  Cancel as CancelIcon, Kitchen as KitchenIcon,
  CheckCircle as CheckIcon, Edit as EditIcon,
  DeleteForever as DeleteIcon
} from '@mui/icons-material';
import dbClient from '../utils/dbClient';

export default function Dashboard({ products, settings, onAddProductClick, onEditProduct, onRefresh }) {
  const [expandedCard, setExpandedCard] = useState(null); // 'active', 'expiring', 'expired', or null
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

  const stats = useMemo(() => {
    const active = products.filter(p => p.status === 'ACTIVE' || !p.status);
    const consumed = products.filter(p => p.status === 'CONSUMED');
    const wasted = products.filter(p => p.status === 'WASTED');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysBefore = parseInt(settings.notificationDaysBefore) || 3;
    const warningLimit = new Date(todayStart.getTime() + daysBefore * 24 * 60 * 60 * 1000);

    let expiredCount = 0;
    let expiringSoonCount = 0;

    const defaultLocations = settings.locations || ['Fridge', 'Freezer'];
    const locationCounts = {};
    defaultLocations.forEach(loc => {
      locationCounts[loc] = 0;
    });
    
    active.forEach(p => {
      if (p.expirationDate) {
        const expDate = new Date(p.expirationDate);
        const expDateStart = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
        
        if (expDateStart < todayStart) {
          expiredCount++;
        } else if (expDateStart <= warningLimit) {
          expiringSoonCount++;
        }
      }

      const defaultLoc = defaultLocations[0] || 'Fridge';
      const loc = p.location || defaultLoc;
      if (locationCounts[loc] !== undefined) {
        locationCounts[loc]++;
      } else {
        locationCounts[loc] = 1;
      }
    });

    const locationData = Object.keys(locationCounts).map(name => ({
      name,
      value: locationCounts[name]
    })).filter(item => item.value > 0);

    const wastedConsumedData = [
      { name: 'Consumed', value: consumed.length, color: theme.palette.success.main },
      { name: 'Wasted', value: wasted.length, color: theme.palette.error.main }
    ];

    // Prepare Upcoming Expirations (Next 7 days)
    const upcomingMap = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(todayStart.getTime() + i * 24 * 60 * 60 * 1000);
      const key = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      upcomingMap[key] = { dateStr: key, count: 0, dateObj: d };
    }

    active.forEach(p => {
      if (!p.expirationDate) return;
      const expDate = new Date(p.expirationDate);
      const expDateStart = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
      
      for (const key in upcomingMap) {
        const itemDate = upcomingMap[key].dateObj;
        if (itemDate.getTime() === expDateStart.getTime()) {
          upcomingMap[key].count++;
        }
      }
    });

    const upcomingExpirations = Object.values(upcomingMap).map(item => ({
      name: item.dateStr,
      items: item.count
    }));

    // Sort lists to ensure Expiring Soonest is always first
    const sortedActive = [...active].sort((a, b) => {
      if (!a.expirationDate && !b.expirationDate) return 0;
      if (!a.expirationDate) return 1;
      if (!b.expirationDate) return -1;
      return new Date(a.expirationDate) - new Date(b.expirationDate);
    });

    const sortedExpiringSoon = [...active]
      .filter(p => {
        if (!p.expirationDate) return false;
        const expDate = new Date(p.expirationDate);
        const expDateStart = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
        return expDateStart >= todayStart && expDateStart <= warningLimit;
      })
      .sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));

    const sortedExpired = [...active]
      .filter(p => {
        if (!p.expirationDate) return false;
        const expDate = new Date(p.expirationDate);
        const expDateStart = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
        return expDateStart < todayStart;
      })
      .sort((a, b) => new Date(a.expirationDate) - new Date(b.expirationDate));

    return {
      totalActive: active.length,
      expired: expiredCount,
      expiringSoon: expiringSoonCount,
      locationData,
      wastedConsumedData,
      upcomingExpirations,
      sortedActive,
      sortedExpiringSoon,
      sortedExpired
    };
  }, [products, settings.notificationDaysBefore, theme]);

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

  const getExpirationBadgeInfo = (dateString) => {
    if (!dateString) {
      return { text: 'Non-perishable', color: theme.palette.grey[600] };
    }
    const expDate = new Date(dateString);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const expDateStart = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
    
    const timeDiff = expDateStart.getTime() - todayStart.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

    if (daysDiff < 0) {
      return { text: `Expired ${Math.abs(daysDiff)} day(s) ago`, color: theme.palette.error.main };
    } else if (daysDiff === 0) {
      return { text: 'Expires today', color: '#d32f2f' };
    } else if (daysDiff === 1) {
      return { text: 'Expires tomorrow', color: '#ef6c00' };
    } else if (daysDiff <= 3) {
      return { text: `Expires in ${daysDiff} days`, color: '#fbc02d' };
    } else {
      return { text: `Expires in ${daysDiff} days`, color: theme.palette.success.main };
    }
  };

  const PIE_COLORS = [theme.palette.primary.main, theme.palette.secondary.main, '#e67e22'];

  const renderExpandedList = (items) => {
    if (items.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
          No items in this section.
        </Typography>
      );
    }

    return (
      <List sx={{ width: '100%', maxHeight: 350, overflowY: 'auto', p: 0 }}>
        {items.map((p) => {
          const badge = getExpirationBadgeInfo(p.expirationDate);
          return (
            <ListItem 
              key={p.id} 
              divider
              sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'stretch', 
                py: 1.5, 
                px: 2,
                '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              {/* Product Info Row */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography sx={{ fontSize: '1.5rem' }}>{getFoodEmoji(p.name)}</Typography>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="subtitle2" noWrap sx={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {p.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {p.quantity} {p.unit} • {p.location}
                  </Typography>
                </Box>
                <Chip 
                  label={badge.text} 
                  size="small"
                  sx={{ 
                    bgcolor: badge.color, 
                    color: '#ffffff', 
                    fontSize: '0.65rem',
                    fontWeight: 'bold',
                    height: 20
                  }} 
                />
              </Box>

              {/* Actions & Dates Row */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {p.expirationDate ? `Exp: ${new Date(p.expirationDate).toLocaleDateString()}` : 'No Expiration'}
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Tooltip title="Consume">
                    <IconButton 
                      size="small" 
                      onClick={() => handleUpdateStatus(p.id, 'CONSUMED')} 
                      sx={{ color: 'success.main', p: 0.5 }}
                    >
                      <CheckIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Waste">
                    <IconButton 
                      size="small" 
                      onClick={() => handleUpdateStatus(p.id, 'WASTED')} 
                      sx={{ color: 'warning.main', p: 0.5 }}
                    >
                      <CancelIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton 
                      size="small" 
                      onClick={() => onEditProduct(p)} 
                      sx={{ color: 'info.main', p: 0.5 }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton 
                      size="small" 
                      onClick={() => handleDeleteProduct(p.id)} 
                      sx={{ color: 'error.main', p: 0.5 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            </ListItem>
          );
        })}
      </List>
    );
  };

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Dashboard</Typography>
          <Typography variant="body1" color="text.secondary">
            Overview and management of your food inventory
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={onAddProductClick}
          sx={{ boxShadow: 2 }}
        >
          Add Product
        </Button>
      </Box>

      {/* Summary Cards with Inline Expansions */}
      <Grid container spacing={3} sx={{ mb: 4 }} alignItems="flex-start">
        {/* Card 1: Expiring Soon */}
        <Grid item xs={12} sm={4}>
          <Card 
            sx={{ 
              bgcolor: 'background.paper', 
              borderLeft: '6px solid', 
              borderColor: 'warning.main',
              height: 'auto'
            }}
          >
            <CardContent 
              onClick={() => setExpandedCard(expandedCard === 'expiring' ? null : 'expiring')}
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none',
                '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 'bold' }}>Expiring Soon</Typography>
                <Typography variant="h3" sx={{ fontWeight: 'bold', mt: 1, color: stats.expiringSoon > 0 ? 'warning.main' : 'inherit' }}>
                  {stats.expiringSoon}
                </Typography>
              </Box>
              <WarningIcon color="warning" sx={{ fontSize: 40, opacity: 0.8 }} />
            </CardContent>

            <Collapse in={expandedCard === 'expiring'}>
              <Divider />
              {renderExpandedList(stats.sortedExpiringSoon)}
            </Collapse>
          </Card>
        </Grid>

        {/* Card 2: Active Items */}
        <Grid item xs={12} sm={4}>
          <Card 
            sx={{ 
              bgcolor: 'background.paper', 
              borderLeft: '6px solid', 
              borderColor: 'primary.main',
              height: 'auto'
            }}
          >
            <CardContent 
              onClick={() => setExpandedCard(expandedCard === 'active' ? null : 'active')}
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none',
                '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 'bold' }}>Active Items</Typography>
                <Typography variant="h3" sx={{ fontWeight: 'bold', mt: 1 }}>{stats.totalActive}</Typography>
              </Box>
              <KitchenIcon color="primary" sx={{ fontSize: 40, opacity: 0.8 }} />
            </CardContent>
            
            <Collapse in={expandedCard === 'active'}>
              <Divider />
              {renderExpandedList(stats.sortedActive)}
            </Collapse>
          </Card>
        </Grid>

        {/* Card 3: Expired Items */}
        <Grid item xs={12} sm={4}>
          <Card 
            sx={{ 
              bgcolor: 'background.paper', 
              borderLeft: '6px solid', 
              borderColor: 'error.main',
              height: 'auto'
            }}
          >
            <CardContent 
              onClick={() => setExpandedCard(expandedCard === 'expired' ? null : 'expired')}
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                cursor: 'pointer',
                userSelect: 'none',
                '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              <Box>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 'bold' }}>Expired Items</Typography>
                <Typography variant="h3" sx={{ fontWeight: 'bold', mt: 1, color: stats.expired > 0 ? 'error.main' : 'inherit' }}>
                  {stats.expired}
                </Typography>
              </Box>
              <CancelIcon color="error" sx={{ fontSize: 40, opacity: 0.8 }} />
            </CardContent>

            <Collapse in={expandedCard === 'expired'}>
              <Divider />
              {renderExpandedList(stats.sortedExpired)}
            </Collapse>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

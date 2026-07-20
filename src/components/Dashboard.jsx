import { 
  Add as AddIcon, Warning as WarningIcon, 
  Cancel as CancelIcon, Kitchen as KitchenIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { 
  Box, Grid, Paper, Typography, Card, CardContent, 
  Button, useTheme, Collapse, List, ListItem, 
  ListItemText, ListItemAvatar, Avatar, Chip, IconButton
} from '@mui/material';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';

import React, { useMemo, useState } from 'react';

export default function Dashboard({ products, settings, onAddProductClick }) {
  const [expandedSection, setExpandedSection] = useState(null); // 'active', 'expiring', 'expired', or null
  const theme = useTheme();

  const stats = useMemo(() => {
    const active = products.filter(p => p.status === 'ACTIVE' || !p.status);
    const consumed = products.filter(p => p.status === 'CONSUMED');
    const wasted = products.filter(p => p.status === 'WASTED');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const threeDaysFromNow = new Date(todayStart.getTime() + 3 * 24 * 60 * 60 * 1000);

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
        } else if (expDateStart <= threeDaysFromNow) {
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

    // Sort lists to ensure Expiring Soon is always first
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
        return expDateStart >= todayStart && expDateStart <= threeDaysFromNow;
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
  }, [products, theme]);

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

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Dashboard</Typography>
          <Typography variant="body1" color="text.secondary">
            Overview of your food inventory
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

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card 
            onClick={() => setExpandedSection(expandedSection === 'active' ? null : 'active')}
            sx={{ 
              bgcolor: 'background.paper', 
              borderLeft: '6px solid', 
              borderColor: 'primary.main',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }
            }}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Active Items</Typography>
                <Typography variant="h3" sx={{ fontWeight: 'bold', mt: 1 }}>{stats.totalActive}</Typography>
              </Box>
              <KitchenIcon color="primary" sx={{ fontSize: 40, opacity: 0.8 }} />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card 
            onClick={() => setExpandedSection(expandedSection === 'expiring' ? null : 'expiring')}
            sx={{ 
              bgcolor: 'background.paper', 
              borderLeft: '6px solid', 
              borderColor: 'warning.main',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }
            }}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Expiring Soon (3 days)</Typography>
                <Typography variant="h3" sx={{ fontWeight: 'bold', mt: 1, color: stats.expiringSoon > 0 ? 'warning.main' : 'inherit' }}>
                  {stats.expiringSoon}
                </Typography>
              </Box>
              <WarningIcon color="warning" sx={{ fontSize: 40, opacity: 0.8 }} />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card 
            onClick={() => setExpandedSection(expandedSection === 'expired' ? null : 'expired')}
            sx={{ 
              bgcolor: 'background.paper', 
              borderLeft: '6px solid', 
              borderColor: 'error.main',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 }
            }}
          >
            <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Expired Items</Typography>
                <Typography variant="h3" sx={{ fontWeight: 'bold', mt: 1, color: stats.expired > 0 ? 'error.main' : 'inherit' }}>
                  {stats.expired}
                </Typography>
              </Box>
              <CancelIcon color="error" sx={{ fontSize: 40, opacity: 0.8 }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Expanded items list Collapse */}
      <Collapse in={expandedSection !== null} sx={{ mb: 4 }}>
        {expandedSection && (
          <Paper sx={{ p: 3, borderRadius: 4, position: 'relative' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                {expandedSection === 'active' && 'Active Items (Expiring soonest first)'}
                {expandedSection === 'expiring' && 'Items Expiring Soon (3 days or less)'}
                {expandedSection === 'expired' && 'Expired Items'}
              </Typography>
              <IconButton size="small" onClick={() => setExpandedSection(null)}>
                <CloseIcon />
              </IconButton>
            </Box>

            <List sx={{ width: '100%', bgcolor: 'background.paper', maxHeight: 300, overflowY: 'auto', borderRadius: 2 }}>
              {((expandedSection === 'active' && stats.sortedActive) ||
                (expandedSection === 'expiring' && stats.sortedExpiringSoon) ||
                (expandedSection === 'expired' && stats.sortedExpired)
              ).map((p) => {
                const badge = getExpirationBadgeInfo(p.expirationDate);
                return (
                  <ListItem 
                    key={p.id} 
                    divider
                    sx={{
                      '&:hover': { bgcolor: 'action.hover' },
                      borderRadius: 1,
                      px: 2
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'transparent', fontSize: '1.8rem' }}>
                        {getFoodEmoji(p.name)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={p.name}
                      secondary={`Quantity: ${p.quantity} ${p.unit} | Location: ${p.location}`}
                    />
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Chip 
                        label={badge.text} 
                        sx={{ 
                          bgcolor: badge.color, 
                          color: '#ffffff',
                          fontWeight: 'bold',
                          fontSize: '0.75rem'
                        }} 
                      />
                    </Box>
                  </ListItem>
                );
              })}
              {((expandedSection === 'active' && stats.sortedActive.length === 0) ||
                (expandedSection === 'expiring' && stats.sortedExpiringSoon.length === 0) ||
                (expandedSection === 'expired' && stats.sortedExpired.length === 0)
              ) && (
                <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                  No items found in this section.
                </Typography>
              )}
            </List>
          </Paper>
        )}
      </Collapse>

      {/* Charts Section */}
      <Grid container spacing={4}>
        {/* Active Locations Distribution */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', height: 350, borderRadius: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              Active Items by Location
            </Typography>
            {stats.locationData.length === 0 ? (
              <Box sx={{ display: 'flex', flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Typography color="text.secondary">No items registered.</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.locationData}
                    cx="50%"
                    cy="45%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {stats.locationData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} items`, 'Location']} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* Consumed vs Wasted History */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', height: 350, borderRadius: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              Consumed vs Wasted History
            </Typography>
            {stats.wastedConsumedData.every(item => item.value === 0) ? (
              <Box sx={{ display: 'flex', flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Typography color="text.secondary">No consumption logs yet.</Typography>
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.wastedConsumedData}
                    cx="50%"
                    cy="45%"
                    innerRadius={0}
                    outerRadius={90}
                    paddingAngle={0}
                    dataKey="value"
                  >
                    {stats.wastedConsumedData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} items`, 'Status']} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Paper>
        </Grid>

        {/* Expirations in Next 7 Days */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', height: 350, borderRadius: 4 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
              Upcoming Expirations (Next 7 Days)
            </Typography>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.upcomingExpirations}
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value) => [`${value} items`, 'Expiring']} />
                <Bar dataKey="items" fill={theme.palette.warning.main} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

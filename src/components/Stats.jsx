import React, { useMemo } from 'react';
import { 
  Box, Grid, Paper, Typography, useTheme, Button 
} from '@mui/material';
import { 
  DeleteForever as DeleteIcon 
} from '@mui/icons-material';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import dbClient from '../utils/dbClient';

export default function Stats({ products, settings, onRefresh }) {
  const theme = useTheme();

  const handleClearHistory = async () => {
    if (!window.confirm('Are you sure you want to clear all consumed and wasted history? This will reset your stats charts.')) {
      return;
    }
    try {
      await dbClient.updateDb((db) => {
        // Filter out consumed/wasted products, keep only active products
        db.products = db.products.filter(p => (p.status || 'ACTIVE') === 'ACTIVE');
        return db;
      });
      onRefresh();
    } catch (err) {
      console.error('Clear history error:', err);
      alert('Failed to clear stats history');
    }
  };

  const stats = useMemo(() => {
    const active = products.filter(p => p.status === 'ACTIVE' || !p.status);
    const consumed = products.filter(p => p.status === 'CONSUMED');
    const wasted = products.filter(p => p.status === 'WASTED');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const defaultLocations = settings.locations || ['Fridge', 'Freezer'];
    const locationCounts = {};
    defaultLocations.forEach(loc => {
      locationCounts[loc] = 0;
    });
    
    active.forEach(p => {
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

    return {
      locationData,
      wastedConsumedData,
      upcomingExpirations
    };
  }, [products, settings.locations, theme]);

  const PIE_COLORS = [theme.palette.primary.main, theme.palette.secondary.main, '#e67e22'];

  return (
    <Box sx={{ p: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>Stats & Reports</Typography>
          <Typography variant="body1" color="text.secondary">
            Visual analytics of your household food trends
          </Typography>
        </Box>
        <Button 
          variant="outlined" 
          color="error" 
          startIcon={<DeleteIcon />} 
          onClick={handleClearHistory}
        >
          Clear Stats History
        </Button>
      </Box>

      {/* Charts Section */}
      <Grid container spacing={4}>
        {/* Active Locations Distribution */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', height: 350 }}>
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
          <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', height: 350 }}>
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
          <Paper sx={{ p: 3, display: 'flex', flexDirection: 'column', height: 350 }}>
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

import React, { useState } from 'react';
import { 
  AppBar, Toolbar, Typography, Button, IconButton, Box, Tabs, Tab, 
  Menu, MenuItem, useMediaQuery, useTheme, Drawer, List, ListItem, ListItemButton, ListItemText 
} from '@mui/material';
import { 
  Brightness4 as DarkIcon, Brightness7 as LightIcon, 
  Menu as MenuIcon, Logout as LogoutIcon, GitHub as GitHubIcon 
} from '@mui/icons-material';

export default function Navbar({ currentTab, setCurrentTab, darkMode, setDarkMode, repo, onLogout }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  const menuItems = [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'settings', label: 'Settings' }
  ];

  const toggleDrawer = (open) => (event) => {
    if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setDrawerOpen(open);
  };

  return (
    <AppBar position="static" color="primary" elevation={2}>
      <Toolbar>
        {isMobile && (
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={toggleDrawer(true)}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        )}

        <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
          🍎 FoodEx
          {!isMobile && repo && (
            <Typography variant="caption" sx={{ opacity: 0.8, bgcolor: 'primary.dark', px: 1, py: 0.5, borderRadius: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <GitHubIcon fontSize="inherit" /> {repo}
            </Typography>
          )}
        </Typography>

        {/* Desktop Tabs */}
        {!isMobile && (
          <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center' }}>
            <Tabs 
              value={currentTab} 
              onChange={handleTabChange} 
              textColor="inherit" 
              indicatorColor="secondary"
            >
              {menuItems.map(item => (
                <Tab 
                  key={item.value} 
                  value={item.value} 
                  label={item.label} 
                  sx={{ color: '#ffffff', fontWeight: 'bold' }} 
                />
              ))}
            </Tabs>
          </Box>
        )}

        {/* Action Icons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton color="inherit" onClick={() => setDarkMode(!darkMode)}>
            {darkMode ? <LightIcon /> : <DarkIcon />}
          </IconButton>
          
          <IconButton color="inherit" onClick={onLogout} title="Log Out">
            <LogoutIcon />
          </IconButton>
        </Box>
      </Toolbar>

      {/* Mobile Drawer */}
      <Drawer anchor="left" open={drawerOpen} onClose={toggleDrawer(false)}>
        <Box
          sx={{ width: 250 }}
          role="presentation"
          onClick={toggleDrawer(false)}
          onKeyDown={toggleDrawer(false)}
        >
          {repo && (
            <Box sx={{ p: 2, bgcolor: 'primary.main', color: '#ffffff' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <GitHubIcon fontSize="small" /> FoodEx Connected
              </Typography>
              <Typography variant="caption" noWrap sx={{ display: 'block', opacity: 0.9 }}>
                {repo}
              </Typography>
            </Box>
          )}
          <List>
            {menuItems.map((item) => (
              <ListItem key={item.value} disablePadding>
                <ListItemButton 
                  selected={currentTab === item.value}
                  onClick={() => setCurrentTab(item.value)}
                >
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
    </AppBar>
  );
}

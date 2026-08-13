import React, { useState } from 'react';
import { 
  AppBar, Toolbar, Typography, Box, Tabs, Tab, 
  useMediaQuery, useTheme, Drawer, List, ListItem, ListItemButton, ListItemText, ListItemIcon,
  IconButton, Button, Menu, MenuItem, Divider, Dialog, DialogTitle, DialogContent, DialogActions, TextField
} from '@mui/material';
import { 
  Brightness4 as DarkIcon, Brightness7 as LightIcon, 
  Menu as MenuIcon, Logout as LogoutIcon, GitHub as GitHubIcon,
  Dashboard as DashboardIcon, Settings as SettingsIcon,
  BarChart as StatsIcon, Home as HomeIcon, ArrowDropDown as ArrowDropDownIcon,
  Add as AddIcon, Check as CheckIcon
} from '@mui/icons-material';

export default function Navbar({ 
  currentTab, setCurrentTab, darkMode, setDarkMode, repo, onLogout,
  households = [], activeHouseholdId, onSwitchHousehold, onCreateHousehold
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Household selector menu
  const [anchorEl, setAnchorEl] = useState(null);
  const householdMenuOpen = Boolean(anchorEl);

  // Create household dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');

  const activeHousehold = households.find(h => h.id === activeHouseholdId) || households[0] || { name: 'Main Home' };

  const handleTabChange = (event, newValue) => {
    if (newValue === 'theme') {
      setDarkMode(!darkMode);
    } else if (newValue === 'logout') {
      onLogout();
    } else {
      setCurrentTab(newValue);
    }
  };

  const menuItems = [
    { value: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { value: 'stats', label: 'Stats', icon: <StatsIcon /> },
    { value: 'settings', label: 'Settings', icon: <SettingsIcon /> },
    { value: 'theme', label: darkMode ? 'Light Mode' : 'Dark Mode', icon: darkMode ? <LightIcon /> : <DarkIcon /> },
    { value: 'logout', label: 'Logout', icon: <LogoutIcon /> }
  ];

  const toggleDrawer = (open) => (event) => {
    if (event.type === 'keydown' && (event.key === 'Tab' || event.key === 'Shift')) {
      return;
    }
    setDrawerOpen(open);
  };

  const handleOpenHouseholdMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseHouseholdMenu = () => {
    setAnchorEl(null);
  };

  const handleSelectHousehold = (id) => {
    handleCloseHouseholdMenu();
    if (id !== activeHouseholdId && onSwitchHousehold) {
      onSwitchHousehold(id);
    }
  };

  const handleOpenCreateDialog = () => {
    handleCloseHouseholdMenu();
    setNewHouseholdName('');
    setCreateDialogOpen(true);
  };

  const handleConfirmCreate = async () => {
    if (newHouseholdName.trim() && onCreateHousehold) {
      await onCreateHousehold(newHouseholdName.trim());
      setCreateDialogOpen(false);
      setNewHouseholdName('');
    }
  };

  return (
    <AppBar position="static" color="primary" elevation={2}>
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {isMobile && (
            <IconButton
              size="large"
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={toggleDrawer(true)}
            >
              <MenuIcon />
            </IconButton>
          )}

          <Typography variant="h6" component="div" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
            <img src="logo.png" alt="FoodEx Logo" style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.2)' }} />
            FoodEx
          </Typography>

          {/* Household Selector Dropdown Button */}
          {households.length > 0 && (
            <Button
              color="inherit"
              size="small"
              onClick={handleOpenHouseholdMenu}
              startIcon={<HomeIcon fontSize="small" />}
              endIcon={<ArrowDropDownIcon />}
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.15)',
                '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.25)' },
                borderRadius: 2,
                px: 1.5,
                py: 0.5,
                fontWeight: 600,
                textTransform: 'none',
                maxWidth: { xs: 140, sm: 220 },
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {activeHousehold.name}
            </Button>
          )}

          <Menu
            anchorEl={anchorEl}
            open={householdMenuOpen}
            onClose={handleCloseHouseholdMenu}
            transformOrigin={{ horizontal: 'left', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
            PaperProps={{ sx: { minWidth: 220, borderRadius: 2, mt: 0.5 } }}
          >
            <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block', fontWeight: 'bold', color: 'text.secondary' }}>
              SWITCH HOUSEHOLD
            </Typography>
            {households.map((h) => {
              const isCurrent = h.id === activeHouseholdId;
              return (
                <MenuItem 
                  key={h.id} 
                  selected={isCurrent}
                  onClick={() => handleSelectHousehold(h.id)}
                  sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: isCurrent ? 'bold' : 'normal' }}>
                      {h.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                      {h.role || 'owner'}
                    </Typography>
                  </Box>
                  {isCurrent && <CheckIcon fontSize="small" color="primary" />}
                </MenuItem>
              );
            })}
            <Divider sx={{ my: 1 }} />
            <MenuItem onClick={handleOpenCreateDialog} sx={{ py: 1, color: 'primary.main', fontWeight: 'bold' }}>
              <ListItemIcon sx={{ color: 'inherit', minWidth: 32 }}>
                <AddIcon fontSize="small" />
              </ListItemIcon>
              Create Household
            </MenuItem>
          </Menu>
        </Box>

        {/* Desktop Tabs menu */}
        {!isMobile && (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
      </Toolbar>

      {/* Mobile Drawer */}
      <Drawer anchor="left" open={drawerOpen} onClose={toggleDrawer(false)}>
        <Box
          sx={{ width: 260 }}
          role="presentation"
          onClick={toggleDrawer(false)}
          onKeyDown={toggleDrawer(false)}
        >
          <Box sx={{ p: 2, bgcolor: 'primary.main', color: '#ffffff' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
              <HomeIcon fontSize="small" /> {activeHousehold.name}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.9 }}>
              Active Household ({households.length} total)
            </Typography>
          </Box>
          <List>
            {menuItems.map((item) => {
              const isSelected = currentTab === item.value;
              return (
                <ListItem key={item.value} disablePadding>
                  <ListItemButton 
                    selected={isSelected}
                    onClick={() => {
                      if (item.value === 'theme') {
                        setDarkMode(!darkMode);
                      } else if (item.value === 'logout') {
                        onLogout();
                      } else {
                        setCurrentTab(item.value);
                      }
                    }}
                  >
                    <ListItemIcon sx={{ color: isSelected ? 'primary.main' : 'inherit' }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>
      </Drawer>

      {/* Create Household Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Create New Household</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Each household has its own isolated food inventory, locations, and member invitations (e.g. "Main Home", "Vacation House", "Office Pantry").
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Household Name"
            placeholder="e.g. Vacation Cabin"
            value={newHouseholdName}
            onChange={(e) => setNewHouseholdName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleConfirmCreate();
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleConfirmCreate} 
            disabled={!newHouseholdName.trim()}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </AppBar>
  );
}

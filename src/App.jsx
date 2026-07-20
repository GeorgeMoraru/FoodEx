import React, { useState, useEffect } from 'react';
import { ThemeProvider, CssBaseline, Box, Container, CircularProgress, Typography } from '@mui/material';
import getTheme from './theme';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import Settings from './components/Settings';
import ProductFormModal from './components/ProductFormModal';
import gitHubClient from './utils/gitHubClient';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // App navigation
  const [currentTab, setCurrentTab] = useState('dashboard');
  
  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('foodex_theme');
    return saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Product Modals
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);

  // Check auth status on load
  useEffect(() => {
    if (gitHubClient.isAuthenticated()) {
      setIsAuthenticated(true);
      fetchDatabase();
    }
  }, []);

  // Save theme selection
  useEffect(() => {
    localStorage.setItem('foodex_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const fetchDatabase = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await gitHubClient.getDbFile();
      if (data) {
        setDb(data.db);
      } else {
        // If db.json is missing but authenticated, initialize it
        await gitHubClient.initializeDbIfMissing();
        const dataRetry = await gitHubClient.getDbFile();
        if (dataRetry) setDb(dataRetry.db);
      }
      setIsAuthenticated(true);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch database file. Check repository permissions or network.');
      // Keep credentials but show error so they can log out if needed
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    fetchDatabase();
    setCurrentTab('dashboard');
  };

  const handleLogout = () => {
    gitHubClient.clearCredentials();
    setIsAuthenticated(false);
    setDb(null);
  };

  const handleAddProductClick = () => {
    setEditProduct(null);
    setProductModalOpen(true);
  };

  const handleEditProduct = (product) => {
    setEditProduct(product);
    setProductModalOpen(true);
  };

  const activeTheme = getTheme(darkMode ? 'dark' : 'light');

  if (!isAuthenticated) {
    return (
      <ThemeProvider theme={activeTheme}>
        <CssBaseline />
        <Login onLoginSuccess={handleLoginSuccess} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={activeTheme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: 8 }}>
        <Navbar 
          currentTab={currentTab} 
          setCurrentTab={setCurrentTab} 
          darkMode={darkMode} 
          setDarkMode={setDarkMode} 
          username={gitHubClient.username}
          onLogout={handleLogout}
        />
        
        <Container maxWidth="lg" sx={{ mt: 3 }}>
          {loading && !db ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8, gap: 2 }}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">Loading FoodEx database from GitHub...</Typography>
            </Box>
          ) : error ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="error" gutterBottom>{error}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Could not load your food database. Try signing out and back in.
              </Typography>
              <button onClick={handleLogout} style={{ padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Sign Out</button>
            </Box>
          ) : db ? (
            <>
              {currentTab === 'dashboard' && (
                <Dashboard 
                  products={db.products || []} 
                  onAddProductClick={handleAddProductClick} 
                />
              )}
              {currentTab === 'inventory' && (
                <Inventory 
                  products={db.products || []}
                  onEditProduct={handleEditProduct}
                  onAddProductClick={handleAddProductClick}
                  onRefresh={fetchDatabase}
                />
              )}
              {currentTab === 'settings' && (
                <Settings 
                  settings={db.settings || {}}
                  pushSubscriptions={db.pushSubscriptions || []}
                  onRefresh={fetchDatabase}
                />
              )}
            </>
          ) : null}
        </Container>

        <ProductFormModal 
          open={productModalOpen} 
          onClose={() => setProductModalOpen(false)} 
          product={editProduct}
          onSuccess={fetchDatabase}
        />
      </Box>
    </ThemeProvider>
  );
}

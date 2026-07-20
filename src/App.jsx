import React, { useState, useEffect } from 'react';
import { ThemeProvider, CssBaseline, Box, Container, CircularProgress, Typography } from '@mui/material';
import getTheme from './theme';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Stats from './components/Stats';
import Settings from './components/Settings';
import ProductFormModal from './components/ProductFormModal';
import { auth } from './utils/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import dbClient from './utils/dbClient';

export default function App() {
  const [user, setUser] = useState(null);
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // App navigation
  const [currentTab, setCurrentTab] = useState('dashboard');
  
  // Theme state
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('foodex_theme');
    return saved ? saved === 'dark' : true;
  });

  // Product Modals
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editProduct, setEditProduct] = useState(null);

  // Check auth status on load
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchDatabase();
      } else {
        setDb(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Save theme selection
  useEffect(() => {
    localStorage.setItem('foodex_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const fetchDatabase = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await dbClient.getDbFile();
      if (data) {
        setDb(data.db);
      } else {
        await dbClient.initializeDbIfMissing();
        const dataRetry = await dbClient.getDbFile();
        if (dataRetry) setDb(dataRetry.db);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch database file from Firebase.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    // onAuthStateChanged handles the state, but we can proactively fetch
    fetchDatabase();
    setCurrentTab('dashboard');
  };

  const handleLogout = () => {
    dbClient.clearCredentials();
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

  if (!user) {
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
          username={user.displayName || user.email}
          onLogout={handleLogout}
        />
        
        <Container maxWidth="lg" sx={{ mt: 3 }}>
          {loading && !db ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8, gap: 2 }}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">Loading FoodEx database...</Typography>
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
                  settings={db.settings || {}}
                  onAddProductClick={handleAddProductClick} 
                  onEditProduct={handleEditProduct}
                  onRefresh={fetchDatabase}
                />
              )}
              {currentTab === 'stats' && (
                <Stats 
                  products={db.products || []} 
                  settings={db.settings || {}}
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
          settings={db ? db.settings : {}}
          onSuccess={fetchDatabase}
        />
      </Box>
    </ThemeProvider>
  );
}

import React, { useState, useEffect } from 'react';
import { ThemeProvider, CssBaseline, Box, Container, CircularProgress, Typography, Fade } from '@mui/material';
import getTheme from './theme';
import Navbar from './components/Navbar';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Stats from './components/Stats';
import Settings from './components/Settings';
import ProductFormModal from './components/ProductFormModal';
import { onAuthStateChanged, getRedirectResult } from 'firebase/auth';
import { auth } from './utils/firebase';
import dbClient from './utils/dbClient';

export default function App() {
  const [user, setUser] = useState(null);
  const [guestUser, setGuestUser] = useState(() => {
    return localStorage.getItem('foodex_guest_mode') === 'true' 
      ? { uid: 'guest-user', email: 'guest@foodex.local', displayName: 'Guest Tester' } 
      : null;
  });
  const [authChecking, setAuthChecking] = useState(true);
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

  const activeUser = user || guestUser;

  // Check auth status on load and handle redirect authentication
  useEffect(() => {
    if (localStorage.getItem('foodex_guest_mode') === 'true') {
      fetchDatabase();
    }

    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          await dbClient.initializeDbIfMissing().catch(() => {});
        }
      })
      .catch((err) => {
        console.error('Auth redirect result error:', err);
      });

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthChecking(false);
      if (currentUser) {
        try {
          await dbClient.initializeDbIfMissing();
          fetchDatabase();
        } catch (dbErr) {
          console.error('Database initialization error:', dbErr);
          setError(dbErr.message || 'Failed to initialize database.');
        }
      } else if (!localStorage.getItem('foodex_guest_mode')) {
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
      setError('Failed to fetch database file.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = () => {
    // onAuthStateChanged handles the state, but we can proactively fetch
    fetchDatabase();
    setCurrentTab('dashboard');
  };

  const handleGuestLogin = () => {
    localStorage.setItem('foodex_guest_mode', 'true');
    setGuestUser({ uid: 'guest-user', email: 'guest@foodex.local', displayName: 'Guest Tester' });
    fetchDatabase();
    setCurrentTab('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('foodex_guest_mode');
    setGuestUser(null);
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

  if (authChecking && !guestUser) {
    return (
      <ThemeProvider theme={activeTheme}>
        <CssBaseline />
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
          <CircularProgress color="primary" />
        </Box>
      </ThemeProvider>
    );
  }

  if (!activeUser) {
    return (
      <ThemeProvider theme={activeTheme}>
        <CssBaseline />
        <Login onLoginSuccess={handleLoginSuccess} onGuestLogin={handleGuestLogin} />
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
          username={activeUser?.displayName || activeUser?.email || 'Guest Tester'}
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
                <Fade in={currentTab === 'dashboard'} timeout={300}>
                  <Box sx={{ willChange: 'opacity, transform', transform: 'translateZ(0)' }}>
                    <Dashboard 
                      products={db.products || []} 
                      settings={db.settings || {}}
                      onAddProductClick={handleAddProductClick} 
                      onEditProduct={handleEditProduct}
                      onRefresh={fetchDatabase}
                    />
                  </Box>
                </Fade>
              )}
              {currentTab === 'stats' && (
                <Fade in={currentTab === 'stats'} timeout={300}>
                  <Box sx={{ willChange: 'opacity, transform', transform: 'translateZ(0)' }}>
                    <Stats 
                      products={db.products || []} 
                      settings={db.settings || {}}
                      onRefresh={fetchDatabase}
                    />
                  </Box>
                </Fade>
              )}
              {currentTab === 'settings' && (
                <Fade in={currentTab === 'settings'} timeout={300}>
                  <Box sx={{ willChange: 'opacity, transform', transform: 'translateZ(0)' }}>
                    <Settings 
                      settings={db.settings || {}}
                      pushSubscriptions={db.pushSubscriptions || []}
                      onRefresh={fetchDatabase}
                    />
                  </Box>
                </Fade>
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

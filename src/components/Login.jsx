import React, { useState } from 'react';
import { 
  Box, Container, Paper, Button, Typography, 
  Alert, CircularProgress, Grid, Chip, Stack, Fade
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import CameraEnhanceIcon from '@mui/icons-material/CameraEnhance';
import SyncIcon from '@mui/icons-material/Sync';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { signInWithPopup, signInWithRedirect, signInAnonymously } from 'firebase/auth';
import { auth, googleProvider } from '../utils/firebase';
import dbClient from '../utils/dbClient';

export default function Login({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGuestLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await signInAnonymously(auth);
      await dbClient.initializeDbIfMissing();
      onLoginSuccess();
    } catch (err) {
      console.error('Anonymous sign-in error:', err);
      setError(`[${err.code || 'auth/error'}]: ${err.message || 'Guest sign-in failed.'}`);
      setLoading(false);
    }
  };

  const handleLogin = async (provider, forceRedirect = false) => {
    setError('');
    setLoading(true);
    try {
      if (forceRedirect) {
        await signInWithRedirect(auth, provider);
        return;
      }
      await signInWithPopup(auth, provider);
      await dbClient.initializeDbIfMissing();
      onLoginSuccess();
    } catch (err) {
      console.error('Firebase Auth popup error:', err);
      if (err.code === 'auth/internal-error' || err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        try {
          console.warn('[FoodEx Auth] Popup failed, falling back to signInWithRedirect...');
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectErr) {
          console.error('Firebase Auth redirect fallback error:', redirectErr);
          setError(`[${redirectErr.code || 'auth/error'}]: ${redirectErr.message || 'Authentication failed.'}`);
        }
      } else {
        setError(`[${err.code || 'auth/error'}]: ${err.message || 'Authentication failed.'}`);
      }
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: theme =>
          theme.palette.mode === 'dark'
            ? 'radial-gradient(circle at 50% 30%, #1a233a 0%, #0d1117 70%)'
            : 'radial-gradient(circle at 50% 30%, #e0f2fe 0%, #bae6fd 70%)',
        px: 2,
        py: 4
      }}
    >
      <Container maxWidth="sm">
        <Fade in timeout={400}>
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, sm: 5 },
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              borderRadius: '4px',
              border: '1px solid',
              borderColor: 'divider',
              backdropFilter: 'blur(16px)',
              background: theme =>
                theme.palette.mode === 'dark'
                  ? 'rgba(22,27,34,0.9)'
                  : 'rgba(255,255,255,0.92)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
              willChange: 'opacity, transform',
              transform: 'translateZ(0)'
            }}
          >
            {/* Hero Branding */}
            <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
              <img src="logo.png" alt="FoodEx Logo" style={{ width: 64, height: 64, borderRadius: '50%', marginBottom: 12, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }} />
              <Typography
                variant="h3"
                component="h1"
                sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: '-0.5px', textTransform: 'uppercase' }}
              >
                FoodEx
              </Typography>
              <Typography variant="subtitle1" color="text.secondary" align="center" sx={{ fontWeight: 500, mt: 0.5 }}>
                Smart Food Expiration Tracking & Household Management
              </Typography>
            </Box>

          {/* Feature Highlights */}
          <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center" gap={1} sx={{ mb: 4 }}>
            <Chip icon={<CameraEnhanceIcon fontSize="small" />} label="AI Expiration Scanner" color="primary" variant="outlined" size="small" />
            <Chip icon={<SyncIcon fontSize="small" />} label="Cloud Household Sync" color="success" variant="outlined" size="small" />
            <Chip icon={<NotificationsActiveIcon fontSize="small" />} label="Smart Push Alerts" color="warning" variant="outlined" size="small" />
          </Stack>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

            {/* Login Action Area */}
            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                onClick={() => handleLogin(googleProvider, false)}
                startIcon={<GoogleIcon />}
                sx={{ 
                  py: 1.5, 
                  borderRadius: 1, 
                  fontWeight: 700, 
                  fontSize: '1rem',
                  textTransform: 'none',
                  boxShadow: '0 4px 14px rgba(46, 125, 50, 0.25)'
                }}
              >
                Sign in with Google
              </Button>

              <Button
                fullWidth
                variant="outlined"
                size="medium"
                disabled={loading}
                onClick={handleGuestLogin}
                sx={{ 
                  py: 1.2, 
                  borderRadius: 1, 
                  fontWeight: 600, 
                  fontSize: '0.95rem',
                  textTransform: 'none'
                }}
              >
                Instant Guest / Test Access
              </Button>
            </Box>
          
          {loading && (
            <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">Authenticating with Google...</Typography>
            </Box>
          )}

          <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid', borderColor: 'divider', width: '100%', textAlign: 'center' }}>
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5} sx={{ opacity: 0.7 }}>
              <LockOutlinedIcon fontSize="small" color="disabled" />
              <Typography variant="caption" color="text.secondary">
                Protected by Firebase Authentication & Encrypted Firestore Rules
              </Typography>
            </Stack>
          </Box>
        </Paper>
      </Fade>
    </Container>
  </Box>
);
}

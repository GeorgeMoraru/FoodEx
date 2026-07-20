import React, { useState } from 'react';
import { 
  Box, Container, Paper, Button, Typography, 
  Alert, CircularProgress, Divider
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import GitHubIcon from '@mui/icons-material/GitHub';
import { signInWithPopup, browserPopupRedirectResolver } from 'firebase/auth';
import { auth, googleProvider, githubProvider } from '../utils/firebase';
import dbClient from '../utils/dbClient';

export default function Login({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (provider) => {
    setError('');
    setLoading(true);
    try {
      await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      // Wait a moment for Firebase auth state to settle, then initialize DB
      await dbClient.initializeDbIfMissing();
      onLoginSuccess();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Authentication failed.');
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
            ? 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d1828 100%)'
            : 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #bae6fd 100%)',
        px: 2,
      }}
    >
      <Container maxWidth="xs">
        <Paper
          elevation={0}
          sx={{
            p: 5,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            borderRadius: 4,
            border: '1px solid',
            borderColor: 'divider',
            backdropFilter: 'blur(12px)',
            background: theme =>
              theme.palette.mode === 'dark'
                ? 'rgba(22,27,34,0.85)'
                : 'rgba(255,255,255,0.9)',
          }}
        >
          {/* Logo */}
          <Typography variant="h3" sx={{ mb: 0.5 }}>🍎</Typography>
          <Typography
            variant="h4"
            component="h1"
            sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: '-0.5px' }}
          >
            FoodEx
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 4 }}>
            Seamless Food Expiration Tracker
          </Typography>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              size="large"
              disabled={loading}
              onClick={() => handleLogin(googleProvider)}
              startIcon={<GoogleIcon />}
              sx={{ py: 1.5, borderRadius: 2, fontWeight: 700, borderColor: 'divider', color: 'text.primary' }}
            >
              Sign in with Google
            </Button>
            
            <Button
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              onClick={() => handleLogin(githubProvider)}
              startIcon={<GitHubIcon />}
              sx={{
                py: 1.5,
                borderRadius: 2,
                fontWeight: 700,
                bgcolor: theme => theme.palette.mode === 'dark' ? '#238636' : '#24292f',
                color: '#ffffff',
                '&:hover': {
                  bgcolor: theme => theme.palette.mode === 'dark' ? '#2ea043' : '#000000',
                }
              }}
            >
              Sign in with GitHub
            </Button>
          </Box>
          
          {loading && (
            <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <CircularProgress size={24} />
              <Typography variant="caption" sx={{ mt: 1 }} color="text.secondary">Authenticating...</Typography>
            </Box>
          )}
        </Paper>

        <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ mt: 3, opacity: 0.6 }}>
          Your data syncs securely across all your devices via Firebase.
        </Typography>
      </Container>
    </Box>
  );
}

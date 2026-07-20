import React, { useState, useEffect, useRef } from 'react';
import {
  Box, Container, Paper, Button, Typography,
  Alert, CircularProgress, Chip, Link, Divider,
} from '@mui/material';
import GitHubIcon from '@mui/icons-material/GitHub';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { requestDeviceCode, pollForToken } from '../utils/deviceFlow';
import gitHubClient from '../utils/gitHubClient';

// Auth steps
const STEP = {
  IDLE: 'idle',
  REQUESTING: 'requesting',
  WAITING: 'waiting',
  SETTING_UP: 'setting_up',
  DONE: 'done',
};

export default function Login({ onLoginSuccess }) {
  const [step, setStep] = useState(STEP.IDLE);
  const [error, setError] = useState('');
  const [deviceData, setDeviceData] = useState(null); // { user_code, verification_uri, expires_in }
  const [pollCount, setPollCount] = useState(0);
  const abortRef = useRef(false);

  // Clean up polling if component unmounts
  useEffect(() => () => { abortRef.current = true; }, []);

  const handleSignIn = async () => {
    setError('');
    setStep(STEP.REQUESTING);
    abortRef.current = false;

    try {
      // Step 1: get device code
      const data = await requestDeviceCode();
      setDeviceData(data);
      setStep(STEP.WAITING);

      // Step 2: poll for token
      const token = await pollForToken(
        data.device_code,
        data.interval || 5,
        () => !abortRef.current && setPollCount(c => c + 1),
      );

      if (abortRef.current) return;

      // Step 3: set token, discover username, set up repo
      setStep(STEP.SETTING_UP);
      await gitHubClient.setToken(token);

      // Create repo if it doesn't exist, then init db.json
      const repoExists = await gitHubClient.checkRepository();
      if (!repoExists) await gitHubClient.createRepository();
      await gitHubClient.initializeDbIfMissing();

      setStep(STEP.DONE);
      setTimeout(onLoginSuccess, 600);
    } catch (err) {
      if (abortRef.current) return;
      setError(err.message || 'Authentication failed. Please try again.');
      setStep(STEP.IDLE);
    }
  };

  const handleCancel = () => {
    abortRef.current = true;
    setStep(STEP.IDLE);
    setDeviceData(null);
    setError('');
  };

  const copyCode = () => {
    if (deviceData?.user_code) navigator.clipboard.writeText(deviceData.user_code);
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
            ? 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #0d2818 100%)'
            : 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #f0f9ff 100%)',
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
            Food expiration tracker — backed by your GitHub account
          </Typography>

          {/* Error */}
          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {/* ── IDLE: Sign in button ── */}
          {step === STEP.IDLE && (
            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<GitHubIcon />}
              onClick={handleSignIn}
              sx={{
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 700,
                borderRadius: 2,
                background: theme =>
                  theme.palette.mode === 'dark' ? '#238636' : 'primary.main',
                '&:hover': {
                  background: theme =>
                    theme.palette.mode === 'dark' ? '#2ea043' : undefined,
                },
              }}
            >
              Sign in with GitHub
            </Button>
          )}

          {/* ── REQUESTING: spinner ── */}
          {step === STEP.REQUESTING && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 2 }}>
              <CircularProgress size={36} />
              <Typography variant="body2" color="text.secondary">
                Connecting to GitHub…
              </Typography>
            </Box>
          )}

          {/* ── WAITING: show code ── */}
          {step === STEP.WAITING && deviceData && (
            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <LockOpenIcon color="primary" sx={{ fontSize: 40 }} />
              <Typography variant="body1" align="center" fontWeight={600}>
                Open GitHub to authorize
              </Typography>
              <Typography variant="body2" color="text.secondary" align="center">
                Go to the link below and enter your one-time code:
              </Typography>

              {/* Code chip */}
              <Chip
                label={deviceData.user_code}
                onClick={copyCode}
                title="Click to copy"
                sx={{
                  fontSize: '1.4rem',
                  fontWeight: 800,
                  letterSpacing: '0.2em',
                  px: 2,
                  py: 3,
                  borderRadius: 2,
                  fontFamily: 'monospace',
                  cursor: 'pointer',
                  border: '2px solid',
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  bgcolor: 'primary.50',
                  '&:hover': { opacity: 0.85 },
                }}
              />
              <Typography variant="caption" color="text.secondary">
                Click the code to copy it
              </Typography>

              <Divider sx={{ width: '100%' }} />

              <Button
                fullWidth
                variant="outlined"
                size="large"
                endIcon={<OpenInNewIcon />}
                component={Link}
                href={deviceData.verification_uri}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ borderRadius: 2, fontWeight: 700 }}
              >
                {deviceData.verification_uri.replace('https://', '')}
              </Button>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary">
                  Waiting for you to approve… ({pollCount} checks)
                </Typography>
              </Box>

              <Button size="small" color="inherit" onClick={handleCancel} sx={{ opacity: 0.5 }}>
                Cancel
              </Button>
            </Box>
          )}

          {/* ── SETTING UP ── */}
          {step === STEP.SETTING_UP && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 2 }}>
              <CircularProgress size={36} />
              <Typography variant="body2" color="text.secondary" align="center">
                Setting up your <strong>foodex-data</strong> repository…
              </Typography>
            </Box>
          )}

          {/* ── DONE ── */}
          {step === STEP.DONE && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 2 }}>
              <CheckCircleIcon color="success" sx={{ fontSize: 48 }} />
              <Typography variant="body1" fontWeight={600} color="success.main">
                Signed in!
              </Typography>
            </Box>
          )}
        </Paper>

        <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ mt: 2, opacity: 0.6 }}>
          Your data lives in a private repo on your GitHub account.
          No servers. No subscriptions.
        </Typography>
      </Container>
    </Box>
  );
}

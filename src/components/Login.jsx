import React, { useState } from 'react';
import { 
  Box, Container, Paper, TextField, Button, Typography, 
  Alert, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions
} from '@mui/material';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import gitHubClient from '../utils/gitHubClient';

export default function Login({ onLoginSuccess }) {
  const [pat, setPat] = useState(gitHubClient.pat || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);
  const [repoName, setRepoName] = useState('');

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    if (!pat.trim()) {
      setError('GitHub PAT is required.');
      setLoading(false);
      return;
    }

    try {
      await gitHubClient.setPat(pat.trim());
      const expectedRepo = gitHubClient.repo;
      setRepoName(expectedRepo);
      
      const repoDetails = await gitHubClient.checkRepository();
      if (!repoDetails) {
        // Repo does not exist, open confirmation dialog to create it
        setConfirmCreateOpen(true);
        setLoading(false);
        return;
      }

      // Repo exists, initialize db.json if missing
      await gitHubClient.initializeDbIfMissing();
      onLoginSuccess();
    } catch (err) {
      console.error(err);
      gitHubClient.clearCredentials();
      setError(err.response?.data?.message || err.message || 'Verification failed. Please check your PAT.');
      setLoading(false);
    }
  };

  const handleCreateRepo = async () => {
    setConfirmCreateOpen(false);
    setLoading(true);
    setError('');

    try {
      await gitHubClient.createRepository();
      await gitHubClient.initializeDbIfMissing();
      onLoginSuccess();
    } catch (err) {
      console.error(err);
      gitHubClient.clearCredentials();
      setError(err.message || 'Failed to create or initialize the repository.');
      setLoading(false);
    }
  };

  const handleCancelCreate = () => {
    setConfirmCreateOpen(false);
    gitHubClient.clearCredentials();
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
            Serverless Food Expiration Tracker
          </Typography>

          {error && (
            <Alert severity="error" sx={{ width: '100%', mb: 2, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleVerify} sx={{ width: '100%', mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              label="GitHub Personal Access Token (PAT)"
              type="password"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              helperText="Requires 'repo' scope."
              sx={{ mb: 3 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
              size="large"
              startIcon={!loading && <LockOpenIcon />}
              sx={{
                py: 1.5,
                fontSize: '1rem',
                fontWeight: 700,
                borderRadius: 2,
                background: theme =>
                  theme.palette.mode === 'dark' ? '#1976d2' : 'primary.main',
                '&:hover': {
                  background: theme =>
                    theme.palette.mode === 'dark' ? '#1565c0' : undefined,
                },
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Connect Database'}
            </Button>
          </Box>
        </Paper>

        <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ mt: 2, opacity: 0.6 }}>
          Your data lives securely in a private repository on your GitHub account. No servers required.
        </Typography>

        {/* Repository Creation Confirmation Dialog */}
        <Dialog
          open={confirmCreateOpen}
          onClose={handleCancelCreate}
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-description"
        >
          <DialogTitle id="confirm-dialog-title">
            Database Repository Setup
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="confirm-dialog-description">
              We couldn't find the <strong>{repoName}</strong> repository in your account. Would you like FoodEx to create this private repository automatically to store your inventory data?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCancelCreate} color="inherit">Cancel</Button>
            <Button onClick={handleCreateRepo} color="primary" variant="contained" autoFocus disabled={loading}>
              {loading ? <CircularProgress size={20} color="inherit" /> : 'Create Repository'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </Box>
  );
}

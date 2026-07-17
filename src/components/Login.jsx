import React, { useState } from 'react';
import { 
  Box, Container, Paper, TextField, Button, Typography, 
  Alert, CircularProgress, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions
} from '@mui/material';
import gitHubClient from '../utils/gitHubClient';

export default function Login({ onLoginSuccess }) {
  const [pat, setPat] = useState(gitHubClient.pat || '');
  const [repo, setRepo] = useState(gitHubClient.repo || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Repo creation confirmation dialog
  const [confirmCreateOpen, setConfirmCreateOpen] = useState(false);

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    if (!pat.trim()) {
      setError('GitHub PAT is required.');
      setLoading(false);
      return;
    }
    if (!repo.trim() || !repo.includes('/')) {
      setError('GitHub repository name must be in the format "owner/repo-name".');
      setLoading(false);
      return;
    }

    try {
      gitHubClient.setCredentials(pat.trim(), repo.trim());
      
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
      setError(err.response?.data?.message || err.message || 'Verification failed. Please check your PAT and repository name.');
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
    <Container maxWidth="xs" sx={{ mt: 8 }}>
      <Paper sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', borderRadius: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
          🍎 FoodEx
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom align="center">
          Serverless GitHub-Backed Food Expiration Tracker
        </Typography>

        {error && <Alert severity="error" sx={{ width: '100%', mb: 2, borderRadius: 2 }}>{error}</Alert>}

        <Box component="form" onSubmit={handleVerify} sx={{ width: '100%', mt: 2 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            label="GitHub Personal Access Token (PAT)"
            type="password"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            helperText="Requires 'repo' scope to read/write db.json and commit photos."
          />

          <TextField
            margin="normal"
            required
            fullWidth
            label="GitHub Repository (owner/repo)"
            placeholder="username/foodex-db"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            helperText="e.g. your-github-username/my-foodex-inventory"
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={loading}
            sx={{ mt: 3, mb: 2, py: 1.5, fontSize: '1rem', fontWeight: 'bold' }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              'Connect Repository'
            )}
          </Button>
        </Box>
      </Paper>

      {/* Repository Creation Confirmation Dialog */}
      <Dialog
        open={confirmCreateOpen}
        onClose={handleCancelCreate}
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <DialogTitle id="confirm-dialog-title">
          {"Repository Not Found"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="confirm-dialog-description">
            The repository <strong>{repo}</strong> was not found. Would you like FoodEx to create this repository and initialize the <code>db.json</code> file for you automatically?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelCreate} color="inherit">Cancel</Button>
          <Button onClick={handleCreateRepo} color="primary" variant="contained" autoFocus>
            Create Repository
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

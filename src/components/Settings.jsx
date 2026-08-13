import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, Grid, 
  CircularProgress, Alert, Divider, FormControlLabel, Switch, IconButton,
  List, ListItem, ListItemText, ListItemSecondaryAction, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions
} from '@mui/material';
import { 
  Notifications as PushIcon, SettingsInputSvideo as HAIcon,
  ContentCopy as CopyIcon, Refresh as RefreshIcon,
  Delete as DeleteIcon, Group as GroupIcon, Add as AddIcon,
  MeetingRoom as LeaveIcon, Email as EmailIcon, Send as SendIcon,
  CheckCircle as AcceptIcon, Cancel as RejectIcon, Edit as EditIcon,
  Home as HomeIcon, Check as CheckIcon
} from '@mui/icons-material';
import dbClient from '../utils/dbClient';
import { getVapidPublicKey } from '../utils/vapid';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function Settings({ 
  settings, pushSubscriptions, onRefresh, 
  households = [], onHouseholdsChange 
}) {
  const [notificationDaysBefore, setNotificationDaysBefore] = useState(settings.notificationDaysBefore || 3);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(settings.emailAlertsEnabled || false);
  const [emailAddress, setEmailAddress] = useState(settings.emailAddress || '');
  const [haEnabled, setHaEnabled] = useState(!!settings.haToken);
  const [localGeminiKey, setLocalGeminiKey] = useState(() => localStorage.getItem('foodex_gemini_api_key') || '');

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [notificationSupport, setNotificationSupport] = useState(true);

  // Household management state
  const [userHouseholds, setUserHouseholds] = useState(households);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingHousehold, setRenamingHousehold] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  // Household sharing & invites state
  const [members, setMembers] = useState([]);
  const [targetHouseholdId, setTargetHouseholdId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [sentInvites, setSentInvites] = useState([]);
  const [myInvites, setMyInvites] = useState([]);
  const [inviteSuccessLink, setInviteSuccessLink] = useState(null);
  
  // Custom locations state
  const [newLocationName, setNewLocationName] = useState('');
  const currentLocations = settings.locations || ['Fridge', 'Freezer'];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const activeHousehold = userHouseholds.find(h => h.id === dbClient.householdId) || userHouseholds[0] || { name: 'Main Home', id: dbClient.householdId };

  useEffect(() => {
    checkPushSupport();
    fetchHouseholds();
    fetchMembers();
    fetchInvites();
  }, [pushSubscriptions, dbClient.householdId]);

  const fetchHouseholds = async () => {
    try {
      const list = await dbClient.getUserHouseholds();
      setUserHouseholds(list);
      if (onHouseholdsChange) onHouseholdsChange(list);
    } catch (err) {
      console.error('Error fetching households:', err);
    }
  };

  const fetchMembers = async () => {
    try {
      const list = await dbClient.getHouseholdMembers();
      setMembers(list);
    } catch (err) {
      console.error('Error fetching household members:', err);
    }
  };

  const fetchInvites = async () => {
    try {
      const [sent, forMe] = await Promise.all([
        dbClient.getHouseholdInvites(dbClient.householdId).catch(() => []),
        dbClient.getInvitesForMe().catch(() => [])
      ]);
      setSentInvites(sent);
      setMyInvites(forMe);
    } catch (err) {
      console.error('Error fetching invites:', err);
    }
  };

  const checkPushSupport = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setNotificationSupport(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready.catch(() => null);
      if (registration) {
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          const exists = pushSubscriptions.some(s => s.endpoint === subscription.endpoint);
          setIsSubscribed(exists);
        } else {
          setIsSubscribed(false);
        }
      }
    } catch (err) {
      console.error('Check push subscription status error:', err);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const getUuid = () => {
        return self.crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      };

      await dbClient.updateDb((db) => {
        db.settings = {
          ...db.settings,
          notificationDaysBefore: parseInt(notificationDaysBefore),
          emailAlertsEnabled,
          emailAddress: emailAddress.trim(),
          haToken: haEnabled ? (db.settings.haToken || getUuid()) : null
        };
        return db;
      });

      if (localGeminiKey.trim()) {
        localStorage.setItem('foodex_gemini_api_key', localGeminiKey.trim());
      } else {
        localStorage.removeItem('foodex_gemini_api_key');
      }

      setSuccess('Settings updated successfully!');
      onRefresh();
    } catch (err) {
      console.error(err);
      setError('Failed to save settings: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = async (e) => {
    e.preventDefault();
    const name = newLocationName.trim();
    if (!name) return;

    if (currentLocations.includes(name)) {
      setError('Location already exists.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await dbClient.updateDb((db) => {
        db.settings.locations = [...(db.settings.locations || ['Fridge', 'Freezer']), name];
        return db;
      });
      setNewLocationName('');
      setSuccess(`Added location "${name}"`);
      onRefresh();
    } catch (err) {
      setError('Failed to add location: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLocation = async (locationToDelete) => {
    if (currentLocations.length <= 1) {
      setError('You must keep at least one storage location.');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${locationToDelete}"? Items currently stored in this location will remain.`)) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      await dbClient.updateDb((db) => {
        db.settings.locations = (db.settings.locations || ['Fridge', 'Freezer']).filter(l => l !== locationToDelete);
        return db;
      });
      setSuccess(`Deleted location "${locationToDelete}"`);
      onRefresh();
    } catch (err) {
      setError('Failed to delete location: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Household Management Handlers ─────────────────────────────────────

  const handleCreateHousehold = async (e) => {
    e.preventDefault();
    const name = newHouseholdName.trim();
    if (!name) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await dbClient.createHousehold(name);
      setNewHouseholdName('');
      setSuccess(`Created household "${name}" and switched to it!`);
      await fetchHouseholds();
      onRefresh();
    } catch (err) {
      setError('Failed to create household: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchHousehold = async (id) => {
    if (id === dbClient.householdId) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await dbClient.switchHousehold(id);
      setSuccess('Switched household!');
      await fetchHouseholds();
      onRefresh();
    } catch (err) {
      setError('Failed to switch household: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRename = (h) => {
    setRenamingHousehold(h);
    setRenameValue(h.name);
    setRenameDialogOpen(true);
  };

  const handleConfirmRename = async () => {
    if (!renamingHousehold || !renameValue.trim()) return;
    setLoading(true);
    try {
      await dbClient.renameHousehold(renamingHousehold.id, renameValue.trim());
      setRenameDialogOpen(false);
      setSuccess(`Renamed to "${renameValue.trim()}"`);
      await fetchHouseholds();
      onRefresh();
    } catch (err) {
      setError('Failed to rename household: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHousehold = async (h) => {
    const isOwner = h.role === 'owner';
    const msg = isOwner 
      ? `Are you sure you want to permanently delete household "${h.name}" and all its items?`
      : `Are you sure you want to leave household "${h.name}"?`;

    if (!window.confirm(msg)) return;

    setLoading(true);
    setError('');
    try {
      await dbClient.deleteOrLeaveHousehold(h.id);
      setSuccess(isOwner ? `Deleted household "${h.name}"` : `Left household "${h.name}"`);
      await fetchHouseholds();
      onRefresh();
    } catch (err) {
      setError('Failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Per-Household Invitation Handlers ──────────────────────────────────

  const handleSendInvite = async (e) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await dbClient.inviteToHouseholdByEmail(email, activeHousehold.id, activeHousehold.name);
      setSuccess(`Invitation to "${activeHousehold.name}" sent to ${email}!`);
      setInviteSuccessLink(res.joinUrl);
      setInviteEmail('');
      fetchInvites();
    } catch (err) {
      setError(err.message || 'Failed to send invitation.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvite = async (inviteId) => {
    setLoading(true);
    setError('');
    try {
      await dbClient.cancelInvite(inviteId);
      setSuccess('Invitation cancelled.');
      fetchInvites();
    } catch (err) {
      setError('Failed to cancel invite: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async (invite) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await dbClient.acceptInvite(invite.id, invite.householdId, invite.householdName);
      setSuccess(`Successfully joined "${invite.householdName || 'household'}"!`);
      await fetchHouseholds();
      onRefresh();
      fetchMembers();
      fetchInvites();
    } catch (err) {
      setError('Failed to accept invitation: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectInvite = async (inviteId) => {
    setLoading(true);
    setError('');
    try {
      await dbClient.rejectInvite(inviteId);
      setSuccess('Invitation declined.');
      fetchInvites();
    } catch (err) {
      setError('Failed to decline invitation: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationSubscribe = async () => {
    setError('');
    setSuccess('');

    if (!notificationSupport) return;

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Notification permission denied.');
        return;
      }

      setLoading(true);
      const registration = await navigator.serviceWorker.register('./sw.js');
      await navigator.serviceWorker.ready;

      const publicKey = getVapidPublicKey();
      if (!publicKey) {
        throw new Error('VAPID Public Key not configured. Set VITE_VAPID_PUBLIC_KEY in your .env file.');
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      const subscriptionJson = JSON.parse(JSON.stringify(subscription));

      await dbClient.updateDb((db) => {
        if (!db.pushSubscriptions) db.pushSubscriptions = [];
        db.pushSubscriptions = db.pushSubscriptions.filter(s => s.endpoint !== subscriptionJson.endpoint);
        db.pushSubscriptions.push(subscriptionJson);
        return db;
      });

      setIsSubscribed(true);
      setSuccess('Subscribed to push notifications successfully!');
      onRefresh();
    } catch (err) {
      console.error('Subscription error:', err);
      setError('Failed to register for push notifications. Ensure HTTPS or localhost and correct VAPID configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationUnsubscribe = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await dbClient.updateDb((db) => {
          if (db.pushSubscriptions) {
            db.pushSubscriptions = db.pushSubscriptions.filter(s => s.endpoint !== subscription.endpoint);
          }
          return db;
        });
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
      setSuccess('Unsubscribed from notifications.');
      onRefresh();
    } catch (err) {
      console.error('Unsubscribe error:', err);
      setError('Failed to unsubscribe from notifications.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestPush = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      setSuccess('Test notifications require a Firebase Cloud Function which is not currently deployed in this pure-client setup. Push will work if you deploy a backend sender.');
    } catch (err) {
      console.error(err);
      setError('Failed to dispatch test notification.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const projectId = dbClient.projectId || 'foodex-a9dee';
  const haToken = settings.haToken || 'YOUR_GENERATED_TOKEN';

  const haYaml = `sensor:
  - platform: rest
    name: FoodEx Active Items
    resource: https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/ha_tokens/${haToken}
    value_template: >
      {% if value_json.fields.products is defined %}
        {{ value_json.fields.products.arrayValue.values | selectattr('mapValue.fields.status.stringValue', 'eq', 'ACTIVE') | list | count }}
      {% else %}
        0
      {% endif %}
    json_attributes:
      - fields
    scan_interval: 300`;

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 4 }}>Settings</Typography>

      {/* Invitations For You Banner */}
      {myInvites.length > 0 && (
        <Paper sx={{ p: 3, mb: 4, bgcolor: 'primary.main', color: '#ffffff', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmailIcon /> You have an invitation to join a household!
          </Typography>
          {myInvites.map((inv) => (
            <Box key={inv.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, flexWrap: 'wrap', gap: 1, bgcolor: 'rgba(0,0,0,0.15)', p: 2, borderRadius: 1.5 }}>
              <Typography variant="body1">
                <strong>{inv.invitedByName}</strong> ({inv.invitedByEmail}) invited you to join <strong>"{inv.householdName || 'Shared Household'}"</strong>.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button 
                  variant="contained" 
                  color="success" 
                  startIcon={<AcceptIcon />} 
                  onClick={() => handleAcceptInvite(inv)}
                  disabled={loading}
                  sx={{ fontWeight: 'bold' }}
                >
                  Accept & Join
                </Button>
                <Button 
                  variant="outlined" 
                  sx={{ color: '#ffffff', borderColor: '#ffffff' }} 
                  startIcon={<RejectIcon />} 
                  onClick={() => handleRejectInvite(inv.id)}
                  disabled={loading}
                >
                  Decline
                </Button>
              </Box>
            </Box>
          ))}
        </Paper>
      )}

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

      <Grid container spacing={4}>
        {/* Left Column: Preferences & Home Assistant */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 3 }}>Preferences</Typography>
            
            <Box component="form" onSubmit={handleSaveSettings}>
              <TextField
                fullWidth
                type="number"
                label="Days to Alert Before Expiration"
                value={notificationDaysBefore}
                onChange={(e) => setNotificationDaysBefore(e.target.value)}
                sx={{ mb: 3 }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={emailAlertsEnabled}
                    onChange={(e) => setEmailAlertsEnabled(e.target.checked)}
                    color="primary"
                  />
                }
                label="Enable Email Expiration Alerts"
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                type="email"
                label="Alert Email Address"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                disabled={!emailAlertsEnabled}
                helperText="Emails will be sent daily via GitHub Actions SMTP mailer."
                sx={{ mb: 3 }}
              />

              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>Gemini AI Vision Key (Optional)</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Stored locally on this device. Enter your key (starts with AIzaSy...) for AI date vision, or leave blank to use the built-in local OCR engine.
              </Typography>
              <TextField
                fullWidth
                type="password"
                label="Gemini API Key"
                placeholder="AIzaSy..."
                value={localGeminiKey}
                onChange={(e) => setLocalGeminiKey(e.target.value)}
                helperText="Stored 100% privately on your device. Never uploaded to GitHub or public servers."
                sx={{ mb: 3 }}
              />

              <Divider sx={{ my: 3 }} />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <HAIcon color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Home Assistant Integration</Typography>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Home Assistant can query your food status securely via a private link token without complex OAuth authentication.
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={haEnabled}
                    onChange={(e) => setHaEnabled(e.target.checked)}
                    color="primary"
                  />
                }
                label="Enable Home Assistant Sync (Save to generate token)"
                sx={{ mb: 2 }}
              />

              {haEnabled && settings.haToken && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>YAML Sensor Configuration:</Typography>
                  
                  <Box sx={{ position: 'relative', bgcolor: '#272822', color: '#f8f8f2', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.75rem', overflowX: 'auto' }}>
                    <pre style={{ margin: 0 }}>{haYaml}</pre>
                    <IconButton 
                      size="small" 
                      sx={{ position: 'absolute', top: 8, right: 8, color: '#f8f8f2' }}
                      onClick={() => copyToClipboard(haYaml)}
                    >
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                    <strong>Security Note:</strong> Anyone with your unique token can read your inventory summary. To revoke access, disable this setting and save.
                  </Typography>
                </Box>
              )}

              <Box sx={{ mt: 3 }}>
                <Button 
                  type="submit" 
                  variant="contained" 
                  disabled={loading}
                  sx={{ py: 1 }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : 'Save Settings'}
                </Button>
              </Box>
            </Box>
          </Paper>

          {/* Storage Locations */}
          <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>Storage Locations</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Customize where you store food in <strong>"{activeHousehold.name}"</strong>.
            </Typography>

            <List dense sx={{ mb: 2 }}>
              {currentLocations.map((loc) => (
                <ListItem key={loc} divider>
                  <ListItemText primary={loc} />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" color="error" size="small" onClick={() => handleDeleteLocation(loc)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>

            <Box component="form" onSubmit={handleAddLocation} sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                label="New Location Name"
                placeholder="e.g. Spice Rack, Cellar"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
              />
              <Button type="submit" variant="outlined" startIcon={<AddIcon />} disabled={loading || !newLocationName.trim()}>
                Add
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Right Column: Multiple Households & Per-Household Sharing */}
        <Grid item xs={12} md={6}>
          {/* Your Households Manager */}
          <Paper sx={{ p: 3, mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <HomeIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Your Households</Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Manage multiple households (e.g. "Main Home", "Vacation Cabin", "Office") with independent inventories.
            </Typography>

            <List sx={{ bgcolor: 'action.hover', borderRadius: 2, mb: 3 }}>
              {userHouseholds.map((h) => {
                const isCurrent = h.id === activeHousehold.id;
                return (
                  <ListItem key={h.id} divider sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: isCurrent ? 'bold' : 'normal' }}>
                            {h.name}
                          </Typography>
                          {isCurrent && <Chip label="Active" color="primary" size="small" />}
                          <Chip label={h.role || 'owner'} variant="outlined" size="small" sx={{ textTransform: 'capitalize' }} />
                        </Box>
                        <Typography variant="caption" color="text.secondary">ID: {h.id}</Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {!isCurrent && (
                        <Button size="small" variant="contained" color="primary" onClick={() => handleSwitchHousehold(h.id)} disabled={loading}>
                          Switch
                        </Button>
                      )}
                      <IconButton size="small" color="inherit" onClick={() => handleOpenRename(h)} title="Rename Household">
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteHousehold(h)} title={h.role === 'owner' ? "Delete Household" : "Leave Household"}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </ListItem>
                );
              })}
            </List>

            {/* Create New Household Form */}
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Create New Household:</Typography>
            <Box component="form" onSubmit={handleCreateHousehold} sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                label="Household Name"
                placeholder="e.g. Beach Cabin, Office Pantry"
                value={newHouseholdName}
                onChange={(e) => setNewHouseholdName(e.target.value)}
              />
              <Button type="submit" variant="contained" startIcon={<AddIcon />} disabled={loading || !newHouseholdName.trim()}>
                Create
              </Button>
            </Box>
          </Paper>

          {/* Household Sharing for Active Household */}
          <Paper sx={{ p: 3, mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <GroupIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                Share "{activeHousehold.name}"
              </Typography>
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Invite family or roommates to share the inventory of <strong>"{activeHousehold.name}"</strong>.
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <TextField
                fullWidth
                size="small"
                label="Household ID"
                value={activeHousehold.id || ''}
                InputProps={{ readOnly: true }}
                helperText="Members can also join manually using this ID."
              />
              <IconButton 
                color="primary" 
                onClick={() => copyToClipboard(activeHousehold.id || '')}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1 }}
              >
                <CopyIcon />
              </IconButton>
            </Box>

            {/* Invite via Email for this Household */}
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Invite Member via Email:</Typography>
            <Box component="form" onSubmit={handleSendInvite} sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                type="email"
                label="Member Email"
                placeholder="roommate@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Button 
                type="submit" 
                variant="contained" 
                color="primary"
                startIcon={<SendIcon />}
                disabled={loading || !inviteEmail.trim()}
              >
                Invite
              </Button>
            </Box>

            {inviteSuccessLink && (
              <Alert 
                severity="info" 
                sx={{ mb: 2 }}
                action={
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Button size="small" color="inherit" onClick={() => copyToClipboard(inviteSuccessLink)}>
                      Copy Link
                    </Button>
                    <Button 
                      size="small" 
                      color="inherit" 
                      href={`mailto:?subject=${encodeURIComponent(`Join my FoodEx household: ${activeHousehold.name}`)}&body=${encodeURIComponent(`Join our "${activeHousehold.name}" FoodEx household to share our food inventory:\n\n` + inviteSuccessLink)}`}
                    >
                      Email
                    </Button>
                  </Box>
                }
              >
                Invitation link created for {activeHousehold.name}!
              </Alert>
            )}

            {/* Sent Pending Invites */}
            {sentInvites.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', display: 'block', mb: 0.5 }}>
                  Pending Invitations for {activeHousehold.name}:
                </Typography>
                <List dense sx={{ bgcolor: 'action.hover', borderRadius: 1 }}>
                  {sentInvites.map((inv) => (
                    <ListItem key={inv.id}>
                      <ListItemText 
                        primary={inv.invitedEmail} 
                        secondary={`Invited on ${new Date(inv.createdAt).toLocaleDateString()}`} 
                      />
                      <ListItemSecondaryAction>
                        <IconButton size="small" color="error" onClick={() => handleCancelInvite(inv.id)} title="Cancel Invite">
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}

            {/* Household Members */}
            {members.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Active Members:</Typography>
                <List dense sx={{ bgcolor: 'action.hover', borderRadius: 2 }}>
                  {members.map((m) => (
                    <ListItem key={m.uid}>
                      <ListItemText 
                        primary={m.displayName || 'Unnamed User'} 
                        secondary={m.email || 'No email provided'} 
                      />
                      {m.uid === dbClient.uid && (
                        <ListItemSecondaryAction>
                          <Typography variant="caption" color="text.secondary">(You)</Typography>
                        </ListItemSecondaryAction>
                      )}
                    </ListItem>
                  ))}
                </List>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onClose={() => setRenameDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Rename Household</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Household Name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRenameDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleConfirmRename} disabled={!renameValue.trim()}>
            Rename
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

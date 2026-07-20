import React, { useState, useEffect } from 'react';
import { 
  Box, Typography, Paper, TextField, Button, Grid, 
  CircularProgress, Alert, Divider, FormControlLabel, Switch, IconButton,
  List, ListItem, ListItemText, ListItemSecondaryAction
} from '@mui/material';
import { 
  Notifications as PushIcon, SettingsInputSvideo as HAIcon,
  ContentCopy as CopyIcon, Refresh as RefreshIcon,
  Delete as DeleteIcon, Group as GroupIcon, Add as AddIcon,
  MeetingRoom as LeaveIcon
} from '@mui/icons-material';
import dbClient from '../utils/dbClient';

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

export default function Settings({ settings, pushSubscriptions, onRefresh }) {
  const [notificationDaysBefore, setNotificationDaysBefore] = useState(settings.notificationDaysBefore || 3);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(settings.emailAlertsEnabled || false);
  const [emailAddress, setEmailAddress] = useState(settings.emailAddress || '');
  const [haEnabled, setHaEnabled] = useState(!!settings.haToken);

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [notificationSupport, setNotificationSupport] = useState(true);

  // Household sharing state
  const [members, setMembers] = useState([]);
  const [targetHouseholdId, setTargetHouseholdId] = useState('');
  
  // Custom locations state
  const [newLocationName, setNewLocationName] = useState('');
  const currentLocations = settings.locations || ['Fridge', 'Freezer'];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Check if browser is currently subscribed
  useEffect(() => {
    checkPushSupport();
    fetchMembers();
  }, [pushSubscriptions]);

  const fetchMembers = async () => {
    try {
      const list = await dbClient.getHouseholdMembers();
      setMembers(list);
    } catch (err) {
      console.error('Error fetching household members:', err);
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
      setSuccess('Settings updated successfully!');
      onRefresh();
    } catch (err) {
      console.error(err);
      setError('Failed to save settings: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Custom Locations Operations
  const handleAddLocation = async (e) => {
    e.preventDefault();
    const name = newLocationName.trim();
    if (!name) return;

    if (currentLocations.some(l => l.toLowerCase() === name.toLowerCase())) {
      setError('Location already exists.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await dbClient.updateDb((db) => {
        if (!db.settings.locations) db.settings.locations = ['Fridge', 'Freezer'];
        db.settings.locations.push(name);
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

    if (!window.confirm(`Are you sure you want to delete "${locationToDelete}"? Items currently stored in this location will remain, but the location itself will be removed from filters.`)) {
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

  // Household Operations
  const handleJoinHousehold = async (e) => {
    e.preventDefault();
    const targetId = targetHouseholdId.trim();
    if (!targetId) return;

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await dbClient.joinHousehold(targetId);
      setSuccess('Successfully joined new household!');
      setTargetHouseholdId('');
      onRefresh();
      fetchMembers();
    } catch (err) {
      setError(err.message || 'Failed to join household.');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveHousehold = async () => {
    if (!window.confirm('Are you sure you want to leave this household? You will return to your default isolated private household inventory.')) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await dbClient.leaveHousehold();
      setSuccess('Returned to private household!');
      onRefresh();
      fetchMembers();
    } catch (err) {
      setError('Failed to leave household: ' + err.message);
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

      const publicKey = settings.vapidPublicKey;
      if (!publicKey) {
        throw new Error('VAPID Public Key not found in settings database.');
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

  const isSharedHousehold = dbClient.householdId && dbClient.householdId !== dbClient.uid;

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 4 }}>Settings</Typography>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3 }}>{success}</Alert>}

      <Grid container spacing={4}>
        {/* Left Column: Preferences, Push */}
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

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <HAIcon color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>Home Assistant Integration</Typography>
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Home Assistant can query your food status securely. By enabling this integration, an unguessable private link token is generated so Home Assistant can read your data without needing to handle complex OAuth authentication.
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={haEnabled}
                    onChange={(e) => setHaEnabled(e.target.checked)}
                    color="primary"
                  />
                }
                label="Enable Home Assistant Sync (Save Settings to generate token)"
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

          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <PushIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Push Notifications</Typography>
            </Box>

            {!notificationSupport ? (
              <Alert severity="warning">
                Browser Push notifications are not supported in this browser. Ensure you are visiting via HTTPS (or localhost) and using a modern browser.
              </Alert>
            ) : (
              <Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Subscribe to receive daily push notifications on this device when items in your inventory are close to expiring.
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {isSubscribed ? (
                    <>
                      <Button variant="outlined" color="error" onClick={handleNotificationUnsubscribe} disabled={loading}>
                        Unsubscribe
                      </Button>
                      <Button variant="contained" onClick={handleSendTestPush} disabled={loading}>
                        Trigger Test Alert
                      </Button>
                    </>
                  ) : (
                    <Button variant="contained" color="primary" onClick={handleNotificationSubscribe} disabled={loading}>
                      Subscribe This Device
                    </Button>
                  )}
                </Box>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Right Column: Household Sharing, Locations, Home Assistant */}
        <Grid item xs={12} md={6}>
          {/* Household Sharing Card */}
          <Paper sx={{ p: 3, mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <GroupIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Household Sharing</Typography>
            </Box>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Share your inventory with other members of your household. Share your Household ID with them, or join an existing household.
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <TextField
                fullWidth
                label="Your Household ID"
                value={dbClient.householdId || ''}
                InputProps={{ readOnly: true }}
                helperText="Copy and send this ID to invite others to your household."
              />
              <IconButton 
                color="primary" 
                onClick={() => copyToClipboard(dbClient.householdId || '')}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1.5 }}
              >
                <CopyIcon />
              </IconButton>
            </Box>

            {members.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>Household Members:</Typography>
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

            <Box component="form" onSubmit={handleJoinHousehold} sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <TextField
                fullWidth
                label="Join Household ID"
                placeholder="Paste Household ID here"
                value={targetHouseholdId}
                onChange={(e) => setTargetHouseholdId(e.target.value)}
              />
              <Button type="submit" variant="contained" disabled={loading || !targetHouseholdId.trim()}>
                Join
              </Button>
            </Box>

            {isSharedHousehold && (
              <Button 
                variant="outlined" 
                color="error" 
                startIcon={<LeaveIcon />} 
                onClick={handleLeaveHousehold}
                disabled={loading}
                fullWidth
              >
                Leave Shared Household
              </Button>
            )}
          </Paper>

          {/* Dynamic Locations Card */}
          <Paper sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>Storage Locations</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Customize where you store food in your household.
            </Typography>

            <List dense sx={{ mb: 2 }}>
              {currentLocations.map((loc) => (
                <ListItem key={loc} divider>
                  <ListItemText primary={loc} />
                  <ListItemSecondaryAction>
                    <IconButton 
                      edge="end" 
                      color="error" 
                      onClick={() => handleDeleteLocation(loc)}
                      disabled={currentLocations.length <= 1 || loading}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>

            <Box component="form" onSubmit={handleAddLocation} sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                label="New Location Name"
                value={newLocationName}
                onChange={(e) => setNewLocationName(e.target.value)}
                placeholder="e.g. Wine Cellar"
              />
              <Button type="submit" variant="contained" startIcon={<AddIcon />} disabled={loading || !newLocationName.trim()}>
                Add
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

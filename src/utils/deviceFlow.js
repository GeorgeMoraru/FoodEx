// GitHub Device Authorization Flow
// Docs: https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow

const CLIENT_ID = 'Ov23liHvTmXFCI13Zlte';
const SCOPE = 'repo';

const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';

/**
 * Step 1: Request a device code from GitHub.
 * Returns { device_code, user_code, verification_uri, expires_in, interval }
 */
export async function requestDeviceCode() {
  const res = await fetch(DEVICE_CODE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ client_id: CLIENT_ID, scope: SCOPE }),
  });

  if (!res.ok) {
    throw new Error(`GitHub returned ${res.status} when requesting device code.`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(data.error_description || data.error);
  }

  return data; // { device_code, user_code, verification_uri, expires_in, interval }
}

/**
 * Step 2: Poll GitHub until the user approves the device on github.com/login/device.
 * Calls onPoll() each time it polls (optional, for UI feedback).
 * Resolves with the access_token string.
 * Rejects if expired or another error occurs.
 */
export async function pollForToken(deviceCode, intervalSecs = 5, onPoll = null) {
  const pollInterval = Math.max(intervalSecs, 5) * 1000;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (onPoll) onPoll();

      try {
        const res = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            client_id: CLIENT_ID,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }),
        });

        const data = await res.json();

        if (data.access_token) {
          resolve(data.access_token);
          return;
        }

        switch (data.error) {
          case 'authorization_pending':
            // User hasn't approved yet — keep polling
            setTimeout(poll, pollInterval);
            break;
          case 'slow_down':
            // GitHub asked us to slow down
            setTimeout(poll, pollInterval + 5000);
            break;
          case 'expired_token':
            reject(new Error('The login code expired. Please try again.'));
            break;
          case 'access_denied':
            reject(new Error('Access was denied. Please try again.'));
            break;
          default:
            reject(new Error(data.error_description || data.error || 'Unknown error during authentication.'));
        }
      } catch (err) {
        reject(err);
      }
    };

    // Start first poll after the interval
    setTimeout(poll, pollInterval);
  });
}

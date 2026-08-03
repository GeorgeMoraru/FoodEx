/**
 * VAPID public key accessor.
 * 
 * The VAPID key pair is generated once using: node scripts/generate-vapid-keys.js
 * - Public key: stored in VITE_VAPID_PUBLIC_KEY env var (safe for client)
 * - Private key: stored ONLY in GitHub Secrets (never in client code)
 */

/** Returns the VAPID public key for push subscription */
export function getVapidPublicKey() {
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!key) {
    throw new Error(
      'VITE_VAPID_PUBLIC_KEY is not set. Run `node scripts/generate-vapid-keys.js` ' +
      'and add the public key to your .env file.'
    );
  }
  return key;
}

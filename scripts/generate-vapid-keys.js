#!/usr/bin/env node
/**
 * One-time VAPID key pair generator for FoodEx push notifications.
 * 
 * Usage:
 *   node scripts/generate-vapid-keys.js
 * 
 * After running, add the output values to your GitHub repository secrets:
 *   - VAPID_PUBLIC_KEY
 *   - VAPID_PRIVATE_KEY
 * 
 * Also set VITE_VAPID_PUBLIC_KEY in your .env file (public key only).
 */
import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('=== VAPID Keys Generated ===');
console.log('');
console.log('PUBLIC KEY (safe to embed in client code and .env):');
console.log(vapidKeys.publicKey);
console.log('');
console.log('PRIVATE KEY (store ONLY in GitHub Secrets, NEVER in client code):');
console.log(vapidKeys.privateKey);
console.log('');
console.log('=== Setup Instructions ===');
console.log('1. Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to GitHub repo secrets.');
console.log('2. Set VITE_VAPID_PUBLIC_KEY=<public key> in your .env file.');
console.log('3. Redeploy the app and notification workflow.');

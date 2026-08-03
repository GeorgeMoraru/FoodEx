import admin from 'firebase-admin';
import webpush from 'web-push';
import nodemailer from 'nodemailer';

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  IS_TEST,
  TEST_MESSAGE,
  FIREBASE_SERVICE_ACCOUNT,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
} = process.env;

/** Escape HTML special characters to prevent XSS in email templates */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function main() {
  if (!FIREBASE_SERVICE_ACCOUNT) {
    console.error('FIREBASE_SERVICE_ACCOUNT secret is missing. Exiting.');
    return;
  }

  const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  }

  const db = admin.firestore();
  
  // Read from the households collection (where products/settings actually live)
  const householdsSnapshot = await db.collection('households').get();

  if (householdsSnapshot.empty) {
    console.log('No households found in database.');
    return;
  }

  const isTestRun = IS_TEST === 'true';

  // Configure VAPID from environment variables (not from Firestore)
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:admin@foodex.local',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
  } else {
    console.warn('VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY not set. Push notifications will be skipped.');
  }

  for (const doc of householdsSnapshot.docs) {
    const householdData = doc.data();
    const products = householdData.products || [];
    const subscriptions = householdData.pushSubscriptions || [];
    const settings = householdData.settings || {};

    let emailBody = '';
    let alertTitle = 'FoodEx Alert';
    let alertBody = '';

    if (isTestRun) {
      console.log(`Running in TEST mode for household ${doc.id}.`);
      alertTitle = 'FoodEx Test Alert';
      alertBody = TEST_MESSAGE || 'This is a test push notification from FoodEx!';
      emailBody = `<h2>FoodEx Test Email</h2><p>${escapeHtml(alertBody)}</p>`;
    } else {
      // Daily expiration check
      const daysBefore = parseInt(settings.notificationDaysBefore) || 3;
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const warningLimit = new Date(todayStart.getTime() + daysBefore * 24 * 60 * 60 * 1000);

      const expiredItems = [];
      const expiringSoonItems = [];

      products.forEach(p => {
        const status = p.status || 'ACTIVE';
        if (status !== 'ACTIVE') return;
        if (!p.expirationDate) return;
        
        const expDate = new Date(p.expirationDate);
        const expDateStart = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());

        if (expDateStart < todayStart) {
          expiredItems.push(p);
        } else if (expDateStart <= warningLimit) {
          expiringSoonItems.push(p);
        }
      });

      if (expiredItems.length === 0 && expiringSoonItems.length === 0) {
        console.log(`No expiring or expired food items found for household ${doc.id}.`);
        continue;
      }

      alertTitle = 'Food Expiration Alert \uD83C\uDF4E';
      const expiredNames = expiredItems.map(i => i.name).join(', ');
      const expiringNames = expiringSoonItems.map(i => i.name).join(', ');

      if (expiredItems.length > 0 && expiringSoonItems.length > 0) {
        alertBody = `Expired: ${expiredNames}. Expiring soon: ${expiringNames}.`;
      } else if (expiredItems.length > 0) {
        alertBody = `Expired: ${expiredNames}.`;
      } else {
        alertBody = `Expiring soon: ${expiringNames}.`;
      }

      // Build detailed HTML email body with sanitized values
      emailBody = `
        <h2>FoodEx Inventory Alert \uD83C\uDF4E</h2>
        <p>Here is your daily food expiration digest:</p>
      `;

      if (expiredItems.length > 0) {
        emailBody += `
          <h3 style="color: #d32f2f;">\u274C Expired Items</h3>
          <ul>
            ${expiredItems.map(i => `<li><strong>${escapeHtml(i.name)}</strong> - Expired on ${new Date(i.expirationDate).toLocaleDateString()} (${escapeHtml(String(i.quantity))} ${escapeHtml(i.unit)})</li>`).join('')}
          </ul>
        `;
      }

      if (expiringSoonItems.length > 0) {
        emailBody += `
          <h3 style="color: #f57c00;">\u26A0\uFE0F Expiring Soon (Next ${daysBefore} days)</h3>
          <ul>
            ${expiringSoonItems.map(i => `<li><strong>${escapeHtml(i.name)}</strong> - Expires on ${new Date(i.expirationDate).toLocaleDateString()} (${escapeHtml(String(i.quantity))} ${escapeHtml(i.unit)})</li>`).join('')}
          </ul>
        `;
      }

      emailBody += `<p>Manage your food catalog directly on your FoodEx deployment.</p>`;
    }

    // 1. Send Push Notifications (using env-based VAPID keys)
    if (subscriptions.length > 0 && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
      console.log(`Sending web push to ${subscriptions.length} subscription(s) for household ${doc.id}...`);
      const pushPromises = subscriptions.map(sub => {
        const payload = JSON.stringify({
          title: alertTitle,
          body: alertBody,
          data: {
            url: '/#inventory'
          }
        });
        return webpush.sendNotification(sub, payload).catch(err => {
          console.error(`Failed to send push to subscription for household ${doc.id}:`, sub.endpoint, err.message);
        });
      });
      await Promise.all(pushPromises);
    }

    // 2. Send Email Alerts
    if (settings.emailAlertsEnabled && settings.emailAddress && SMTP_HOST) {
      console.log(`Sending email alert to ${settings.emailAddress}...`);
      try {
        const transporter = nodemailer.createTransport({
          host: SMTP_HOST,
          port: parseInt(SMTP_PORT) || 587,
          secure: parseInt(SMTP_PORT) === 465,
          auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
          }
        });

        await transporter.sendMail({
          from: SMTP_FROM || SMTP_USER,
          to: settings.emailAddress,
          subject: alertTitle,
          html: emailBody
        });
        console.log(`Email sent successfully for household ${doc.id}!`);
      } catch (err) {
        console.error(`Failed to send email alert for household ${doc.id}:`, err);
      }
    }
  }
}

main().catch(console.error);

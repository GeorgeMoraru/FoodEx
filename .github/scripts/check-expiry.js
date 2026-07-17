import fs from 'fs';
import path from 'path';
import webpush from 'web-push';
import nodemailer from 'nodemailer';

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  IS_TEST,
  TEST_MESSAGE
} = process.env;

async function main() {
  const dbPath = path.join(process.cwd(), 'db.json');
  if (!fs.existsSync(dbPath)) {
    console.error('db.json not found. Exiting.');
    return;
  }

  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  const products = db.products || [];
  const subscriptions = db.pushSubscriptions || [];
  const settings = db.settings || {};

  const isTestRun = IS_TEST === 'true';
  let emailBody = '';
  let alertTitle = 'FoodEx Alert';
  let alertBody = '';

  if (isTestRun) {
    console.log('Running in TEST mode.');
    alertTitle = 'FoodEx Test Alert';
    alertBody = TEST_MESSAGE || 'This is a test push notification from FoodEx!';
    emailBody = `<h2>FoodEx Test Email</h2><p>${alertBody}</p>`;
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
      
      const expDate = new Date(p.expirationDate);
      const expDateStart = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());

      if (expDateStart < todayStart) {
        expiredItems.push(p);
      } else if (expDateStart <= warningLimit) {
        expiringSoonItems.push(p);
      }
    });

    if (expiredItems.length === 0 && expiringSoonItems.length === 0) {
      console.log('No expiring or expired food items found today.');
      return;
    }

    alertTitle = 'Food Expiration Alert 🍎';
    const expiredNames = expiredItems.map(i => i.name).join(', ');
    const expiringNames = expiringSoonItems.map(i => i.name).join(', ');

    if (expiredItems.length > 0 && expiringSoonItems.length > 0) {
      alertBody = `Expired: ${expiredNames}. Expiring soon: ${expiringNames}.`;
    } else if (expiredItems.length > 0) {
      alertBody = `Expired: ${expiredNames}.`;
    } else {
      alertBody = `Expiring soon: ${expiringNames}.`;
    }

    // Build detailed HTML email body
    emailBody = `
      <h2>FoodEx Inventory Alert 🍎</h2>
      <p>Here is your daily food expiration digest:</p>
    `;

    if (expiredItems.length > 0) {
      emailBody += `
        <h3 style="color: #d32f2f;">❌ Expired Items</h3>
        <ul>
          ${expiredItems.map(i => `<li><strong>${i.name}</strong> - Expired on ${new Date(i.expirationDate).toLocaleDateString()} (${i.quantity} ${i.unit})</li>`).join('')}
        </ul>
      `;
    }

    if (expiringSoonItems.length > 0) {
      emailBody += `
        <h3 style="color: #f57c00;">⚠️ Expiring Soon (Next ${daysBefore} days)</h3>
        <ul>
          ${expiringSoonItems.map(i => `<li><strong>${i.name}</strong> - Expires on ${new Date(i.expirationDate).toLocaleDateString()} (${i.quantity} ${i.unit})</li>`).join('')}
        </ul>
      `;
    }

    emailBody += `<p>Manage your food catalog directly on your FoodEx deployment.</p>`;
  }

  // 1. Send Push Notifications
  if (subscriptions.length > 0 && settings.vapidPublicKey && settings.vapidPrivateKey) {
    webpush.setVapidDetails(
      'mailto:admin@foodex.local',
      settings.vapidPublicKey,
      settings.vapidPrivateKey
    );

    console.log(`Sending web push to ${subscriptions.length} subscription(s)...`);
    const pushPromises = subscriptions.map(sub => {
      const payload = JSON.stringify({
        title: alertTitle,
        body: alertBody,
        data: {
          url: '/#inventory'
        }
      });
      return webpush.sendNotification(sub, payload).catch(err => {
        console.error('Failed to send push to subscription:', sub.endpoint, err.message);
      });
    });
    await Promise.all(pushPromises);
  } else {
    console.log('No active push subscriptions or VAPID credentials configured.');
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
      console.log('Email sent successfully!');
    } catch (err) {
      console.error('Failed to send email alert:', err);
    }
  } else {
    console.log('Email alerts disabled or SMTP host not configured in repository secrets.');
  }
}

main().catch(console.error);

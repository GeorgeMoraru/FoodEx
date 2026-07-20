import { auth, db as firestore } from './firebase';
import { doc, getDoc, setDoc, runTransaction } from 'firebase/firestore';
import { generateVapidKeys } from './vapid';

class DbClient {
  constructor() {}

  get uid() {
    return auth.currentUser ? auth.currentUser.uid : null;
  }

  get userRef() {
    if (!this.uid) throw new Error('Not authenticated');
    return doc(firestore, 'users', this.uid);
  }

  // ─── Authentication state (mostly handled by Firebase now) ───────────────
  
  clearCredentials() {
    auth.signOut();
  }

  isAuthenticated() {
    return !!this.uid;
  }

  // ─── Repository management (No-ops for Firebase) ────────────────────────

  async checkRepository() {
    return true; // Always "exists" in Firebase
  }

  async createRepository() {
    return true;
  }

  // ─── Database ──────────────────────────────────────────────────────────

  async getDbFile() {
    const docSnap = await getDoc(this.userRef);
    if (docSnap.exists()) {
      return { db: docSnap.data(), sha: 'firestore' };
    }
    return null;
  }

  async saveDbFile(db, sha) {
    await setDoc(this.userRef, db);
    return 'firestore';
  }

  async initializeDbIfMissing() {
    const fileData = await this.getDbFile();
    if (fileData) {
      let db = fileData.db;
      let updated = false;

      if (!db.settings) { db.settings = {}; updated = true; }
      if (!db.settings.vapidPublicKey || !db.settings.vapidPrivateKey) {
        const keys = await generateVapidKeys();
        db.settings.vapidPublicKey = keys.publicKey;
        db.settings.vapidPrivateKey = keys.privateKey;
        updated = true;
      }
      if (!db.products) { db.products = []; updated = true; }
      if (!db.pushSubscriptions) { db.pushSubscriptions = []; updated = true; }

      if (updated) await this.saveDbFile(db, null);
      return;
    }

    // Fresh database
    const keys = await generateVapidKeys();
    const initialDb = {
      products: [],
      pushSubscriptions: [],
      settings: {
        notificationDaysBefore: 3,
        emailAlertsEnabled: false,
        emailAddress: '',
        vapidPublicKey: keys.publicKey,
        vapidPrivateKey: keys.privateKey,
      },
    };
    await this.saveDbFile(initialDb, null);
  }

  /** Transactional update to prevent concurrent overwrites */
  async updateDb(updateFn) {
    if (!this.uid) throw new Error('Not authenticated');
    await runTransaction(firestore, async (transaction) => {
      const docSnap = await transaction.get(this.userRef);
      let db = { products: [], pushSubscriptions: [], settings: {} };
      if (docSnap.exists()) {
        db = docSnap.data();
      }

      if (!db.products) db.products = [];
      if (!db.pushSubscriptions) db.pushSubscriptions = [];
      if (!db.settings) db.settings = {};

      const updatedDb = updateFn(db);
      transaction.set(this.userRef, updatedDb);
      
      // Mirror to Home Assistant token document if enabled
      if (updatedDb.settings && updatedDb.settings.haToken) {
        const haRef = doc(firestore, 'ha_tokens', updatedDb.settings.haToken);
        // Only mirror the products and basic settings to keep HA fast and secure
        transaction.set(haRef, {
          products: updatedDb.products,
          settings: {
            notificationDaysBefore: updatedDb.settings.notificationDaysBefore
          }
        });
      }
    });
    return { db: null, sha: 'firestore' };
  }

  // ─── Images (Replaced by Wikipedia URLs) ─────────────────────────────────

  async uploadImage(base64ImageString) {
    throw new Error('uploadImage is deprecated. Images are now automatically fetched.');
  }

  async deleteImage(path) {
    // No-op for external URLs
    return true;
  }
}

export const dbClient = new DbClient();
export default dbClient;

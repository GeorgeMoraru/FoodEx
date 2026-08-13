import { auth, db as firestore, firebaseConfig } from './firebase';
import { doc, getDoc, setDoc, runTransaction, collection, query, where, getDocs } from 'firebase/firestore';

class DbClient {
  constructor() {
    this.cachedHouseholdId = null;
  }

  get isGuest() {
    return localStorage.getItem('foodex_guest_mode') === 'true';
  }

  get uid() {
    if (this.isGuest) return 'guest-user';
    return auth.currentUser ? auth.currentUser.uid : null;
  }

  get projectId() {
    return firebaseConfig.projectId;
  }

  get userRef() {
    if (!this.uid) throw new Error('Not authenticated');
    return doc(firestore, 'users', this.uid);
  }

  get householdId() {
    return this.cachedHouseholdId || (this.isGuest ? 'guest-household' : null);
  }

  // ─── Authentication state (mostly handled by Firebase now) ───────────────
  
  clearCredentials() {
    localStorage.removeItem('foodex_guest_mode');
    auth.signOut().catch(() => {});
    this.cachedHouseholdId = null;
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
    if (!this.uid) throw new Error('Not authenticated');

    if (this.isGuest) {
      const local = localStorage.getItem('foodex_guest_db');
      if (local) {
        try {
          return { db: JSON.parse(local), sha: 'local' };
        } catch (e) {}
      }
      const initial = {
        products: [
          { id: '1', name: 'Fresh Milk 1L', location: 'Fridge', expirationDate: new Date(Date.now() + 86400000 * 3).toISOString().substring(0, 10), quantity: 1, open: false },
          { id: '2', name: 'Organic Eggs', location: 'Fridge', expirationDate: new Date(Date.now() + 86400000 * 10).toISOString().substring(0, 10), quantity: 12, open: false },
          { id: '3', name: 'Greek Yogurt', location: 'Fridge', expirationDate: new Date(Date.now() + 86400000 * 1).toISOString().substring(0, 10), quantity: 2, open: true },
          { id: '4', name: 'Artisan Bread', location: 'Pantry', expirationDate: new Date(Date.now() - 86400000 * 1).toISOString().substring(0, 10), quantity: 1, open: true }
        ],
        pushSubscriptions: [],
        settings: {
          notificationDaysBefore: 3,
          emailAlertsEnabled: false,
          emailAddress: '',
          locations: ['Fridge', 'Freezer', 'Pantry']
        }
      };
      localStorage.setItem('foodex_guest_db', JSON.stringify(initial));
      return { db: initial, sha: 'local' };
    }
    
    // 1. Fetch user document to find householdId
    const userDocRef = this.userRef;
    const userSnap = await getDoc(userDocRef);
    let householdId = this.uid;
    
    if (!userSnap.exists()) {
      // First-time user, initialize user profile mapping
      await setDoc(userDocRef, {
        householdId: this.uid,
        email: auth.currentUser.email || '',
        displayName: auth.currentUser.displayName || ''
      });
    } else {
      householdId = userSnap.data().householdId || this.uid;
    }
    
    this.cachedHouseholdId = householdId;
    
    // 2. Fetch the household database document
    const houseDocRef = doc(firestore, 'households', householdId);
    const houseSnap = await getDoc(houseDocRef);
    
    if (houseSnap.exists()) {
      return { db: houseSnap.data(), sha: 'firestore' };
    }
    return null;
  }

  async saveDbFile(db, sha) {
    if (!this.cachedHouseholdId) {
      await this.getDbFile();
    }
    const houseDocRef = doc(firestore, 'households', this.cachedHouseholdId);
    await setDoc(houseDocRef, db);
    return 'firestore';
  }

  async initializeDbIfMissing() {
    const fileData = await this.getDbFile();
    if (fileData) {
      let db = fileData.db;
      let updated = false;

      if (!db.settings) { db.settings = {}; updated = true; }
      if (!db.settings.locations) { db.settings.locations = ['Fridge', 'Freezer']; updated = true; }
      if (!db.products) { db.products = []; updated = true; }
      if (!db.pushSubscriptions) { db.pushSubscriptions = []; updated = true; }

      if (updated) {
        const houseDocRef = doc(firestore, 'households', this.cachedHouseholdId);
        await setDoc(houseDocRef, db);
      }
      return;
    }

    // Fresh database
    const initialDb = {
      products: [],
      pushSubscriptions: [],
      settings: {
        notificationDaysBefore: 3,
        emailAlertsEnabled: false,
        emailAddress: '',
        locations: ['Fridge', 'Freezer'],
      },
    };
    const houseDocRef = doc(firestore, 'households', this.cachedHouseholdId);
    await setDoc(houseDocRef, initialDb);
  }

  /** Transactional update to prevent concurrent overwrites */
  async updateDb(updateFn) {
    if (!this.uid) throw new Error('Not authenticated');

    if (this.isGuest) {
      const fileData = await this.getDbFile();
      const currentDb = fileData?.db || { products: [], pushSubscriptions: [], settings: { locations: ['Fridge', 'Freezer', 'Pantry'] } };
      const updatedDb = updateFn(currentDb);
      localStorage.setItem('foodex_guest_db', JSON.stringify(updatedDb));
      return { db: updatedDb, sha: 'local' };
    }

    if (!this.cachedHouseholdId) {
      await this.getDbFile();
    }
    const houseDocRef = doc(firestore, 'households', this.cachedHouseholdId);
    
    await runTransaction(firestore, async (transaction) => {
      const docSnap = await transaction.get(houseDocRef);
      let db = { products: [], pushSubscriptions: [], settings: {} };
      if (docSnap.exists()) {
        db = docSnap.data();
      }

      if (!db.products) db.products = [];
      if (!db.pushSubscriptions) db.pushSubscriptions = [];
      if (!db.settings) db.settings = {};
      if (!db.settings.locations) db.settings.locations = ['Fridge', 'Freezer'];

      const updatedDb = updateFn(db);
      transaction.set(houseDocRef, updatedDb);
      
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

  // ─── Household Sharing Operations ────────────────────────────────────────

  async joinHousehold(targetHouseholdId) {
    if (!this.uid) throw new Error('Not authenticated');
    
    // Verify target household exists
    const houseDocRef = doc(firestore, 'households', targetHouseholdId);
    const houseSnap = await getDoc(houseDocRef);
    if (!houseSnap.exists()) {
      throw new Error('Household ID does not exist.');
    }
    
    // Update user profile
    const userDocRef = this.userRef;
    await setDoc(userDocRef, {
      householdId: targetHouseholdId
    }, { merge: true });
    
    this.cachedHouseholdId = targetHouseholdId;
  }

  async leaveHousehold() {
    if (!this.uid) throw new Error('Not authenticated');
    
    // Reset user profile mapping to their own UID
    const userDocRef = this.userRef;
    await setDoc(userDocRef, {
      householdId: this.uid
    }, { merge: true });
    
    this.cachedHouseholdId = this.uid;
  }

  async getHouseholdMembers() {
    if (!this.uid) throw new Error('Not authenticated');
    if (!this.cachedHouseholdId) {
      await this.getDbFile();
    }
    
    const q = query(
      collection(firestore, 'users'), 
      where('householdId', '==', this.cachedHouseholdId)
    );
    const querySnapshot = await getDocs(q);
    const members = [];
    querySnapshot.forEach((doc) => {
      members.push({
        uid: doc.id,
        ...doc.data()
      });
    });
    return members;
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

import { auth, db as firestore, firebaseConfig } from './firebase';
import { doc, getDoc, setDoc, runTransaction, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';

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

  // ─── Multiple Households Management ────────────────────────────────────

  async getUserHouseholds() {
    if (!this.uid) throw new Error('Not authenticated');

    if (this.isGuest) {
      const saved = localStorage.getItem('foodex_guest_households');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
      const initial = [{ id: 'guest-household', name: 'Main Home', role: 'owner' }];
      localStorage.setItem('foodex_guest_households', JSON.stringify(initial));
      return initial;
    }

    const userSnap = await getDoc(this.userRef);
    if (!userSnap.exists()) {
      return [{ id: this.uid, name: 'Main Home', role: 'owner' }];
    }

    const data = userSnap.data();
    if (data.households && data.households.length > 0) {
      return data.households;
    }

    // Auto-migrate legacy user profile
    const defaultList = [{
      id: data.householdId || this.uid,
      name: 'Main Home',
      role: (data.householdId && data.householdId !== this.uid) ? 'member' : 'owner'
    }];
    await setDoc(this.userRef, {
      households: defaultList,
      activeHouseholdId: defaultList[0].id,
      householdId: defaultList[0].id
    }, { merge: true });
    return defaultList;
  }

  async createHousehold(name) {
    if (!this.uid) throw new Error('Not authenticated');
    const cleanName = (name || '').trim();
    if (!cleanName) throw new Error('Please enter a household name.');

    const newId = 'house_' + (self.crypto?.randomUUID ? crypto.randomUUID().replace(/-/g, '').substring(0, 12) : Date.now().toString(36));

    if (this.isGuest) {
      const households = await this.getUserHouseholds();
      const newEntry = { id: newId, name: cleanName, role: 'owner' };
      const updated = [...households, newEntry];
      localStorage.setItem('foodex_guest_households', JSON.stringify(updated));
      localStorage.setItem('foodex_guest_active_household', newId);
      this.cachedHouseholdId = newId;

      const newDb = {
        name: cleanName,
        products: [],
        pushSubscriptions: [],
        settings: {
          notificationDaysBefore: 3,
          emailAlertsEnabled: false,
          emailAddress: '',
          locations: ['Fridge', 'Freezer', 'Pantry']
        }
      };
      localStorage.setItem('foodex_guest_db_' + newId, JSON.stringify(newDb));
      return newEntry;
    }

    // 1. Create household doc in Firestore
    const houseDocRef = doc(firestore, 'households', newId);
    const newDb = {
      name: cleanName,
      ownerUid: this.uid,
      products: [],
      pushSubscriptions: [],
      settings: {
        notificationDaysBefore: 3,
        emailAlertsEnabled: false,
        emailAddress: '',
        locations: ['Fridge', 'Freezer', 'Pantry']
      }
    };
    await setDoc(houseDocRef, newDb);

    // 2. Add to user profile & make active
    const households = await this.getUserHouseholds();
    const newEntry = { id: newId, name: cleanName, role: 'owner' };
    const updated = [...households, newEntry];

    await setDoc(this.userRef, {
      households: updated,
      activeHouseholdId: newId,
      householdId: newId
    }, { merge: true });

    this.cachedHouseholdId = newId;
    return newEntry;
  }

  async switchHousehold(targetHouseholdId) {
    if (!this.uid) throw new Error('Not authenticated');

    if (this.isGuest) {
      localStorage.setItem('foodex_guest_active_household', targetHouseholdId);
      this.cachedHouseholdId = targetHouseholdId;
      return;
    }

    await setDoc(this.userRef, {
      activeHouseholdId: targetHouseholdId,
      householdId: targetHouseholdId
    }, { merge: true });

    this.cachedHouseholdId = targetHouseholdId;
  }

  async renameHousehold(householdId, newName) {
    if (!this.uid) throw new Error('Not authenticated');
    const cleanName = (newName || '').trim();
    if (!cleanName) throw new Error('Household name cannot be empty.');

    if (this.isGuest) {
      const households = await this.getUserHouseholds();
      const updated = households.map(h => h.id === householdId ? { ...h, name: cleanName } : h);
      localStorage.setItem('foodex_guest_households', JSON.stringify(updated));
      return;
    }

    // Update household doc
    const houseDocRef = doc(firestore, 'households', householdId);
    await setDoc(houseDocRef, { name: cleanName }, { merge: true });

    // Update user profile list
    const households = await this.getUserHouseholds();
    const updated = households.map(h => h.id === householdId ? { ...h, name: cleanName } : h);
    await setDoc(this.userRef, { households: updated }, { merge: true });
  }

  async deleteOrLeaveHousehold(householdId) {
    if (!this.uid) throw new Error('Not authenticated');

    const households = await this.getUserHouseholds();
    const target = households.find(h => h.id === householdId);
    if (!target) return;

    const remaining = households.filter(h => h.id !== householdId);
    let nextActive = remaining.length > 0 ? remaining[0].id : null;

    if (this.isGuest) {
      if (remaining.length === 0) {
        const fresh = [{ id: 'guest-household', name: 'Main Home', role: 'owner' }];
        localStorage.setItem('foodex_guest_households', JSON.stringify(fresh));
        localStorage.setItem('foodex_guest_active_household', 'guest-household');
        this.cachedHouseholdId = 'guest-household';
      } else {
        localStorage.setItem('foodex_guest_households', JSON.stringify(remaining));
        localStorage.setItem('foodex_guest_active_household', nextActive);
        this.cachedHouseholdId = nextActive;
      }
      return;
    }

    // If owner, delete the household document
    if (target.role === 'owner') {
      try {
        await deleteDoc(doc(firestore, 'households', householdId));
      } catch (e) {
        console.warn('Could not delete household doc:', e);
      }
    }

    if (remaining.length === 0) {
      // Recreate default household
      const defaultId = this.uid;
      const defaultEntry = { id: defaultId, name: 'Main Home', role: 'owner' };
      await setDoc(this.userRef, {
        households: [defaultEntry],
        activeHouseholdId: defaultId,
        householdId: defaultId
      }, { merge: true });
      this.cachedHouseholdId = defaultId;
    } else {
      await setDoc(this.userRef, {
        households: remaining,
        activeHouseholdId: nextActive,
        householdId: nextActive
      }, { merge: true });
      this.cachedHouseholdId = nextActive;
    }
  }

  async getHouseholdMembers() {
    if (!this.uid) throw new Error('Not authenticated');
    if (!this.cachedHouseholdId) {
      await this.getDbFile();
    }
    
    if (this.isGuest) {
      return [{ uid: 'guest-user', displayName: 'Guest Tester', email: 'guest@foodex.local' }];
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

  // ─── Per-Household Email Invitations ────────────────────────────────────

  async inviteToHouseholdByEmail(email, targetHouseholdId, targetHouseholdName) {
    if (!this.uid) throw new Error('Not authenticated');
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Please enter a valid email address.');
    }

    if (!this.cachedHouseholdId) {
      await this.getDbFile();
    }
    const householdId = targetHouseholdId || this.cachedHouseholdId || this.uid;
    const householdName = targetHouseholdName || 'Main Home';

    if (this.isGuest) {
      const inviteId = 'guest-invite-' + Date.now();
      const existing = JSON.parse(localStorage.getItem('foodex_guest_invites') || '[]');
      existing.push({
        id: inviteId,
        householdId,
        householdName,
        invitedEmail: cleanEmail,
        invitedByName: 'Guest Tester',
        invitedByEmail: 'guest@foodex.local',
        createdAt: new Date().toISOString()
      });
      localStorage.setItem('foodex_guest_invites', JSON.stringify(existing));
      const joinUrl = `${window.location.origin}${window.location.pathname}?join=${encodeURIComponent(householdId)}&name=${encodeURIComponent(householdName)}`;
      return { inviteId, joinUrl };
    }

    const inviteId = self.crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    const inviteRef = doc(firestore, 'invitations', inviteId);
    
    await setDoc(inviteRef, {
      id: inviteId,
      householdId,
      householdName,
      invitedEmail: cleanEmail,
      invitedByName: auth.currentUser?.displayName || auth.currentUser?.email || 'A FoodEx User',
      invitedByEmail: auth.currentUser?.email || '',
      invitedByUid: this.uid,
      createdAt: new Date().toISOString()
    });

    const joinUrl = `${window.location.origin}${window.location.pathname}?join=${encodeURIComponent(householdId)}&name=${encodeURIComponent(householdName)}`;
    return { inviteId, joinUrl };
  }

  async getHouseholdInvites(targetHouseholdId) {
    if (!this.uid) throw new Error('Not authenticated');
    if (!this.cachedHouseholdId) {
      await this.getDbFile();
    }
    const householdId = targetHouseholdId || this.cachedHouseholdId || this.uid;

    if (this.isGuest) {
      const all = JSON.parse(localStorage.getItem('foodex_guest_invites') || '[]');
      return all.filter(i => i.householdId === householdId);
    }

    const q = query(
      collection(firestore, 'invitations'),
      where('householdId', '==', householdId)
    );
    const snap = await getDocs(q);
    const invites = [];
    snap.forEach((d) => invites.push({ id: d.id, ...d.data() }));
    return invites;
  }

  async getInvitesForMe() {
    if (!this.uid || this.isGuest) return [];
    const userEmail = auth.currentUser?.email?.toLowerCase();
    if (!userEmail) return [];

    const q = query(
      collection(firestore, 'invitations'),
      where('invitedEmail', '==', userEmail)
    );
    const snap = await getDocs(q);
    const invites = [];
    snap.forEach((d) => invites.push({ id: d.id, ...d.data() }));
    return invites;
  }

  async cancelInvite(inviteId) {
    if (this.isGuest) {
      const existing = JSON.parse(localStorage.getItem('foodex_guest_invites') || '[]');
      localStorage.setItem('foodex_guest_invites', JSON.stringify(existing.filter(i => i.id !== inviteId)));
      return;
    }
    const inviteRef = doc(firestore, 'invitations', inviteId);
    await deleteDoc(inviteRef);
  }

  async acceptInvite(inviteId, targetHouseholdId, targetHouseholdName) {
    const cleanName = targetHouseholdName || 'Shared Household';

    if (this.isGuest) {
      const households = await this.getUserHouseholds();
      if (!households.some(h => h.id === targetHouseholdId)) {
        const updated = [...households, { id: targetHouseholdId, name: cleanName, role: 'member' }];
        localStorage.setItem('foodex_guest_households', JSON.stringify(updated));
      }
      await this.switchHousehold(targetHouseholdId);
      await this.cancelInvite(inviteId);
      return;
    }

    const households = await this.getUserHouseholds();
    if (!households.some(h => h.id === targetHouseholdId)) {
      const updated = [...households, { id: targetHouseholdId, name: cleanName, role: 'member' }];
      await setDoc(this.userRef, {
        households: updated,
        activeHouseholdId: targetHouseholdId,
        householdId: targetHouseholdId
      }, { merge: true });
    } else {
      await this.switchHousehold(targetHouseholdId);
    }

    this.cachedHouseholdId = targetHouseholdId;
    await this.cancelInvite(inviteId);
  }

  async rejectInvite(inviteId) {
    await this.cancelInvite(inviteId);
  }

  // ─── Images (Replaced by Wikipedia URLs) ─────────────────────────────────

  async uploadImage(base64ImageString) {
    throw new Error('uploadImage is deprecated. Images are now automatically fetched.');
  }

  async deleteImage(path) {
    return true;
  }
}

export const dbClient = new DbClient();
export default dbClient;

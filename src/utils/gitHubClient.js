import axios from 'axios';
import { generateVapidKeys } from './vapid';

const PAT_KEY = 'foodex_github_pat';
const USERNAME_KEY = 'foodex_github_username';
const DATA_REPO_NAME = 'foodex-data';

class GitHubClient {
  constructor() {
    this.pat = localStorage.getItem(PAT_KEY) || '';
    this.username = localStorage.getItem(USERNAME_KEY) || '';
    this.client = null;
    this.initClient();
  }

  initClient() {
    if (this.pat) {
      this.client = axios.create({
        baseURL: 'https://api.github.com',
        headers: {
          Authorization: `token ${this.pat}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });
    } else {
      this.client = null;
    }
  }

  async setPat(pat) {
    this.pat = pat;
    localStorage.setItem(PAT_KEY, pat);
    this.initClient();

    // Discover authenticated username
    const userRes = await this.client.get('/user');
    this.username = userRes.data.login;
    localStorage.setItem(USERNAME_KEY, this.username);
  }

  get repo() {
    if (this.username) return `${this.username}/${DATA_REPO_NAME}`;
    return '';
  }

  // no-op setter
  set repo(_) {}

  clearCredentials() {
    localStorage.removeItem(PAT_KEY);
    localStorage.removeItem(USERNAME_KEY);
    this.pat = '';
    this.username = '';
    this.client = null;
  }

  isAuthenticated() {
    return !!this.client && !!this.username;
  }

  getRepoInfo() {
    if (!this.username) throw new Error('Not authenticated');
    return { owner: this.username, repo: DATA_REPO_NAME };
  }

  // ─── Repository management ───────────────────────────────────────────────

  async checkRepository() {
    if (!this.client) throw new Error('Not authenticated');
    const { owner, repo } = this.getRepoInfo();
    try {
      const res = await this.client.get(`/repos/${owner}/${repo}`);
      return res.data;
    } catch (err) {
      if (err.response && err.response.status === 404) return null;
      throw err;
    }
  }

  async createRepository() {
    if (!this.client) throw new Error('Not authenticated');
    const { repo } = this.getRepoInfo();
    try {
      const res = await this.client.post('/user/repos', {
        name: repo,
        private: true,
        description: 'FoodEx – food expiration tracker database',
        auto_init: false,
      });
      return res.data;
    } catch (err) {
      throw new Error(err.response?.data?.message || 'Failed to create repository.');
    }
  }

  // ─── Database (db.json) ──────────────────────────────────────────────────

  async getDbFile() {
    if (!this.client) throw new Error('Not authenticated');
    const { owner, repo } = this.getRepoInfo();
    try {
      const res = await this.client.get(`/repos/${owner}/${repo}/contents/db.json`);
      const content = decodeBase64Utf8(res.data.content);
      const db = JSON.parse(content);
      return { db, sha: res.data.sha };
    } catch (err) {
      if (err.response && err.response.status === 404) return null;
      throw err;
    }
  }

  async saveDbFile(db, sha) {
    if (!this.client) throw new Error('Not authenticated');
    const { owner, repo } = this.getRepoInfo();
    const content = JSON.stringify(db, null, 2);
    const base64Content = encodeBase64Utf8(content);

    const payload = {
      message: 'update database [skip ci]',
      content: base64Content,
    };
    if (sha) payload.sha = sha;

    const res = await this.client.put(`/repos/${owner}/${repo}/contents/db.json`, payload);
    return res.data.content.sha;
  }

  async initializeDbIfMissing() {
    const fileData = await this.getDbFile();
    if (fileData) {
      let { db, sha } = fileData;
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

      if (updated) await this.saveDbFile(db, sha);
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

  /** Safe transactional update — retries on 409 conflicts. */
  async updateDb(updateFn) {
    let retries = 3;
    while (retries > 0) {
      const fileData = await this.getDbFile();
      let db = { products: [], pushSubscriptions: [], settings: {} };
      let sha = null;
      if (fileData) { db = fileData.db; sha = fileData.sha; }

      if (!db.products) db.products = [];
      if (!db.pushSubscriptions) db.pushSubscriptions = [];
      if (!db.settings) db.settings = {};

      const updatedDb = updateFn(db);
      try {
        const newSha = await this.saveDbFile(updatedDb, sha);
        return { db: updatedDb, sha: newSha };
      } catch (err) {
        if (err.response && err.response.status === 409) {
          console.warn('Conflict, retrying…', retries);
          retries--;
          await new Promise(r => setTimeout(r, 500));
        } else {
          throw err;
        }
      }
    }
    throw new Error('Failed to save — persistent conflicts. Please try again.');
  }

  // ─── Images ──────────────────────────────────────────────────────────────

  async uploadImage(base64ImageString) {
    if (!this.client) throw new Error('Not authenticated');
    const { owner, repo } = this.getRepoInfo();

    const matches = base64ImageString.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches) throw new Error('Invalid image format');

    const ext = matches[1];
    const base64Data = matches[2];
    const filename = `img-${Date.now()}.${ext}`;
    const path = `uploads/${filename}`;

    const res = await this.client.put(`/repos/${owner}/${repo}/contents/${path}`, {
      message: `upload product image ${filename} [skip ci]`,
      content: base64Data,
    });

    const imageUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
    return { imageUrl, imagePath: path, sha: res.data.content.sha };
  }

  async deleteImage(path) {
    if (!this.client) throw new Error('Not authenticated');
    const { owner, repo } = this.getRepoInfo();
    try {
      const meta = await this.client.get(`/repos/${owner}/${repo}/contents/${path}`);
      await this.client.delete(`/repos/${owner}/${repo}/contents/${path}`, {
        data: {
          message: `delete product image ${path} [skip ci]`,
          sha: meta.data.sha,
        },
      });
    } catch (err) {
      console.error(`Failed to delete image at ${path}:`, err);
    }
  }
}

// ─── Base64 helpers ──────────────────────────────────────────────────────────

function decodeBase64Utf8(str) {
  return decodeURIComponent(
    atob(str.replace(/\s/g, ''))
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

function encodeBase64Utf8(str) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

export const gitHubClient = new GitHubClient();
export default gitHubClient;

import axios from 'axios';
import { generateVapidKeys } from './vapid';

const PAT_KEY = 'foodex_github_pat';
const REPO_KEY = 'foodex_github_repo';

class GitHubClient {
  constructor() {
    this.pat = localStorage.getItem(PAT_KEY) || '';
    this.repo = localStorage.getItem(REPO_KEY) || '';
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

  setCredentials(pat, repo) {
    localStorage.setItem(PAT_KEY, pat);
    localStorage.setItem(REPO_KEY, repo);
    this.pat = pat;
    this.repo = repo;
    this.initClient();
  }

  clearCredentials() {
    localStorage.removeItem(PAT_KEY);
    localStorage.removeItem(REPO_KEY);
    this.pat = '';
    this.repo = '';
    this.client = null;
  }

  isAuthenticated() {
    return !!this.client && !!this.repo;
  }

  getRepoInfo() {
    const parts = this.repo.split('/');
    if (parts.length !== 2) {
      throw new Error('Repository format must be owner/name');
    }
    return { owner: parts[0], repo: parts[1] };
  }

  // Check if repository exists
  async checkRepository() {
    if (!this.client) throw new Error('Not authenticated');
    const { owner, repo } = this.getRepoInfo();
    try {
      const res = await this.client.get(`/repos/${owner}/${repo}`);
      return res.data;
    } catch (err) {
      if (err.response && err.response.status === 404) {
        return null;
      }
      throw err;
    }
  }

  // Create repository
  async createRepository() {
    if (!this.client) throw new Error('Not authenticated');
    const { owner, repo } = this.getRepoInfo();
    
    // Check if the owner is the current authenticated user or an organization
    let user;
    try {
      const userRes = await this.client.get('/user');
      user = userRes.data.login;
    } catch (err) {
      throw new Error('Failed to fetch user info: ' + err.message);
    }

    try {
      let res;
      if (owner.toLowerCase() === user.toLowerCase()) {
        // Create user repository
        res = await this.client.post('/user/repos', {
          name: repo,
          private: true,
          description: 'FoodEx Expiration Tracker database',
          auto_init: false,
        });
      } else {
        // Create organization repository
        res = await this.client.post(`/orgs/${owner}/repos`, {
          name: repo,
          private: true,
          description: 'FoodEx Expiration Tracker database',
          auto_init: false,
        });
      }
      return res.data;
    } catch (err) {
      console.error('Failed to create repository:', err);
      throw new Error(err.response?.data?.message || 'Failed to create repository.');
    }
  }

  // Get file contents (db.json)
  async getDbFile() {
    if (!this.client) throw new Error('Not authenticated');
    const { owner, repo } = this.getRepoInfo();
    try {
      const res = await this.client.get(`/repos/${owner}/${repo}/contents/db.json`);
      const content = decodeBase64Utf8(res.data.content);
      const db = JSON.parse(content);
      return { db, sha: res.data.sha };
    } catch (err) {
      if (err.response && err.response.status === 404) {
        return null;
      }
      throw err;
    }
  }

  // Write/Update file contents (db.json)
  async saveDbFile(db, sha) {
    if (!this.client) throw new Error('Not authenticated');
    const { owner, repo } = this.getRepoInfo();
    const content = JSON.stringify(db, null, 2);
    const base64Content = encodeBase64Utf8(content);
    
    const payload = {
      message: 'update database [skip ci]',
      content: base64Content,
    };
    if (sha) {
      payload.sha = sha;
    }

    const res = await this.client.put(`/repos/${owner}/${repo}/contents/db.json`, payload);
    return res.data.content.sha;
  }

  // Initialize db.json if not present
  async initializeDbIfMissing() {
    const fileData = await this.getDbFile();
    if (fileData) {
      // It exists, let's verify VAPID keys are in settings
      let db = fileData.db;
      let sha = fileData.sha;
      let updated = false;

      if (!db.settings) {
        db.settings = {};
        updated = true;
      }
      if (!db.settings.vapidPublicKey || !db.settings.vapidPrivateKey) {
        const keys = await generateVapidKeys();
        db.settings.vapidPublicKey = keys.publicKey;
        db.settings.vapidPrivateKey = keys.privateKey;
        updated = true;
      }
      if (!db.products) {
        db.products = [];
        updated = true;
      }
      if (!db.pushSubscriptions) {
        db.pushSubscriptions = [];
        updated = true;
      }

      if (updated) {
        await this.saveDbFile(db, sha);
      }
      return;
    }

    // Initialize fresh db.json
    const keys = await generateVapidKeys();
    const initialDb = {
      products: [],
      pushSubscriptions: [],
      settings: {
        notificationDaysBefore: 3,
        emailAlertsEnabled: false,
        emailAddress: '',
        vapidPublicKey: keys.publicKey,
        vapidPrivateKey: keys.privateKey
      }
    };
    await this.saveDbFile(initialDb, null);
  }

  // Safe transactional-like update of db.json
  async updateDb(updateFn) {
    let retries = 3;
    while (retries > 0) {
      const fileData = await this.getDbFile();
      let db = { products: [], pushSubscriptions: [], settings: {} };
      let sha = null;
      if (fileData) {
        db = fileData.db;
        sha = fileData.sha;
      }
      
      // Ensure arrays/objects exist
      if (!db.products) db.products = [];
      if (!db.pushSubscriptions) db.pushSubscriptions = [];
      if (!db.settings) db.settings = {};

      const updatedDb = updateFn(db);

      try {
        const newSha = await this.saveDbFile(updatedDb, sha);
        return { db: updatedDb, sha: newSha };
      } catch (err) {
        if (err.response && err.response.status === 409) {
          console.warn('Conflict detected, retrying database save...', retries);
          retries--;
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          throw err;
        }
      }
    }
    throw new Error('Failed to save changes due to persistent merge conflicts. Please try again.');
  }

  // Upload picture
  async uploadImage(base64ImageString) {
    if (!this.client) throw new Error('Not authenticated');
    const { owner, repo } = this.getRepoInfo();
    
    const matches = base64ImageString.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new Error('Invalid image format');
    }
    const ext = matches[1];
    const base64Data = matches[2];
    const filename = `img-${Date.now()}.${ext}`;
    const path = `uploads/${filename}`;

    const res = await this.client.put(`/repos/${owner}/${repo}/contents/${path}`, {
      message: `upload product image ${filename} [skip ci]`,
      content: base64Data
    });

    // Construct raw github content URL
    const imageUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/${path}`;
    return { imageUrl, imagePath: path, sha: res.data.content.sha };
  }

  // Delete picture
  async deleteImage(path) {
    if (!this.client) throw new Error('Not authenticated');
    const { owner, repo } = this.getRepoInfo();
    try {
      const meta = await this.client.get(`/repos/${owner}/${repo}/contents/${path}`);
      const sha = meta.data.sha;
      
      await this.client.delete(`/repos/${owner}/${repo}/contents/${path}`, {
        data: {
          message: `delete product image ${path} [skip ci]`,
          sha: sha
        }
      });
    } catch (err) {
      console.error(`Failed to delete image at ${path}:`, err);
    }
  }
}

// UTF-8 safe base64 decoding
function decodeBase64Utf8(str) {
  return decodeURIComponent(
    atob(str.replace(/\s/g, ''))
      .split('')
      .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
}

// UTF-8 safe base64 encoding
function encodeBase64Utf8(str) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

export const gitHubClient = new GitHubClient();
export default gitHubClient;

/**
 * FoodEx Client-Side Diagnostic & Audit Logger
 * Logging is ENABLED by default for FoodEx.
 */

const STORAGE_KEY = 'foodex_debug_logging_enabled';
const SCANS_KEY = 'foodex_recent_scans_log';
const MAX_LOGS = 50;

class FoodExLogger {
  constructor() {
    // Enabled by default for FoodEx
    this.enabled = typeof window !== 'undefined' 
      ? localStorage.getItem(STORAGE_KEY) !== 'false' 
      : true;
    this.logs = [];
  }

  enable() {
    this.enabled = true;
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, 'true');
    console.log('%c[FoodEx Logger] Logging ENABLED', 'color: #10b981; font-weight: bold;');
  }

  disable() {
    this.enabled = false;
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, 'false');
    console.log('%c[FoodEx Logger] Logging DISABLED', 'color: #ef4444; font-weight: bold;');
  }

  toggle() {
    if (this.enabled) this.disable();
    else this.enable();
    return this.enabled;
  }

  _format(level, msg) {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    const entry = { timestamp, level, msg };
    this.logs.unshift(entry);
    if (this.logs.length > MAX_LOGS) this.logs.pop();
    return `[FoodEx ${timestamp}] [${level}] ${msg}`;
  }

  debug(msg, ...args) {
    if (!this.enabled) return;
    console.debug(`%c${this._format('DEBUG', msg)}`, 'color: #94a3b8;', ...args);
  }

  info(msg, ...args) {
    if (!this.enabled) return;
    console.info(`%c${this._format('INFO', msg)}`, 'color: #38bdf8; font-weight: bold;', ...args);
  }

  warn(msg, ...args) {
    if (!this.enabled) return;
    console.warn(`%c${this._format('WARN', msg)}`, 'color: #f59e0b; font-weight: bold;', ...args);
  }

  error(msg, ...args) {
    // Errors always output to console
    console.error(`%c${this._format('ERROR', msg)}`, 'color: #ef4444; font-weight: bold;', ...args);
  }

  /**
   * Log an expiration date scan attempt with photo snapshot
   */
  logScanAttempt({ dataUrl, extractedDate, engine, success, error }) {
    const entry = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleString(),
      extractedDate: extractedDate || null,
      engine: engine || 'Unknown',
      success: !!success,
      error: error || null,
      // Save thumbnail/dataUrl for client-side debugging
      thumbnail: dataUrl ? dataUrl.slice(0, 100) + '...' : null
    };

    this.info('Expiration Scan Captured:', entry);

    if (typeof window !== 'undefined') {
      try {
        const existing = JSON.parse(localStorage.getItem(SCANS_KEY) || '[]');
        existing.unshift(entry);
        localStorage.setItem(SCANS_KEY, JSON.stringify(existing.slice(0, 20)));
      } catch (e) {}
    }
  }

  getRecentScans() {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(SCANS_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }
}

const logger = new FoodExLogger();
if (typeof window !== 'undefined') {
  window.foodexLogger = logger;
}

export default logger;

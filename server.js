require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = Number(process.env.PORT || 3456);
const BIND_HOST = process.env.BIND_HOST || '127.0.0.1';
const IS_HOSTED = process.env.VERCEL === '1';

// Router config is intentionally environment-only. Never commit router credentials.
const ROUTER_HOST = process.env.ROUTER_HOST || '';
const ROUTER_USERNAME = process.env.ROUTER_USERNAME || '';
const ROUTER_PASSWORD = process.env.ROUTER_PASSWORD || '';
const ROUTER_CONFIGURED = Boolean(ROUTER_HOST && ROUTER_USERNAME && ROUTER_PASSWORD);

// Known router command UUIDs (ZLT X17U firmware)
const CMD_INIT_CONFIG = '9f2861ee-baf8-4038-bab6-774ad4e930b0';
const CMD_GET_TOKEN = '3830c61a-620d-47da-ae47-33d8401401c4';
const CMD_LOGIN = 'd2aa9843-494b-4947-9621-a46ec652ecd9';
const CMD_SMS_LIST = 'ee71744e-50b4-4d2a-9c2d-0c4c7b968fc5';
const CMD_PRELOGIN_INFO = '7c6906a3-f7de-4795-a17e-ef032ffacda4';

// Persistent data file
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'usage.json');
const DEMO_DATA_FILE = path.join(DATA_DIR, 'usage.example.json');

// Session state
let cachedSessionId = null;

app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: false,
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '16kb' }));
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
}));

app.get('/data/usage.example.json', (req, res) => {
  res.type('application/json').sendFile(DEMO_DATA_FILE);
});

// ─── Persistent Storage ────────────────────

function loadPersistedData() {
  try {
    // A fresh checkout should be useful immediately without requiring a private snapshot.
    const sourceFile = usingDemoData() ? DEMO_DATA_FILE : DATA_FILE;
    if (fs.existsSync(sourceFile)) {
      const raw = fs.readFileSync(sourceFile, 'utf-8');
      const parsed = JSON.parse(raw);
      console.log(`[Storage] Loaded ${parsed.usage.length} entries`);
      return parsed;
    }
  } catch (e) {
    console.error('[Storage] Error reading data file:', e.message);
  }
  return { usage: [], lastSync: null, totalSyncs: 0 };
}

function usingDemoData() {
  return IS_HOSTED || !fs.existsSync(DATA_FILE);
}

function savePersistedData(store) {
  if (IS_HOSTED) return;

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
    console.log(`[Storage] Saved ${store.usage.length} entries to disk`);
  } catch (e) {
    console.error('[Storage] Error writing data file:', e.message);
  }
}

function mergeUsageData(existing, fresh) {
  // Create a map keyed by date to deduplicate
  const map = new Map();

  // Add existing data first
  for (const entry of existing) {
    map.set(entry.date, entry);
  }

  // Merge fresh data (overwrites if same date — fresh data is more accurate)
  let newEntries = 0;
  for (const entry of fresh) {
    if (!map.has(entry.date)) newEntries++;
    map.set(entry.date, entry);
  }

  // Sort by date ascending
  const merged = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));

  console.log(`[Storage] Merged: ${existing.length} existing + ${fresh.length} fresh = ${merged.length} total (${newEntries} new)`);
  return merged;
}

// ─── Router HTTP Helper ────────────────────

function routerRequest(body) {
  if (!ROUTER_HOST) {
    return Promise.reject(new Error('ROUTER_HOST is not configured'));
  }

  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const options = {
      hostname: ROUTER_HOST,
      port: 80,
      path: '/cgi-bin/http.cgi',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Content-Length': Buffer.byteLength(data),
        'Accept': 'application/json, text/plain, */*',
        'Referer': `http://${ROUTER_HOST}/`,
      },
      timeout: 10000,
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          reject(new Error(`Failed to parse router response: ${responseData.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Router request timeout')); });
    req.write(data);
    req.end();
  });
}

// ─── Router Login Flow ─────────────────────

async function loginToRouter() {
  if (!ROUTER_USERNAME || !ROUTER_PASSWORD) {
    throw new Error('ROUTER_USERNAME and ROUTER_PASSWORD are not configured');
  }

  console.log('[Router] Starting login flow...');

  // Step 1: Get init config
  const initResp = await routerRequest({
    cmd: CMD_INIT_CONFIG,
    method: 'GET',
    sessionId: '',
  });

  if (!initResp.success) {
    throw new Error(`Init config failed: ${JSON.stringify(initResp)}`);
  }

  console.log(`[Router] Got domain_value`);

  // Step 2: Get login token
  const tokenResp = await routerRequest({
    cmd: CMD_GET_TOKEN,
    method: 'GET',
    sessionId: '',
  });

  if (!tokenResp.success || !tokenResp.token) {
    throw new Error(`Get token failed: ${JSON.stringify(tokenResp)}`);
  }

  const token = tokenResp.token;

  // Step 3: Hash password = SHA256(token + password)
  const hashedPassword = crypto
    .createHash('sha256')
    .update(token + ROUTER_PASSWORD)
    .digest('hex');

  // Step 4: Generate a sessionId for the login request
  const loginSessionId = crypto.randomBytes(32).toString('hex');

  // Step 5: Login
  const loginResp = await routerRequest({
    username: ROUTER_USERNAME,
    passwd: hashedPassword,
    token: token,
    sessionId: loginSessionId,
    cmd: CMD_LOGIN,
    method: 'POST',
  });

  if (!loginResp.success || loginResp.login_fail === 'fail' || !loginResp.sessionId) {
    throw new Error(`Login failed: ${JSON.stringify(loginResp)}`);
  }

  cachedSessionId = loginResp.sessionId;
  console.log(`[Router] Login successful!`);
  return cachedSessionId;
}

async function getSession() {
  if (cachedSessionId) return cachedSessionId;
  return await loginToRouter();
}

// ─── SMS Parsing ───────────────────────────

function parseSmsEntries(smsListStr) {
  if (!smsListStr) return [];

  const entries = smsListStr.split(',');
  const parsed = [];

  for (const entry of entries) {
    try {
      const decoded = Buffer.from(entry, 'base64').toString('utf-8');
      const match = decoded.match(/^(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/s);
      if (match) {
        parsed.push({
          id: parseInt(match[1]),
          read: match[2] === '1',
          sender: match[3],
          date: match[4],
          time: match[5],
          message: match[6].trim(),
        });
      }
    } catch (e) {
      // Skip malformed
    }
  }

  return parsed;
}

function extractDataUsage(messages) {
  const usageData = [];
  const regex = /data usage on (\d+) for (\d{4}-\d{2}-\d{2}) was ([\d.]+) MB/;

  for (const msg of messages) {
    const match = msg.message.match(regex);
    if (match) {
      usageData.push({
        phone: match[1],
        date: match[2],
        usageMB: parseFloat(match[3]),
        usageGB: parseFloat((parseFloat(match[3]) / 1024).toFixed(4)),
      });
    }
  }

  usageData.sort((a, b) => a.date.localeCompare(b.date));
  return usageData;
}

// Fetch SMS from router
async function fetchFromRouter() {
  const sessionId = await getSession();

  const smsResp = await routerRequest({
    page_num: -1,
    subcmd: 0,
    cmd: CMD_SMS_LIST,
    method: 'GET',
    sessionId: sessionId,
  });

  if (!smsResp.success) {
    // Session expired, re-login and retry
    console.log('[Router] Session expired, re-authenticating...');
    cachedSessionId = null;
    const newSession = await getSession();

    const retryResp = await routerRequest({
      page_num: -1,
      subcmd: 0,
      cmd: CMD_SMS_LIST,
      method: 'GET',
      sessionId: newSession,
    });

    if (!retryResp.success) {
      throw new Error('SMS fetch failed after re-login');
    }

    return parseSmsEntries(retryResp.sms_list);
  }

  return parseSmsEntries(smsResp.sms_list);
}

function normalizeMetric(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function getSignalRating(metrics) {
  const sinr = typeof metrics.sinr === 'number' ? metrics.sinr : null;
  const rsrq = typeof metrics.rsrq === 'number' ? metrics.rsrq : null;
  const rsrp = typeof metrics.rsrp === 'number' ? metrics.rsrp : null;

  if (sinr !== null && rsrq !== null) {
    if (sinr >= 10 && rsrq >= -10) return 'Excellent';
    if (sinr >= 3 && rsrq >= -13) return 'Good';
    if (sinr >= 0 && rsrq >= -16) return 'Fair';
    return 'Poor';
  }

  if (rsrp !== null) {
    if (rsrp >= -80) return 'Good';
    if (rsrp >= -95) return 'Fair';
    return 'Poor';
  }

  return 'Unknown';
}

function normalizeRouterStatus(payload) {
  const status = {
    networkType: payload.network_type_str || null,
    sinr: normalizeMetric(payload.SINR),
    rsrp: normalizeMetric(payload.RSRP),
    rsrq: normalizeMetric(payload.RSRQ),
    rssi: normalizeMetric(payload.RSSI),
    freq: normalizeMetric(payload.FREQ),
    currentBand: payload.currentband || null,
    bandwidth: payload.bandwidth || null,
    uptime: payload.uptime || null,
    firmwareVersion: payload.fake_version || null,
  };

  status.signalRating = getSignalRating(status);
  return status;
}

function publicUsageData(entries) {
  return entries
    .filter((entry) => entry && /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && Number.isFinite(Number(entry.usageMB)))
    .map((entry) => ({
      date: entry.date,
      usageMB: Number(entry.usageMB),
      usageGB: Number((Number(entry.usageMB) / 1024).toFixed(4)),
    }));
}

async function fetchRouterStatus() {
  const attempts = [
    { sessionId: '' },
    { sessionId: await getSession() },
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      const statusResp = await routerRequest({
        cmd: CMD_PRELOGIN_INFO,
        method: 'GET',
        sessionId: attempt.sessionId,
      });

      if (!statusResp.success) {
        throw new Error(JSON.stringify(statusResp));
      }

      return {
        ...normalizeRouterStatus(statusResp),
        raw: statusResp,
      };
    } catch (error) {
      lastError = error;
      cachedSessionId = null;
    }
  }

  throw lastError || new Error('Router status request failed');
}

// ─── API Routes ────────────────────────────

// GET /api/usage — returns all persisted data + fresh from router
app.get('/api/usage', async (req, res) => {
  try {
    const store = loadPersistedData();

    // Try to fetch fresh data from the router
    let freshUsage = [];
    let routerConnected = false;

    if (process.env.VERCEL !== '1') {
      try {
        const messages = await fetchFromRouter();
        freshUsage = extractDataUsage(messages);
        routerConnected = true;
      } catch (routerErr) {
        console.log(`[API] Router unreachable: ${routerErr.message}`);
        console.log('[API] Serving cached data only');
      }
    }

    // Merge fresh data with persisted data
    if (freshUsage.length > 0) {
      store.usage = mergeUsageData(store.usage, freshUsage);
      store.lastSync = new Date().toISOString();
      store.totalSyncs = (store.totalSyncs || 0) + 1;
      savePersistedData(store);
    }

    console.log(`[API] Returning ${store.usage.length} total usage entries`);

    res.json({
      success: true,
      data: publicUsageData(store.usage),
      routerConnected,
      lastSync: store.lastSync,
      totalSyncs: store.totalSyncs,
      hosted: IS_HOSTED,
      source: routerConnected ? 'router' : (usingDemoData() ? 'demo-snapshot' : 'saved-snapshot'),
    });
  } catch (error) {
    console.error('[API] Error:', error.message);
    cachedSessionId = null;

    // Still try to return cached data on error
    const store = loadPersistedData();
    if (store.usage.length > 0) {
      return res.json({
        success: true,
        data: publicUsageData(store.usage),
        routerConnected: false,
        lastSync: store.lastSync,
        cached: true,
        hosted: IS_HOSTED,
        source: usingDemoData() ? 'demo-snapshot' : 'saved-snapshot',
      });
    }

    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/router-status - returns live router radio/WAN details
app.get('/api/router-status', async (req, res) => {
  if (process.env.VERCEL === '1') {
    return res.status(503).json({
      success: false,
      routerConnected: false,
      hosted: true,
      error: 'Live router access is available only from the local dashboard.',
    });
  }

  try {
    const routerStatus = await fetchRouterStatus();
    res.json({
      success: true,
      routerConnected: true,
      data: routerStatus,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API] Router status error:', error.message);
    cachedSessionId = null;
    res.status(503).json({
      success: false,
      routerConnected: false,
      error: 'Live router status is unavailable.',
    });
  }
});

// POST /api/sync — force sync from router (for manual trigger)
app.post('/api/sync', async (req, res) => {
  if (process.env.VERCEL === '1') {
    return res.status(501).json({
      success: false,
      hosted: true,
      error: 'Run sync from the local dashboard while connected to the router Wi-Fi.',
    });
  }

  try {
    if (!ROUTER_CONFIGURED) {
      return res.status(503).json({
        success: false,
        error: 'Router configuration is incomplete. Copy .env.example to .env and fill in the router settings.',
      });
    }
    const messages = await fetchFromRouter();
    const freshUsage = extractDataUsage(messages);

    const store = loadPersistedData();
    store.usage = mergeUsageData(store.usage, freshUsage);
    store.lastSync = new Date().toISOString();
    store.totalSyncs = (store.totalSyncs || 0) + 1;
    savePersistedData(store);

    res.json({
      success: true,
      newEntries: freshUsage.length,
      totalEntries: store.usage.length,
      lastSync: store.lastSync,
    });
  } catch (error) {
    cachedSessionId = null;
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'airtel-data-tracker',
    hosted: IS_HOSTED,
    routerAccess: IS_HOSTED ? 'private-network-unavailable' : (ROUTER_CONFIGURED ? 'local-network-enabled' : 'not-configured'),
  });
});

app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'API route not found' });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((error, req, res, next) => {
  console.error('[API] Unexpected error:', error.message);
  if (res.headersSent) return next(error);
  res.status(500).json({ success: false, error: 'Unexpected server error' });
});

// ─── Startup ───────────────────────────────

if (require.main === module) {
app.listen(PORT, BIND_HOST, () => {
  console.log(`\n  🚀 Airtel Data Tracker running at http://localhost:${PORT}`);

  // Only advertise LAN access when the server was intentionally exposed beyond localhost.
  const isLocalOnly = ['127.0.0.1', 'localhost', '::1'].includes(BIND_HOST);
  if (!isLocalOnly) {
  // Show local network IP for phone access
  const nets = require('os').networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  📱 Phone access: http://${net.address}:${PORT}`);
      }
    }
  }

  }

  console.log('');

  // Auto-sync on startup
  (async () => {
    if (!ROUTER_CONFIGURED) {
      console.log('  ℹ️  Router sync skipped: configure ROUTER_HOST, ROUTER_USERNAME, and ROUTER_PASSWORD in .env\n');
      return;
    }
    try {
      const messages = await fetchFromRouter();
      const freshUsage = extractDataUsage(messages);
      const store = loadPersistedData();
      store.usage = mergeUsageData(store.usage, freshUsage);
      store.lastSync = new Date().toISOString();
      store.totalSyncs = (store.totalSyncs || 0) + 1;
      savePersistedData(store);
      console.log(`  ✅ Initial sync complete: ${store.usage.length} entries\n`);
    } catch (e) {
      console.log(`  ⚠️  Router unreachable on startup: ${e.message}\n`);
    }
  })();
});
} else {
  module.exports = app;
}

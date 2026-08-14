const DEFAULT_HOSTS = {
  auto: '192.168.1.1',
  airtel: '192.168.1.1',
  mtn: '192.168.0.1',
};
const sessions = new Map();
const routerMetadata = new Map();
const STATUS_COMMAND = '7c6906a3-f7de-4795-a17e-ef032ffacda4';

function cleanProvider(value) {
  return ['auto', 'airtel', 'mtn', 'other'].includes(value) ? value : 'auto';
}

function defaultHost(provider) {
  return DEFAULT_HOSTS[cleanProvider(provider)] || '';
}

function cleanHost(value, provider = 'auto') {
  const raw = String(value || defaultHost(provider)).trim().replace(/^https?:\/\//i, '').split('/')[0];
  if (!raw || /[^a-zA-Z0-9.:-]/.test(raw)) throw new Error('Enter the router address, for example 192.168.1.1');
  return raw;
}

function providerLabel(provider) {
  return { airtel: 'Airtel', mtn: 'MTN', other: 'Other network', auto: 'Auto-detected network' }[cleanProvider(provider)];
}

function storedSettings(settings, host) {
  const provider = cleanProvider(settings.provider);
  return {
    host,
    provider,
    username: settings.username,
    password: settings.rememberPassword ? settings.password : '',
    rememberPassword: Boolean(settings.rememberPassword),
  };
}

function routerUrl(host) {
  return `http://${host}/cgi-bin/http.cgi`;
}

async function routerRequest(host, body) {
  const response = await fetch(routerUrl(host), {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'Accept': 'application/json, text/plain, */*',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`Router returned HTTP ${response.status}`);
  const payload = await response.json();
  if (!payload || typeof payload !== 'object') throw new Error('Router returned an invalid response');
  return payload;
}

function bytesToHex(bytes) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return bytesToHex(new Uint8Array(digest));
}

async function loginToRouter(host, username, password) {
  const init = await routerRequest(host, {
    cmd: '9f2861ee-baf8-4038-bab6-774ad4e930b0',
    method: 'GET',
    sessionId: '',
  });
  if (!init.success) throw new Error('This router answered, but it does not expose the supported ZLT/ZTE data interface. Try the router’s other model/address or share its model for an adapter.');

  routerMetadata.set(host, {
    modelName: init.model_name || init.product_name || init.board_type || null,
  });

  const tokenResponse = await routerRequest(host, {
    cmd: '3830c61a-620d-47da-ae47-33d8401401c4',
    method: 'GET',
    sessionId: '',
  });
  if (!tokenResponse.success || !tokenResponse.token) throw new Error('The router did not provide a login token');

  const token = tokenResponse.token;
  const sessionId = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
  const login = await routerRequest(host, {
    username,
    passwd: await sha256Hex(token + password),
    token,
    sessionId,
    cmd: 'd2aa9843-494b-4947-9621-a46ec652ecd9',
    method: 'POST',
  });

  if (!login.success || login.login_fail === 'fail' || !login.sessionId) {
    const lockDetails = [
      login.locked,
      login.account_locked,
      login.lock_time,
      login.remaining_time,
      login.login_fail_reason,
    ].filter(Boolean).join(' ');
    const isLocked = login.locked === true
      || login.account_locked === true
      || /lock|\d+\s*:\s*\d+/i.test(lockDetails);
    if (isLocked) {
      throw new Error('The router account is temporarily locked. Stop retrying, wait for the router timer to finish, then sign in once with the same credentials used on the router portal.');
    }
    throw new Error('Router login failed. Check the address, username, and password before trying again to avoid an account lock.');
  }

  sessions.set(host, login.sessionId);
  return login.sessionId;
}

async function getSession(host, username, password, forceLogin = false) {
  if (!forceLogin && sessions.has(host)) return sessions.get(host);
  return loginToRouter(host, username, password);
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseSmsEntries(smsList) {
  if (!smsList) return [];
  return String(smsList).split(',').flatMap((entry) => {
    try {
      const decoded = decodeBase64(entry);
      const match = decoded.match(/^(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/s);
      return match ? [{
        id: match[1],
        read: match[2] === '1',
        sender: match[3],
        date: match[4],
        time: match[5],
        message: match[6].trim(),
      }] : [{ message: decoded.trim() }];
    } catch {
      return [];
    }
  });
}

function normalizeSmsDate(value) {
  const raw = String(value || '').replace(/\//g, '-');
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dmy = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!dmy) return null;
  return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
}

function usageAmountToMB(value, unit) {
  const amount = Number.parseFloat(String(value).replace(/,/g, ''));
  if (!Number.isFinite(amount)) return null;
  const multiplier = { MB: 1, GB: 1024, TB: 1024 * 1024 }[String(unit).toUpperCase()];
  return multiplier ? amount * multiplier : null;
}

function extractUsageReading(body) {
  if (!/(?:\bdata\s+usage\b|\b(?:used|consumed)\s+[\d,.]+\s*(?:MB|GB|TB)\b)/i.test(body)) return null;
  const datePattern = '(\\d{4}[-/]\\d{2}[-/]\\d{2}|\\d{1,2}[-/]\\d{1,2}[-/]\\d{4})';
  const afterDate = new RegExp(`${datePattern}[^\\d]{0,28}([\\d,.]+)\\s*(MB|GB|TB)\\b`, 'i').exec(body);
  const beforeDate = new RegExp(`(?:was|is|used|usage)\\s*[:=-]?\\s*([\\d,.]+)\\s*(MB|GB|TB)\\b[^\\d]{0,40}${datePattern}`, 'i').exec(body);

  const date = normalizeSmsDate(afterDate?.[1] || beforeDate?.[3]);
  const usageMB = usageAmountToMB(afterDate?.[2] || beforeDate?.[1], afterDate?.[3] || beforeDate?.[2]);
  return date && usageMB !== null ? { date, usageMB } : null;
}

function extractUsage(messages) {
  const byDate = new Map();

  for (const message of messages) {
    const reading = extractUsageReading(String(message.message || ''));
    if (!reading) continue;
    byDate.set(reading.date, {
      date: reading.date,
      usageMB: reading.usageMB,
      usageGB: Number((reading.usageMB / 1024).toFixed(4)),
    });
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function extractSubscriptions(messages) {
  const subscriptions = new Map();

  for (const sms of messages) {
    const body = String(sms.message || '');
    const transactionMatch = body.match(/\bTXN[_\s-]*ID\s*:\s*([A-Z0-9.-]+)/i);
    const amountMatch = body.match(/\bBundle\s*Amt(?:ount)?\s*:\s*(?:NGN|N|₦)?\s*([\d,]+(?:\.\d{1,2})?)/i);
    const looksLikeBundle = /\b(bundle|renew(?:al|ed)?|subscrib(?:e|ed|ption))\b/i.test(body);
    if (!transactionMatch && !(amountMatch && looksLikeBundle)) continue;

    const amountNGN = amountMatch ? Number.parseFloat(amountMatch[1].replace(/,/g, '')) : null;
    const normalizedDate = normalizeSmsDate(sms.date) || sms.date || null;
    const id = sms.id || transactionMatch?.[1] || `${normalizedDate || 'unknown'}-${sms.time || subscriptions.size}`;
    const dedupeKey = transactionMatch?.[1] || id;
    subscriptions.set(dedupeKey, {
      id,
      date: normalizedDate,
      time: sms.time || null,
      sender: sms.sender || null,
      transactionId: transactionMatch?.[1] || null,
      amountNGN: Number.isFinite(amountNGN) ? amountNGN : null,
      message: body.trim(),
    });
  }

  return [...subscriptions.values()].sort((a, b) => {
    const left = `${a.date || ''}T${a.time || ''}`;
    const right = `${b.date || ''}T${b.time || ''}`;
    return left.localeCompare(right);
  });
}

async function readUsage({ host, username, password }) {
  let sessionId = await getSession(host, username, password);
  let response = await routerRequest(host, {
    page_num: -1,
    subcmd: 0,
    cmd: 'ee71744e-50b4-4d2a-9c2d-0c4c7b968fc5',
    method: 'GET',
    sessionId,
  });

  if (!response.success) {
    sessions.delete(host);
    sessionId = await getSession(host, username, password, true);
    response = await routerRequest(host, {
      page_num: -1,
      subcmd: 0,
      cmd: 'ee71744e-50b4-4d2a-9c2d-0c4c7b968fc5',
      method: 'GET',
      sessionId,
    });
  }

  if (!response.success) throw new Error('The router did not return its SMS inbox');
  const messages = parseSmsEntries(response.sms_list);
  return { usage: extractUsage(messages), subscriptions: extractSubscriptions(messages), messages };
}

async function syncUsage(settings) {
  const provider = cleanProvider(settings.provider);
  const host = cleanHost(settings.host, provider);
  if (!settings.username || !settings.password) throw new Error('Enter the router username and password');

  const { usage, subscriptions, messages } = await readUsage({ ...settings, host });
  const snapshot = {
    usage,
    subscriptions,
    messages,
    lastSync: new Date().toISOString(),
  };
  await chrome.storage.local.set({
    snapshot,
    settings: storedSettings(settings, host),
  });
  return snapshot;
}

function normalizeMetric(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function signalRating(status) {
  const sinr = typeof status.sinr === 'number' ? status.sinr : null;
  const rsrq = typeof status.rsrq === 'number' ? status.rsrq : null;
  const rsrp = typeof status.rsrp === 'number' ? status.rsrp : null;
  if (sinr !== null && rsrq !== null) {
    if (sinr >= 10 && rsrq >= -10) return 'Excellent';
    if (sinr >= 3 && rsrq >= -13) return 'Good';
    if (sinr >= 0 && rsrq >= -16) return 'Fair';
    return 'Poor';
  }
  if (rsrp !== null) return rsrp >= -80 ? 'Good' : rsrp >= -95 ? 'Fair' : 'Poor';
  return 'Unknown';
}

function normalizeStatus(payload) {
  const status = {
    networkType: payload.network_type_str || payload.network_type || payload.networkMode || null,
    sinr: normalizeMetric(payload.SINR ?? payload.sinr),
    rsrp: normalizeMetric(payload.RSRP ?? payload.rsrp),
    rsrq: normalizeMetric(payload.RSRQ ?? payload.rsrq),
    rssi: normalizeMetric(payload.RSSI ?? payload.rssi),
    freq: normalizeMetric(payload.FREQ ?? payload.freq ?? payload.frequency),
    currentBand: payload.currentband || payload.current_band || payload.band || null,
    bandwidth: payload.bandwidth || payload.band_width || null,
    uptime: payload.uptime ?? payload.run_time ?? null,
    firmwareVersion: payload.fake_version || payload.firmware_version || payload.software_version || null,
  };
  status.signalRating = signalRating(status);
  return status;
}

async function readStatus(settings) {
  const host = cleanHost(settings.host, settings.provider);
  const sessionIds = [''];
  const existingSession = sessions.get(host);
  if (existingSession) {
    sessionIds.push(existingSession);
  } else if (settings.password) {
    sessionIds.push(await getSession(host, settings.username, settings.password));
  }

  for (const sessionId of sessionIds) {
    const response = await routerRequest(host, {
      cmd: STATUS_COMMAND,
      method: 'GET',
      sessionId,
    });
    if (response.success) return normalizeStatus(response);
  }

  throw new Error('This router firmware did not return radio metrics');
}

async function dashboardData(settings) {
  const provider = cleanProvider(settings.provider);
  const host = cleanHost(settings.host, provider);
  const { usage, subscriptions, messages } = await readUsage({ ...settings, host });
  let status = null;
  try {
    status = await readStatus({ ...settings, host });
  } catch {
    // Usage remains useful when this router firmware does not expose radio health.
  }
  const snapshot = { usage, subscriptions, messages, lastSync: new Date().toISOString() };
  await chrome.storage.local.set({
    snapshot,
    settings: {
      host,
      ...storedSettings(settings, host),
    },
  });
  return {
    success: true,
    data: usage,
    routerConnected: true,
    routerStatus: status,
    fetchedAt: status ? new Date().toISOString() : null,
    lastSync: snapshot.lastSync,
    hosted: false,
    source: 'local-extension',
    providerKey: provider,
    provider: providerLabel(provider),
    routerHost: host,
    routerModel: routerMetadata.get(host)?.modelName || null,
    subscriptions,
    messages,
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!['sync', 'dashboard-data', 'router-status'].includes(message?.type)) return undefined;

  const task = message.type === 'sync'
    ? syncUsage(message.settings).then((snapshot) => ({ success: true, snapshot }))
    : message.type === 'dashboard-data'
      ? dashboardData(message.settings)
      : readStatus(message.settings).then((data) => ({ success: true, data, fetchedAt: new Date().toISOString() }));

  task
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ success: false, error: error.message || 'Could not read the router' }));

  return true;
});

chrome.action.onClicked.addListener(async () => {
  await chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});

/* ============================================
   AIRTEL DATA TRACKER - App Logic
   ============================================ */

let usageData = [];
let currentRange = 7;
let routerStatus = null;
let sourceMessages = [];
let tableFilter = '';
let tableSort = 'recent';
let tableFromDate = '';
let tableToDate = '';
let tableVisibleCount = 25;
let autoRefreshEnabled = true;
let routerPollTimer = null;
const TABLE_PAGE_SIZE = 25;

/* ============================================
   Utility
   ============================================ */

function formatGB(mb) {
  const gb = mb / 1024;
  if (gb >= 1024) return `${(gb / 1024).toFixed(2)} TB`;
  if (gb >= 100) return `${gb.toFixed(0)} GB`;
  if (gb >= 10) return `${gb.toFixed(1)} GB`;
  if (gb < 1) return `${gb.toFixed(3)} GB`;
  return `${gb.toFixed(2)} GB`;
}

function formatRawGB(mb) {
  return `${(mb / 1024).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} GB`;
}

function formatDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDayName(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function getFullDayName(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'long' });
}

function timeAgo(isoStr) {
  if (!isoStr) return 'Never';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatTimestamp(isoStr) {
  if (!isoStr) return '-';
  return new Date(isoStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatFreshness(dateStr) {
  const today = getTodayDateString();
  if (dateStr === today) return 'Current today';
  const dayDiff = Math.round((new Date(`${today}T00:00:00`) - new Date(`${dateStr}T00:00:00`)) / 86400000);
  return dayDiff > 0 ? `${dayDiff}d behind` : 'Latest available';
}

function formatMetric(value, suffix = '') {
  if (value === null || value === undefined || value === '') return '-';
  return `${value}${suffix}`;
}

function formatUptime(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') return '-';
  const totalSeconds = Number(rawValue);
  if (!Number.isFinite(totalSeconds)) return String(rawValue);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function meterPercent(value, min, max) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 0;
  return clamp(((Number(value) - min) / (max - min)) * 100, 0, 100);
}

function setProviderBrand(providerKey = 'auto') {
  const key = String(providerKey || 'auto').toLowerCase();
  const provider = key.includes('mtn') ? 'mtn' : key.includes('airtel') ? 'airtel' : 'other';
  document.body.classList.remove('provider-airtel', 'provider-mtn', 'provider-other');
  document.body.classList.add(`provider-${provider}`);

  const favicon = document.getElementById('appFavicon');
  if (!favicon) return;
  const isMtn = provider === 'mtn';
  const isAirtel = provider === 'airtel';
  const color = isMtn ? '#ffcc00' : isAirtel ? '#e21b2d' : '#334155';
  const initial = isMtn ? 'M' : isAirtel ? 'A' : 'D';
  const textColor = isMtn ? '#172033' : '#ffffff';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="24" fill="${color}"/><text x="50" y="68" text-anchor="middle" font-family="Arial" font-size="58" font-weight="700" fill="${textColor}">${initial}</text></svg>`;
  favicon.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function renderSmsMessages() {
  const list = document.getElementById('smsList');
  const empty = document.getElementById('smsEmpty');
  if (!list || !empty) return;
  list.replaceChildren();
  const navCount = document.getElementById('smsNavCount');
  if (navCount) navCount.textContent = sourceMessages.length;
  empty.classList.toggle('hidden', sourceMessages.length > 0);

  sourceMessages.slice().reverse().forEach((sms) => {
    const item = document.createElement('article');
    item.className = 'sms-item';
    const meta = document.createElement('div');
    meta.className = 'sms-meta';
    const sender = document.createElement('strong');
    sender.textContent = sms.sender && !/^[01]$/.test(String(sms.sender)) ? sms.sender : 'Router service';
    const timestamp = document.createElement('span');
    timestamp.textContent = [sms.date, sms.time].filter(Boolean).join(' · ') || 'Undated message';
    meta.append(sender, timestamp);
    const message = document.createElement('p');
    message.className = 'sms-message';
    message.textContent = sms.message || 'Unreadable message';
    item.append(meta, message);
    list.append(item);
  });
}

function setView(view, updateHash = true) {
  const allowedViews = ['overview', 'network', 'messages'];
  const activeView = allowedViews.includes(view) ? view : 'overview';
  document.querySelectorAll('[data-view]').forEach((section) => {
    section.classList.toggle('hidden', section.dataset.view !== activeView);
  });
  document.querySelectorAll('.nav-item').forEach((button) => {
    const isActive = button.dataset.viewTarget === activeView;
    button.classList.toggle('active', isActive);
    if (isActive) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (updateHash && window.location.hash !== `#${activeView}`) {
    window.history.replaceState(null, '', `#${activeView}`);
  }
  if (activeView === 'overview' && usageData.length > 0) {
    window.requestAnimationFrame(drawChart);
  }
}

function bindNavigation() {
  document.querySelectorAll('.nav-item').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.viewTarget));
  });
  window.addEventListener('hashchange', () => setView(window.location.hash.slice(1), false));
}

/* ============================================
   Data Fetching
   ============================================ */

function cleanExtensionHost(value) {
  return String(value || '192.168.1.1').trim().replace(/^https?:\/\//i, '').split('/')[0];
}

function defaultExtensionHost(provider) {
  return provider === 'mtn' ? '192.168.0.1' : '192.168.1.1';
}

function updateAddressHint() {
  const provider = document.getElementById('extensionProvider').value;
  const hint = document.getElementById('addressHint');
  hint.textContent = provider === 'mtn'
    ? 'MTN commonly uses 192.168.0.1. Check the router label if yours differs.'
    : provider === 'airtel'
      ? 'Airtel commonly uses 192.168.1.1 or 192.168.0.1.'
      : 'Common router addresses include 192.168.1.1, 192.168.0.1, and 192.168.8.1.';
}

function populateSetup(settings = {}) {
  const provider = settings.provider || 'auto';
  document.getElementById('extensionProvider').value = provider;
  document.getElementById('extensionRouterHost').value = settings.host || defaultExtensionHost(provider);
  document.getElementById('extensionRouterUsername').value = settings.username || 'admin';
  document.getElementById('extensionRouterPassword').value = settings.password || '';
  document.getElementById('extensionRememberPassword').checked = Boolean(settings.rememberPassword);
  updateAddressHint();
}

async function requestRouterPermission(host) {
  const origin = `http://${cleanExtensionHost(host)}/*`;
  const alreadyGranted = await chrome.permissions.contains({ origins: [origin] });
  if (alreadyGranted) return true;
  return chrome.permissions.request({ origins: [origin] });
}

function showExtensionSetup(message = '') {
  document.getElementById('loadingScreen').classList.add('hidden');
  document.getElementById('errorScreen').classList.add('hidden');
  document.getElementById('dashboard').classList.add('hidden');
  document.querySelector('.app-nav').classList.add('hidden');
  document.getElementById('portalStatus').classList.add('hidden');
  document.getElementById('extensionSetup').classList.remove('hidden');
  if (message) document.getElementById('setupError').textContent = message;
}

async function fetchUsageData(settingsOverride = null) {
  const refreshBtn = document.getElementById('refreshBtn');
  const loadingScreen = document.getElementById('loadingScreen');
  const errorScreen = document.getElementById('errorScreen');
  const dashboard = document.getElementById('dashboard');
  const status = document.getElementById('connectionStatus');
  const cacheNotice = document.getElementById('cacheNotice');
  const appNav = document.querySelector('.app-nav');
  const portalStatus = document.getElementById('portalStatus');

  refreshBtn.classList.add('spinning');
  loadingScreen.classList.remove('hidden');
  errorScreen.classList.add('hidden');
  dashboard.classList.add('hidden');
  appNav.classList.add('hidden');
  portalStatus.classList.add('hidden');

  status.className = 'connection-status';
  status.querySelector('span').textContent = 'Connecting...';

  try {
    const stored = await chrome.storage.local.get(['settings']);
    const settings = settingsOverride || stored.settings;
    if (!settings?.host || !settings?.username || !settings?.password) {
      populateSetup(settings || {});
      showExtensionSetup();
      return;
    }

    let result;
    let isStaticMode = false;
    let routerStatusResult = null;

    result = await chrome.runtime.sendMessage({ type: 'dashboard-data', settings });
    if (!result?.success) throw new Error(result?.error || 'Could not read the router');
    if (result.routerStatus) {
      routerStatusResult = {
        success: true,
        data: result.routerStatus,
        fetchedAt: result.fetchedAt,
      };
    }

    usageData = result.data;
    sourceMessages = Array.isArray(result.messages) ? result.messages : [];
    routerStatus = routerStatusResult && routerStatusResult.success ? routerStatusResult.data : null;
    setProviderBrand(result.providerKey || result.provider);
    document.querySelector('.logo-sub').textContent = `${result.provider || 'Mobile broadband'} · local-first`;

    loadingScreen.classList.add('hidden');
    document.getElementById('extensionSetup').classList.add('hidden');
    dashboard.classList.remove('hidden');
    appNav.classList.remove('hidden');
    portalStatus.classList.remove('hidden');
    document.getElementById('railProvider').textContent = result.provider || 'Router';
    document.getElementById('railHost').textContent = result.routerHost || settings.host;
    document.getElementById('routerModel').textContent = result.routerModel || 'Router ODU';

    if (result.routerConnected) {
      status.classList.add('connected');
      status.querySelector('span').textContent = `${result.provider || 'Router'} connected`;
      cacheNotice.classList.add('hidden');
    } else {
      status.classList.add('connected');
      status.querySelector('span').textContent = 'Saved snapshot';
      cacheNotice.classList.remove('hidden');
      document.getElementById('lastSyncTime').textContent = timeAgo(result.lastSync);
      document.getElementById('cacheNoticeLabel').textContent = 'Saved snapshot';
    }

    updateStats();
    updateHighlights();
    updateRouterHealth(isStaticMode, routerStatusResult ? routerStatusResult.fetchedAt : null);
    updateBrief(isStaticMode);
    drawChart();
    tableVisibleCount = TABLE_PAGE_SIZE;
    renderTable();
    renderSmsMessages();
    setView(window.location.hash.slice(1), false);

    document.getElementById('lastUpdate').textContent = new Date().toLocaleString();
  } catch (error) {
    console.error('Fetch error:', error);
    loadingScreen.classList.add('hidden');
    errorScreen.classList.remove('hidden');
    status.classList.add('error');
    status.querySelector('span').textContent = 'Disconnected';
    document.getElementById('errorMessage').textContent = error.message;
  } finally {
    refreshBtn.classList.remove('spinning');
  }
}

async function refreshRouterStatusOnly() {
  if (!autoRefreshEnabled) return;

  try {
    const stored = await chrome.storage.local.get(['settings']);
    if (!stored.settings?.password) return;
    const result = await chrome.runtime.sendMessage({ type: 'router-status', settings: stored.settings });
    if (!result.success) throw new Error(result.error || 'Router status unavailable');
    routerStatus = result.data;
    updateRouterHealth(false, result.fetchedAt);
    updateBrief(false);
  } catch (error) {
    routerStatus = null;
    updateRouterHealth(false, null);
    updateBrief(false);
  }
}

/* ============================================
   Router UI
   ============================================ */

function describeSignal(statusData) {
  if (!statusData) return 'Router status unavailable';

  const pieces = [];
  if (statusData.rsrp !== null) pieces.push(`RSRP ${statusData.rsrp} dBm`);
  if (statusData.rsrq !== null) pieces.push(`RSRQ ${statusData.rsrq} dB`);
  if (statusData.sinr !== null) pieces.push(`SINR ${statusData.sinr} dB`);
  return pieces.join(' | ') || 'No live radio metrics returned';
}

function updateBrief(isStaticMode) {
  const headline = document.getElementById('briefHeadline');
  const text = document.getElementById('briefText');
  const pollStatus = document.getElementById('livePollStatus');

  pollStatus.textContent = autoRefreshEnabled ? 'Every 30s' : 'Paused';

  if (!routerStatus) {
    headline.textContent = isStaticMode ? 'Saved history loaded' : 'Live router check unavailable';
    text.textContent = isStaticMode
      ? 'You can still review usage history, but live radio metrics need the local router connection.'
      : 'Usage history is available, but the router did not return fresh radio data on the last check.';
    return;
  }

  const latest = usageData.length ? usageData[usageData.length - 1] : null;
  const rating = (routerStatus.signalRating || 'Unknown').toLowerCase();
  headline.textContent = `${routerStatus.networkType || 'Network'} is currently ${rating}`;
  text.textContent = latest
    ? `Latest recorded usage was ${formatGB(latest.usageMB)} on ${formatDate(latest.date)}. Live radio quality is ${rating}, with ${describeSignal(routerStatus).toLowerCase()}.`
    : `Live radio quality is ${rating}, with ${describeSignal(routerStatus).toLowerCase()}.`;
}

function updateSignalMeter(fillId, labelId, value, min, max, suffix) {
  const fill = document.getElementById(fillId);
  const label = document.getElementById(labelId);
  fill.style.width = `${meterPercent(value, min, max)}%`;
  label.textContent = formatMetric(value, suffix);
}

function updateRouterHealth(isStaticMode, fetchedAt) {
  const healthPill = document.getElementById('routerHealthPill');
  const signalRatingEl = document.getElementById('signalRating');
  const signalSummaryEl = document.getElementById('signalSummary');
  const checkTimeEl = document.getElementById('routerCheckTime');
  const networkConsole = document.querySelector('.network-console');

  checkTimeEl.textContent = fetchedAt ? formatTimestamp(fetchedAt) : '-';

  if (!routerStatus) {
    healthPill.textContent = isStaticMode ? 'Static mode' : 'Unavailable';
    healthPill.className = 'router-health-pill router-health-offline';
    signalRatingEl.textContent = isStaticMode ? 'Static only' : 'Offline';
    signalSummaryEl.textContent = isStaticMode
      ? 'Live router metrics need the local Node server'
      : 'Could not read live router health from the ZTE API';
    document.getElementById('railNetworkType').textContent = '-';
    document.getElementById('railBand').textContent = '-';
    document.getElementById('railSignal').textContent = 'Unavailable';
    if (networkConsole) networkConsole.dataset.signal = 'unknown';

    [
      'networkType', 'currentBand', 'rsrpValue', 'rsrqValue', 'sinrValue', 'rssiValue',
      'bandwidthValue', 'uptimeValue', 'firmwareValue', 'freqValue',
      'rsrpMeterLabel', 'rsrqMeterLabel', 'sinrMeterLabel',
    ].forEach((id) => {
      document.getElementById(id).textContent = '-';
    });

    ['rsrpMeter', 'rsrqMeter', 'sinrMeter'].forEach((id) => {
      document.getElementById(id).style.width = '0%';
    });
    return;
  }

  const rating = (routerStatus.signalRating || 'Unknown').toLowerCase();
  const pillClass = rating === 'excellent' || rating === 'good'
    ? 'router-health-good'
    : rating === 'fair'
      ? 'router-health-fair'
      : 'router-health-poor';

  healthPill.textContent = routerStatus.signalRating || 'Unknown';
  healthPill.className = `router-health-pill ${pillClass}`;

  signalRatingEl.textContent = routerStatus.signalRating || 'Unknown';
  signalSummaryEl.textContent = describeSignal(routerStatus);
  document.getElementById('railNetworkType').textContent = routerStatus.networkType || '-';
  document.getElementById('railBand').textContent = routerStatus.currentBand || '-';
  document.getElementById('railSignal').textContent = routerStatus.signalRating || 'Unknown';
  if (networkConsole) networkConsole.dataset.signal = rating;

  document.getElementById('networkType').textContent = routerStatus.networkType || 'Unknown';
  document.getElementById('currentBand').textContent = routerStatus.currentBand || 'Band not reported';
  document.getElementById('rsrpValue').textContent = formatMetric(routerStatus.rsrp, ' dBm');
  document.getElementById('rsrqValue').textContent = formatMetric(routerStatus.rsrq, ' dB');
  document.getElementById('sinrValue').textContent = formatMetric(routerStatus.sinr, ' dB');
  document.getElementById('rssiValue').textContent = formatMetric(routerStatus.rssi, ' dBm');
  document.getElementById('bandwidthValue').textContent = routerStatus.bandwidth || '-';
  document.getElementById('uptimeValue').textContent = formatUptime(routerStatus.uptime);
  document.getElementById('firmwareValue').textContent = routerStatus.firmwareVersion || '-';
  document.getElementById('freqValue').textContent = routerStatus.freq || '-';

  updateSignalMeter('rsrpMeter', 'rsrpMeterLabel', routerStatus.rsrp, -120, -70, ' dBm');
  updateSignalMeter('rsrqMeter', 'rsrqMeterLabel', routerStatus.rsrq, -20, -5, ' dB');
  updateSignalMeter('sinrMeter', 'sinrMeterLabel', routerStatus.sinr, -5, 20, ' dB');
}

/* ============================================
   Stats
   ============================================ */

function updateStats() {
  if (usageData.length === 0) return;

  const latest = usageData[usageData.length - 1];
  document.getElementById('latestLabel').textContent = latest.date === getTodayDateString() ? 'Today' : 'Latest reading';
  document.getElementById('todayUsage').textContent = formatGB(latest.usageMB);
  document.getElementById('todayDate').textContent = `${formatDate(latest.date)} · ${formatFreshness(latest.date)}`;

  const last7 = usageData.slice(-7);
  const weekTotal = last7.reduce((sum, d) => sum + d.usageMB, 0);
  const weekAvg = weekTotal / last7.length;
  document.getElementById('weekUsage').textContent = formatGB(weekTotal);
  document.getElementById('weekAvg').textContent = `Avg: ${formatGB(weekAvg)}/day`;

  const totalAll = usageData.reduce((sum, d) => sum + d.usageMB, 0);
  document.getElementById('monthUsage').textContent = formatGB(totalAll);
  document.getElementById('monthDays').textContent = `${usageData.length} days · ${formatRawGB(totalAll)}`;

  const avgAll = totalAll / usageData.length;
  document.getElementById('avgUsage').textContent = formatGB(avgAll);
  document.getElementById('avgPeriod').textContent = `Over ${usageData.length} days`;

  const first = usageData[0];
  document.getElementById('historyWindow').textContent = `${formatDate(first.date)} – ${formatDate(latest.date)}`;
  document.getElementById('dataFreshness').textContent = formatFreshness(latest.date);
}

function updateHighlights() {
  if (usageData.length === 0) return;

  const peak = usageData.reduce((max, d) => d.usageMB > max.usageMB ? d : max);
  document.getElementById('peakValue').textContent = formatGB(peak.usageMB);
  document.getElementById('peakDate').textContent = `${formatDate(peak.date)} | ${getFullDayName(peak.date)}`;

  const low = usageData.reduce((min, d) => d.usageMB < min.usageMB ? d : min);
  document.getElementById('lowValue').textContent = formatGB(low.usageMB);
  document.getElementById('lowDate').textContent = `${formatDate(low.date)} | ${getFullDayName(low.date)}`;

  const first = usageData[0];
  const last = usageData[usageData.length - 1];
  document.getElementById('streakValue').textContent = `${usageData.length} days`;
  document.getElementById('streakDate').textContent = `${formatDate(first.date)} -> ${formatDate(last.date)}`;
}

/* ============================================
   Chart
   ============================================ */

function drawChart() {
  const canvas = document.getElementById('usageChart');
  const container = document.getElementById('chartContainer');
  const ctx = canvas.getContext('2d');

  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const data = usageData.slice(-currentRange);
  if (data.length === 0) return;

  const padding = { top: 24, right: 24, bottom: 52, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const chartAccent = document.body.classList.contains('provider-mtn') ? '#d69e00' : '#e21b2d';
  const maxMB = Math.max(...data.map((d) => d.usageMB));
  const maxGB = Math.ceil(maxMB / 1024);
  const scaleMax = maxGB * 1024;

  ctx.clearRect(0, 0, width, height);

  const gridLines = 5;
  ctx.strokeStyle = 'rgba(23, 32, 51, 0.08)';
  ctx.lineWidth = 1;
  ctx.font = '500 11px Inter, sans-serif';
  ctx.fillStyle = '#758196';
  ctx.textAlign = 'right';

  for (let i = 0; i <= gridLines; i += 1) {
    const y = padding.top + (chartH / gridLines) * i;
    const value = scaleMax - (scaleMax / gridLines) * i;

    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    ctx.fillText(formatGB(value), padding.left - 10, y + 4);
  }

  const barCount = data.length;
  const maxBarWidth = 50;
  const barGap = Math.max(4, Math.min(12, (chartW / barCount) * 0.2));
  const barWidth = Math.min(maxBarWidth, (chartW - barGap * (barCount + 1)) / barCount);
  const totalBarsWidth = barCount * barWidth + (barCount + 1) * barGap;
  const offsetX = padding.left + (chartW - totalBarsWidth) / 2;

  const avg = data.reduce((sum, d) => sum + d.usageMB, 0) / data.length;
  const avgY = padding.top + chartH * (1 - avg / scaleMax);
  const points = data.map((d, i) => ({
    x: offsetX + barGap + i * (barWidth + barGap) + barWidth / 2,
    y: padding.top + chartH * (1 - d.usageMB / scaleMax),
  }));

  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padding.left, avgY);
  ctx.lineTo(width - padding.right, avgY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(79, 70, 229, 0.86)';
  ctx.textAlign = 'left';
  ctx.font = '600 10px Inter, sans-serif';
  ctx.fillText(`AVG ${formatGB(avg)}`, width - padding.right + 2, avgY - 5);

  data.forEach((d, i) => {
    const x = offsetX + barGap + i * (barWidth + barGap);
    const barH = (d.usageMB / scaleMax) * chartH;
    const y = padding.top + chartH - barH;
    const ratio = d.usageMB / avg;

    let barColor;
    if (ratio > 1.5) barColor = 'rgba(237, 28, 36, 0.85)';
    else if (ratio > 1.1) barColor = 'rgba(245, 158, 11, 0.85)';
    else barColor = 'rgba(16, 185, 129, 0.85)';

    const grad = ctx.createLinearGradient(x, y, x, padding.top + chartH);
    grad.addColorStop(0, barColor);
    grad.addColorStop(1, barColor.replace('0.85', '0.25'));

    const radius = Math.min(barWidth / 2, 6);
    ctx.beginPath();
    ctx.moveTo(x, padding.top + chartH);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.lineTo(x + barWidth - radius, y);
    ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
    ctx.lineTo(x + barWidth, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    if (barWidth > 20) {
      ctx.fillStyle = 'rgba(23, 32, 51, 0.84)';
      ctx.textAlign = 'center';
      ctx.font = `700 ${Math.min(10, barWidth * 0.28)}px Inter, sans-serif`;
      ctx.fillText(`${(d.usageMB / 1024).toFixed(1)}G`, x + barWidth / 2, y - 8);
    }

    if (barWidth > 14 || barCount <= 14) {
      ctx.fillStyle = '#758196';
      ctx.font = `500 ${Math.min(10, barWidth * 0.3)}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(formatDate(d.date), x + barWidth / 2, height - padding.bottom + 16);

      ctx.fillStyle = '#9aa5b5';
      ctx.font = `500 ${Math.min(9, barWidth * 0.25)}px Inter, sans-serif`;
      ctx.fillText(getDayName(d.date), x + barWidth / 2, height - padding.bottom + 28);
    }
  });

  if (points.length > 1) {
    const areaBottom = padding.top + chartH;
    ctx.beginPath();
    ctx.moveTo(points[0].x, areaBottom);
    points.forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.lineTo(points[points.length - 1].x, areaBottom);
    ctx.closePath();
    ctx.fillStyle = document.body.classList.contains('provider-mtn') ? 'rgba(214, 158, 0, 0.10)' : 'rgba(226, 27, 45, 0.07)';
    ctx.fill();

    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.strokeStyle = chartAccent;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = chartAccent;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  setupChartHover(canvas, data, offsetX, barGap, barWidth);
}

function setupChartHover(canvas, data, offsetX, barGap, barWidth) {
  const tooltip = document.getElementById('chartTooltip');

  canvas.onmousemove = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const barIndex = Math.floor((mx - offsetX - barGap / 2) / (barWidth + barGap));

    if (barIndex >= 0 && barIndex < data.length) {
      const d = data[barIndex];
      document.getElementById('tooltipDate').textContent = `${formatDate(d.date)} | ${getFullDayName(d.date)}`;
      document.getElementById('tooltipValue').textContent = formatGB(d.usageMB);
      tooltip.classList.remove('hidden');
      tooltip.style.left = `${Math.min(e.clientX - rect.left + 12, rect.width - 160)}px`;
      tooltip.style.top = `${e.clientY - rect.top - 60}px`;
    } else {
      tooltip.classList.add('hidden');
    }
  };

  canvas.onmouseleave = () => tooltip.classList.add('hidden');
}

function setRange(range) {
  currentRange = range;
  document.querySelectorAll('.chart-range').forEach((btn) => {
    btn.classList.toggle('active', parseInt(btn.dataset.range, 10) === range);
  });
  drawChart();
}

/* ============================================
   Table
   ============================================ */

function renderTable() {
  const tbody = document.getElementById('usageTableBody');
  const countEl = document.getElementById('tableCount');
  const emptyEl = document.getElementById('emptyTableState');
  const summaryEl = document.getElementById('tableSummary');
  const loadMoreButton = document.getElementById('loadMoreRows');

  if (usageData.length === 0) {
    tbody.innerHTML = '';
    countEl.textContent = '0 records';
    summaryEl.textContent = 'Showing 0 records';
    emptyEl.classList.remove('hidden');
    loadMoreButton.classList.add('hidden');
    return;
  }

  const avg = usageData.reduce((sum, d) => sum + d.usageMB, 0) / usageData.length;
  const maxMB = Math.max(...usageData.map((d) => d.usageMB));

  let filtered = [...usageData];
  if (tableFilter) {
    const query = tableFilter.toLowerCase();
    filtered = filtered.filter((d) =>
      d.date.toLowerCase().includes(query) ||
      getFullDayName(d.date).toLowerCase().includes(query) ||
      formatDate(d.date).toLowerCase().includes(query)
    );
  }

  if (tableFromDate) filtered = filtered.filter((d) => d.date >= tableFromDate);
  if (tableToDate) filtered = filtered.filter((d) => d.date <= tableToDate);

  let sorted = [...filtered];
  if (tableSort === 'highest') {
    sorted.sort((a, b) => b.usageMB - a.usageMB);
  } else if (tableSort === 'lowest') {
    sorted.sort((a, b) => a.usageMB - b.usageMB);
  } else {
    sorted.reverse();
  }

  countEl.textContent = `${sorted.length} records`;
  emptyEl.classList.toggle('hidden', sorted.length > 0);

  if (sorted.length === 0) {
    tbody.innerHTML = '';
    summaryEl.textContent = 'Showing 0 records';
    loadMoreButton.classList.add('hidden');
    return;
  }

  const visibleRows = sorted.slice(0, tableVisibleCount);
  summaryEl.textContent = `Showing ${visibleRows.length} of ${sorted.length} rows`;
  loadMoreButton.classList.toggle('hidden', visibleRows.length >= sorted.length);
  if (visibleRows.length < sorted.length) {
    loadMoreButton.textContent = `Load ${Math.min(TABLE_PAGE_SIZE, sorted.length - visibleRows.length)} more`;
  }

  tbody.innerHTML = visibleRows.map((d) => {
    const pctDiff = ((d.usageMB - avg) / avg * 100).toFixed(0);
    const isAbove = d.usageMB > avg;
    const pctLabel = isAbove ? `+${pctDiff}%` : `${pctDiff}%`;
    const arrow = isAbove ? 'up' : 'down';

    let usageClass = 'normal';
    if (d.usageMB > avg * 1.5) usageClass = 'high';
    else if (d.usageMB > avg * 1.1) usageClass = 'medium';

    const trendPct = Math.min((d.usageMB / maxMB) * 100, 100).toFixed(0);
    let trendColor;
    if (usageClass === 'high') trendColor = 'var(--airtel-red)';
    else if (usageClass === 'medium') trendColor = 'var(--accent-warning)';
    else trendColor = 'var(--accent-success)';

    return `
      <tr>
        <td><span class="usage-date">${formatDate(d.date)}</span></td>
        <td><span class="usage-day">${getFullDayName(d.date)}</span></td>
        <td><span class="usage-amount ${usageClass}">${formatGB(d.usageMB)}</span></td>
        <td>
          <span class="vs-average ${isAbove ? 'above' : 'below'}">
            ${arrow} ${pctLabel}
          </span>
        </td>
        <td>
          <div class="trend-bar">
            <div class="trend-fill" style="width: ${trendPct}%; background: ${trendColor};"></div>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

/* ============================================
   Controls
   ============================================ */

function bindControls() {
  const search = document.getElementById('tableSearch');
  const sort = document.getElementById('tableSort');
  const fromDate = document.getElementById('tableFromDate');
  const toDate = document.getElementById('tableToDate');
  const clearFilters = document.getElementById('clearFilters');
  const loadMoreButton = document.getElementById('loadMoreRows');
  const autoRefreshToggle = document.getElementById('autoRefreshToggle');
  const setupForm = document.getElementById('extensionSetupForm');
  const providerSelect = document.getElementById('extensionProvider');
  const hostInput = document.getElementById('extensionRouterHost');
  const smsToggle = document.getElementById('smsToggle');
  const smsPanel = document.getElementById('smsPanel');

  providerSelect.addEventListener('change', () => {
    if (!hostInput.value || ['192.168.1.1', '192.168.0.1'].includes(hostInput.value.trim())) {
      hostInput.value = defaultExtensionHost(providerSelect.value);
    }
    updateAddressHint();
  });

  const resetTableView = () => {
    tableVisibleCount = TABLE_PAGE_SIZE;
    renderTable();
  };

  setupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const settings = {
      provider: providerSelect.value,
      host: cleanExtensionHost(hostInput.value),
      username: document.getElementById('extensionRouterUsername').value.trim(),
      password: document.getElementById('extensionRouterPassword').value,
      rememberPassword: document.getElementById('extensionRememberPassword').checked,
    };

    const submitButton = setupForm.querySelector('button');
    submitButton.disabled = true;
    document.getElementById('setupError').textContent = '';
    try {
      const granted = await requestRouterPermission(settings.host);
      if (!granted) throw new Error('Chrome permission was not granted for this router address.');
      await fetchUsageData(settings);
    } catch (error) {
      document.getElementById('setupError').textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  });

  document.querySelectorAll('[data-action="refresh"]').forEach((button) => {
    button.addEventListener('click', fetchUsageData);
  });

  document.querySelectorAll('.chart-range').forEach((button) => {
    button.addEventListener('click', () => setRange(Number(button.dataset.range)));
  });

  search.addEventListener('input', (event) => {
    tableFilter = event.target.value.trim();
    resetTableView();
  });

  sort.addEventListener('change', (event) => {
    tableSort = event.target.value;
    resetTableView();
  });

  fromDate.addEventListener('change', (event) => {
    tableFromDate = event.target.value;
    resetTableView();
  });

  toDate.addEventListener('change', (event) => {
    tableToDate = event.target.value;
    resetTableView();
  });

  clearFilters.addEventListener('click', () => {
    tableFilter = '';
    tableFromDate = '';
    tableToDate = '';
    search.value = '';
    fromDate.value = '';
    toDate.value = '';
    sort.value = 'recent';
    tableSort = 'recent';
    resetTableView();
  });

  loadMoreButton.addEventListener('click', () => {
    tableVisibleCount += TABLE_PAGE_SIZE;
    renderTable();
  });

  smsToggle.addEventListener('click', () => {
    const isOpen = !smsPanel.classList.contains('hidden');
    smsPanel.classList.toggle('hidden', isOpen);
    smsToggle.setAttribute('aria-expanded', String(!isOpen));
    document.getElementById('smsToggleLabel').textContent = isOpen ? 'Show source SMS' : 'Hide source SMS';
    smsToggle.classList.toggle('is-open', !isOpen);
  });

  autoRefreshToggle.addEventListener('change', (event) => {
    autoRefreshEnabled = event.target.checked;
    document.getElementById('livePollStatus').textContent = autoRefreshEnabled ? 'Every 30s' : 'Paused';

    if (routerPollTimer) {
      clearInterval(routerPollTimer);
      routerPollTimer = null;
    }

    if (autoRefreshEnabled) {
      refreshRouterStatusOnly();
      routerPollTimer = setInterval(refreshRouterStatusOnly, 30000);
    }
  });
}

/* ============================================
   Resize
   ============================================ */

let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (usageData.length > 0) drawChart();
  }, 200);
});

/* ============================================
   Init
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  setProviderBrand('auto');
  bindNavigation();
  bindControls();
  fetchUsageData();
  routerPollTimer = setInterval(refreshRouterStatusOnly, 30000);
});

const $ = (selector) => document.querySelector(selector);

function showError(message) {
  const error = $('#errorMessage');
  error.textContent = message;
  error.classList.remove('hidden');
}

function setLoading(isLoading) {
  $('#loadingMessage').classList.toggle('hidden', !isLoading);
  $('#setupForm button').disabled = isLoading;
  $('#refreshButton').disabled = isLoading;
}

function cleanHost(value) {
  return String(value || '192.168.1.1').trim().replace(/^https?:\/\//i, '').split('/')[0];
}

async function requestRouterPermission(host) {
  const origin = `http://${cleanHost(host)}/*`;
  const alreadyGranted = await chrome.permissions.contains({ origins: [origin] });
  if (alreadyGranted) return true;
  return chrome.permissions.request({ origins: [origin] });
}

async function sync(settings) {
  const response = await chrome.runtime.sendMessage({ type: 'sync', settings });
  if (!response?.success) throw new Error(response?.error || 'Could not read the router');
  return response.snapshot;
}

function formatGB(mb) {
  const gb = mb / 1024;
  if (gb >= 1024) return `${(gb / 1024).toFixed(2)} TB`;
  if (gb >= 100) return `${gb.toFixed(0)} GB`;
  if (gb >= 10) return `${gb.toFixed(1)} GB`;
  if (gb < 1) return `${gb.toFixed(3)} GB`;
  return `${gb.toFixed(2)} GB`;
}

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function render(snapshot, settings) {
  const rows = Array.isArray(snapshot?.usage) ? snapshot.usage : [];
  const latest = rows[rows.length - 1];
  const last7 = rows.slice(-7);
  const total = rows.reduce((sum, row) => sum + Number(row.usageMB || 0), 0);
  const weekTotal = last7.reduce((sum, row) => sum + Number(row.usageMB || 0), 0);

  $('#setupView').classList.add('hidden');
  $('#dashboardView').classList.remove('hidden');
  $('#errorMessage').classList.add('hidden');
  $('#connectionTitle').textContent = `Connected to ${settings.host}`;
  $('#lastSync').textContent = snapshot.lastSync ? `Last read ${new Date(snapshot.lastSync).toLocaleString()}` : 'No sync yet';
  $('#latestUsage').textContent = latest ? formatGB(latest.usageMB) : '-';
  $('#latestDate').textContent = latest ? formatDate(latest.date) : '-';
  $('#weekUsage').textContent = formatGB(weekTotal);
  $('#weekAverage').textContent = last7.length ? `${formatGB(weekTotal / last7.length)} / day` : '-';
  $('#totalUsage').textContent = formatGB(total);
  $('#trackedDays').textContent = `${rows.length} days tracked`;
  $('#recordCount').textContent = `${rows.length} ${rows.length === 1 ? 'day' : 'days'}`;
  $('#usageRows').innerHTML = rows.slice().reverse().map((row) => `
    <tr><td>${formatDate(row.date)}</td><td>${new Date(`${row.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</td><td>${formatGB(row.usageMB)}</td></tr>
  `).join('');
}

async function loadSaved() {
  const stored = await chrome.storage.local.get(['settings', 'snapshot']);
  if (stored.settings?.host && stored.snapshot) render(stored.snapshot, stored.settings);
  else $('#setupView').classList.remove('hidden');

  if (stored.settings) {
    $('#routerHost').value = stored.settings.host || '192.168.1.1';
    $('#routerUsername').value = stored.settings.username || 'admin';
    $('#rememberPassword').checked = Boolean(stored.settings.rememberPassword);
    if (stored.settings.password) $('#routerPassword').value = stored.settings.password;
  }
}

$('#setupForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#errorMessage').classList.add('hidden');
  const settings = {
    host: cleanHost($('#routerHost').value),
    username: $('#routerUsername').value.trim(),
    password: $('#routerPassword').value,
    rememberPassword: $('#rememberPassword').checked,
  };

  try {
    setLoading(true);
    const granted = await requestRouterPermission(settings.host);
    if (!granted) throw new Error('Chrome permission was not granted for this router address.');
    const snapshot = await sync(settings);
    render(snapshot, settings);
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
});

$('#refreshButton').addEventListener('click', async () => {
  const stored = await chrome.storage.local.get(['settings']);
  if (!stored.settings?.host) return;
  try {
    $('#errorMessage').classList.add('hidden');
    setLoading(true);
    const snapshot = await sync({ ...stored.settings, password: stored.settings.password || $('#routerPassword').value });
    render(snapshot, stored.settings);
  } catch (error) {
    showError(error.message);
  } finally {
    setLoading(false);
  }
});

$('#editSettings').addEventListener('click', () => {
  $('#dashboardView').classList.add('hidden');
  $('#setupView').classList.remove('hidden');
  $('#routerPassword').focus();
});

loadSaved().catch((error) => showError(error.message));

// ═══════════════════════════════════════════════════════════
// OCTOPUS Social Bridge — Popup Controller
// ═══════════════════════════════════════════════════════════

// Keep-alive: long-lived port prevents Chrome from killing the service worker
// while the popup is open
const keepAlivePort = chrome.runtime.connect({ name: 'popup-keepalive' });

const OCTOPUS_URL = 'https://octopus-omni-cockpit-n8hd61.abacusai.app';

const PLATFORM_ICONS = {
  twitter: '𝕏', instagram: '📸', facebook: '📘',
  linkedin: '💼', tiktok: '🎵', pinterest: '📌',
  threads: '🧵', youtube: '▶️'
};

const PLATFORM_LABELS = {
  twitter: 'Twitter / X', instagram: 'Instagram', facebook: 'Facebook',
  linkedin: 'LinkedIn', tiktok: 'TikTok', pinterest: 'Pinterest',
  threads: 'Threads', youtube: 'YouTube'
};

// Elements
const $ = id => document.getElementById(id);
const loginSection = $('loginSection');
const connectedSection = $('connectedSection');
const statusBadge = $('statusBadge');
const platformList = $('platformList');
const loginBtn = $('loginBtn');
const logoutBtn = $('logoutBtn');
const refreshBtn = $('refreshBtn');
const startTrainBtn = $('startTrainBtn');
const stopTrainBtn = $('stopTrainBtn');

// ─── Password Toggle ───────────────────────────────────────
const togglePasswordBtn = $('togglePassword');
const eyeIcon = $('eyeIcon');
const eyeOffIcon = $('eyeOffIcon');
const passwordInput = $('passwordInput');

togglePasswordBtn.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  eyeIcon.style.display = isPassword ? 'none' : 'block';
  eyeOffIcon.style.display = isPassword ? 'block' : 'none';
  togglePasswordBtn.title = isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña';
});

// ─── Login ─────────────────────────────────────────────────
loginBtn.addEventListener('click', async () => {
  const email = $('emailInput').value.trim();
  const password = $('passwordInput').value;
  const errorEl = $('loginError');
  errorEl.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = 'Conectando...';

  try {
    const res = await fetch(`${OCTOPUS_URL}/api/social-bridge/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error de autenticación');

    // Store token and switch view
    await chrome.storage.local.set({
      token: data.token,
      userEmail: email,
      octopusUrl: OCTOPUS_URL
    });

    // Tell background to connect
    chrome.runtime.sendMessage({ action: 'login', token: data.token }, () => {
      showConnected(email);
    });
  } catch (e) {
    errorEl.textContent = e.message;
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Conectar';
  }
});

// ─── Logout ────────────────────────────────────────────────
logoutBtn.addEventListener('click', async () => {
  chrome.runtime.sendMessage({ action: 'logout' }, () => {
    chrome.storage.local.clear();
    showLogin();
  });
});

// ─── Refresh ───────────────────────────────────────────────
refreshBtn.addEventListener('click', () => {
  refreshBtn.disabled = true;
  refreshBtn.innerHTML = '<span class="spin-icon">🔄</span> Actualizando...';
  refreshBtn.style.opacity = '0.7';

  chrome.runtime.sendMessage({ action: 'detectPlatforms' }, (platforms) => {
    renderPlatforms(platforms || {});

    // Also refresh connection state from background
    chrome.runtime.sendMessage({ action: 'getState' }, (state) => {
      if (state && state.isConnected) {
        statusBadge.textContent = 'Online';
        statusBadge.className = 'badge badge-online';
      }
    });

    // Visual success feedback
    refreshBtn.innerHTML = '✅ Actualizado';
    refreshBtn.style.opacity = '1';
    setTimeout(() => {
      refreshBtn.innerHTML = '🔄 Actualizar';
      refreshBtn.disabled = false;
    }, 1200);
  });
});

// ─── Training Mode ─────────────────────────────────────────
startTrainBtn.addEventListener('click', () => {
  const platform = $('trainPlatform').value;
  const actionType = $('trainAction').value;
  if (!platform) { $('trainStatus').textContent = 'Selecciona una red primero'; return; }

  chrome.runtime.sendMessage(
    { action: 'startTraining', platform, actionType },
    () => {
      startTrainBtn.style.display = 'none';
      stopTrainBtn.style.display = 'block';
      $('trainStatus').textContent = '🔴 Grabando... Navega y haz clicks normalmente';
      statusBadge.textContent = 'Grabando';
      statusBadge.className = 'badge badge-recording';
    }
  );
});

stopTrainBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'stopTraining' }, (result) => {
    startTrainBtn.style.display = 'block';
    stopTrainBtn.style.display = 'none';
    $('trainStatus').textContent = result?.saved
      ? `✅ Guardado: ${result.steps} pasos registrados`
      : `⚠️ ${result?.steps || 0} pasos (no guardado)`;
    statusBadge.textContent = 'Online';
    statusBadge.className = 'badge badge-online';
  });
});

// ─── Render helpers ────────────────────────────────────────
function renderPlatforms(platforms) {
  platformList.innerHTML = '';
  let connected = 0, total = 0;
  const trainSelect = $('trainPlatform');
  trainSelect.innerHTML = '<option value="">Seleccionar red...</option>';

  for (const [name, info] of Object.entries(platforms)) {
    total++;
    const isActive = info.detected;
    if (isActive) connected++;

    const div = document.createElement('div');
    div.className = `platform-item ${isActive ? 'active' : ''}`;
    div.innerHTML = `
      <div class="platform-info">
        <span class="platform-icon">${PLATFORM_ICONS[name] || '🌐'}</span>
        <span class="platform-name">${PLATFORM_LABELS[name] || name}</span>
      </div>
      <span class="platform-status ${isActive ? 'status-active' : 'status-inactive'}">
        ${isActive ? '● Activa' : '○ No detectada'}
      </span>
    `;
    platformList.appendChild(div);

    if (isActive) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = PLATFORM_LABELS[name];
      trainSelect.appendChild(opt);
    }
  }

  $('connectedCount').textContent = connected;
  $('pendingCount').textContent = total - connected;
}

function showConnected(email) {
  loginSection.style.display = 'none';
  connectedSection.style.display = 'block';
  $('userEmail').textContent = email;
  $('dashboardLink').href = `${OCTOPUS_URL}/dashboard/social-bridge`;
  statusBadge.textContent = 'Online';
  statusBadge.className = 'badge badge-online';

  // Detect platforms
  chrome.runtime.sendMessage({ action: 'detectPlatforms' }, (platforms) => {
    renderPlatforms(platforms || {});
  });
}

function showLogin() {
  loginSection.style.display = 'block';
  connectedSection.style.display = 'none';
  statusBadge.textContent = 'Offline';
  statusBadge.className = 'badge badge-offline';
}

// ─── Initialize ────────────────────────────────────────────
async function init() {
  const data = await chrome.storage.local.get(['token', 'userEmail', 'isConnected']);
  if (data.token && data.userEmail) {
    showConnected(data.userEmail);
    if (data.isConnected) {
      statusBadge.textContent = 'Online';
      statusBadge.className = 'badge badge-online';
    }
  } else {
    showLogin();
  }
}

init();

/**
 * HOMELAB SWITCHBOARD // CONTROLLER & STATE ENGINE
 * Vanilla ES6+ | Zero Third-Party Dependencies
 */

(() => {
  'use strict';

  // --- Configuration & State ---
  const CONFIG = {
    servicesPath: './services.json',
    defaultRole: 'admin', // kid | guest | admin
    adminPin: '1234', // Accidental tap/guardrail PIN
    telemetryTimeoutMs: 2500,
    rttPingTarget: 'https://1.1.1.1/cdn-cgi/trace',
    weatherLat: 53.48, // Salford coordinates
    weatherLon: -2.27,
  };

  const state = {
    role: localStorage.getItem('hub_role') || CONFIG.defaultRole,
    services: [],
    activeTab: 'ALL',
    activeSubtab: 'ALL',
    searchQuery: '',
    pinBuffer: '',
  };

  // --- DOM Selectors ---
  const dom = {
    clock: document.getElementById('hud-clock'),
    ip: document.getElementById('hud-ip'),
    ping: document.getElementById('hud-ping'),
    weather: document.getElementById('hud-weather'),
    shellBtn: document.getElementById('btn-shell'),
    roleGateBtn: document.getElementById('btn-role-gate'),
    roleBadge: document.getElementById('current-role-label'),
    searchInput: document.getElementById('search-input'),
    searchClear: document.getElementById('search-clear'),
    primaryTabs: document.getElementById('primary-tabs'),
    subFilters: document.getElementById('sub-filters'),
    servicesGrid: document.getElementById('services-grid'),
    pinModal: document.getElementById('pin-modal'),
    pinCloseBtn: document.getElementById('pin-close-btn'),
    pinDots: document.getElementById('pin-dots'),
    pinError: document.getElementById('pin-error'),
    pinKeypad: document.getElementById('pin-keypad'),
    dropKidBtn: document.getElementById('btn-drop-kid'),
  };

  // --- Utility Functions ---
  const triggerHaptic = (ms = 8) => {
    if ('vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch (_) {
        // Suppress if vibration not permitted
      }
    }
  };

  const sanitizeStr = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  const fetchWithTimeout = async (url, options = {}, timeoutMs = CONFIG.telemetryTimeoutMs) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  };

  // --- Window App Container Launcher ---
  const openAppContainer = (url) => {
    triggerHaptic(12);
    if (!url) return;

    // Relative links (e.g., HSK1 module) or internal paths
    if (url.startsWith('./') || url.startsWith('/')) {
      window.location.href = url;
      return;
    }

    const width = Math.min(window.screen.availWidth * 0.9, 1440);
    const height = Math.min(window.screen.availHeight * 0.88, 960);
    const left = Math.max((window.screen.availWidth - width) / 2, 0);
    const top = Math.max((window.screen.availHeight - height) / 2, 0);

    const windowFeatures = `popup=yes,width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes,status=no,toolbar=no,menubar=no,location=no`;

    try {
      const win = window.open(url, '_blank', windowFeatures);
      // If popup was blocked or window returned null, fallback to clean standard tab
      if (!win || win.closed || typeof win.closed === 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch (_) {
      window.location.href = url;
    }
  };

  // --- Role & Gatekeeper Management ---
  const setRole = (newRole) => {
    state.role = newRole;
    localStorage.setItem('hub_role', newRole);
    dom.roleBadge.textContent = newRole.toUpperCase();
    renderTabs();
    renderCards();
  };

  const openPinModal = () => {
    triggerHaptic(8);
    state.pinBuffer = '';
    updatePinDots();
    dom.pinError.hidden = true;
    dom.pinModal.hidden = false;
  };

  const closePinModal = () => {
    dom.pinModal.hidden = true;
    state.pinBuffer = '';
  };

  const updatePinDots = () => {
    const dots = dom.pinDots.querySelectorAll('.dot');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('filled', idx < state.pinBuffer.length);
    });
  };

  const handlePinInput = (digit) => {
    triggerHaptic(8);
    if (state.pinBuffer.length < 4) {
      state.pinBuffer += digit;
      updatePinDots();
      dom.pinError.hidden = true;

      if (state.pinBuffer.length === 4) {
        verifyPin();
      }
    }
  };

  const verifyPin = () => {
    if (state.pinBuffer === CONFIG.adminPin) {
      triggerHaptic([15, 40, 15]);
      setRole('admin');
      closePinModal();
    } else {
      triggerHaptic(40);
      dom.pinError.hidden = false;
      state.pinBuffer = '';
      setTimeout(updatePinDots, 250);
    }
  };

  // --- Telemetry Diagnostics ---
  const initClock = () => {
    const updateTime = () => {
      const now = new Date();
      dom.clock.textContent = now.toTimeString().split(' ')[0];
    };
    updateTime();
    setInterval(updateTime, 1000);
  };

  const pollIp = async () => {
    try {
      const res = await fetchWithTimeout('https://api.ipify.org?format=json');
      const data = await res.json();
      dom.ip.textContent = data.ip || 'ONLINE';
    } catch (_) {
      dom.ip.textContent = 'ONLINE';
    }
  };

  const probeEdgePing = async () => {
    const start = performance.now();
    try {
      await fetchWithTimeout(CONFIG.rttPingTarget, { mode: 'no-cors', cache: 'no-store' });
      const duration = Math.round(performance.now() - start);
      dom.ping.textContent = `${duration} ms`;
    } catch (_) {
      dom.ping.textContent = 'EDGE ERR';
    }
  };

  const pollWeather = async () => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.weatherLat}&longitude=${CONFIG.weatherLon}&current_weather=true`;
      const res = await fetchWithTimeout(url);
      const data = await res.json();
      if (data && data.current_weather) {
        dom.weather.textContent = `${Math.round(data.current_weather.temperature)}°C`;
      }
    } catch (_) {
      dom.weather.textContent = '--°C';
    }
  };

  // --- Filtering & Card Rendering ---
  const getVisibleServices = () => {
    return state.services.filter((item) => {
      // Role access check
      if (item.roles && !item.roles.includes(state.role)) {
        return false;
      }
      // Tab filter
      if (state.activeTab !== 'ALL' && item.tab !== state.activeTab) {
        return false;
      }
      // Subtab filter
      if (state.activeSubtab !== 'ALL' && item.subtab !== state.activeSubtab) {
        return false;
      }
      // Search query check
      if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        const matchName = item.name.toLowerCase().includes(query);
        const matchDesc = (item.description || '').toLowerCase().includes(query);
        const matchKeywords = (item.keywords || '').toLowerCase().includes(query);
        const matchSubtab = (item.subtab || '').toLowerCase().includes(query);
        return matchName || matchDesc || matchKeywords || matchSubtab;
      }
      return true;
    });
  };

  const renderTabs = () => {
    const roleFiltered = state.services.filter((s) => !s.roles || s.roles.includes(state.role));
    const tabs = ['ALL', ...new Set(roleFiltered.map((s) => s.tab).filter(Boolean))];

    if (!tabs.includes(state.activeTab)) {
      state.activeTab = 'ALL';
    }

    dom.primaryTabs.innerHTML = '';
    tabs.forEach((tabName) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `nav-tab ${state.activeTab === tabName ? 'active' : ''}`;
      btn.textContent = tabName;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', state.activeTab === tabName);
      btn.addEventListener('click', () => {
        triggerHaptic(8);
        state.activeTab = tabName;
        state.activeSubtab = 'ALL';
        renderTabs();
        renderSubFilters();
        renderCards();
      });
      dom.primaryTabs.appendChild(btn);
    });

    renderSubFilters();
  };

  const renderSubFilters = () => {
    dom.subFilters.innerHTML = '';
    if (state.activeTab === 'ALL') {
      return;
    }

    const relevantServices = state.services.filter((s) => {
      const hasRole = !s.roles || s.roles.includes(state.role);
      return hasRole && s.tab === state.activeTab;
    });

    const subtabs = ['ALL', ...new Set(relevantServices.map((s) => s.subtab).filter(Boolean))];

    if (!subtabs.includes(state.activeSubtab)) {
      state.activeSubtab = 'ALL';
    }

    subtabs.forEach((subName) => {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = `filter-pill ${state.activeSubtab === subName ? 'active' : ''}`;
      pill.textContent = subName;
      pill.addEventListener('click', () => {
        triggerHaptic(8);
        state.activeSubtab = subName;
        renderSubFilters();
        renderCards();
      });
      dom.subFilters.appendChild(pill);
    });
  };

  const renderCards = () => {
    const items = getVisibleServices();
    dom.servicesGrid.innerHTML = '';

    if (items.length === 0) {
      dom.servicesGrid.innerHTML = `
        <div class="empty-state">
          <span>NO RESOURCES LOCATED MATCHING CRITERIA</span>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'service-card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `${item.name} resource`);

      const mirrorsHtml = (item.mirrors && item.mirrors.length > 0)
        ? `
          <div class="card-mirrors">
            <span class="mirror-label">MIRRORS:</span>
            ${item.mirrors.map((m) => `
              <a href="${sanitizeStr(m.url)}" class="mirror-chip" target="_blank" rel="noopener noreferrer">${sanitizeStr(m.name)}</a>
            `).join('')}
          </div>
        `
        : '';

      card.innerHTML = `
        <div>
          <div class="card-top">
            <div class="card-title-group">
              <span class="card-name">${sanitizeStr(item.name)}</span>
            </div>
            ${item.subtab ? `<span class="card-subtab-badge">${sanitizeStr(item.subtab)}</span>` : ''}
          </div>
          <p class="card-desc">${sanitizeStr(item.description || '')}</p>
        </div>
        ${mirrorsHtml}
      `;

      // Main Card Click
      card.addEventListener('click', () => {
        openAppContainer(item.url);
      });

      // Accessible Keyboard Enter/Space Launch
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openAppContainer(item.url);
        }
      });

      // Prevent mirror link clicks from triggering main card container
      const mirrorLinks = card.querySelectorAll('.mirror-chip');
      mirrorLinks.forEach((chip) => {
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          triggerHaptic(8);
        });
      });

      fragment.appendChild(card);
    });

    dom.servicesGrid.appendChild(fragment);
  };

  // --- Global Event Bindings ---
  const bindEvents = () => {
    // Shell launch
    dom.shellBtn.addEventListener('click', () => {
      openAppContainer('https://shell.cloud.google.com/?show=terminal');
    });

    // Role Gatekeeper triggers
    dom.roleGateBtn.addEventListener('click', () => {
      if (state.role === 'admin') {
        // Quick toggle back to guest if tapped in admin
        setRole('guest');
      } else {
        openPinModal();
      }
    });

    dom.pinCloseBtn.addEventListener('click', closePinModal);
    dom.dropKidBtn.addEventListener('click', () => {
      triggerHaptic(8);
      setRole('kid');
      closePinModal();
    });

    // Keypad actions
    dom.pinKeypad.addEventListener('click', (e) => {
      const btn = e.target.closest('.keypad-btn');
      if (!btn) return;

      const key = btn.dataset.key;
      const action = btn.dataset.action;

      if (key) {
        handlePinInput(key);
      } else if (action === 'clear') {
        triggerHaptic(8);
        state.pinBuffer = '';
        updatePinDots();
      } else if (action === 'back') {
        triggerHaptic(8);
        state.pinBuffer = state.pinBuffer.slice(0, -1);
        updatePinDots();
      }
    });

    // Search input handling
    dom.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      dom.searchClear.hidden = !state.searchQuery;
      renderCards();
    });

    dom.searchClear.addEventListener('click', () => {
      triggerHaptic(8);
      dom.searchInput.value = '';
      state.searchQuery = '';
      dom.searchClear.hidden = true;
      renderCards();
      dom.searchInput.focus();
    });

    // Hotkeys: '/' focuses search, 'Escape' clears / unfocuses
    window.addEventListener('keydown', (e) => {
      const activeEl = document.activeElement;
      const isInput = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA';

      if (e.key === '/' && !isInput && dom.pinModal.hidden) {
        e.preventDefault();
        dom.searchInput.focus();
      } else if (e.key === 'Escape') {
        if (!dom.pinModal.hidden) {
          closePinModal();
        } else if (isInput) {
          dom.searchInput.value = '';
          state.searchQuery = '';
          dom.searchClear.hidden = true;
          renderCards();
          dom.searchInput.blur();
        }
      }
    });

    // Auto-resync when device wakes or tab regains visibility
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        probeEdgePing();
        pollWeather();
      }
    });

    // URL parameter overrides (e.g. ?role=admin&pin=1234)
    const params = new URLSearchParams(window.location.search);
    if (params.get('role') === 'admin' && params.get('pin') === CONFIG.adminPin) {
      setRole('admin');
    }
  };

  // --- Initialization Lifecycle ---
  const init = async () => {
    dom.roleBadge.textContent = state.role.toUpperCase();

    initClock();
    pollIp();
    probeEdgePing();
    pollWeather();
    bindEvents();

    try {
      const res = await fetch(CONFIG.servicesPath, { cache: 'no-cache' });
      if (!res.ok) throw new Error('Network error loading services schema');
      state.services = await res.json();
      renderTabs();
      renderCards();
    } catch (err) {
      dom.servicesGrid.innerHTML = `
        <div class="empty-state">
          <span>FATAL: UNABLE TO RETRIEVE SERVICES MANIFEST</span>
        </div>
      `;
    }

    // Service Worker Registration
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => {
          // SW registration ignored silently in dev/unsupported contexts
        });
      });
    }
  };

  init();
})();

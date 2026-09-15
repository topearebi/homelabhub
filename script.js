document.addEventListener('DOMContentLoaded', () => {
  let services = [];
  let currentTab = 'all';
  let searchQuery = '';
  let guestModeOnly = localStorage.getItem('homelab_guest_mode') === 'true';
  let deferredPrompt = null;

  // DOM Elements
  const servicesGrid = document.getElementById('servicesGrid');
  const searchInput = document.getElementById('searchInput');
  const navTabs = document.querySelectorAll('.nav-tab');
  const noResults = document.getElementById('noResults');
  const guestToggle = document.getElementById('guestToggle');
  const guestToggleText = document.getElementById('guestToggleText');
  const guestToggleIcon = document.getElementById('guestToggleIcon');
  const installBtn = document.getElementById('installBtn');

  // Load and initialize services from JSON
  async function initServices() {
    try {
      const response = await fetch('services.json');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      services = await response.json();
      render();
    } catch (error) {
      console.error('Failed to load services:', error);
      servicesGrid.innerHTML = `
        <div class="empty-state">
          <span class="material-icons empty-icon">error_outline</span>
          <p class="empty-text">Failed to load services. Please check network or file syntax.</p>
        </div>
      `;
    }
  }

  // Filter and build card markup
  function render() {
    const query = searchQuery.trim().toLowerCase();

    const filtered = services.filter((item) => {
      if (guestModeOnly && !item.guest) return false;
      if (currentTab !== 'all' && item.tab !== currentTab) return false;
      if (!query) return true;

      const titleMatch = item.name.toLowerCase().includes(query);
      const descMatch = item.description.toLowerCase().includes(query);
      const keywordMatch = Array.isArray(item.keywords) && item.keywords.some((kw) => kw.toLowerCase().includes(query));

      return titleMatch || descMatch || keywordMatch;
    });

    if (filtered.length === 0) {
      servicesGrid.innerHTML = '';
      noResults.style.display = 'flex';
      return;
    }

    noResults.style.display = 'none';
    servicesGrid.innerHTML = filtered.map((service) => createCardHTML(service)).join('');
  }

  function createCardHTML(service) {
    const isExternal = service.url.startsWith('http');
    const targetAttrs = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';
    const badgeClass = service.guest ? 'badge-guest' : 'badge-private';
    const badgeLabel = service.guest ? 'Public' : 'Auth';

    return `
      <a href="${service.url}" class="service-card" ${targetAttrs}>
        <div>
          <div class="card-header">
            <div class="card-icon-wrapper">
              <span class="material-icons card-icon">${service.icon || 'apps'}</span>
            </div>
            <div class="card-title-group">
              <span class="card-title">${escapeHTML(service.name)}</span>
              <span class="card-tag">${escapeHTML(service.tab)}</span>
            </div>
          </div>
          <p class="card-description">${escapeHTML(service.description)}</p>
        </div>
        <div class="card-footer">
          <span class="card-badge ${badgeClass}">${badgeLabel}</span>
          <span class="material-icons card-arrow">arrow_forward</span>
        </div>
      </a>
    `;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Quick Search Keydown Hotkey (/)
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== searchInput) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    } else if (e.key === 'Escape' && document.activeElement === searchInput) {
      searchInput.blur();
    }
  });

  // Search Input listener
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    render();
  });

  // Tab Filtering listener
  navTabs.forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      navTabs.forEach((btn) => btn.classList.remove('active'));
      tabBtn.classList.add('active');
      currentTab = tabBtn.dataset.tab;
      render();
    });
  });

  // Guest Mode Controls
  function updateGuestToggleUI() {
    if (!guestToggle) return;
    if (guestModeOnly) {
      guestToggle.classList.add('active');
      guestToggleText.textContent = 'Guest Mode';
      guestToggleIcon.textContent = 'visibility_off';
    } else {
      guestToggle.classList.remove('active');
      guestToggleText.textContent = 'All Services';
      guestToggleIcon.textContent = 'visibility';
    }
  }

  if (guestToggle) {
    updateGuestToggleUI();
    guestToggle.addEventListener('click', () => {
      guestModeOnly = !guestModeOnly;
      localStorage.setItem('homelab_guest_mode', guestModeOnly);
      updateGuestToggleUI();
      render();
    });
  }

  // PWA Prompt Logic
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.style.display = 'inline-flex';
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        installBtn.style.display = 'none';
      }
      deferredPrompt = null;
    });
  }

  window.addEventListener('appinstalled', () => {
    if (installBtn) installBtn.style.display = 'none';
    deferredPrompt = null;
  });

  initServices();
});

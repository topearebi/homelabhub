document.addEventListener('DOMContentLoaded', () => {
  let services = [];
  let currentTab = '';
  let searchQuery = '';
  
  // Default to Guest View (true) if never explicitly set by user
  const storedGuestMode = localStorage.getItem('homelab_guest_mode');
  let guestModeOnly = storedGuestMode === null ? true : storedGuestMode === 'true';

  let deferredPrompt = null;

  // DOM Elements
  const servicesGrid = document.getElementById('servicesGrid');
  const categoryNav = document.getElementById('categoryNav');
  const searchInput = document.getElementById('searchInput');
  const noResults = document.getElementById('noResults');
  const guestToggle = document.getElementById('guestToggle');
  const guestToggleText = document.getElementById('guestToggleText');
  const guestToggleIcon = document.getElementById('guestToggleIcon');
  const installBtn = document.getElementById('installBtn');

  // Load and bootstrap services
  async function initServices() {
    try {
      const response = await fetch('services.json');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      services = await response.json();
      
      updateGuestToggleUI();
      buildCategoryNav();
      render();
    } catch (error) {
      console.error('Failed to load services:', error);
      servicesGrid.innerHTML = `
        <div class="empty-state">
          <span class="material-icons empty-icon">error_outline</span>
          <p class="empty-text">Failed to load services. Please check network connection.</p>
        </div>
      `;
    }
  }

  // Get available categories based on current guest filter
  function getAvailableTabs() {
    const visibleServices = services.filter(item => !guestModeOnly || item.guest);
    return [...new Set(visibleServices.map(item => item.tab))];
  }

  // Build dynamic navigation tabs without "All"
  function buildCategoryNav() {
    const availableTabs = getAvailableTabs();
    categoryNav.innerHTML = '';

    if (availableTabs.length === 0) return;

    // Reset current tab if no longer visible
    if (!availableTabs.includes(currentTab)) {
      currentTab = availableTabs[0];
    }

    availableTabs.forEach(tab => {
      const tabBtn = document.createElement('button');
      tabBtn.className = `nav-tab ${tab === currentTab ? 'active' : ''}`;
      tabBtn.dataset.tab = tab;
      tabBtn.textContent = tab;

      tabBtn.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
        tabBtn.classList.add('active');
        currentTab = tab;
        render();
      });

      categoryNav.appendChild(tabBtn);
    });
  }

  // Filter and build card markup
  function render() {
    const query = searchQuery.trim().toLowerCase();

    const filtered = services.filter((item) => {
      if (guestModeOnly && !item.guest) return false;
      if (currentTab && item.tab !== currentTab) return false;
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

    // Prevent mirror links from triggering card click
    document.querySelectorAll('.mirror-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
      });
    });
  }

  function createCardHTML(service) {
    const isExternal = service.url.startsWith('http');
    const targetAttrs = isExternal ? 'target="_blank" rel="noopener noreferrer"' : '';
    const badgeClass = service.guest ? 'badge-guest' : 'badge-private';
    const badgeLabel = service.guest ? 'Public' : 'Auth';

    let mirrorsHTML = '';
    if (Array.isArray(service.mirrors) && service.mirrors.length > 0) {
      mirrorsHTML = service.mirrors
        .map(m => `<a href="${m.url}" target="_blank" rel="noopener noreferrer" class="mirror-chip" title="Alternative mirror ${escapeHTML(m.label)}">${escapeHTML(m.label)}</a>`)
        .join('');
    }

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
          <div class="card-footer-left">
            <span class="card-badge ${badgeClass}">${badgeLabel}</span>
            ${mirrorsHTML}
          </div>
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

  // Quick Search Keydown Hotkey (/) with typing collision guard
  window.addEventListener('keydown', (e) => {
    const tag = document.activeElement ? document.activeElement.tagName : '';
    const isEditing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (document.activeElement && document.activeElement.isContentEditable);

    if (e.key === '/' && !isEditing) {
      e.preventDefault();
      searchInput.focus();
      searchInput.select();
    } else if (e.key === 'Escape' && document.activeElement === searchInput) {
      searchInput.blur();
    }
  });

  // Search input event
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    render();
  });

  // Guest Mode Controls
  function updateGuestToggleUI() {
    if (!guestToggle) return;
    if (guestModeOnly) {
      guestToggle.classList.add('active');
      guestToggleText.textContent = 'Guest View';
      guestToggleIcon.textContent = 'visibility';
    } else {
      guestToggle.classList.remove('active');
      guestToggleText.textContent = 'Full Stack';
      guestToggleIcon.textContent = 'lock_open';
    }
  }

  if (guestToggle) {
    guestToggle.addEventListener('click', () => {
      guestModeOnly = !guestModeOnly;
      localStorage.setItem('homelab_guest_mode', guestModeOnly);
      updateGuestToggleUI();
      buildCategoryNav();
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

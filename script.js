/**
 * Hub — one page of links for the household.
 *
 * Profiles
 *   admin : sees everything, gets Pinned + Recent, can pin/unpin.
 *   guest : sees links whose "show" includes "guest". No admin clutter.
 *   kid   : sees only links whose "show" includes "kid". Leaving needs the PIN.
 *
 * To change the PIN, put the SHA-256 of the new PIN in CONFIG.pinHash.
 *   Terminal:  printf 1234 | shasum -a 256
 * The PIN is a household lock (keeps the kid in, keeps guests tidy). It is
 * not real security: anyone can read this file and services.json.
 */
(() => {
  'use strict';

  const CONFIG = {
    dataPath: './services.json',
    pinHash: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', // "1234"
    defaultProfile: 'guest',     // what a brand-new device shows
    adminName: 'Tope',
    favicons: true,              // fetch site icons via Google's favicon service (sends hostnames to Google)
    weather: { lat: 53.48, lon: -2.27, place: 'Salford' },
    recentLimit: 6,
  };

  const PROFILES = {
    admin: { label: CONFIG.adminName, sub: 'Everything, plus admin' },
    guest: { label: 'Guest', sub: 'Shared links only' },
    kid:   { label: 'Kid', sub: 'Only what you’ve allowed' },
  };

  // ---------- storage (never throws) ----------
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
      catch (_) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
    },
  };

  const state = {
    profile: store.get('hub.profile', CONFIG.defaultProfile),
    groups: [],
    links: [],
    pins: store.get('hub.pins', null),          // null = use "pinned" flags from services.json
    recents: store.get('hub.recents', []),
    collapsed: store.get('hub.collapsed', {}),
    theme: store.get('hub.theme', 'system'),
    query: '',
    results: [],
    active: 0,
    editing: false,
  };
  if (!PROFILES[state.profile]) state.profile = CONFIG.defaultProfile;

  const $ = (id) => document.getElementById(id);
  const dom = {
    today: $('today'), weather: $('weather'), themeBtn: $('theme-btn'),
    profileBtn: $('profile-btn'), profileName: $('profile-name'), profileMenu: $('profile-menu'),
    searchBar: $('search-bar'), search: $('search'), main: $('main'), foot: $('foot'),
    sheet: $('sheet'), sheetIcon: $('sheet-icon'), sheetTitle: $('sheet-title'), sheetHost: $('sheet-host'),
    sheetDesc: $('sheet-desc'), sheetMirrors: $('sheet-mirrors'), sheetPin: $('sheet-pin'), sheetOpen: $('sheet-open'),
    pin: $('pin'), pinSub: $('pin-sub'), pinDots: $('pin-dots'), pinPad: $('pin-pad'),
  };

  const ICONS = {
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>',
    chev: '<svg viewBox="0 0 24 24" class="chev" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    check: '<svg viewBox="0 0 24 24" class="m-check" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>',
    lock: '<svg viewBox="0 0 24 24" class="m-lock" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    sun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/></svg>',
    auto: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
  };

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isLocal = (url) => url.startsWith('./') || url.startsWith('/');
  const hostOf = (url) => { try { return new URL(url, location.href).hostname.replace(/^www\./, ''); } catch (_) { return ''; } };
  const hueOf = (str) => { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

  // ---------- who sees what ----------
  const canSee = (link, profile = state.profile) => profile === 'admin' || (link.show || []).includes(profile);
  const visibleLinks = () => state.links.filter((l) => canSee(l));
  const byId = (id) => state.links.find((l) => l.id === id);

  const pinnedIds = () => state.pins ?? state.links.filter((l) => l.pinned).map((l) => l.id);
  const isPinned = (id) => pinnedIds().includes(id);
  const togglePin = (id) => {
    const pins = [...pinnedIds()];
    const i = pins.indexOf(id);
    if (i >= 0) pins.splice(i, 1); else pins.push(id);
    state.pins = pins;
    store.set('hub.pins', pins);
  };

  const noteRecent = (id) => {
    if (state.profile !== 'admin') return;
    state.recents = [id, ...state.recents.filter((r) => r !== id)].slice(0, 20);
    store.set('hub.recents', state.recents);
  };

  // ---------- tiles ----------
  const iconHtml = (link) => {
    const letter = esc((link.name.match(/[A-Za-z0-9]/) || ['•'])[0].toUpperCase());
    return `<span class="mono">${letter}</span>`;
  };

  const attachFavicon = (iconEl, link) => {
    if (!CONFIG.favicons || isLocal(link.url)) return;
    const host = hostOf(link.url);
    if (!host || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return;
    const img = new Image();
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.onload = () => {
      // Google returns a 16px generic globe when it has nothing; keep the monogram then.
      if (img.naturalWidth >= 32) iconEl.classList.add('has-img');
      else img.remove();
    };
    img.onerror = () => img.remove();
    img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
    iconEl.appendChild(img);
  };

  const makeIcon = (link) => {
    const el = document.createElement('span');
    el.className = 'tile-icon';
    el.style.setProperty('--h', hueOf(link.id));
    el.innerHTML = iconHtml(link);
    attachFavicon(el, link);
    return el;
  };

  const hasMore = (link) => state.profile === 'admin' || (link.mirrors && link.mirrors.length);

  const makeTile = (link) => {
    const tile = document.createElement('div');
    tile.className = 'tile' + (link.mirrors && link.mirrors.length ? ' has-mirrors' : '');
    tile.dataset.id = link.id;

    const a = document.createElement('a');
    a.className = 'tile-link';
    a.href = link.url;
    if (!isLocal(link.url)) { a.target = '_blank'; a.rel = 'noopener'; }
    a.title = link.description || link.name;
    a.appendChild(makeIcon(link));
    const name = document.createElement('span');
    name.className = 'tile-name';
    name.textContent = link.short || link.name;
    a.appendChild(name);
    a.addEventListener('click', () => { noteRecent(link.id); if (state.query) setTimeout(() => clearSearch(), 0); });
    tile.appendChild(a);

    if (state.profile !== 'kid' && hasMore(link)) {
      const more = document.createElement('button');
      more.type = 'button';
      more.className = 'tile-more';
      more.setAttribute('aria-label', `More about ${link.name}`);
      more.innerHTML = ICONS.more;
      more.addEventListener('click', (e) => { e.preventDefault(); openSheet(link); });
      tile.appendChild(more);
    }

    // Right-click on desktop also opens details.
    tile.addEventListener('contextmenu', (e) => {
      if (state.profile === 'kid' || !hasMore(link)) return;
      e.preventDefault();
      openSheet(link);
    });
    return tile;
  };

  const makeSection = ({ id, title, links, collapsible = true, action = null }) => {
    const sec = document.createElement('section');
    sec.className = 'section';
    const collapsed = collapsible && !!state.collapsed[id];
    if (collapsed) sec.classList.add('collapsed');

    const head = document.createElement(collapsible ? 'button' : 'div');
    head.className = 'section-head' + (collapsible ? '' : ' static');
    if (collapsible) { head.type = 'button'; head.setAttribute('aria-expanded', String(!collapsed)); }
    head.innerHTML = `<h2 class="section-title">${esc(title)}</h2><span class="section-count">${links.length}</span>${collapsible ? ICONS.chev : ''}`;
    if (collapsible) {
      head.addEventListener('click', () => {
        const now = !sec.classList.contains('collapsed');
        sec.classList.toggle('collapsed', now);
        head.setAttribute('aria-expanded', String(!now));
        state.collapsed[id] = now;
        store.set('hub.collapsed', state.collapsed);
      });
    }
    if (action) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'section-action';
      btn.textContent = action.label;
      btn.addEventListener('click', action.onClick);
      head.appendChild(btn);
    }
    sec.appendChild(head);

    const grid = document.createElement('div');
    grid.className = 'grid';
    links.forEach((l) => grid.appendChild(makeTile(l)));
    sec.appendChild(grid);
    return sec;
  };

  // ---------- main render ----------
  const render = () => {
    document.body.classList.toggle('kid', state.profile === 'kid');
    document.body.classList.toggle('editing', state.profile === 'admin' && state.editing);
    dom.profileName.textContent = PROFILES[state.profile].label;
    dom.searchBar.hidden = state.profile === 'kid';

    if (state.query) return renderResults();

    const links = visibleLinks();
    const frag = document.createDocumentFragment();

    if (state.profile === 'admin') {
      const pins = pinnedIds().map(byId).filter(Boolean);
      const editBtn = {
        label: state.editing ? 'Done' : 'Edit',
        onClick: () => { state.editing = !state.editing; render(); },
      };
      frag.appendChild(pins.length
        ? makeSection({ id: '_pinned', title: 'Pinned', links: pins, collapsible: false, action: editBtn })
        : Object.assign(document.createElement('p'), { className: 'result-hint', textContent: 'Tap ⋯ on any link (or right-click it) to pin it here.' }));
      const recent = state.recents.map(byId).filter((l) => l && !isPinned(l.id)).slice(0, CONFIG.recentLimit);
      if (recent.length) frag.appendChild(makeSection({ id: '_recent', title: 'Recent', links: recent, collapsible: false }));
    }

    state.groups.forEach((g) => {
      const inGroup = links.filter((l) => l.group === g.id);
      if (!inGroup.length) return;
      frag.appendChild(makeSection({ id: g.id, title: g.name, links: inGroup, collapsible: state.profile !== 'kid' }));
    });

    // Anything with an unknown group still shows up.
    const known = new Set(state.groups.map((g) => g.id));
    const stray = links.filter((l) => !known.has(l.group));
    if (stray.length) frag.appendChild(makeSection({ id: '_other', title: 'Other', links: stray }));

    dom.main.replaceChildren(frag);
    if (!links.length) dom.main.innerHTML = '<p class="empty">Nothing here yet.</p>';
    renderFoot();
  };

  // Score: name start > word start in name > name contains > keywords/description.
  const score = (link, q) => {
    const name = link.name.toLowerCase();
    const group = (state.groups.find((g) => g.id === link.group) || {}).name || '';
    if (name.startsWith(q)) return 100;
    if (name.split(/[\s\-.]+/).some((w) => w.startsWith(q))) return 80;
    if (name.includes(q)) return 60;
    if (hostOf(link.url).includes(q)) return 50;
    const hay = `${link.keywords || ''} ${group} ${link.description || ''}`.toLowerCase();
    if (hay.split(/[\s,&]+/).some((w) => w.startsWith(q))) return 30;
    if (hay.includes(q)) return 10;
    return 0;
  };

  const renderResults = () => {
    const q = state.query.toLowerCase();
    const terms = q.split(/\s+/).filter(Boolean);
    state.results = visibleLinks()
      .map((l) => { const each = terms.map((t) => score(l, t)); return { l, s: each.includes(0) ? 0 : Math.min(...each) }; })
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s || a.l.name.localeCompare(b.l.name))
      .map((r) => r.l);
    state.active = Math.min(state.active, Math.max(state.results.length - 1, 0));

    if (!state.results.length) {
      dom.main.innerHTML = `<p class="empty">Nothing matches <strong>${esc(state.query)}</strong>.</p>`;
      return;
    }
    const sec = makeSection({ id: '_results', title: 'Results', links: state.results, collapsible: false });
    const hint = document.createElement('p');
    hint.className = 'result-hint';
    hint.textContent = 'Enter opens the highlighted link · arrow keys move · Esc clears';
    sec.appendChild(hint);
    dom.main.replaceChildren(sec);
    highlight();
  };

  const highlight = () => {
    dom.main.querySelectorAll('.tile').forEach((t, i) => t.classList.toggle('active', i === state.active));
  };

  const openLink = (link, newTab = true) => {
    noteRecent(link.id);
    if (isLocal(link.url)) { location.href = link.url; return; }
    if (newTab) window.open(link.url, '_blank', 'noopener');
    else location.href = link.url;
  };

  const clearSearch = (rerender = true) => {
    dom.search.value = '';
    state.query = '';
    state.active = 0;
    if (rerender) render();
  };

  const renderFoot = () => {
    if (state.profile === 'admin') {
      const touch = window.matchMedia('(hover: none)').matches;
      dom.foot.textContent = touch
        ? 'Tap Edit beside Pinned to pin or unpin links.'
        : 'Just start typing to jump anywhere · right-click a link to pin it or see other addresses.';
    } else if (state.profile === 'guest') {
      const n = visibleLinks().length;
      dom.foot.textContent = `${n} shared links`;
    } else {
      dom.foot.innerHTML = '';
    }
  };

  // ---------- details sheet ----------
  let sheetLink = null;
  const openSheet = (link) => {
    sheetLink = link;
    dom.sheetIcon.replaceWith(Object.assign(makeIcon(link), { id: 'sheet-icon' }));
    dom.sheetIcon = $('sheet-icon');
    dom.sheetTitle.textContent = link.name;
    dom.sheetHost.textContent = isLocal(link.url) ? 'On this hub' : hostOf(link.url);
    dom.sheetDesc.textContent = link.description || '';
    dom.sheetDesc.hidden = !link.description;
    const mirrors = link.mirrors || [];
    dom.sheetMirrors.hidden = !mirrors.length;
    dom.sheetMirrors.innerHTML = mirrors.length
      ? `<h3>Other addresses</h3><div class="chips">${mirrors.map((m) => `<a class="chip" href="${esc(m.url)}" target="_blank" rel="noopener">${esc(m.name)}</a>`).join('')}</div>`
      : '';
    dom.sheetMirrors.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => { noteRecent(link.id); closeSheet(); }));
    dom.sheetPin.hidden = state.profile !== 'admin';
    dom.sheetPin.textContent = isPinned(link.id) ? 'Unpin' : 'Pin to top';
    dom.sheetOpen.href = link.url;
    if (isLocal(link.url)) { dom.sheetOpen.removeAttribute('target'); } else { dom.sheetOpen.target = '_blank'; }
    dom.sheet.hidden = false;
    dom.sheetOpen.focus();
  };
  const closeSheet = () => { dom.sheet.hidden = true; sheetLink = null; };

  // ---------- profile menu ----------
  const renderMenu = () => {
    dom.profileMenu.innerHTML = '';
    Object.entries(PROFILES).forEach(([key, p]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'menuitem');
      const needsPin = key !== state.profile && (state.profile === 'kid' || key === 'admin');
      b.innerHTML = `<span class="m-text"><span>${esc(p.label)}</span><span class="m-sub">${esc(p.sub)}</span></span>${key === state.profile ? ICONS.check : needsPin ? ICONS.lock : ''}`;
      b.addEventListener('click', () => { closeMenu(); requestProfile(key); });
      dom.profileMenu.appendChild(b);
    });
  };
  const openMenu = () => { renderMenu(); dom.profileMenu.hidden = false; dom.profileBtn.setAttribute('aria-expanded', 'true'); dom.profileMenu.querySelector('button')?.focus(); };
  const closeMenu = () => { dom.profileMenu.hidden = true; dom.profileBtn.setAttribute('aria-expanded', 'false'); };

  const setProfile = (key) => {
    state.profile = key;
    state.editing = false;
    store.set('hub.profile', key);
    clearSearch(false);
    render();
    window.scrollTo(0, 0);
  };

  const requestProfile = (key) => {
    if (key === state.profile) return;
    const needsPin = state.profile === 'kid' || key === 'admin';
    if (!needsPin) return setProfile(key);
    askPin(key === 'admin' ? `Switch to ${PROFILES.admin.label}` : `Leave kid mode`, () => setProfile(key));
  };

  // ---------- PIN ----------
  let pinBuf = '';
  let pinDone = null;
  const sha256 = async (text) => {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };
  const drawDots = () => dom.pinDots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < pinBuf.length));
  const askPin = (sub, onOk) => {
    pinBuf = ''; pinDone = onOk;
    dom.pinSub.textContent = sub;
    drawDots();
    dom.pin.hidden = false;
    dom.pinPad.querySelector('button')?.focus();
  };
  const closePin = () => { dom.pin.hidden = true; pinBuf = ''; pinDone = null; };
  const pinKey = async (k) => {
    if (pinBuf.length >= 4) return;
    pinBuf += k;
    drawDots();
    if (pinBuf.length < 4) return;
    let ok = false;
    try { ok = (await sha256(pinBuf)) === CONFIG.pinHash; } catch (_) { ok = false; }
    if (ok) {
      const cb = pinDone;
      closePin();
      cb && cb();
    } else {
      if (navigator.vibrate) { try { navigator.vibrate(60); } catch (_) {} }
      dom.pinDots.classList.add('shake');
      setTimeout(() => { dom.pinDots.classList.remove('shake'); pinBuf = ''; drawDots(); }, 320);
    }
  };

  // ---------- theme ----------
  const THEME_ORDER = ['system', 'light', 'dark'];
  const applyTheme = () => {
    const root = document.documentElement;
    if (state.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', state.theme);
    dom.themeBtn.innerHTML = state.theme === 'light' ? ICONS.sun : state.theme === 'dark' ? ICONS.moon : ICONS.auto;
    const label = { system: 'Theme: match device', light: 'Theme: light', dark: 'Theme: dark' }[state.theme];
    dom.themeBtn.title = label;
    dom.themeBtn.setAttribute('aria-label', `${label}. Click to change.`);
  };

  // ---------- header ----------
  const paintDate = () => {
    const now = new Date();
    dom.today.textContent = now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  };

  const WMO = [
    [[0], 'Clear'], [[1], 'Mostly clear'], [[2], 'Partly cloudy'], [[3], 'Overcast'],
    [[45, 48], 'Fog'], [[51, 53, 55, 56, 57], 'Drizzle'], [[61, 63, 65, 66, 67, 80, 81, 82], 'Rain'],
    [[71, 73, 75, 77, 85, 86], 'Snow'], [[95, 96, 99], 'Thunder'],
  ];
  const describe = (code) => (WMO.find(([codes]) => codes.includes(code)) || [null, ''])[1];

  const loadWeather = async () => {
    const { lat, lon, place } = CONFIG.weather;
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 4000);
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`, { signal: ctl.signal });
      clearTimeout(t);
      const d = await res.json();
      const now = Math.round(d.current.temperature_2m);
      const hi = Math.round(d.daily.temperature_2m_max[0]);
      const lo = Math.round(d.daily.temperature_2m_min[0]);
      const word = describe(d.current.weather_code);
      dom.weather.textContent = `${place} · ${now}°${word ? ', ' + word.toLowerCase() : ''} · ${hi}° / ${lo}°`;
    } catch (_) {
      dom.weather.textContent = '';
    }
  };

  // ---------- events ----------
  const bind = () => {
    dom.themeBtn.addEventListener('click', () => {
      state.theme = THEME_ORDER[(THEME_ORDER.indexOf(state.theme) + 1) % THEME_ORDER.length];
      store.set('hub.theme', state.theme);
      applyTheme();
    });

    dom.profileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dom.profileMenu.hidden ? openMenu() : closeMenu();
    });
    document.addEventListener('click', (e) => {
      if (!dom.profileMenu.hidden && !dom.profileMenu.contains(e.target)) closeMenu();
    });

    dom.search.addEventListener('input', () => {
      state.query = dom.search.value.trim();
      state.active = 0;
      render();
    });
    dom.search.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const link = state.results[state.active];
        if (state.query && link) {
          e.preventDefault();
          openLink(link, !(e.shiftKey));
          clearSearch();
          dom.search.blur();
        }
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight' && dom.search.selectionStart === dom.search.value.length) {
        if (!state.results.length) return;
        e.preventDefault();
        state.active = (state.active + 1) % state.results.length; highlight();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' && dom.search.selectionStart === 0 && state.query) {
        if (!state.results.length) return;
        e.preventDefault();
        state.active = (state.active - 1 + state.results.length) % state.results.length; highlight();
      } else if (e.key === 'Escape') {
        if (state.query) clearSearch(); else dom.search.blur();
      }
    });

    dom.sheet.addEventListener('click', (e) => {
      if (e.target === dom.sheet || e.target.closest('[data-close]')) closeSheet();
    });
    dom.sheetPin.addEventListener('click', () => {
      if (!sheetLink) return;
      togglePin(sheetLink.id);
      closeSheet();
      state.editing = state.editing && pinnedIds().length > 0;
      render();
    });
    dom.sheetOpen.addEventListener('click', () => { if (sheetLink) noteRecent(sheetLink.id); closeSheet(); });

    dom.pin.addEventListener('click', (e) => { if (e.target === dom.pin) closePin(); });
    dom.pinPad.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.k) pinKey(b.dataset.k);
      else if (b.dataset.a === 'back') { pinBuf = pinBuf.slice(0, -1); drawDots(); }
      else if (b.dataset.a === 'cancel') closePin();
    });

    // Global keys: type anywhere to search, Esc closes things.
    window.addEventListener('keydown', (e) => {
      if (!dom.pin.hidden) {
        if (/^[0-9]$/.test(e.key)) { e.preventDefault(); pinKey(e.key); }
        else if (e.key === 'Backspace') { pinBuf = pinBuf.slice(0, -1); drawDots(); }
        else if (e.key === 'Escape') closePin();
        return;
      }
      if (e.key === 'Escape') {
        if (!dom.sheet.hidden) return closeSheet();
        if (!dom.profileMenu.hidden) { closeMenu(); dom.profileBtn.focus(); return; }
      }
      if (!dom.sheet.hidden || state.profile === 'kid') return;
      const el = document.activeElement;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') { e.preventDefault(); dom.search.focus(); return; }
      if (e.key.length === 1 && /\S/.test(e.key)) {
        dom.search.focus(); // the keystroke then lands in the box
      }
    });

    // Keep the date fresh if the app stays open past midnight.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { paintDate(); loadWeather(); }
    });
  };

  // ---------- start ----------
  const init = async () => {
    applyTheme();
    paintDate();
    loadWeather();
    bind();
    try {
      const res = await fetch(CONFIG.dataPath, { cache: 'no-cache' });
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();
      state.groups = data.groups || [];
      state.links = data.links || [];
      render();
    } catch (_) {
      dom.main.innerHTML = '<p class="empty">Couldn’t load the links. Check your connection and refresh.</p>';
    }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  };

  init();
})();

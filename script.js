document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const grid = document.getElementById('grid-container');
    const template = document.getElementById('card-template');
    const searchInput = document.getElementById('searchInput');
    const searchStatus = document.getElementById('search-status');
    const greetingEl = document.getElementById('greeting');
    const clockEl = document.getElementById('clock');
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    // Application State
    let services = [];
    let currentTab = 'library';

    /**
     * Fetch services from JSON with cache-busting
     */
    async function loadServices() {
        try {
            // Append timestamp to URL to bypass browser/CDN caching for fresh data
            const response = await fetch(`services.json?t=${Date.now()}`);
            if (!response.ok) throw new Error('Network response was not ok');
            
            services = await response.json();
            filterAndRender();
        } catch (error) {
            console.error('Failed to load services:', error);
            grid.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">
                    <span class="material-symbols-rounded" style="font-size: 48px; margin-bottom: 1rem;">error</span>
                    <p>Unable to load services configuration.</p>
                </div>`;
        }
    }

    /**
     * Logic to determine which services to show based on Tab or Search
     */
    function filterAndRender() {
        const query = searchInput.value.toLowerCase().trim();
        const isSearching = query.length > 0;
        
        // Toggle global search mode visuals on the body
        document.body.classList.toggle('is-searching', isSearching);

        const filtered = services.filter(service => {
            // Check matches for Name, Description, and Keywords
            const matchesSearch = 
                service.name.toLowerCase().includes(query) || 
                service.description.toLowerCase().includes(query) ||
                (service.keywords && service.keywords.some(k => k.toLowerCase().includes(query)));

            if (isSearching) {
                // Global Mode: ignore tabs to find anything across the whole lab
                return matchesSearch;
            } else {
                // Tab Mode: only show items belonging to the active category
                return service.tab === currentTab;
            }
        });

        // Update search status text
        if (isSearching) {
            searchStatus.textContent = `Found ${filtered.length} service${filtered.length === 1 ? '' : 's'} globally`;
        } else {
            searchStatus.textContent = "";
        }

        renderServices(filtered);
    }

    /**
     * Paint the filtered services to the DOM
     */
    function renderServices(items) {
        grid.innerHTML = '';
        
        if (items.length === 0) {
            grid.innerHTML = `
                <p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">
                    No services found.
                </p>`;
            return;
        }

        items.forEach(service => {
            const clone = template.content.cloneNode(true);
            
            // Set Link and Security headers
            const link = clone.querySelector('a');
            link.href = service.url;
            
            // Set Text Content
            clone.querySelector('.card-title').textContent = service.name;
            clone.querySelector('.card-desc').textContent = service.description;
            
            // Set Icon (fallback to 'web' if not specified)
            const iconEl = clone.querySelector('.card-icon');
            iconEl.textContent = service.icon || 'web';
            
            grid.appendChild(clone);
        });
    }

    /**
     * Handle Tab Switching
     */
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update UI state
            tabBtns.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            
            // Update Data state
            currentTab = btn.dataset.tab;
            
            // Clear search when switching tabs for a clean experience
            if (searchInput.value) {
                searchInput.value = '';
                document.body.classList.remove('is-searching');
            }
            
            filterAndRender();
        });
    });

    /**
     * Keyboard Shortcut: Focus search on "/"
     */
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== searchInput) {
            e.preventDefault();
            searchInput.focus();
        }
    });

    /**
     * Search Input listener
     */
    searchInput.addEventListener('input', filterAndRender);

    /**
     * Time and Greeting Logic
     */
    function updateHeader() {
        const now = new Date();
        
        // Clock: "Mon, Jan 27, 10:14 AM"
        const options = { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        };
        clockEl.textContent = now.toLocaleDateString('en-US', options);

        // Greeting
        const hour = now.getHours();
        let greeting = "Welcome";
        if (hour < 12) greeting = "Good Morning";
        else if (hour < 18) greeting = "Good Afternoon";
        else greeting = "Good Evening";
        
        greetingEl.textContent = greeting;
    }

    // Initialization
    loadServices();
    updateHeader();
    setInterval(updateHeader, 60000); // Update every minute
});

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('grid-container');
    const template = document.getElementById('card-template');
    const searchInput = document.getElementById('searchInput');
    const greetingEl = document.getElementById('greeting');
    const clockEl = document.getElementById('clock');
    const tabBtns = document.querySelectorAll('.tab-btn');
    
    let services = [];
    let currentTab = 'library';

    async function loadServices() {
        try {
            // Cache-busting fetch to ensure the JSON is fresh
            const response = await fetch(`services.json?t=${Date.now()}`);
            services = await response.json();
            filterAndRender();
        } catch (error) {
            console.error('Failed to load services:', error);
            grid.innerHTML = '<p style="color:red; text-align:center;">Error loading configuration.</p>';
        }
    }

    function filterAndRender() {
        const query = searchInput.value.toLowerCase();
        
        const filtered = services.filter(service => {
            const matchesTab = service.tab === currentTab;
            const matchesSearch = service.name.toLowerCase().includes(query) || 
                                service.description.toLowerCase().includes(query);
            return matchesTab && matchesSearch;
        });

        renderServices(filtered);
    }

    function renderServices(items) {
        grid.innerHTML = '';
        items.forEach(service => {
            const clone = template.content.cloneNode(true);
            clone.querySelector('.card-title').textContent = service.name;
            clone.querySelector('.card-desc').textContent = service.description;
            clone.querySelector('a').href = service.url;
            clone.querySelector('.card-icon').textContent = service.icon || 'web';
            grid.appendChild(clone);
        });
    }

    // Tab Selection Logic
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTab = btn.dataset.tab;
            filterAndRender();
        });
    });

    searchInput.addEventListener('input', filterAndRender);

    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== searchInput) {
            e.preventDefault();
            searchInput.focus();
        }
    });

    function updateTime() {
        const now = new Date();
        const options = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        clockEl.textContent = now.toLocaleDateString('en-US', options);

        const hour = now.getHours();
        let greeting = "Welcome";
        if (hour < 12) greeting = "Good Morning";
        else if (hour < 18) greeting = "Good Afternoon";
        else greeting = "Good Evening";
        greetingEl.textContent = greeting;
    }

    loadServices();
    updateTime();
    setInterval(updateTime, 60000);
});

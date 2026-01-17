document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('grid-container');
    const template = document.getElementById('card-template');
    const searchInput = document.getElementById('searchInput');
    const greetingEl = document.getElementById('greeting');
    const clockEl = document.getElementById('clock');
    
    let services = [];

    // 1. Fetch Configuration
    async function loadServices() {
        try {
            const response = await fetch('services.json');
            services = await response.json();
            renderServices(services);
        } catch (error) {
            console.error('Failed to load services:', error);
            grid.innerHTML = '<p style="color:red">Error loading configuration.</p>';
        }
    }

    // 2. Render Cards
    function renderServices(items) {
        grid.innerHTML = ''; // Clear current grid
        
        items.forEach(service => {
            const clone = template.content.cloneNode(true);
            
            // Populate Data
            clone.querySelector('.card-title').textContent = service.name;
            clone.querySelector('.card-desc').textContent = service.description;
            clone.querySelector('a').href = service.url;
            
            // Icon handling (Material Symbols)
            clone.querySelector('.card-icon').textContent = service.icon || 'web';
            
            grid.appendChild(clone);
        });
    }

    // 3. Search Logic
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        
        const filtered = services.filter(service => 
            service.name.toLowerCase().includes(query) || 
            service.description.toLowerCase().includes(query) ||
            service.category.toLowerCase().includes(query)
        );
        
        renderServices(filtered);
    });

    // Keyboard Shortcut (Press '/' to search)
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== searchInput) {
            e.preventDefault();
            searchInput.focus();
        }
    });

    // 4. Time & Greeting Logic
    function updateTime() {
        const now = new Date();
        
        // Clock
        const options = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        clockEl.textContent = now.toLocaleDateString('en-US', options);

        // Greeting
        const hour = now.getHours();
        let greeting = "Welcome";
        if (hour < 12) greeting = "Good Morning";
        else if (hour < 18) greeting = "Good Afternoon";
        else greeting = "Good Evening";
        
        greetingEl.textContent = greeting;
    }

    // Initialize
    loadServices();
    updateTime();
    setInterval(updateTime, 1000 * 60); // Update every minute
});

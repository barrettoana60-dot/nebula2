/* ============================================================
   APP.JS — Main controller + routing
   ============================================================ */
const NebulaApp = (() => {
    let state = {};

    function init() {
        state = NebulaStorage.initState();
        initRippleEffect();
        renderApp();
    }

    function renderApp() {
        const navbar = document.getElementById('navbar');
        const container = document.getElementById('pageContainer');

        if (!state.logged_in) {
            navbar.style.display = 'none';
            PageAuth.render(container, state);
            return;
        }

        NebulaStorage.syncWorkspaceState(state, state.current_user);
        navbar.style.display = 'flex';
        renderNavbar();
        renderPage();

        // Tutorial on first access
        console.log("[NebulaApp] Checking tutorial. completed status:", state.users[state.current_user]?.tutorial_completed);
        if (NebulaTutorial.shouldShow(state)) {
            console.log("[NebulaApp] Starting tutorial...");
            setTimeout(() => NebulaTutorial.start(), 800);
        }
    }

    function renderNavbar() {
        const user = state.users[state.current_user] || {};
        const pages = ['Tela Principal', 'Pesquisa Inteligente', 'Repositório', 'Análise', 'Conexões', 'Comunidade', 'Perfil'];
        const navLinks = document.getElementById('navLinks');
        navLinks.innerHTML = pages.map(p =>
            `<button class="nav-link ${state.page === p ? 'active' : ''}" onclick="NebulaApp.navigate('${p}')">${p}</button>`
        ).join('');
        document.getElementById('navUserChip').textContent = (user.name || 'Perfil').slice(0, 18);
    }

    function renderPage() {
        const container = document.getElementById('pageContainer');
        container.innerHTML = '';
        window.scrollTo(0, 0);

        switch (state.page) {
            case 'Tela Principal': PageDashboard.render(container, state); break;
            case 'Pesquisa Inteligente': PageSearch.render(container, state); break;
            case 'Repositório': PageRepository.render(container, state); break;
            case 'Análise': PageAnalysis.render(container, state); break;
            case 'Conexões': PageConnections.render(container, state); break;
            case 'Comunidade': PageChat.render(container, state); break;
            case 'Perfil': PageProfile.render(container, state); break;
            default: PageDashboard.render(container, state);
        }
    }

    function navigate(page) {
        // Save current state BEFORE navigating to prevent data loss
        if (state.logged_in && state.current_user) {
            NebulaStorage.saveState(state);
        }
        state.page = page;
        renderNavbar();
        renderPage();
    }

    function logout() {
        state.logged_in = false;
        state.current_user = null;
        NebulaStorage.syncWorkspaceState(state, null);
        renderApp();
    }

    function quickSearch(term) {
        state.quick_query = term;
        navigate('Pesquisa Inteligente');
    }

    function recommendTerms(email, limit = 10) {
        const profile = (state.user_interest || {})[email] || {};
        return Object.entries(profile).sort((a, b) => b[1] - a[1]).slice(0, limit).map(e => e[0]);
    }

    function getState() { return state; }

    // Ripple effect on all buttons
    function initRippleEffect() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn');
            if (!btn) return;
            const ripple = document.createElement('span');
            ripple.classList.add('btn-ripple');
            const rect = btn.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height) * 2;
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
            ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
            btn.appendChild(ripple);
            ripple.addEventListener('animationend', () => ripple.remove());
        });
    }

    return { init, renderApp, renderPage, navigate, logout, quickSearch, recommendTerms, getState };
})();

// Boot
document.addEventListener('DOMContentLoaded', () => NebulaApp.init());

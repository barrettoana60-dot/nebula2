/* ============================================================
   APP.JS — Main controller + routing
   ============================================================ */
const NebulaApp = (() => {
    let state = {};

    function init() {
        state = NebulaStorage.initState();
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
    }

    function renderNavbar() {
        const user = state.users[state.current_user] || {};
        const pages = ['Dashboard', 'Pesquisa Inteligente', 'Repositório', 'Análise Avançada', 'Conexões', 'Chat', 'Perfil'];
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
            case 'Dashboard': PageDashboard.render(container, state); break;
            case 'Pesquisa Inteligente': PageSearch.render(container, state); break;
            case 'Repositório': PageRepository.render(container, state); break;
            case 'Análise Avançada': PageAnalysis.render(container, state); break;
            case 'Conexões': PageConnections.render(container, state); break;
            case 'Chat': PageChat.render(container, state); break;
            case 'Perfil': PageProfile.render(container, state); break;
            default: PageDashboard.render(container, state);
        }
    }

    function navigate(page) {
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

    return { init, renderApp, renderPage, navigate, logout, quickSearch, recommendTerms, getState };
})();

// Boot
document.addEventListener('DOMContentLoaded', () => NebulaApp.init());

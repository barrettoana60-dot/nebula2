/* ============================================================
   APP.JS — Main controller + routing
   ============================================================ */
const NebulaApp = (() => {
    let state = {};
    let _bellDropdownOpen = false;
    let _cachedNotifications = [];

    function init() {
        state = NebulaStorage.initState();
        if (state.page === 'Pesquisa Inteligente') state.page = 'Pesquisa';
        window.state = state;
        initRippleEffect();
        syncLayoutMode();
        window.addEventListener('resize', syncLayoutMode);
        renderApp();

        // Popstate listener to navigate pages smoothly on back button
        if (window.history && window.history.replaceState) {
            try {
                window.history.replaceState({ page: state.page || 'Tela Principal' }, '', '#' + (state.page || 'Tela Principal').toLowerCase().replace(/\s+/g, '-'));
            } catch (e) {}
        }

        window.addEventListener('popstate', (e) => {
            if (e.state && e.state.page) {
                state.page = e.state.page;
            } else if (location.hash) {
                const hPage = location.hash.replace('#', '').toLowerCase();
                const matched = ['Tela Principal', 'Repositório', 'Análise', 'Conexões', 'Comunidade', 'Perfil', 'Pesquisa'].find(p => p.toLowerCase().replace(/\s+/g, '-') === hPage);
                state.page = matched || 'Tela Principal';
            } else {
                state.page = 'Tela Principal';
            }
            renderNavbar();
            renderPage();
        });

        // Global search input listener
        const navSearch = document.getElementById('nav-search-input');
        if (navSearch) {
            navSearch.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const val = navSearch.value.trim();
                    if (val) {
                        state.search_query = val;
                        state.quick_query = val;
                        navigate('Tela Principal', false);
                    }
                }
            });
        }

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#navBellWrapper') && !e.target.closest('#mobileBellWrapper')) closeBellDropdown();
            if (!e.target.closest('#navUserWrapper') && !e.target.closest('#mobileHdrAvatar') && !e.target.closest('#accountDropdown')) closeAccountDropdown();
        });

        // Quietly fetch latest data from Supabase in background
        if (state.logged_in && state.current_user && !state.admin_mode) {
            NebulaAnalytics.trackPage(state.current_user, state.page || 'Tela Principal');
            NebulaStorage.pulsePresence(state.current_user, null);
            NebulaStorage.refreshCommunityDirectory(state).then(() => {
                return NebulaStorage.syncWorkspaceStateAsync(state, state.current_user);
            }).then(() => {
                renderApp();
            }).catch(e => console.error("Auto-sync failed", e));
        }
    }

    function renderApp() {
        const navbar = document.getElementById('navbar');
        const container = document.getElementById('pageContainer');

        if (sessionStorage.getItem('nebula_admin_token')) {
            state.logged_in = true;
            state.admin_mode = true;
            state.current_user = '__admin__';
            navbar.style.display = 'none';
            const mobHeader = document.getElementById('mobileHeader');
            if (mobHeader) mobHeader.style.display = 'none';
            syncLayoutMode();
            container.style.paddingTop = '1rem';
            PageBackroom.render(container, state);
            return;
        }

        if (!state.logged_in) {
            navbar.style.display = 'none';
            syncLayoutMode();
            PageAuth.render(container, state);
            return;
        }

        state.admin_mode = false;
        NebulaStorage.syncWorkspaceState(state, state.current_user);
        navbar.style.display = 'flex';
        renderNavbar();
        renderPage();
        syncLayoutMode();

        if (NebulaTutorial.shouldShow(state)) {
            setTimeout(() => NebulaTutorial.start(), 800);
        }

        if (state.current_user && !state.admin_mode) {
            NebulaAnalytics.trackPage(state.current_user, state.page);
        }
    }

    function renderNavbar() {
        const user = state.users[state.current_user] || {};
        const pages = ['Tela Principal', 'Repositório', 'Análise', 'Conexões', 'Mensagens'];
        const navLinks = document.getElementById('navLinks');
        navLinks.innerHTML = pages.map(p => {
            const isActive = state.page === p || (p === 'Mensagens' && state.page === 'Comunidade');
            return `<button class="nav-link ${isActive ? 'active' : ''}" onclick="NebulaApp.navigate('${p}')">${p}</button>`;
        }).join('');
        const chip = document.getElementById('navUserChip');
        if (chip) {
            chip.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.55rem;">
                    <div style="width:24px; height:24px; border-radius:50%; background:var(--color-blue); display:flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:700; color:#fff; overflow:visible; flex-shrink:0; position:relative;">
                        <div style="width:100%; height:100%; border-radius:50%; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                            ${user.photo ? `<img src="${user.photo}" alt="" style="width:100%;height:100%;object-fit:cover;">` : (user.name || 'P').trim().charAt(0).toUpperCase()}
                        </div>
                        <span class="online-dot" style="width:8px; height:8px; bottom:-1px; right:-1px;" title="Online"></span>
                    </div>
                    <span>${(user.name || 'Perfil').slice(0, 18)}</span>
                </div>
            `;
        }
        const mobAvatar = document.getElementById('mobileHdrAvatar');
        if (mobAvatar) {
            mobAvatar.style.position = 'relative';
            if (user.photo) {
                mobAvatar.innerHTML = `<img src="${user.photo}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"><span class="online-dot" style="width:8px; height:8px; bottom:0; right:0;" title="Online"></span>`;
            } else {
                mobAvatar.innerHTML = `${(user.name || 'P').trim().charAt(0).toUpperCase()}<span class="online-dot" style="width:8px; height:8px; bottom:0; right:0;" title="Online"></span>`;
            }
        }
        updateBell();
        populateAccountDropdown();
        renderMobileNav();
        renderMobileHeader();
    }

    const MOBILE_PAGE_TITLES = {
        'Tela Principal': 'Início',
        'Pesquisa': 'Pesquisa',
        'Repositório': 'Repositório',
        'Análise': 'Análise',
        'Conexões': 'Conexões',
        'Comunidade': 'Mensagens',
        'Mensagens': 'Mensagens',
        'Perfil': 'Perfil'
    };

    function renderMobileHeader() {
        const titleEl = document.getElementById('mobileHeaderTitle');
        if (titleEl) titleEl.textContent = MOBILE_PAGE_TITLES[state.page] || 'Nebula';
    }

    function isMobileLayout() {
        return window.matchMedia('(max-width: 768px)').matches;
    }

    function positionFloatingPanel(panel, anchorEl) {
        if (!panel) return;
        if (isMobileLayout()) {
            panel.style.left = '1rem';
            panel.style.right = '1rem';
            panel.style.width = 'auto';
            panel.style.top = 'auto';
            panel.style.bottom = 'calc(82px + env(safe-area-inset-bottom, 0px))';
        } else if (anchorEl) {
            const r = anchorEl.getBoundingClientRect();
            panel.style.top = `${r.bottom + 10}px`;
            panel.style.right = `${window.innerWidth - r.right}px`;
            panel.style.left = 'auto';
            panel.style.bottom = 'auto';
            panel.style.width = panel.id === 'bellDropdown' ? '320px' : '280px';
        }
    }

    function syncLayoutMode() {
        const mobile = isMobileLayout() && !!state.logged_in;
        document.body.classList.toggle('layout-mobile', mobile);
        document.body.classList.toggle('layout-desktop', !mobile);
        const bottomNav = document.getElementById('mobileBottomNav');
        const mobileHeader = document.getElementById('mobileHeader');
        if (bottomNav) bottomNav.style.display = mobile ? 'flex' : 'none';
        if (mobileHeader) mobileHeader.style.display = mobile ? 'flex' : 'none';
        if (!mobile) closeMobileMoreSheet();
    }

    const MOBILE_NAV_ICONS = {
        compass: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M16.5 7.5l-2.2 5.8-5.8 2.2 2.2-5.8 5.8-2.2z"/></svg>',
        search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
        folder: '<svg viewBox="0 0 24 24"><path d="M4 6h6l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/></svg>'
    };

    function renderMobileNav() {
        const bar = document.getElementById('mobileBottomNav');
        if (!bar || !state.logged_in) return;

        const user = state.users[state.current_user] || {};
        const initial = (user.name || 'P').trim().charAt(0).toUpperCase();
        const items = [
            { page: 'Tela Principal', label: 'Início', icon: 'compass' },
            { page: 'Pesquisa', label: 'Busca', icon: 'search' },
            { page: 'Repositório', label: 'Docs', icon: 'folder' },
            { page: 'Perfil', label: 'Perfil', icon: 'avatar', initial }
        ];

        bar.innerHTML = items.map(item => {
            const active = state.page === item.page ? ' active' : '';
            if (item.icon === 'avatar') {
                const avatarContent = user.photo 
                    ? `<img src="${user.photo}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` 
                    : item.initial;
                return `<button type="button" class="mobile-nav-item${active}" onclick="NebulaApp.navigate('${item.page}')" aria-label="${item.label}">
                    <span class="mobile-nav-avatar">${avatarContent}</span>
                </button>`;
            }
            return `<button type="button" class="mobile-nav-item${active}" onclick="NebulaApp.navigate('${item.page}')" aria-label="${item.label}">
                ${MOBILE_NAV_ICONS[item.icon] || ''}
            </button>`;
        }).join('');
    }

    function toggleMobileMoreSheet() {
        const sheet = document.getElementById('mobileMoreSheet');
        if (!sheet) return;
        const open = sheet.classList.toggle('open');
        sheet.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (open) {
            closeBellDropdown();
            closeAccountDropdown();
        }
    }

    function closeMobileMoreSheet() {
        const sheet = document.getElementById('mobileMoreSheet');
        if (!sheet) return;
        sheet.classList.remove('open');
        sheet.setAttribute('aria-hidden', 'true');
    }

    // ── Bell Notification System ──

    async function updateBell() {
        if (!state.current_user) return;
        const emailClean = state.current_user.toLowerCase().trim();
        try {
            const lastSeen = parseInt(localStorage.getItem('nebula_bell_seen_' + emailClean) || '0');
            let unread = [];

            // 1. Lê do cache local v3 (compatível com chat atual)
            try {
                const localStore = JSON.parse(localStorage.getItem('nebula_chat_store_v3_' + emailClean) || '[]');
                const localUnread = localStore.filter(m =>
                    (m.recipient_email || '').toLowerCase().trim() === emailClean &&
                    (m.sender_email || '').toLowerCase().trim() !== emailClean &&
                    m.sender_email !== 'ai@nebula' &&
                    m.sender_email !== 'ai' &&
                    (m.timestamp || 0) > lastSeen
                );
                unread.push(...localUnread);
            } catch (e) {}

            // 2. Mensagens não lidas no Supabase (fonte única)
            try {
                const sbUnread = await NebulaStorage.fetchUnreadMessagesFromSupabase(emailClean, lastSeen);
                unread.push(...sbUnread);
            } catch (e) {}

            // Deduplica notificações
            const finalUnread = NebulaStorage.mergeMessagesUnique([], unread);
            _cachedNotifications = finalUnread;

            const badge = document.getElementById('navUnreadBadge');
            const mobileBadge = document.getElementById('mobileUnreadBadge');
            [badge, mobileBadge].forEach(b => {
                if (!b) return;
                if (finalUnread.length > 0) {
                    b.textContent = finalUnread.length > 99 ? '99+' : finalUnread.length;
                    b.style.display = 'inline-block';
                    if (b === badge) b.style.animation = 'bell-pulse 1.5s ease infinite';
                } else {
                    b.style.display = 'none';
                    if (b === badge) b.style.animation = 'none';
                }
            });
        } catch (e) { /* silent */ }
    }

    function toggleBellDropdown() {
        if (_bellDropdownOpen) {
            closeBellDropdown();
        } else {
            openBellDropdown();
        }
    }

    function openBellDropdown() {
        _bellDropdownOpen = true;
        let dropdown = document.getElementById('bellDropdown');
        if (!dropdown) return;

        const notifs = _cachedNotifications;
        if (!notifs.length) {
            dropdown.innerHTML = `
                <div style="padding:1.2rem;text-align:center;color:var(--text-white-60);font-size:0.9rem;">
                    Nenhuma mensagem nova
                </div>`;
        } else {
            dropdown.innerHTML = `
                <div style="padding:0.8rem 1rem;border-bottom:1px solid rgba(0,0,0,0.06);font-size:0.75rem;color:var(--text-white-60);font-weight:600;letter-spacing:0.05em;">
                    MENSAGENS NÃO LIDAS
                </div>
                ${notifs.slice(0, 8).map(m => `
                    <div onclick="NebulaApp.goToChat('${m.sender_email}')" style="padding:0.9rem 1rem;border-bottom:1px solid rgba(0,0,0,0.05);cursor:pointer;transition:background 0.2s;" 
                         onmouseover="this.style.background='rgba(0,0,0,0.03)'" onmouseout="this.style.background='transparent'">
                        <div style="font-weight:600;font-size:0.88rem;margin-bottom:0.25rem;">${m.sender_name || m.sender_email}</div>
                        <div style="color:var(--text-white-60);font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${(m.text || '').slice(0, 55)}${(m.text || '').length > 55 ? '...' : ''}</div>
                        <div style="color:var(--color-blue);font-size:0.75rem;margin-top:0.2rem;">${m.created_at ? new Date(m.created_at).toLocaleString('pt-BR', {hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}) : ''}</div>
                    </div>
                `).join('')}
                <div onclick="NebulaApp.navigate('Mensagens')" style="padding:0.8rem 1rem;text-align:center;cursor:pointer;color:var(--color-blue);font-size:0.85rem;font-weight:600;"
                     onmouseover="this.style.background='rgba(0,0,0,0.02)'" onmouseout="this.style.background='transparent'">
                    Ver todas as conversas →
                </div>`;
        }

        dropdown.style.display = 'block';
        const anchor = document.getElementById(isMobileLayout() ? 'mobileBellWrapper' : 'navBellWrapper');
        positionFloatingPanel(dropdown, anchor?.querySelector('button') || anchor);
        setTimeout(() => { dropdown.style.opacity = '1'; dropdown.style.transform = 'translateY(0)'; }, 10);
    }

    function closeBellDropdown() {
        _bellDropdownOpen = false;
        const dropdown = document.getElementById('bellDropdown');
        if (!dropdown) return;
        dropdown.style.opacity = '0';
        dropdown.style.transform = 'translateY(-8px)';
        setTimeout(() => { dropdown.style.display = 'none'; }, 180);
    }

    function goToChat(peerEmail) {
        closeBellDropdown();
        const emailClean = (state.current_user || '').toLowerCase().trim();
        if (emailClean) {
            localStorage.setItem('nebula_bell_seen_' + emailClean, Date.now().toString());
        }
        const badge = document.getElementById('navUnreadBadge');
        const mobileBadge = document.getElementById('mobileUnreadBadge');
        if (badge) badge.style.display = 'none';
        if (mobileBadge) mobileBadge.style.display = 'none';

        state.chat_target = (peerEmail || '').toLowerCase().trim();
        navigate('Comunidade');
    }

    function startBellPoll() {
        updateBell();
        setInterval(updateBell, 5000);
    }

    // ── Page Rendering ──

    function renderPage() {
        const container = document.getElementById('pageContainer');
        container.innerHTML = '';
        window.scrollTo(0, 0);

        switch (state.page) {
            case 'Backroom':            PageBackroom.render(container, state); break;
            case 'Tela Principal':      PageDashboard.render(container, state); break;
            case 'Pesquisa':
            case 'Pesquisa Inteligente':
                PageSearch.render(container, state); break;
            case 'Repositório':         PageRepository.render(container, state); break;
            case 'Análise':             PageAnalysis.render(container, state); break;
            case 'Conexões':            PageConnections.render(container, state); break;
            case 'Comunidade':          PageChat.render(container, state); break;
            case 'Perfil':              PageProfile.render(container, state); break;
            default:                    PageDashboard.render(container, state);
        }
    }

    function navigate(pageName, clearSearch = true, pushHistory = true) {
        // Normalize
        if (pageName === 'chat' || pageName === 'Mensagens') pageName = 'Comunidade';

        if (pageName === 'Pesquisa Inteligente') pageName = 'Pesquisa';

        if (pageName === 'Tela Principal' && clearSearch) {
            state.search_query = '';
            state.quick_query = '';
            const navSearch = document.getElementById('nav-search-input');
            if (navSearch) navSearch.value = '';
        }

        // Push state into browser history so back button works smoothly
        if (pushHistory && window.history && window.history.pushState) {
            try {
                window.history.pushState({ page: pageName }, '', '#' + pageName.toLowerCase().replace(/\s+/g, '-'));
            } catch (e) {}
        }

        // When user opens chat without a specific target, don't mark all as read
        if (pageName === 'Comunidade' && !state.chat_target) {
            // keep bell badge — user may not have read messages yet
        } else if (pageName === 'Comunidade' && state.chat_target) {
            const emailClean = (state.current_user || '').toLowerCase().trim();
            if (emailClean) {
                localStorage.setItem('nebula_bell_seen_' + emailClean, Date.now().toString());
            }
            const badge = document.getElementById('navUnreadBadge');
            const mobileBadge = document.getElementById('mobileUnreadBadge');
            if (badge) badge.style.display = 'none';
            if (mobileBadge) mobileBadge.style.display = 'none';
        }

        // For pages that need fresh community data, refresh profiles silently first
        if ((pageName === 'Conexões' || pageName === 'Comunidade' || pageName === 'Tela Principal') && window.NebulaSupabase) {
            NebulaStorage.syncWorkspaceStateAsync(state, state.current_user).catch(() => {});
        }

        if (state.logged_in && state.current_user) {
            NebulaStorage.saveState(state);
        }

        const container = document.getElementById('pageContainer');
        container.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
        container.style.opacity = '0';
        container.style.transform = 'translateY(12px) scale(0.985)';

        setTimeout(() => {
            if (state.current_user && !state.admin_mode) {
                NebulaAnalytics.trackPage(state.current_user, pageName);
            }
            state.page = pageName;
            renderNavbar();
            renderPage();
            container.style.opacity = '0';
            container.style.transform = 'translateY(12px) scale(0.985)';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    container.style.opacity = '1';
                    container.style.transform = 'translateY(0) scale(1)';
                });
            });
        }, 180);
    }

    function logout() {
        if (state.current_user && !state.admin_mode) {
            NebulaAnalytics.stopSession(state.current_user);
        }
        sessionStorage.removeItem('nebula_admin_token');
        state.admin_mode = false;
        state.logged_in = false;
        state.current_user = null;
        NebulaStorage.syncWorkspaceState(state, null);
        renderApp();
    }

    function quickSearch(term) {
        state.search_query = term;
        state.quick_query = term;
        navigate('Tela Principal', false);
    }

    function recommendTerms(email, limit = 10) {
        const profile = (state.user_interest || {})[email] || {};
        return Object.entries(profile).sort((a, b) => b[1] - a[1]).slice(0, limit).map(e => e[0]);
    }

    function getState() { return state; }

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

    function populateAccountDropdown() {
        const dropdown = document.getElementById('accountDropdown');
        if (!dropdown) return;

        const savedAccounts = (() => {
            try {
                return JSON.parse(localStorage.getItem('nebula_saved_accounts') || '[]');
            } catch(e) { return []; }
        })();

        const otherAccounts = savedAccounts.filter(a => a.email !== state.current_user);

        let html = `
            <div style="padding:0.8rem 1rem; border-bottom:1px solid rgba(0,0,0,0.06); font-size:0.75rem; color:var(--text-white-60); font-weight:600;">
                CONTAS ATIVAS NO DISPOSITIVO
            </div>
            <div style="max-height: 200px; overflow-y: auto; display: flex; flex-direction: column;">
        `;

        if (otherAccounts.length === 0) {
            html += `<div style="padding:1.2rem; font-size:0.8rem; color:var(--text-white-60); text-align:center;">Nenhuma outra conta cadastrada.</div>`;
        } else {
            otherAccounts.forEach(acc => {
                const accUser = state.users[acc.email] || {};
                const accPhoto = accUser.photo || null;
                const initial = (acc.name || acc.email).trim().charAt(0).toUpperCase();
                html += `
                    <div class="saved-account-row-nav" style="
                        display: flex; align-items: center; gap: 0.6rem;
                        padding: 0.7rem 1.1rem; cursor: pointer; transition: all 0.15s;
                        border-bottom: 1px solid rgba(0,0,0,0.04);
                    " onclick="NebulaApp.switchActiveAccount('${acc.email}', '${acc.pass}')">
                        <div style="
                            width: 28px; height: 28px; border-radius: 50%; 
                            background: linear-gradient(135deg, #f97316, #ea580c);
                            display: flex; align-items: center; justify-content: center;
                            font-weight: 700; color: #fff; font-size: 0.8rem; flex-shrink: 0;
                            overflow: hidden;
                        ">
                            ${accPhoto ? `<img src="${accPhoto}" alt="" style="width:100%;height:100%;object-fit:cover;">` : initial}
                        </div>
                        <div style="text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
                            <div style="font-weight: 600; color: var(--text-white); font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${acc.name || 'Usuário'}</div>
                            <div style="font-size: 0.72rem; color: var(--text-white-60); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${acc.email}</div>
                        </div>
                    </div>
                `;
            });
        }

        html += `
            </div>
            <div style="padding:0.6rem 0.8rem; background:rgba(0,0,0,0.02); border-top:1px solid rgba(0,0,0,0.06);">
                <button onclick="NebulaApp.addNewAccountFromNavbar()" style="
                    width: 100%; padding: 0.5rem; background: rgba(255,255,255,0.45); 
                    border: 1px solid rgba(0,0,0,0.1); border-radius: 8px; color: var(--text-white); 
                    font-size: 0.75rem; font-weight: 600; cursor: pointer; text-align: center;
                    transition: all 0.15s;
                ">
                    Adicionar outra conta
                </button>
            </div>
        `;

        dropdown.innerHTML = html;

        // Append style dynamically if not exists
        if (!document.getElementById('nav-switcher-style')) {
            const style = document.createElement('style');
            style.id = 'nav-switcher-style';
            style.innerHTML = `
                .saved-account-row-nav:hover {
                    background: rgba(0,0,0,0.03) !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    function toggleAccountDropdown() {
        const dropdown = document.getElementById('accountDropdown');
        if (!dropdown) return;
        
        const isHidden = dropdown.style.display === 'none';
        if (isHidden) {
            closeBellDropdown();
            closeMobileMoreSheet();
            populateAccountDropdown();
            dropdown.style.display = 'block';
            const anchor = document.getElementById(isMobileLayout() ? 'mobileHdrAvatar' : 'navUserChip');
            positionFloatingPanel(dropdown, anchor);
            requestAnimationFrame(() => {
                dropdown.style.opacity = '1';
                dropdown.style.transform = 'translateY(0)';
            });
        } else {
            closeAccountDropdown();
        }
    }

    function closeAccountDropdown() {
        const dropdown = document.getElementById('accountDropdown');
        if (!dropdown) return;
        dropdown.style.opacity = '0';
        dropdown.style.transform = 'translateY(-8px)';
        setTimeout(() => { dropdown.style.display = 'none'; }, 180);
    }

    async function switchActiveAccount(email, pass) {
        closeAccountDropdown();

        // Create elegant switcher overlay loader
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; inset: 0; background: rgba(218, 200, 179, 0.98); 
            backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); 
            z-index: 1000000; display: flex; flex-direction: column; 
            align-items: center; justify-content: center; color: var(--text-white); font-family: 'Inter', sans-serif;
            animation: fadeIn 0.25s ease;
        `;
        overlay.innerHTML = `
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="var(--color-blue)" stroke-width="2" style="animation: spin 1s linear infinite; margin-bottom:1.5rem;">
                <circle cx="12" cy="12" r="10" stroke-dasharray="30" stroke-dashoffset="10"/>
            </svg>
            <div style="font-size: 1.25rem; font-weight: 600; color: var(--color-blue);">Alternando conta...</div>
            <div style="font-size: 0.85rem; color: var(--text-white-60); margin-top: 0.5rem;">Carregando repositório de ${email}...</div>
        `;
        document.body.appendChild(overlay);

        if (!state.users[email] && window.NebulaSupabase) {
            try {
                const { data } = await window.NebulaSupabase.from('profiles').select('*').eq('email', email).single();
                if (data) {
                    const dbPhoto = data.interest?._photo || data.photo || null;
                    state.users[email] = {
                        name: data.name,
                        research: data.research,
                        pass: data.pass,
                        tutorial_completed: data.tutorial_completed,
                        photo: dbPhoto
                    };
                    NebulaStorage.saveState(state);
                }
            } catch(e) {}
        }

        if (state.users[email] && state.users[email].pass === pass) {
            await NebulaStorage.setEncryptionKey(pass);
            state.logged_in = true;
            state.current_user = email;
            await NebulaStorage.syncWorkspaceStateAsync(state, email);
            state.page = 'Tela Principal';
            NebulaStorage.saveState(state);
            window.location.reload();
        } else {
            overlay.remove();
            alert('Falha ao alternar conta. Realize o login novamente.');
        }
    }

    function addNewAccountFromNavbar() {
        closeAccountDropdown();
        state.logged_in = false;
        state.current_user = null;
        window.showSavedAccounts = false;
        NebulaStorage.saveState(state);
        renderApp();
    }

    return { init, renderApp, renderPage, navigate, logout, quickSearch, recommendTerms, getState, updateBell, startBellPoll, toggleBellDropdown, goToChat, populateAccountDropdown, toggleAccountDropdown, closeAccountDropdown, switchActiveAccount, addNewAccountFromNavbar, toggleMobileMoreSheet, closeMobileMoreSheet, syncLayoutMode, renderMobileNav, renderMobileHeader };
})();

// Boot
document.addEventListener('DOMContentLoaded', () => {
    NebulaApp.init();
    setTimeout(() => NebulaApp.startBellPoll(), 3000);
});

/* ============================================================
   BACKROOM — painel admin secreto avançado (análise de usuários)
   ============================================================ */
const PageBackroom = (() => {
    const SECTIONS = ['Tela Principal', 'Pesquisa', 'Repositório', 'Análise', 'Conexões', 'Comunidade', 'Perfil', 'Auth'];

    // Variáveis locais para armazenar os dados carregados e estado atual
    let currentProfiles = [];
    let currentWorkspaces = [];
    let currentAnalytics = [];
    let wsMap = {};
    let anMap = {};
    let stateRef = null;

    function render(container, state) {
        stateRef = state;
        container.innerHTML = `
            <div class="backroom-shell">
                <!-- Cabeçalho Principal -->
                <div class="backroom-header glass" style="padding:1.5rem; border-radius:16px; margin-bottom:1.5rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:1.5rem;">
                    <div>
                        <div class="backroom-badge">PAINEL DE CONTROLE ADMINISTRATIVO · ACESSO RESTRITO</div>
                        <h1 class="page-title" style="margin:0; font-size:1.8rem; background: var(--primary-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Métricas & Governança Nebula</h1>
                        <p class="page-sub" style="margin-top:0.35rem; font-size:0.9rem; color:var(--text-white-60)">Análise analítica de sessões, distribuição de uso por seção, exportação de auditoria e controle de contas.</p>
                    </div>
                    <div style="display:flex; gap:0.75rem;">
                        <button class="btn btn-sm" id="br-export-global-pdf" style="background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:#fff; transition: all 0.2s ease;">
                            Exportar PDF Geral
                        </button>
                        <button class="btn btn-sm" id="br-exit" style="border-color:rgba(239,68,68,0.4); color:#fca5a5; background:rgba(239,68,68,0.05);">
                            <span>⎋</span> Encerrar Sessão
                        </button>
                    </div>
                </div>

                <!-- Painel de Métricas e Destaques Globais -->
                <div id="br-metrics" class="metric-grid" style="margin-bottom:1.5rem; display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem;">
                    <!-- Carregado via JS -->
                </div>

                <!-- Seção de Análise Gráfica com Plotly -->
                <div class="glass" style="padding:1.5rem; border-radius:16px; margin-bottom:1.5rem;">
                    <div class="section-title" style="margin-bottom:1rem; font-size:1.2rem; font-weight:700;">Gráficos e Estatísticas de Engajamento Global</div>
                    <div id="br-global-charts" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap:1.5rem;">
                        <div class="chart-container-wrap" style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); border-radius:12px; padding:1rem;">
                            <div style="font-size:0.85rem; font-weight:600; color:var(--text-white-60); margin-bottom:0.5rem; text-transform:uppercase; letter-spacing:0.05em;">Tempo Total por Usuário</div>
                            <div id="plotly-global-users" style="height:300px; width:100%;"></div>
                        </div>
                        <div class="chart-container-wrap" style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04); border-radius:12px; padding:1rem;">
                            <div style="font-size:0.85rem; font-weight:600; color:var(--text-white-60); margin-bottom:0.5rem; text-transform:uppercase; letter-spacing:0.05em;">Tempo de Tela por Seção (Geral)</div>
                            <div id="plotly-global-sections" style="height:300px; width:100%;"></div>
                        </div>
                    </div>
                </div>

                <!-- Tabela / Lista de Usuários Cadastrados -->
                <div class="glass" id="br-table-wrap" style="padding:1.5rem; border-radius:16px;">
                    <div style="display:flex; justify-content:between; align-items:center; margin-bottom:1.25rem;">
                        <div class="section-title" style="margin:0; font-size:1.2rem; font-weight:700;">Auditoria Individual de Contas</div>
                    </div>
                    <div id="br-loading" class="spinner-text" style="padding:3rem 0; text-align:center; color:var(--text-white-60)">Carregando dados com segurança...</div>
                    <div id="br-users-list" style="display:flex; flex-direction:column; gap:1rem;">
                        <!-- Usuários inseridos via JS -->
                    </div>
                </div>
            </div>

            <!-- Modal de Confirmação para Exclusão de Contas -->
            <div id="br-delete-modal" class="br-modal-overlay" style="display:none;">
                <div class="br-modal-content glass">
                    <div style="font-size:1.5rem; font-weight:800; color:#f87171; margin-bottom:0.5rem;">Excluir Conta Permanentemente?</div>
                    <p style="font-size:0.9rem; color:var(--text-white-60); margin-bottom:1.5rem; line-height:1.5;">Esta ação removerá permanentemente o usuário <b id="br-delete-target-name" style="color:#fff"></b> da plataforma Nebula. Todos os seus PDFs no repositório, histórico de buscas, histórico de sessões de tempo e mensagens serão excluídos permanentemente no Supabase. Esta operação não pode ser desfeita.</p>
                    <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
                        <button class="btn btn-sm btn-secondary" id="br-delete-cancel">Cancelar</button>
                        <button class="btn btn-sm" id="br-delete-confirm" style="background:#ef4444; border:none; color:white; font-weight:600; padding:0.5rem 1.25rem;">Confirmar Exclusão</button>
                    </div>
                </div>
            </div>

            <style>
                .backroom-shell { max-width: 1200px; margin: 0 auto; padding: 1.5rem 1rem 4rem; font-family: 'Inter', sans-serif; }
                .backroom-badge { font-size:0.68rem; letter-spacing:0.12em; color:#fca5a5; font-weight:700; margin-bottom:0.35rem; }
                
                /* Cards de Métricas */
                .br-metric-card {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.06);
                    border-radius: 12px;
                    padding: 1.25rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                    transition: transform 0.2s ease, border-color 0.2s ease;
                }
                .br-metric-card:hover {
                    transform: translateY(-2px);
                    border-color: rgba(255, 255, 255, 0.12);
                }
                .br-metric-label { font-size: 0.78rem; color: var(--text-white-60); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; }
                .br-metric-val { font-size: 1.5rem; font-weight: 800; color: #fff; }
                .br-metric-sub { font-size: 0.72rem; color: var(--text-white-60); margin-top: 0.15rem; }

                /* Linha / Card do Usuário */
                .br-user-card {
                    background: rgba(255, 255, 255, 0.02);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 14px;
                    padding: 1.25rem;
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .br-user-card:hover {
                    border-color: rgba(255, 255, 255, 0.1);
                    background: rgba(255, 255, 255, 0.03);
                }
                .br-user-card.active-open {
                    border-color: rgba(139, 92, 246, 0.3);
                    box-shadow: 0 0 20px rgba(139, 92, 246, 0.08);
                }
                
                .br-user-top { display:flex; justify-content:space-between; gap:1.25rem; flex-wrap:wrap; align-items:flex-start; }
                .br-user-info { display: flex; gap: 1rem; align-items: center; }
                .br-user-avatar {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #8b5cf6, #3b82f6);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 800;
                    color: white;
                    font-size: 1.1rem;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                }
                .br-user-name { font-weight:800; font-size:1.05rem; color:#fff; }
                .br-user-email { font-size:0.8rem; color:var(--text-white-60); margin-top: 0.1rem; }
                .br-user-research { font-size:0.75rem; color:#a78bfa; margin-top: 0.25rem; font-weight: 500; }
                
                .br-section-bars { display:flex; flex-wrap:wrap; gap:0.4rem; margin-top:0.85rem; }
                .br-sec-chip { font-size:0.7rem; padding:0.25rem 0.6rem; border-radius:999px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06); color:rgba(255,255,255,0.8); }
                .br-sec-chip.most-active { background:rgba(139, 92, 246, 0.15); border-color:rgba(139, 92, 246, 0.35); color:#c084fc; font-weight: 600; }

                /* Detalhes Colapsáveis */
                .br-user-details-panel {
                    margin-top: 1.25rem;
                    padding-top: 1.25rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.08);
                    display: none;
                    animation: fadeInDetails 0.25s ease-out;
                }
                @keyframes fadeInDetails {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                /* Tabela de Sessões */
                .br-sessions-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.8rem;
                    margin-top: 0.75rem;
                }
                .br-sessions-table th {
                    text-align: left;
                    padding: 0.5rem;
                    color: var(--text-white-60);
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                    text-transform: uppercase;
                    font-size: 0.65rem;
                    letter-spacing: 0.05em;
                }
                .br-sessions-table td {
                    padding: 0.5rem;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
                    color: rgba(255, 255, 255, 0.85);
                }
                .br-sessions-table tr:hover td {
                    background: rgba(255, 255, 255, 0.02);
                }

                /* Modais */
                .br-modal-overlay {
                    position: fixed;
                    top:0; left:0; width:100%; height:100%;
                    background: rgba(0,0,0,0.7);
                    backdrop-filter: blur(8px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 20000;
                    animation: fadeInOverlay 0.2s ease-out;
                }
                .br-modal-content {
                    max-width: 500px;
                    width: 90%;
                    padding: 2rem;
                    border-radius: 16px;
                    border: 1px solid rgba(255,255,255,0.1);
                    background: #121417;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.8);
                    animation: slideUpModal 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28);
                }
                @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUpModal { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

                .action-row {
                    display: flex;
                    justify-content: flex-end;
                    gap: 0.5rem;
                    margin-top: 1rem;
                    flex-wrap: wrap;
                }
            </style>
        `;

        // Eventos principais da página
        document.getElementById('br-exit').addEventListener('click', () => {
            sessionStorage.removeItem('nebula_admin_token');
            state.admin_mode = false;
            state.logged_in = false;
            state.current_user = null;
            state.page = 'Tela Principal';
            NebulaStorage.saveState(state);
            NebulaApp.renderApp();
        });

        document.getElementById('br-export-global-pdf').addEventListener('click', () => {
            exportGlobalReportPDF();
        });

        // Configuração dos eventos de fechar modal de exclusão
        document.getElementById('br-delete-cancel').addEventListener('click', () => {
            document.getElementById('br-delete-modal').style.display = 'none';
        });

        loadData();
    }

    async function loadData() {
        const usersListEl = document.getElementById('br-users-list');
        const metricsEl = document.getElementById('br-metrics');
        const loadingEl = document.getElementById('br-loading');

        if (loadingEl) {
            loadingEl.style.display = 'block';
            loadingEl.innerHTML = '<div class="spinner-text" style="padding:2rem 0; text-align:center; color:var(--text-white-60)">Carregando dados com segurança...</div>';
        }

        try {
            // 1. Busca dados do Supabase com timeout curto para não travar em falhas de rede
            const fetchWithTimeout = (promise, ms = 2500) => {
                return Promise.race([
                    promise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
                ]).catch(err => {
                    console.warn('[Backroom] Supabase query bypassed:', err);
                    return [];
                });
            };

            const [dbProfiles, dbWorkspaces, dbAnalytics] = await Promise.all([
                fetchWithTimeout(NebulaAnalytics.fetchAllProfiles()),
                fetchWithTimeout(NebulaAnalytics.fetchAllWorkspaces()),
                fetchWithTimeout(NebulaAnalytics.fetchAllAnalytics())
            ]);

            // 2. Agrega e-mails de TODAS as fontes (Supabase, State local, Saved accounts, Analytics no LocalStorage)
            const allEmails = new Set();

            (dbProfiles || []).forEach(p => {
                if (p && p.email && p.email !== '__admin__') allEmails.add(p.email.toLowerCase().trim());
            });

            if (stateRef && stateRef.users) {
                Object.keys(stateRef.users).forEach(e => {
                    if (e && e !== '__admin__' && !e.startsWith('demo_')) allEmails.add(e.toLowerCase().trim());
                });
            }

            try {
                const savedAccs = JSON.parse(localStorage.getItem('nebula_saved_accounts') || '[]');
                savedAccs.forEach(a => {
                    if (a && a.email && a.email !== '__admin__') allEmails.add(a.email.toLowerCase().trim());
                });
            } catch (e) {}

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('nebula_analytics_')) {
                    const em = key.replace('nebula_analytics_', '').toLowerCase().trim();
                    if (em && em !== '__admin__') allEmails.add(em);
                }
            }

            // 3. Monta o Mapa de Perfis consolidado
            const profilesMap = new Map();

            (dbProfiles || []).forEach(p => {
                if (!p || !p.email) return;
                const em = p.email.toLowerCase().trim();
                profilesMap.set(em, {
                    email: p.email,
                    name: p.name || em,
                    research: p.research || 'Pesquisa Acadêmica',
                    photo: p.photo || null
                });
            });

            allEmails.forEach(em => {
                const localUser = (stateRef && stateRef.users) ? stateRef.users[em] : null;
                const existing = profilesMap.get(em) || {};

                let name = existing.name || localUser?.name;
                let research = existing.research || localUser?.research || 'Pesquisa Acadêmica';
                let photo = existing.photo || localUser?.photo || null;

                if (!name) {
                    try {
                        const saved = JSON.parse(localStorage.getItem('nebula_saved_accounts') || '[]');
                        const acc = saved.find(a => (a.email || '').toLowerCase().trim() === em);
                        if (acc && acc.name) name = acc.name;
                    } catch (e) {}
                }

                if (!name) name = em.split('@')[0];

                profilesMap.set(em, {
                    email: em,
                    name: name,
                    research: research,
                    photo: photo
                });
            });

            currentProfiles = Array.from(profilesMap.values());

            // 4. Monta o Mapa de Workspaces
            wsMap = {};
            (dbWorkspaces || []).forEach(w => {
                if (w && w.email) wsMap[w.email.toLowerCase().trim()] = w;
            });

            allEmails.forEach(em => {
                if (!wsMap[em]) {
                    const localWs = (stateRef && stateRef.workspaces) ? stateRef.workspaces[em] : null;
                    const userRepo = localWs?.repository || (stateRef && stateRef.current_user?.toLowerCase() === em ? stateRef.repository : []) || [];
                    const userSearch = localWs?.search_history || (stateRef && stateRef.current_user?.toLowerCase() === em ? stateRef.search_history : []) || [];
                    wsMap[em] = {
                        email: em,
                        repository: userRepo,
                        search_history: userSearch
                    };
                }
            });

            // 5. Monta o Mapa de Analytics
            anMap = {};
            (dbAnalytics || []).forEach(a => {
                if (a && a.email) anMap[a.email.toLowerCase().trim()] = a;
            });

            // 6. Cálculo das métricas consolidadas
            let totalUsers = currentProfiles.length;
            let totalTime = 0;
            let activeToday = 0;
            const todayStr = new Date().toDateString();

            const globalSectionTimes = {};
            SECTIONS.forEach(s => globalSectionTimes[s] = 0);

            let maxUserTime = -1;

            currentProfiles.forEach(p => {
                const local = NebulaAnalytics.mergeLocalAnalytics(p.email);
                const remote = anMap[p.email] || {};
                const secs = Math.max(remote.total_seconds || 0, local.total_seconds || 0);
                totalTime += secs;

                if (secs > maxUserTime) {
                    maxUserTime = secs;
                }

                const sectionTimes = { ...(remote.section_times || {}), ...(local.section_times || {}) };
                Object.keys(sectionTimes).forEach(k => {
                    if (SECTIONS.includes(k)) {
                        globalSectionTimes[k] += (sectionTimes[k] || 0);
                    }
                });

                const last = remote.last_seen || local.last_seen;
                if (last && new Date(last).toDateString() === todayStr) activeToday++;
            });

            let mostUsedGlobalSection = 'Nenhuma';
            let maxGlobalSectionTime = -1;
            Object.entries(globalSectionTimes).forEach(([sec, time]) => {
                if (time > maxGlobalSectionTime && time > 0) {
                    maxGlobalSectionTime = time;
                    mostUsedGlobalSection = sec;
                }
            });

            metricsEl.innerHTML = `
                <div class="br-metric-card">
                    <div class="br-metric-label">Usuários Cadastrados</div>
                    <div class="br-metric-val">${totalUsers}</div>
                    <div class="br-metric-sub">Contas ativas na base</div>
                </div>
                <div class="br-metric-card">
                    <div class="br-metric-label">Tempo Total Acumulado</div>
                    <div class="br-metric-val" style="font-size: 1.35rem; color:#38bdf8;">${NebulaAnalytics.formatDuration(totalTime)}</div>
                    <div class="br-metric-sub">Consumo total de tela</div>
                </div>
                <div class="br-metric-card">
                    <div class="br-metric-label">Ativos Hoje</div>
                    <div class="br-metric-val" style="color:#34d399;">${activeToday}</div>
                    <div class="br-metric-sub">Sessões em ${new Date().toLocaleDateString('pt-BR')}</div>
                </div>
                <div class="br-metric-card">
                    <div class="br-metric-label">Seção Líder de Uso</div>
                    <div class="br-metric-val" style="font-size:1.25rem; color:#a78bfa;">${mostUsedGlobalSection}</div>
                    <div class="br-metric-sub">${maxGlobalSectionTime > 0 ? NebulaAnalytics.formatDuration(maxGlobalSectionTime) : 'Sem tempo registrado'}</div>
                </div>
            `;

            if (loadingEl) loadingEl.style.display = 'none';

            // 7. Renderiza gráficos e listagem
            renderGlobalCharts(globalSectionTimes);

            usersListEl.innerHTML = currentProfiles.map(p => {
                const ws = wsMap[p.email] || {};
                const remote = anMap[p.email] || {};
                const local = NebulaAnalytics.mergeLocalAnalytics(p.email);

                const sectionTimes = { ...(remote.section_times || {}), ...(local.section_times || {}) };
                Object.keys(local.section_times || {}).forEach(k => {
                    sectionTimes[k] = Math.max(sectionTimes[k] || 0, local.section_times[k] || 0);
                });

                const totalSec = Math.max(remote.total_seconds || 0, local.total_seconds || 0);
                const docs = (ws.repository || []).length;
                const searches = (ws.search_history || []).length;
                const lastSeen = remote.last_seen || local.last_seen || null;

                let maxSec = 'Nenhuma';
                let maxSecTime = 0;
                Object.entries(sectionTimes).forEach(([sec, time]) => {
                    if (SECTIONS.includes(sec) && time > maxSecTime) {
                        maxSecTime = time;
                        maxSec = sec;
                    }
                });

                const initials = (p.name || 'S').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                const chips = SECTIONS.filter(s => sectionTimes[s] > 0)
                    .map(s => {
                        const isMost = s === maxSec;
                        return `<span class="br-sec-chip ${isMost ? 'most-active' : ''}">${s}: ${NebulaAnalytics.formatDuration(sectionTimes[s])}</span>`;
                    })
                    .join('') || '<span class="br-sec-chip">Nenhuma seção acessada ainda</span>';

                const safeId = p.email.replace(/[@.]/g, '_');
                const safeNameEscaped = (p.name || p.email).replace(/'/g, "\\'");

                return `
                    <div class="br-user-card glass" id="card-${safeId}">
                        <div class="br-user-top">
                            <div class="br-user-info">
                                <div class="br-user-avatar">${initials}</div>
                                <div>
                                    <div class="br-user-name">${p.name || 'Sem Nome'}</div>
                                    <div class="br-user-email">${p.email}</div>
                                    <div class="br-user-research">${p.research || 'Área de pesquisa não informada'}</div>
                                </div>
                            </div>
                            <div style="text-align:right; font-size:0.8rem; color:var(--text-white-60)">
                                <div>Duração Total: <b style="color:#a78bfa; font-size:0.95rem;">${NebulaAnalytics.formatDuration(totalSec)}</b></div>
                                <div style="margin: 0.15rem 0;">${docs} docs adicionados · ${searches} pesquisas feitas</div>
                                <div>Último login: <span style="color:#fff">${lastSeen ? new Date(lastSeen).toLocaleString('pt-BR') : '—'}</span></div>
                            </div>
                        </div>

                        <div class="br-section-bars">
                            ${chips}
                        </div>

                        <div class="action-row">
                            <button class="btn btn-sm btn-secondary br-toggle-details-btn" data-email="${p.email}" style="border:1px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.02);">
                                Detalhar & Auditoria ↓
                            </button>
                            <button class="btn btn-sm" onclick="PageBackroom.triggerDelete('${p.email}', '${safeNameEscaped}')" style="background:rgba(239, 68, 68, 0.1); border:1px solid rgba(239,68,68,0.25); color:#fca5a5;">
                                Excluir Conta
                            </button>
                        </div>

                        <div class="br-user-details-panel" id="panel-${safeId}">
                            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:1.25rem;">
                                <div style="background:rgba(255,255,255,0.015); border:1px solid rgba(255,255,255,0.04); border-radius:10px; padding:1rem;">
                                    <div style="font-weight:700; font-size:0.85rem; color:#fff; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:0.4rem; margin-bottom:0.75rem; text-transform:uppercase; letter-spacing:0.05em;">
                                        Análise Operacional de Seções
                                    </div>
                                    <div style="display:flex; flex-direction:column; gap:0.5rem; font-size:0.85rem;">
                                        <div><b>Seção Mais Acessada:</b> <span style="color:#c084fc; font-weight:600;">${maxSec}</span> (${maxSecTime > 0 ? NebulaAnalytics.formatDuration(maxSecTime) : '0s'})</div>
                                        <div><b>Seção Menos Acessada:</b> ${getLeastActiveSection(sectionTimes)}</div>
                                    </div>

                                    <div style="margin-top:1.25rem; display:flex; gap:0.5rem;">
                                        <button class="btn btn-sm" onclick="PageBackroom.exportUserPDF('${p.email}')" style="background:var(--primary-gradient); border:none; color:white; font-weight:600; width:100%; display:inline-flex; align-items:center; justify-content:center; gap:0.4rem;">
                                            Exportar Relatório (PDF)
                                        </button>
                                    </div>
                                </div>

                                <div style="background:rgba(255,255,255,0.015); border:1px solid rgba(255,255,255,0.04); border-radius:10px; padding:1rem;">
                                    <div style="font-weight:700; font-size:0.85rem; color:#fff; margin-bottom:0.5rem; text-transform:uppercase; letter-spacing:0.05em;">
                                        Distribuição Gráfica de Tempo
                                    </div>
                                    <div id="plotly-user-${safeId}" style="height:190px; width:100%;"></div>
                                </div>
                            </div>

                            <div style="margin-top:1.25rem; background:rgba(255,255,255,0.01); border:1px solid rgba(255,255,255,0.03); border-radius:10px; padding:1rem;">
                                <div style="font-weight:700; font-size:0.85rem; color:#fff; margin-bottom:0.5rem; text-transform:uppercase; letter-spacing:0.05em; display:flex; justify-content:space-between; align-items:center;">
                                    <span>Logs de Entrada na Plataforma (Últimas 40 sessões)</span>
                                    <span style="font-size:0.75rem; color:var(--text-white-60);">Total de registros: ${getUserSessionsCount(p.email)}</span>
                                </div>
                                <div style="max-height: 200px; overflow-y: auto;">
                                    <table class="br-sessions-table">
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Entrada (Login)</th>
                                                <th>Saída (Último Sinal)</th>
                                                <th>Duração da Sessão</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${renderSessionsRows(p.email, remote.sessions, local.sessions)}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>`;
            }).join('');

            document.querySelectorAll('.br-toggle-details-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const email = btn.getAttribute('data-email');
                    toggleUserDetails(email, btn);
                });
            });

        } catch (e) {
            if (loadingEl) {
                loadingEl.innerHTML = `<div style="padding:2rem; color:#fca5a5;">Erro ao carregar dados do painel: ${e.message || e}</div>`;
            }
            console.error('[Backroom] Load error:', e);
        }
    }
    }

    // Calcula a seção menos visitada
    function getLeastActiveSection(sectionTimes) {
        // Encontra a seção com menor tempo ativo (> 0)
        let leastSec = 'Nenhuma';
        let leastSecTime = Infinity;

        // Seção não visitada (0s)
        const unvisited = SECTIONS.filter(s => !(sectionTimes[s] > 0));
        if (unvisited.length > 0) {
            return `<span style="color:#f87171; font-weight:600;">${unvisited[0]}</span> (0s) <span class="small-muted" style="font-size:0.7rem; color:var(--text-white-60)">- Não acessada</span>`;
        }

        Object.entries(sectionTimes).forEach(([sec, time]) => {
            if (SECTIONS.includes(sec) && time > 0 && time < leastSecTime) {
                leastSecTime = time;
                leastSec = sec;
            }
        });

        if (leastSecTime === Infinity) {
            return 'Nenhuma registrada';
        }

        return `<span style="color:#f87171; font-weight:600;">${leastSec}</span> (${NebulaAnalytics.formatDuration(leastSecTime)})`;
    }

    // Conta total de sessões do usuário
    function getUserSessionsCount(email) {
        const local = NebulaAnalytics.loadLocal(email);
        const remote = anMap[email] || {};
        const merged = mergeSessionsList(remote.sessions, local.sessions);
        return merged.length;
    }

    // Lista ordenada de sessões sem duplicações
    function mergeSessionsList(remoteSessions, localSessions) {
        const all = [];
        const seenStarts = new Set();
        const addSession = (s) => {
            if (s && s.start && !seenStarts.has(s.start)) {
                seenStarts.add(s.start);
                all.push(s);
            }
        };
        (remoteSessions || []).forEach(addSession);
        (localSessions || []).forEach(addSession);
        // Ordena decrescente (mais recente primeiro)
        all.sort((a, b) => new Date(b.start) - new Date(a.start));
        return all;
    }

    // Renderiza linhas de sessões na tabela
    function renderSessionsRows(email, remoteSessions, localSessions) {
        const merged = mergeSessionsList(remoteSessions, localSessions);
        if (merged.length === 0) {
            return `<tr><td colspan="4" style="text-align:center; color:var(--text-white-60); padding: 1.5rem 0;">Nenhum registro de log de login neste dispositivo ou Supabase.</td></tr>`;
        }

        return merged.map((s, idx) => {
            const num = merged.length - idx;
            const start = new Date(s.start).toLocaleString('pt-BR');
            let end = '—';
            let duration = 'Em andamento';

            if (s.end) {
                end = new Date(s.end).toLocaleString('pt-BR');
                const durSec = (new Date(s.end) - new Date(s.start)) / 1000;
                duration = NebulaAnalytics.formatDuration(durSec);
            } else if (idx === 0) {
                // Se for a sessão mais recente e não tiver fim, pode ser que o usuário esteja ativo ou fechou abruptamente
                const diffTime = (new Date() - new Date(s.start)) / 1000;
                if (diffTime < 1800) {
                    duration = `<span style="color:#34d399; font-weight:600;">Ativo (${NebulaAnalytics.formatDuration(diffTime)})</span>`;
                } else {
                    duration = 'Sessão encerrada (indeterminado)';
                }
            }

            return `
                <tr>
                    <td><b>${num}</b></td>
                    <td>${start}</td>
                    <td>${end}</td>
                    <td>${duration}</td>
                </tr>
            `;
        }).join('');
    }

    // Alternar painel colapsável de detalhes e renderizar gráfico Plotly individual
    function toggleUserDetails(email, btn) {
        const idSafe = email.replace(/[@.]/g, '_');
        const panel = document.getElementById(`panel-${idSafe}`);
        const card = document.getElementById(`card-${idSafe}`);
        const isOpen = panel.style.display === 'block';

        if (isOpen) {
            panel.style.display = 'none';
            card.classList.remove('active-open');
            btn.innerHTML = 'Detalhar & Auditoria ↓';
        } else {
            panel.style.display = 'block';
            card.classList.add('active-open');
            btn.innerHTML = 'Recolher Detalhes ↑';
            // Renderiza o gráfico do usuário
            renderUserChart(email);
        }
    }

    // RENDERIZAR GRÁFICOS COM PLOTLY
    function renderGlobalCharts(globalSectionTimes) {
        if (typeof Plotly === 'undefined') return;

        try {
            const labels = Object.keys(globalSectionTimes);
            const values = Object.values(globalSectionTimes).map(v => Math.round(v / 60));

            const sectionColors = ['#8b5cf6', '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6'];

            const donutData = [{
                values: values,
                labels: labels,
                type: 'pie',
                hole: 0.4,
                textinfo: 'percent',
                hoverinfo: 'label+value+percent',
                hovertemplate: '<b>%{label}</b><br>Tempo: %{value} min<br>Proporção: %{percent}<extra></extra>',
                marker: { colors: sectionColors }
            }];

            const donutLayout = {
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { family: 'Inter, sans-serif', color: 'rgba(255,255,255,0.7)', size: 10 },
                showlegend: true,
                legend: { orientation: 'h', x: 0, y: -0.1 },
                margin: { t: 10, r: 10, l: 10, b: 60 }
            };

            const secEl = document.getElementById('plotly-global-sections');
            if (secEl) Plotly.newPlot(secEl, donutData, donutLayout, { responsive: true, displayModeBar: false });

            const userEmails = [];
            const userMinutes = [];

            currentProfiles.forEach(p => {
                const local = NebulaAnalytics.mergeLocalAnalytics(p.email);
                const remote = anMap[p.email] || {};
                const secs = Math.max(remote.total_seconds || 0, local.total_seconds || 0);
                userEmails.push(p.name || p.email);
                userMinutes.push(Math.round(secs / 60));
            });

            const combined = userEmails.map((email, i) => ({ email, min: userMinutes[i] }));
            combined.sort((a, b) => a.min - b.min);

            const barData = [{
                x: combined.map(c => c.min),
                y: combined.map(c => c.email),
                type: 'bar',
                orientation: 'h',
                marker: {
                    color: 'rgba(139, 92, 246, 0.7)',
                    line: { color: 'rgba(139, 92, 246, 1)', width: 1 }
                },
                hovertemplate: '<b>%{y}</b><br>Tempo total: %{x} minutos<extra></extra>'
            }];

            const barLayout = {
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { family: 'Inter, sans-serif', color: 'rgba(255,255,255,0.7)', size: 9 },
                xaxis: { gridcolor: 'rgba(255,255,255,0.06)', zeroline: false, title: 'Minutos Ativos' },
                yaxis: { automargin: true },
                margin: { t: 10, r: 20, l: 100, b: 40 }
            };

            const userEl = document.getElementById('plotly-global-users');
            if (userEl) Plotly.newPlot(userEl, barData, barLayout, { responsive: true, displayModeBar: false });
        } catch (e) {
            console.warn('[Backroom] Plotly global charts render bypassed:', e);
        }
    }

    // Gráfico de barras individual do usuário
    function renderUserChart(email) {
        if (typeof Plotly === 'undefined') return;
        try {
            const idSafe = email.replace(/[@.]/g, '_');
            const chartDivId = `plotly-user-${idSafe}`;
            const targetDiv = document.getElementById(chartDivId);
            if (!targetDiv) return;

            const remote = anMap[email] || {};
            const local = NebulaAnalytics.mergeLocalAnalytics(email);
            const sectionTimes = { ...(remote.section_times || {}), ...(local.section_times || {}) };
            
            Object.keys(local.section_times || {}).forEach(k => {
                sectionTimes[k] = Math.max(sectionTimes[k] || 0, local.section_times[k] || 0);
            });

            const activeLabels = SECTIONS.filter(s => (sectionTimes[s] || 0) > 0);
            const activeValues = activeLabels.map(s => Math.round((sectionTimes[s] || 0) / 60));

            if (activeLabels.length === 0) {
                targetDiv.innerHTML = `
                    <div style="height:100%; display:flex; align-items:center; justify-content:center; color:var(--text-white-60); font-size:0.8rem; border:1px dashed rgba(255,255,255,0.06); border-radius:8px;">
                        Sem dados gráficos para exibir ainda.
                    </div>
                `;
                return;
            }

            const data = [{
                x: activeLabels,
                y: activeValues,
                type: 'bar',
                marker: {
                    color: 'rgba(59, 130, 246, 0.7)',
                    line: { color: 'rgba(59, 130, 246, 1)', width: 1 }
                },
                hovertemplate: '<b>%{x}</b>: %{y} minutos de uso<extra></extra>'
            }];

            const layout = {
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { family: 'Inter, sans-serif', color: 'rgba(255,255,255,0.6)', size: 8 },
                xaxis: { gridcolor: 'rgba(0,0,0,0)', tickangle: -25 },
                yaxis: { gridcolor: 'rgba(255,255,255,0.05)', zeroline: false, title: 'Minutos' },
                margin: { t: 10, r: 10, l: 35, b: 45 }
            };

            Plotly.newPlot(targetDiv, data, layout, { responsive: true, displayModeBar: false });
        } catch (e) {
            console.warn('[Backroom] User chart render bypassed:', e);
        }
    }

    // EXCLUSÃO PERMANENTE DE CONTAS
    let emailToDelete = null;

    function triggerDelete(email, name) {
        emailToDelete = email;
        document.getElementById('br-delete-target-name').textContent = `${name} (${email})`;
        document.getElementById('br-delete-modal').style.display = 'flex';
    }

    // Vincula evento no botão de exclusão
    document.addEventListener('click', async (e) => {
        if (e.target && e.target.id === 'br-delete-confirm') {
            if (!emailToDelete) return;
            const modal = document.getElementById('br-delete-modal');
            const confirmBtn = document.getElementById('br-delete-confirm');

            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Excluindo...';

            try {
                // 1. Remove do estado local se existir
                if (stateRef) {
                    if (stateRef.users && stateRef.users[emailToDelete]) delete stateRef.users[emailToDelete];
                    if (stateRef.workspaces && stateRef.workspaces[emailToDelete]) delete stateRef.workspaces[emailToDelete];
                    if (stateRef.user_interest && stateRef.user_interest[emailToDelete]) delete stateRef.user_interest[emailToDelete];
                    NebulaStorage.saveState(stateRef);
                }

                // 2. Remove das contas salvas no localStorage
                try {
                    let saved = JSON.parse(localStorage.getItem('nebula_saved_accounts') || '[]');
                    saved = saved.filter(a => (a.email || '').toLowerCase().trim() !== emailToDelete.toLowerCase().trim());
                    localStorage.setItem('nebula_saved_accounts', JSON.stringify(saved));
                } catch(e) {}

                // 3. Remove analytics do localStorage
                localStorage.removeItem(`nebula_analytics_${emailToDelete}`);

                // 4. Tenta deletar no Supabase se o cliente estiver ativo
                if (window.NebulaSupabase) {
                    await Promise.all([
                        window.NebulaSupabase.from('profiles').delete().eq('email', emailToDelete).catch(()=>{}),
                        window.NebulaSupabase.from('workspaces').delete().eq('email', emailToDelete).catch(()=>{}),
                        window.NebulaSupabase.from('user_analytics').delete().eq('email', emailToDelete).catch({})
                    ]);
                }

                alert(`Conta ${emailToDelete} excluída permanentemente com sucesso.`);
                
                if (modal) modal.style.display = 'none';
                emailToDelete = null;
                
                // Recarrega dados
                loadData();

            } catch (err) {
                alert(`Erro ao excluir: ${err.message || err}`);
            } finally {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Confirmar Exclusão';
            }
        }
    });

    // EXPORTAR RELATÓRIO GERAL DA PLATAFORMA EM PDF
    function exportGlobalReportPDF() {
        const { jsPDF } = window.jspdf || window;
        if (!jsPDF) {
            alert('A biblioteca jsPDF não pôde ser carregada.');
            return;
        }

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const W = pdf.internal.pageSize.getWidth();
        const H = pdf.internal.pageSize.getHeight();

        // Estilo e Cores
        pdf.setFillColor(20, 24, 28);
        pdf.rect(0, 0, W, 22, 'F');

        // Título e Cabeçalho
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.text('NEBULA RESEARCH · SISTEMA DE GESTÃO E AUDITORIA', 15, 14);

        pdf.setTextColor(150, 150, 150);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        const dataEmissão = new Date().toLocaleString('pt-BR');
        pdf.text(`RELATÓRIO ADMINISTRATIVO GERAL · GERADO EM: ${dataEmissão}`, 15, 29);

        // Separador
        pdf.setDrawColor(220, 220, 220);
        pdf.line(15, 32, W - 15, 32);

        // Quadro Resumo Global
        let totalUsers = currentProfiles.length;
        let totalTime = 0;
        currentProfiles.forEach(p => {
            const local = NebulaAnalytics.mergeLocalAnalytics(p.email);
            const remote = anMap[p.email] || {};
            totalTime += Math.max(remote.total_seconds || 0, local.total_seconds || 0);
        });

        pdf.setTextColor(40, 40, 40);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text('QUADRO RESUMO DE AUDITORIA', 15, 40);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.text(`- Total de Contas de Usuários Cadastrados: ${totalUsers}`, 17, 47);
        pdf.text(`- Tempo Consolidado de Tela no Sistema: ${NebulaAnalytics.formatDuration(totalTime)}`, 17, 53);
        pdf.text(`- Status das Tabelas Supabase: profiles (Ativo), workspaces (Ativo), analytics (Ativo)`, 17, 59);

        // Tabela de Usuários
        pdf.setFont('helvetica', 'bold');
        pdf.text('LISTAGEM CONSOLIDADA DE CONTAS E ENGAGEMENT', 15, 71);

        pdf.setDrawColor(180, 180, 180);
        pdf.setFillColor(240, 240, 240);
        pdf.rect(15, 74, W - 30, 8, 'F');
        
        pdf.setFontSize(8);
        pdf.setTextColor(50, 50, 50);
        pdf.text('Nome do Usuário', 17, 79);
        pdf.text('E-mail do Perfil', 65, 79);
        pdf.text('Área de Pesquisa', 115, 79);
        pdf.text('Docs', 160, 79);
        pdf.text('Tempo Ativo', 175, 79);

        pdf.line(15, 82, W - 15, 82);

        let y = 87;
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(60, 60, 60);

        currentProfiles.forEach((p, idx) => {
            const ws = wsMap[p.email] || {};
            const remote = anMap[p.email] || {};
            const local = NebulaAnalytics.mergeLocalAnalytics(p.email);
            const totalSec = Math.max(remote.total_seconds || 0, local.total_seconds || 0);
            const docs = (ws.repository || []).length;

            if (y > H - 20) {
                pdf.addPage();
                // Repete cabeçalho simples
                pdf.setFillColor(20, 24, 28);
                pdf.rect(0, 0, W, 12, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(9);
                pdf.text('NEBULA RESEARCH · SISTEMA DE GESTÃO E AUDITORIA', 15, 8);
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(8);
                pdf.setTextColor(60, 60, 60);
                y = 20;
            }

            // Alternar cor de linha
            if (idx % 2 === 1) {
                pdf.setFillColor(250, 250, 250);
                pdf.rect(15, y - 4, W - 30, 6, 'F');
            }

            pdf.text(p.name ? p.name.substring(0, 24) : 'Sem Nome', 17, y);
            pdf.text(p.email.substring(0, 28), 65, y);
            pdf.text(p.research ? p.research.substring(0, 24) : 'Não especificado', 115, y);
            pdf.text(String(docs), 161, y);
            pdf.text(NebulaAnalytics.formatDuration(totalSec), 175, y);

            y += 6;
        });

        // Rodapé de Página
        const pageCount = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            pdf.setPage(i);
            pdf.setDrawColor(230, 230, 230);
            pdf.line(15, H - 12, W - 15, H - 12);
            pdf.setFontSize(7);
            pdf.setTextColor(150, 150, 150);
            pdf.text(`Nebula Research Auditoria · Página ${i} de ${pageCount}`, 15, H - 8);
            pdf.text('CONFIDENCIAL · ADMINISTRATIVO', W - 60, H - 8);
        }

        pdf.save('relatorio-global-nebula.pdf');
    }

    // EXPORTAR RELATÓRIO DO USUÁRIO INDIVIDUAL EM PDF
    function exportUserReportPDF(email) {
        const { jsPDF } = window.jspdf || window;
        if (!jsPDF) {
            alert('A biblioteca jsPDF não pôde ser carregada.');
            return;
        }

        const p = currentProfiles.find(x => x.email === email);
        if (!p) return;

        const ws = wsMap[email] || {};
        const remote = anMap[email] || {};
        const local = NebulaAnalytics.mergeLocalAnalytics(email);

        const totalSec = Math.max(remote.total_seconds || 0, local.total_seconds || 0);
        const docs = (ws.repository || []).length;
        const searches = (ws.search_history || []).length;
        const lastSeen = remote.last_seen || local.last_seen || null;

        const sectionTimes = { ...(remote.section_times || {}), ...(local.section_times || {}) };
        Object.keys(local.section_times || {}).forEach(k => {
            sectionTimes[k] = Math.max(sectionTimes[k] || 0, local.section_times[k] || 0);
        });

        // Acha seção mais/menos acessadas
        let maxSec = 'Nenhuma';
        let maxSecTime = 0;
        Object.entries(sectionTimes).forEach(([sec, time]) => {
            if (SECTIONS.includes(sec) && time > maxSecTime) {
                maxSecTime = time;
                maxSec = sec;
            }
        });

        const activeSecs = Object.entries(sectionTimes).filter(([s, time]) => SECTIONS.includes(s) && time > 0);
        activeSecs.sort((a, b) => a[1] - b[1]);
        const minSec = activeSecs.length > 0 ? activeSecs[0][0] : 'Nenhuma';
        const minSecTime = activeSecs.length > 0 ? activeSecs[0][1] : 0;

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const W = pdf.internal.pageSize.getWidth();
        const H = pdf.internal.pageSize.getHeight();

        // Estilo e Cores
        pdf.setFillColor(20, 24, 28);
        pdf.rect(0, 0, W, 22, 'F');

        // Título
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(12);
        pdf.text('NEBULA RESEARCH · RELATÓRIO INDIVIDUAL DE OPERAÇÃO', 15, 14);

        pdf.setTextColor(150, 150, 150);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        const dataEmissão = new Date().toLocaleString('pt-BR');
        pdf.text(`AUDITORIA DO USUÁRIO · EMISSÃO: ${dataEmissão}`, 15, 29);

        // Separador
        pdf.setDrawColor(220, 220, 220);
        pdf.line(15, 32, W - 15, 32);

        // Informações Básicas
        pdf.setTextColor(40, 40, 40);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text('PERFIL DE CADASTRO DO USUÁRIO', 15, 40);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.text(`Nome: ${p.name || 'Sem Nome'}`, 15, 46);
        pdf.text(`E-mail de Login: ${p.email}`, 15, 52);
        pdf.text(`Linha de Pesquisa: ${p.research || 'Não especificada'}`, 15, 58);
        pdf.text(`Último Acesso Registrado: ${lastSeen ? new Date(lastSeen).toLocaleString('pt-BR') : 'Sem registros'}`, 15, 64);

        // Caixa de Tempo
        pdf.setFillColor(245, 245, 250);
        pdf.rect(120, 37, 75, 30, 'F');
        pdf.setDrawColor(200, 200, 220);
        pdf.rect(120, 37, 75, 30, 'S');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.text('TEMPO TOTAL ACUMULADO', 125, 43);
        pdf.setFontSize(14);
        pdf.setTextColor(139, 92, 246);
        pdf.text(NebulaAnalytics.formatDuration(totalSec), 125, 52);
        pdf.setFontSize(8);
        pdf.setTextColor(80, 80, 80);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Documentos: ${docs}  |  Buscas: ${searches}`, 125, 61);

        // Uso do tempo por Seções
        pdf.setTextColor(40, 40, 40);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text('COMPORTAMENTO DE USO POR SEÇÃO', 15, 78);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.text(`- Seção com maior engajamento: ${maxSec} (${NebulaAnalytics.formatDuration(maxSecTime)})`, 15, 84);
        pdf.text(`- Seção com menor engajamento: ${minSec} (${NebulaAnalytics.formatDuration(minSecTime)})`, 15, 90);

        // Tabela de Detalhamento de Seções
        pdf.setDrawColor(200, 200, 200);
        pdf.setFillColor(245, 245, 245);
        pdf.rect(15, 96, W - 30, 8, 'F');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.text('Seção da Plataforma', 20, 101);
        pdf.text('Tempo Total Registrado', 120, 101);
        pdf.text('Porcentagem de Uso', 160, 101);
        pdf.line(15, 104, W - 15, 104);

        let curY = 109;
        pdf.setFont('helvetica', 'normal');
        SECTIONS.forEach((s) => {
            const time = sectionTimes[s] || 0;
            const pct = totalSec > 0 ? ((time / totalSec) * 100).toFixed(1) + '%' : '0%';
            
            pdf.text(s, 20, curY);
            pdf.text(NebulaAnalytics.formatDuration(time), 120, curY);
            pdf.text(pct, 160, curY);
            curY += 5.5;
        });

        // Logs de sessões (Últimos logs)
        pdf.setTextColor(40, 40, 40);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10);
        pdf.text('HISTÓRICO CRONOLÓGICO DE ACESSO (SESSÕES)', 15, curY + 6);

        pdf.setFillColor(245, 245, 245);
        pdf.rect(15, curY + 10, W - 30, 8, 'F');
        pdf.setFontSize(8);
        pdf.text('Sessão #', 18, curY + 15);
        pdf.text('Horário de Entrada', 45, curY + 15);
        pdf.text('Horário de Saída', 105, curY + 15);
        pdf.text('Duração', 160, curY + 15);
        pdf.line(15, curY + 18, W - 15, curY + 18);

        let sessions = mergeSessionsList(remote.sessions, local.sessions);
        curY = curY + 23;
        pdf.setFont('helvetica', 'normal');

        sessions.slice(0, 15).forEach((s, idx) => {
            if (curY > H - 20) {
                pdf.addPage();
                pdf.setFillColor(20, 24, 28);
                pdf.rect(0, 0, W, 12, 'F');
                pdf.setTextColor(255, 255, 255);
                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(9);
                pdf.text(`RELATÓRIO INDIVIDUAL DE OPERAÇÃO: ${p.name || email}`, 15, 8);
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(8);
                pdf.setTextColor(60, 60, 60);
                curY = 20;
            }

            const num = sessions.length - idx;
            const start = new Date(s.start).toLocaleString('pt-BR');
            let end = '—';
            let duration = 'Em andamento';

            if (s.end) {
                end = new Date(s.end).toLocaleString('pt-BR');
                const durSec = (new Date(s.end) - new Date(s.start)) / 1000;
                duration = NebulaAnalytics.formatDuration(durSec);
            }

            pdf.text(String(num), 20, curY);
            pdf.text(start, 45, curY);
            pdf.text(end, 105, curY);
            pdf.text(duration, 160, curY);
            curY += 5.5;
        });

        // Rodapé de Página
        const pageCount = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            pdf.setPage(i);
            pdf.setDrawColor(230, 230, 230);
            pdf.line(15, H - 12, W - 15, H - 12);
            pdf.setFontSize(7);
            pdf.setTextColor(150, 150, 150);
            pdf.text(`Nebula Research Auditoria · Página ${i} de ${pageCount}`, 15, H - 8);
            pdf.text(`CONFIDENCIAL · AUDITORIA DE ${p.email.toUpperCase()}`, W - 90, H - 8);
        }

        pdf.save(`auditoria-usuario-${email.replace(/[@.]/g, '_')}.pdf`);
    }

    return {
        render,
        triggerDelete,
        exportUserPDF: exportUserReportPDF
    };
})();

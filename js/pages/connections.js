/* PAGE: CONNECTIONS — Symmetric Research Ecosystem & Matches */
const PageConnections = (() => {
    let currentNodes = [];
    let activeMapMode = 'affinity';

    function render(container, state) {
        try {
            if (window.NebulaSupabase && state.current_user) {
                NebulaStorage.refreshCommunityDirectory(state).then(() => {
                    _render(container, NebulaApp.getState());
                }).catch(() => _render(container, state));
            } else {
                _render(container, state);
            }
        } catch (e) {
            console.error('[Connections] Render crash:', e);
            container.innerHTML = `<div style="padding:2rem;text-align:center;color:var(--text-white-60)">
                <div style="font-size:1.2rem;margin-bottom:1rem;color:#fca5a5;">Erro ao carregar Ecossistema</div>
                <div style="font-size:0.85rem;margin-bottom:1rem;">${e.message || 'Erro desconhecido'}</div>
                <button class="btn btn-primary" onclick="NebulaApp.navigate('Tela Principal')">Voltar ao Início</button>
            </div>`;
        }
    }

    function _render(container, state) {
        if (!state.user_interest) state.user_interest = {};
        if (!state.workspaces) state.workspaces = {};
        if (!state.users) state.users = {};

        const userCount = Object.keys(state.users).filter(e => !e.startsWith('demo_')).length;
        const myEmail = state.current_user;
        const myFP = NetworkEngine.buildResearchFingerprint(state, myEmail);
        const allResearchers = NetworkEngine.getAllCommunityUsers(state, myEmail, 100);
        const connections = NetworkEngine.getAffinityConnections(state, myEmail, 50);
        const strongCount = connections.filter(c => c.is_strong).length;

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.75rem;">
                <div>
                    <div class="page-title">Ecossistema de Pesquisa</div>
                    <div style="font-size:0.85rem; color:var(--text-white-60);">
                        ${userCount} pesquisadores cadastrados · ${connections.length} com afinidade real · ${strongCount} fortes
                    </div>
                </div>
                <div style="display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
                    <div class="tabs-bar" style="margin-bottom:0;">
                        <button class="btn active" id="net-tab-affinity" onclick="PageConnections.switchMap('affinity', this)">Afinidade de Pesquisa</button>
                        <button class="btn" id="net-tab-topics" onclick="PageConnections.switchMap('topics', this)">Tópicos &amp; Acervo</button>
                        <button class="btn" id="net-tab-community" onclick="PageConnections.switchMap('community', this)">Rede da Comunidade</button>
                    </div>
                    <button class="btn btn-blue" onclick="PageConnections.exportPDF()" style="gap:0.4rem; padding:0.5rem 1rem;">
                        Exportar PDF
                    </button>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:0.75rem; margin-bottom:1rem;">
                <div class="glass" style="padding:1rem; border-radius:16px; text-align:center;">
                    <div style="font-size:1.8rem; font-weight:800; color:var(--color-blue);">${allResearchers.length}</div>
                    <div style="font-size:0.8rem; color:var(--text-white-60);">Pesquisadores Cadastrados</div>
                </div>
                <div class="glass" style="padding:1rem; border-radius:16px; text-align:center;">
                    <div style="font-size:1.8rem; font-weight:800; color:#a78bfa;">${connections.length}</div>
                    <div style="font-size:0.8rem; color:var(--text-white-60);">Com Afinidade Real</div>
                </div>
                <div class="glass" style="padding:1rem; border-radius:16px; text-align:center;">
                    <div style="font-size:1.8rem; font-weight:800; color:#fbbf24;">${myFP.topics.size}</div>
                    <div style="font-size:0.8rem; color:var(--text-white-60);">Seus Tópicos</div>
                </div>
                <div class="glass" style="padding:1rem; border-radius:16px; text-align:center;">
                    <div style="font-size:1.8rem; font-weight:800; color:#10b981;">${myFP.docCount}</div>
                    <div style="font-size:0.8rem; color:var(--text-white-60);">Docs no Acervo</div>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:1fr 340px; gap:1rem; align-items:start;" id="connections-grid">
                <div class="glass-outer" style="padding:0; overflow:hidden; border-radius:24px; height:600px; position:relative;">
                    <div id="network-container" style="width:100%; height:100%;"></div>

                    <div id="net-legend-wrapper" style="position:absolute; bottom:16px; left:16px; pointer-events:auto; background:rgba(218,200,179,0.92); backdrop-filter:blur(16px); padding:0.7rem 0.9rem; border-radius:14px; border:1px solid rgba(0,0,0,0.08); box-shadow:0 6px 20px rgba(0,0,0,0.06); z-index:40;">
                        <div style="font-size:0.7rem; color:var(--text-white-60); text-transform:uppercase; margin-bottom:0.4rem; letter-spacing:0.06em; font-weight:700;">Legenda</div>
                        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.3rem;">
                            <div style="width:10px;height:10px;border-radius:50%;background:#3b82f6;flex-shrink:0;"></div>
                            <span style="font-size:0.78rem; color:var(--text-white);">Minha Pesquisa</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.3rem;">
                            <div style="width:10px;height:10px;border-radius:50%;background:#a78bfa;flex-shrink:0;"></div>
                            <span style="font-size:0.78rem; color:var(--text-white);">Pesquisadores</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.3rem;">
                            <div style="width:10px;height:10px;border-radius:50%;background:#fbbf24;flex-shrink:0;"></div>
                            <span style="font-size:0.78rem; color:var(--text-white);">Temas Compartilhados</span>
                        </div>
                    </div>

                    <div id="net-action-modal" style="display:none; position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); background:var(--bg-panel); border:1px solid rgba(0,0,0,0.1); padding:1.5rem; border-radius:20px; box-shadow:0 20px 50px rgba(0,0,0,0.15); z-index:100; text-align:center; min-width:300px; max-width:90%;">
                        <div id="net-action-title" style="font-size:1.1rem; font-weight:700; margin-bottom:0.3rem; color:var(--text-white);"></div>
                        <div id="net-action-desc" style="color:var(--text-white-60); font-size:0.85rem; margin-bottom:0.75rem;"></div>
                        <div id="net-action-affinity" style="margin-bottom:0.5rem;"></div>
                        <div id="net-action-topics" style="margin-bottom:1rem; display:flex; flex-wrap:wrap; gap:0.3rem; justify-content:center;"></div>
                        <div style="display:flex; gap:0.5rem; flex-direction:column;">
                            <button class="btn btn-primary btn-full" id="net-action-visit-btn">VISITAR PERFIL</button>
                            <button class="btn btn-full" id="net-action-msg-btn" style="background:rgba(255,255,255,0.4); border:1px solid rgba(0,0,0,0.1);">ENVIAR MENSAGEM</button>
                            <button class="btn btn-full" style="margin-top:0.2rem;" onclick="document.getElementById('net-action-modal').style.display='none'">FECHAR</button>
                        </div>
                    </div>
                </div>

                <div id="affinity-panel" style="display:flex; flex-direction:column; gap:0.75rem; max-height:600px; overflow-y:auto;">
                    <div class="glass" style="padding:1rem; border-radius:16px;">
                        <input type="text" id="conn-search-input" class="input" placeholder="Buscar pesquisador..." style="margin-bottom:0.75rem;font-size:0.85rem;padding:0.5rem 0.75rem;">
                        <div style="font-size:0.85rem; font-weight:700; color:var(--color-blue); margin-bottom:0.75rem;">Pesquisadores com Afinidade</div>
                        <div style="font-size:0.75rem;color:var(--text-white-60);margin-bottom:0.6rem;">Conexões baseadas em temas, artigos e análises em comum.</div>
                        <div id="affinity-list">
                            <div class="small-muted">Calculando afinidades...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const grid = document.getElementById('connections-grid');
        if (window.innerWidth < 900 && grid) {
            grid.style.gridTemplateColumns = '1fr';
        }

        _renderAffinityPanel(connections, allResearchers);
        document.getElementById('conn-search-input')?.addEventListener('input', async e => {
            const q = e.target.value.trim();
            const list = document.getElementById('affinity-list');
            if (list) list.innerHTML = `<div class="small-muted" style="padding:1rem;text-align:center;">Buscando...</div>`;
            const filtered = q
                ? await NebulaStorage.searchResearchersAsync(state, q, myEmail, 50)
                : NetworkEngine.getAffinityConnections(NebulaApp.getState(), myEmail, 50);
            _renderAffinityPanel(filtered.length ? filtered : connections, allResearchers, q);
        });
        setTimeout(() => loadView(activeMapMode, state), 80);
    }

    function _renderAffinityPanel(connections, allResearchers, searchQuery) {
        const list = document.getElementById('affinity-list');
        if (!list) return;

        const toShow = connections.length ? connections : [];

        if (!toShow.length) {
            list.innerHTML = `<div class="small-muted" style="text-align:center; padding:1rem;">
                ${searchQuery ? `Nenhum resultado para "${searchQuery}".` : 'Nenhuma afinidade detectada ainda. Complete seu perfil e envie documentos no Repositório para encontrar pesquisadores com temas em comum.'}
                ${allResearchers && allResearchers.length ? `<div style="margin-top:0.75rem;font-size:0.8rem;">${allResearchers.length} pesquisadores cadastrados na plataforma.</div>` : ''}
            </div>`;
            return;
        }

        list.innerHTML = toShow.slice(0, 20).map(conn => {
            const initial = (conn.name || conn.email || '?').trim().charAt(0).toUpperCase();
            const affinityColor = conn.similarity >= 55 ? '#10b981' : conn.similarity >= 30 ? '#fbbf24' : '#94a3b8';
            const affinityLabel = conn.similarity >= 55 ? 'Afinidade Forte' : conn.similarity >= 30 ? 'Afinidade Média' : (conn.has_real_connection ? 'Afinidade Leve' : 'Cadastrado');
            const viewed = NebulaStorage.hasViewedProfile(NebulaApp.getState(), NebulaApp.getState().current_user, conn.email);
            const topicsHtml = (conn.shared_topics || []).slice(0, 2).map(t =>
                `<span class="tag" style="font-size:0.65rem; padding:2px 6px;">${t}</span>`
            ).join('');

            const topicSet = new Set((conn.shared_topics || []).map(t => t.toLowerCase()));
            const connectionPointsHtml = (conn.connection_points || [])
                .filter(cp => !topicSet.has((cp.label || '').toLowerCase()))
                .slice(0, 2).map(cp =>
                `<span style="font-size:0.72rem; color:var(--text-white-60);">• ${cp.label}</span>`
            ).join('<br>');

            const isOnline = NebulaStorage.isUserOnline([], conn.email, NebulaApp.getState());

            return `
                <div style="background:rgba(255,255,255,0.35); border-radius:12px; padding:0.75rem; margin-bottom:0.6rem; border:1px solid rgba(0,0,0,0.06); cursor:pointer;"
                     onclick="PageProfile.render(document.getElementById('pageContainer'), NebulaApp.getState(), '${conn.email}')">
                    <div style="display:flex; align-items:center; gap:0.6rem; margin-bottom:0.4rem;">
                        <div style="width:36px; height:36px; border-radius:50%; background:var(--color-blue); display:flex; align-items:center; justify-content:center; font-size:0.9rem; font-weight:700; color:#fff; overflow:visible; flex-shrink:0; position:relative;">
                            <div style="width:100%; height:100%; border-radius:50%; overflow:hidden; display:flex; align-items:center; justify-content:center;">
                                ${conn.photo ? `<img src="${conn.photo}" alt="" style="width:100%;height:100%;object-fit:cover;">` : initial}
                            </div>
                            ${isOnline ? '<span class="online-dot" style="width:9px; height:9px; bottom:0; right:0;" title="Online"></span>' : ''}
                        </div>
                        <div style="flex:1; min-width:0;">
                            <div style="font-weight:700; font-size:0.88rem; color:var(--text-white); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${conn.name || conn.email}</div>
                            <div style="font-size:0.72rem; color:var(--text-white-60); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${conn.topic || 'Pesquisa Geral'}</div>
                        </div>
                        <div style="text-align:right; flex-shrink:0;">
                            <div style="font-size:1rem; font-weight:800; color:${affinityColor};">${conn.similarity}%</div>
                            <div style="font-size:0.65rem; color:${affinityColor}; font-weight:600;">${affinityLabel}</div>
                            ${viewed ? `<div style="font-size:0.6rem; color:#10b981; font-weight:600;">Visualizado</div>` : ''}
                        </div>
                    </div>
                    <div style="height:3px; background:rgba(0,0,0,0.08); border-radius:2px; margin-bottom:0.4rem; overflow:hidden;">
                        <div style="height:100%; width:${conn.similarity}%; background:${affinityColor}; border-radius:2px; transition:width 0.6s ease;"></div>
                    </div>
                    ${topicsHtml ? `<div style="margin-bottom:0.35rem; display:flex; flex-wrap:wrap; gap:0.25rem;">${topicsHtml}</div>` : ''}
                    ${connectionPointsHtml ? `<div style="line-height:1.6;margin-bottom:0.4rem;">${connectionPointsHtml}</div>` : ''}
                    <div style="display:flex;gap:0.35rem;">
                        <button class="btn btn-sm" style="flex:1;font-size:0.72rem;padding:0.3rem;" onclick="event.stopPropagation(); PageProfile.render(document.getElementById('pageContainer'), NebulaApp.getState(), '${conn.email}')">Perfil</button>
                        <button class="btn btn-sm btn-primary" style="flex:1;font-size:0.72rem;padding:0.3rem;" onclick="event.stopPropagation(); NebulaApp.getState().chat_target='${conn.email}'; NebulaApp.navigate('Comunidade');">Mensagem</button>
                    </div>
                </div>`;
        }).join('');
    }

    function loadView(mode, state) {
        activeMapMode = mode;
        const c = document.getElementById('network-container');
        if (!c) return;

        if (!state.user_interest) state.user_interest = {};
        if (!state.workspaces) state.workspaces = {};
        if (!state.users) state.users = {};

        c.innerHTML = '<div style="padding:4rem; text-align:center; color:var(--text-white-60)">Calculando rede 3D do ecossistema...</div>';

        if (mode === 'topics') {
            loadTopicsView(c, state);
        } else if (mode === 'community') {
            loadCommunityView(c, state);
        } else {
            loadAffinityView(c, state);
        }
    }

    async function loadAffinityView(c, state) {
        try {
            const userEmail = state.current_user;
            const data = NetworkEngine.buildConnectionChainNetwork(state, userEmail, 20, 15);
            c.innerHTML = '';

            if (!data || !data.nodes || !data.nodes.length) {
                c.innerHTML = `<div style="padding:4rem; text-align:center; color:var(--text-white-60)">
                    <div style="font-size:1.1rem; margin-bottom:0.5rem; color:var(--text-white);">Nenhum pesquisador na rede</div>
                </div>`;
                return;
            }

            currentNodes = data.nodes;
            NetworkEngine.render3DNetwork('network-container', data.nodes, data.edges);
            bindClickEvents();
        } catch (err) {
            console.error('[Connections] Affinity view crash:', err);
            c.innerHTML = `<div style="padding:2rem; text-align:center; color:#fca5a5;">Erro ao renderizar grafo: ${err.message}</div>`;
        }
    }

    async function loadTopicsView(c, state) {
        try {
            const ws = state.workspaces[state.current_user] || {};
            const user = state.users[state.current_user] || {};
            const myDocs = (state.repository && state.repository.length) ? state.repository : (ws.repository || []);
            let query = user.research || '';
            if (myDocs.length) {
                const topKeywords = [];
                myDocs.slice(0, 5).forEach(d => topKeywords.push(...(d.keywords || []).slice(0, 3)));
                if (topKeywords.length) query = [...new Set(topKeywords)].slice(0, 6).join(' ');
            }

            c.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--text-white-60)">Mapeando artigos e tópicos...</div>';
            let externalArticles = [];
            try {
                externalArticles = await SearchEngine.searchSemanticScholar(query, 6) || [];
            } catch (e) {}

            c.innerHTML = '';
            const data = NetworkEngine.buildResearchNetwork(myDocs, externalArticles, user.research);
            if (!data || !data.nodes || !data.nodes.length) {
                c.innerHTML = '<div style="padding:4rem; text-align:center; color:var(--text-white-60)">Sem dados de acervo. Envie documentos no Repositório.</div>';
                return;
            }
            currentNodes = data.nodes;
            NetworkEngine.render3DNetwork('network-container', data.nodes, data.edges);
            bindClickEvents();
        } catch (err) {
            console.error('[Connections] Topics view error:', err);
        }
    }

    async function loadCommunityView(c, state) {
        try {
            c.innerHTML = '';
            const data = NetworkEngine.buildConnectionChainNetwork(state, state.current_user, 50, 0);
            if (!data || !data.nodes || !data.nodes.length) {
                c.innerHTML = `<div style="padding:4rem; text-align:center; color:var(--text-white-60)">Nenhum integrante na comunidade.</div>`;
                return;
            }
            currentNodes = data.nodes;
            NetworkEngine.render3DNetwork('network-container', data.nodes, data.edges);
            bindClickEvents();
        } catch (err) {
            console.error('[Connections] Community view error:', err);
        }
    }

    function bindClickEvents() {
        setTimeout(() => {
            const plot = document.getElementById('network-container');
            if (plot && plot.on) {
                plot.on('plotly_click', function(clickData) {
                    if (!clickData.points || !clickData.points.length) return;
                    const pt = clickData.points[0];
                    const node = currentNodes.find(n => n.label === pt.text || (pt.hovertext && pt.hovertext.includes(n.label)));
                    if (node && node.type === 'researcher') {
                        const emailTo = node.id.replace('researcher::', '');
                        const sim = node.similarity;
                        const affinityColor = sim >= 50 ? '#10b981' : sim >= 35 ? '#fbbf24' : '#a78bfa';

                        document.getElementById('net-action-title').innerText = node.label;
                        document.getElementById('net-action-desc').innerText = `Área: ${node.topic || '—'}`;
                        document.getElementById('net-action-affinity').innerHTML = sim != null ? `
                            <div style="display:flex; align-items:center; gap:0.5rem; justify-content:center; margin-bottom:0.5rem;">
                                <div style="height:4px; width:120px; background:rgba(0,0,0,0.1); border-radius:2px; overflow:hidden;">
                                    <div style="height:100%; width:${sim}%; background:${affinityColor}; border-radius:2px;"></div>
                                </div>
                                <span style="font-weight:700; color:${affinityColor};">${sim}% afinidade</span>
                            </div>` : '';

                        const visitBtn = document.getElementById('net-action-visit-btn');
                        const msgBtn = document.getElementById('net-action-msg-btn');

                        visitBtn.onclick = () => {
                            document.getElementById('net-action-modal').style.display = 'none';
                            PageProfile.render(document.getElementById('pageContainer'), NebulaApp.getState(), emailTo);
                        };

                        msgBtn.onclick = () => {
                            document.getElementById('net-action-modal').style.display = 'none';
                            const st = NebulaApp.getState();
                            st.chat_target = emailTo;
                            st.chat_draft = `Olá ${node.label.split(' ')[0]}! Vi seu perfil no Ecossistema de Pesquisa${sim >= 15 ? ` — temos ${sim}% de afinidade` : ''}. Gostaria de conversar?`;
                            st.page = 'Comunidade';
                            NebulaApp.renderApp();
                        };

                        document.getElementById('net-action-modal').style.display = 'block';
                    }
                });
            }
        }, 500);
    }

    function switchMap(mode, btnElement) {
        document.querySelectorAll('#net-tab-affinity, #net-tab-topics, #net-tab-community').forEach(b => b.classList.remove('active'));
        if (btnElement) btnElement.classList.add('active');
        loadView(mode, NebulaApp.getState());
    }

    function connectAI(emailTo, firstName, explanation) {
        const state = NebulaApp.getState();
        state.chat_target = emailTo;
        state.chat_draft = `Olá ${firstName}! Identifiquei um match de pesquisa no Nebula: "${explanation}". Gostaria de conversar?`;
        state.page = 'Comunidade';
        NebulaApp.renderApp();
    }

    async function exportPDF() {
        const netEl = document.getElementById('network-container');
        if (!netEl) return;
        try {
            if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
                alert('Exportação para PDF indisponível no momento.');
                return;
            }
            const canvas = await html2canvas(netEl, { backgroundColor: '#DAC8B3', scale: 2 });
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = jspdf;
            const pdf = new jsPDF('landscape', 'mm', 'a4');
            pdf.setFontSize(16);
            pdf.text('Nebula Research — Ecossistema de Conexões Acadêmicas', 14, 15);
            pdf.setFontSize(10);
            pdf.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} | Pesquisador: ${NebulaApp.getState().current_user}`, 14, 22);
            pdf.addImage(imgData, 'PNG', 14, 28, 268, 145);
            pdf.save('Nebula_Ecossistema_Pesquisa.pdf');
        } catch (e) {
            console.error('[Connections] Export PDF error:', e);
            alert('Não foi possível gerar o PDF.');
        }
    }

    return { render, switchMap, connectAI, exportPDF };
})();

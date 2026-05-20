/* PAGE: CONNECTIONS */
const PageConnections = (() => {
    function render(container, state) {
        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 1rem;">
                <div>
                    <div class="page-title">Ecossistema de Pesquisa</div>
                    <div class="page-sub">Conexões entre você, seus documentos e a comunidade acadêmica.</div>
                </div>
                <div class="tabs-bar" style="margin-bottom:0;">
                    <button class="tab-btn active" id="net-tab-global" onclick="PageConnections.switchTab('global', this)">Visão Global</button>
                    <button class="tab-btn" id="net-tab-social" onclick="PageConnections.switchTab('social', this)">Visão Social (Comunidade)</button>
                </div>
            </div>

            <div class="glass-outer" style="padding:0; overflow:hidden; border-radius:32px; height:650px; position:relative;">
                <div id="network-container" style="width:100%; height:100%;"></div>
                
                <!-- Overlay Informativo -->
                <div style="position:absolute; top:20px; left:20px; pointer-events:none; background:rgba(0,0,0,0.4); backdrop-filter:blur(10px); padding:1rem; border-radius:16px; border:1px solid rgba(255,255,255,0.05);">
                    <div id="net-legend-title" style="font-size:0.8rem; color:var(--text-white-60); text-transform:uppercase; margin-bottom:0.5rem; letter-spacing:0.05em;">Legenda do Ecossistema</div>
                    <div id="net-legend-content">
                        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.3rem;"><div style="width:12px;height:12px;border-radius:50%;background:#ffffff;"></div> <span style="font-size:0.85rem">Você / Usuários</span></div>
                        <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.3rem;"><div style="width:12px;height:12px;border-radius:50%;background:#ffbb99;"></div> <span style="font-size:0.85rem">Clusters de Pesquisa</span></div>
                        <div style="display:flex; align-items:center; gap:0.5rem;"><div style="width:12px;height:12px;border-radius:50%;background:#d9774a;"></div> <span style="font-size:0.85rem">Artigos / Temas</span></div>
                    </div>
                </div>

                <!-- Modal de Ação Rápida -->
                <div id="net-action-modal" style="display:none; position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:var(--bg-panel); border:1px solid rgba(255,255,255,0.1); padding:2rem; border-radius:24px; box-shadow:0 20px 50px rgba(0,0,0,0.5); z-index:100; text-align:center; min-width:320px;">
                    <div id="net-action-title" style="font-size:1.2rem; font-weight:500; margin-bottom:0.5rem;"></div>
                    <div id="net-action-desc" style="color:var(--text-white-60); font-size:0.9rem; margin-bottom:1rem;"></div>
                    <div id="net-action-topics" style="margin-bottom:1.5rem;"></div>
                    <button class="btn btn-primary btn-full" id="net-action-btn">MANDAR MENSAGEM</button>
                    <button class="btn btn-full" style="margin-top:0.5rem;" onclick="document.getElementById('net-action-modal').style.display='none'">FECHAR</button>
                </div>
            </div>
        `;

        setTimeout(() => loadView('global', state), 50);
    }

    let currentNodes = [];

    function loadView(view, state) {
        const c = document.getElementById('network-container');
        c.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--text-white-60)">Mapeando ecossistema em 3D...</div>';
        
        // Update legend based on view
        const legendContent = document.getElementById('net-legend-content');
        if (view === 'global') {
            if (legendContent) legendContent.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.3rem;"><div style="width:12px;height:12px;border-radius:50%;background:#ffffff;"></div> <span style="font-size:0.85rem">Sua Pesquisa</span></div>
                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.3rem;"><div style="width:12px;height:12px;border-radius:50%;background:#d9774a;"></div> <span style="font-size:0.85rem">Seus Documentos</span></div>
                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.3rem;"><div style="width:12px;height:12px;border-radius:50%;background:#a65132;"></div> <span style="font-size:0.85rem">Artigos Externos Similares</span></div>
                <div style="display:flex; align-items:center; gap:0.5rem;"><div style="width:12px;height:12px;border-radius:50%;background:#ffbb99;"></div> <span style="font-size:0.85rem">Clusters Temáticos</span></div>
            `;
        } else {
            if (legendContent) legendContent.innerHTML = `
                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.3rem;"><div style="width:12px;height:12px;border-radius:50%;background:#ffffff;"></div> <span style="font-size:0.85rem">Você / Pesquisadores</span></div>
                <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.3rem;"><div style="width:12px;height:12px;border-radius:50%;background:#d9774a;"></div> <span style="font-size:0.85rem">Temas Compartilhados</span></div>
                <div style="display:flex; align-items:center; gap:0.5rem;"><div style="width:12px;height:12px;border-radius:50%;background:#ffbb99;"></div> <span style="font-size:0.85rem">Artigos em Comum</span></div>
            `;
        }

        if (view === 'global') {
            loadGlobalView(c, state);
        } else {
            loadSocialView(c, state);
        }
    }

    async function loadGlobalView(c, state) {
        const ws = state.workspaces[state.current_user] || {};
        const user = state.users[state.current_user] || {};
        const myDocs = ws.repository || [];
        
        // Build query from user's docs and research
        let query = user.research || '';
        if (myDocs.length) {
            const topKeywords = [];
            myDocs.slice(0, 5).forEach(d => topKeywords.push(...(d.keywords || []).slice(0, 3)));
            if (topKeywords.length) query = [...new Set(topKeywords)].slice(0, 6).join(' ');
        }
        
        if (!query && !myDocs.length) {
            c.innerHTML = `
                <div style="padding:4rem; text-align:center; color:var(--text-white-60)">
                    <div style="font-size:1.2rem; margin-bottom:1rem;">Sem dados para a Visão Global.</div>
                    <div style="margin-bottom:1.5rem;">Envie documentos no Repositório ou configure sua pesquisa no Perfil para ver as conexões com artigos externos.</div>
                    <button class="btn btn-primary" onclick="NebulaApp.navigate('Repositório')" style="margin-right:0.5rem;">Enviar Documentos</button>
                    <button class="btn" onclick="NebulaApp.navigate('Perfil')">Configurar Perfil</button>
                </div>`;
            return;
        }

        // Fetch external articles similar to user's docs
        let externalArticles = [];
        try {
            c.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--text-white-60)">Buscando artigos externos similares...</div>';
            const results = await SearchEngine.searchSemanticScholar(query, 8);
            externalArticles = results || [];
        } catch (e) {
            console.warn('[Connections] Failed to fetch external articles:', e);
        }

        c.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--text-white-60)">Renderizando rede 3D...</div>';

        const data = NetworkEngine.buildResearchNetwork(myDocs, externalArticles, user.research);

        if (!data || !data.nodes.length) {
            c.innerHTML = '<div style="padding:4rem; text-align:center; color:var(--text-white-60)">Não foi possível construir a rede. Tente enviar mais documentos.</div>';
            return;
        }

        currentNodes = data.nodes;
        NetworkEngine.render3DNetwork('network-container', data.nodes, data.edges);
    }

    async function loadSocialView(c, state) {
        // Rebuild interests from research text + docs before comparing
        if (state.current_user) {
            NebulaStorage.rebuildInterests(state, state.current_user);
        }

        // --- INÍCIO DA INTEGRAÇÃO COM LLAMA 3.3 ---
        // Clean existing overlay if any
        const oldOverlay = document.getElementById('ai-connections-overlay');
        if (oldOverlay) oldOverlay.remove();

        const userEmail = state.current_user;
        const userObj = state.users[userEmail];
        
        if (userObj) {
            const userProfile = {
                name: userObj.name,
                email: userEmail,
                research: userObj.research,
                topKeywords: Object.keys(state.user_interest[userEmail] || {}).slice(0, 5)
            };

            const communityProfiles = Object.keys(state.users)
                .filter(e => e !== userEmail)
                .map(e => ({
                    name: state.users[e].name,
                    email: e,
                    research: state.users[e].research,
                    topKeywords: Object.keys(state.user_interest[e] || {}).slice(0, 5)
                }));

            // Render loading state for AI
            const aiOverlay = document.createElement('div');
            aiOverlay.id = 'ai-connections-overlay';
            aiOverlay.style = 'position:absolute; top:20px; right:20px; width: 340px; background:rgba(217, 119, 74, 0.1); border: 1px solid var(--copper-1); border-radius: 16px; padding: 1rem; backdrop-filter: blur(10px); z-index: 50; overflow-y: auto; max-height: calc(100% - 40px); box-shadow: 0 10px 30px rgba(0,0,0,0.5);';
            aiOverlay.innerHTML = `
                <div style="color:var(--copper-1); font-weight:600; margin-bottom: 0.5rem; font-size:1.05rem;">✦ Conexões Profundas (IA)</div>
                <div class="small-muted">O Llama 3.3 está lendo o ecossistema para sugerir parcerias inesperadas...</div>
            `;
            c.parentElement.appendChild(aiOverlay);

            NebulaAI.findConnections(userProfile, communityProfiles).then(aiData => {
                const overlay = document.getElementById('ai-connections-overlay');
                if (!overlay) return;
                
                if (!aiData || !aiData.matches || aiData.matches.length === 0) {
                    overlay.innerHTML = `
                        <div style="color:var(--copper-1); font-weight:600; margin-bottom: 0.5rem;">✦ Conexões Profundas (IA)</div>
                        <div class="small-muted">Nenhum match profundo encontrado no momento. Aumente seu acervo!</div>
                    `;
                    return;
                }

                let matchesHtml = aiData.matches.map(m => {
                    const p = state.users[m.email] || {};
                    const safeExpl = (m.explanation || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                    const firstName = (p.name || m.email).split(' ')[0];
                    return `
                        <div style="background:rgba(0,0,0,0.4); padding:0.8rem; border-radius:12px; margin-bottom:0.8rem; border:1px solid rgba(255,255,255,0.05);">
                            <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem;">
                                <b style="color:var(--text-white); font-size:0.95rem;">${p.name || m.email}</b>
                                <span class="tag tag-copper">${m.score}% Affinity</span>
                            </div>
                            <div style="font-size:0.85rem; color:var(--text-white-80); line-height:1.4; margin-bottom: 0.5rem;">
                                ${m.explanation}
                            </div>
                            <button class="btn btn-sm btn-primary" style="width:100%; font-size:0.75rem; padding:0.3rem;" onclick="PageConnections.connectAI('${m.email}', '${firstName}', '${safeExpl}')">CONECTAR AGORA</button>
                        </div>
                    `;
                }).join('');

                overlay.innerHTML = `
                    <div style="color:var(--copper-1); font-weight:600; margin-bottom: 0.5rem; font-size:1.05rem;">✦ Conexões Profundas (IA)</div>
                    <p class="small-muted mb-1" style="font-size:0.8rem;">O Llama 3.3 descobriu estas afinidades analisando a sua pesquisa.</p>
                    ${matchesHtml}
                `;
            });
        }
        // --- FIM DA INTEGRAÇÃO ---

        const data = NetworkEngine.buildConnectionChainNetwork(state, state.current_user, 10);

        if (!data || !data.nodes.length) {
            c.innerHTML = `
                <div style="padding:4rem; text-align:center; color:var(--text-white-60)">
                    <div style="font-size:1.2rem; margin-bottom:1rem;">Nenhum pesquisador conectado encontrado.</div>
                    <div style="margin-bottom:1.5rem;">Para encontrar conexões, adicione documentos ao Repositório e configure sua linha de pesquisa no Perfil. O sistema busca pesquisadores com temas e artigos similares aos seus.</div>
                    <button class="btn btn-primary" onclick="NebulaApp.navigate('Perfil')">Configurar Perfil</button>
                </div>`;
            return;
        }

        currentNodes = data.nodes;
        NetworkEngine.render3DNetwork('network-container', data.nodes, data.edges);

        setTimeout(() => {
            const plot = document.getElementById('network-container');
            if (plot && plot.on) {
                plot.on('plotly_click', function(clickData) {
                    if (clickData.points && clickData.points.length > 0) {
                        const pt = clickData.points[0];
                        const node = currentNodes.find(n => n.label === pt.text || (pt.hovertext && pt.hovertext.includes(n.label)));
                        
                        if (node && node.type === 'researcher') {
                            const emailTo = node.id.replace('researcher::', '');
                            document.getElementById('net-action-title').innerText = `Conexão: ${node.label}`;
                            document.getElementById('net-action-desc').innerText = `Vocês dois têm fortes ligações no tema: ${node.topic}`;
                            document.getElementById('net-action-topics').innerHTML = `<span class="tag tag-copper">${node.topic}</span>`;
                            
                            const btn = document.getElementById('net-action-btn');
                            btn.onclick = () => {
                                document.getElementById('net-action-modal').style.display='none';
                                state.chat_target = emailTo;
                                state.chat_draft = `Olá ${node.label.split(' ')[0]}! Vi que nós dois pesquisamos sobre ${node.topic}. Gostaria de trocar referências?`;
                                state.page = 'Comunidade';
                                NebulaApp.renderApp();
                            };
                            
                            document.getElementById('net-action-modal').style.display = 'block';
                        }
                    }
                });
            }
        }, 500);
    }

    function switchTab(view, btnElement) {
        const oldOverlay = document.getElementById('ai-connections-overlay');
        if (oldOverlay) oldOverlay.remove();
        document.querySelectorAll('#net-tab-global, #net-tab-social').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        loadView(view, NebulaApp.getState());
    }

    function connectAI(emailTo, firstName, explanation) {
        const state = NebulaApp.getState();
        state.chat_target = emailTo;
        state.chat_draft = `Olá ${firstName}! A Inteligência Artificial me recomendou seu perfil porque: "${explanation}". Gostaria de trocar uma ideia sobre nossas pesquisas?`;
        state.page = 'Comunidade';
        NebulaApp.renderApp();
    }

    return { render, switchTab, connectAI };
})();

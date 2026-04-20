/* PAGE: CONNECTIONS */
const PageConnections = (() => {
    function render(container, state) {
        // Prepara a tela inteira para o visualizador 3D Liquid Glass
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
                    <div style="font-size:0.8rem; color:var(--text-white-60); text-transform:uppercase; margin-bottom:0.5rem; letter-spacing:0.05em;">Legenda do Ecossistema</div>
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.3rem;"><div style="width:12px;height:12px;border-radius:50%;background:#ffffff;"></div> <span style="font-size:0.85rem">Você / Usuários</span></div>
                    <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.3rem;"><div style="width:12px;height:12px;border-radius:50%;background:#ffbb99;"></div> <span style="font-size:0.85rem">Clusters de Pesquisa</span></div>
                    <div style="display:flex; align-items:center; gap:0.5rem;"><div style="width:12px;height:12px;border-radius:50%;background:#d9774a;"></div> <span style="font-size:0.85rem">Artigos / Temas</span></div>
                </div>

                <!-- Modal de Ação Rápida (Escondido) -->
                <div id="net-action-modal" style="display:none; position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); background:var(--bg-panel); border:1px solid rgba(255,255,255,0.1); padding:2rem; border-radius:24px; box-shadow:0 20px 50px rgba(0,0,0,0.5); z-index:100; text-align:center;">
                    <div id="net-action-title" style="font-size:1.2rem; font-weight:500; margin-bottom:0.5rem;"></div>
                    <div id="net-action-desc" style="color:var(--text-white-60); font-size:0.9rem; margin-bottom:1.5rem;"></div>
                    <button class="btn btn-primary btn-full" id="net-action-btn">MANDAR MENSAGEM</button>
                    <button class="btn btn-full" style="margin-top:0.5rem;" onclick="document.getElementById('net-action-modal').style.display='none'">FECHAR</button>
                </div>
            </div>
        `;

        // Renderização inicial
        setTimeout(() => loadView('global', state), 50);
    }

    let currentNodes = []; // Armazena os nós renderizados para recuperar os dados no clique

    function loadView(view, state) {
        const c = document.getElementById('network-container');
        c.innerHTML = '<div style="padding:2rem; text-align:center; color:var(--text-white-60)">Mapeando ecossistema em 3D...</div>';
        
        setTimeout(() => {
            let data;
            const ws = state.workspaces[state.current_user] || {};
            const user = state.users[state.current_user] || {};
            
            if (view === 'global') {
                const ext = state.search_history.slice(0, 15); // Top buscas recentes
                data = NetworkEngine.buildResearchNetwork(ws.repository || [], ext, user.research);
            } else {
                data = NetworkEngine.buildConnectionChainNetwork(state, state.current_user, 10);
            }
            
            if (!data || !data.nodes.length) {
                c.innerHTML = '<div style="padding:4rem; text-align:center; color:var(--text-white-60)">Sem dados suficientes para mapear a rede. Explore ou envie mais documentos.</div>';
                return;
            }

            currentNodes = data.nodes;
            NetworkEngine.render3DNetwork('network-container', data.nodes, data.edges);

            // Adiciona o listener de clique no gráfico para abrir o modal de mensagem
            setTimeout(() => {
                const plot = document.getElementById('network-container');
                plot.on('plotly_click', function(clickData) {
                    if (clickData.points && clickData.points.length > 0) {
                        const pt = clickData.points[0];
                        // Procura o node pelo label ou text correspondente
                        const node = currentNodes.find(n => n.label === pt.text || (pt.hovertext && pt.hovertext.includes(n.label)));
                        
                        if (node && node.type === 'researcher') {
                            // É um usuário da comunidade! Abre modal para enviar mensagem
                            const emailTo = node.id.replace('researcher::', '');
                            document.getElementById('net-action-title').innerText = `Conexão: ${node.label}`;
                            document.getElementById('net-action-desc').innerText = `Vocês dois têm fortes ligações no tema: ${node.topic}`;
                            
                            const btn = document.getElementById('net-action-btn');
                            btn.onclick = () => {
                                // Redireciona para o chat
                                document.getElementById('net-action-modal').style.display='none';
                                state.page = 'Comunidade';
                                NebulaApp.renderApp();
                                // Preenche automaticamente o texto do chat como iniciador de conversa
                                setTimeout(() => {
                                    const chatInput = document.getElementById('chat-input');
                                    if (chatInput) {
                                        chatInput.value = `Olá ${node.label.split(' ')[0]}! Vi na Rede 3D que nós dois pesquisamos sobre ${node.topic}. Gostaria de trocar referências?`;
                                        chatInput.focus();
                                    }
                                }, 100);
                            };
                            
                            document.getElementById('net-action-modal').style.display = 'block';
                        }
                    }
                });
            }, 500);

        }, 100);
    }

    function switchTab(view, btnElement) {
        document.querySelectorAll('#net-tab-global, #net-tab-social').forEach(b => b.classList.remove('active'));
        btnElement.classList.add('active');
        loadView(view, NebulaApp.getState());
    }

    return { render, switchTab };
})();

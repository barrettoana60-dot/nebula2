/* PAGE: CONNECTIONS */
const PageConnections = (() => {
    function render(container, state) {
        const user = state.users[state.current_user] || {};
        const docs = state.repository || [];
        const research = user.research || '';
        const connections = getConnectedUsers(state, state.current_user, 10);

        let html = `
            <div class="page-title">Conexões entre Pesquisas</div>
            <div class="page-sub">Rede 3D que une sua pesquisa, seus documentos, pesquisadores compatíveis e temas compartilhados</div>
            <div class="glass">
                <div class="grid-3 mb-1">
                    <div class="input-group"><label class="input-label">Limite mín. similaridade</label>
                        <input type="range" id="conn-min-sim" min="1" max="30" value="6" style="width:100%"><span id="conn-sim-val" class="small-muted">0.06</span></div>
                    <div class="input-group"><label class="input-label"><input type="checkbox" id="conn-include-ext" checked> Incluir artigos externos</label></div>
                    <div class="input-group"><label class="input-label">Nº artigos externos</label>
                        <input type="range" id="conn-n-ext" min="3" max="15" value="8" style="width:100%"><span id="conn-n-val" class="small-muted">8</span></div>
                </div>
                <button class="btn btn-primary btn-full" id="conn-build-btn">Construir rede</button>
            </div>
            <div class="metric-grid mb-1">
                <div class="metric-card blue"><div class="metric-label">Seus documentos</div><div class="metric-value">${docs.length}</div></div>
                <div class="metric-card green"><div class="metric-label">Pesquisadores compatíveis</div><div class="metric-value">${connections.length}</div></div>
                <div class="metric-card cyan"><div class="metric-label">Temas em comum</div><div class="metric-value">${new Set(connections.flatMap(c=>c.shared_topics||[])).size}</div></div>
                <div class="metric-card purple"><div class="metric-label">Docs em comum</div><div class="metric-value">${connections.reduce((s,c)=>(c.shared_docs||[]).length+s,0)}</div></div>
            </div>
            <div class="glass-sm mb-1" style="display:flex;gap:1.2rem;flex-wrap:wrap;align-items:center">
                <span class="small-muted">Legenda:</span>
                <span style="font-size:0.82rem"><span style="color:#facc15">●</span> Sua pesquisa</span>
                <span style="font-size:0.82rem"><span style="color:#60a5fa">●</span> Seus documentos</span>
                <span style="font-size:0.82rem"><span style="color:#4ade80">●</span> Artigos externos</span>
                <span style="font-size:0.82rem"><span style="color:#22d3ee">●</span> Pesquisadores</span>
                <span style="font-size:0.82rem"><span style="color:#a78bfa">●</span> Temas compartilhados</span>
                <span style="font-size:0.82rem"><span style="color:#f472b6">●</span> Docs em comum</span>
            </div>
            <div class="glass" id="conn-network-wrap"><div id="conn-network-3d"></div></div>
            <div class="glass" id="conn-chain-wrap" style="display:none"><div class="section-title">Cadeia 3D de pesquisadores</div><div id="conn-chain-3d"></div></div>
            <div class="glass" id="conn-edges-wrap" style="display:none"><div class="section-title">Conexões mais fortes</div><div id="conn-edges-table"></div></div>
            <div class="glass" id="conn-users-wrap" style="display:none"><div class="section-title">Usuários conectados</div><div id="conn-users-list"></div></div>
        `;
        container.innerHTML = html;

        const simSlider = document.getElementById('conn-min-sim');
        const simVal = document.getElementById('conn-sim-val');
        simSlider.oninput = () => { simVal.textContent = (simSlider.value / 100).toFixed(2); };
        const nSlider = document.getElementById('conn-n-ext');
        const nVal = document.getElementById('conn-n-val');
        nSlider.oninput = () => { nVal.textContent = nSlider.value; };

        document.getElementById('conn-build-btn').addEventListener('click', () => buildNetwork(state, user, docs, research, connections));

        // Auto-build if enough data
        if (docs.length >= 1 || connections.length) buildNetwork(state, user, docs, research, connections);
    }

    async function buildNetwork(state, user, docs, research, connections) {
        const minSim = (document.getElementById('conn-min-sim')?.value || 6) / 100;
        const includeExt = document.getElementById('conn-include-ext')?.checked;
        const nExt = parseInt(document.getElementById('conn-n-ext')?.value || 8);

        let extArticles = [];
        if (includeExt && research) {
            const terms = TextEngine.extractKeywordsTFIDF(research, 6);
            const q = terms.slice(0, 5).join(' ') || research;
            try { extArticles = await SearchEngine.searchSemanticScholar(q, nExt); } catch {}
            if (extArticles.length < 4) { try { extArticles = extArticles.concat(await SearchEngine.searchCrossref(q, 4)); } catch {} }
        }

        const { nodes, edges } = NetworkEngine.buildResearchNetwork(docs, extArticles, research);
        const filtered = edges.filter(e => e.weight >= minSim);

        if (nodes.length >= 2) NetworkEngine.render3DNetwork('conn-network-3d', nodes, filtered);

        // Chain
        const chain = NetworkEngine.buildConnectionChainNetwork(state, state.current_user, 10);
        if (chain.nodes.length && chain.edges.length) {
            document.getElementById('conn-chain-wrap').style.display = 'block';
            NetworkEngine.render3DNetwork('conn-chain-3d', chain.nodes, chain.edges);
        }

        // Edges table
        if (filtered.length) {
            const wrap = document.getElementById('conn-edges-wrap');
            wrap.style.display = 'block';
            const sorted = filtered.sort((a,b) => b.weight - a.weight).slice(0, 20);
            let tableHtml = `<table class="data-table"><tr><th>Documento A</th><th>Documento B</th><th>Similaridade</th><th>Mesmo tema</th></tr>`;
            sorted.forEach(e => {
                if (e.source < nodes.length && e.target < nodes.length) {
                    tableHtml += `<tr><td>${nodes[e.source].label}</td><td>${nodes[e.target].label}</td><td>${(e.weight*100).toFixed(1)}%</td><td>${e.same_topic ? 'Sim' : 'Não'}</td></tr>`;
                }
            });
            tableHtml += `</table>`;
            document.getElementById('conn-edges-table').innerHTML = tableHtml;
        }

        // Connected users
        if (connections.length) {
            document.getElementById('conn-users-wrap').style.display = 'block';
            document.getElementById('conn-users-list').innerHTML = connections.slice(0, 8).map(conn => {
                const topics = (conn.shared_topics || []).slice(0, 3).join(', ') || 'Sem tema dominante';
                const docsHtml = (conn.shared_docs || []).slice(0, 2).map(p => `<div class="small-muted" style="margin-top:0.35rem">${(p.a||'').slice(0,42)} ↔ ${(p.b||'').slice(0,42)} · ${(p.similarity*100).toFixed(1)}%</div>`).join('');
                return `<div class="doc-card"><b>${conn.name}</b><br><span class="small-muted">${conn.topic} · ${conn.similarity}%</span><div style="margin-top:0.45rem;color:#cbd5e1;font-size:0.82rem">${(conn.research||'').slice(0,170)}</div><div style="margin-top:0.45rem"><span class="tag">${topics}</span></div>${docsHtml}</div>`;
            }).join('');
        }
    }
    return {render};
})();

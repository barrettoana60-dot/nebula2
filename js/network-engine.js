/* ============================================================
   NETWORK ENGINE — 3D Plotly network builder
   ============================================================ */
const NetworkEngine = (() => {
    function buildResearchNetwork(docs, externalArticles, userResearch) {
        const nodes = [];
        const edges = [];
        
        if (userResearch) {
            nodes.push({
                id: 'user_node', label: 'Minha Pesquisa', type: 'user',
                topic: TextEngine.detectTopic(userResearch), text: userResearch,
                year: new Date().getFullYear(), author: '',
            });
        }
        
        // Documentos do repositório
        docs.forEach(doc => {
            const docText = [doc.summary || '', (doc.keywords || []).join(' '), (doc.text || '').slice(0, 2000)].join(' ');
            nodes.push({ id: doc.id, label: (doc.name || '').slice(0, 40), type: 'local', topic: doc.topic || '', text: docText, year: doc.year || '', author: doc.author || '' });
        });
        
        // Artigos externos
        (externalArticles || []).forEach((art, i) => {
            nodes.push({ id: `ext_${i}`, label: (art.title || '').slice(0, 40), type: 'external', topic: art.topic || '', text: `${art.title || ''} ${art.abstract || ''}`, year: art.year || '', author: art.authors || '', url: art.url || '' });
        });

        // "Pesquisas Semelhantes" / Clusters Temáticos Virtuais
        const globalTopics = {};
        docs.concat(externalArticles || []).forEach(item => {
            if (item.topic) globalTopics[item.topic] = (globalTopics[item.topic] || 0) + 1;
        });
        
        let topicNodeIndexStart = nodes.length;
        Object.entries(globalTopics).forEach(([topic, count], i) => {
            if (count >= 2) { // Só cria cluster de pesquisa semelhante se houver densidade
                nodes.push({ id: `global_research_${i}`, label: `Pesquisa em ${topic}`, type: 'global_research', topic: topic, text: topic, year: '', author: 'Cluster Global' });
            }
        });

        // Conecta tudo
        const threshold = 0.08;
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                let sim = 0;
                
                // Conexões fortes forçadas para os clusters de "Pesquisas Globais Semelhantes"
                if (nodes[i].type === 'global_research' || nodes[j].type === 'global_research') {
                    if (nodes[i].topic === nodes[j].topic) sim = 0.5; // Alta atração gravitacional
                } else {
                    sim = TextEngine.cosineSimilarity(nodes[i].text, nodes[j].text);
                    if (nodes[i].topic === nodes[j].topic && nodes[i].topic) sim += 0.08;
                }

                if (sim > threshold) {
                    edges.push({ source: i, target: j, weight: Math.round(sim * 1000) / 1000, same_topic: nodes[i].topic === nodes[j].topic });
                }
            }
        }
        return { nodes, edges };
    }

    // Ocultado para simplificar, a buildConnectionChainNetwork e as outras funções permanecem iguais
    function buildConnectionChainNetwork(state, email, limitUsers) {
        const user = state.users[email] || {};
        const connections = getConnectedUsers(state, email, limitUsers);
        if (!connections.length) return { nodes: [], edges: [] };
        const nodes = [{ id: `user::${email}`, label: (user.name || email).slice(0, 28), type: 'user', topic: TextEngine.detectTopic(user.research || ''), text: user.research || '', year: new Date().getFullYear(), author: user.name || email }];
        const topicIndex = {};
        const docIndex = {};
        const edges = [];
        connections.forEach(conn => {
            const ci = nodes.length;
            nodes.push({ id: `researcher::${conn.email}`, label: (conn.name || conn.email).slice(0, 28), type: 'researcher', topic: conn.topic || 'Pesquisa Geral', text: conn.research || '', year: new Date().getFullYear(), author: conn.name || conn.email });
            edges.push({ source: 0, target: ci, weight: Math.max(conn.similarity / 100, 0.10), same_topic: !!conn.shared_topics?.length });
            (conn.shared_topics || []).slice(0, 3).forEach(topic => {
                if (!(topic in topicIndex)) {
                    topicIndex[topic] = nodes.length;
                    nodes.push({ id: `topic::${TextEngine.normalize(topic)}`, label: topic.slice(0, 30), type: 'topic', topic, text: topic, year: new Date().getFullYear(), author: 'Tema compartilhado' });
                }
                const ti = topicIndex[topic];
                edges.push({ source: 0, target: ti, weight: 0.18, same_topic: true });
                edges.push({ source: ci, target: ti, weight: 0.16, same_topic: true });
            });
        });
        return { nodes, edges };
    }

    function render3DNetwork(containerId, nodes, edges) {
        if (nodes.length < 2) return;
        const n = nodes.length;
        const pos = Array.from({ length: n }, () => [Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2]);
        for (let iter = 0; iter < 50; iter++) {
            const forces = Array.from({ length: n }, () => [0, 0, 0]);
            edges.forEach(e => {
                const i = e.source, j = e.target;
                if (i >= n || j >= n) return;
                const diff = [pos[j][0] - pos[i][0], pos[j][1] - pos[i][1], pos[j][2] - pos[i][2]];
                const dist = Math.max(Math.sqrt(diff[0] ** 2 + diff[1] ** 2 + diff[2] ** 2), 0.01);
                const k = e.weight * 2;
                for (let d = 0; d < 3; d++) { forces[i][d] += k * diff[d] / dist; forces[j][d] -= k * diff[d] / dist; }
            });
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    const diff = [pos[j][0] - pos[i][0], pos[j][1] - pos[i][1], pos[j][2] - pos[i][2]];
                    const dist = Math.max(Math.sqrt(diff[0] ** 2 + diff[1] ** 2 + diff[2] ** 2), 0.1);
                    const repulse = 0.5 / (dist * dist);
                    for (let d = 0; d < 3; d++) { forces[i][d] -= repulse * diff[d] / dist; forces[j][d] += repulse * diff[d] / dist; }
                }
            }
            for (let i = 0; i < n; i++) {
                for (let d = 0; d < 3; d++) { pos[i][d] = Math.max(-6, Math.min(6, pos[i][d] + forces[i][d] * 0.05)); }
            }
        }

        // Paleta baseada na Dark UI com Copper accents
        const typeColors = { 
            user: '#ffffff', 
            local: '#d9774a', 
            external: '#a65132', 
            global_research: '#ffbb99',
            researcher: '#ffffff', 
            topic: '#d9774a' 
        };
        const typeLabels = { user: 'Sua Pesquisa', local: 'Seus Documentos', external: 'Artigos Externos', global_research: 'Pesquisas Globais Semelhantes', researcher: 'Pesquisadores', topic: 'Temas compartilhados' };
        const typeSizes = { user: 18, local: 10, external: 8, global_research: 16, researcher: 12, topic: 10 };
        const traces = [];

        edges.forEach(e => {
            const i = e.source, j = e.target;
            if (i >= n || j >= n) return;
            traces.push({
                type: 'scatter3d', mode: 'lines',
                x: [pos[i][0], pos[j][0], null], y: [pos[i][1], pos[j][1], null], z: [pos[i][2], pos[j][2], null],
                line: { color: e.same_topic ? 'rgba(217, 119, 74, 0.4)' : 'rgba(255,255,255,0.1)', width: Math.max(1, e.weight * 5) },
                opacity: Math.min(0.8, e.weight * 2), hoverinfo: 'none', showlegend: false,
            });
        });

        for (const [type, color] of Object.entries(typeColors)) {
            const typeNodes = nodes.map((nd, idx) => ({ nd, idx })).filter(x => x.nd.type === type);
            if (!typeNodes.length) continue;
            traces.push({
                type: 'scatter3d', mode: 'markers+text',
                x: typeNodes.map(x => pos[x.idx][0]), y: typeNodes.map(x => pos[x.idx][1]), z: typeNodes.map(x => pos[x.idx][2]),
                marker: { size: typeSizes[type], color, opacity: 0.9, line: { color: 'rgba(255,255,255,0.2)', width: 1 } },
                text: typeNodes.map(x => x.nd.label), textposition: 'top center', textfont: { size: 9, color: '#e5e5e5' },
                hovertext: typeNodes.map(x => `${x.nd.label}<br>Tipo: ${x.nd.type}<br>Tema: ${x.nd.topic}`),
                hoverinfo: 'text', name: typeLabels[type],
            });
        }

        const layout = {
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', height: 600,
            margin: { l: 0, r: 0, t: 0, b: 0 },
            scene: {
                bgcolor: 'rgba(0,0,0,0)',
                xaxis: { showgrid: false, showticklabels: false, zeroline: false, showline: false },
                yaxis: { showgrid: false, showticklabels: false, zeroline: false, showline: false },
                zaxis: { showgrid: false, showticklabels: false, zeroline: false, showline: false },
            },
            legend: { font: { color: '#ffffff', size: 11 }, bgcolor: 'rgba(0,0,0,0)' }
        };

        Plotly.newPlot(containerId, traces, layout, { responsive: true, displayModeBar: false });
    }

    function repositorySignature(state, email) {
        const docs = NebulaStorage.ensureWorkspace(state, email).repository;
        const topicC = {}, kwC = {}, authorC = {}, yearC = {};
        docs.forEach(doc => {
            if (doc.topic) topicC[doc.topic] = (topicC[doc.topic] || 0) + 1;
        });
        const sortTop = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]);
        return { topics: sortTop(topicC, 8), keywords: [], authors: [], years: [], doc_count: docs.length };
    }

    function compareRepositories(state, baseEmail, otherEmail) {
        const baseDocs = NebulaStorage.ensureWorkspace(state, baseEmail).repository;
        const otherDocs = NebulaStorage.ensureWorkspace(state, otherEmail).repository;
        if (!baseDocs.length || !otherDocs.length) return null;
        
        let sim = 0;
        const shared_topics = [];
        const shared_terms = [];
        const baseTopics = baseDocs.map(d=>d.topic);
        const baseKeywords = new Set();
        baseDocs.forEach(d => (d.keywords || []).slice(0, 10).forEach(k => baseKeywords.add(k)));

        otherDocs.forEach(d => {
            if (baseTopics.includes(d.topic) && !shared_topics.includes(d.topic)) {
                shared_topics.push(d.topic);
                sim += 15;
            }
            // Keyword overlap
            (d.keywords || []).slice(0, 10).forEach(k => {
                if (baseKeywords.has(k) && !shared_terms.includes(k)) {
                    shared_terms.push(k);
                    sim += 3;
                }
            });
        });
        
        if (sim < 5) return null;
        return { shared_topics, shared_terms: shared_terms.slice(0, 8), similarity: Math.min(sim, 99) };
    }

    function getConnectedUsers(state, email, limit = 8) {
        if (!email || !state.users[email]) return [];
        const out = [];
        for (const [other, otherUser] of Object.entries(state.users)) {
            if (other === email) continue;
            const comp = compareRepositories(state, email, other);
            if (!comp) continue;
            out.push({ email: other, name: otherUser.name || other, research: otherUser.research || '', topic: TextEngine.detectTopic(otherUser.research || ''), shared_topics: comp.shared_topics, similarity: comp.similarity });
        }
        return out.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
    }

    window._getConnectedUsers = getConnectedUsers;
    return { buildResearchNetwork, buildConnectionChainNetwork, render3DNetwork, getConnectedUsers };
})();

function getConnectedUsers(state, email, limit) { return NetworkEngine.getConnectedUsers(state, email, limit); }

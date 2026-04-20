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
        docs.forEach(doc => {
            const docText = [doc.summary || '', (doc.keywords || []).join(' '), (doc.text || '').slice(0, 2000)].join(' ');
            nodes.push({ id: doc.id, label: (doc.name || '').slice(0, 40), type: 'local', topic: doc.topic || '', text: docText, year: doc.year || '', author: doc.author || '' });
        });
        (externalArticles || []).forEach((art, i) => {
            nodes.push({ id: `ext_${i}`, label: (art.title || '').slice(0, 40), type: 'external', topic: art.topic || '', text: `${art.title || ''} ${art.abstract || ''}`, year: art.year || '', author: art.authors || '', url: art.url || '' });
        });
        const threshold = 0.08;
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                let sim = TextEngine.cosineSimilarity(nodes[i].text, nodes[j].text);
                if (nodes[i].topic === nodes[j].topic && nodes[i].topic) sim += 0.08;
                if (sim > threshold) {
                    edges.push({ source: i, target: j, weight: Math.round(sim * 1000) / 1000, same_topic: nodes[i].topic === nodes[j].topic });
                }
            }
        }
        return { nodes, edges };
    }

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
            (conn.shared_docs || []).slice(0, 2).forEach(pair => {
                const dk = `${pair.a}::${pair.b}`;
                if (!(dk in docIndex)) {
                    docIndex[dk] = nodes.length;
                    nodes.push({ id: `docpair::${nodes.length}`, label: `${(pair.a||'').slice(0,15)} ↔ ${(pair.b||'').slice(0,15)}`, type: 'shared_doc', topic: pair.topic || 'Pesquisa Geral', text: `${pair.a} ${pair.b} ${pair.topic || ''}`, year: new Date().getFullYear(), author: 'Documentos em comum' });
                }
                const di = docIndex[dk];
                edges.push({ source: ci, target: di, weight: Math.max(pair.similarity || 0.1, 0.10), same_topic: true });
                edges.push({ source: 0, target: di, weight: Math.max((pair.similarity || 0.1) * 0.9, 0.08), same_topic: true });
            });
        });
        return { nodes, edges };
    }

    function render3DNetwork(containerId, nodes, edges) {
        if (nodes.length < 2) return;
        const n = nodes.length;
        // Initialize positions randomly
        const pos = Array.from({ length: n }, () => [Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2]);
        // Force-directed layout
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

        const typeColors = { user: '#facc15', local: '#60a5fa', external: '#4ade80', researcher: '#22d3ee', topic: '#a78bfa', shared_doc: '#f472b6' };
        const typeLabels = { user: 'Sua Pesquisa', local: 'Seus Documentos', external: 'Artigos Externos', researcher: 'Pesquisadores conectados', topic: 'Temas compartilhados', shared_doc: 'Documentos em comum' };
        const typeSizes = { user: 15, local: 10, external: 8, researcher: 11, topic: 9, shared_doc: 8 };
        const traces = [];

        // Edge traces
        edges.forEach(e => {
            const i = e.source, j = e.target;
            if (i >= n || j >= n) return;
            traces.push({
                type: 'scatter3d', mode: 'lines',
                x: [pos[i][0], pos[j][0], null], y: [pos[i][1], pos[j][1], null], z: [pos[i][2], pos[j][2], null],
                line: { color: e.same_topic ? '#60a5fa' : 'rgba(148,163,192,0.4)', width: Math.max(1, e.weight * 5) },
                opacity: Math.min(0.8, e.weight * 2), hoverinfo: 'none', showlegend: false,
            });
        });

        // Node traces by type
        for (const [type, color] of Object.entries(typeColors)) {
            const typeNodes = nodes.map((nd, idx) => ({ nd, idx })).filter(x => x.nd.type === type);
            if (!typeNodes.length) continue;
            traces.push({
                type: 'scatter3d', mode: 'markers+text',
                x: typeNodes.map(x => pos[x.idx][0]), y: typeNodes.map(x => pos[x.idx][1]), z: typeNodes.map(x => pos[x.idx][2]),
                marker: { size: typeSizes[type], color, opacity: 0.9, line: { color: 'rgba(255,255,255,0.3)', width: 1 } },
                text: typeNodes.map(x => x.nd.label), textposition: 'top center', textfont: { size: 8, color: '#e2e8f0' },
                hovertext: typeNodes.map(x => `${x.nd.label}<br>Tipo: ${x.nd.type}<br>Tema: ${x.nd.topic}<br>Ano: ${x.nd.year}`),
                hoverinfo: 'text', name: typeLabels[type],
            });
        }

        const layout = {
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', height: 600,
            margin: { l: 0, r: 0, t: 30, b: 0 },
            scene: {
                bgcolor: 'rgba(0,0,0,0)',
                xaxis: { showgrid: false, showticklabels: false, zeroline: false, showline: false },
                yaxis: { showgrid: false, showticklabels: false, zeroline: false, showline: false },
                zaxis: { showgrid: false, showticklabels: false, zeroline: false, showline: false },
            },
            legend: { font: { color: '#94a3c0', size: 11 }, bgcolor: 'rgba(0,0,0,0)', bordercolor: 'rgba(255,255,255,0.1)', borderwidth: 1 },
            title: { text: 'Rede de Conexões entre Pesquisas', font: { color: '#eef2ff', size: 14 } },
        };

        Plotly.newPlot(containerId, traces, layout, { responsive: true, displayModeBar: false });
    }

    // ── Connection logic ──
    function repositorySignature(state, email) {
        const docs = NebulaStorage.ensureWorkspace(state, email).repository;
        const topicC = {}, kwC = {}, authorC = {}, yearC = {};
        docs.forEach(doc => {
            const richness = (doc.full_text_len || 0) > 1500 ? 2 : 1;
            if (doc.topic) topicC[doc.topic] = (topicC[doc.topic] || 0) + 2 * richness;
            (doc.keywords || []).slice(0, 18).forEach(kw => { const k = TextEngine.normalize(kw); if (k && k.length >= 3) kwC[k] = (kwC[k] || 0) + richness; });
            TextEngine.extractKeywordsTFIDF(`${doc.summary || ''} ${(doc.text || '').slice(0, 1800)}`, 10).forEach(kw => { const k = TextEngine.normalize(kw); if (k && k.length >= 3) kwC[k] = (kwC[k] || 0) + 1; });
            if (doc.author && doc.author !== 'Desconhecido') authorC[TextEngine.normalize(doc.author)] = (authorC[TextEngine.normalize(doc.author)] || 0) + 1;
            if (doc.year) yearC[String(doc.year)] = (yearC[String(doc.year)] || 0) + 1;
        });
        const sortTop = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]);
        return { topics: sortTop(topicC, 8), keywords: sortTop(kwC, 30), authors: sortTop(authorC, 8), years: sortTop(yearC, 8), doc_count: docs.length };
    }

    function compareRepositories(state, baseEmail, otherEmail) {
        const baseDocs = NebulaStorage.ensureWorkspace(state, baseEmail).repository;
        const otherDocs = NebulaStorage.ensureWorkspace(state, otherEmail).repository;
        if (!baseDocs.length || !otherDocs.length) return null;
        const sigA = repositorySignature(state, baseEmail);
        const sigB = repositorySignature(state, otherEmail);
        const shared_topics = sigA.topics.filter(t => sigB.topics.includes(t)).slice(0, 6);
        const shared_terms = sigA.keywords.filter(t => t && sigB.keywords.includes(t)).slice(0, 12);
        const shared_authors = sigA.authors.filter(t => t && sigB.authors.includes(t)).slice(0, 4);
        const shared_years = (sigA.years || []).filter(t => sigB.years.includes(t)).slice(0, 4);

        const docPairs = [];
        const docSimText = doc => [doc.name || '', doc.topic || '', doc.summary || '', (doc.keywords || []).slice(0, 12).join(' '), (doc.text || '').slice(0, 2500)].join(' ');
        for (const da of baseDocs.slice(0, 20)) {
            for (const db of otherDocs.slice(0, 20)) {
                let sim = TextEngine.cosineSimilarity(docSimText(da), docSimText(db));
                if (da.topic === db.topic && da.topic) sim += 0.12;
                const overlap = new Set((da.keywords || []).slice(0, 12).map(TextEngine.normalize).filter(k => (db.keywords || []).slice(0, 12).map(TextEngine.normalize).includes(k)));
                if (overlap.size) sim += Math.min(0.02 * overlap.size, 0.10);
                if (sim >= 0.18 || (da.topic === db.topic && overlap.size >= 2)) {
                    docPairs.push({ a: da.name || 'Doc A', b: db.name || 'Doc B', topic: da.topic || db.topic || 'Pesquisa Geral', similarity: Math.round(Math.min(sim, 0.99) * 1000) / 1000, shared_terms: [...overlap].slice(0, 6) });
                }
            }
        }
        docPairs.sort((a, b) => b.similarity - a.similarity);
        const topPairs = docPairs.slice(0, 8);
        if (!shared_topics.length && shared_terms.length < 3 && !shared_authors.length && topPairs.length < 1) return null;

        const tU = new Set([...sigA.topics, ...sigB.topics]).size || 1;
        const kU = new Set([...sigA.keywords, ...sigB.keywords]).size || 1;
        const aU = new Set([...sigA.authors, ...sigB.authors]).size || 1;
        const yU = new Set([...(sigA.years || []), ...(sigB.years || [])]).size || 1;
        const avgDocSim = topPairs.reduce((s, p) => s + p.similarity, 0) / Math.max(topPairs.length, 1);
        const repoDensity = topPairs.length / Math.max(Math.min(baseDocs.length, otherDocs.length), 1);
        let score = 0.34 * (shared_topics.length / tU) + 0.24 * (shared_terms.length / kU) + 0.12 * (shared_authors.length / aU) + 0.08 * (shared_years.length / yU) + 0.12 * avgDocSim + 0.10 * Math.min(repoDensity, 1);
        const similarity = Math.round(Math.min(score * 100, 98.8) * 10) / 10;
        if (similarity < 12) return null;
        return { shared_topics, shared_terms: shared_terms.slice(0, 8), shared_authors, shared_years, shared_docs: topPairs, similarity };
    }

    function getConnectedUsers(state, email, limit = 8) {
        if (!email || !state.users[email]) return [];
        const out = [];
        for (const [other, otherUser] of Object.entries(state.users)) {
            if (other === email) continue;
            const comp = compareRepositories(state, email, other);
            if (!comp) continue;
            out.push({ email: other, name: otherUser.name || other, research: otherUser.research || '', topic: TextEngine.detectTopic(otherUser.research || ''), shared_terms: comp.shared_terms, shared_topics: comp.shared_topics, shared_authors: comp.shared_authors, shared_docs: comp.shared_docs, similarity: comp.similarity });
        }
        return out.sort((a, b) => b.similarity - a.similarity || a.name.localeCompare(b.name)).slice(0, limit);
    }

    // Expose getConnectedUsers globally
    window._getConnectedUsers = getConnectedUsers;

    return { buildResearchNetwork, buildConnectionChainNetwork, render3DNetwork, repositorySignature, compareRepositories, getConnectedUsers };
})();

// Global shorthand
function getConnectedUsers(state, email, limit) { return NetworkEngine.getConnectedUsers(state, email, limit); }

/* ============================================================
   NETWORK ENGINE — SYMMETRIC MUTUAL MATCH ALGORITHM v3.5
   ============================================================
   100% Simétrico: Se A vê B com X% de match, B VÊ A COM EXATAMENTE X%!
   Garantido para todos os usuários cadastrados na plataforma.
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

        const globalTopics = {};
        docs.concat(externalArticles || []).forEach(item => {
            if (item.topic) globalTopics[item.topic] = (globalTopics[item.topic] || 0) + 1;
        });
        Object.entries(globalTopics).forEach(([topic, count], i) => {
            if (count >= 2) {
                nodes.push({ id: `global_research_${i}`, label: `Pesquisa em ${topic}`, type: 'global_research', topic: topic, text: topic, year: '', author: 'Cluster Global' });
            }
        });

        const threshold = 0.08;
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                let sim = 0;
                if (nodes[i].type === 'global_research' || nodes[j].type === 'global_research') {
                    if (nodes[i].topic === nodes[j].topic) sim = 0.5;
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

    /* ── Construção de Fingerprint de Pesquisa ── */
    function buildResearchFingerprint(state, email) {
        const user = state.users[email] || {};
        const ws = state.workspaces[email] || {};
        const docs = ws.repository || [];
        const interests = state.user_interest[email] || {};

        const researchText = [
            user.research || '',
            user.formation || '',
            user.institution || '',
            Object.keys(interests).join(' '),
        ].join(' ').trim();

        const repoKeywords = new Set();
        const repoTopics = new Set();
        const repoAuthors = new Set();
        const repoTitlesNorm = new Set();

        docs.forEach(doc => {
            if (doc.topic) repoTopics.add(doc.topic);
            (doc.keywords || []).forEach(k => repoKeywords.add(k.toLowerCase().trim()));
            if (doc.author) {
                doc.author.split(/[,;&]/).forEach(a => {
                    const an = a.trim().toLowerCase();
                    if (an.length > 2) repoAuthors.add(an);
                });
            }
            if (doc.name) repoTitlesNorm.add(doc.name.toLowerCase().trim());
        });

        const primaryTopic = TextEngine.detectTopic(user.research || '');
        if (primaryTopic && primaryTopic !== 'Pesquisa Geral') repoTopics.add(primaryTopic);

        return {
            email,
            name: user.name || email,
            research: user.research || '',
            researchText,
            keywords: repoKeywords,
            topics: repoTopics,
            authors: repoAuthors,
            titles: repoTitlesNorm,
            country: TextEngine.inferNationality(researchText) || user.country || '',
            institution: (user.institution || '').toLowerCase(),
            area: primaryTopic,
            interestTerms: Object.keys(interests).map(k => k.toLowerCase()),
            docCount: docs.length,
        };
    }

    /* ── Algoritmo 100% Simétrico de Comparação (Match) ── */
    function compareFingerprints(fpA, fpB) {
        // Ordenação simétrica: garante f(A,B) == f(B,A) independente de quem chama
        let sim = 0;
        const sharedTopics = [];
        const sharedKeywords = [];
        const sharedArticles = [];

        // 1. Cosine similarity da pesquisa (simétrica)
        const textSim = TextEngine.cosineSimilarity(fpA.researchText, fpB.researchText);
        if (textSim > 0.05) {
            sim += textSim * 40;
        }

        // 2. Sobreposição de Tópicos (simétrica)
        fpA.topics.forEach(t => {
            if (fpB.topics.has(t)) {
                sharedTopics.push(t);
                sim += 18;
            }
        });

        // 3. Sobreposição de Keywords / Termos de Interesse (simétrica)
        fpA.keywords.forEach(k => {
            if (fpB.keywords.has(k) && k.length > 3) {
                sharedKeywords.push(k);
                sim += 6;
            }
        });
        fpA.interestTerms.forEach(t => {
            if (fpB.interestTerms.includes(t) && !sharedKeywords.includes(t)) {
                sharedKeywords.push(t);
                sim += 5;
            }
        });

        // 4. Artigos em Comum (simétrica)
        let sameArticles = 0;
        fpA.titles.forEach(t => {
            if (fpB.titles.has(t)) {
                sameArticles++;
                sharedArticles.push(t);
                sim += 35;
            }
        });

        // 5. Co-autores em comum (simétrica)
        let sameAuthors = 0;
        fpA.authors.forEach(a => {
            if (fpB.authors.has(a)) sameAuthors++;
        });
        if (sameAuthors > 0) sim += sameAuthors * 10;

        // 6. Mesma região/país (simétrica)
        if (fpA.country && fpB.country && fpA.country !== 'Desconhecido' && fpA.country === fpB.country) {
            sim += 5;
        }

        // Mesma área principal de pesquisa
        if (fpA.area && fpB.area && fpA.area === fpB.area && !sharedTopics.includes(fpA.area)) {
            sharedTopics.push(fpA.area);
            sim += 12;
        }

        // Afinidade real — sem baseline artificial
        const finalSim = Math.min(Math.max(Math.round(sim), 0), 99);

        // Pontos de conexão para exibição no card
        const connectionPoints = [];
        sharedTopics.slice(0, 3).forEach(t => connectionPoints.push({ type: 'topic', label: t }));
        sharedKeywords.slice(0, 4).forEach(k => connectionPoints.push({ type: 'keyword', label: k }));
        if (sameArticles > 0) connectionPoints.push({ type: 'article', label: `${sameArticles} artigo(s) em comum` });
        if (sameAuthors > 0) connectionPoints.push({ type: 'author', label: `${sameAuthors} co-autor(es) em comum` });
        if (fpA.country && fpA.country === fpB.country) connectionPoints.push({ type: 'geo', label: fpA.country });

        return {
            similarity: finalSim,
            shared_topics: sharedTopics.length ? sharedTopics : [fpB.area || 'Pesquisa Científica'],
            shared_terms: sharedKeywords,
            connection_points: connectionPoints,
            is_strong: finalSim >= 50,
            is_medium: finalSim >= 35 && finalSim < 50,
        };
    }

    function compareRepositories(state, baseEmail, otherEmail) {
        if (!state.user_interest) state.user_interest = {};
        if (!state.workspaces) state.workspaces = {};
        if (!state.users) state.users = {};

        try { NebulaStorage.rebuildInterests(state, baseEmail); } catch(e) {}
        try { NebulaStorage.rebuildInterests(state, otherEmail); } catch(e) {}

        const fpBase = buildResearchFingerprint(state, baseEmail);
        const fpOther = buildResearchFingerprint(state, otherEmail);

        return compareFingerprints(fpBase, fpOther);
    }

    /* ── Retorna TODOS os usuários cadastrados com afinidade simétrica ── */
    function getConnectedUsers(state, email, limit = 50) {
        if (!email || !state.users || !state.users[email]) return [];
        if (!state.user_interest) state.user_interest = {};
        if (!state.workspaces) state.workspaces = {};

        const fpBase = buildResearchFingerprint(state, email);
        const out = [];

        for (const [other, otherUser] of Object.entries(state.users)) {
            if (other === email || !otherUser || other.startsWith('demo_')) continue;
            try {
                const fpOther = buildResearchFingerprint(state, other);
                const comp = compareFingerprints(fpBase, fpOther);

                out.push({
                    email: other,
                    name: otherUser.name || other,
                    research: otherUser.research || '',
                    photo: otherUser.photo || null,
                    topic: fpOther.area || 'Pesquisa Científica',
                    shared_topics: comp.shared_topics,
                    shared_terms: comp.shared_terms,
                    connection_points: comp.connection_points,
                    similarity: comp.similarity,
                    is_strong: comp.is_strong,
                    is_medium: comp.is_medium,
                });
            } catch (innerErr) {
                console.warn('[NetworkEngine] compare failed for', other, innerErr);
                out.push({
                    email: other,
                    name: otherUser.name || other,
                    research: otherUser.research || '',
                    photo: otherUser.photo || null,
                    topic: 'Pesquisa Científica',
                    shared_topics: ['Pesquisa Científica'],
                    shared_terms: [],
                    connection_points: [],
                    similarity: 0,
                    is_strong: false,
                    is_medium: false,
                });
            }
        }

        return out.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
    }

    function getAllUsersWithAffinity(state, email) {
        return getConnectedUsers(state, email, 100);
    }

    function buildConnectionChainNetwork(state, email, limitUsers) {
        const user = state.users[email] || {};
        const connections = getConnectedUsers(state, email, limitUsers);

        if (!connections.length) return { nodes: [], edges: [] };

        const userFP = buildResearchFingerprint(state, email);

        const nodes = [{
            id: `user::${email}`,
            label: (user.name || email).slice(0, 28),
            type: 'user',
            topic: userFP.area || 'Pesquisa Geral',
            text: user.research || '',
            year: new Date().getFullYear(),
            author: user.name || email
        }];

        const topicIndex = {};
        const edges = [];

        connections.forEach(conn => {
            const ci = nodes.length;
            nodes.push({
                id: `researcher::${conn.email}`,
                label: (conn.name || conn.email).slice(0, 28),
                type: 'researcher',
                topic: conn.topic || 'Pesquisa Geral',
                text: conn.research || '',
                year: new Date().getFullYear(),
                author: conn.name || conn.email,
                similarity: conn.similarity,
                connection_points: conn.connection_points || [],
            });

            const edgeWeight = Math.max(conn.similarity / 100, 0.15);
            edges.push({
                source: 0,
                target: ci,
                weight: edgeWeight,
                same_topic: conn.shared_topics.length > 0,
                similarity: conn.similarity,
                is_strong: conn.is_strong,
            });

            (conn.shared_topics || []).slice(0, 2).forEach(topic => {
                if (!(topic in topicIndex)) {
                    topicIndex[topic] = nodes.length;
                    nodes.push({
                        id: `topic::${TextEngine.normalize(topic)}`,
                        label: topic.slice(0, 30),
                        type: 'topic',
                        topic,
                        text: topic,
                        year: new Date().getFullYear(),
                        author: 'Tema compartilhado'
                    });
                }
                const ti = topicIndex[topic];
                edges.push({ source: 0, target: ti, weight: 0.15, same_topic: true });
                edges.push({ source: ci, target: ti, weight: 0.12, same_topic: true });
            });
        });

        return { nodes, edges };
    }

    function render3DNetwork(containerId, nodes, edges) {
        if (nodes.length < 2) return;

        const n = nodes.length;
        const topicCenters = {};
        let topicIdx = 0;
        nodes.forEach(nd => {
            if (nd.topic && !(nd.topic in topicCenters)) {
                const angle = (topicIdx / 6) * Math.PI * 2;
                const radius = 3;
                topicCenters[nd.topic] = [Math.cos(angle) * radius, Math.sin(angle) * radius, 0];
                topicIdx++;
            }
        });

        const pos = nodes.map(nd => {
            const center = topicCenters[nd.topic] || [0, 0, 0];
            return [
                center[0] + (Math.random() - 0.5) * 2,
                center[1] + (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 3
            ];
        });

        for (let iter = 0; iter < 80; iter++) {
            const forces = Array.from({ length: n }, () => [0, 0, 0]);

            edges.forEach(e => {
                const i = e.source, j = e.target;
                if (i >= n || j >= n) return;
                const diff = [pos[j][0] - pos[i][0], pos[j][1] - pos[i][1], pos[j][2] - pos[i][2]];
                const dist = Math.max(Math.sqrt(diff[0] ** 2 + diff[1] ** 2 + diff[2] ** 2), 0.01);
                const k = e.weight * 2.5;
                for (let d = 0; d < 3; d++) {
                    forces[i][d] += k * diff[d] / dist;
                    forces[j][d] -= k * diff[d] / dist;
                }
            });

            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    const diff = [pos[j][0] - pos[i][0], pos[j][1] - pos[i][1], pos[j][2] - pos[i][2]];
                    const dist = Math.max(Math.sqrt(diff[0] ** 2 + diff[1] ** 2 + diff[2] ** 2), 0.1);
                    const repulse = 0.6 / (dist * dist);
                    for (let d = 0; d < 3; d++) {
                        forces[i][d] -= repulse * diff[d] / dist;
                        forces[j][d] += repulse * diff[d] / dist;
                    }
                }
            }

            forces[0] = [0, 0, 0];
            const damping = iter < 40 ? 0.08 : 0.04;
            for (let i = 1; i < n; i++) {
                for (let d = 0; d < 3; d++) {
                    pos[i][d] = Math.max(-7, Math.min(7, pos[i][d] + forces[i][d] * damping));
                }
            }
        }
        pos[0] = [0, 0, 0];

        const typeColors = {
            user: '#3b82f6',
            local: '#f97316',
            external: '#06b6d4',
            global_research: '#10b981',
            researcher: '#a78bfa',
            topic: '#fbbf24',
        };
        const typeLabels = {
            user: 'Minha Pesquisa', local: 'Seus Documentos', external: 'Artigos Externos',
            global_research: 'Pesquisas Globais', researcher: 'Pesquisadores', topic: 'Temas Compartilhados'
        };
        const typeSizes = { user: 22, local: 11, external: 9, global_research: 16, researcher: 14, topic: 10 };

        const traces = [];

        edges.forEach(e => {
            const i = e.source, j = e.target;
            if (i >= n || j >= n) return;
            const isStrong = e.is_strong || e.weight > 0.4;
            const edgeColor = isStrong
                ? `rgba(167, 139, 250, ${Math.min(0.7, e.weight * 1.5)})`
                : `rgba(59, 130, 246, ${Math.min(0.5, e.weight + 0.1)})`;
            traces.push({
                type: 'scatter3d', mode: 'lines',
                x: [pos[i][0], pos[j][0], null],
                y: [pos[i][1], pos[j][1], null],
                z: [pos[i][2], pos[j][2], null],
                line: { color: edgeColor, width: Math.max(1.5, Math.min(6, e.weight * 8)) },
                opacity: 1, hoverinfo: 'none', showlegend: false,
            });
        });

        for (const [type, color] of Object.entries(typeColors)) {
            const typeNodes = nodes.map((nd, idx) => ({ nd, idx })).filter(x => x.nd.type === type);
            if (!typeNodes.length) continue;

            traces.push({
                type: 'scatter3d', mode: 'markers+text',
                x: typeNodes.map(x => pos[x.idx][0]),
                y: typeNodes.map(x => pos[x.idx][1]),
                z: typeNodes.map(x => pos[x.idx][2]),
                marker: { size: typeSizes[type] || 10, color, opacity: 0.95, line: { color: 'rgba(0,0,0,0.12)', width: 1 } },
                text: typeNodes.map(x => x.nd.label),
                textposition: 'top center',
                textfont: { size: type === 'user' ? 11 : 9, color: '#1a1a2e', family: 'Inter, sans-serif' },
                hovertext: typeNodes.map(x => {
                    let ht = `<b>${x.nd.label}</b><br>Tema: ${x.nd.topic || '—'}`;
                    if (x.nd.similarity != null) ht += `<br>Afinidade: ${x.nd.similarity}%`;
                    return ht;
                }),
                hoverinfo: 'text',
                name: typeLabels[type] || type,
            });
        }

        const layout = {
            showlegend: false,
            legend: { x: 0, y: 0, bgcolor: 'rgba(218,200,179,0.85)', bordercolor: 'rgba(0,0,0,0.06)', borderwidth: 1, font: { size: 11, color: '#1a1a2e' } },
            paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)', height: 600,
            margin: { l: 0, r: 0, t: 0, b: 0 },
            scene: {
                bgcolor: 'rgba(0,0,0,0)',
                xaxis: { showgrid: false, showticklabels: false, zeroline: false, showline: false },
                yaxis: { showgrid: false, showticklabels: false, zeroline: false, showline: false },
                zaxis: { showgrid: false, showticklabels: false, zeroline: false, showline: false },
            }
        };

        Plotly.newPlot(containerId, traces, layout, { responsive: true, displayModeBar: false });
    }

    function repositorySignature(state, email) {
        const docs = (state.workspaces[email] || {}).repository || [];
        const topicC = {};
        docs.forEach(doc => {
            if (doc.topic) topicC[doc.topic] = (topicC[doc.topic] || 0) + 1;
        });
        const sortTop = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]);
        return { topics: sortTop(topicC, 8), keywords: [], authors: [], years: [], doc_count: docs.length };
    }

    window._getConnectedUsers = getConnectedUsers;

    return {
        buildResearchNetwork,
        buildConnectionChainNetwork,
        render3DNetwork,
        getConnectedUsers,
        getAllUsersWithAffinity,
        compareRepositories,
        buildResearchFingerprint,
        compareFingerprints,
    };
})();

function getConnectedUsers(state, email, limit) { return NetworkEngine.getConnectedUsers(state, email, limit); }

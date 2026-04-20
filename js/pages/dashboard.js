/* ============================================================
   PAGE: DASHBOARD
   ============================================================ */
const PageDashboard = (() => {
    function render(container, state) {
        const user = state.users[state.current_user] || {};
        const docs = state.repository || [];
        const research = user.research || '';
        const connections = getConnectedUsers(state, state.current_user, 6);

        let html = `
            <div class="page-title">Bem-vindo, ${(user.name || '').split(' ')[0] || 'Pesquisador'}</div>
            <div class="page-sub">${research || 'Configure sua área de pesquisa no Perfil para receber recomendações melhores.'}</div>
        `;

        // Metrics
        const topicsCount = new Set(docs.map(d => d.topic).filter(Boolean)).size;
        const dominantLanguage = TextEngine.safeTopValue(docs.map(d => d.language));
        html += `
            <div class="metric-grid">
                <div class="metric-card blue">
                    <div class="metric-label">Documentos</div>
                    <div class="metric-value">${docs.length}</div>
                    <div class="metric-desc">No repositório</div>
                </div>
                <div class="metric-card cyan">
                    <div class="metric-label">Temas</div>
                    <div class="metric-value">${topicsCount}</div>
                    <div class="metric-desc">Mapeados</div>
                </div>
                <div class="metric-card green">
                    <div class="metric-label">Conexões</div>
                    <div class="metric-value">${connections.length}</div>
                    <div class="metric-desc">Afinidades por repositório</div>
                </div>
                <div class="metric-card purple">
                    <div class="metric-label">Buscas</div>
                    <div class="metric-value">${state.search_history.length}</div>
                    <div class="metric-desc">Registradas</div>
                </div>
                <div class="metric-card yellow">
                    <div class="metric-label">Idioma base</div>
                    <div class="metric-value" style="font-size:1.2rem;margin-top:0.4rem">${dominantLanguage}</div>
                    <div class="metric-desc">Predominante</div>
                </div>
            </div>
        `;

        html += `<div class="grid-60-40">`;

        // Left Col
        html += `<div>`;
        
        // Recommendations
        html += `
            <div class="glass">
                <div class="section-title">Sugestões de artigos para sua pesquisa</div>
                ${docs.length && !research ? `<div class="notice-box">Sem linha de pesquisa definida no perfil. As sugestões abaixo foram inferidas a partir dos arquivos do seu repositório.</div>` : ''}
                <div id="dash-recommendations">
                    <div class="spinner-text">Buscando artigos correlatos...</div>
                </div>
            </div>
        `;

        // Pistas
        if (docs.length) {
            const dominantTopic = TextEngine.safeTopValue(docs.map(d => d.topic), 'Pesquisa Geral');
            const avgSize = Math.round(docs.reduce((s, d) => s + (d.size_kb || 0), 0) / docs.length * 10) / 10 || 0;
            const kwPool = []; docs.slice(0, 10).forEach(d => kwPool.push(...(d.keywords || []).slice(0, 5)));
            const ranked = TextEngine.counter(kwPool).slice(0, 16).map(e => e[0]);
            
            html += `
                <div class="glass">
                    <div class="section-title">Pistas extraídas do seu repositório</div>
                    <div class="notice-box">
                        Tema mais frequente: <b>${dominantTopic}</b> · Idioma predominante: <b>${dominantLanguage}</b> ·
                        Tamanho médio dos arquivos: <b>${avgSize} KB</b>. Esse resumo está sendo usado para montar recomendações de leitura mais próximas do seu acervo.
                    </div>
                    <div>${ranked.map(t => `<span class="tag">${t}</span>`).join('')}</div>
                </div>
            `;
        }

        html += `</div>`; // End Left Col

        // Right Col
        html += `<div>`;

        // Connections
        html += `
            <div class="glass">
                <div class="section-title">Pesquisadores conectados</div>
                ${!connections.length ? `<div class="small-muted">Ainda não há outros usuários suficientemente próximos ao seu tema. Quando houver, eles aparecerão aqui.</div>` : ''}
                ${connections.slice(0, 5).map(conn => {
                    const shared = (conn.shared_terms || []).slice(0, 4).join(' · ') || conn.topic || 'Pesquisa Geral';
                    return `
                        <div class="doc-card">
                            <b style="font-size:0.86rem">${conn.name}</b><br>
                            <span class="small-muted">${conn.topic || 'Pesquisa Geral'} · similaridade ${conn.similarity}%</span>
                            <div style="margin-top:0.45rem;color:#cbd5e1;font-size:0.8rem">${(conn.research || 'Sem linha de pesquisa cadastrada.').slice(0, 140)}</div>
                            <div style="margin-top:0.45rem"><span class="tag-purple">${shared}</span></div>
                        </div>
                    `;
                }).join('')}
                ${connections.length ? `<button class="btn btn-full mt-1" onclick="NebulaApp.navigate('Chat')">Abrir chat</button>` : ''}
            </div>
        `;

        // Profile Terms
        const profileTerms = NebulaApp.recommendTerms(state.current_user, 20);
        html += `
            <div class="glass">
                <div class="section-title">Termos aprendidos do seu perfil</div>
                ${profileTerms.length ? profileTerms.map(t => `<span class="tag">${t}</span>`).join('') : `<div class="small-muted">Faça buscas e envie documentos para o sistema aprender seu perfil temático.</div>`}
            </div>
        `;

        // Shortcuts
        html += `
            <div class="glass">
                <div class="section-title">Atalhos</div>
                <div class="flex-wrap">
                    ${(profileTerms.slice(0, 4).length ? profileTerms.slice(0, 4) : ['análise bibliográfica', 'estado da arte', 'corpus documental', 'visualização']).map(t => `
                        <button class="btn btn-sm" onclick="NebulaApp.quickSearch('${t}')">${t}</button>
                    `).join('')}
                </div>
            </div>
        `;

        html += `</div></div>`; // End Right Col and Grid

        container.innerHTML = html;

        // Async Recommendations
        const recContainer = document.getElementById('dash-recommendations');
        const q = SearchEngine.buildRecommendationQuery(research, docs);
        if (!q.trim()) {
            recContainer.innerHTML = `<div class="small-muted">Adicione uma linha de pesquisa no Perfil ou envie documentos no Repositório para gerar recomendações.</div>`;
            return;
        }

        const cacheKey = `dashboard_articles_${q.slice(0, 20)}`;
        if (state[cacheKey]) {
            renderRecommendations(recContainer, state[cacheKey], research, docs);
        } else {
            Promise.all([
                SearchEngine.searchSemanticScholar(q, 6),
                SearchEngine.searchCrossref(q, 4)
            ]).then(([ss, cr]) => {
                let arts = ss;
                if (arts.length < 4) arts = arts.concat(cr);
                state[cacheKey] = arts;
                renderRecommendations(recContainer, arts, research, docs);
            });
        }
    }

    function renderRecommendations(container, articles, research, docs) {
        if (!articles || !articles.length) {
            container.innerHTML = `<div class="small-muted">Não consegui recuperar artigos agora, mas a consulta já foi montada.</div>`;
            return;
        }
        const baseText = research || docs.slice(0, 8).map(d => (d.keywords || []).slice(0, 6).join(' ')).join(' ');
        
        let html = '';
        articles.slice(0, 6).forEach(art => {
            const artText = `${art.title || ''} ${art.abstract || ''}`;
            const sim = Math.min(Math.round(TextEngine.cosineSimilarity(baseText, artText) * 200 * 10) / 10, 99);
            const titleHtml = art.url ? `<a href="${art.url}" target="_blank">${art.title || 'Sem título'}</a>` : (art.title || 'Sem título');
            html += `
                <div class="article-card">
                    <div class="article-title">${titleHtml}</div>
                    <div class="article-meta">${art.authors || 'Não informado'} · ${art.year || '?'} · ${art.source || 'Fonte externa'} · ${art.citations || 0} citações</div>
                    <div class="article-abstract">${(art.abstract || 'Resumo indisponível.').slice(0, 260)}...</div>
                    <div style="margin-top:0.55rem">
                        <span class="tag">${art.topic || 'Pesquisa Geral'}</span>
                        <span class="tag-green">Aderência: ${sim}%</span>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    }

    return { render };
})();

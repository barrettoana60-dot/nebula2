/* PAGE: SEARCH */
const PageSearch = (() => {

    const ACADEMIC_SOURCES = ['SciELO', 'OpenAlex', 'Semantic Scholar', 'Crossref', 'DOAJ', 'Europe PMC'];
    const SUGGESTED_TERMS = [
        'Inteligência Artificial', 'Saúde Pública', 'NLP e Transformers', 
        'Visão Computacional', 'Ciência de Dados na Educação', 'Blockchain e Criptografia', 
        'Redes Neurais', 'Análise Semântica', 'Deep Learning'
    ];

    let searchTab = 'articles'; // 'articles' | 'users'

    function getStoredSearchHistory(userEmail) {
        try {
            const key = 'nebula_search_history_v3_' + (userEmail || '').toLowerCase().trim();
            const stored = JSON.parse(localStorage.getItem(key) || '[]');
            return Array.isArray(stored) ? stored : [];
        } catch { return []; }
    }

    function saveStoredSearchHistory(userEmail, list) {
        try {
            const key = 'nebula_search_history_v3_' + (userEmail || '').toLowerCase().trim();
            localStorage.setItem(key, JSON.stringify(list.slice(0, 30)));
        } catch {}
    }

    function renderArticleCard(art, showAffinity = true) {
        const titleHtml = art.url
            ? `<a href="${art.url}" target="_blank" rel="noopener" style="color:var(--text-white);text-decoration:none;font-weight:700;font-size:1.02rem;">${art.title}</a>`
            : `<span style="font-weight:700;font-size:1.02rem;color:var(--text-white);">${art.title}</span>`;
        const provider = art.provider || art.source || 'Acadêmico';
        const qualis = art.qualis || 'B1';
        const qualisColor = art.qualisColor || '#3b82f6';
        const qualisLabel = art.qualisLabel || `Qualis ${qualis}`;

        const affinityHtml = showAffinity && art.affinityPct != null ? `
            <div style="display:flex;align-items:center;gap:0.6rem;margin-top:0.55rem;flex-wrap:wrap">
                <div class="sim-bar-wrap" style="flex:1;min-width:120px;margin:0"><div class="sim-bar-fill" style="width:${art.affinityPct}%"></div></div>
                <span class="tag tag-copper" style="white-space:nowrap;font-size:0.72rem">${art.affinityPct}% relevância</span>
            </div>` : '';

        return `
            <div class="article-card" style="padding:1.2rem; margin-bottom:1rem;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:0.8rem;flex-wrap:wrap;">
                    <div class="article-title" style="flex:1;min-width:260px;">${titleHtml}</div>
                    <div style="display:flex; gap:0.4rem; align-items:center; flex-wrap:wrap;">
                        <span class="tag" style="background:${qualisColor}22; border-color:${qualisColor}; color:${qualisColor}; font-weight:800; font-size:0.75rem;" title="${qualisLabel}">Qualis ${qualis}</span>
                        <span class="tag" style="font-size:0.7rem;white-space:nowrap;background:rgba(59,130,246,0.12);border-color:rgba(59,130,246,0.35);color:var(--color-blue)">${provider}</span>
                    </div>
                </div>
                <div class="article-meta" style="margin-top:0.4rem;font-size:0.82rem;color:var(--text-white-60);">
                    <b>Autores:</b> ${art.authors || 'Não informado'} · <b>Ano:</b> ${art.year || '?'} · <b>Periódico:</b> ${art.journal || art.source || 'Revista Científica'} · <b>Citações:</b> ${art.citations || 0}
                </div>
                <div class="article-abstract" style="margin-top:0.5rem;font-size:0.85rem;line-height:1.5;color:var(--text-white-80);">${(art.abstract || 'Resumo indisponível.').slice(0, 320)}${(art.abstract || '').length > 320 ? '...' : ''}</div>
                <div style="margin-top:0.6rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
                    <div>
                        <span class="tag">${art.topic || 'Pesquisa Geral'}</span>
                        ${(art.keywords || []).slice(0, 3).map(kw => `<span class="tag tag-copper" style="font-size:0.68rem; margin-left:0.2rem;">${kw}</span>`).join('')}
                    </div>
                    ${art.url ? `<a href="${art.url}" target="_blank" rel="noopener" class="btn btn-sm btn-blue" style="padding:3px 10px; font-size:0.75rem;">Acessar Publicação ↗</a>` : ''}
                </div>
                ${affinityHtml}
            </div>`;
    }

    function renderUserCard(uEmail, userObj, currentEmail, similarity, connectionPoints) {
        const isSelf = (uEmail || '').toLowerCase() === (currentEmail || '').toLowerCase();
        const name = userObj.name || uEmail;
        const initial = name.trim().charAt(0).toUpperCase();
        const affHtml = similarity >= 15
            ? `<span class="tag tag-copper" style="font-size:0.65rem;margin-top:0.3rem;display:inline-block;">${similarity}% afinidade</span>`
            : '';
        const connHtml = (connectionPoints || []).slice(0, 2).map(cp =>
            `<span class="tag" style="font-size:0.62rem;margin-top:0.2rem;display:inline-block;margin-right:0.2rem;">${cp.label}</span>`
        ).join('');
        return `
            <div class="glass" style="display:flex; align-items:center; gap:1rem; padding:1rem; border-radius:16px; margin-bottom:0.75rem; flex-wrap:wrap;">
                <div style="width:52px; height:52px; border-radius:50%; background:var(--color-blue); display:flex; align-items:center; justify-content:center; font-size:1.3rem; font-weight:700; color:#fff; overflow:hidden; flex-shrink:0; cursor:${userObj.photo ? 'pointer' : 'default'}; box-shadow:0 3px 10px rgba(0,0,0,0.15);" ${userObj.photo ? `onclick="PageChat.openPhotoViewer('${userObj.photo.replace(/'/g, "\\'")}','${(userObj.name || '').replace(/'/g, "\\'")}')"` : ''}>
                    ${userObj.photo ? `<img src="${userObj.photo}" alt="" style="width:100%;height:100%;object-fit:cover;">` : initial}
                </div>
                <div style="flex:1; min-width:200px;">
                    <div style="font-weight:700; font-size:1.05rem; color:var(--text-white);">${name} ${isSelf ? '<span class="tag" style="font-size:0.65rem;">Você</span>' : ''}</div>
                    <div style="font-size:0.8rem; color:var(--text-white-60);">@${uEmail.split('@')[0]}</div>
                    <div style="font-size:0.85rem; color:var(--text-white-80); margin-top:0.25rem;">${userObj.research || 'Pesquisa acadêmica geral'}</div>
                    ${affHtml}${connHtml}
                </div>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn btn-sm btn-primary" onclick="PageProfile.render(document.getElementById('pageContainer'), NebulaApp.getState(), '${uEmail}')">VISITAR PERFIL</button>
                    ${!isSelf ? `<button class="btn btn-sm" style="background:rgba(255,255,255,0.4); border:1px solid rgba(0,0,0,0.1);" onclick="(function(){ var st = NebulaApp.getState(); st.chat_target = '${uEmail}'; NebulaApp.navigate('Comunidade'); })()">MENSAGEM</button>` : ''}
                </div>
            </div>`;
    }

    function render(container, state) {
        const defaultQuery = state.quick_query || state.search_query || '';
        state.quick_query = '';

        if (state.logged_in && state.current_user) {
            NebulaStorage.refreshCommunityDirectory(state).then(() => {
                _renderSearchUI(container, NebulaApp.getState(), defaultQuery);
            }).catch(() => _renderSearchUI(container, state, defaultQuery));
            return;
        }
        _renderSearchUI(container, state, defaultQuery);
    }

    function _renderSearchUI(container, state, defaultQuery) {
        const email = (state.current_user || '').toLowerCase().trim();
        const storedHistory = getStoredSearchHistory(email);
        const stateHistory = state.search_history || [];
        const combinedHistory = [...storedHistory, ...stateHistory];
        const uniqueHistory = [];
        const seenQueries = new Set();
        combinedHistory.forEach(h => {
            const q = (h.query || '').trim();
            if (q && !seenQueries.has(q.toLowerCase())) {
                seenQueries.add(q.toLowerCase());
                uniqueHistory.push(h);
            }
        });

        const historyChipsHtml = uniqueHistory.length ? `
            <div style="display:flex; gap:0.4rem; flex-wrap:wrap; align-items:center;">
                ${uniqueHistory.slice(0, 10).map(h =>
                    `<button class="btn btn-sm" style="font-size:0.73rem; padding:3px 9px; background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.3); color:var(--color-blue);" onclick="PageSearch.quickTerm('${(h.query || '').replace(/'/g, "\\'")}')">${h.query}</button>`
                ).join('')}
                <button class="btn btn-sm" style="font-size:0.7rem; padding:2px 8px; color:#ef4444; border-color:rgba(239,68,68,0.3);" onclick="PageSearch.clearHistory()">Limpar</button>
            </div>
        ` : '<span style="font-size:0.75rem; color:var(--text-white-40);">Nenhuma busca recente.</span>';

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; flex-wrap:wrap; gap:1rem;">
                <div>
                    <div class="page-title">Pesquisa Inteligente &amp; Qualis CAPES</div>
                    <div class="page-sub" style="margin-bottom:0">Busca em artigos acadêmicos globais (OpenAlex, SciELO, DOAJ, Semantic Scholar) com classificação Qualis</div>
                </div>
                <button class="btn btn-blue" onclick="NebulaApp.renderPage()" style="gap:0.4rem; padding: 0.5rem 1rem;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                    Atualizar Página
                </button>
            </div>

            <!-- Abas de Pesquisa -->
            <div class="tabs-bar mb-1" style="max-width:400px;">
                <button class="tab-btn ${searchTab === 'articles' ? 'active' : ''}" id="search-tab-articles">Artigos Acadêmicos &amp; Periódicos</button>
                <button class="tab-btn ${searchTab === 'users' ? 'active' : ''}" id="search-tab-users">Pesquisadores / Usuários</button>
            </div>

            <!-- Sugestões de Pesquisa -->
            <div style="margin-bottom:0.75rem; display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
                <span style="font-size:0.8rem; font-weight:600; color:var(--text-white-60);">Sugestões de Pesquisa:</span>
                ${SUGGESTED_TERMS.map(t => `<button class="btn btn-sm" style="font-size:0.75rem; padding:3px 10px; background:rgba(255,255,255,0.4); border:1px solid rgba(0,0,0,0.08);" onclick="PageSearch.quickTerm('${t}')">${t}</button>`).join('')}
            </div>

            <!-- Histórico Recente -->
            <div style="margin-bottom:1.25rem; display:flex; gap:0.5rem; flex-wrap:wrap; align-items:center;">
                <span style="font-size:0.8rem; font-weight:600; color:var(--text-white-60);">Histórico Recente:</span>
                ${historyChipsHtml}
            </div>

            <div class="glass mb-1" id="search-form-card">
                <div class="input-group" style="margin-bottom:0">
                    <label class="input-label" id="search-input-label">${searchTab === 'users' ? 'Nome, email ou tema de pesquisa do usuário' : 'Termo, periódico ou pergunta de pesquisa acadêmica'}</label>
                    <textarea id="search-query" class="textarea" style="min-height:55px;" placeholder="${searchTab === 'users' ? 'Ex: Maria Oliveira, inteligência artificial...' : 'Ex: museologia e patrimônio cultural na América Latina...'}">${defaultQuery}</textarea>
                </div>
                <button class="btn btn-primary btn-full mt-1" id="search-btn">Pesquisar</button>
            </div>

            <div id="search-results-container"></div>
        `;

        document.getElementById('search-tab-articles').addEventListener('click', () => {
            searchTab = 'articles';
            render(container, state);
        });

        document.getElementById('search-tab-users').addEventListener('click', () => {
            searchTab = 'users';
            render(container, state);
            performUserSearch(document.getElementById('search-query')?.value || '', state);
        });

        const searchBtn = document.getElementById('search-btn');
        const queryInput = document.getElementById('search-query');

        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                const query = queryInput.value.trim();
                if (searchTab === 'users') {
                    performUserSearch(query, state);
                } else {
                    performSearch(query, null, state);
                }
            });
        }

        if (queryInput) {
            queryInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    searchBtn.click();
                }
            });
        }

        if (searchTab === 'users') {
            performUserSearch(defaultQuery, state);
        } else if (defaultQuery) {
            performSearch(defaultQuery, null, state);
        }
    }

    async function performUserSearch(query, state) {
        const resContainer = document.getElementById('search-results-container');
        if (!resContainer) return;
        if (query) {
            NebulaStorage.recordSearchHistory(state, query, 'pesquisadores');
            const email = (state.current_user || '').toLowerCase().trim();
            const currentHist = getStoredSearchHistory(email);
            const filtered = currentHist.filter(h => (h.query || '').toLowerCase() !== query.toLowerCase());
            saveStoredSearchHistory(email, [{ query, category: 'pesquisadores', timestamp: Date.now() }, ...filtered]);
        }

        resContainer.innerHTML = `<div class="spinner-overlay"><div class="spinner"></div><div style="text-align:center;margin-top:1rem;color:var(--text-white-60)">Buscando pesquisadores na comunidade...</div></div>`;

        const myEmail = (state.current_user || '').toLowerCase().trim();
        let matches = [];
        try {
            matches = await NebulaStorage.searchResearchersAsync(state, query, myEmail, 50);
        } catch (e) {
            console.error('[Search] user search failed:', e);
        }

        const totalRegistered = Object.keys(state.users || {}).filter(e => !e.startsWith('demo_')).length;

        if (!matches.length) {
            resContainer.innerHTML = `<div class="glass" style="padding:2rem; text-align:center; color:var(--text-white-60);">
                Nenhum pesquisador encontrado para "${query || '(todos)'}".<br>
                <span style="font-size:0.85rem;margin-top:0.5rem;display:block;">Total no cache local: ${totalRegistered}. Recarregue com Ctrl+Shift+R se acabou de atualizar o site.</span>
                <button class="btn btn-primary" style="margin-top:1rem;" onclick="PageSearch.render(document.getElementById('pageContainer'), NebulaApp.getState())">Recarregar pesquisadores</button>
            </div>`;
            return;
        }

        resContainer.innerHTML = `
            <div class="glass mb-1">
                <div class="section-title">Pesquisadores Encontrados (${matches.length}) · ${totalRegistered} cadastrados</div>
                <div style="margin-top:1rem;">
                    ${matches.map(m => renderUserCard(m.email, { name: m.name, research: m.research, photo: m.photo }, state.current_user, m.similarity, m.connection_points)).join('')}
                </div>
            </div>
        `;
    }

    async function performSearch(query, imageFile, state) {
        const resContainer = document.getElementById('search-results-container');
        if (!resContainer) return;
        if (query) {
            NebulaStorage.recordSearchHistory(state, query, 'artigos');
            const email = (state.current_user || '').toLowerCase().trim();
            const currentHist = getStoredSearchHistory(email);
            const filtered = currentHist.filter(h => (h.query || '').toLowerCase() !== query.toLowerCase());
            saveStoredSearchHistory(email, [{ query, category: 'artigos', timestamp: Date.now() }, ...filtered]);
        }

        resContainer.innerHTML = `<div class="spinner-overlay"><div class="spinner"></div><div style="text-align:center;margin-top:1rem;color:var(--text-white-60)">Consultando bases acadêmicas...</div></div>`;

        const intentData = TextEngine.recognizeIntent(query || 'pesquisa geral');
        const email = state.current_user;

        let webResults = [];
        try {
            webResults = await SearchEngine.fetchSearchResults(state, email, query, 12);
        } catch (e) { console.error(e); }

        const localResults = DocumentEngine.localSearch(query, state.repository || []);
        const rankedLocal = localResults.slice(0, 6);

        let html = `
            <div class="glass mb-1">
                <div class="section-title">Resultados para «${query.replace(/</g, '&lt;')}»</div>
                <div class="grid-2">
                    <div><b>Intenção:</b> ${intentData.intent}</div>
                    <div><b>Resultados:</b> ${webResults.length} acadêmicos · ${rankedLocal.length} locais</div>
                </div>
            </div>

            <div class="grid-2 mb-1">
                <div class="glass">
                    <div class="section-title">Documentos Locais (${rankedLocal.length})</div>
                    ${!rankedLocal.length ? `<div class="small-muted">Nenhum documento local correspondeu.</div>` : rankedLocal.map(d => `
                        <div class="doc-card">
                            <b>${d.name}</b><br>
                            <span class="small-muted">${d.topic} · relevância ${d.score}%</span>
                        </div>
                    `).join('')}
                </div>
                <div class="glass">
                    <div class="section-title">Artigos Acadêmicos Globais (${webResults.length})</div>
                    ${!webResults.length ? `<div class="small-muted">Nenhum artigo encontrado.</div>` : webResults.slice(0, 8).map(a => renderArticleCard(a, true)).join('')}
                </div>
            </div>
        `;

        resContainer.innerHTML = html;
    }

    function quickTerm(term) {
        const input = document.getElementById('search-query');
        if (input) input.value = term;
        if (searchTab === 'users') {
            performUserSearch(term, NebulaApp.getState());
        } else {
            performSearch(term, null, NebulaApp.getState());
        }
    }

    function clearHistory() {
        const state = NebulaApp.getState();
        const email = (state.current_user || '').toLowerCase().trim();
        state.search_history = [];
        try {
            localStorage.removeItem('nebula_search_history_v3_' + email);
            localStorage.removeItem('nebula_search_history_v2_' + email);
        } catch {}
        if (state.workspaces && state.workspaces[email]) {
            state.workspaces[email].search_history = [];
        }
        NebulaStorage.saveState(state);
        render(document.getElementById('pageContainer'), state);
    }

    return { render, quickTerm, clearHistory };
})();

/* ============================================================
   PAGE: SMART SEARCH
   ============================================================ */
const PageSearch = (() => {
    function render(container, state) {
        let defaultQuery = state.quick_query || '';
        state.quick_query = ''; // clear it

        let html = `
            <div class="page-title">Pesquisa Inteligente</div>
            <div class="page-sub">Busca unificada com análise de intenção, resultados locais e artigos da internet correlacionados</div>
            
            <div class="grid-60-40">
                <div class="input-group">
                    <textarea id="search-query" class="textarea" placeholder="Ex: redes neurais para classificação de imagens médicas...">${defaultQuery}</textarea>
                </div>
                <div class="input-group">
                    <label class="input-label">Imagem (opcional)</label>
                    <div class="file-drop" id="search-img-drop" onclick="document.getElementById('search-img-input').click()">
                        <span id="search-img-name">Clique ou arraste uma imagem (.png, .jpg, .webp)</span>
                        <input type="file" id="search-img-input" accept=".png,.jpg,.jpeg,.webp">
                    </div>
                </div>
            </div>
            <button class="btn btn-primary btn-full mb-1" id="search-btn">Executar pesquisa</button>
            <div id="search-results-container"></div>
        `;

        container.innerHTML = html;

        let selectedImage = null;
        const imgDrop = document.getElementById('search-img-drop');
        const imgInput = document.getElementById('search-img-input');
        const imgName = document.getElementById('search-img-name');

        imgInput.addEventListener('change', (e) => {
            if (e.target.files.length) {
                selectedImage = e.target.files[0];
                imgName.textContent = selectedImage.name;
            }
        });

        document.getElementById('search-btn').addEventListener('click', () => {
            const query = document.getElementById('search-query').value.trim();
            if (!query && !selectedImage) {
                alert('Digite uma consulta ou envie uma imagem.');
                return;
            }
            performSearch(query, selectedImage, state);
        });
    }

    async function performSearch(query, imageFile, state) {
        const resContainer = document.getElementById('search-results-container');
        resContainer.innerHTML = `<div class="spinner-overlay"><div class="spinner"></div></div>`;

        const intentData = TextEngine.recognizeIntent(query || 'imagem científica');
        
        // Update user interest
        const email = state.current_user;
        if (email) {
            intentData.search_terms.forEach(t => {
                if (t.length >= 3) {
                    state.user_interest[email][t] = (state.user_interest[email][t] || 0) + 1;
                }
            });
            // Sort and trim to top 60
            const sortedInterest = Object.entries(state.user_interest[email]).sort((a,b) => b[1] - a[1]).slice(0, 60);
            state.user_interest[email] = Object.fromEntries(sortedInterest);
            
            state.search_history.push({
                query: query,
                time: new Date().toISOString().slice(0, 16).replace('T', ' '),
                intent: intentData.intent,
                topic: intentData.topic
            });
            NebulaStorage.saveState(state);
        }

        let html = `
            <div class="glass">
                <div class="section-title">Análise da sua busca</div>
                <div class="grid-3 mb-1">
                    <div class="info-box"><b>Intenção:</b> ${intentData.intent}</div>
                    <div class="info-box"><b>Tema:</b> ${intentData.topic}</div>
                    <div class="info-box"><b>Termos:</b> ${intentData.keywords.slice(0, 5).join(', ')}</div>
                </div>
                <div>${intentData.search_terms.map(t => `<span class="tag">${t}</span>`).join('')}</div>
            </div>
        `;

        const searchQuery = intentData.search_terms.slice(0, 6).join(' ') || query;
        let webResults = [];
        try {
            webResults = await SearchEngine.searchSemanticScholar(searchQuery, 8);
            if (webResults.length < 4) {
                const cr = await SearchEngine.searchCrossref(searchQuery, 4);
                webResults = webResults.concat(cr);
            }
        } catch (e) {
            console.error(e);
        }

        const localResults = DocumentEngine.localSearch(query, state.repository || []);

        html += `
            <div class="glass" id="ai-recs-container" style="margin-bottom: 1rem; border: 1px solid rgba(217, 119, 74, 0.4);">
                <div class="section-title"><span style="color:#d9774a; margin-right:8px;">✦</span> Recomendações da IA (Llama 3.3)</div>
                <div id="ai-recs-content" style="padding: 0.5rem 0;">
                    <div class="spinner-overlay" style="position:relative; min-height:40px; background:transparent;"><div class="spinner"></div></div>
                </div>
            </div>
        `;

        html += `<div class="grid-2">`;
        
        // Local Results
        html += `<div>
            <div class="glass">
                <div class="section-title">Nos seus documentos</div>
                ${!localResults.length ? `<div class="small-muted">Nenhum documento local correspondeu. Envie arquivos no Repositório.</div>` : ''}
                ${localResults.slice(0, 6).map(doc => `
                    <div class="doc-card">
                        <b>${doc.name}</b><br>
                        <span class="small-muted">${doc.kind} · ${doc.topic} · relevância ${doc.score}%</span>
                        <div class="sim-bar-wrap"><div class="sim-bar-fill" style="width:${Math.min(doc.score, 100)}%"></div></div>
                        <div style="margin-top:0.5rem;font-size:0.82rem;color:#cbd5e1">${(doc.summary||'').slice(0, 200)}</div>
                    </div>
                `).join('')}
            </div>
        </div>`;

        // Web Results
        html += `<div>
            <div class="glass">
                <div class="section-title">Artigos na internet</div>
                ${!webResults.length ? `<div class="small-muted">Não foi possível recuperar artigos agora.</div>` : ''}
                ${webResults.slice(0, 7).map(art => `
                    <div class="article-card">
                        <div class="article-title">${art.url ? `<a href="${art.url}" target="_blank">${art.title}</a>` : art.title}</div>
                        <div class="article-meta">${art.authors} · ${art.year} · ${art.source} · ${art.citations} cit.</div>
                        <div class="article-abstract">${art.abstract.slice(0, 220)}...</div>
                    </div>
                `).join('')}
            </div>
        </div>`;

        html += `</div>`; // end grid

        // External links
        const qEnc = encodeURIComponent(searchQuery);
        html += `
            <div class="glass">
                <div class="section-title">Continuar pesquisando</div>
                <div class="grid-3">
                    <a href="https://scholar.google.com/scholar?q=${qEnc}" target="_blank" style="color:#93c5fd;text-decoration:none">Google Scholar</a>
                    <a href="https://www.semanticscholar.org/search?q=${qEnc}" target="_blank" style="color:#93c5fd;text-decoration:none">Semantic Scholar</a>
                    <a href="https://www.google.com/search?tbm=isch&q=${qEnc}" target="_blank" style="color:#93c5fd;text-decoration:none">Imagens Google</a>
                </div>
            </div>
        `;

        // Image Search Contextual Info
        if (imageFile) {
            const fileNameLower = imageFile.name.toLowerCase();
            const localMatches = state.repository.filter(d => 
                (d.text && d.text.toLowerCase().includes(fileNameLower.split('.')[0])) || 
                (d.name && d.name.toLowerCase().includes(fileNameLower.split('.')[0]))
            );
            
            let localText = `<div class="small-muted">Nenhum vínculo imediato dessa imagem com seus documentos armazenados.</div>`;
            if (localMatches.length > 0) {
                localText = `<div style="color:var(--copper-1); font-weight:500;">Esta imagem pode estar relacionada a ${localMatches.length} documento(s) do seu cofre (ex: ${localMatches[0].name}).</div>`;
            }

            const encName = encodeURIComponent(imageFile.name.split('.')[0]);

            html += `
                <div class="glass">
                    <div class="section-title">Contexto e Busca Reversa da Imagem</div>
                    <div class="grid-60-40">
                        <div>
                            <p class="small-muted mb-1" style="font-size:0.85rem;">
                                O sistema procurou por conexões textuais e metadados atrelados ao arquivo <b>${imageFile.name}</b> dentro do seu repositório local.
                            </p>
                            <div class="mb-1">${localText}</div>
                            
                            <div class="notice-box">
                                Para analisar o conteúdo exato da foto (ex: "Metrô Rio"), utilize a Busca Reversa oficial do Google Lens.
                            </div>
                            
                            <a href="https://lens.google.com/upload?ep=ccm" target="_blank" class="btn btn-primary btn-sm" style="text-decoration:none;">Abrir Google Lens</a>
                            <a href="https://www.google.com/search?tbm=isch&q=${encName}" target="_blank" class="btn btn-sm" style="text-decoration:none; margin-left:0.5rem;">Buscar nome no Google</a>
                        </div>
                        <div style="text-align:right;">
                            <img src="${URL.createObjectURL(imageFile)}" style="max-width:100%; max-height:200px; border-radius:14px; border:1px solid rgba(255,255,255,0.1);">
                        </div>
                    </div>
                </div>
            `;
        }

        resContainer.innerHTML = html;

        // Fetch AI Recommendations asynchronously
        if (email && state.users[email]) {
            const userResearch = state.users[email].research || 'Pesquisa acadêmica geral';
            const aiPrompt = [
                { role: 'system', content: 'Você é um assistente acadêmico especialista. A partir da linha de pesquisa do usuário e de sua busca atual, recomende de 2 a 3 artigos científicos altamente específicos e reais que ele deveria ler. Retorne APENAS HTML válido (use <ul>, <li>, <b>). Seja direto, sem texto introdutório.' },
                { role: 'user', content: `Linha de Pesquisa do Usuário: ${userResearch}\nBusca Atual: ${query}\n\nPor favor, recomende artigos com título, autor(es) e uma breve justificativa de relevância.` }
            ];
            
            NebulaAI.chatWithAI(aiPrompt).then(res => {
                const aiContent = document.getElementById('ai-recs-content');
                if (aiContent) {
                    let cleanRes = res.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '');
                    aiContent.innerHTML = `<div style="font-size:0.95rem; line-height:1.6; color:var(--text-white-80);">${cleanRes}</div>`;
                }
            }).catch(err => {
                const aiContent = document.getElementById('ai-recs-content');
                if (aiContent) aiContent.innerHTML = `<div class="small-muted">Não foi possível carregar as recomendações da IA no momento.</div>`;
            });
        }
    }

    return { render };
})();

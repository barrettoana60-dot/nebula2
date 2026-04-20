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

        // Image Search Info
        if (imageFile) {
            const imgMeta = await DocumentEngine.analyzeImage(imageFile);
            html += `
                <div class="glass">
                    <div class="section-title">Análise visual da imagem enviada</div>
                    <div class="metric-grid mb-1">
                        <div class="metric-card blue"><div class="metric-label">Largura</div><div class="metric-value">${imgMeta.width || '?'}px</div></div>
                        <div class="metric-card cyan"><div class="metric-label">Altura</div><div class="metric-value">${imgMeta.height || '?'}px</div></div>
                        <div class="metric-card green"><div class="metric-label">Brilho</div><div class="metric-value">${imgMeta.brightness || '?'}</div></div>
                    </div>
                    <img src="${URL.createObjectURL(imageFile)}" style="max-width:100%; border-radius:14px; margin-top:0.5rem;">
                </div>
            `;
        }

        resContainer.innerHTML = html;
    }

    return { render };
})();

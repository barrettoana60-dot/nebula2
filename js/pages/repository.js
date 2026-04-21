/* ============================================================
   PAGE: REPOSITORY
   ============================================================ */
const PageRepository = (() => {
    function render(container, state) {
        let html = `
            <div class="page-title">Repositório</div>
            <div class="page-sub">Envie seus documentos para análise completa: texto, palavras-chave, resumo, estrutura e conexões</div>
            
            <div class="glass">
                <div class="file-drop" id="repo-drop" onclick="document.getElementById('repo-file-input').click()">
                    <span id="repo-file-name">Clique ou arraste arquivos (PDF, DOCX, CSV, Imagens, etc.)</span>
                    <input type="file" id="repo-file-input" multiple accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.py,.json">
                </div>

                <div class="grid-2 mt-1">
                    <div class="input-group" style="margin-bottom:0">
                        <label class="input-label">Visibilidade</label>
                        <select class="select" id="repo-visibility" style="background:rgba(0,0,0,0.4)">
                            <option value="private">Privado (somente você)</option>
                            <option value="public">Público (visível para outros)</option>
                        </select>
                    </div>
                    <div class="input-group" id="repo-expiry-group" style="display:none;margin-bottom:0">
                        <label class="input-label">Público até</label>
                        <input type="date" class="input" id="repo-public-until" style="background:rgba(0,0,0,0.4)">
                    </div>
                </div>

                <button class="btn btn-primary btn-full mt-1" id="repo-add-btn">Analisar e adicionar</button>
                <div class="progress-wrap" style="display:none" id="repo-progress-wrap">
                    <div class="progress-fill" id="repo-progress-fill" style="width:0%"></div>
                </div>
                <div id="repo-progress-text" class="small-muted" style="text-align:center;margin-top:0.4rem;display:none"></div>
            </div>

            <div id="repo-list-container"></div>
        `;

        container.innerHTML = html;
        renderList(document.getElementById('repo-list-container'), state);

        // Visibility toggle
        const visSelect = document.getElementById('repo-visibility');
        const expiryGroup = document.getElementById('repo-expiry-group');
        visSelect.addEventListener('change', () => {
            expiryGroup.style.display = visSelect.value === 'public' ? 'block' : 'none';
        });

        let selectedFiles = [];
        const fileInput = document.getElementById('repo-file-input');
        fileInput.addEventListener('change', (e) => {
            selectedFiles = Array.from(e.target.files);
            document.getElementById('repo-file-name').textContent = `${selectedFiles.length} arquivo(s) selecionado(s)`;
        });

        document.getElementById('repo-add-btn').addEventListener('click', async () => {
            if (!selectedFiles.length) { alert('Selecione arquivos primeiro.'); return; }
            
            const btn = document.getElementById('repo-add-btn');
            const wrap = document.getElementById('repo-progress-wrap');
            const fill = document.getElementById('repo-progress-fill');
            const txt = document.getElementById('repo-progress-text');
            const visibility = document.getElementById('repo-visibility').value;
            const publicUntil = document.getElementById('repo-public-until').value || null;
            
            btn.disabled = true;
            wrap.style.display = 'block';
            txt.style.display = 'block';

            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                fill.style.width = `${((i) / selectedFiles.length) * 100}%`;
                txt.textContent = `Analisando ${file.name}...`;
                
                try {
                    const record = await DocumentEngine.makeDocumentRecord(file);
                    record.visibility = visibility;
                    record.public_until = visibility === 'public' ? publicUntil : null;
                    state.repository.push(record);
                    
                    // Update user interest
                    const email = state.current_user;
                    if (email) {
                        record.keywords.slice(0, 12).forEach(t => {
                            state.user_interest[email][t] = (state.user_interest[email][t] || 0) + 1;
                        });
                    }
                } catch (e) {
                    console.error('Failed to process', file.name, e);
                }
            }

            NebulaStorage.saveState(state);
            btn.disabled = false;
            wrap.style.display = 'none';
            txt.style.display = 'none';
            selectedFiles = [];
            fileInput.value = '';
            document.getElementById('repo-file-name').textContent = 'Clique ou arraste arquivos (PDF, DOCX, CSV, Imagens, etc.)';
            renderList(document.getElementById('repo-list-container'), state);
        });
    }

    function renderList(container, state) {
        const docs = state.repository || [];
        if (!docs.length) {
            container.innerHTML = `<div class="small-muted">Seu repositório está vazio. Envie documentos acima.</div>`;
            return;
        }

        let html = `
            <div class="glass">
                <div class="section-title">Documentos catalogados</div>
                <div class="input-group">
                    <input type="text" class="input" id="repo-search" placeholder="Filtrar por nome, tema, autor ou palavra-chave...">
                </div>
                <div id="repo-docs"></div>
                <button class="btn btn-danger btn-full mt-1" id="repo-clear-btn">Limpar repositório</button>
            </div>
        `;

        container.innerHTML = html;

        const docsContainer = document.getElementById('repo-docs');
        const searchInput = document.getElementById('repo-search');

        const renderDocs = (query) => {
            let filtered = docs;
            if (query) {
                filtered = DocumentEngine.localSearch(query, docs);
            }

            docsContainer.innerHTML = filtered.slice(0, 50).map((doc, idx) => {
                const related = DocumentEngine.relatedDocuments(doc, docs, 4);
                let relHtml = '';
                if (related.length) {
                    relHtml = `<div class="mt-1"><b>Documentos relacionados:</b><br>` + related.map(r => `
                        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.35rem">
                            <span style="font-size:0.8rem;color:#e2e8f0;flex:1">${(r.name||'').slice(0, 45)}</span>
                            <span style="font-size:0.75rem;color:#94a3c0">${r.similarity}%</span>
                        </div>
                        <div class="sim-bar-wrap"><div class="sim-bar-fill" style="width:${Math.min(r.similarity, 100)}%"></div></div>
                    `).join('') + `</div>`;
                }

                let secHtml = '';
                if (doc.sections && Object.keys(doc.sections).length) {
                    secHtml = `<div class="mt-1"><b>Seções detectadas:</b><br>` + Object.entries(doc.sections).map(([name, txt]) => `
                        <div class="small-muted" style="margin-bottom:0.4rem"><i>${name}:</i> ${txt.slice(0, 200)}...</div>
                    `).join('') + `</div>`;
                }

                const visIcon = doc.visibility === 'public' ? 'Público' : 'Privado';
                const visStyle = doc.visibility === 'public' ? 'color:#10b981' : 'color:var(--text-white-60)';
                const expiryText = doc.public_until ? ` até ${doc.public_until}` : '';

                return `
                    <div class="expander">
                        <div class="expander-header" onclick="this.parentElement.classList.toggle('open')">
                            <span><b>${doc.name}</b> · ${doc.kind} · ${doc.topic} <span style="font-size:0.75rem;${visStyle};margin-left:0.5rem">${visIcon}</span></span>
                            <span class="arrow">▶</span>
                        </div>
                        <div class="expander-body">
                            <div class="grid-60-40 mt-1">
                                <div>
                                    <div class="mb-1"><b>Resumo:</b><br><span class="small-muted">${doc.summary}</span></div>
                                    <div class="mb-1"><b>Palavras-chave:</b><br>${(doc.keywords||[]).slice(0, 18).map(k => `<span class="tag">${k}</span>`).join('')}</div>
                                    ${secHtml}
                                </div>
                                <div>
                                    <div class="glass-sm">
                                        <div class="metric-label">Metadados</div>
                                        <table class="data-table" style="width:100%;margin-top:0.4rem;border:none">
                                            <tr><td>Autor</td><td>${(doc.author||'Desconhecido').slice(0, 60)}</td></tr>
                                            <tr><td>Ano</td><td>${doc.year||'?'}</td></tr>
                                            <tr><td>Idioma</td><td>${doc.language||'?'}</td></tr>
                                            <tr><td>Tamanho</td><td>${doc.size_kb||'?'} KB</td></tr>
                                            <tr><td>Origem</td><td>${doc.nationality||'Desconhecido'}</td></tr>
                                            <tr><td>Palavras</td><td>${doc.readability?.words||'?'}</td></tr>
                                            <tr><td>Páginas est.</td><td>${doc.readability?.estimated_pages||'?'}</td></tr>
                                            <tr><td>Leitura</td><td>${doc.readability?.reading_time_min||'?'} min</td></tr>
                                            <tr><td>Referências</td><td>${doc.ref_count||'0'}</td></tr>
                                        </table>
                                        <div style="margin-top:0.5rem;font-size:0.7rem;${visStyle}">${visIcon}${expiryText}</div>
                                    </div>
                                    ${relHtml}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        };

        renderDocs('');
        searchInput.addEventListener('input', (e) => renderDocs(e.target.value));

        document.getElementById('repo-clear-btn').addEventListener('click', () => {
            if (confirm('Tem certeza que deseja apagar todos os documentos deste repositório?')) {
                state.repository = [];
                NebulaStorage.ensureWorkspace(state, state.current_user).repository = [];
                NebulaStorage.saveState(state);
                NebulaApp.navigate('Repositório');
            }
        });
    }

    return { render };
})();

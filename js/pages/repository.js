/* ============================================================
   PAGE: REPOSITORY
   ============================================================ */
const PageRepository = (() => {
    function render(container, state) {
        state.current_folder = null; // Reset folder path when entering Repository
        let html = `
            <div class="page-title">Repositório</div>

            <div class="repo-upload-card" id="repo-upload-container">
                <div class="repo-upload-bar" id="repo-drop" onclick="document.getElementById('repo-file-input').click()">
                    <div class="repo-upload-bar-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    </div>
                    <span class="repo-upload-bar-text" id="repo-file-name">Clique ou arraste arquivos aqui</span>
                    <input type="file" id="repo-file-input" multiple accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp,.py,.json">
                </div>

                <div class="repo-upload-meta">
                    <div class="repo-vis-group">
                        <span class="repo-vis-label">Visibilidade</span>
                        <div class="repo-vis-pills">
                            <button type="button" class="repo-vis-pill active" id="vis-private" onclick="PageRepository.setVisibility('private', this)">Privado</button>
                            <button type="button" class="repo-vis-pill" id="vis-public" onclick="PageRepository.setVisibility('public', this)">Público</button>
                        </div>
                    </div>
                    <div id="repo-expiry-group" style="display:none; margin-top: 0.75rem;">
                        <label class="input-label" style="font-size:0.78rem;">Público até</label>
                        <input type="date" class="input" id="repo-public-until" style="margin-top:0.35rem;">
                    </div>
                </div>

                <button class="repo-upload-btn" id="repo-add-btn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg>
                    Analisar e adicionar
                </button>
                <div class="progress-wrap" style="display:none" id="repo-progress-wrap">
                    <div class="progress-fill" id="repo-progress-fill" style="width:0%"></div>
                </div>
                <div id="repo-progress-text" class="small-muted" style="text-align:center;margin-top:0.5rem;display:none"></div>
            </div>

            <input type="hidden" id="repo-visibility" value="private">
            <div id="repo-list-container"></div>
        `;

        container.innerHTML = html;
        renderList(document.getElementById('repo-list-container'), state);

        // Drag and drop support
        const dropZone = document.getElementById('repo-drop');
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = 'var(--color-blue)';
            dropZone.style.background = 'rgba(59, 130, 246, 0.05)';
        });
        dropZone.addEventListener('dragleave', () => {
            dropZone.style.borderColor = '';
            dropZone.style.background = '';
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.borderColor = '';
            dropZone.style.background = '';
            const files = Array.from(e.dataTransfer.files);
            if (files.length) {
                selectedFiles = files;
                document.getElementById('repo-file-name').textContent = `${files.length} arquivo(s) selecionado(s)`;
            }
        });

        // Visibility toggle (via pills)
        // setVisibility is exposed on the module return; handled below

        let selectedFiles = [];
        const fileInput = document.getElementById('repo-file-input');
        fileInput.addEventListener('change', (e) => {
            selectedFiles = Array.from(e.target.files);
            const nameEl = document.getElementById('repo-file-name');
            if (selectedFiles.length === 1) {
                nameEl.textContent = selectedFiles[0].name;
            } else {
                nameEl.textContent = `${selectedFiles.length} arquivo(s) selecionado(s)`;
            }
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
            btn.innerHTML = 'Processando...';
            wrap.style.display = 'block';
            txt.style.display = 'block';

            const email = state.current_user;
            const userResearch = (email && state.users[email]) ? state.users[email].research : null;

            const pendingDocs = [];
            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];
                const baseProgress = (i / selectedFiles.length) * 100;
                fill.style.width = `${baseProgress}%`;
                txt.textContent = `Processando ${file.name}...`;
                
                try {
                    const record = await DocumentEngine.makeDocumentRecord(file, (stage) => {
                        txt.textContent = `${file.name}: ${stage}`;
                    }, userResearch);
                    
                    txt.textContent = `${file.name}: Analisando com IA (Llama 3.3)...`;
                    const aiResult = await NebulaAI.analyzeDocument(record.text, record.name, record.kind, userResearch);
                    if (aiResult) {
                        record.title = aiResult.title || record.name;
                        record.author = aiResult.author || record.author;
                        record.topic = aiResult.topic || record.topic;
                        record.year = aiResult.year || record.year;
                        record.summary = aiResult.summary || record.summary;
                        if (aiResult.keywords && aiResult.keywords.length) {
                            record.keywords = [...new Set([...(record.keywords||[]), ...aiResult.keywords])];
                        }
                        record.deep_insight = aiResult.insight;
                        record.ai_analyzed = true;
                    }

                    record.visibility = visibility;
                    record.public_until = visibility === 'public' ? publicUntil : null;
                    pendingDocs.push(record);
                } catch (e) {
                    console.error('Failed to process', file.name, e);
                    txt.textContent = `Erro ao processar ${file.name}`;
                }
            }

            fill.style.width = '100%';
            txt.textContent = 'Processamento concluído. Aguardando revisão...';
            
            // Build Review UI
            wrap.style.display = 'none';
            txt.style.display = 'none';
            btn.style.display = 'none'; // Hide add button temporarily
            
            const reviewContainer = document.createElement('div');
            reviewContainer.id = 'repo-review-container';
            reviewContainer.className = 'glass mt-1';
            
            let currentReviewIndex = 0;
            
            const renderReview = () => {
                if (currentReviewIndex >= pendingDocs.length) {
                    // All reviewed, save state
                    finishUpload();
                    return;
                }
                const doc = pendingDocs[currentReviewIndex];
                reviewContainer.innerHTML = `
                    <div class="section-title" style="border:none; padding:0; margin-bottom:1rem;">
                        Revisar Documento (${currentReviewIndex + 1} de ${pendingDocs.length})
                    </div>
                    <div class="input-group">
                        <label class="input-label">Título do Documento</label>
                        <input type="text" class="input" id="rev-name" value="${doc.name}">
                    </div>
                    <div class="grid-50-50" style="gap:1rem;">
                        <div class="input-group">
                            <label class="input-label">Autor(es)</label>
                            <input type="text" class="input" id="rev-author" value="${doc.author || ''}">
                        </div>
                        <div class="input-group">
                            <label class="input-label">Ano</label>
                            <input type="text" class="input" id="rev-year" value="${doc.year || ''}">
                        </div>
                    </div>
                    <div class="input-group">
                        <label class="input-label">Tópico principal</label>
                        <input type="text" class="input" id="rev-topic" value="${doc.topic || ''}">
                    </div>
                    <div class="input-group">
                        <label class="input-label">Palavras-chave (separadas por vírgula)</label>
                        <input type="text" class="input" id="rev-keywords" value="${(doc.keywords||[]).join(', ')}">
                    </div>
                    <div class="input-group">
                        <label class="input-label">Resumo</label>
                        <textarea class="input" id="rev-summary" style="height:100px; resize:vertical;">${doc.summary || ''}</textarea>
                    </div>
                    <div style="display:flex; gap:1rem; margin-top:1rem;">
                        <button class="btn btn-primary" id="rev-confirm-btn" style="flex:1">Confirmar e Salvar</button>
                        <button class="btn btn-danger" id="rev-discard-btn" style="flex:1">Descartar Arquivo</button>
                    </div>
                `;
                
                document.getElementById('rev-confirm-btn').addEventListener('click', () => {
                    doc.name = document.getElementById('rev-name').value;
                    doc.author = document.getElementById('rev-author').value;
                    doc.year = document.getElementById('rev-year').value;
                    doc.topic = document.getElementById('rev-topic').value;
                    doc.keywords = document.getElementById('rev-keywords').value.split(',').map(s => s.trim()).filter(s => s);
                    doc.summary = document.getElementById('rev-summary').value;
                    
                    // Checar se o autor tem o mesmo nome do usuário logado
                    const email = state.current_user;
                    const userName = (state.users[email]?.name || '').toLowerCase().trim();
                    const authorLower = (doc.author || '').toLowerCase().trim();
                    if (userName && authorLower && (authorLower.includes(userName) || userName.includes(authorLower))) {
                        doc.topic = 'Produção Autoral';
                        doc.is_authorial = true;
                    }

                    state.repository.push(doc);
                    
                    // Update user interest
                    if (email) {
                        if (!state.user_interest[email]) state.user_interest[email] = {};
                        doc.keywords.slice(0, 12).forEach(t => {
                            state.user_interest[email][t] = (state.user_interest[email][t] || 0) + 1;
                        });
                    }
                    
                    currentReviewIndex++;
                    renderReview();
                });
                
                document.getElementById('rev-discard-btn').addEventListener('click', () => {
                    currentReviewIndex++;
                    renderReview();
                });
            };
            
            document.getElementById('repo-upload-container').appendChild(reviewContainer);
            renderReview();
            
            async function finishUpload() {
                reviewContainer.remove();
                btn.style.display = 'block';
                btn.disabled = true;
                btn.innerHTML = 'Salvando no banco de dados...';
                
                try {
                    await NebulaStorage.saveStateAsync(state);
                } catch (saveErr) {
                    console.error('Save failed, data is in local state:', saveErr);
                }

                btn.disabled = false;
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="20 6 9 17 4 12"/></svg> Analisar e adicionar';
                
                selectedFiles = [];
                fileInput.value = '';
                document.getElementById('repo-file-name').textContent = 'Arraste ou clique para enviar';
                renderList(document.getElementById('repo-list-container'), state);
            }
            
            setTimeout(() => {
                wrap.style.display = 'none';
                txt.style.display = 'none';
                txt.style.color = '';
            }, 2500);
            
            selectedFiles = [];
            fileInput.value = '';
            document.getElementById('repo-file-name').textContent = 'Clique ou arraste arquivos (PDF, DOCX, CSV, Imagens, etc.)';
            renderList(document.getElementById('repo-list-container'), state);
        });
    }

    function renderList(container, state) {
        const docs = state.repository || [];
        
        // Define navigation helpers
        window._navigateFolder = (folderName) => {
            state.current_folder = folderName;
            renderList(container, state);
        };

        window._deleteRepositoryDoc = async (id) => {
            if (confirm('Tem certeza que deseja excluir este arquivo do seu repositório? Essa ação não pode ser desfeita.')) {
                state.repository = state.repository.filter(d => d.id !== id);
                await NebulaStorage.saveStateAsync(state);
                renderList(container, state);
            }
        };

        if (!docs.length) {
            container.innerHTML = `<div class="small-muted" style="text-align:center; padding:3rem 0">Seu repositório está vazio. Envie documentos acima.</div>`;
            return;
        }

        // Helper to hash and get folder colors
        function getFolderColors(folderName) {
            const colors = [
                { c1: '#f97316', c2: '#ea580c' }, // Orange
                { c1: '#3b82f6', c2: '#1d4ed8' }, // Blue
                { c1: '#ef4444', c2: '#b91c1c' }, // Red
                { c1: '#eab308', c2: '#ca8a04' }  // Yellow
            ];
            let hash = 0;
            for (let i = 0; i < folderName.length; i++) {
                hash = folderName.charCodeAt(i) + ((hash << 5) - hash);
            }
            const index = Math.abs(hash) % colors.length;
            return colors[index];
        }

        // If no folder is selected, render folders (Google Drive View)
        if (!state.current_folder) {
            // Group by topic
            const foldersMap = {};
            docs.forEach(doc => {
                const topic = (doc.topic || 'Geral').trim();
                if (!foldersMap[topic]) {
                    foldersMap[topic] = {
                        name: topic,
                        docs: [],
                        totalSize: 0
                    };
                }
                foldersMap[topic].docs.push(doc);
                foldersMap[topic].totalSize += doc.size_kb || 0;
            });

            const folders = Object.values(foldersMap);

            let html = `
                <div class="glass">
                    <div class="section-title">Pastas do Repositório</div>
                    <p class="small-muted mb-1.5">Seus arquivos estão categorizados automaticamente por tópicos de pesquisa.</p>
                    <div class="folder-grid">
            `;

            folders.forEach(folder => {
                const colors = getFolderColors(folder.name);
                const escName = folder.name.replace(/"/g, '&quot;');
                html += `
                    <div class="folder-card" data-folder="${escName}">
                        <!-- Top banner with colorful gradient -->
                        <div class="folder-card-cover" style="background: linear-gradient(135deg, ${colors.c1}, ${colors.c2});">
                            <div style="position: absolute; inset: 0; background: radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 60%);"></div>
                            <!-- Folder icon and tagline -->
                            <div style="position: absolute; bottom: 10px; left: 14px; display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 1.5rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">📁</span>
                            </div>
                            <div style="position: absolute; top: 10px; right: 12px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.95); background: rgba(0,0,0,0.22); padding: 2px 8px; border-radius: 20px; backdrop-filter: blur(6px);">PASTA</div>
                        </div>
                        
                        <!-- Folder body (light glass) -->
                        <div class="folder-card-body">
                            <div>
                                <div style="font-weight: 700; font-size: 1rem; color: var(--text-white); line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${folder.name}">${folder.name}</div>
                                <div style="font-size: 0.74rem; color: var(--text-white-60); margin-top: 0.2rem;">Pesquisa Científica</div>
                            </div>
                            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.65rem; border-top: 1px solid rgba(0,0,0,0.07);">
                                <div style="font-size: 1.1rem; font-weight: 800; color: var(--text-white);">${folder.docs.length.toString().padStart(2, '0')} <span style="font-size: 0.78rem; font-weight: 400; color: var(--text-white-60);">Doc${folder.docs.length === 1 ? '' : 's'}</span></div>
                                <div style="font-size: 0.76rem; font-weight: 500; color: var(--text-white-60);">${Math.round(folder.totalSize)} KB</div>
                            </div>
                        </div>
                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;

            container.innerHTML = html;

            // Attach folder click listener (safe from quote-escaping bugs)
            const grid = container.querySelector('.folder-grid');
            if (grid) {
                grid.addEventListener('click', (e) => {
                    const card = e.target.closest('.folder-card');
                    if (card) {
                        const folderName = card.getAttribute('data-folder');
                        if (folderName) {
                            window._navigateFolder(folderName);
                        }
                    }
                });
            }
            return;
        }

        // Inside a selected folder:
        const folderDocs = docs.filter(doc => (doc.topic || 'Geral').trim() === state.current_folder);

        let html = `
            <div class="glass">
                <div class="drive-breadcrumbs">
                    <span class="drive-breadcrumbs-item" onclick="window._navigateFolder(null)">Repositório</span>
                    <span class="drive-breadcrumbs-sep">/</span>
                    <span class="drive-breadcrumbs-item active">${state.current_folder}</span>
                </div>
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:0.75rem;">
                    <div style="font-size:0.9rem; color:var(--text-white-60);">${folderDocs.length} arquivo${folderDocs.length === 1 ? '' : 's'} nesta pasta</div>
                    <button class="btn btn-sm" onclick="window._navigateFolder(null)">← Voltar para Pastas</button>
                </div>

                <div class="input-group">
                    <input type="text" class="input" id="repo-search" placeholder="Filtrar nesta pasta por nome, autor ou palavra-chave...">
                </div>

                <div class="file-grid" id="repo-docs"></div>
                
                <button class="btn btn-danger btn-full mt-1.5" id="repo-clear-folder-btn">Excluir todos desta pasta</button>
            </div>
        `;

        container.innerHTML = html;

        const docsContainer = document.getElementById('repo-docs');
        const searchInput = document.getElementById('repo-search');

        const renderDocs = (query) => {
            let filtered = folderDocs;
            if (query) {
                filtered = DocumentEngine.localSearch(query, folderDocs);
            }

            if (!filtered.length) {
                docsContainer.innerHTML = `<div class="small-muted" style="grid-column: 1 / -1; text-align: center; padding: 2rem;">Nenhum documento corresponde ao filtro.</div>`;
                return;
            }

            docsContainer.innerHTML = filtered.map((doc) => {
                const visIcon = doc.visibility === 'public' ? 'Público' : 'Privado';
                const visStyle = doc.visibility === 'public' ? 'color:#10b981' : 'color:var(--text-white-60)';

                return `
                    <div class="file-card">
                        <div>
                            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:0.5rem;">
                                <span style="font-size:0.72rem; text-transform:uppercase; color:var(--color-blue); font-weight:700; letter-spacing:0.05em">${doc.document_type || doc.kind || 'DOCUMENTO'}</span>
                                <span style="font-size:0.7rem; ${visStyle}">${visIcon}</span>
                            </div>
                            <div class="file-card-title" title="${doc.name}">${doc.name}</div>
                            <div class="file-card-meta">
                                ${doc.author ? `Autor: ${doc.author.slice(0, 30)}` : 'Autor Desconhecido'} ${doc.year ? `(${doc.year})` : ''}
                            </div>
                            <p style="font-size:0.78rem; color:var(--text-white-80); display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; margin-bottom:0.75rem; line-height:1.45">
                                ${doc.summary || 'Sem resumo disponível.'}
                            </p>
                        </div>

                        <div class="file-card-actions">
                            <button class="btn btn-blue" onclick="window._openDocumentReader('${doc.id}')">Ler</button>
                            <button class="btn" onclick="window._reanalyzeWithHighlights('${doc.id}', this)">Reanalizar</button>
                            <button class="btn btn-red" onclick="window._deleteRepositoryDoc('${doc.id}')">Excluir</button>
                        </div>
                    </div>
                `;
            }).join('');
        };

        // Live filtering
        searchInput?.addEventListener('input', (e) => {
            renderDocs(e.target.value.trim());
        });

        // Initial render
        renderDocs('');

        // Action: clear folder
        document.getElementById('repo-clear-folder-btn')?.addEventListener('click', async () => {
            if (confirm(`Tem certeza que deseja excluir todos os ${folderDocs.length} arquivos da pasta "${state.current_folder}"? Esta ação não pode ser desfeita.`)) {
                state.repository = docs.filter(doc => (doc.topic || 'Geral').trim() !== state.current_folder);
                state.current_folder = null;
                await NebulaStorage.saveStateAsync(state);
                renderList(container, state);
            }
        });

        // ─── EXPORTAR PDF (OPCIONAL COM MARCA D'ÁGUA LOGO NEBULA) ─────────
        window._exportDocPDF = async (docId, withWatermark = true) => {
            const doc = state.repository.find(d => d.id === docId);
            if (!doc) return;

            if (typeof window.jspdf === 'undefined' && typeof jsPDF === 'undefined') {
                alert('Biblioteca jsPDF não carregada. Recarregue a página e tente novamente.'); return;
            }
            const { jsPDF } = window.jspdf || window;

            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
            const W = pdf.internal.pageSize.getWidth();
            const H = pdf.internal.pageSize.getHeight();
            const margin = 20;
            const contentW = W - margin * 2;

            // ── Helper: load nebula-logo.png as base64 ──────────────────
            const logoDataUrl = await new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    try {
                        const c = document.createElement('canvas');
                        c.width = img.naturalWidth || img.width || 300;
                        c.height = img.naturalHeight || img.height || 300;
                        const cx = c.getContext('2d');
                        cx.drawImage(img, 0, 0);
                        resolve(c.toDataURL('image/png'));
                    } catch(e) { resolve(null); }
                };
                img.onerror = () => resolve(null);
                img.src = 'nebula-logo.png?' + Date.now();
            });

            function addWatermarks(pageCount) {
                if (!logoDataUrl) return;
                // Create a semi-transparent version of the logo via canvas
                const wmCanvas = document.createElement('canvas');
                wmCanvas.width = 300; wmCanvas.height = 300;
                const wmCtx = wmCanvas.getContext('2d');
                const wmImg = new Image();
                wmImg.src = logoDataUrl;
                wmCtx.globalAlpha = 0.07;
                try { wmCtx.drawImage(wmImg, 0, 0, 300, 300); } catch(e) { return; }
                const wmDataUrl = wmCanvas.toDataURL('image/png');
                for (let p = 1; p <= pageCount; p++) {
                    pdf.setPage(p);
                    // Center logo watermark (semi-transparent)
                    try { pdf.addImage(wmDataUrl, 'PNG', W/2 - 28, H/2 - 28, 56, 56); } catch(e) {}
                }
            }

            function addHeader(titleText) {
                // Top accent line
                pdf.setDrawColor(59, 130, 246);
                pdf.setLineWidth(0.5);
                pdf.line(margin, 12, W - margin, 12);

                pdf.setFont('helvetica', 'bold');
                pdf.setFontSize(9);
                pdf.setTextColor(59, 130, 246);
                pdf.text('NEBULA RESEARCH', margin, 9);
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(8);
                pdf.setTextColor(148, 163, 184);
                pdf.text(titleText.slice(0, 60), W/2, 9, { align: 'center' });

                const now = new Date().toLocaleDateString('pt-BR');
                pdf.text(now, W - margin, 9, { align: 'right' });
            }

            function addFooter(pageNum, totalPages) {
                pdf.setDrawColor(59, 130, 246);
                pdf.setLineWidth(0.3);
                pdf.line(margin, H - 11, W - margin, H - 11);
                pdf.setFont('helvetica', 'normal');
                pdf.setFontSize(8);
                pdf.setTextColor(148, 163, 184);
                pdf.text('Documento protegido — Nebula Research', margin, H - 7);
                pdf.text(`Página ${pageNum} / ${totalPages}`, W - margin, H - 7, { align: 'right' });
            }

            // ── PAGE 1: Cover ─────────────────────────────────────────────
            addHeader(doc.name);

            // Big logo centered on cover — use actual PNG
            if (logoDataUrl) {
                try { pdf.addImage(logoDataUrl, 'PNG', W/2 - 22, 22, 44, 44); } catch(e) {}
            }

            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(20);
            pdf.setTextColor(249, 115, 22);
            pdf.text('NEBULA RESEARCH', W/2, 76, { align: 'center' });

            pdf.setDrawColor(249, 115, 22); pdf.setLineWidth(0.4);
            pdf.line(margin + 20, 80, W - margin - 20, 80);

            pdf.setFontSize(15); pdf.setTextColor(255, 255, 255);
            const titleLines = pdf.splitTextToSize(doc.name, contentW - 20);
            pdf.text(titleLines, W/2, 92, { align: 'center' });

            let cy = 92 + titleLines.length * 8 + 6;
            pdf.setFontSize(10); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(148, 163, 184);
            pdf.text(`Autor: ${doc.author || 'Desconhecido'}   ·   Ano: ${doc.year || '?'}   ·   Tópico: ${doc.topic || '?'}`, W/2, cy, { align: 'center' });
            cy += 6;
            pdf.text(`Idioma: ${doc.language || '?'}   ·   Tipo: ${doc.document_type || doc.kind || '?'}   ·   Origem: ${doc.nationality || '?'}`, W/2, cy, { align: 'center' });

            cy += 12;
            pdf.setDrawColor(71, 85, 105); pdf.setLineWidth(0.2);
            pdf.line(margin + 10, cy, W - margin - 10, cy); cy += 8;

            if (doc.summary) {
                pdf.setFontSize(10); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(249, 115, 22);
                pdf.text('RESUMO', margin, cy); cy += 5;
                pdf.setFont('helvetica', 'normal'); pdf.setTextColor(226, 232, 240);
                const sumLines = pdf.splitTextToSize(doc.summary, contentW);
                pdf.text(sumLines, margin, cy); cy += sumLines.length * 5 + 4;
            }
            if (doc.key_findings) {
                pdf.setFont('helvetica', 'bold'); pdf.setTextColor(249, 115, 22); pdf.setFontSize(10);
                pdf.text('PRINCIPAIS ACHADOS', margin, cy); cy += 5;
                pdf.setFont('helvetica', 'normal'); pdf.setTextColor(226, 232, 240);
                const kfLines = pdf.splitTextToSize(doc.key_findings, contentW);
                pdf.text(kfLines, margin, cy); cy += kfLines.length * 5 + 4;
            }
            if (doc.keywords && doc.keywords.length) {
                pdf.setFont('helvetica', 'bold'); pdf.setTextColor(249, 115, 22); pdf.setFontSize(9);
                pdf.text('PALAVRAS-CHAVE:', margin, cy); cy += 4;
                pdf.setFont('helvetica', 'normal'); pdf.setTextColor(148, 163, 184);
                pdf.text(doc.keywords.slice(0, 20).join(' · '), margin, cy); cy += 6;
            }
            if (doc.deep_insight) {
                cy += 2;
                pdf.setFont('helvetica', 'bold'); pdf.setTextColor(249, 115, 22); pdf.setFontSize(10);
                pdf.text('ANÁLISE (Llama 3.3)', margin, cy); cy += 5;
                pdf.setFont('helvetica', 'italic'); pdf.setTextColor(203, 213, 225);
                const diLines = pdf.splitTextToSize(doc.deep_insight, contentW);
                pdf.text(diLines, margin, cy);
            }

            // ── PAGE 2+: Full document text ─────────────────────────────
            const fullText = doc.text || '';
            if (fullText.trim().length > 0) {
                pdf.addPage();
                addHeader(doc.name);

                pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12);
                pdf.setTextColor(249, 115, 22);
                pdf.text('TEXTO COMPLETO DO DOCUMENTO', margin, 20);
                pdf.setDrawColor(59, 130, 246); pdf.setLineWidth(0.3);
                pdf.line(margin, 22, W - margin, 22);

                pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(241, 245, 249);

                const lh = 4.5;
                let textY = 28;
                const maxY = H - 18;

                const allLines = pdf.splitTextToSize(fullText, contentW);
                let pageLines = [];
                allLines.forEach(line => {
                    if (textY + lh > maxY) {
                        const currPage = pdf.internal.getCurrentPageInfo().pageNumber;
                        addFooter(currPage, '?');
                        pdf.addPage();
                        addHeader(doc.name);
                        textY = 20;
                    }
                    pdf.text(line, margin, textY);
                    textY += lh;
                });
            }

            // ── PAGE: Highlights (Fichamento) ─────────────────────────────
            if (doc.highlights && doc.highlights.length > 0) {
                pdf.addPage();
                addHeader(doc.name);
                pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(249, 115, 22);
                pdf.text('FICHAMENTO / DESTAQUES DO PESQUISADOR', margin, 20);
                pdf.setDrawColor(59, 130, 246); pdf.setLineWidth(0.3);
                pdf.line(margin, 22, W - margin, 22);

                let hy = 28;
                doc.highlights.forEach((h, i) => {
                    if (hy > H - 30) {
                        const cp = pdf.internal.getCurrentPageInfo().pageNumber;
                        addFooter(cp, '?');
                        pdf.addPage(); addHeader(doc.name); hy = 20;
                    }
                    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(249, 115, 22);
                    pdf.text(`[Pág. ${h.page}]  ${h.timestamp || ''}`, margin, hy); hy += 4;
                    pdf.setFont('helvetica', 'italic'); pdf.setFontSize(9); pdf.setTextColor(226, 232, 240);
                    const hLines = pdf.splitTextToSize(`"${h.text}"`, contentW - 4);
                    pdf.text(hLines, margin + 2, hy); hy += hLines.length * 4.5;
                    if (h.comment) {
                        pdf.setFont('helvetica', 'normal'); pdf.setTextColor(148, 163, 184);
                        const cLines = pdf.splitTextToSize('→ ' + h.comment, contentW - 4);
                        pdf.text(cLines, margin + 4, hy); hy += cLines.length * 4.5;
                    }
                    hy += 3;
                });
            }

            // ── Watermarks & footers on all pages ────────────────────────
            const totalPages = pdf.internal.getNumberOfPages();
            if (withWatermark) {
                addWatermarks(totalPages);
            }
            for (let p = 1; p <= totalPages; p++) {
                pdf.setPage(p);
                addFooter(p, totalPages);
            }

            // Download
            const safeName = doc.name.replace(/[^a-zA-Z0-9\u00C0-\u024F ]/g, '_').trim().slice(0, 50);
            pdf.save(`${safeName} — Nebula Research.pdf`);
        };

        window._reanalyzeWithHighlights = async (docId, btnElement) => {
            if (!state || !state.repository) {
                console.error('[Reanalyze] State or repository is undefined');
                return;
            }
            const doc = state.repository.find(d => d.id === docId);
            if (!doc) {
                console.error('[Reanalyze] Document not found:', docId);
                return;
            }

            const originalText = btnElement.innerHTML;
            btnElement.disabled = true;
            btnElement.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite; vertical-align: middle; margin-right: 4px; display: inline-block;">
                    <circle cx="12" cy="12" r="10" stroke-dasharray="30" stroke-dashoffset="10"/>
                </svg> Analisando...`;

            try {
                const email = state.current_user;
                const userResearch = (email && state.users && state.users[email]) ? state.users[email].research : null;
                
                const aiResult = await NebulaAI.analyzeDocument(doc.text, doc.name, doc.kind, userResearch, doc.highlights);
                
                if (aiResult) {
                    doc.title = aiResult.title || doc.name || doc.title;
                    doc.author = aiResult.author || doc.author || 'Desconhecido';
                    doc.topic = aiResult.topic || doc.topic || 'Geral';
                    doc.year = aiResult.year || doc.year || null;
                    doc.summary = aiResult.summary || doc.summary || '';
                    doc.language = aiResult.language || doc.language || 'Português';
                    doc.nationality = aiResult.nationality || doc.nationality || 'Desconhecido';
                    doc.document_type = aiResult.document_type || doc.document_type || 'Documento';
                    doc.key_findings = aiResult.key_findings || doc.key_findings || '';
                    doc.methodology = aiResult.methodology || doc.methodology || '';
                    doc.deep_insight = aiResult.deep_insight || doc.deep_insight || '';
                    
                    // Bulletproof keywords merging
                    let existingKeywords = [];
                    if (Array.isArray(doc.keywords)) {
                        existingKeywords = doc.keywords;
                    } else if (typeof doc.keywords === 'string') {
                        existingKeywords = doc.keywords.split(',').map(s => s.trim()).filter(Boolean);
                    }
                    
                    let newKeywords = [];
                    if (aiResult.keywords && Array.isArray(aiResult.keywords)) {
                        newKeywords = aiResult.keywords;
                    } else if (aiResult.keywords && typeof aiResult.keywords === 'string') {
                        newKeywords = aiResult.keywords.split(',').map(s => s.trim()).filter(Boolean);
                    }
                    
                    doc.keywords = [...new Set([...existingKeywords, ...newKeywords])];
                    doc.ai_analyzed = true;

                    try {
                        await NebulaStorage.saveStateAsync(state);
                    } catch (saveErr) {
                        console.warn('[Reanalyze] saveStateAsync failed:', saveErr);
                    }
                    
                    if (typeof PageProfile !== 'undefined' && typeof PageProfile.showToast === 'function') {
                        try {
                            PageProfile.showToast('Reanalisado!', 'Ficha reanalisada com sucesso com base nos seus destaques.');
                        } catch (toastErr) {
                            alert('Ficha reanalisada com sucesso com base nos seus destaques!');
                        }
                    } else {
                        alert('Ficha reanalisada com sucesso com base nos seus destaques!');
                    }

                    try {
                        const readerModal = document.getElementById('nebula-reader-modal');
                        if (readerModal) {
                            const headerSub = readerModal.querySelector('div[style*="font-size:0.8rem;"]');
                            if (headerSub) {
                                headerSub.innerHTML = `Autor: ${doc.author || 'Desconhecido'} · Ano: ${doc.year || '?'} · Tópico: ${doc.topic}`;
                            }
                        }
                    } catch (modalErr) {
                        console.warn('[Reanalyze] Modal update failed:', modalErr);
                    }
                    
                    try {
                        const listContainer = document.getElementById('repo-list-container');
                        if (listContainer && typeof renderList === 'function') {
                            renderList(listContainer, state);
                        }
                        const readerModal = document.getElementById('nebula-reader-modal');
                        if (readerModal && readerModal.style.display !== 'none') {
                            const metaEl = readerModal.querySelector('[data-doc-meta]');
                            if (metaEl) {
                                metaEl.textContent = `Autor: ${doc.author || 'Desconhecido'} · Ano: ${doc.year || '?'} · Tópico: ${doc.topic || 'Geral'}`;
                            }
                        }
                    } catch (renderErr) {
                        console.warn('[Reanalyze] renderList failed:', renderErr);
                    }
                } else {
                    alert('Falha na reanálise da IA. Verifique se o documento possui texto legível e tente novamente.');
                }
            } catch (err) {
                console.error('[Reanalyze] Error:', err);
                alert(`Erro ao reanalisar: ${err.message || 'Verifique sua conexão e tente novamente.'}`);
            } finally {
                btnElement.disabled = false;
                btnElement.innerHTML = originalText;
            }
        };

        window._openDocumentReader = (docId) => {
            const doc = state.repository.find(d => d.id === docId);
            if (!doc) return;

            // Initialize pages — preserve original PDF pages when available
            if (!doc.pages || !doc.pages.length || !doc.pages.some(p => (p.text || '').trim())) {
                doc.pages = [];
                const rawText = doc.text || '';
                const pageSize = 4000;
                let offset = 0;
                let pageNum = 1;
                while (offset < rawText.length) {
                    let end = Math.min(offset + pageSize, rawText.length);
                    if (end < rawText.length) {
                        const nextBreak = rawText.indexOf('\n\n', end - 200);
                        if (nextBreak !== -1 && nextBreak - end < 400) end = nextBreak;
                        else {
                            const nextSpace = rawText.indexOf(' ', end);
                            if (nextSpace !== -1 && nextSpace - end < 120) end = nextSpace;
                        }
                    }
                    doc.pages.push({ number: pageNum++, text: rawText.slice(offset, end).trim() });
                    offset = end;
                }
                if (!doc.pages.length) doc.pages.push({ number: 1, text: rawText });
            }
            if (!doc.highlights) doc.highlights = [];

            let currentPageIndex = 0;
            let currentTab = 'pages'; // 'pages' or 'highlights'

            // Create Modal Overlay
            const modal = document.createElement('div');
            modal.id = 'nebula-reader-modal';
            modal.style.cssText = `
                position: fixed; inset: 0; background: rgba(218, 200, 179, 0.98); 
                backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); 
                z-index: 100000; display: flex; flex-direction: column; 
                color: var(--text-white); font-family: 'Inter', sans-serif;
                animation: fadeIn 0.25s ease;
            `;

            // Append CSS keyframes dynamically if not present
            if (!document.getElementById('reader-animations-style')) {
                const style = document.createElement('style');
                style.id = 'reader-animations-style';
                style.innerHTML = `
                    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                    @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                    .reader-sidebar-btn {
                        width: 100%; text-align: left; padding: 0.8rem 1rem; 
                        background: rgba(218, 200, 179, 0.3); border: 1px solid rgba(0, 0, 0, 0.08);
                        border-radius: 10px; color: var(--text-white-80); cursor: pointer;
                        font-size: 0.9rem; transition: all 0.18s; margin-bottom: 0.4rem;
                        display: flex; justify-content: space-between; align-items: center;
                    }
                    .reader-sidebar-btn:hover {
                        background: rgba(218, 200, 179, 0.65); color: var(--text-white);
                    }
                    .reader-sidebar-btn.active {
                        background: rgba(59, 130, 246, 0.15); border-color: rgba(59, 130, 246, 0.4);
                        color: var(--color-blue); font-weight: 600;
                    }
                    .highlight-item {
                        background: rgba(218, 200, 179, 0.3); border: 1px solid rgba(0, 0, 0, 0.08);
                        border-radius: 12px; padding: 0.8rem; margin-bottom: 0.6rem; font-size: 0.85rem;
                        position: relative; transition: all 0.2s; color: var(--text-white-80);
                    }
                    .highlight-item:hover {
                        background: rgba(218, 200, 179, 0.55);
                    }
                    .highlight-item-delete {
                        color: #dc2626; cursor: pointer; float: right; margin-left: 0.5rem;
                        border: none; background: transparent; font-size: 0.9rem; opacity: 0.6;
                        transition: opacity 0.15s;
                    }
                    .highlight-item-delete:hover { opacity: 1; }
                    .abnt-sheet {
                        max-width: 210mm; width: 100%;
                        height: auto; min-height: auto;
                        background: #faf9f6; color: #1a1a1a;
                        border: 1px solid rgba(0,0,0,0.08); border-radius: 4px;
                        padding: 3cm 2cm 2cm 3cm;
                        font-family: 'Times New Roman', Times, serif;
                        font-size: 12pt; line-height: 1.5;
                        outline: none; box-shadow: 0 15px 50px rgba(0,0,0,0.6);
                        user-select: text; -webkit-user-select: text;
                        word-wrap: break-word; overflow-wrap: break-word;
                        box-sizing: border-box;
                        align-self: flex-start;
                        margin-bottom: 3rem;
                    }
                    #reader-scroll-zone {
                        align-items: flex-start !important;
                    }
                    .abnt-title {
                        text-align: center; font-weight: bold; font-size: 14pt;
                        margin: 0 0 1.2em 0; text-indent: 0; color: #111;
                        line-height: 1.4;
                    }
                    .abnt-author {
                        text-align: center; font-size: 12pt; margin: 0 0 2em 0;
                        text-indent: 0; color: #333;
                    }
                    .abnt-section {
                        font-weight: bold; text-align: left; text-indent: 0;
                        margin: 1.6em 0 0.6em 0; font-size: 12pt; color: #111;
                    }
                    .abnt-paragraph {
                        text-align: justify; text-indent: 1.25cm;
                        margin: 0 0 0.35em 0; font-size: 12pt; line-height: 1.5;
                        color: #1a1a1a;
                    }
                    .abnt-paragraph.no-indent { text-indent: 0; }
                    .abnt-list-item {
                        text-align: justify; margin: 0.3em 0 0.3em 1.25cm;
                        line-height: 1.5; list-style-type: disc;
                    }
                    .abnt-ref-item {
                        text-align: justify; text-indent: 0; margin: 0 0 0.5em 0;
                        padding-left: 1.25cm; text-indent: -1.25cm;
                        font-size: 12pt; line-height: 1.5;
                    }
                    .nebula-reader-highlight {
                        background: rgba(59, 130, 246, 0.35) !important;
                        border-bottom: 2px solid #3b82f6; color: inherit;
                        padding: 1px 2px; border-radius: 2px; cursor: pointer;
                    }
                `;
                document.head.appendChild(style);
            }

            modal.innerHTML = `
                <!-- TOP BAR -->
                <div style="display:flex; justify-content:space-between; align-items:center; padding:1.2rem 2rem; border-bottom:1px solid rgba(0,0,0,0.08); background:rgba(218,200,179,0.7);">
                    <div>
                        <div style="font-size:1.15rem; font-weight:700; color:var(--text-white);">${doc.name}</div>
                        <div style="font-size:0.8rem; color:var(--text-white-60); margin-top:0.2rem;">
                            Autor: ${doc.author || 'Desconhecido'} · Ano: ${doc.year || '?'} · Tópico: ${doc.topic}
                        </div>
                    </div>
                    <button id="reader-close-btn" style="background:rgba(218,200,179,0.5); border:1px solid rgba(0,0,0,0.12); color:var(--text-white); border-radius:50%; width:38px; height:38px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:1.1rem; transition:all 0.18s;">✕</button>
                </div>

                <!-- MAIN WORKSPACE -->
                <div style="display:flex; flex:1; overflow:hidden;">
                    <!-- SIDEBAR -->
                    <div style="width:320px; border-right:1px solid rgba(0,0,0,0.08); display:flex; flex-direction:column; background:rgba(218,200,179,0.4); overflow:hidden;">
                        <!-- TABS -->
                        <div style="display:flex; border-bottom:1px solid rgba(0,0,0,0.06); background:rgba(0,0,0,0.03);">
                            <button id="reader-tab-pages" style="flex:1; padding:1rem; background:transparent; border:none; border-bottom:2px solid var(--color-blue); color:var(--text-white); font-weight:600; cursor:pointer; font-size:0.9rem;">Páginas</button>
                            <button id="reader-tab-highlights" style="flex:1; padding:1rem; background:transparent; border:none; border-bottom:2px solid transparent; color:var(--text-white-60); cursor:pointer; font-size:0.9rem;">Destaques (${doc.highlights.length})</button>
                        </div>
                        
                        <!-- TAB CONTENT -->
                        <div id="reader-sidebar-content" style="flex:1; overflow-y:auto; padding:1.2rem;">
                            <!-- Will be filled dynamically -->
                        </div>
                    </div>

                    <!-- READER PANE -->
                    <div style="flex:1; display:flex; flex-direction:column; background:#c3b7a1; overflow:hidden; position:relative;">
                        <!-- READING ZONE -->
                        <div style="flex:1; overflow-y:auto; display:flex; justify-content:center; align-items:flex-start; padding:3rem 2rem;" id="reader-scroll-zone">
                            <!-- Paper sheet simulation -->
                            <div id="reader-content-sheet" class="abnt-sheet">
                                <!-- Rendered page content (ABNT) -->
                            </div>
                        </div>

                        <!-- PAGINATION FOOTER -->
                        <div style="display:flex; justify-content:space-between; align-items:center; padding:0.8rem 2rem; border-top:1px solid rgba(0,0,0,0.08); background:rgba(218,200,179,0.6); gap:1rem; flex-wrap:wrap;">
                            <button id="reader-prev-btn" style="padding:0.55rem 1.1rem; background:rgba(218,200,179,0.5); border:1px solid rgba(0,0,0,0.12); border-radius:10px; color:var(--text-white); cursor:pointer; font-weight:500; transition:all 0.18s;">◀ Anterior</button>
                            <div style="display:flex; align-items:center; gap:0.6rem;">
                                <span id="reader-page-indicator" style="font-size:0.9rem; font-weight:600; color:var(--text-white-80);">Página 1 de 1</span>
                                <span style="color:var(--text-white-60); font-size:0.85rem;">| Ir para:</span>
                                <input id="reader-page-jump" type="number" min="1" style="width:60px; background:rgba(218,200,179,0.4); border:1px solid rgba(0,0,0,0.12); border-radius:7px; color:var(--text-white); padding:0.3rem 0.5rem; font-size:0.85rem; text-align:center; outline:none;" placeholder="#">
                            </div>
                            <button id="reader-next-btn" style="padding:0.55rem 1.1rem; background:rgba(218,200,179,0.5); border:1px solid rgba(0,0,0,0.12); border-radius:10px; color:var(--text-white); cursor:pointer; font-weight:500; transition:all 0.18s;">Próxima ▶</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Floating Highlight Popover
            let highlightTooltip = null;

            const hideTooltip = () => {
                if (highlightTooltip) {
                    highlightTooltip.remove();
                    highlightTooltip = null;
                }
            };

            const loadSidebar = () => {
                const container = document.getElementById('reader-sidebar-content');
                if (!container) return;

                if (currentTab === 'pages') {
                    container.innerHTML = doc.pages.map((p, idx) => `
                        <button class="reader-sidebar-btn ${idx === currentPageIndex ? 'active' : ''}" onclick="window._readerGoToPage(${p.number})">
                            <span>Página ${p.number}</span>
                            <span style="font-size:0.75rem; opacity:0.6;">${p.text.length} caracteres</span>
                        </button>
                    `).join('');
                } else {
                    const badge = document.getElementById('reader-tab-highlights');
                    if (badge) badge.textContent = `Destaques (${doc.highlights.length})`;

                    const btnDisabled = doc.highlights.length === 0 ? 'disabled style="opacity: 0.5; cursor: not-allowed; width:100%; font-size:0.8rem; padding:0.5rem; background:transparent; border:1px solid rgba(249,115,22,0.2); color:var(--text-white-60); margin-bottom:1rem;"' : 'style="width:100%; font-size:0.8rem; padding:0.5rem; background:transparent; border:1px solid rgba(249,115,22,0.4); color:var(--color-orange); font-weight:600; margin-bottom:1rem; cursor:pointer;"';
                    const btnHtml = `
                        <button class="btn btn-secondary" ${btnDisabled} onclick="window._reanalyzeWithHighlights('${doc.id}', this)">
                            ✨ Reanalisar com Destaques
                        </button>
                    `;
                    const listHtml = doc.highlights.length === 0 
                        ? `<div class="small-muted" style="text-align:center; margin-top:2rem;">Nenhum destaque salvo neste arquivo.</div>`
                        : doc.highlights.map((h, i) => `
                        <div class="highlight-item">
                            <button class="highlight-item-delete" onclick="window._readerDeleteHighlight(${i})" title="Remover destaque">Remover</button>
                            <div style="font-weight:600; color:var(--color-orange); font-size:0.75rem; margin-bottom:0.3rem;">Pág. ${h.page} · ${h.timestamp}</div>
                            <div style="color:var(--text-white-80); line-height:1.4; font-style:italic; word-break:break-word; overflow-wrap:break-word;">"${h.text.length > 150 ? h.text.slice(0, 150) + '...' : h.text}"</div>
                        </div>
                    `).join('');
                    container.innerHTML = btnHtml + listHtml;
                }
            };

            const loadPage = () => {
                hideTooltip();
                const sheet = document.getElementById('reader-content-sheet');
                const indicator = document.getElementById('reader-page-indicator');
                if (!sheet) return;

                let allPagesHtml = '';
                (doc.pages || []).forEach((pData, idx) => {
                    const pText = pData.text || '';
                    const pNum = pData.number || (idx + 1);
                    allPagesHtml += `
                        <div id="page-block-${pNum}" class="abnt-page-block" style="margin-bottom:2.5rem; padding-bottom:1.5rem; border-bottom:1px dashed rgba(0,0,0,0.15);">
                            <div style="font-size:0.75rem; color:#64748b; font-family:sans-serif; margin-bottom:0.75rem; font-weight:bold; text-align:right;">Página ${pNum} de ${doc.pages.length}</div>
                            ${formatArticleABNT(pText, doc, pNum, doc.highlights, idx === 0)}
                        </div>`;
                });

                sheet.innerHTML = allPagesHtml;
                if (indicator) indicator.textContent = `${doc.pages.length} página(s) · Rolamento Contínuo`;
                loadSidebar();
            };

            const escapeHtml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            const isSectionTitle = (line) => {
                if (!line || line.length > 90) return false;
                if (/^(RESUMO|ABSTRACT|INTRODU[ÇC][ÃA]O|METODOLOGIA|RESULTADOS|DISCUSS[ÃA]O|CONCLUS[ÃA]O|REFER[ÊE]NCIAS|REFERENCES|AGRADECIMENTOS|AP[ÊE]NDICE|SUM[ÁA]RIO)/i.test(line)) return true;
                if (/^\d+(\.\d+)*\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(line)) return true;
                if (line === line.toUpperCase() && /[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]{4,}/.test(line) && line.split(' ').length <= 8) return true;
                return false;
            };

            const isReferenceLine = (line, inRefs) => {
                if (inRefs) return true;
                return /^(REFER[ÊE]NCIAS|REFERENCES|BIBLIOGRAFIA)/i.test(line);
            };

            const formatArticleABNT = (text, docMeta, pageNum, highlights, isFirstPage) => {
                if (!text && !isFirstPage) return '';

                let html = '';
                if (isFirstPage) {
                    const title = (docMeta.title || docMeta.name || '').replace(/\.[^/.]+$/, '');
                    const author = docMeta.author && docMeta.author !== 'Desconhecido' ? docMeta.author : '';
                    const year = docMeta.year || '';
                    html += `<h1 class="abnt-title">${escapeHtml(title)}</h1>`;
                    if (author || year) {
                        html += `<div class="abnt-author">${escapeHtml(author)}${author && year ? ' · ' : ''}${year ? escapeHtml(String(year)) : ''}</div>`;
                    }
                }

                if (!text) return html;

                let cleanText = text.replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2');
                cleanText = cleanText.replace(/\r\n/g, '\n');

                const lines = cleanText.split('\n');
                const blocks = [];
                let currentPara = [];
                let inReferences = false;

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) {
                        if (currentPara.length) {
                            blocks.push({ type: 'paragraph', text: currentPara.join(' ') });
                            currentPara = [];
                        }
                        continue;
                    }

                    if (isReferenceLine(line, false)) {
                        if (currentPara.length) {
                            blocks.push({ type: 'paragraph', text: currentPara.join(' ') });
                            currentPara = [];
                        }
                        inReferences = true;
                        blocks.push({ type: 'section', text: line });
                        continue;
                    }

                    const isListItem = /^[•\-\*–—]\s+/.test(line) || /^\(\w{1,3}\)\s+/.test(line) || /^\d+[\.\)]\s+/.test(line);

                    if (isSectionTitle(line) || isListItem) {
                        if (currentPara.length) {
                            blocks.push({ type: 'paragraph', text: currentPara.join(' ') });
                            currentPara = [];
                        }
                        blocks.push({ type: isListItem ? 'list' : 'section', text: line });
                    } else if (inReferences) {
                        blocks.push({ type: 'reference', text: line });
                    } else {
                        currentPara.push(line);
                    }
                }
                if (currentPara.length) {
                    blocks.push({ type: 'paragraph', text: currentPara.join(' ') });
                }

                html += blocks.map(b => {
                    const escaped = escapeHtml(b.text);
                    if (b.type === 'section') {
                        return `<h2 class="abnt-section">${escaped}</h2>`;
                    }
                    if (b.type === 'list') {
                        return `<li class="abnt-list-item">${escaped.replace(/^[•\-\*–—]\s+/, '').replace(/^\(\w{1,3}\)\s+/, '').replace(/^\d+[\.\)]\s+/, '')}</li>`;
                    }
                    if (b.type === 'reference') {
                        return `<p class="abnt-ref-item">${escaped}</p>`;
                    }
                    return `<p class="abnt-paragraph">${escaped}</p>`;
                }).join('');

                const pageHighlights = (highlights || []).filter(h => h.page === pageNum);
                pageHighlights.sort((a, b) => b.text.length - a.text.length);
                pageHighlights.forEach(h => {
                    const hEscaped = escapeHtml(h.text);
                    const pattern = hEscaped.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                    try {
                        const regex = new RegExp(`(${pattern})`, 'gi');
                        html = html.replace(regex, `<mark class="nebula-reader-highlight">$1</mark>`);
                    } catch (e) {}
                });

                return html;
            };

            // Global modal functions
            window._readerGoToPage = (num) => {
                const el = document.getElementById(`page-block-${num}`);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                }
            };

            window._readerDeleteHighlight = async (index) => {
                if (confirm('Deseja remover este destaque do repositório? (A nota citada no Doc permanecerá intacta).')) {
                    doc.highlights.splice(index, 1);
                    await NebulaStorage.saveStateAsync(state);
                    loadPage();
                }
            };

            // Tabs events
            document.getElementById('reader-tab-pages').addEventListener('click', () => {
                currentTab = 'pages';
                document.getElementById('reader-tab-pages').style.borderBottomColor = 'var(--color-blue)';
                document.getElementById('reader-tab-pages').style.color = 'var(--text-white)';
                document.getElementById('reader-tab-pages').style.fontWeight = '600';
                document.getElementById('reader-tab-highlights').style.borderBottomColor = 'transparent';
                document.getElementById('reader-tab-highlights').style.color = 'var(--text-white-60)';
                loadSidebar();
            });

            document.getElementById('reader-tab-highlights').addEventListener('click', () => {
                currentTab = 'highlights';
                document.getElementById('reader-tab-highlights').style.borderBottomColor = 'var(--color-blue)';
                document.getElementById('reader-tab-highlights').style.color = 'var(--text-white)';
                document.getElementById('reader-tab-highlights').style.fontWeight = '600';
                document.getElementById('reader-tab-pages').style.borderBottomColor = 'transparent';
                document.getElementById('reader-tab-pages').style.color = 'var(--text-white-60)';
                loadSidebar();
            });

            // Navigation events
            document.getElementById('reader-prev-btn').addEventListener('click', () => {
                if (currentPageIndex > 0) { currentPageIndex--; loadPage(); }
            });
            document.getElementById('reader-next-btn').addEventListener('click', () => {
                if (currentPageIndex < doc.pages.length - 1) { currentPageIndex++; loadPage(); }
            });

            // Page jump input
            const pageJumpInput = document.getElementById('reader-page-jump');
            if (pageJumpInput) {
                pageJumpInput.max = doc.pages.length;
                pageJumpInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        const target = parseInt(pageJumpInput.value);
                        if (!isNaN(target)) {
                            window._readerGoToPage(target);
                            pageJumpInput.value = '';
                        }
                    }
                });
            }

            // Close modal event
            const closeModal = () => {
                hideTooltip();
                modal.remove();
                // Clean global window handlers to avoid memory leak
                delete window._readerGoToPage;
                delete window._readerDeleteHighlight;
            };

            document.getElementById('reader-close-btn').addEventListener('click', closeModal);
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });

            // Highlight Tooltip event listener on Selection
            const readingZone = document.getElementById('reader-content-sheet');

            readingZone.addEventListener('mouseup', (e) => {
                setTimeout(() => {
                    const sel = window.getSelection();
                    const selectedText = sel.toString().trim();

                    if (!selectedText || selectedText.length < 3) {
                        hideTooltip();
                        return;
                    }

                    // Ensure selection is inside the reading zone
                    if (!readingZone.contains(sel.anchorNode)) {
                        hideTooltip();
                        return;
                    }

                    hideTooltip();

                    // Find coordinates
                    const range = sel.getRangeAt(0);
                    const rect = range.getBoundingClientRect();

                    highlightTooltip = document.createElement('div');
                    highlightTooltip.id = 'nebula-highlighter-tooltip';
                    highlightTooltip.style.cssText = `
                        position: fixed;
                        top: ${rect.top - 46}px;
                        left: ${rect.left + (rect.width / 2) - 100}px;
                        width: 200px;
                        height: 34px;
                        background: #f97316;
                        color: #fff;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 20px;
                        font-size: 0.8rem;
                        font-weight: 700;
                        cursor: pointer;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.6);
                        z-index: 1000000;
                        transition: transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                        user-select: none;
                        border: 1px solid rgba(0,0,0,0.15);
                        text-align: center;
                    `;
                    highlightTooltip.innerHTML = `<span>Destacar & Enviar Doc</span>`;
                    
                    document.body.appendChild(highlightTooltip);

                    // Add click event to highlighter
                    highlightTooltip.addEventListener('click', (evt) => {
                        evt.stopPropagation();
                        evt.preventDefault();

                        // Hide tooltip
                        hideTooltip();

                        // Create dialog overlay for fichamento
                        const dlg = document.createElement('div');
                        dlg.id = 'nebula-fichamento-dialog';
                        dlg.style.cssText = `
                            position: fixed; inset: 0; background: rgba(139, 115, 85, 0.35); 
                            backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); 
                            z-index: 1000005; display: flex; align-items: center; 
                            justify-content: center; padding: 1rem;
                            animation: fadeIn 0.2s ease;
                        `;
                        dlg.innerHTML = `
                            <div style="background:rgba(218, 200, 179, 0.96); border:1px solid rgba(0, 0, 0, 0.15); border-radius:20px; padding:2rem; max-width:500px; width:100%; box-shadow:0 25px 70px rgba(0,0,0,0.15); animation: slideUp 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.15);">
                                <h3 style="color:var(--text-white) !important; margin-top:0; margin-bottom:1rem; font-size:1.2rem; display:flex; align-items:center; gap:0.5rem; border:none; padding:0;">
                                    Fichamento / Citação
                                </h3>
                                
                                <div style="font-size:0.75rem; color:var(--text-white-60); margin-bottom:0.4rem; font-weight:600;">TRECHO SELECIONADO (PÁG. ${doc.pages[currentPageIndex] ? doc.pages[currentPageIndex].number : 1}):</div>
                                <div style="background:rgba(218, 200, 179, 0.45); border:1px solid rgba(0, 0, 0, 0.08); border-radius:10px; padding:0.8rem; font-size:0.9rem; font-style:italic; color:var(--text-white-80); max-height:120px; overflow-y:auto; margin-bottom:1.2rem; line-height:1.5;">
                                    "${selectedText}"
                                </div>
                                
                                <div class="input-group" style="margin-bottom:1.5rem;">
                                    <label class="input-label" style="font-size:0.75rem; color:var(--text-white-60); margin-bottom:0.4rem; font-weight:600; text-transform:uppercase;">Anotação / Comentário (Opcional):</label>
                                    <textarea id="fichamento-comment" class="textarea" style="width:100%; height:90px; background:rgba(218, 200, 179, 0.3); border:1px solid rgba(0,0,0,0.12); color:var(--text-white); padding:0.8rem; font-size:0.9rem; resize:vertical; outline:none; box-sizing:border-box; line-height:1.5;" placeholder="Insira sua análise ou notas sobre este trecho..."></textarea>
                                </div>

                                <div style="display:flex; gap:1rem;">
                                    <button id="fichamento-cancel" class="btn" style="flex:1; padding:0.8rem; background:rgba(218, 200, 179, 0.5); border:1px solid rgba(0,0,0,0.12); color:var(--text-white); border-radius:10px; cursor:pointer; font-weight:500;">Cancelar</button>
                                    <button id="fichamento-save" class="btn btn-primary" style="flex:1; padding:0.8rem; background:var(--color-blue); border:none; color:#fff; border-radius:10px; cursor:pointer; font-weight:600;">Salvar & Enviar</button>
                                </div>
                            </div>
                        `;
                        document.body.appendChild(dlg);

                        document.getElementById('fichamento-cancel').addEventListener('click', () => {
                            dlg.remove();
                            sel.removeAllRanges();
                        });

                        document.getElementById('fichamento-save').addEventListener('click', async () => {
                            const commentText = document.getElementById('fichamento-comment').value.trim();

                            // Add to doc highlights array
                            doc.highlights.push({
                                text: selectedText,
                                page: doc.pages[currentPageIndex] ? doc.pages[currentPageIndex].number : 1,
                                comment: commentText || null,
                                timestamp: new Date().toLocaleDateString('pt-BR')
                            });

                            // Send quote to Editor Doc (localStorage)
                            const editorKey = `nebula_editor_${state.current_user}`;
                            let editorContent = localStorage.getItem(editorKey) || '';
                            
                            const cleanDocName = doc.name.replace(/\.[^/.]+$/, "");
                            const docAuthor = doc.author && doc.author !== 'Desconhecido' ? doc.author.split(',')[0] : 'Autor Anon';
                            const docYear = doc.year || 'Sem data';

                            let citation = '';
                            if (commentText) {
                                citation = `
                                    <div class="fichamento-card" style="border:1px solid rgba(249,115,22,0.25); background:rgba(249,115,22,0.02); border-radius:12px; padding:1.2rem; margin:1.5rem 0; box-shadow:0 8px 30px rgba(0,0,0,0.15);">
                                        <div style="font-size:0.75rem; color:#f97316; font-weight:700; text-transform:uppercase; margin-bottom:0.6rem; letter-spacing:0.05rem;">Citação da página ${doc.pages[currentPageIndex] ? doc.pages[currentPageIndex].number : 1}</div>
                                        <blockquote style="border-left:3px solid #f97316; background:rgba(0,0,0,0.01); padding:0.8rem 1rem; margin:0 0 1rem 0; border-radius:4px; font-style:italic; color:#1a1d24; font-size:1rem; line-height:1.6;">"${selectedText}"</blockquote>
                                        <div style="font-size:0.75rem; color:#f97316; font-weight:700; text-transform:uppercase; margin-bottom:0.4rem; letter-spacing:0.05rem;">Anotações do pesquisador</div>
                                        <p style="color:#2a2d34; font-size:0.95rem; margin:0; line-height:1.6;">${commentText.replace(/\n/g, '<br>')}</p>
                                        <small style="display:block; margin-top:1rem; color:rgba(26,29,36,0.6); font-size:0.75rem;">Ref: <b>${cleanDocName}</b> (${docAuthor}, ${docYear})</small>
                                    </div><p></p>
                                `;
                            } else {
                                citation = `
                                    <blockquote class="doc-citation" style="border-left:4px solid #f97316; background:rgba(249,115,22,0.06); padding:1rem 1.2rem; margin:1.2rem 0; border-radius:8px; font-style:italic; color:#1a1d24; font-size:1.05rem; line-height:1.7;">"${selectedText}" <br><small style="color:#f97316; font-weight:600; display:block; margin-top:0.5rem; font-style:normal; font-size:0.82rem;">— Citação de: ${cleanDocName} (${docAuthor}, ${docYear}), pág. ${doc.pages[currentPageIndex] ? doc.pages[currentPageIndex].number : 1}</small></blockquote><p></p>
                                `;
                            }
                            
                            editorContent += citation;
                            localStorage.setItem(editorKey, editorContent);

                            // Save to Supabase (synchronous sync)
                            await NebulaStorage.saveStateAsync(state);

                            // Show success toast
                            if (typeof PageProfile !== 'undefined' && typeof PageProfile.showToast === 'function') {
                                PageProfile.showToast('Destaque Salvo!', 'O trecho foi destacado e enviado para o seu Doc (Editor).');
                            } else {
                                alert('Trecho destacado e enviado para o seu Doc!');
                            }

                            // Remove dialog, clear selection, and reload page HTML
                            dlg.remove();
                            sel.removeAllRanges();
                            loadPage();
                        });
                    });
                }, 50);
            });

            // Initialize Modal Page
            loadPage();
        };



        renderDocs('');
        searchInput.addEventListener('input', (e) => renderDocs(e.target.value));

        document.getElementById('repo-clear-btn').addEventListener('click', () => {
            if (confirm('Tem certeza que deseja apagar todos os documentos deste repositório?')) {
                state.repository = [];
                NebulaStorage.saveState(state);
                NebulaApp.navigate('Repositório');
            }
        });
    }

    function setVisibility(val, btnEl) {
        const hiddenInput = document.getElementById('repo-visibility');
        if (hiddenInput) hiddenInput.value = val;
        const expiryGroup = document.getElementById('repo-expiry-group');
        if (expiryGroup) expiryGroup.style.display = val === 'public' ? 'block' : 'none';
        document.querySelectorAll('.repo-vis-pill').forEach(b => b.classList.remove('active'));
        if (btnEl) btnEl.classList.add('active');
    }

    return { render, setVisibility };
})();

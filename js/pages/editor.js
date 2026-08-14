/* PAGE: EDITOR (Editor de Texto & Mapa Mental) */
const PageEditor = (() => {

    function getDocStorageKey(userEmail) {
        return `nebula_docs_v2_${(userEmail || '').toLowerCase().trim()}`;
    }

    function loadUserDocs(userEmail) {
        try {
            const raw = localStorage.getItem(getDocStorageKey(userEmail));
            const list = JSON.parse(raw || '[]');
            if (Array.isArray(list) && list.length > 0) return list;
        } catch {}
        
        // Fallback or legacy doc
        const legacy = localStorage.getItem(`nebula_editor_${userEmail}`) || '';
        return [{
            id: 'doc_' + Date.now(),
            title: 'Meu Artigo Acadêmico',
            content: legacy || '<h2>Meu Artigo Acadêmico</h2><p>Comece a redigir seu texto científico aqui...</p>',
            updatedAt: new Date().toISOString()
        }];
    }

    function saveUserDocs(userEmail, docs) {
        try {
            localStorage.setItem(getDocStorageKey(userEmail), JSON.stringify(docs));
        } catch {}
    }

    function renderEditor(container, state) {
        const userEmail = (state.current_user || '').toLowerCase().trim();
        let docs = loadUserDocs(userEmail);
        let activeDocId = docs[0]?.id;

        function getActiveDoc() {
            return docs.find(d => d.id === activeDocId) || docs[0];
        }

        container.innerHTML = `
            <div class="glass" style="min-height: 650px; display: flex; flex-direction: column;">
                <div class="section-title" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:0.75rem;">
                    <div style="display:flex; align-items:center; gap:0.75rem; flex-wrap:wrap;">
                        <span style="font-size:1.2rem; font-weight:800; color:var(--text-white);">Editor de Texto</span>
                        <span class="tag tag-copper" style="font-size:0.72rem;">Produção Científica &amp; ABNT</span>
                    </div>
                    <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                        <button class="btn btn-sm btn-primary" id="btn-new-doc" style="gap:0.3rem; font-weight:700;">+ Novo Documento</button>
                        <button class="btn btn-sm btn-blue" id="btn-export-doc">Exportar PDF</button>
                        <button class="btn btn-sm btn-red" id="btn-delete-current-doc" title="Excluir este documento">Excluir</button>
                    </div>
                </div>

                <!-- Barra de Documentos & Título -->
                <div style="display:flex; gap:0.75rem; align-items:center; margin-bottom:1rem; flex-wrap:wrap; background:rgba(218,200,179,0.35); padding:0.6rem 0.9rem; border-radius:12px; border:1px solid rgba(0,0,0,0.06);">
                    <div style="display:flex; align-items:center; gap:0.5rem;">
                        <span style="font-size:0.8rem; font-weight:700; color:var(--text-white-60);">Documento:</span>
                        <select id="doc-switcher" class="select" style="min-width:180px; padding:0.3rem 0.6rem; font-size:0.85rem; height:32px;">
                            ${docs.map(d => `<option value="${d.id}" ${d.id === activeDocId ? 'selected' : ''}>${d.title}</option>`).join('')}
                        </select>
                    </div>
                    <div style="flex:1; min-width:200px; display:flex; align-items:center; gap:0.5rem;">
                        <span style="font-size:0.8rem; font-weight:700; color:var(--text-white-60);">Título:</span>
                        <input type="text" id="doc-title-input" class="input" value="${getActiveDoc().title}" style="height:32px; font-size:0.88rem; font-weight:600;" placeholder="Título do documento...">
                    </div>
                    <div id="doc-metrics-badge" style="font-size:0.75rem; color:var(--text-white-60); margin-left:auto;">
                        0 palavras
                    </div>
                </div>
                
                <div id="editor-toolbar" style="display:flex; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem; padding:0.8rem; background:rgba(0,0,0,0.3); border-radius:16px; border:1px solid var(--glass-border); align-items:center; box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);">
                    
                    <select id="doc-font" class="select" style="width:140px; padding:0.4rem; font-size:0.85rem; min-height:30px; border-radius:8px;">
                        <option value="Arial">Arial</option>
                        <option value="Times New Roman">Times New Roman</option>
                        <option value="Courier New">Courier New</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Verdana">Verdana</option>
                        <option value="Tahoma">Tahoma</option>
                        <option value="Trebuchet MS">Trebuchet MS</option>
                        <option value="Impact">Impact</option>
                    </select>

                    <select id="doc-size" class="select" style="width:120px; padding:0.4rem; font-size:0.85rem; min-height:30px; border-radius:8px;">
                        <option value="1">Minúsculo (1)</option>
                        <option value="2">Pequeno (2)</option>
                        <option value="3" selected>Normal (3)</option>
                        <option value="4">Médio (4)</option>
                        <option value="5">Subtítulo (5)</option>
                        <option value="6">Título (6)</option>
                        <option value="7">Gigante (7)</option>
                    </select>

                    <div style="width:1px; height:24px; background:var(--glass-border); margin:0 0.2rem;"></div>

                    <button class="btn btn-sm format-btn" data-command="bold" title="Negrito" style="min-height:30px; padding:0 0.6rem; font-weight:bold;">B</button>
                    <button class="btn btn-sm format-btn" data-command="italic" title="Itálico" style="min-height:30px; padding:0 0.6rem; font-style:italic;">I</button>
                    <button class="btn btn-sm format-btn" data-command="underline" title="Sublinhado" style="min-height:30px; padding:0 0.6rem; text-decoration:underline;">U</button>
                    <button class="btn btn-sm format-btn" data-command="strikeThrough" title="Tachado" style="min-height:30px; padding:0 0.6rem; text-decoration:line-through;">S</button>
                    
                    <div style="width:1px; height:24px; background:var(--glass-border); margin:0 0.2rem;"></div>
                    
                    <div style="display:flex; align-items:center; gap:0.3rem;">
                        <input type="color" id="doc-color" title="Cor do Texto" style="width:28px; height:28px; border:none; border-radius:4px; background:transparent; cursor:pointer;" value="#1a1d24">
                        <input type="color" id="doc-bg-color" title="Cor de Fundo (Marca-texto)" style="width:28px; height:28px; border:none; border-radius:4px; background:transparent; cursor:pointer;" value="#3b82f6">
                    </div>

                    <div style="width:1px; height:24px; background:var(--glass-border); margin:0 0.2rem;"></div>
                    
                    <button class="btn btn-sm format-btn" data-command="justifyLeft" title="Alinhar Esquerda" style="min-height:30px; padding:0 0.6rem;"> Esq</button>
                    <button class="btn btn-sm format-btn" data-command="justifyCenter" title="Centralizar" style="min-height:30px; padding:0 0.6rem;"> Cen </button>
                    <button class="btn btn-sm format-btn" data-command="justifyRight" title="Alinhar Direita" style="min-height:30px; padding:0 0.6rem;"> Dir </button>
                    <button class="btn btn-sm format-btn" data-command="justifyFull" title="Justificar" style="min-height:30px; padding:0 0.6rem;"> Jus </button>

                    <div style="width:1px; height:24px; background:var(--glass-border); margin:0 0.2rem;"></div>
                    
                    <button class="btn btn-sm format-btn" data-command="insertUnorderedList" title="Lista" style="min-height:30px; padding:0 0.6rem;">Lista</button>
                    <button class="btn btn-sm format-btn" data-command="insertOrderedList" title="Lista Numerada" style="min-height:30px; padding:0 0.6rem;">1. 2.</button>
                    
                    <div style="width:1px; height:24px; background:var(--glass-border); margin:0 0.2rem;"></div>
                    
                    <button class="btn btn-sm format-btn" data-command="undo" title="Desfazer" style="min-height:30px; padding:0 0.6rem;">↩</button>
                    <button class="btn btn-sm format-btn" data-command="redo" title="Refazer" style="min-height:30px; padding:0 0.6rem;">↪</button>
                    <button class="btn btn-sm format-btn" data-command="removeFormat" title="Remover Estilos" style="min-height:30px; padding:0 0.6rem;">Sem Estilo</button>
                    <button class="btn btn-sm" id="btn-clear-doc" title="Apagar Todo o Texto" style="min-height:30px; padding:0 0.6rem; color:#fca5a5; border-color:rgba(239, 68, 68, 0.3);">Limpar Tudo</button>
                </div>
                
                <div id="editor-area" contenteditable="true" style="flex:1; min-height:420px; background:rgba(255,255,255,0.02); border:1px solid var(--glass-border); border-radius:12px; padding:2rem; color:var(--text-white); font-size:1.1rem; line-height:1.8; outline:none; overflow-y:auto; font-family: Arial, sans-serif; box-shadow: inset 0 5px 20px rgba(0,0,0,0.2);">
                    ${getActiveDoc().content}
                </div>
                <div class="small-muted mt-1" id="editor-status" style="text-align:right;">Salvo localmente.</div>
            </div>
        `;

        const area = document.getElementById('editor-area');
        const titleInput = document.getElementById('doc-title-input');
        const docSwitcher = document.getElementById('doc-switcher');
        const metricsBadge = document.getElementById('doc-metrics-badge');

        function updateMetrics() {
            const text = area.innerText || '';
            const words = text.trim() ? text.trim().split(/\s+/).length : 0;
            const chars = text.length;
            if (metricsBadge) metricsBadge.textContent = `${words} palavras · ${chars} caracteres`;
        }

        updateMetrics();

        // Switch doc handler
        docSwitcher.addEventListener('change', (e) => {
            activeDocId = e.target.value;
            const current = getActiveDoc();
            area.innerHTML = current.content;
            titleInput.value = current.title;
            updateMetrics();
            document.getElementById('editor-status').innerText = 'Documento carregado.';
        });

        // Title rename handler
        titleInput.addEventListener('input', () => {
            const current = getActiveDoc();
            current.title = titleInput.value.trim() || 'Sem título';
            current.updatedAt = new Date().toISOString();
            saveUserDocs(userEmail, docs);
            const opt = docSwitcher.querySelector(`option[value="${activeDocId}"]`);
            if (opt) opt.textContent = current.title;
        });

        // New doc button
        document.getElementById('btn-new-doc').addEventListener('click', () => {
            const newTitle = prompt('Nome do novo documento:', 'Novo Documento ' + (docs.length + 1));
            if (newTitle === null) return;
            const newDoc = {
                id: 'doc_' + Date.now(),
                title: newTitle.trim() || 'Novo Documento',
                content: `<h2>${newTitle.trim() || 'Novo Documento'}</h2><p>Comece a escrever aqui...</p>`,
                updatedAt: new Date().toISOString()
            };
            docs.unshift(newDoc);
            activeDocId = newDoc.id;
            saveUserDocs(userEmail, docs);
            renderEditor(container, state);
        });

        // Delete current doc
        document.getElementById('btn-delete-current-doc').addEventListener('click', () => {
            if (docs.length <= 1) {
                if (confirm('Limpar o conteúdo do único documento restante?')) {
                    area.innerHTML = '';
                    const cur = getActiveDoc();
                    cur.content = '';
                    cur.title = 'Documento em Branco';
                    titleInput.value = cur.title;
                    saveUserDocs(userEmail, docs);
                    updateMetrics();
                }
                return;
            }
            if (confirm(`Excluir o documento "${getActiveDoc().title}"?`)) {
                docs = docs.filter(d => d.id !== activeDocId);
                activeDocId = docs[0].id;
                saveUserDocs(userEmail, docs);
                renderEditor(container, state);
            }
        });
        
        // --- Comandos de Formatação ---
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault(); // Impede perda de foco
                const cmd = btn.getAttribute('data-command');
                const val = btn.getAttribute('data-val') || null;
                
                if (cmd === 'removeFormat') {
                    const sel = window.getSelection();
                    if (!sel || sel.isCollapsed) {
                        // Se não tem texto selecionado, seleciona tudo para remover o estilo de tudo
                        const range = document.createRange();
                        range.selectNodeContents(area);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                }

                document.execCommand(cmd, false, val);
                updateToolbarState(); // Atualiza botões imediatamente
            });
        });

        document.getElementById('doc-font').addEventListener('change', (e) => {
            document.execCommand('fontName', false, e.target.value);
            area.focus();
        });

        document.getElementById('doc-size').addEventListener('change', (e) => {
            document.execCommand('fontSize', false, e.target.value);
            area.focus();
        });

        document.getElementById('doc-color').addEventListener('input', (e) => {
            document.execCommand('foreColor', false, e.target.value);
            area.focus();
        });

        document.getElementById('doc-bg-color').addEventListener('input', (e) => {
            document.execCommand('hiliteColor', false, e.target.value);
            area.focus();
        });

        // --- Detector Inteligente de Estado (WOW Factor) ---
        function updateToolbarState() {
            const commands = ['bold', 'italic', 'underline', 'strikeThrough', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull', 'insertUnorderedList', 'insertOrderedList'];
            
            commands.forEach(cmd => {
                const isActive = document.queryCommandState(cmd);
                const btn = document.querySelector(`.format-btn[data-command="${cmd}"]`);
                if (btn) {
                    if (isActive) btn.classList.add('active');
                    else btn.classList.remove('active');
                }
            });

            // Atualizar Selects
            const fontName = document.queryCommandValue('fontName');
            if (fontName) {
                const fontSelect = document.getElementById('doc-font');
                const cleanFont = fontName.replace(/['"]/g, '');
                if (Array.from(fontSelect.options).some(opt => opt.value === cleanFont)) {
                    fontSelect.value = cleanFont;
                }
            }

            const fontSize = document.queryCommandValue('fontSize');
            if (fontSize) {
                const sizeSelect = document.getElementById('doc-size');
                sizeSelect.value = fontSize;
            }
        }

        // Adiciona listeners para atualizar a barra de ferramentas sempre que o cursor mudar ou digitar
        area.addEventListener('keyup', updateToolbarState);
        area.addEventListener('mouseup', updateToolbarState);
        area.addEventListener('click', updateToolbarState);
        document.addEventListener('selectionchange', () => {
            if (document.activeElement === area) {
                updateToolbarState();
            }
        });

        // --- Auto-Save ---
        let timeout;
        area.addEventListener('input', () => {
            updateMetrics();
            clearTimeout(timeout);
            document.getElementById('editor-status').innerText = 'Salvando...';
            timeout = setTimeout(() => {
                const current = getActiveDoc();
                current.content = area.innerHTML;
                current.updatedAt = new Date().toISOString();
                saveUserDocs(userEmail, docs);
                localStorage.setItem(`nebula_editor_${state.current_user}`, area.innerHTML);
                document.getElementById('editor-status').innerText = 'Salvo localmente.';
            }, 500);
        });

        // --- PDF Export e Limpar ---
        document.getElementById('btn-export-doc')?.addEventListener('click', () => {
            exportPDF(area, getActiveDoc().title || 'Documento');
        });

        document.getElementById('btn-clear-doc')?.addEventListener('click', () => {
            if (confirm('Tem certeza que deseja apagar todo o texto do documento atual?')) {
                area.innerHTML = '';
                const current = getActiveDoc();
                current.content = '';
                saveUserDocs(userEmail, docs);
                localStorage.removeItem(`nebula_editor_${state.current_user}`);
                document.getElementById('editor-status').innerText = 'Documento limpo.';
                updateMetrics();
                area.focus();
            }
        });
    }

     function renderMindMap(container, state) {
        const mmKey = `nebula_editor_mindmap_${state.current_user}`;
        let mmData = JSON.parse(localStorage.getItem(mmKey) || 'null') || { nodes: [], edges: [] };
        
        // Seed with user's docs if empty
        if (mmData.nodes.length === 0) {
            const ws = state.workspaces[state.current_user] || {};
            const docs = ((state.repository && state.repository.length) ? state.repository : (ws.repository || [])).slice(0, 12);
            const cx = 300, cy = 200;
            const user = state.users[state.current_user] || {};
            mmData.nodes.push({ id: 'me', label: user.name || 'Minha Pesquisa', x: cx, y: cy, color: '#3b82f6', size: 28, fixed: true });
            docs.forEach((doc, i) => {
                const colors = ['#f97316', '#ef4444', '#10b981', '#3b82f6'];
                const nodeColor = colors[i % colors.length];
                const angle = (i / docs.length) * Math.PI * 2;
                const r = 180;
                mmData.nodes.push({ 
                    id: doc.id || `doc_${i}`, 
                    label: (doc.name || '').slice(0, 30), 
                    x: cx + Math.cos(angle) * r, 
                    y: cy + Math.sin(angle) * r, 
                    color: nodeColor, 
                    size: 18,
                    topic: doc.topic,
                    kind: doc.kind
                });
                mmData.edges.push({ from: 'me', to: doc.id || `doc_${i}`, label: doc.topic || '' });
            });
        }

        container.innerHTML = `
            <div class="glass" style="min-height:620px;display:flex;flex-direction:column;position:relative;overflow:hidden;">
                <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;z-index:10;border-bottom:none;margin-bottom:0;padding:0 1.5rem 0 0;">
                    <span>Mapa Mental</span>
                    <button id="mm-btn-export-header" class="btn btn-sm" style="background:rgba(100,180,255,0.15);border:1px solid rgba(100,180,255,0.4);color:#93c5fd;font-weight:600;">Exportar PDF</button>
                </div>
                <p class="small-muted mb-1" style="z-index:10;padding:0 1.5rem;">Arraste nós · duplo clique para editar · scroll para zoom · arraste o fundo para mover</p>

                <div id="mm-toolbar" style="display:flex;align-items:center;gap:0.5rem;padding:0.7rem 1.2rem;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(0,0,0,0.35);flex-wrap:wrap;z-index:10;">
                    <button class="mm-tool" data-mode="select" id="mm-btn-select">Selecionar</button>
                    <button class="mm-tool" data-mode="addEdge" id="mm-btn-add-edge">Conectar</button>
                    <button class="mm-tool" data-mode="delete" id="mm-btn-delete">Excluir</button>
                    <span style="width:1px;height:22px;background:rgba(255,255,255,0.1)"></span>
                    <button class="mm-tool mm-action" id="mm-btn-add-node">+ Nó</button>
                    <button class="mm-tool mm-action" id="mm-btn-edit">Editar</button>
                    <input type="color" id="mm-node-color" title="Cor do nó" value="#3b82f6" style="width:32px;height:32px;border:none;border-radius:8px;background:transparent;cursor:pointer;">
                    <span style="width:1px;height:22px;background:rgba(255,255,255,0.1)"></span>
                    <button class="mm-tool mm-action" id="mm-btn-layout">Organizar</button>
                    <button class="mm-tool mm-action" id="mm-btn-fit">Centralizar</button>
                    <button class="mm-tool mm-action" id="mm-btn-save">Salvar</button>
                    <button class="mm-tool mm-action" id="mm-btn-export">PDF</button>
                    <button class="mm-tool mm-action" id="mm-btn-clear" style="opacity:0.6">Resetar</button>
                    <span id="mm-status" style="font-size:0.78rem;color:rgba(255,255,255,0.45);margin-left:auto;"></span>
                </div>

                <div id="mm-canvas-wrap" style="flex:1;position:relative;overflow:hidden;min-height:500px;background:#0a0b0e;display:flex;">
                    <div style="flex:1;position:relative;min-width:0;">
                        <canvas id="mm-canvas" style="width:100%;height:100%;cursor:grab;display:block;"></canvas>
                        <div id="mm-tooltip" style="display:none;position:absolute;background:#0f1319;border:1px solid rgba(59, 130, 246, 0.4);border-radius:10px;padding:0.5rem 0.8rem;font-size:0.8rem;color:#fff;pointer-events:none;z-index:99;max-width:220px;"></div>
                    </div>
                    <aside id="mm-inspector" class="mm-inspector mm-inspector-hidden">
                        <div class="mm-inspector-title">Editar nó</div>
                        <label class="input-label">Nome</label>
                        <input type="text" class="input" id="mm-insp-label" placeholder="Texto do nó">
                        <label class="input-label" style="margin-top:0.75rem">Cor</label>
                        <input type="color" id="mm-insp-color" value="#3b82f6" style="width:100%;height:40px;border:none;border-radius:10px;cursor:pointer;">
                        <div style="display:flex;flex-direction:column;gap:0.45rem;margin-top:1rem">
                            <button type="button" class="btn btn-primary btn-sm" id="mm-insp-apply">Aplicar</button>
                            <button type="button" class="btn btn-sm" id="mm-insp-delete" style="color:#fca5a5;border-color:rgba(239,68,68,0.35)">Excluir nó</button>
                        </div>
                        <p class="small-muted" style="margin-top:0.75rem;font-size:0.72rem">Duplo clique no nó · arraste para mover · scroll para zoom</p>
                    </aside>
                </div>
                <div style="padding:0.5rem 1.2rem;font-size:0.75rem;color:rgba(255,255,255,0.4);border-top:1px solid rgba(255,255,255,0.05);background:rgba(0,0,0,0.2);">
                    Duplo clique: editar · Delete: excluir selecionado · Scroll: zoom · F2: renomear nó
                </div>
            </div>
            <style>
                .mm-tool{padding:0.35rem 0.7rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);color:#fff;border-radius:10px;cursor:pointer;font-size:0.78rem;font-weight:500;transition:all 0.2s;font-family:Inter,sans-serif;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);}
                .mm-tool:hover{background:rgba(255,255,255,0.07);border-color:rgba(255,255,255,0.15);transform:translateY(-1px);}
                .mm-tool.active{background:rgba(59,130,246,0.15);border-color:#3b82f6;color:#93c5fd;box-shadow:0 0 10px rgba(59,130,246,0.25);}
                .mm-action{background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.1);color:rgba(255,255,255,0.95);}
                .mm-action:hover{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.18);}
                .mm-inspector{width:240px;flex-shrink:0;background:rgba(10,14,22,0.96);border-left:1px solid rgba(255,255,255,0.08);padding:1rem;display:flex;flex-direction:column;z-index:15;}
                .mm-inspector-hidden{display:none;}
                .mm-inspector-title{font-weight:700;font-size:0.9rem;margin-bottom:0.75rem;color:#3b82f6;}
                @media(max-width:768px){
                    #mm-canvas-wrap{flex-direction:column!important;min-height:520px!important;}
                    .mm-inspector{width:100%!important;border-left:none!important;border-top:1px solid rgba(255,255,255,0.08)!important;}
                }
            </style>
        `;

        const canvas = document.getElementById('mm-canvas');
        const ctx = canvas.getContext('2d');
        const inspector = document.getElementById('mm-inspector');
        const inspLabel = document.getElementById('mm-insp-label');
        const inspColor = document.getElementById('mm-insp-color');
        let mode = 'select';
        let selectedNode = null;
        let edgeFrom = null;
        let dragging = null;
        let dragOffset = { x: 0, y: 0 };
        let pan = { x: 0, y: 0 };
        let zoom = 1;
        let panning = false;
        let panStart = { x: 0, y: 0 };

        function getView() { return { pan, zoom }; }

        function openInspector(node) {
            if (!node || !inspector) return;
            selectedNode = node;
            inspector.classList.remove('mm-inspector-hidden');
            inspLabel.value = node.label || '';
            inspColor.value = node.color || '#3b82f6';
            inspLabel.focus();
            inspLabel.select();
            draw();
        }

        function closeInspector() {
            if (inspector) inspector.classList.add('mm-inspector-hidden');
        }

        function applyInspector() {
            if (!selectedNode) return;
            const val = inspLabel.value.trim();
            if (val) selectedNode.label = val.replace(/\s+/g, ' ').slice(0, 120);
            selectedNode.color = inspColor.value;
            draw();
            setStatus('Nó atualizado.');
        }

        function deleteSelectedNode() {
            if (!selectedNode) return;
            if (selectedNode.fixed) { setStatus('Nó principal não pode ser excluído.'); return; }
            mmData.nodes = mmData.nodes.filter(n => n !== selectedNode);
            mmData.edges = mmData.edges.filter(eg => eg.from !== selectedNode.id && eg.to !== selectedNode.id);
            selectedNode = null;
            closeInspector();
            draw();
            setStatus('Nó excluído.');
        }

        function showEdgeLabelEdit(canvasX, canvasY, initialValue, onSave) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:10000;background:#1a1410;border:2px solid var(--copper-1);border-radius:14px;padding:1rem;min-width:260px;box-shadow:0 20px 60px rgba(0,0,0,0.7);';
            wrap.innerHTML = `<div style="font-weight:600;margin-bottom:0.5rem;color:#fff">Rótulo da conexão</div>`;
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'input';
            input.value = initialValue || '';
            input.style.width = '100%';
            wrap.appendChild(input);
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:0.5rem;margin-top:0.75rem;justify-content:flex-end';
            const ok = document.createElement('button');
            ok.className = 'btn btn-primary btn-sm';
            ok.textContent = 'OK';
            const cancel = document.createElement('button');
            cancel.className = 'btn btn-sm';
            cancel.textContent = 'Cancelar';
            row.appendChild(cancel);
            row.appendChild(ok);
            wrap.appendChild(row);
            document.body.appendChild(wrap);
            input.focus();
            const close = () => wrap.remove();
            ok.onclick = () => { onSave(input.value.trim()); close(); };
            cancel.onclick = close;
            input.onkeydown = e => {
                if (e.key === 'Enter') { ok.click(); }
                if (e.key === 'Escape') close();
            };
        }

        function resize() {
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
            draw();
        }
        const ro = new ResizeObserver(resize);
        ro.observe(canvas.parentElement);
        resize();

        function worldToCanvas(wx, wy) { return { x: wx * zoom + pan.x, y: wy * zoom + pan.y }; }
        function canvasToWorld(cx2, cy2) { return { x: (cx2 - pan.x) / zoom, y: (cy2 - pan.y) / zoom }; }

        function fitView() {
            if (!mmData.nodes.length) return;
            const bounds = getGraphBounds();
            const pad = 60;
            const gw = bounds.width + pad * 2;
            const gh = bounds.height + pad * 2;
            zoom = Math.min(canvas.width / gw, canvas.height / gh, 1.3);
            pan.x = canvas.width / 2 - (bounds.minX + bounds.width / 2) * zoom;
            pan.y = canvas.height / 2 - (bounds.minY + bounds.height / 2) * zoom;
            draw();
            setStatus('Visualização centralizada.');
        }

        function getNodeSize(n) {
            ctx.save();
            ctx.font = `${n.id === 'me' ? 12 : 10.5}px Inter, sans-serif`;
            const maxTextW = 160;
            const lines = wrapNodeLabel(ctx, n.label, maxTextW);
            const lineH = 14;
            const textW = Math.max(...lines.map(l => ctx.measureText(l).width), 40);
            ctx.restore();
            const nodeW = Math.max(120, Math.min(textW + 30, maxTextW + 30));
            const nodeH = Math.max(40, lines.length * lineH + 16) + 26; // 26px for ComfyUI header bar
            return { nodeW, nodeH, lines, lineH };
        }

        function wrapNodeLabel(ctx, text, maxWidth) {
            const words = String(text || '').split(/\s+/);
            const lines = [];
            let line = '';
            words.forEach(w => {
                const test = line ? `${line} ${w}` : w;
                if (ctx.measureText(test).width > maxWidth && line) {
                    lines.push(line);
                    line = w;
                } else {
                    line = test;
                }
            });
            if (line) lines.push(line);
            return lines.slice(0, 4);
        }

        function getGraphBounds() {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            mmData.nodes.forEach(n => {
                const { nodeW, nodeH } = getNodeSize(n);
                minX = Math.min(minX, n.x - nodeW / 2);
                maxX = Math.max(maxX, n.x + nodeW / 2);
                minY = Math.min(minY, n.y - nodeH / 2);
                maxY = Math.max(maxY, n.y + nodeH / 2);
            });
            if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 400, maxY: 300, width: 400, height: 300 };
            return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
        }

        function drawMindMapFrame(targetCtx, cWidth, cHeight, view, showGrid) {
            const p = view.pan || view;
            const z = view.zoom != null ? view.zoom : 1;
            const w2c = (wx, wy) => ({ x: wx * z + p.x, y: wy * z + p.y });

            targetCtx.clearRect(0, 0, cWidth, cHeight);

            if (showGrid !== false) {
                targetCtx.save();
                targetCtx.fillStyle = 'rgba(255,255,255,0.06)';
                const gStep = 40;
                for (let x = p.x % gStep; x < cWidth; x += gStep) {
                    for (let y = p.y % gStep; y < cHeight; y += gStep) {
                        targetCtx.beginPath();
                        targetCtx.arc(x, y, 1.2, 0, Math.PI * 2);
                        targetCtx.fill();
                    }
                }
                targetCtx.restore();
            }

            mmData.edges.forEach(e => {
                const from = mmData.nodes.find(n => n.id === e.from);
                const to = mmData.nodes.find(n => n.id === e.to);
                if (!from || !to) return;
                
                const { nodeW: fromW } = getNodeSize(from);
                const { nodeW: toW } = getNodeSize(to);
                
                // Outputs on the right side, Inputs on the left side
                const fp = w2c(from.x + fromW / 2, from.y);
                const tp = w2c(to.x - toW / 2, to.y);
                
                targetCtx.save();
                targetCtx.beginPath();
                targetCtx.moveTo(fp.x, fp.y);
                
                const dx = Math.abs(tp.x - fp.x) * 0.5;
                const cp1x = fp.x + Math.max(40 * z, dx);
                const cp2x = tp.x - Math.max(40 * z, dx);
                
                targetCtx.bezierCurveTo(cp1x, fp.y, cp2x, tp.y, tp.x, tp.y);
                
                targetCtx.strokeStyle = from.color || 'rgba(59, 130, 246, 0.7)';
                targetCtx.lineWidth = 2.5 * z;
                targetCtx.stroke();
                
                if (e.label) {
                    const mx = (fp.x + tp.x) / 2, my = (fp.y + tp.y) / 2;
                    targetCtx.font = `${9 * z}px Inter, sans-serif`;
                    targetCtx.fillStyle = 'rgba(255,255,255,0.7)';
                    targetCtx.textAlign = 'center';
                    targetCtx.fillText(e.label.slice(0, 28), mx, my - 6 * z);
                }
                targetCtx.restore();
            });

            mmData.nodes.forEach(n => {
                const { x, y } = w2c(n.x, n.y);
                const isSelected = selectedNode === n || edgeFrom === n;
                const z = (targetCtx === ctx) ? zoom : 1;
                let { nodeW, nodeH, lines, lineH } = getNodeSize(n);
                nodeW *= z; nodeH *= z; lineH *= z;

                const headerH = 26 * z;
                const nodeColor = n.color || '#3b82f6';

                targetCtx.save();
                
                // Shadow blur for selected nodes
                if (isSelected) {
                    targetCtx.shadowColor = nodeColor;
                    targetCtx.shadowBlur = 15;
                }

                // Draw node outer card
                targetCtx.beginPath();
                if (targetCtx.roundRect) {
                    targetCtx.roundRect(x - nodeW / 2, y - nodeH / 2, nodeW, nodeH, 12 * z);
                } else {
                    targetCtx.rect(x - nodeW / 2, y - nodeH / 2, nodeW, nodeH);
                }
                targetCtx.fillStyle = '#181b24'; // ComfyUI style body
                targetCtx.fill();
                
                // Draw card border
                targetCtx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.08)';
                targetCtx.lineWidth = (isSelected ? 2 : 1) * z;
                targetCtx.stroke();
                targetCtx.restore();

                // Draw header bar
                targetCtx.save();
                targetCtx.beginPath();
                if (targetCtx.roundRect) {
                    targetCtx.roundRect(x - nodeW / 2, y - nodeH / 2, nodeW, headerH, [12 * z, 12 * z, 0, 0]);
                } else {
                    targetCtx.rect(x - nodeW / 2, y - nodeH / 2, nodeW, headerH);
                }
                targetCtx.fillStyle = nodeColor;
                targetCtx.fill();
                targetCtx.restore();

                // Draw connection ports (dots)
                targetCtx.save();
                const portRadius = 4.5 * z;
                
                // Left Port (Input)
                targetCtx.beginPath();
                targetCtx.arc(x - nodeW / 2, y, portRadius, 0, Math.PI * 2);
                targetCtx.fillStyle = '#10b981'; // Green dot
                targetCtx.fill();
                targetCtx.strokeStyle = '#ffffff';
                targetCtx.lineWidth = 1 * z;
                targetCtx.stroke();

                // Right Port (Output)
                targetCtx.beginPath();
                targetCtx.arc(x + nodeW / 2, y, portRadius, 0, Math.PI * 2);
                targetCtx.fillStyle = '#f97316'; // Orange dot
                targetCtx.fill();
                targetCtx.strokeStyle = '#ffffff';
                targetCtx.lineWidth = 1 * z;
                targetCtx.stroke();
                targetCtx.restore();

                // Text: Header Title
                targetCtx.save();
                targetCtx.font = `bold ${10 * z}px Inter, sans-serif`;
                targetCtx.fillStyle = '#ffffff';
                targetCtx.textAlign = 'left';
                targetCtx.textBaseline = 'middle';
                const headerTitle = n.id === 'me' ? 'PESQUISA' : (n.topic ? n.topic.toUpperCase().slice(0, 15) : (n.kind ? n.kind.toUpperCase() : 'DOCUMENTO'));
                targetCtx.fillText(headerTitle, x - nodeW / 2 + 10 * z, y - nodeH / 2 + headerH / 2);
                targetCtx.restore();

                // Text: Body Content (wrapped lines)
                targetCtx.save();
                targetCtx.font = `${(n.id === 'me' ? 12 : 10.5) * z}px Inter, sans-serif`;
                targetCtx.fillStyle = 'rgba(255,255,255,0.92)';
                targetCtx.textAlign = 'center';
                targetCtx.textBaseline = 'middle';
                const startY = y + headerH / 2 - ((lines.length - 1) * lineH) / 2;
                lines.forEach((ln, i) => targetCtx.fillText(ln, x, startY + i * lineH));
                targetCtx.restore();
            });

            if (edgeFrom && mousePos && targetCtx === ctx) {
                const { nodeW } = getNodeSize(edgeFrom);
                const fp = w2c(edgeFrom.x + nodeW / 2, edgeFrom.y);
                const tp = mousePos;
                
                targetCtx.save();
                targetCtx.beginPath();
                targetCtx.moveTo(fp.x, fp.y);
                
                const dx = Math.abs(tp.x - fp.x) * 0.5;
                targetCtx.bezierCurveTo(fp.x + Math.max(40 * z, dx), fp.y, tp.x - Math.max(40 * z, dx), tp.y, tp.x, tp.y);
                
                targetCtx.strokeStyle = 'rgba(249, 115, 22, 0.7)';
                targetCtx.lineWidth = 2.5 * z;
                targetCtx.setLineDash([5 * z, 4 * z]);
                targetCtx.stroke();
                targetCtx.restore();
            }
        }

        function draw() {
            drawMindMapFrame(ctx, canvas.width, canvas.height, getView(), true);
        }

        function exportMindMapPDF() {
            if (!mmData.nodes.length) { setStatus('Nada para exportar.'); return; }
            closeInspector();
            const bounds = getGraphBounds();
            const pad = 90;
            const gw = bounds.width + pad * 2;
            const gh = bounds.height + pad * 2;
            const maxW = 2600, maxH = 2000;
            const scale = Math.min(maxW / gw, maxH / gh, 3);
            const exportCanvas = document.createElement('canvas');
            exportCanvas.width = Math.max(800, Math.ceil(gw * scale));
            exportCanvas.height = Math.max(600, Math.ceil(gh * scale));
            const ectx = exportCanvas.getContext('2d');
            ectx.fillStyle = '#0d0a08';
            ectx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
            ectx.scale(scale, scale);
            drawMindMapFrame(ectx, gw, gh, { pan: { x: pad - bounds.minX, y: pad - bounds.minY }, zoom: 1 }, false);
            exportPDF(exportCanvas, 'Mapa Mental');
            setStatus('PDF exportado!');
        }

        function nodeAt(wx, wy) {
            return mmData.nodes.find(n => {
                const { nodeW, nodeH } = getNodeSize(n);
                const hw = nodeW / 2;
                const hh = nodeH / 2;
                return wx >= n.x - hw && wx <= n.x + hw && wy >= n.y - hh && wy <= n.y + hh;
            });
        }

        function getCanvasPos(e) {
            const rect = canvas.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }

        let mousePos = null;

        canvas.addEventListener('mousemove', e => {
            mousePos = getCanvasPos(e);
            if (panning) {
                pan.x = e.clientX - panStart.x;
                pan.y = e.clientY - panStart.y;
                draw();
                return;
            }
            if (dragging) {
                const w = canvasToWorld(mousePos.x, mousePos.y);
                dragging.x = w.x + dragOffset.x;
                dragging.y = w.y + dragOffset.y;
                draw();
                return;
            }
            const w = canvasToWorld(mousePos.x, mousePos.y);
            const hovered = nodeAt(w.x, w.y);
            canvas.style.cursor = panning ? 'grabbing' : hovered ? (mode === 'delete' ? 'not-allowed' : 'grab') : (mode === 'addEdge' ? 'crosshair' : 'default');
            const tooltip = document.getElementById('mm-tooltip');
            if (hovered) {
                tooltip.style.display = 'block';
                tooltip.style.left = (mousePos.x + 14) + 'px';
                tooltip.style.top = (mousePos.y - 12) + 'px';
                tooltip.textContent = hovered.label;
            } else {
                tooltip.style.display = 'none';
            }
            if (edgeFrom) draw();
        });

        canvas.addEventListener('mousedown', e => {
            if (e.target.closest('#mm-inspector')) return;
            const pos = getCanvasPos(e);
            const w = canvasToWorld(pos.x, pos.y);
            const hit = nodeAt(w.x, w.y);

            if (mode === 'delete') {
                if (hit) {
                    if (hit.fixed) { setStatus('Nó principal não pode ser excluído.'); return; }
                    mmData.nodes = mmData.nodes.filter(n => n !== hit);
                    mmData.edges = mmData.edges.filter(eg => eg.from !== hit.id && eg.to !== hit.id);
                    if (selectedNode === hit) selectedNode = null;
                    draw(); setStatus('Nó excluído.');
                } else {
                    const ei = findEdgeNear(w.x, w.y);
                    if (ei >= 0) { mmData.edges.splice(ei, 1); draw(); setStatus('Conexão removida.'); }
                }
                return;
            }

            if (mode === 'addEdge') {
                if (hit) {
                    if (!edgeFrom) { edgeFrom = hit; setStatus(`De: "${hit.label}" — Clique no nó de destino`); }
                    else if (hit !== edgeFrom) {
                        const exists = mmData.edges.find(eg => (eg.from === edgeFrom.id && eg.to === hit.id) || (eg.from === hit.id && eg.to === edgeFrom.id));
                        const fromNode = edgeFrom;
                        edgeFrom = null;
                        if (!exists) {
                            showEdgeLabelEdit(0, 0, '', (label) => {
                                mmData.edges.push({ from: fromNode.id, to: hit.id, label: label || '' });
                                setStatus('Conexão criada!');
                                draw();
                            });
                        } else {
                            setStatus('Conexão já existe.');
                            draw();
                        }
                    }
                }
                return;
            }

            // select mode
            if (hit) {
                selectedNode = hit;
                dragging = hit;
                dragOffset = { x: hit.x - w.x, y: hit.y - w.y };
                document.getElementById('mm-node-color').value = hit.color || '#3b82f6';
                openInspector(hit);
            } else {
                selectedNode = null;
                closeInspector();
                panning = true;
                panStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
                draw();
            }
        });

        canvas.addEventListener('mouseup', () => { dragging = null; panning = false; });

        canvas.addEventListener('wheel', e => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.92 : 1.08;
            const oldZoom = zoom;
            zoom = Math.max(0.25, Math.min(2.5, zoom * delta));
            const pos = getCanvasPos(e);
            pan.x = pos.x - (pos.x - pan.x) * (zoom / oldZoom);
            pan.y = pos.y - (pos.y - pan.y) * (zoom / oldZoom);
            draw();
        }, { passive: false });

        canvas.addEventListener('dblclick', e => {
            const pos = getCanvasPos(e);
            const w = canvasToWorld(pos.x, pos.y);
            const hit = nodeAt(w.x, w.y);
            if (hit) {
                openInspector(hit);
            } else {
                const edgeIndex = findEdgeNear(w.x, w.y);
                if (edgeIndex >= 0) {
                    const edge = mmData.edges[edgeIndex];
                    showEdgeLabelEdit(0, 0, edge.label || '', (val) => {
                        edge.label = val.trim();
                        draw();
                        setStatus('Conexão renomeada.');
                    });
                }
            }
        });

        function findEdgeNear(wx, wy, thresh = 10) {
            return mmData.edges.findIndex(e => {
                const from = mmData.nodes.find(n => n.id === e.from);
                const to = mmData.nodes.find(n => n.id === e.to);
                if (!from || !to) return false;
                const dx = to.x - from.x, dy = to.y - from.y;
                const len2 = dx*dx + dy*dy;
                if (len2 === 0) return false;
                const t = Math.max(0, Math.min(1, ((wx - from.x)*dx + (wy - from.y)*dy) / len2));
                const px = from.x + t*dx - wx, py = from.y + t*dy - wy;
                return Math.sqrt(px*px + py*py) < thresh;
            });
        }

        function setStatus(msg) { const s = document.getElementById('mm-status'); if (s) { s.textContent = msg; clearTimeout(s._t); s._t = setTimeout(() => s.textContent = '', 3000); } }
        function setMode(m) {
            mode = m; edgeFrom = null; dragging = null; panning = false;
            document.querySelectorAll('.mm-tool[data-mode]').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-mode') === m);
            });
            canvas.style.cursor = m === 'addEdge' ? 'crosshair' : m === 'delete' ? 'not-allowed' : 'grab';
            draw();
        }

        function editSelectedNode() {
            if (!selectedNode) { setStatus('Selecione um nó primeiro.'); return; }
            openInspector(selectedNode);
        }

        document.getElementById('mm-insp-apply').addEventListener('click', applyInspector);
        document.getElementById('mm-insp-delete').addEventListener('click', deleteSelectedNode);
        inspLabel.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); applyInspector(); }
        });

        document.getElementById('mm-btn-select').addEventListener('click', () => setMode('select'));

        document.getElementById('mm-btn-add-node').addEventListener('click', () => {
            const id = 'node_' + Date.now();
            const center = canvasToWorld(canvas.width / 2, canvas.height / 2);
            const colors = ['#f97316', '#3b82f6', '#ef4444', '#10b981', '#8b5cf6', '#06b6d4'];
            const newNode = { id, label: 'Novo Tema', x: center.x, y: center.y, color: colors[Math.floor(Math.random() * colors.length)], size: 22 };
            mmData.nodes.push(newNode);
            openInspector(newNode);
            setStatus('Novo nó — edite o nome no painel à direita.');
        });

        document.getElementById('mm-btn-add-edge').addEventListener('click', () => {
            setMode(mode === 'addEdge' ? 'select' : 'addEdge');
            setStatus(mode === 'addEdge' ? 'Clique em dois nós para conectar.' : '');
        });

        document.getElementById('mm-btn-delete').addEventListener('click', () => {
            setMode(mode === 'delete' ? 'select' : 'delete');
            setStatus(mode === 'delete' ? 'Clique em nó ou conexão para excluir.' : '');
        });

        document.getElementById('mm-btn-edit').addEventListener('click', editSelectedNode);

        document.getElementById('mm-node-color').addEventListener('input', e => {
            if (selectedNode && !selectedNode.fixed) {
                selectedNode.color = e.target.value;
                draw();
            }
        });

        document.getElementById('mm-btn-fit').addEventListener('click', fitView);

        document.addEventListener('keydown', function mmKeyHandler(e) {
            if (!document.getElementById('mm-canvas')) {
                document.removeEventListener('keydown', mmKeyHandler);
                return;
            }
            if (document.activeElement === inspLabel) return;
            if (e.key === 'Delete' && selectedNode) {
                deleteSelectedNode();
            }
            if (e.key === 'F2') { e.preventDefault(); editSelectedNode(); }
        });

        document.getElementById('mm-btn-save').addEventListener('click', () => {
            localStorage.setItem(mmKey, JSON.stringify(mmData));
            setStatus('Mapa salvo!');
        });

        document.getElementById('mm-btn-clear').addEventListener('click', () => {
            if (!confirm('Resetar o mapa mental para o estado inicial do seu repositório?')) return;
            localStorage.removeItem(mmKey);
            renderMindMap(container, state);
        });

        let simInterval = null;
        function runLayoutSimulation() {
            if (simInterval) clearInterval(simInterval);
            let ticks = 0;
            const maxTicks = 120;
            const statusSpan = document.getElementById('mm-status');
            if (statusSpan) statusSpan.textContent = 'Organizando layout...';

            simInterval = setInterval(() => {
                // 1. Repulsion
                for (let i = 0; i < mmData.nodes.length; i++) {
                    const n1 = mmData.nodes[i];
                    for (let j = i + 1; j < mmData.nodes.length; j++) {
                        const n2 = mmData.nodes[j];
                        const dx = n2.x - n1.x;
                        const dy = n2.y - n1.y;
                        const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                        const minDist = 220;
                        if (dist < minDist) {
                            const force = (minDist - dist) / dist * 0.45;
                            const fx = dx * force;
                            const fy = dy * force;
                            if (!n1.fixed) { n1.x -= fx; n1.y -= fy; }
                            if (!n2.fixed) { n2.x += fx; n2.y += fy; }
                        }
                    }
                }

                // 2. Attraction
                mmData.edges.forEach(e => {
                    const n1 = mmData.nodes.find(n => n.id === e.from);
                    const n2 = mmData.nodes.find(n => n.id === e.to);
                    if (!n1 || !n2) return;
                    const dx = n2.x - n1.x;
                    const dy = n2.y - n1.y;
                    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
                    const targetDist = 200;
                    if (dist > targetDist) {
                        const force = (dist - targetDist) / dist * 0.06;
                        const fx = dx * force;
                        const fy = dy * force;
                        if (!n1.fixed) { n1.x += fx; n1.y += fy; }
                        if (!n2.fixed) { n2.x -= fx; n2.y -= fy; }
                    }
                });

                // 3. Center gravity
                const cx = canvas.width / 2 - pan.x;
                const cy = canvas.height / 2 - pan.y;
                mmData.nodes.forEach(n => {
                    if (n.fixed) return;
                    n.x += (cx - n.x) * 0.025;
                    n.y += (cy - n.y) * 0.025;
                });

                draw();
                ticks++;
                if (ticks >= maxTicks) {
                    clearInterval(simInterval);
                    simInterval = null;
                    if (statusSpan) statusSpan.textContent = 'Organizado!';
                    setTimeout(() => { if (statusSpan && statusSpan.textContent === 'Organizado!') statusSpan.textContent = ''; }, 2000);
                }
            }, 16);
        }

        document.getElementById('mm-btn-layout').addEventListener('click', runLayoutSimulation);

        document.getElementById('mm-btn-export').addEventListener('click', exportMindMapPDF);
        document.getElementById('mm-btn-export-header').addEventListener('click', exportMindMapPDF);

        setMode('select');
        setTimeout(() => { runLayoutSimulation(); setTimeout(fitView, 800); }, 300);

        draw();
    }

    function _drawNebulaLogoOnCanvas(ctx, x, y, r) {
        // Outer copper ring
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = r * 0.13;
        ctx.stroke();

        // 5 colored segments (matching actual logo)
        const segColors = ['#c0392b', '#7f1d1d', '#166534', '#1e3a5f', '#78350f'];
        segColors.forEach((color, i) => {
            const sa = -Math.PI/2 + i * (Math.PI * 2 / 5);
            const ea = sa + Math.PI * 2 / 5;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.arc(x, y, r * 0.94, sa, ea);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
        });

        // White center circle
        ctx.beginPath();
        ctx.arc(x, y, r * 0.32, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Laptop icon in center
        const lw = r * 0.33, lh = r * 0.21;
        const lx = x - lw / 2, ly = y - lh / 2 - r * 0.02;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(lx, ly, lw, lh);
        ctx.fillStyle = '#e0e0e0';
        ctx.fillRect(lx + r * 0.02, ly + r * 0.02, lw - r * 0.04, lh - r * 0.04);
        // Base
        ctx.beginPath();
        ctx.moveTo(x - r * 0.23, y + lh / 2 - r * 0.02);
        ctx.lineTo(x + r * 0.23, y + lh / 2 - r * 0.02);
        ctx.lineTo(x + r * 0.27, y + lh / 2 + r * 0.08);
        ctx.lineTo(x - r * 0.27, y + lh / 2 + r * 0.08);
        ctx.closePath();
        ctx.fillStyle = '#1a1a1a';
        ctx.fill();
        ctx.restore();
    }

    async function exportPDF(element, titlePrefix) {
        if (!window.jspdf) {
            alert('A biblioteca jsPDF não foi carregada. Aguarde o carregamento completo da página.');
            return;
        }

        const toast = document.createElement('div');
        toast.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;background:#f97316;color:#fff;padding:1rem 1.8rem;border-radius:14px;font-weight:600;font-size:0.95rem;box-shadow:0 8px 30px rgba(0,0,0,0.5);';
        toast.innerText = 'Gerando PDF...';
        document.body.appendChild(toast);

        const isLandscape = titlePrefix === 'Mapa Mental';

        const doExport = async (htmlCanvas) => {
            try {
                const imgData = htmlCanvas.toDataURL('image/png');
                const { jsPDF } = window.jspdf;
                const pdf = new jsPDF(isLandscape ? 'l' : 'p', 'mm', 'a4');
                const W = pdf.internal.pageSize.getWidth();
                const H = pdf.internal.pageSize.getHeight();

                pdf.setFillColor(10, 10, 10);
                pdf.rect(0, 0, W, H, 'F');

                const headerH = 28;
                pdf.setFillColor(10, 14, 22);
                pdf.rect(0, 0, W, headerH, 'F');

                pdf.setDrawColor(59, 130, 246);
                pdf.setLineWidth(0.8);
                pdf.line(0, headerH, W, headerH);

                const logoDataUrl = await new Promise((resolve) => {
                    const img = new Image();
                    img.crossOrigin = 'anonymous';
                    img.onload = () => {
                        try {
                            const c = document.createElement('canvas');
                            c.width = img.naturalWidth || 300; c.height = img.naturalHeight || 300;
                            const cx = c.getContext('2d'); cx.drawImage(img, 0, 0);
                            resolve(c.toDataURL('image/png'));
                        } catch(e) { resolve(null); }
                    };
                    img.onerror = () => resolve(null);
                    img.src = 'nebula-logo.png?' + Date.now();
                });
                try {
                    if (logoDataUrl) pdf.addImage(logoDataUrl, 'PNG', 5, 2, 22, 22);
                } catch(e) {}

                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(16);
                pdf.setFont('helvetica', 'bold');
                pdf.text('NEBULA RESEARCH', 30, headerH / 2 - 2);

                pdf.setTextColor(59, 130, 246);
                pdf.setFontSize(8);
                pdf.setFont('helvetica', 'normal');
                pdf.text('Plataforma Acadêmica de Pesquisa', 30.5, headerH / 2 + 4);

                const now = new Date();
                const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                pdf.setTextColor(148, 163, 184);
                pdf.setFontSize(8);
                pdf.text(dateStr, W - 15, headerH / 2 + 2, { align: 'right' });

                pdf.setTextColor(249, 115, 22);
                pdf.setFontSize(9);
                pdf.setFont('helvetica', 'bold');
                pdf.text(titlePrefix.toUpperCase(), 15, headerH + 9);
                pdf.setDrawColor(249, 115, 22);
                pdf.setLineWidth(0.3);
                pdf.line(15, headerH + 11, 15 + titlePrefix.length * 2.5, headerH + 11);

                const imgProps = pdf.getImageProperties(imgData);
                const contentY = headerH + 16;
                const maxImgW = W - 30;
                const imgHeight = (imgProps.height * maxImgW) / imgProps.width;
                pdf.addImage(imgData, 'PNG', 15, contentY, maxImgW, Math.min(imgHeight, H - contentY - 30));

                const wmCanvas = document.createElement('canvas');
                wmCanvas.width = 300; wmCanvas.height = 300;
                const wmCtx = wmCanvas.getContext('2d');
                if (logoDataUrl) {
                    const wmImg = new Image(); wmImg.src = logoDataUrl;
                    wmCtx.globalAlpha = 0.07;
                    try { wmCtx.drawImage(wmImg, 0, 0, 300, 300); } catch(e) {}
                }
                try {
                    pdf.addImage(wmCanvas.toDataURL('image/png'), 'PNG', W/2 - 35, H/2 - 35, 70, 70);
                } catch(e) {}

                pdf.setFillColor(10, 14, 22);
                pdf.rect(0, H - 14, W, 14, 'F');
                pdf.setDrawColor(59, 130, 246);
                pdf.setLineWidth(0.5);
                pdf.line(0, H - 14, W, H - 14);

                const smLogoCanvas = document.createElement('canvas');
                smLogoCanvas.width = 40; smLogoCanvas.height = 40;
                const slCtx = smLogoCanvas.getContext('2d');
                if (logoDataUrl) {
                    const slImg = new Image(); slImg.src = logoDataUrl;
                    try { slCtx.drawImage(slImg, 0, 0, 40, 40); } catch(e) {}
                }
                try {
                    pdf.addImage(smLogoCanvas.toDataURL('image/png'), 'PNG', W - 18, H - 13, 10, 10);
                } catch(e) {}

                pdf.setTextColor(249, 115, 22);
                pdf.setFontSize(7.5);
                pdf.setFont('helvetica', 'bold');
                pdf.text('Nebula Research', 15, H - 5.5);

                pdf.setTextColor(148, 163, 184);
                pdf.setFont('helvetica', 'normal');
                pdf.text('Documento gerado em ' + dateStr + '  •  Reprodução proibida sem autorização', W / 2, H - 5.5, { align: 'center' });

                pdf.save(`Nebula_${titlePrefix}_${dateStr.replace(/\//g, '-')}.pdf`);
                toast.innerText = 'PDF gerado com sucesso!';
                setTimeout(() => toast.remove(), 2000);
            } catch(err) {
                console.error('PDF generation failed', err);
                toast.remove();
                alert('Erro ao gerar o PDF. Tente novamente.');
            }
        };

        if (element instanceof HTMLCanvasElement) {
            doExport(element);
        } else if (typeof html2canvas !== 'undefined') {
            html2canvas(element, { backgroundColor: '#0d0a08', scale: 1.5 }).then(doExport).catch(err => {
                console.error('html2canvas failed', err);
                toast.remove();
                alert('Erro ao capturar o documento. Tente novamente.');
            });
        } else {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const W = pdf.internal.pageSize.getWidth();
            const H = pdf.internal.pageSize.getHeight();
            const text = element.innerText || element.textContent || '';
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(11);
            pdf.setTextColor(30, 30, 30);
            const lines = pdf.splitTextToSize(text, W - 40);
            let y = 20;
            lines.forEach(line => {
                if (y > H - 20) { pdf.addPage(); y = 20; }
                pdf.text(line, 20, y);
                y += 6;
            });
            const dateStr = new Date().toLocaleDateString('pt-BR');
            pdf.save(`Nebula_${titlePrefix}_${dateStr.replace(/\//g, '-')}.pdf`);
            toast.innerText = 'PDF gerado!';
            setTimeout(() => toast.remove(), 2000);
        }
    }

    return { renderEditor, renderMindMap };
})();

/* PAGE: PROFILE */
const PageProfile = (() => {
    function render(container, state, targetEmail) {
        const currentUser = state.current_user;
        const viewingSelf = !targetEmail || targetEmail === currentUser;
        const profileEmail = viewingSelf
            ? (NebulaStorage.findUserKey(state, currentUser) || (currentUser || '').toLowerCase().trim())
            : (NebulaStorage.findUserKey(state, targetEmail) || (targetEmail || '').toLowerCase().trim());
        const user = state.users[profileEmail] || { email: profileEmail };
        user.photo = user.photo || NebulaStorage.getUserPhoto(state, profileEmail);
        user.cover = user.cover || NebulaStorage.getUserCover(state, profileEmail);

        if (!viewingSelf) {
            renderPublicProfile(container, state, user, profileEmail);
            return;
        }

        renderSelfProfile(container, state, user, profileEmail);
    }

    function renderPublicProfile(container, state, user, targetEmail) {
        NebulaStorage.recordProfileView(state, state.current_user, targetEmail);
        const userInterest = state.user_interest[targetEmail] || {};
        const topTerms = Object.keys(userInterest).slice(0, 15);
        const userWs = state.workspaces[targetEmail] || {};
        const publicDocs = (userWs.repository || []).filter(d => d.visibility === 'public' || d.topic);
        const isOnline = NebulaStorage.isUserOnline([], targetEmail, state);
        const coverStyle = user.cover ? `background-size:cover;background-position:center;min-height:220px;image-rendering:-webkit-optimize-contrast;` : 'min-height:220px;';

        container.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                <button class="btn" onclick="NebulaApp.navigate('Conexões')">← Voltar às Conexões</button>
                <button class="btn btn-primary" id="pub-msg-btn">Enviar Mensagem</button>
            </div>

            <div class="glass-outer mb-1" style="padding:0; overflow:hidden; border-radius:24px;">
                <div class="mobile-profile-cover" id="pub-cover-display" style="${coverStyle}"></div>
                <div style="padding:1.5rem 2rem 2rem; margin-top:-55px; position:relative; z-index:2;">
                    <div style="display:flex; align-items:flex-end; gap:1.25rem; flex-wrap:wrap;">
                        <div style="width:180px; height:135px; border-radius:22px; background:linear-gradient(135deg,var(--color-blue),#1d4ed8); display:flex; align-items:center; justify-content:center; font-size:2.4rem; font-weight:800; color:#fff; overflow:visible; flex-shrink:0; position:relative; border:4px solid var(--bg-dark); box-shadow:0 12px 36px rgba(0,0,0,0.28); cursor:${user.photo ? 'pointer' : 'default'};" ${user.photo ? `onclick="PageChat.openPhotoViewer('${user.photo.replace(/'/g, "\\'")}','${(user.name || '').replace(/'/g, "\\'")}')"` : ''}>
                            <div style="width:100%;height:100%;border-radius:18px;overflow:hidden;display:flex;align-items:center;justify-content:center;">
                                ${user.photo ? `<img src="${user.photo}" alt="" style="width:100%;height:100%;object-fit:cover;">` : initial}
                            </div>
                            ${isOnline ? '<span class="online-dot" style="width:14px;height:14px;bottom:4px;right:4px;" title="Online"></span>' : ''}
                        </div>
                        <div style="flex:1; padding-bottom:0.25rem;">
                            <div style="display:flex;align-items:center;gap:0.6rem;flex-wrap:wrap;">
                                <h2 style="font-size:1.6rem; font-weight:700; margin-bottom:0.25rem; color:var(--text-white);">${user.name || 'Pesquisador'}</h2>
                                ${isOnline ? '<span class="tag" style="background:rgba(16,185,129,0.15);border-color:#10b981;color:#10b981;font-weight:700;font-size:0.75rem;display:inline-flex;align-items:center;gap:4px;"><span style="width:6px;height:6px;border-radius:50%;background:#10b981;"></span> Online</span>' : '<span class="tag" style="font-size:0.72rem;color:var(--text-white-40);">Offline</span>'}
                            </div>
                            <p style="color:var(--text-white-60); font-size:0.9rem;">@${targetEmail.split('@')[0]}</p>
                            ${user.research ? `<div style="margin-top:0.75rem; font-size:0.95rem; color:var(--text-white-80); line-height:1.5;"><b>Linha de Pesquisa:</b> ${user.research}</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid-2 mb-1">
                <div class="glass">
                    <div class="section-title">Principais Tópicos & Palavras-chave</div>
                    ${topTerms.length ? topTerms.map(t => `<span class="tag tag-copper">${t}</span>`).join('') : `<div class="small-muted">Nenhuma palavra-chave registrada.</div>`}
                </div>
                <div class="glass">
                    <div class="section-title">Publicações & Acervo Compartilhado (${publicDocs.length})</div>
                    ${publicDocs.length ? publicDocs.slice(0, 5).map(d => `
                        <div style="background:rgba(255,255,255,0.45); padding:0.75rem; border-radius:10px; margin-bottom:0.5rem; border:1px solid rgba(0,0,0,0.06);">
                            <div style="font-weight:600; font-size:0.9rem; color:var(--text-white);">${d.name}</div>
                            <div style="font-size:0.8rem; color:var(--text-white-60); margin-top:0.2rem;">${d.topic || 'Geral'} · ${d.year || ''}</div>
                        </div>
                    `).join('') : `<div class="small-muted">Nenhum documento público compartilhado ainda.</div>`}
                </div>
            </div>
        `;

        const pubCover = document.getElementById('pub-cover-display');
        if (pubCover && user.cover) pubCover.style.backgroundImage = `url("${user.cover}")`;

        document.getElementById('pub-msg-btn')?.addEventListener('click', () => {
            state.chat_target = targetEmail;
            state.chat_draft = `Olá ${user.name ? user.name.split(' ')[0] : 'Pesquisador'}! Vi seu perfil público no Nebula Research e gostaria de trocar ideias sobre sua linha de pesquisa.`;
            state.page = 'Comunidade';
            NebulaApp.renderApp();
        });
    }

    function renderSelfProfile(container, state, user, profileEmail) {
        const emailKey = profileEmail || (NebulaStorage.findUserKey(state, state.current_user) || (state.current_user || '').toLowerCase().trim());
        const profileTerms = NebulaApp.recommendTerms(state.current_user, 25);
        const history = state.search_history || [];

        let histHtml = '';
        if (history.length) {
            const recent = history.slice(0, 10);
            histHtml = `<table class="data-table"><tr><th>Consulta</th><th>Data</th><th>Categoria</th></tr>`;
            recent.forEach(h => { histHtml += `<tr><td>${h.query||''}</td><td>${h.dateStr||h.time||''}</td><td>${h.category||h.topic||''}</td></tr>`; });
            histHtml += `</table>`;
        }

        const coverStyle = user.cover ? `background-size:cover;background-position:center;` : '';

        container.innerHTML = `
            <div class="mobile-profile-hero">
                <div class="mobile-profile-cover" id="prof-cover-display" style="${coverStyle}">
                    <button type="button" class="prof-cover-btn" id="prof-cover-btn" title="Alterar capa">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                        Alterar capa
                    </button>
                </div>
                <input type="file" id="prof-cover-input" accept="image/*" style="display:none">
                <div class="mobile-profile-identity">
                    <div class="mobile-profile-left">
                        <div class="mobile-profile-avatar-wrap" style="position:relative;">
                            <div class="mobile-profile-avatar" id="prof-avatar-display" style="cursor:${user.photo ? 'pointer' : 'default'};position:relative;" ${user.photo ? `onclick="PageChat.openPhotoViewer('${user.photo.replace(/'/g, "\\'")}','${(user.name || '').replace(/'/g, "\\'")}')"` : ''}>
                                ${user.photo ? `<img src="${user.photo}" alt="Foto" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">` : (user.name || 'P').trim().charAt(0).toUpperCase()}
                                <span class="online-dot" style="width:14px;height:14px;bottom:4px;right:4px;" title="Online"></span>
                            </div>
                            <button type="button" class="prof-photo-btn" id="prof-photo-btn" title="Alterar foto">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                            </button>
                            <input type="file" id="prof-photo-input" accept="image/*" style="display:none">
                        </div>
                        <div class="mobile-profile-meta">
                            <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                                <h2>${user.name || 'Pesquisador'}</h2>
                                <span class="tag" style="background:rgba(16,185,129,0.15);border-color:#10b981;color:#10b981;font-weight:700;font-size:0.72rem;display:inline-flex;align-items:center;gap:4px;"><span style="width:6px;height:6px;border-radius:50%;background:#10b981;"></span> Online</span>
                            </div>
                            <p>@${(state.current_user || '').split('@')[0] || 'usuario'}</p>
                        </div>
                    </div>
                </div>
                ${user.research ? `<div class="mobile-profile-bio"><strong>Linha de pesquisa</strong>${user.research}</div>` : ''}
                <div class="mobile-quick-row">
                    <button type="button" class="mobile-quick-btn" onclick="NebulaApp.navigate('Análise')">Análise</button>
                    <button type="button" class="mobile-quick-btn" onclick="NebulaApp.navigate('Conexões')">Conexões</button>
                    <button type="button" class="mobile-quick-btn" onclick="NebulaApp.navigate('Mensagens')">Mensagens</button>
                </div>
            </div>
            <div class="page-title profile-desktop-title">Perfil do Usuário</div>

            <div class="grid-2">
                <div>
                    <div class="glass"><div class="section-title">Dados do perfil</div>
                        <div class="input-group"><label class="input-label">Capa do perfil</label>
                            <button type="button" class="btn btn-sm btn-full" id="prof-cover-btn-desktop" style="margin-bottom:0.75rem;">Alterar capa do perfil</button>
                        </div>
                        <div class="input-group"><label class="input-label">Nome</label><input type="text" class="input" id="prof-name" value="${user.name||''}"></div>
                        <div class="input-group"><label class="input-label">Área de pesquisa</label><textarea class="textarea" id="prof-research" placeholder="Descreva sua linha de pesquisa principal...">${user.research||''}</textarea></div>
                        <button class="btn btn-primary btn-full" id="prof-save-btn">Salvar perfil</button>
                        <div id="prof-feedback" style="margin-top:1rem;text-align:center;font-weight:600;color:#10b981;display:none;"></div>
                    </div>

                    <div class="glass" style="margin-top: 1.5rem; border-color: rgba(239, 68, 68, 0.25);">
                        <div class="section-title" style="color: #ef4444;">Encerrar sessão</div>
                        <p class="small-muted mb-1">Sair da sua conta atual com segurança de forma a liberar o acesso para outros usuários neste dispositivo.</p>
                        <button class="btn btn-sm btn-red" id="prof-logout-btn">Sair da conta</button>
                    </div>
                </div>
                <div>
                    <div class="glass"><div class="section-title">Preferências aprendidas</div>
                        ${profileTerms.length ? profileTerms.map(t=>`<span class="tag">${t}</span>`).join('') : `<div class="small-muted">Faça buscas e envie documentos para construir seu perfil.</div>`}
                        ${profileTerms.length ? `<button class="btn btn-sm btn-danger mt-1" id="prof-clear-interests">Limpar preferências</button>` : ''}
                    </div>
                    <div class="glass"><div class="section-title">Histórico de buscas</div>
                        ${history.length ? histHtml : `<div class="small-muted">Nenhuma busca registrada.</div>`}
                    </div>
                </div>
            </div>
        `;

        const coverEl = document.getElementById('prof-cover-display');
        if (coverEl && user.cover) {
            coverEl.style.backgroundImage = `url("${user.cover}")`;
        }

        function triggerCoverPicker() {
            const input = document.getElementById('prof-cover-input');
            if (input) {
                input.value = '';
                input.click();
            }
        }

        document.getElementById('prof-cover-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            triggerCoverPicker();
        });
        document.getElementById('prof-cover-btn-desktop')?.addEventListener('click', (e) => {
            e.preventDefault();
            triggerCoverPicker();
        });
        document.getElementById('prof-photo-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const input = document.getElementById('prof-photo-input');
            if (input) { input.value = ''; input.click(); }
        });

        document.getElementById('prof-save-btn').addEventListener('click', async () => {
            const btn = document.getElementById('prof-save-btn');
            const newName = document.getElementById('prof-name').value.trim();
            const newResearch = document.getElementById('prof-research').value.trim();
            
            if (!newName || !newResearch) {
                showToast('Atenção', 'Preencha o nome e a área de pesquisa.');
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Salvando e sincronizando...';
            
            state.users[emailKey].name = newName;
            state.users[emailKey].research = newResearch;
            if (state.current_user) state.current_user = emailKey;

            NebulaStorage.rebuildInterests(state, emailKey);

            for (const key of Object.keys(state)) {
                if (key.startsWith('dashboard_articles_') || key.startsWith('conn_articles_')) delete state[key];
            }

            await NebulaStorage.saveStateAsync(state);
            
            showToast('Perfil atualizado!', 'Seu nome e área de pesquisa foram salvos.');
            
            const feedback = document.getElementById('prof-feedback');
            feedback.style.display = 'block';
            feedback.textContent = '✓ Perfil sincronizado com sucesso!';
            
            btn.disabled = false;
            btn.textContent = 'Salvar perfil';
        });

        document.getElementById('prof-clear-interests')?.addEventListener('click', () => {
            state.user_interest[emailKey] = {};
            NebulaStorage.saveState(state);
            showToast('Preferências limpas', 'Seu perfil de recomendações foi reiniciado.');
            NebulaApp.navigate('Perfil');
        });

        document.getElementById('prof-logout-btn')?.addEventListener('click', () => {
            if (confirm('Tem certeza que deseja sair da conta?')) {
                NebulaApp.logout();
            }
        });

        // Photo upload
        document.getElementById('prof-photo-input')?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const dataUrl = await compressImage(file, 720, 0.85);
                NebulaStorage.applyUserMedia(state, emailKey, { photo: dataUrl });
                await NebulaStorage.saveStateAsync(state);
                NebulaStorage.saveState(state);

                const avatarEl = document.getElementById('prof-avatar-display');
                if (avatarEl) avatarEl.innerHTML = `<img src="${dataUrl}" alt="Foto" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
                showToast('Foto atualizada!', 'Sua imagem de perfil foi salva.');
            } catch (err) {
                showToast('Erro', 'Não foi possível salvar a foto.');
            }
        });

        document.getElementById('prof-avatar-display')?.addEventListener('click', () => {
            const photo = NebulaStorage.getUserPhoto(state, emailKey);
            if (photo && window.PageChat) PageChat.openPhotoViewer(photo, state.users[emailKey]?.name || 'Perfil');
        });

        document.getElementById('prof-cover-input')?.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                showToast('Erro', 'Selecione um arquivo de imagem.');
                return;
            }
            try {
                const dataUrl = await compressImage(file, 1600, 0.82);
                NebulaStorage.applyUserMedia(state, emailKey, { cover: dataUrl });
                if (state.current_user) state.current_user = emailKey;
                await NebulaStorage.saveStateAsync(state);
                NebulaStorage.saveState(state);

                const coverDisplay = document.getElementById('prof-cover-display');
                if (coverDisplay) {
                    coverDisplay.style.backgroundImage = `url("${dataUrl}")`;
                    coverDisplay.style.backgroundSize = 'cover';
                    coverDisplay.style.backgroundPosition = 'center';
                }
                showToast('Capa atualizada!', 'A capa do seu perfil foi salva.');
            } catch (err) {
                console.error('[Profile] cover upload failed:', err);
                showToast('Erro', 'Não foi possível salvar a capa.');
            }
        });
    }

    function compressImage(file, maxDim, quality) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = ev => {
                const img = new Image();
                img.onload = () => {
                    let { width, height } = img;
                    if (width > maxDim || height > maxDim) {
                        if (width > height) { height = Math.round(height * maxDim / width); width = maxDim; }
                        else { width = Math.round(width * maxDim / height); height = maxDim; }
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                };
                img.onerror = reject;
                img.src = ev.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function showToast(title, message) {
        const existing = document.getElementById('nebula-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'nebula-toast';
        toast.innerHTML = `
            <div class="toast-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="22" height="22">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            </div>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
        `;
        document.body.appendChild(toast);
        setTimeout(() => { if (document.getElementById('nebula-toast')) toast.remove(); }, 4000);
    }

    return { render, showToast };
})();

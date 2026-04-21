/* PAGE: PROFILE */
const PageProfile = (() => {
    function render(container, state) {
        const user = state.users[state.current_user] || {};
        const profileTerms = NebulaApp.recommendTerms(state.current_user, 25);
        const history = state.search_history || [];

        let histHtml = '';
        if (history.length) {
            const recent = history.slice(-10).reverse();
            histHtml = `<table class="data-table"><tr><th>Consulta</th><th>Data</th><th>Tema</th><th>Intenção</th></tr>`;
            recent.forEach(h => { histHtml += `<tr><td>${h.query||''}</td><td>${h.time||''}</td><td>${h.topic||''}</td><td>${h.intent||''}</td></tr>`; });
            histHtml += `</table>`;
        }

        container.innerHTML = `
            <div class="page-title">Perfil</div>
            <div class="page-sub">Configure sua área de pesquisa e veja suas preferências aprendidas</div>
            <div class="grid-2">
                <div>
                    <div class="glass"><div class="section-title">Dados do perfil</div>
                        <div class="input-group"><label class="input-label">Nome</label><input type="text" class="input" id="prof-name" value="${user.name||''}"></div>
                        <div class="input-group"><label class="input-label">Área de pesquisa</label><textarea class="textarea" id="prof-research" placeholder="Descreva sua linha de pesquisa principal...">${user.research||''}</textarea></div>
                        <button class="btn btn-primary btn-full" id="prof-save-btn">Salvar perfil</button>
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

        document.getElementById('prof-save-btn').addEventListener('click', async () => {
            const btn = document.getElementById('prof-save-btn');
            const newName = document.getElementById('prof-name').value;
            const newResearch = document.getElementById('prof-research').value;
            
            // Visual feedback on button
            btn.disabled = true;
            btn.textContent = 'Salvando...';
            
            state.users[state.current_user].name = newName;
            state.users[state.current_user].research = newResearch;
            NebulaStorage.saveState(state);
            
            // Clear cached articles
            for (const key of Object.keys(state)) { if (key.startsWith('dashboard_articles_') || key.startsWith('conn_articles_')) delete state[key]; }
            
            // Show toast notification
            showToast('Perfil salvo com sucesso!', 'Suas alterações foram aplicadas e sincronizadas.');
            
            // Re-enable button
            setTimeout(() => {
                btn.disabled = false;
                btn.textContent = 'Salvar perfil';
            }, 600);
        });

        document.getElementById('prof-clear-interests')?.addEventListener('click', () => {
            state.user_interest[state.current_user] = {};
            NebulaStorage.saveState(state);
            showToast('Preferências limpas', 'Seu perfil de recomendações foi reiniciado.');
            NebulaApp.navigate('Perfil');
        });
    }

    /**
     * Exibe toast notification animado
     * @param {string} title - Título do toast
     * @param {string} message - Mensagem detalhada
     */
    function showToast(title, message) {
        // Remove any existing toast
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
            <button class="toast-close" onclick="this.parentElement.classList.add('toast-exit');setTimeout(()=>this.parentElement.remove(),350)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;
        document.body.appendChild(toast);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            if (document.getElementById('nebula-toast')) {
                toast.classList.add('toast-exit');
                setTimeout(() => toast.remove(), 350);
            }
        }, 5000);
    }

    return { render };
})();

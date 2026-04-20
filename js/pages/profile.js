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

        document.getElementById('prof-save-btn').addEventListener('click', () => {
            state.users[state.current_user].name = document.getElementById('prof-name').value;
            state.users[state.current_user].research = document.getElementById('prof-research').value;
            NebulaStorage.saveState(state);
            // Clear cached articles
            for (const key of Object.keys(state)) { if (key.startsWith('dashboard_articles_') || key.startsWith('conn_articles_')) delete state[key]; }
            NebulaApp.navigate('Perfil');
        });

        document.getElementById('prof-clear-interests')?.addEventListener('click', () => {
            state.user_interest[state.current_user] = {};
            NebulaStorage.saveState(state);
            NebulaApp.navigate('Perfil');
        });
    }
    return { render };
})();

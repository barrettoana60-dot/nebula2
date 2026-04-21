/* ============================================================
   TUTORIAL — First-access guided onboarding
   ============================================================ */
const NebulaTutorial = (() => {
    const STEPS = [
        { page: 'Dashboard', title: 'Dashboard', desc: 'Aqui você vê um resumo dos seus documentos, temas, conexões e recomendações de artigos baseadas no seu perfil de pesquisa.' },
        { page: 'Pesquisa Inteligente', title: 'Pesquisa Inteligente', desc: 'Busque artigos usando linguagem natural. O sistema analisa sua intenção, cruza com seu repositório local e busca artigos na internet.' },
        { page: 'Repositório', title: 'Repositório', desc: 'Envie PDFs, DOCX e outros documentos. O sistema extrai automaticamente: autor, resumo, palavras-chave, tema, idioma e referências.' },
        { page: 'Análise', title: 'Análise de Dados', desc: 'Visualize dados do seu acervo: mapa global de países, linha do tempo, temas mais frequentes e recomendações do algoritmo de ML.' },
        { page: 'Conexões', title: 'Ecossistema de Pesquisa', desc: 'Explore a rede 3D interativa que conecta seus documentos, pesquisadores e temas em comum. Clique nos nós para interagir.' },
        { page: 'Comunidade', title: 'Comunidade', desc: 'Troque mensagens com pesquisadores que compartilham interesses semelhantes aos seus. Use o bloco de notas pessoal para anotações rápidas.' },
        { page: 'Perfil', title: 'Perfil', desc: 'Configure sua área de pesquisa para que o sistema aprenda suas preferências e gere recomendações mais precisas.' },
    ];

    let currentStep = 0;

    function start() {
        currentStep = 0;
        renderOverlay();
    }

    function renderOverlay() {
        removeOverlay();
        const step = STEPS[currentStep];
        const total = STEPS.length;
        const progress = Math.round(((currentStep + 1) / total) * 100);

        const overlay = document.createElement('div');
        overlay.id = 'tutorial-overlay';
        overlay.innerHTML = `
            <div class="tutorial-backdrop"></div>
            <div class="tutorial-card">
                <div class="tutorial-progress-bar">
                    <div class="tutorial-progress-fill" style="width:${progress}%"></div>
                </div>
                <div class="tutorial-step-count">${currentStep + 1} de ${total}</div>
                <div class="tutorial-title">${step.title}</div>
                <div class="tutorial-desc">${step.desc}</div>
                <div class="tutorial-actions">
                    ${currentStep > 0 ? '<button class="btn btn-sm" id="tut-prev">Anterior</button>' : '<div></div>'}
                    <div style="display:flex;gap:0.5rem">
                        <button class="btn btn-sm" id="tut-skip">Pular tutorial</button>
                        <button class="btn btn-primary btn-sm" id="tut-next">${currentStep < total - 1 ? 'Próximo' : 'Concluir'}</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('tut-next').addEventListener('click', () => {
            if (currentStep < total - 1) {
                currentStep++;
                NebulaApp.navigate(STEPS[currentStep].page);
                renderOverlay();
            } else {
                complete();
            }
        });

        if (document.getElementById('tut-prev')) {
            document.getElementById('tut-prev').addEventListener('click', () => {
                if (currentStep > 0) {
                    currentStep--;
                    NebulaApp.navigate(STEPS[currentStep].page);
                    renderOverlay();
                }
            });
        }

        document.getElementById('tut-skip').addEventListener('click', complete);
    }

    function complete() {
        removeOverlay();
        const state = NebulaApp.getState();
        if (state.current_user && state.users[state.current_user]) {
            state.users[state.current_user].tutorial_completed = true;
            NebulaStorage.saveState(state);
        }
    }

    function removeOverlay() {
        const el = document.getElementById('tutorial-overlay');
        if (el) el.remove();
    }

    function shouldShow(state) {
        if (!state.current_user || !state.users[state.current_user]) return false;
        return !state.users[state.current_user].tutorial_completed;
    }

    return { start, shouldShow };
})();

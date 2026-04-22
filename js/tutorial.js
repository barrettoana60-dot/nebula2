/* ============================================================
   TUTORIAL — Card-based walkthrough on first login
   ============================================================ */
const NebulaTutorial = (() => {
    let currentStep = 0;

    const steps = [
        {
            title: "Bem-vindo ao Nebula Research",
            text: "Este é o seu ecossistema de pesquisa inteligente. Vamos conhecer cada parte da plataforma para você aproveitar ao máximo todas as funcionalidades.",
            target: null
        },
        {
            title: "Pesquisa Inteligente",
            text: "Busque artigos acadêmicos em bases como Semantic Scholar e CrossRef. O sistema aprende seus interesses a cada busca e refina as recomendações futuras.",
            target: "Pesquisa Inteligente"
        },
        {
            title: "Repositório",
            text: "Envie seus PDFs, DOCX e outros documentos. A IA Llama 3.3 lê o conteúdo completo, extrai autor, ano, palavras-chave, resumo e metadados automaticamente.",
            target: "Repositório"
        },
        {
            title: "Análise",
            text: "A IA faz uma varredura cruzada nos seus documentos para identificar pontos fortes, lacunas e sugerir direcionamentos para sua tese ou pesquisa.",
            target: "Análise"
        },
        {
            title: "Conexões — Visão Global",
            text: "Visualize em 3D como os documentos do seu repositório se conectam com artigos externos similares. Quanto mais próximos os nós, maior a semelhança temática entre as pesquisas.",
            target: "Conexões"
        },
        {
            title: "Conexões — Visão Social",
            text: "Na aba Visão Social (Comunidade), o sistema cruza seu perfil e repositório com outros pesquisadores. Encontre pessoas com temas, artigos e pesquisas em comum.",
            target: "Conexões"
        },
        {
            title: "Comunidade",
            text: "Envie mensagens diretas para outros pesquisadores. Colabore, troque referências e construa sua rede acadêmica dentro da plataforma.",
            target: "Comunidade"
        },
        {
            title: "Perfil",
            text: "Configure sua linha de pesquisa e veja as preferências que o sistema aprendeu automaticamente a partir das suas buscas e documentos enviados.",
            target: "Perfil"
        }
    ];

    function start() {
        if (document.getElementById('tutorial-overlay')) return;
        currentStep = 0;
        renderOverlay();
    }

    function renderOverlay() {
        const existing = document.getElementById('tutorial-overlay');
        if (existing) existing.remove();

        const step = steps[currentStep];

        const overlay = document.createElement('div');
        overlay.id = 'tutorial-overlay';
        overlay.className = 'tutorial-animate-in';
        overlay.innerHTML = `
            <div class="tutorial-backdrop"></div>
            <div class="tutorial-card">
                <div class="tutorial-progress-bar">
                    <div class="tutorial-progress-fill" style="width:${((currentStep + 1) / steps.length) * 100}%"></div>
                </div>
                <div class="tutorial-dots">
                    ${steps.map((_, i) => `<div class="tutorial-dot ${i === currentStep ? 'active' : (i < currentStep ? 'done' : '')}"></div>`).join('')}
                </div>
                <div class="tutorial-step-count">Passo ${currentStep + 1} de ${steps.length}</div>
                <div class="tutorial-title tutorial-title-slide">${step.title}</div>
                <div class="tutorial-desc">${step.text}</div>
                <div class="tutorial-actions">
                    <button class="btn btn-sm" id="tour-skip-btn" style="opacity:0.6">Pular tutorial</button>
                    <div style="display:flex; gap:0.5rem;">
                        ${currentStep > 0 ? '<button class="btn btn-sm" id="tour-prev-btn">Anterior</button>' : ''}
                        <button class="btn btn-primary btn-sm" id="tour-next-btn">${currentStep === steps.length - 1 ? 'Começar a usar' : 'Próximo'}</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Navigate to the target tab if specified
        if (step.target) {
            NebulaApp.navigate(step.target);
        }

        document.getElementById('tour-next-btn').addEventListener('click', () => {
            if (currentStep >= steps.length - 1) {
                complete();
            } else {
                currentStep++;
                renderOverlay();
            }
        });

        document.getElementById('tour-skip-btn').addEventListener('click', complete);

        const prevBtn = document.getElementById('tour-prev-btn');
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                currentStep--;
                renderOverlay();
            });
        }
    }

    function complete() {
        const overlay = document.getElementById('tutorial-overlay');
        if (overlay) {
            overlay.className = 'tutorial-animate-out';
            setTimeout(() => overlay.remove(), 400);
        }

        NebulaApp.navigate('Tela Principal');

        const state = NebulaApp.getState();
        if (state.current_user && state.users[state.current_user]) {
            state.users[state.current_user].tutorial_completed = 'v3';
            NebulaStorage.saveState(state);
        }
    }

    function shouldShow(state) {
        if (!state.current_user || !state.users[state.current_user]) return false;
        return state.users[state.current_user].tutorial_completed !== 'v3';
    }

    return { start, shouldShow };
})();

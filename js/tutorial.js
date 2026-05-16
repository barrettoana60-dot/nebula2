/* ============================================================
   TUTORIAL — Card-based walkthrough on first login
   ============================================================ */
const NebulaTutorial = (() => {
    let currentStep = 0;
    let isActive = false;

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
            target: null
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
        if (isActive) return;
        if (document.getElementById('tutorial-overlay')) return;
        isActive = true;
        currentStep = 0;
        showStep();
    }

    function showStep() {
        const existing = document.getElementById('tutorial-overlay');
        if (existing) existing.remove();

        const step = steps[currentStep];
        const progress = ((currentStep + 1) / steps.length) * 100;

        const overlay = document.createElement('div');
        overlay.id = 'tutorial-overlay';
        overlay.className = 'tutorial-animate-in';
        overlay.innerHTML = `
            <div class="tutorial-backdrop" onclick="NebulaTutorial.skip()"></div>
            <div class="tutorial-card" style="pointer-events:auto; cursor:default;">
                <div class="tutorial-progress-bar">
                    <div class="tutorial-progress-fill" style="width:${progress}%"></div>
                </div>
                <div class="tutorial-dots">
                    ${steps.map((_, i) => `<div class="tutorial-dot ${i === currentStep ? 'active' : (i < currentStep ? 'done' : '')}"></div>`).join('')}
                </div>
                <div class="tutorial-step-count">Passo ${currentStep + 1} de ${steps.length}</div>
                <div class="tutorial-title tutorial-title-slide">${step.title}</div>
                <div class="tutorial-desc">${step.text}</div>
                <div class="tutorial-actions">
                    <button class="btn btn-sm" onclick="NebulaTutorial.skip()" style="opacity:0.6">Pular tutorial</button>
                    <div style="display:flex; gap:0.5rem;">
                        ${currentStep > 0 ? '<button class="btn btn-sm" onclick="NebulaTutorial.prev()">Anterior</button>' : ''}
                        <button class="btn btn-primary btn-sm" onclick="NebulaTutorial.next()">${currentStep === steps.length - 1 ? 'Começar a usar' : 'Próximo'}</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Navigate to the target tab
        if (step.target) {
            try { NebulaApp.navigate(step.target); } catch(e) { console.warn('[Tutorial] Nav error:', e); }
        }
    }

    function next() {
        if (currentStep >= steps.length - 1) {
            skip();
        } else {
            currentStep++;
            showStep();
        }
    }

    function prev() {
        if (currentStep > 0) {
            currentStep--;
            showStep();
        }
    }

    function skip() {
        isActive = false;

        // Mark completed FIRST
        try {
            const state = NebulaApp.getState();
            if (state.current_user && state.users[state.current_user]) {
                state.users[state.current_user].tutorial_completed = 'v3';
                state.is_new_user = false;
                NebulaStorage.saveStateAsync(state).catch(e => console.warn('[Tutorial] Async save error:', e));
            }
        } catch(e) { console.warn('[Tutorial] Save error:', e); }

        // Remove overlay
        const overlay = document.getElementById('tutorial-overlay');
        if (overlay) {
            overlay.className = 'tutorial-animate-out';
            setTimeout(() => { try { overlay.remove(); } catch(e){} }, 400);
        }

        // Navigate back to dashboard
        try { NebulaApp.navigate('Tela Principal'); } catch(e) {}
    }

    function shouldShow(state) {
        if (isActive) return false;
        if (!state.current_user || !state.users[state.current_user]) return false;
        return state.is_new_user === true;
    }

    return { start, shouldShow, next, prev, skip };
})();

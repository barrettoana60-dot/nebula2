/* ============================================================
   TUTORIAL — Animated Tour
   ============================================================ */
const NebulaTutorial = (() => {
    let currentStep = 0;
    let overlay = null;
    let tourBox = null;
    let highlightBox = null;

    const steps = [
        {
            title: "Bem-vindo ao Nebula Research",
            text: "Este é o seu ecossistema de pesquisa inteligente. Vamos fazer um rápido tour pelas abas principais?",
            target: null
        },
        {
            title: "Repositório",
            text: "Aqui você faz upload dos seus PDFs e documentos. Nossa IA Llama 3.3 vai ler o conteúdo, extrair metadados reais e resumir as informações automaticamente.",
            target: "Repositório"
        },
        {
            title: "Análise",
            text: "A IA fará uma varredura cruzada no seu repositório para sugerir pontos fortes, pontos fracos e direcionamentos para a sua tese ou pesquisa.",
            target: "Análise"
        },
        {
            title: "Conexões",
            text: "Explore uma visão em 3D de todas as palavras-chave e tópicos do seu acervo. Entenda como suas pesquisas se entrelaçam.",
            target: "Conexões"
        },
        {
            title: "Comunidade",
            text: "Seu perfil é cruzado com outros usuários. Encontre pares de pesquisa, visualize a similaridade dos acervos e envie mensagens diretas.",
            target: "Comunidade"
        }
    ];

    function start() {
        if (document.getElementById('tour-overlay')) return;
        currentStep = 0;
        
        overlay = document.createElement('div');
        overlay.id = 'tour-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:9997;transition:all 0.4s ease;pointer-events:none;';
        document.body.appendChild(overlay);

        highlightBox = document.createElement('div');
        // Usando mix-blend-mode para simular um holofote recortando a máscara
        highlightBox.style.cssText = 'position:absolute;border-radius:8px;box-shadow:0 0 0 9999px rgba(0,0,0,0.75), 0 0 15px 2px var(--copper-1);z-index:9998;transition:all 0.5s cubic-bezier(0.4, 0, 0.2, 1);pointer-events:none;opacity:0;';
        document.body.appendChild(highlightBox);

        tourBox = document.createElement('div');
        tourBox.style.cssText = 'position:absolute;width:350px;background:var(--bg-card);border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:1.5rem;z-index:9999;transition:all 0.5s cubic-bezier(0.4, 0, 0.2, 1);box-shadow:0 10px 40px rgba(0,0,0,0.5);opacity:0;transform:translateY(20px);pointer-events:auto;';
        document.body.appendChild(tourBox);

        renderStep();
    }

    function renderStep() {
        const step = steps[currentStep];
        
        tourBox.innerHTML = `
            <div style="font-weight:600;font-size:1.1rem;margin-bottom:0.5rem;color:var(--text-white)">${step.title}</div>
            <div style="font-size:0.9rem;color:var(--text-white-60);margin-bottom:1.5rem;line-height:1.5">${step.text}</div>
            <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-size:0.8rem;color:rgba(255,255,255,0.3)">Passo ${currentStep + 1} de ${steps.length}</span>
                <button class="btn btn-primary btn-sm" id="tour-next-btn">${currentStep === steps.length - 1 ? 'Concluir' : 'Próximo'}</button>
            </div>
        `;

        document.getElementById('tour-next-btn').addEventListener('click', nextStep);

        if (!step.target) {
            highlightBox.style.opacity = '0';
            overlay.style.background = 'rgba(0,0,0,0.85)';
            tourBox.style.left = '50%';
            tourBox.style.top = '50%';
            tourBox.style.transform = 'translate(-50%, -50%)';
            tourBox.style.opacity = '1';
        } else {
            overlay.style.background = 'rgba(0,0,0,0)'; // Mask is handled by highlightBox box-shadow
            const navLinks = Array.from(document.querySelectorAll('.nav-link'));
            const targetEl = navLinks.find(el => el.textContent.trim() === step.target);
            
            if (targetEl) {
                targetEl.click(); // Navega para a aba real para o usuário ver
                
                setTimeout(() => {
                    const rect = targetEl.getBoundingClientRect();
                    highlightBox.style.opacity = '1';
                    highlightBox.style.left = \`\${rect.left - 5}px\`;
                    highlightBox.style.top = \`\${rect.top - 5}px\`;
                    highlightBox.style.width = \`\${rect.width + 10}px\`;
                    highlightBox.style.height = \`\${rect.height + 10}px\`;

                    let boxLeft = rect.left + rect.width / 2 - 175;
                    if (boxLeft < 20) boxLeft = 20; // evita sair da tela
                    
                    tourBox.style.left = \`\${boxLeft}px\`;
                    tourBox.style.top = \`\${rect.bottom + 20}px\`;
                    tourBox.style.transform = 'translate(0, 0)';
                    tourBox.style.opacity = '1';
                }, 50); // delay pequeno para a renderização do layout
            } else {
                highlightBox.style.opacity = '0';
                tourBox.style.left = '50%';
                tourBox.style.top = '50%';
                tourBox.style.transform = 'translate(-50%, -50%)';
            }
        }
    }

    function nextStep() {
        currentStep++;
        if (currentStep >= steps.length) {
            complete();
        } else {
            renderStep();
        }
    }

    function complete() {
        if (overlay) overlay.remove();
        if (highlightBox) highlightBox.remove();
        if (tourBox) tourBox.remove();
        
        NebulaApp.navigate('Tela Principal');

        const state = NebulaApp.getState();
        if (state.current_user && state.users[state.current_user]) {
            state.users[state.current_user].tutorial_completed = true;
            if (NebulaStorage.saveStateAsync) {
                NebulaStorage.saveStateAsync(state);
            } else {
                NebulaStorage.saveState(state);
            }
        }
    }

    function shouldShow(state) {
        if (!state.current_user || !state.users[state.current_user]) return false;
        return !state.users[state.current_user].tutorial_completed;
    }

    return { start, shouldShow };
})();

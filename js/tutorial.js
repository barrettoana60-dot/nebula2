/* ============================================================
   TUTORIAL — Cinematic Animated Tour
   ============================================================ */
const NebulaTutorial = (() => {
    let currentStep = 0;
    let overlay = null;
    let tourBox = null;
    let highlightBox = null;
    let autoPlayTimer = null;
    let isAutoPlaying = false;

    const steps = [
        {
            title: "Bem-vindo ao Nebula 3.0",
            text: "O seu ecossistema de pesquisa acaba de ser atualizado. Esta é a visão global do seu conhecimento.",
            target: null,
            duration: 4000
        },
        {
            title: "Repositório Inteligente",
            text: "Aqui, a IA Llama 3.3 lê seus PDFs e extrai metadados reais, autores e resumos automaticamente.",
            target: "Repositório",
            duration: 5000
        },
        {
            title: "Análise Cross-Document",
            text: "Nossa IA cruza os dados do seu acervo para sugerir novas direções e identificar pontos cegos na sua pesquisa.",
            target: "Análise",
            duration: 5000
        },
        {
            title: "Conexões 3D",
            text: "Visualize a topologia da sua pesquisa. Veja como temas e autores se conectam no espaço semântico.",
            target: "Conexões",
            duration: 5000
        },
        {
            title: "Comunidade e Colaboração",
            text: "Encontre outros pesquisadores com acervos similares. O Nebula agora conecta você por afinidade científica real.",
            target: "Comunidade",
            duration: 5000
        }
    ];

    function start(autoPlay = false) {
        console.log("[Tutorial] Start triggered. AutoPlay:", autoPlay);
        if (document.getElementById('tour-overlay')) return;
        currentStep = 0;
        isAutoPlaying = autoPlay;
        
        overlay = document.createElement('div');
        overlay.id = 'tour-overlay';
        overlay.style.cssText = `
            position:fixed; top:0; left:0; width:100%; height:100%; 
            background: radial-gradient(circle at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.8) 100%);
            z-index:9997; transition:all 0.8s ease; pointer-events:none;
        `;
        document.body.appendChild(overlay);

        highlightBox = document.createElement('div');
        highlightBox.style.cssText = `
            position:absolute; border-radius:16px; 
            box-shadow: 0 0 0 9999px rgba(0,0,0,0.8), 0 0 30px 5px var(--copper-1);
            z-index:9998; transition:all 0.8s cubic-bezier(0.19, 1, 0.22, 1);
            pointer-events:none; opacity:0;
        `;
        document.body.appendChild(highlightBox);

        tourBox = document.createElement('div');
        tourBox.style.cssText = `
            position:absolute; width:400px; background:var(--bg-panel); 
            border:1px solid rgba(217,119,74,0.3); border-radius:24px; padding:2rem; 
            z-index:9999; transition:all 0.8s cubic-bezier(0.19, 1, 0.22, 1);
            box-shadow:0 30px 60px rgba(0,0,0,0.8); opacity:0; transform:translateY(30px);
            pointer-events:auto; backdrop-filter:blur(20px);
        `;
        document.body.appendChild(tourBox);

        renderStep();
    }

    function renderStep() {
        const step = steps[currentStep];
        
        tourBox.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <div style="font-weight:700; font-size:1.4rem; color:var(--text-white); letter-spacing:-0.02em;">${step.title}</div>
                ${isAutoPlaying ? '<div class="pulse-red" style="width:10px;height:10px;background:#ff4444;border-radius:50%"></div>' : ''}
            </div>
            <div style="font-size:1rem; color:var(--text-white-60); margin-bottom:2rem; line-height:1.6">${step.text}</div>
            <div style="display:flex; justify-content:space-between; align-items:center">
                <span style="font-size:0.8rem; color:rgba(255,255,255,0.4); font-family:monospace">NEBULA_TOUR_STEP_${currentStep + 1}</span>
                <div style="display:flex; gap:0.5rem">
                    <button class="btn btn-sm" style="background:rgba(255,255,255,0.05)" onclick="NebulaTutorial.complete()">Pular</button>
                    <button class="btn btn-primary btn-sm" id="tour-next-btn" style="min-width:100px">${currentStep === steps.length - 1 ? 'Finalizar' : 'Próximo'}</button>
                </div>
            </div>
            ${isAutoPlaying ? `<div style="height:3px; background:rgba(255,255,255,0.1); border-radius:3px; margin-top:1.5rem; overflow:hidden">
                <div id="tour-progress-bar" style="height:100%; background:var(--copper-1); width:0%; transition:width ${step.duration}ms linear"></div>
            </div>` : ''}
        `;

        document.getElementById('tour-next-btn').addEventListener('click', nextStep);

        if (!step.target) {
            highlightBox.style.opacity = '0';
            tourBox.style.left = '50%';
            tourBox.style.top = '50%';
            tourBox.style.transform = 'translate(-50%, -50%)';
            tourBox.style.opacity = '1';
        } else {
            const navLinks = Array.from(document.querySelectorAll('.nav-link'));
            const targetEl = navLinks.find(el => el.textContent.trim() === step.target);
            
            if (targetEl) {
                targetEl.click(); 
                
                setTimeout(() => {
                    const rect = targetEl.getBoundingClientRect();
                    highlightBox.style.opacity = '1';
                    highlightBox.style.left = `${rect.left - 10}px`;
                    highlightBox.style.top = `${rect.top - 10}px`;
                    highlightBox.style.width = `${rect.width + 20}px`;
                    highlightBox.style.height = `${rect.height + 20}px`;

                    let boxLeft = rect.left + rect.width / 2 - 200;
                    if (boxLeft < 20) boxLeft = 20;
                    if (boxLeft + 400 > window.innerWidth - 20) boxLeft = window.innerWidth - 420;
                    
                    tourBox.style.left = `${boxLeft}px`;
                    tourBox.style.top = `${rect.bottom + 30}px`;
                    tourBox.style.transform = 'translate(0, 0)';
                    tourBox.style.opacity = '1';
                }, 100);
            }
        }

        if (isAutoPlaying) {
            if (autoPlayTimer) clearTimeout(autoPlayTimer);
            setTimeout(() => {
                const bar = document.getElementById('tour-progress-bar');
                if (bar) bar.style.width = '100%';
            }, 50);
            autoPlayTimer = setTimeout(nextStep, step.duration);
        }
    }

    function nextStep() {
        if (autoPlayTimer) clearTimeout(autoPlayTimer);
        currentStep++;
        if (currentStep >= steps.length) {
            complete();
        } else {
            renderStep();
        }
    }

    function complete() {
        if (autoPlayTimer) clearTimeout(autoPlayTimer);
        if (overlay) overlay.remove();
        if (highlightBox) highlightBox.remove();
        if (tourBox) tourBox.remove();
        
        NebulaApp.navigate('Tela Principal');

        const state = NebulaApp.getState();
        if (state.current_user && state.users[state.current_user]) {
            state.users[state.current_user].tutorial_completed = 'v3';
            NebulaStorage.saveStateAsync(state);
        }
    }

    function shouldShow(state) {
        if (!state.current_user || !state.users[state.current_user]) return false;
        return state.users[state.current_user].tutorial_completed !== 'v3';
    }

    return { start, complete, shouldShow };
})();

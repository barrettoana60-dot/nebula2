/* ============================================================
   TUTORIAL — Animated guided onboarding with spotlight & typewriter
   ============================================================ */
const NebulaTutorial = (() => {
    const STEPS = [
        {
            page: 'Tela Principal',
            title: 'Tela Principal',
            desc: 'Aqui você vê um resumo dos seus documentos, temas, conexões e recomendações de artigos baseadas no seu perfil de pesquisa.',
            icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="36" height="36" rx="6"/><line x1="6" y1="18" x2="42" y2="18"/><line x1="18" y1="18" x2="18" y2="42"/><circle cx="30" cy="30" r="5" fill="currentColor" opacity="0.3"/></svg>`,
            highlight: '.metric-grid'
        },
        {
            page: 'Pesquisa Inteligente',
            title: 'Pesquisa Inteligente',
            desc: 'Busque artigos usando linguagem natural. O sistema analisa sua intenção, cruza com seu repositório local e busca artigos na internet.',
            icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><circle cx="20" cy="20" r="14"/><line x1="30" y1="30" x2="42" y2="42" stroke-width="3" stroke-linecap="round"/><path d="M14 20h12M20 14v12" opacity="0.4"/></svg>`,
            highlight: '#search-input'
        },
        {
            page: 'Repositório',
            title: 'Repositório',
            desc: 'Envie PDFs, DOCX e outros documentos. A IA integrada extrai automaticamente: autor, resumo, palavras-chave, tema, idioma e referências com precisão.',
            icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 40V12l8-8h20a4 4 0 0 1 4 4v32a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z"/><polyline points="16,4 16,14 8,14" opacity="0.5"/><line x1="16" y1="22" x2="32" y2="22"/><line x1="16" y1="28" x2="28" y2="28"/><line x1="16" y1="34" x2="24" y2="34"/></svg>`,
            highlight: '#repo-drop'
        },
        {
            page: 'Análise',
            title: 'Análise de Dados',
            desc: 'Visualize dados do seu acervo: mapa global de países, linha do tempo, temas mais frequentes e recomendações do algoritmo de ML.',
            icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4,40 14,24 24,32 34,12 44,20"/><circle cx="14" cy="24" r="2.5" fill="currentColor"/><circle cx="24" cy="32" r="2.5" fill="currentColor"/><circle cx="34" cy="12" r="2.5" fill="currentColor"/><circle cx="44" cy="20" r="2.5" fill="currentColor"/></svg>`,
            highlight: '.glass'
        },
        {
            page: 'Conexões',
            title: 'Ecossistema de Pesquisa',
            desc: 'Explore a rede 3D interativa que conecta seus documentos, pesquisadores e temas em comum. Clique nos nós para interagir.',
            icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><circle cx="24" cy="24" r="5"/><circle cx="10" cy="10" r="3"/><circle cx="38" cy="10" r="3"/><circle cx="10" cy="38" r="3"/><circle cx="38" cy="38" r="3"/><line x1="20" y1="20" x2="12" y2="12"/><line x1="28" y1="20" x2="36" y2="12"/><line x1="20" y1="28" x2="12" y2="36"/><line x1="28" y1="28" x2="36" y2="36"/></svg>`,
            highlight: '#network-plot'
        },
        {
            page: 'Comunidade',
            title: 'Comunidade',
            desc: 'Troque mensagens com pesquisadores que compartilham interesses semelhantes aos seus. Use o bloco de notas pessoal para anotações rápidas.',
            icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 8h28a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H14l-8 8V12a4 4 0 0 1 4-4z"/><circle cx="16" cy="20" r="1.5" fill="currentColor"/><circle cx="24" cy="20" r="1.5" fill="currentColor"/><circle cx="32" cy="20" r="1.5" fill="currentColor" opacity="0.4"/></svg>`,
            highlight: '.chat-shell'
        },
        {
            page: 'Perfil',
            title: 'Perfil',
            desc: 'Configure sua área de pesquisa para que o sistema aprenda suas preferências e gere recomendações mais precisas.',
            icon: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><circle cx="24" cy="16" r="8"/><path d="M8 42c0-8.8 7.2-16 16-16s16 7.2 16 16"/></svg>`,
            highlight: '#prof-save-btn'
        },
    ];

    let currentStep = 0;
    let typewriterInterval = null;

    function start() {
        currentStep = 0;
        NebulaApp.navigate(STEPS[0].page);
        setTimeout(() => renderOverlay(), 300);
    }

    function renderOverlay() {
        removeOverlay();
        clearTypewriter();

        const step = STEPS[currentStep];
        const total = STEPS.length;
        const progress = Math.round(((currentStep + 1) / total) * 100);

        const overlay = document.createElement('div');
        overlay.id = 'tutorial-overlay';
        overlay.className = 'tutorial-animate-in';
        overlay.innerHTML = `
            <div class="tutorial-backdrop"></div>
            <div class="tutorial-card tutorial-card-animated">
                <div class="tutorial-progress-bar">
                    <div class="tutorial-progress-fill" style="width:${progress}%"></div>
                </div>

                <div class="tutorial-dots">
                    ${STEPS.map((_, i) => `<span class="tutorial-dot ${i === currentStep ? 'active' : ''} ${i < currentStep ? 'done' : ''}"></span>`).join('')}
                </div>

                <div class="tutorial-icon-wrap">
                    <div class="tutorial-icon-pulse"></div>
                    <div class="tutorial-icon">${step.icon}</div>
                </div>

                <div class="tutorial-step-count">Passo ${currentStep + 1} de ${total}</div>
                <div class="tutorial-title tutorial-title-slide">${step.title}</div>
                <div class="tutorial-desc" id="tutorial-typewriter"></div>
                
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

        // Typewriter animation for description
        startTypewriter(step.desc);

        // Highlight target element
        highlightElement(step.highlight);

        // Event listeners
        document.getElementById('tut-next').addEventListener('click', () => {
            if (currentStep < total - 1) {
                animateTransition('next');
            } else {
                complete();
            }
        });

        if (document.getElementById('tut-prev')) {
            document.getElementById('tut-prev').addEventListener('click', () => {
                if (currentStep > 0) {
                    animateTransition('prev');
                }
            });
        }

        document.getElementById('tut-skip').addEventListener('click', complete);
    }

    function animateTransition(direction) {
        const card = document.querySelector('.tutorial-card');
        if (!card) return;
        
        clearHighlight();
        
        const slideClass = direction === 'next' ? 'tutorial-slide-out-left' : 'tutorial-slide-out-right';
        card.classList.add(slideClass);
        
        setTimeout(() => {
            currentStep += direction === 'next' ? 1 : -1;
            NebulaApp.navigate(STEPS[currentStep].page);
            setTimeout(() => renderOverlay(), 200);
        }, 280);
    }

    function startTypewriter(text) {
        const el = document.getElementById('tutorial-typewriter');
        if (!el) return;
        
        let i = 0;
        el.textContent = '';
        el.style.borderRight = '2px solid var(--copper-1)';
        
        typewriterInterval = setInterval(() => {
            if (i < text.length) {
                el.textContent += text[i];
                i++;
            } else {
                clearInterval(typewriterInterval);
                typewriterInterval = null;
                // Cursor blink then fade
                setTimeout(() => {
                    el.style.borderRight = '2px solid transparent';
                }, 1500);
            }
        }, 22);
    }

    function clearTypewriter() {
        if (typewriterInterval) {
            clearInterval(typewriterInterval);
            typewriterInterval = null;
        }
    }

    function highlightElement(selector) {
        clearHighlight();
        if (!selector) return;
        
        const target = document.querySelector(selector);
        if (!target) return;

        // Create a spotlight ring around the element
        const rect = target.getBoundingClientRect();
        const ring = document.createElement('div');
        ring.id = 'tutorial-highlight-ring';
        ring.style.cssText = `
            position: fixed;
            top: ${rect.top - 8}px;
            left: ${rect.left - 8}px;
            width: ${rect.width + 16}px;
            height: ${rect.height + 16}px;
            border: 2px solid var(--copper-1);
            border-radius: 16px;
            z-index: 9998;
            pointer-events: none;
            animation: tutorialSpotlight 2s ease-in-out infinite;
            box-shadow: 0 0 30px var(--copper-glow), inset 0 0 30px rgba(217,119,74,0.05);
        `;
        document.body.appendChild(ring);
    }

    function clearHighlight() {
        const ring = document.getElementById('tutorial-highlight-ring');
        if (ring) ring.remove();
    }

    function complete() {
        clearTypewriter();
        clearHighlight();
        
        // Fade out animation
        const overlay = document.getElementById('tutorial-overlay');
        if (overlay) {
            overlay.classList.add('tutorial-animate-out');
            setTimeout(() => removeOverlay(), 350);
        }

        const state = NebulaApp.getState();
        if (state.current_user && state.users[state.current_user]) {
            state.users[state.current_user].tutorial_completed = true;
            NebulaStorage.saveState(state);
        }
    }

    function removeOverlay() {
        clearHighlight();
        const el = document.getElementById('tutorial-overlay');
        if (el) el.remove();
    }

    function shouldShow(state) {
        if (!state.current_user || !state.users[state.current_user]) return false;
        return !state.users[state.current_user].tutorial_completed;
    }

    return { start, shouldShow };
})();

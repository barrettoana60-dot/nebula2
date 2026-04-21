/* ============================================================
   TUTORIAL — Animated Single Splash Screen
   ============================================================ */
const NebulaTutorial = (() => {
    function start() {
        renderOverlay();
    }

    function renderOverlay() {
        removeOverlay();
        const overlay = document.createElement('div');
        overlay.id = 'tutorial-overlay';
        overlay.className = 'tutorial-animate-in';
        overlay.innerHTML = `
            <div class="tutorial-backdrop"></div>
            <div class="tutorial-card tutorial-card-animated" style="max-width: 600px; padding: 3rem; text-align: center;">
                
                <div class="tutorial-animation-container" style="position:relative; height: 160px; margin-bottom: 2rem;">
                    <!-- CSS animated nodes -->
                    <div class="anim-node" style="left: 20%; top: 30%; animation-delay: 0s;"></div>
                    <div class="anim-node" style="left: 50%; top: 50%; animation-delay: 0.3s; transform: scale(1.5);"></div>
                    <div class="anim-node" style="left: 80%; top: 40%; animation-delay: 0.6s;"></div>
                    <div class="anim-line" style="left: 22%; top: 34%; width: 30%; transform: rotate(33deg); animation-delay: 1s;"></div>
                    <div class="anim-line" style="left: 53%; top: 52%; width: 28%; transform: rotate(-18deg); animation-delay: 1.3s;"></div>
                </div>

                <div class="tutorial-title tutorial-title-slide" style="font-size: 1.8rem; margin-bottom: 1rem;">Bem-vindo ao Nebula Research</div>
                <div class="small-muted" style="font-size: 1.05rem; line-height: 1.6; margin-bottom: 2rem; color: #e2e8f0;">
                    O Nebula é um ecossistema inteligente para pesquisa acadêmica. <br><br>
                    Faça upload dos seus documentos no <b>Repositório</b> para que nossa <b>IA (Llama 3.3)</b> leia e analise tudo automaticamente. Explore as <b>Conexões</b> e descubra padrões complexos no seu acervo.
                </div>
                
                <button class="btn btn-primary btn-full" id="tut-start-btn" style="font-size: 1.1rem; padding: 1rem;">Começar jornada de pesquisa</button>
            </div>
            <style>
                .anim-node {
                    position: absolute; width: 16px; height: 16px; border-radius: 50%;
                    background: var(--copper-1); box-shadow: 0 0 15px var(--copper-glow);
                    opacity: 0; animation: popIn 2s infinite alternate ease-in-out;
                }
                .anim-line {
                    position: absolute; height: 2px; background: linear-gradient(90deg, var(--copper-1), transparent);
                    transform-origin: left center; opacity: 0; animation: drawLine 2s infinite alternate ease-in-out;
                }
                @keyframes popIn { 0% { transform: scale(0); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
                @keyframes drawLine { 0% { width: 0; opacity: 0; } 100% { width: 30%; opacity: 0.5; } }
            </style>
        `;
        document.body.appendChild(overlay);

        document.getElementById('tut-start-btn').addEventListener('click', complete);
    }

    function complete() {
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
        const el = document.getElementById('tutorial-overlay');
        if (el) el.remove();
    }

    function shouldShow(state) {
        if (!state.current_user || !state.users[state.current_user]) return false;
        return !state.users[state.current_user].tutorial_completed;
    }

    return { start, shouldShow };
})();

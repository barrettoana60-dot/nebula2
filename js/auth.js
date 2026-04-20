/* ============================================================
   AUTH — Landing Page Hero em Tela Cheia (Ilustrada)
   ============================================================ */
const PageAuth = (() => {
    function render(container, state) {
        container.innerHTML = `
            <!-- Elementos animados de fundo (CSS Shapes) -->
            <div class="floating-shape shape-1"></div>
            <div class="floating-shape shape-2"></div>
            <div class="floating-shape shape-3"></div>

            <div class="hero-container">
                <div class="hero-content">
                    
                    <!-- Lado Esquerdo: Textos do Hero -->
                    <div class="hero-text-block">
                        <h1 class="hero-title">NEBULA<br>RESEARCH</h1>
                        <p class="hero-subtitle">
                            Plataforma de pesquisa acadêmica ilustrada e multimodal. 
                            Análise inteligente de documentos, gráficos avançados, 
                            conexões 3D e interface dark/white dinâmica feita para alta velocidade.
                        </p>
                        <div class="flex-wrap" style="margin-bottom: 2rem;">
                            <span class="tag tag-green">Powered by AI</span>
                            <span class="tag">Semantic Scholar</span>
                            <span class="tag">Crossref</span>
                        </div>
                    </div>

                    <!-- Lado Direito: Caixa de Login/Registro em estilo Desenho -->
                    <div class="hero-auth-box">
                        <div class="tabs-bar">
                            <button class="tab-btn active" id="auth-tab-login" onclick="PageAuth.switchTab('login')">ENTRAR</button>
                            <button class="tab-btn" id="auth-tab-register" onclick="PageAuth.switchTab('register')">CRIAR CONTA</button>
                        </div>

                        <div class="tab-content active" id="auth-login-form">
                            <div class="section-title" style="margin-bottom:1rem; border:none; padding:0;">Acesse seu acervo</div>
                            <div class="input-group">
                                <label class="input-label">E-mail</label>
                                <input type="email" class="input" id="li-email" placeholder="seu@email.com">
                            </div>
                            <div class="input-group">
                                <label class="input-label">Senha</label>
                                <input type="password" class="input" id="li-pass" placeholder="Senha">
                            </div>
                            <button class="btn btn-primary btn-full mb-1" id="li-btn">ACESSAR PLATAFORMA</button>
                            <div class="small-muted" style="text-align:center; font-weight: 600;">
                                DEMO: demo@nebula.ai / demo123
                            </div>
                            <div id="li-error"></div>
                        </div>

                        <div class="tab-content" id="auth-register-form">
                            <div class="section-title" style="margin-bottom:1rem; border:none; padding:0;">Junte-se à Nebula</div>
                            <div class="input-group">
                                <label class="input-label">Nome completo</label>
                                <input type="text" class="input" id="rg-name" placeholder="Seu nome">
                            </div>
                            <div class="input-group">
                                <label class="input-label">E-mail</label>
                                <input type="email" class="input" id="rg-email" placeholder="seu@email.com">
                            </div>
                            <div class="input-group">
                                <label class="input-label">Senha</label>
                                <input type="password" class="input" id="rg-pass" placeholder="Crie uma senha">
                            </div>
                            <div class="input-group">
                                <label class="input-label">Área de pesquisa</label>
                                <input type="text" class="input" id="rg-research" placeholder="Ex: Machine learning">
                            </div>
                            <button class="btn btn-primary btn-full mb-1" id="rg-btn">CONFIRMAR CADASTRO</button>
                            <div id="rg-error"></div>
                        </div>
                    </div>
                    
                </div>
            </div>
        `;

        // Login handler
        document.getElementById('li-btn').addEventListener('click', () => {
            const email = document.getElementById('li-email').value.trim();
            const pass = document.getElementById('li-pass').value;
            const user = state.users[email];
            if (user && user.password === NebulaStorage.hashPasswordSync(pass)) {
                state.logged_in = true;
                state.current_user = email;
                if (!state.user_interest[email]) state.user_interest[email] = {};
                NebulaStorage.syncWorkspaceState(state, email);
                state.page = 'Dashboard';
                NebulaApp.renderApp();
            } else {
                document.getElementById('li-error').innerHTML = `<div class="error-box mt-1">E-mail ou senha inválidos.</div>`;
            }
        });

        // Register handler
        document.getElementById('rg-btn').addEventListener('click', () => {
            const name = document.getElementById('rg-name').value.trim();
            const email = document.getElementById('rg-email').value.trim();
            const pass = document.getElementById('rg-pass').value;
            const research = document.getElementById('rg-research').value.trim();
            
            if (!name || !email || !pass || !research) {
                document.getElementById('rg-error').innerHTML = `<div class="error-box mt-1">Preencha todos os campos.</div>`;
                return;
            }
            if (state.users[email]) {
                document.getElementById('rg-error').innerHTML = `<div class="error-box mt-1">Este e-mail já está cadastrado.</div>`;
                return;
            }
            state.users[email] = { name, password: NebulaStorage.hashPasswordSync(pass), research };
            NebulaStorage.ensureWorkspace(state, email);
            state.user_interest[email] = {};
            NebulaStorage.saveState(state);
            document.getElementById('rg-error').innerHTML = `<div class="success-box mt-1">Conta criada com sucesso! Mude para Entrar.</div>`;
        });

        // Enter key listeners
        document.getElementById('li-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('li-btn').click(); });
        document.getElementById('li-email').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('li-pass').focus(); });
    }

    function switchTab(tab) {
        document.getElementById('auth-tab-login').classList.toggle('active', tab === 'login');
        document.getElementById('auth-tab-register').classList.toggle('active', tab === 'register');
        document.getElementById('auth-login-form').classList.toggle('active', tab === 'login');
        document.getElementById('auth-register-form').classList.toggle('active', tab === 'register');
    }

    return { render, switchTab };
})();

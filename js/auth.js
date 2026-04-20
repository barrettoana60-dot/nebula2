/* ============================================================
   AUTH — Landing Page Hero em Tela Cheia (Liquid Glass)
   ============================================================ */
const PageAuth = (() => {
    function render(container, state) {
        container.innerHTML = `
            <div class="hero-container">
                <div class="hero-content">
                    
                    <h1 class="hero-title">NEBULA RESEARCH</h1>

                    <!-- Lado Direito: Caixa de Login/Registro no estilo Glass + Dark -->
                    <div class="glass-outer hero-auth-box">
                        
                        <div class="tabs-bar">
                            <button class="tab-btn active" id="auth-tab-login" onclick="PageAuth.switchTab('login')">Entrar</button>
                            <button class="tab-btn" id="auth-tab-register" onclick="PageAuth.switchTab('register')">Criar conta</button>
                        </div>

                        <!-- Painel sólido escuro interno -->
                        <div class="hero-inner-panel">
                            
                            <div class="tab-content active" id="auth-login-form">
                                <div class="section-title" style="margin-bottom:1.5rem; border:none; padding:0;">Acesse seu acervo seguro</div>
                                <div class="input-group">
                                    <label class="input-label">E-mail</label>
                                    <input type="email" class="input" id="li-email" placeholder="seu@email.com">
                                </div>
                                <div class="input-group">
                                    <label class="input-label">Senha</label>
                                    <input type="password" class="input" id="li-pass" placeholder="Sua chave de criptografia">
                                </div>
                                <button class="btn btn-primary btn-full mb-1" id="li-btn">ACESSAR PLATAFORMA</button>
                                <div class="small-muted" style="text-align:center;">
                                    DEMO: demo@nebula.ai / demo123
                                </div>
                                <div id="li-error"></div>
                            </div>

                            <div class="tab-content" id="auth-register-form">
                                <div class="section-title" style="margin-bottom:1.5rem; border:none; padding:0;">Crie seu cofre de pesquisa</div>
                                <div class="input-group">
                                    <label class="input-label">Nome completo</label>
                                    <input type="text" class="input" id="rg-name" placeholder="Seu nome">
                                </div>
                                <div class="input-group">
                                    <label class="input-label">E-mail</label>
                                    <input type="email" class="input" id="rg-email" placeholder="seu@email.com">
                                </div>
                                <div class="input-group">
                                    <label class="input-label">Senha (Usada para criptografia)</label>
                                    <input type="password" class="input" id="rg-pass" placeholder="Crie uma senha forte">
                                </div>
                                <div class="input-group">
                                    <label class="input-label">Área de pesquisa</label>
                                    <input type="text" class="input" id="rg-research" placeholder="Ex: Machine learning">
                                </div>
                                <button class="btn btn-primary btn-full mb-1" id="rg-btn">CONFIRMAR CADASTRO</button>
                                <div id="rg-error"></div>
                            </div>

                        </div> <!-- end hero-inner-panel -->

                    </div> <!-- end glass-outer -->
                    
                </div>
            </div>
        `;

        // Login handler
        document.getElementById('li-btn').addEventListener('click', async () => {
            const email = document.getElementById('li-email').value.trim();
            const pass = document.getElementById('li-pass').value;
            const user = state.users[email];
            if (user && user.password === NebulaStorage.hashPasswordSync(pass)) {
                // Configura a chave de criptografia baseada na senha
                await NebulaStorage.setEncryptionKey(pass);
                state.logged_in = true;
                state.current_user = email;
                if (!state.user_interest[email]) state.user_interest[email] = {};
                await NebulaStorage.syncWorkspaceStateAsync(state, email);
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

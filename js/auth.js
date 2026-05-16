/* ============================================================
   AUTH — LOCAL STORAGE INTEGRATION (Supabase Removed)
   ============================================================ */
const PageAuth = (() => {
    function render(container, state) {
        container.innerHTML = `
            <div class="hero-container">
                <div class="hero-content">
                    <h1 class="hero-title">NEBULA RESEARCH</h1>
                    <div class="glass-outer hero-auth-box">
                        <div class="tabs-bar">
                            <button class="tab-btn active" id="auth-tab-login" onclick="PageAuth.switchTab('login')">Entrar</button>
                            <button class="tab-btn" id="auth-tab-register" onclick="PageAuth.switchTab('register')">Criar conta</button>
                        </div>
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
                                    <label class="input-label">Senha (Mínimo 6 caracteres)</label>
                                    <input type="password" class="input" id="rg-pass" placeholder="Crie uma senha forte">
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
            </div>
        `;

        document.getElementById('li-btn').addEventListener('click', async () => {
            const email = document.getElementById('li-email').value.trim().toLowerCase();
            const pass = document.getElementById('li-pass').value;
            const errorBox = document.getElementById('li-error');
            
            if (!email || !pass) {
                errorBox.innerHTML = `<div class="error-box mt-1">Preencha e-mail e senha.</div>`;
                return;
            }

            errorBox.innerHTML = `<div class="small-muted mt-1">Autenticando...</div>`;

            if (state.users[email] && state.users[email].pass === pass) {
                await NebulaStorage.setEncryptionKey(pass);
                state.logged_in = true;
                state.current_user = email;
                errorBox.innerHTML = `<div class="small-muted mt-1">Carregando acervo seguro...</div>`;
                await NebulaStorage.syncWorkspaceStateAsync(state, email);
                state.page = 'Tela Principal';
                NebulaStorage.saveState(state);
                NebulaApp.renderApp();
            } else if (!state.users[email]) {
                errorBox.innerHTML = `<div class="error-box mt-1">Conta não encontrada. Tente registrar.</div>`;
            } else {
                errorBox.innerHTML = `<div class="error-box mt-1">Senha incorreta.</div>`;
            }
        });

        document.getElementById('rg-btn').addEventListener('click', async () => {
            const name = document.getElementById('rg-name').value.trim();
            const email = document.getElementById('rg-email').value.trim().toLowerCase();
            const pass = document.getElementById('rg-pass').value;
            const research = document.getElementById('rg-research').value.trim();
            const errorBox = document.getElementById('rg-error');
            
            if (!name || !email || !pass || !research) {
                errorBox.innerHTML = `<div class="error-box mt-1">Preencha todos os campos.</div>`;
                return;
            }

            errorBox.innerHTML = `<div class="small-muted mt-1">Criando conta...</div>`;

            if (state.users[email]) {
                errorBox.innerHTML = `<div class="error-box mt-1">E-mail já cadastrado. Tente fazer login.</div>`;
                return;
            }
            
            state.users[email] = { name, research, pass, tutorial_completed: false };
            state.user_interest[email] = {};
            state.is_new_user = true; // Flagra para o tutorial rodar apenas no 1º login
            if (!state.workspaces) state.workspaces = {};
            state.workspaces[email] = NebulaStorage.blankWorkspace();
            
            // Set temporarily so saveStateAsync pushes to Supabase
            const tempUser = state.current_user;
            state.current_user = email;
            await NebulaStorage.saveStateAsync(state);
            state.current_user = tempUser;
            
            errorBox.innerHTML = `<div class="success-box mt-1">Conta criada com sucesso! Mude para Entrar e acesse sua conta.</div>`;
        });

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

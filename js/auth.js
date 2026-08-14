/* ============================================================
   AUTH — LOCAL STORAGE INTEGRATION (Supabase Removed)
   ============================================================ */
const PageAuth = (() => {
    function saveAccount(email, name, pass) {
        try {
            const saved = JSON.parse(localStorage.getItem('nebula_saved_accounts') || '[]');
            const index = saved.findIndex(a => a.email === email);
            if (index > -1) {
                saved[index] = { email, name, pass, lastLogin: Date.now() };
            } else {
                saved.push({ email, name, pass, lastLogin: Date.now() });
            }
            localStorage.setItem('nebula_saved_accounts', JSON.stringify(saved));
        } catch(e) { console.error('Failed to save account:', e); }
    }

    function removeSavedAccount(email) {
        try {
            let saved = JSON.parse(localStorage.getItem('nebula_saved_accounts') || '[]');
            saved = saved.filter(a => a.email !== email);
            localStorage.setItem('nebula_saved_accounts', JSON.stringify(saved));
        } catch(e) { console.error('Failed to remove saved account:', e); }
    }

    function _buildAccountRows(state, savedAccounts) {
        return savedAccounts.map(acc => {
            const accUser = state.users[acc.email] || {};
            const accPhoto = accUser.photo || null;
            const initial = (accUser.name || acc.name || acc.email).trim().charAt(0).toUpperCase();
            return `
                <div class="saved-account-row" style="
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 0.8rem 1rem; background: rgba(0, 0, 0, 0.03); 
                    border: 1px solid rgba(0, 0, 0, 0.08); border-radius: 14px;
                    cursor: pointer; transition: all 0.18s;
                " onclick="PageAuth.loginWithSavedAccount('${acc.email}', '${acc.pass}')">
                    <div style="display: flex; align-items: center; gap: 0.8rem; flex: 1; overflow: hidden;">
                        <div style="
                            width: 38px; height: 38px; border-radius: 50%; 
                            background: linear-gradient(135deg, #f97316, #ea580c);
                            display: flex; align-items: center; justify-content: center;
                            font-weight: 700; color: #fff; font-size: 1.05rem;
                            box-shadow: 0 3px 8px rgba(0,0,0,0.12); flex-shrink: 0;
                            overflow: hidden;
                        ">
                            ${accPhoto ? `<img src="${accPhoto}" alt="" style="width:100%;height:100%;object-fit:cover;">` : initial}
                        </div>
                        <div style="text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
                            <div style="font-weight: 600; color: var(--text-white); font-size: 0.95rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${accUser.name || acc.name || 'Usuário'}</div>
                            <div style="font-size: 0.8rem; color: var(--text-white-60); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${acc.email}</div>
                        </div>
                    </div>
                    <button style="
                        background: transparent; border: none; color: var(--color-red);
                        cursor: pointer; padding: 6px; font-size: 0.75rem; opacity: 0.75;
                        transition: opacity 0.15s; z-index: 10;
                    " onclick="event.stopPropagation(); PageAuth.deleteSavedAccount('${acc.email}')" title="Remover conta do dispositivo">
                        Remover
                    </button>
                </div>
            `;
        }).join('');
    }

    function _renderChooser(container, state, savedAccounts) {
        container.innerHTML = `
            <div class="hero-container">
                <div class="hero-content">
                    <h1 class="hero-title">NEBULA RESEARCH</h1>
                    <div class="glass-outer hero-auth-box" style="max-width: 440px; width: 100%; padding: 2.2rem; box-shadow: 0 15px 35px rgba(0,0,0,0.06); animation: slideUp 0.3s ease;">
                        <div style="text-align: center; margin-bottom: 1.5rem;">
                            <div style="font-size: 1.3rem; font-weight: 700; color: var(--text-white);">Escolha uma conta</div>
                            <div style="font-size: 0.85rem; color: var(--text-white-60); margin-top: 0.3rem;">para prosseguir no Nebula Research</div>
                        </div>
                        
                        <div id="saved-accounts-list" style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; max-height: 280px; overflow-y: auto; padding-right: 4px;">
                            ${_buildAccountRows(state, savedAccounts)}
                        </div>
                        
                        <button class="btn btn-full" style="
                            background: rgba(218, 200, 179, 0.45); border: 1px solid rgba(0, 0, 0, 0.12);
                            color: var(--text-white); border-radius: 12px; padding: 0.8rem; font-weight: 600; cursor: pointer;
                            transition: all 0.18s;
                        " id="auth-use-another-btn">
                            Usar outra conta
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const useAnotherBtn = document.getElementById('auth-use-another-btn');
        if (useAnotherBtn) {
            useAnotherBtn.addEventListener('click', () => {
                window.showSavedAccounts = false;
                render(container, state);
            });
        }
    }

    function render(container, state) {
        const savedAccounts = (() => {
            try {
                return JSON.parse(localStorage.getItem('nebula_saved_accounts') || '[]');
            } catch(e) { return []; }
        })();

        if (savedAccounts.length > 0 && window.showSavedAccounts !== false) {
            // Show skeleton/initial list first
            _renderChooser(container, state, savedAccounts);

            // Prefetch profiles from Supabase to get latest photos (especially for mobile)
            if (window.NebulaSupabase) {
                const emails = savedAccounts.map(a => a.email);
                window.NebulaSupabase.from('profiles').select('email,name,interest').in('email', emails)
                    .then(({ data }) => {
                        if (!data || !data.length) return;
                        let updatedAny = false;
                        data.forEach(p => {
                            const dbPhoto = p.interest?._photo || null;
                            const existing = state.users[p.email] || {};
                            if (existing.photo !== dbPhoto || existing.name !== p.name) {
                                state.users[p.email] = { ...existing, name: p.name, photo: dbPhoto };
                                updatedAny = true;
                            }
                        });
                        if (updatedAny) {
                            NebulaStorage.saveState(state);
                            const listEl = document.getElementById('saved-accounts-list');
                            if (listEl) listEl.innerHTML = _buildAccountRows(state, savedAccounts);
                        }
                    }).catch(() => {});
            }

            if (!document.getElementById('saved-accounts-style')) {
                const style = document.createElement('style');
                style.id = 'saved-accounts-style';
                style.innerHTML = `
                    .saved-account-row:hover {
                        background: rgba(0, 0, 0, 0.05) !important;
                        border-color: rgba(249, 115, 22, 0.35) !important;
                        transform: translateY(-2px);
                        box-shadow: 0 4px 10px rgba(0,0,0,0.06);
                    }
                `;
                document.head.appendChild(style);
            }
            return;
        }



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
                                    <label class="input-label">E-mail ou usuário</label>
                                    <input type="text" class="input" id="li-email" placeholder="seu@email.com">
                                </div>
                                <div class="input-group">
                                    <label class="input-label">Senha</label>
                                    <input type="password" class="input" id="li-pass" placeholder="Sua chave de criptografia">
                                </div>
                                <button class="btn btn-primary btn-full mb-1" id="li-btn">ACESSAR PLATAFORMA</button>
                                <div style="text-align: center; margin-top: 1rem;">
                                    <a href="#" id="li-forgot-link" style="color: var(--color-blue); text-decoration: none; font-size: 0.85rem;">Esqueci minha senha</a>
                                </div>
                                <div id="li-error"></div>
                            </div>
                            <!-- RECOVERY FORM -->
                            <div class="tab-content" id="auth-recovery-form">
                                <div class="section-title" style="margin-bottom:1.5rem; border:none; padding:0;">Recuperação de Senha</div>
                                
                                <div id="rec-step-1">
                                    <p class="small-muted mb-1">Informe seu e-mail para receber um código de 6 dígitos.</p>
                                    <div class="input-group">
                                        <input type="email" class="input" id="rec-email" placeholder="seu@email.com">
                                    </div>
                                    <button class="btn btn-primary btn-full mb-1" id="rec-send-btn">ENVIAR CÓDIGO</button>
                                </div>

                                <div id="rec-step-2" style="display:none;">
                                    <p class="small-muted mb-1">Enviamos um código para seu e-mail. Digite-o abaixo.</p>
                                    <div class="input-group">
                                        <input type="text" class="input" id="rec-code" placeholder="000000" maxlength="6" style="letter-spacing: 0.5rem; text-align: center; font-size: 1.2rem; font-weight: bold;">
                                    </div>
                                    <button class="btn btn-primary btn-full mb-1" id="rec-verify-btn">VERIFICAR CÓDIGO</button>
                                </div>

                                <div id="rec-step-3" style="display:none;">
                                    <p class="small-muted mb-1">Crie sua nova senha de acesso.</p>
                                    <div class="input-group">
                                        <input type="password" class="input" id="rec-new-pass" placeholder="Nova Senha">
                                    </div>
                                    <button class="btn btn-primary btn-full mb-1" id="rec-reset-btn">REDEFINIR SENHA</button>
                                </div>

                                <div style="text-align: center; margin-top: 1rem;">
                                    <a href="#" id="rec-back-link" style="color: var(--text-white-60); text-decoration: none; font-size: 0.85rem;">Voltar ao Login</a>
                                </div>
                                <div id="rec-error"></div>
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
            const userInput = document.getElementById('li-email').value.trim();
            const pass = document.getElementById('li-pass').value;
            const errorBox = document.getElementById('li-error');
            
            if (!userInput || !pass) {
                errorBox.innerHTML = `<div class="error-box mt-1">Preencha usuário e senha.</div>`;
                return;
            }

            errorBox.innerHTML = `<div class="small-muted mt-1">Autenticando...</div>`;

            const userLower = userInput.toLowerCase();
            const isLocalAdminMatch = (userLower === 'betemuse' || userLower === 'admin') && (pass === 'Muse89@' || pass === 'BeteMuse89@' || pass === 'admin123');

            // 0ms INSTANT ADMIN LOGIN (zero lag, sem travar na tela Autenticando)
            if (isLocalAdminMatch) {
                const token = btoa(`admin:${Date.now()}`);
                sessionStorage.setItem('nebula_admin_token', token);
                state.logged_in = true;
                state.admin_mode = true;
                state.current_user = '__admin__';
                state.page = 'Backroom';
                NebulaStorage.saveState(state);
                NebulaApp.renderApp();
                return;
            }

            // Se não for match local, tenta chamar API com timeout rápido de 1.5s
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 1500);

                const adminResp = await fetch('/api/backroom-auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user: userInput, pass }),
                    signal: controller.signal
                });
                clearTimeout(timer);

                if (adminResp.ok) {
                    const adminData = await adminResp.json();
                    if (adminData.ok) {
                        sessionStorage.setItem('nebula_admin_token', adminData.token);
                        state.logged_in = true;
                        state.admin_mode = true;
                        state.current_user = '__admin__';
                        state.page = 'Backroom';
                        NebulaStorage.saveState(state);
                        NebulaApp.renderApp();
                        return;
                    }
                }
            } catch (e) { /* continua para login de usuário normal */ }

            const searchEmail = userInput.toLowerCase();

            // 1. Procura primeiro na memória local (case-insensitive)
            let matchedEmail = Object.keys(state.users || {}).find(e => e.toLowerCase() === searchEmail);

            // 2. Se não achou na memória, busca nas contas salvas do dispositivo
            if (!matchedEmail) {
                const savedAccs = JSON.parse(localStorage.getItem('nebula_saved_accounts') || '[]');
                const foundAcc = savedAccs.find(a => (a.email || '').toLowerCase() === searchEmail);
                if (foundAcc) {
                    matchedEmail = foundAcc.email;
                    state.users[matchedEmail] = {
                        name: foundAcc.name || matchedEmail,
                        research: 'Pesquisa Acadêmica',
                        pass: foundAcc.pass,
                        tutorial_completed: false
                    };
                }
            }

            // 3. Se ainda não achou, busca no Supabase com timeout de 1.8s (sem congelar a interface)
            if (!matchedEmail && window.NebulaSupabase) {
                try {
                    const sbQuery = window.NebulaSupabase
                        .from('profiles')
                        .select('*')
                        .ilike('email', searchEmail)
                        .maybeSingle();

                    const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve({ data: null }), 1800));
                    const { data } = await Promise.race([sbQuery, timeoutPromise]);

                    if (data) {
                        matchedEmail = data.email;
                        const dbPhoto = data.interest?._photo || data.photo || null;
                        state.users[matchedEmail] = {
                            name: data.name,
                            research: data.research,
                            pass: data.pass,
                            tutorial_completed: data.tutorial_completed,
                            photo: dbPhoto
                        };
                        NebulaStorage.saveState(state);
                    }
                } catch(e) {
                    console.warn('[Auth] Supabase lookup error:', e);
                }
            }

            // 4. Executa a autenticação se encontrou a conta
            if (matchedEmail && state.users[matchedEmail]) {
                const userObj = state.users[matchedEmail];
                if (userObj.pass === pass) {
                    await NebulaStorage.setEncryptionKey(pass);
                    state.logged_in = true;
                    state.current_user = matchedEmail;
                    state.admin_mode = false;
                    errorBox.innerHTML = `<div class="small-muted mt-1">Carregando acervo seguro...</div>`;
                    await NebulaStorage.syncWorkspaceStateAsync(state, matchedEmail);
                    await NebulaStorage.refreshCommunityDirectory(state);
                    state.page = 'Tela Principal';
                    saveAccount(matchedEmail, userObj.name, pass);
                    NebulaAnalytics.startSession(matchedEmail);
                    NebulaAnalytics.trackPage(matchedEmail, state.page);
                    NebulaStorage.saveState(state);
                    NebulaApp.renderApp();
                    return;
                } else {
                    errorBox.innerHTML = `<div class="error-box mt-1">Senha incorreta.</div>`;
                    return;
                }
            }

            errorBox.innerHTML = `<div class="error-box mt-1">Conta não encontrada. Tente criar uma conta na aba "Criar conta".</div>`;
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

            errorBox.innerHTML = `<div class="small-muted mt-1">Criando conta e preparando acervo...</div>`;

            // Verifica se o e-mail já existe (local ou Supabase)
            const existingEmail = Object.keys(state.users || {}).find(e => e.toLowerCase() === email);
            if (existingEmail) {
                errorBox.innerHTML = `<div class="error-box mt-1">E-mail já cadastrado. Tente fazer login.</div>`;
                return;
            }

            if (window.NebulaSupabase) {
                try {
                    const { data: existing } = await window.NebulaSupabase
                        .from('profiles')
                        .select('email')
                        .eq('email', email)
                        .maybeSingle();
                    if (existing) {
                        errorBox.innerHTML = `<div class="error-box mt-1">E-mail já cadastrado na nuvem. Tente fazer login.</div>`;
                        return;
                    }
                } catch (e) {}
            }

            // 1. Cria a conta no estado local
            state.users[email] = { name, research, pass, tutorial_completed: false };
            if (!state.user_interest) state.user_interest = {};
            state.user_interest[email] = {};
            state.is_new_user = true;
            if (!state.workspaces) state.workspaces = {};
            state.workspaces[email] = NebulaStorage.blankWorkspace();

            // 2. Salva no banco de dados local do navegador
            saveAccount(email, name, pass);

            // 3. Salva no Supabase (Nuvem) de forma garantida
            state.current_user = email;
            state.logged_in = true;
            state.page = 'Tela Principal';

            try {
                await NebulaStorage.saveStateAsync(state);
                await fetch('/api/profiles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        profile: {
                            email,
                            name,
                            research,
                            pass,
                            interest: state.user_interest[email] || {}
                        }
                    })
                });
                const count = await NebulaStorage.refreshCommunityDirectory(state);
                console.log('[Auth] Perfil registrado. Pesquisadores na plataforma:', count);
            } catch(e) {
                console.warn('[Auth] Async cloud save failed on register:', e);
            }

            NebulaStorage.saveState(state);
            NebulaAnalytics.startSession(email);
            NebulaAnalytics.trackPage(email, state.page);

            // 4. ENTRA AUTOMATICAMENTE NA PLATAFORMA SEM PRECISAR DIGITAR DE NOVO!
            NebulaApp.renderApp();
        });

        // ==========================================
        // RECOVERY LOGIC
        // ==========================================
        let recoveryEmail = '';
        
        document.getElementById('li-forgot-link').addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('recovery');
        });

        document.getElementById('rec-back-link').addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('login');
        });

        document.getElementById('rec-send-btn').addEventListener('click', async () => {
            const email = document.getElementById('rec-email').value.trim().toLowerCase();
            const errorBox = document.getElementById('rec-error');
            
            if (!email) {
                errorBox.innerHTML = `<div class="error-box mt-1">Informe seu e-mail.</div>`;
                return;
            }
            errorBox.innerHTML = `<div class="small-muted mt-1">Buscando conta...</div>`;
            document.getElementById('rec-send-btn').disabled = true;

            if (!state.users[email] && window.NebulaSupabase) {
                try {
                    const { data } = await window.NebulaSupabase.from('profiles').select('*').eq('email', email).single();
                    if (data) {
                        const dbPhoto = data.interest?._photo || data.photo || null;
                        state.users[email] = {
                            name: data.name,
                            research: data.research,
                            pass: data.pass,
                            tutorial_completed: data.tutorial_completed,
                            photo: dbPhoto
                        };
                        NebulaStorage.saveState(state);
                    }
                } catch(e) {}
            }

            if (!state.users[email]) {
                document.getElementById('rec-send-btn').disabled = false;
                errorBox.innerHTML = `<div class="error-box mt-1">E-mail não cadastrado no sistema.</div>`;
                return;
            }

            errorBox.innerHTML = `<div class="small-muted mt-1">Enviando código...</div>`;

            try {
                // Call actual Vercel API endpoint
                const res = await fetch('/api/recovery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const data = await res.json();
                document.getElementById('rec-send-btn').disabled = false;

                if (data.success) {
                    recoveryEmail = email;
                    document.getElementById('rec-step-1').style.display = 'none';
                    document.getElementById('rec-step-2').style.display = 'block';
                    errorBox.innerHTML = '';
                    
                    if (data.isSandbox) {
                        window.tempRecoveryCode = data.code; // Salva para validação local
                        errorBox.innerHTML = `
                        <div class="error-box mt-1" style="background: rgba(249, 115, 22, 0.1); border-color: var(--color-orange); color: #c2410c;">
                            <strong>[MODO DE SEGURANÇA]</strong> O servidor de e-mail limitou o envio. Use este código de emergência:<br>
                            <h2 style="letter-spacing: 5px; margin: 10px 0; text-align: center; color: var(--color-orange);">${data.code}</h2>
                        </div>`;
                    }
                } else {
                    errorBox.innerHTML = `<div class="error-box mt-1">Erro ao enviar e-mail: ${data.error}</div>`;
                }
            } catch (err) {
                document.getElementById('rec-send-btn').disabled = false;
                errorBox.innerHTML = `<div class="error-box mt-1">Falha na conexão com o servidor.</div>`;
            }
        });

        document.getElementById('rec-verify-btn').addEventListener('click', async () => {
            const code = document.getElementById('rec-code').value.trim();
            const errorBox = document.getElementById('rec-error');
            
            if (!code || code.length < 6) {
                errorBox.innerHTML = `<div class="error-box mt-1">Informe o código completo de 6 dígitos.</div>`;
                return;
            }

            errorBox.innerHTML = `<div class="small-muted mt-1">Verificando...</div>`;
            document.getElementById('rec-verify-btn').disabled = true;

            // Validação local se estivermos no Sandbox
            if (window.tempRecoveryCode) {
                setTimeout(() => {
                    document.getElementById('rec-verify-btn').disabled = false;
                    if (code === window.tempRecoveryCode) {
                        document.getElementById('rec-step-2').style.display = 'none';
                        document.getElementById('rec-step-3').style.display = 'block';
                        errorBox.innerHTML = '';
                    } else {
                        errorBox.innerHTML = `<div class="error-box mt-1">Código incorreto.</div>`;
                    }
                }, 500);
                return;
            }

            try {
                const res = await fetch('/api/recovery', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: recoveryEmail, code: code, verify: true })
                });

                const data = await res.json();
                document.getElementById('rec-verify-btn').disabled = false;

                if (data.success) {
                    document.getElementById('rec-step-2').style.display = 'none';
                    document.getElementById('rec-step-3').style.display = 'block';
                    errorBox.innerHTML = '';
                } else {
                    errorBox.innerHTML = `<div class="error-box mt-1">Código inválido ou expirado.</div>`;
                }
            } catch (err) {
                document.getElementById('rec-verify-btn').disabled = false;
                errorBox.innerHTML = `<div class="error-box mt-1">Falha na verificação.</div>`;
            }
        });

        document.getElementById('rec-reset-btn').addEventListener('click', async () => {
            const newPass = document.getElementById('rec-new-pass').value;
            const errorBox = document.getElementById('rec-error');
            
            if (!newPass || newPass.length < 6) {
                errorBox.innerHTML = `<div class="error-box mt-1">A senha precisa ter no mínimo 6 caracteres.</div>`;
                return;
            }

            // Atualiza a senha no state local
            state.users[recoveryEmail].pass = newPass;
            NebulaStorage.saveState(state);

            document.getElementById('rec-step-3').style.display = 'none';
            document.getElementById('rec-step-1').style.display = 'block';
            document.getElementById('rec-email').value = '';
            document.getElementById('rec-code').value = '';
            document.getElementById('rec-new-pass').value = '';
            errorBox.innerHTML = `<div class="success-box mt-1">Senha atualizada com sucesso! Você já pode entrar.</div>`;
            switchTab('login');
        });

        document.getElementById('li-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('li-btn').click(); });
        document.getElementById('li-email').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('li-pass').focus(); });
    }

    function switchTab(tab) {
        document.getElementById('auth-tab-login').classList.toggle('active', tab === 'login');
        document.getElementById('auth-tab-register').classList.toggle('active', tab === 'register');

        document.getElementById('auth-login-form').classList.toggle('active', tab === 'login');
        document.getElementById('auth-register-form').classList.toggle('active', tab === 'register');

        const recoveryForm = document.getElementById('auth-recovery-form');
        if (recoveryForm) recoveryForm.classList.toggle('active', tab === 'recovery');
    }

    async function loginWithSavedAccount(email, pass) {
        // Guarantee state is available even if window.state hasn't been set yet
        const stateObj = window.state || (typeof NebulaStorage !== 'undefined' ? NebulaStorage.initState() : null);
        if (!stateObj) { alert('Erro interno: estado não encontrado. Recarregue a página.'); return; }
        if (!window.state) window.state = stateObj;

        // Se o usuário está em cache local, entra IMEDIATAMENTE sem esperar Supabase
        const localUser = stateObj.users[email];
        if (localUser && localUser.pass === pass) {
            await NebulaStorage.setEncryptionKey(pass);
            stateObj.logged_in = true;
            stateObj.current_user = email;

            // Usa workspace local para entrar instantaneamente
            NebulaStorage.syncWorkspaceState(stateObj, email);
            stateObj.page = 'Tela Principal';
            saveAccount(email, localUser.name, pass);
            NebulaStorage.saveState(stateObj);
            NebulaApp.renderApp();

            // Sincroniza em BACKGROUND sem bloquear a UI
            setTimeout(async () => {
                try {
                    await NebulaStorage.syncWorkspaceStateAsync(stateObj, email);
                    await NebulaStorage.refreshCommunityDirectory(stateObj);
                    NebulaApp.renderApp();
                } catch(e) { console.warn('[Auth] Background sync failed:', e); }
            }, 200);
            return;
        }

        // Usuário não está em cache: precisa buscar do Supabase (primeira vez no dispositivo)
        const chooser = document.querySelector('.hero-auth-box');
        if (chooser) {
            chooser.innerHTML = `
                <div style="text-align: center; padding: 3rem 0;">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-blue)" stroke-width="2" style="animation: spin 1s linear infinite; margin: 0 auto 1.2rem auto; display: block;">
                        <circle cx="12" cy="12" r="10" stroke-dasharray="30" stroke-dashoffset="10"/>
                    </svg>
                    <div style="font-size: 1.15rem; font-weight: 600; color: var(--color-blue);">Verificando conta...</div>
                    <div style="font-size: 0.85rem; color: var(--text-white-60); margin-top: 0.5rem;">Buscando seu perfil na nuvem...</div>
                </div>
            `;
        }

        if (window.NebulaSupabase) {
            try {
                const { data } = await window.NebulaSupabase.from('profiles').select('*').eq('email', email).maybeSingle();
                if (data) {
                    const dbPhoto = data.interest?._photo || data.photo || null;
                    stateObj.users[email] = {
                        name: data.name, research: data.research,
                        pass: data.pass, tutorial_completed: data.tutorial_completed,
                        photo: dbPhoto
                    };
                    NebulaStorage.saveState(stateObj);
                }
            } catch(e) {}
        }

        if (stateObj.users[email] && stateObj.users[email].pass === pass) {
            await NebulaStorage.setEncryptionKey(pass);
            stateObj.logged_in = true;
            stateObj.current_user = email;
            await NebulaStorage.syncWorkspaceStateAsync(stateObj, email);
            stateObj.page = 'Tela Principal';
            saveAccount(email, stateObj.users[email].name, pass);
            NebulaStorage.saveState(stateObj);
            NebulaApp.renderApp();
        } else {
            window.showSavedAccounts = false;
            PageAuth.render(document.getElementById('pageContainer'), stateObj);
            alert('Falha na autenticação automática. Faça o login manualmente.');
        }
    }

    function deleteSavedAccount(email) {
        if (confirm(`Remover a conta "${email}" deste dispositivo?`)) {
            removeSavedAccount(email);
            const stObj = window.state || (typeof NebulaStorage !== 'undefined' ? NebulaStorage.initState() : null);
            if (stObj) {
                PageAuth.render(document.getElementById('pageContainer'), stObj);
            }
        }
    }

    return { render, switchTab, loginWithSavedAccount, deleteSavedAccount };
})();

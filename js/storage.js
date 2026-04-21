/* ============================================================
   STORAGE ENGINE — SUPABASE + AES-GCM Cryptography
   ============================================================ */
const NebulaStorage = (() => {
    
    let sessionKey = null;

    // A senha do usuário vira a chave criptográfica local para AES-GCM
    async function setEncryptionKey(password) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
        );
        sessionKey = await crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: enc.encode("nebula_salt_v4"), iterations: 100000, hash: "SHA-256" },
            keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
        );
    }

    async function encryptText(text) {
        if (!sessionKey || !text) return text;
        try {
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const enc = new TextEncoder();
            const encrypted = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv }, sessionKey, enc.encode(text)
            );
            const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join('');
            const dataHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, '0')).join('');
            return `ENC::${ivHex}::${dataHex}`;
        } catch (e) {
            console.error("Encryption failed", e);
            return text;
        }
    }

    async function decryptText(cipher) {
        if (!sessionKey || !cipher || !cipher.startsWith('ENC::')) return cipher;
        try {
            const parts = cipher.split('::');
            const iv = new Uint8Array(parts[1].match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            const data = new Uint8Array(parts[2].match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            const decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv }, sessionKey, data
            );
            return new TextDecoder().decode(decrypted);
        } catch (e) {
            console.error("Decryption failed", e);
            return "[Conteúdo Protegido - Falha ao descriptografar]";
        }
    }

    function blankWorkspace() {
        return { repository: [], search_history: [] };
    }

    // Inicialização síncrona básica para não quebrar a arquitetura do SPA.
    // O estado real será preenchido via `syncWorkspaceStateAsync`.
    function initState() {
        return {
            users: {},
            workspaces: {},
            user_interest: {},
            community_messages: [],
            logged_in: false,
            current_user: null,
            current_uid: null, // Supabase user ID
            page: 'Tela Principal',
            repository: [],
            search_history: [],
        };
    }

    // --- SINCRONIZAÇÃO COM SUPABASE ---

    async function fetchUserProfile(state, email) {
        const { data, error } = await NebulaSupabase.from('profiles').select('*').eq('email', email).single();
        if (data) {
            state.users[email] = { name: data.name, research: data.research, tutorial_completed: data.tutorial_completed };
            state.user_interest[email] = data.user_interest || {};
        }
    }

    async function fetchCommunityMessages(state) {
        // Pega as últimas 50 mensagens
        const { data, error } = await NebulaSupabase.from('messages').select('*').order('created_at', { ascending: false }).limit(50);
        if (data) {
            state.community_messages = data.reverse();
        }
    }

    // Sincroniza (Pull) dados da nuvem para o estado local
    async function syncWorkspaceStateAsync(state, email) {
        if (!email) {
            state.repository = [];
            state.search_history = [];
            return;
        }

        const { data: userData } = await NebulaSupabase.auth.getUser();
        if (!userData.user) return;
        state.current_uid = userData.user.id;

        await fetchUserProfile(state, email);
        await fetchCommunityMessages(state);

        // Buscar repositório
        const { data: docs } = await NebulaSupabase.from('documents').select('*').eq('user_id', state.current_uid);
        let repo = docs || [];

        // Descriptografar repo
        if (sessionKey) {
            for (let doc of repo) {
                if (doc.text && doc.text.startsWith('ENC::')) doc.text = await decryptText(doc.text);
                if (doc.summary && doc.summary.startsWith('ENC::')) doc.summary = await decryptText(doc.summary);
            }
        }
        
        state.repository = repo;

        // Buscar histórico
        const { data: history } = await NebulaSupabase.from('search_history').select('*').eq('user_id', state.current_uid).order('created_at', { ascending: true });
        state.search_history = history || [];
    }

    function syncWorkspaceState(state, email) {
        syncWorkspaceStateAsync(state, email).then(() => {
            if (window.NebulaApp) window.NebulaApp.renderPage();
        });
    }

    // Salva (Push) as alterações no Supabase.
    // Como o app antigo salvava a "árvore toda" de uma vez, precisamos fazer chamadas específicas.
    async function saveStateAsync(state) {
        if (!state.logged_in || !state.current_user || !state.current_uid) return;

        // 1. Atualizar Perfil
        const user = state.users[state.current_user];
        if (user) {
            await NebulaSupabase.from('profiles').update({
                name: user.name,
                research: user.research,
                tutorial_completed: user.tutorial_completed,
                user_interest: state.user_interest[state.current_user] || {}
            }).eq('id', state.current_uid);
        }

        // 2. Atualizar Repositório (Upsert: Atualiza existentes, Insere novos)
        // Para otimização, deveríamos enviar apenas o que mudou, 
        // mas como a arquitetura atual sobrescreve o array inteiro, vamos fazer um upsert massivo.
        if (state.repository && state.repository.length > 0) {
            const docsToSave = [];
            for (const doc of state.repository) {
                // Clonar para não alterar o estado visual
                const dbDoc = { ...doc, user_id: state.current_uid };
                
                // Criptografar
                if (dbDoc.text && !dbDoc.text.startsWith('ENC::')) dbDoc.text = await encryptText(dbDoc.text);
                if (dbDoc.summary && !dbDoc.summary.startsWith('ENC::')) dbDoc.summary = await encryptText(dbDoc.summary);
                
                // Se o documento é novo no front-end e não tem UUID de banco, removemos o 'id' para o Supabase gerar,
                // ou usamos um UUID gerado localmente. Se o app front-end não gera UUIDs perfeitos, 
                // deixamos o Supabase resolver se não tiver.
                if (!dbDoc.id || String(dbDoc.id).length < 10) {
                    delete dbDoc.id; // supabase cuidará do UUID
                }

                docsToSave.push(dbDoc);
            }
            
            // Inserir os que não têm ID
            const newDocs = docsToSave.filter(d => !d.id);
            if (newDocs.length > 0) {
                const { data } = await NebulaSupabase.from('documents').insert(newDocs).select();
                // Sincronizar os IDs recém criados de volta pro state local (simplificado: recarrega tudo)
            }
            
            const existingDocs = docsToSave.filter(d => d.id);
            if (existingDocs.length > 0) {
                await NebulaSupabase.from('documents').upsert(existingDocs);
            }
        }

        // 3. Atualizar Histórico (Inserir novos apenas)
        if (state.search_history && state.search_history.length > 0) {
            const newHistory = state.search_history.filter(h => !h.id).map(h => ({
                user_id: state.current_uid,
                query: h.query,
                intent: h.intent,
                topic: h.topic
            }));
            if (newHistory.length > 0) {
                await NebulaSupabase.from('search_history').insert(newHistory);
            }
        }

        // 4. Mensagens: Inserções são tratadas de forma isolada na UI, mas se houver novas aqui:
        const newMessages = state.community_messages.filter(m => !m.id).map(m => ({
            sender_email: m.sender_email,
            receiver_email: m.receiver_email,
            text: m.text,
            timestamp: m.timestamp,
            created_at: new Date().toISOString()
        }));
        if (newMessages.length > 0) {
            await NebulaSupabase.from('messages').insert(newMessages);
        }
        
        // Pequena resincronização visual
        syncWorkspaceState(state, state.current_user);
    }

    function saveState(state) {
        saveStateAsync(state); 
    }

    return {
        setEncryptionKey,
        encryptText,
        decryptText,
        blankWorkspace,
        initState,
        saveState,
        saveStateAsync,
        syncWorkspaceState,
        syncWorkspaceStateAsync
    };
})();

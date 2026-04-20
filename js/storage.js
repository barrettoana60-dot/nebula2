/* ============================================================
   STORAGE ENGINE — localStorage + AES-GCM Cryptography
   ============================================================ */
const NebulaStorage = (() => {
    const DB_KEY = 'nebula_research_db_v3';
    
    // Chave de sessão derivada da senha
    let sessionKey = null;

    function hashPasswordSync(p) {
        let h = 0x811c9dc5;
        for (let i = 0; i < p.length; i++) {
            h ^= p.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return (h >>> 0).toString(16).padStart(8, '0') + '_' +
            p.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0).toString(16);
    }

    // Define a chave na memória para criptografia de sessão
    async function setEncryptionKey(password) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
        );
        sessionKey = await crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: enc.encode("nebula_salt"), iterations: 100000, hash: "SHA-256" },
            keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
        );
    }

    // Criptografa string com AES-GCM
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

    // Descriptografa string com AES-GCM
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

    function normalizeWorkspace(ws) {
        ws = ws || {};
        return {
            repository: Array.isArray(ws.repository) ? ws.repository : [],
            search_history: Array.isArray(ws.search_history) ? ws.search_history : [],
        };
    }

    function loadDB() {
        try {
            const raw = localStorage.getItem(DB_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch { return null; }
    }

    function saveDB(data) {
        try {
            localStorage.setItem(DB_KEY, JSON.stringify(data));
        } catch (e) {
            console.error('Storage save failed:', e);
        }
    }

    function initState() {
        const db = loadDB();
        const defaultUsers = {
            'demo@nebula.ai': {
                name: 'Usuário Demo',
                password: hashPasswordSync('demo123'),
                research: 'Inteligência Artificial aplicada à análise de documentos',
            }
        };

        const state = {
            users: (db && db.users) || defaultUsers,
            workspaces: {},
            user_interest: (db && typeof db.user_interest === 'object' && db.user_interest) || {},
            community_messages: (db && Array.isArray(db.community_messages)) ? db.community_messages : [],
            logged_in: false,
            current_user: null,
            page: 'Dashboard',
            repository: [],
            search_history: [],
        };

        // Restore workspaces
        const rawWS = (db && db.workspaces) || {};
        for (const email of Object.keys(state.users)) {
            state.workspaces[email] = normalizeWorkspace(rawWS[email]);
        }

        // Pre-create demo workspace if empty
        if (!state.workspaces['demo@nebula.ai']) state.workspaces['demo@nebula.ai'] = blankWorkspace();

        return state;
    }

    // Salva estado e criptografa repositório de forma assíncrona
    async function saveStateAsync(state) {
        // Cópia profunda segura
        const data = {
            schema_version: 3,
            users: state.users,
            workspaces: JSON.parse(JSON.stringify(state.workspaces)),
            user_interest: state.user_interest,
            community_messages: state.community_messages,
        };
        
        // Criptografa o texto dos documentos do usuário logado antes de salvar
        if (state.logged_in && state.current_user && sessionKey) {
            const ws = data.workspaces[state.current_user];
            if (ws && ws.repository) {
                for (let doc of ws.repository) {
                    if (doc.text && !doc.text.startsWith('ENC::')) {
                        doc.text = await encryptText(doc.text);
                    }
                    if (doc.summary && !doc.summary.startsWith('ENC::')) {
                        doc.summary = await encryptText(doc.summary);
                    }
                }
            }
        }
        saveDB(data);
    }
    
    // Mantém a versão síncrona para retrocompatibilidade onde não houver texto novo
    function saveState(state) {
        saveStateAsync(state); 
    }

    function ensureWorkspace(state, email) {
        if (!email) return blankWorkspace();
        if (!state.workspaces[email]) state.workspaces[email] = blankWorkspace();
        state.workspaces[email] = normalizeWorkspace(state.workspaces[email]);
        return state.workspaces[email];
    }

    // Descriptografa ao sincronizar
    async function syncWorkspaceStateAsync(state, email) {
        if (!email) {
            state.repository = [];
            state.search_history = [];
            return;
        }
        const ws = ensureWorkspace(state, email);
        
        // Descriptografar para memória
        if (sessionKey) {
            for (let doc of ws.repository) {
                if (doc.text && doc.text.startsWith('ENC::')) {
                    doc.text = await decryptText(doc.text);
                }
                if (doc.summary && doc.summary.startsWith('ENC::')) {
                    doc.summary = await decryptText(doc.summary);
                }
            }
        }
        
        state.repository = ws.repository;
        state.search_history = ws.search_history;
    }

    function syncWorkspaceState(state, email) {
        syncWorkspaceStateAsync(state, email).then(() => {
            if (window.NebulaApp) window.NebulaApp.renderPage();
        });
    }

    return {
        hashPasswordSync,
        setEncryptionKey,
        encryptText,
        decryptText,
        blankWorkspace,
        normalizeWorkspace,
        initState,
        saveState,
        saveStateAsync,
        ensureWorkspace,
        syncWorkspaceState,
    };
})();

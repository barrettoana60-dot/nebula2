/* ============================================================
   STORAGE ENGINE — LOCAL STORAGE + AES-GCM Cryptography
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

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function blankWorkspace() {
        return { repository: [], search_history: [] };
    }

    function initState() {
        try {
            const saved = localStorage.getItem('nebula_db_v3');
            if (saved) {
                const parsed = JSON.parse(saved);
                parsed.logged_in = false;
                parsed.current_user = null;
                if (!parsed.workspaces) parsed.workspaces = {};
                if (!parsed.users) parsed.users = {};
                if (!parsed.user_interest) parsed.user_interest = {};
                return parsed;
            }
        } catch (e) {
            console.error("Failed to load local DB", e);
        }

        return {
            users: {},
            workspaces: {},
            user_interest: {},
            community_messages: [],
            logged_in: false,
            current_user: null,
            page: 'Tela Principal',
            repository: [],
            search_history: [],
        };
    }

    async function syncWorkspaceStateAsync(state, email) {
        if (!email) {
            state.repository = [];
            state.search_history = [];
            return;
        }

        const ws = state.workspaces[email] || blankWorkspace();
        let repo = [...(ws.repository || [])];
        
        if (sessionKey) {
            for (let doc of repo) {
                if (doc.text && doc.text.startsWith('ENC::')) doc.text = await decryptText(doc.text);
                if (doc.summary && doc.summary.startsWith('ENC::')) doc.summary = await decryptText(doc.summary);
            }
        }
        
        state.repository = repo;
        state.search_history = ws.search_history || [];
    }

    function syncWorkspaceState(state, email) {
        syncWorkspaceStateAsync(state, email).then(() => {
            if (window.NebulaApp) window.NebulaApp.renderPage();
        });
    }

    async function saveStateAsync(state) {
        if (!state.logged_in || !state.current_user) return;

        const email = state.current_user;
        if (!state.workspaces[email]) state.workspaces[email] = blankWorkspace();
        
        const repoClone = JSON.parse(JSON.stringify(state.repository));
        
        if (sessionKey) {
            for (let doc of repoClone) {
                if (doc.text && !doc.text.startsWith('ENC::')) doc.text = await encryptText(doc.text);
                if (doc.summary && !doc.summary.startsWith('ENC::')) doc.summary = await encryptText(doc.summary);
            }
        }
        
        state.workspaces[email].repository = repoClone;
        state.workspaces[email].search_history = [...state.search_history];
        
        localStorage.setItem('nebula_db_v3', JSON.stringify(state));
    }

    function saveState(state) {
        saveStateAsync(state);
    }

    return {
        setEncryptionKey,
        encryptText,
        decryptText,
        generateUUID,
        blankWorkspace,
        initState,
        saveState,
        saveStateAsync,
        syncWorkspaceState,
        syncWorkspaceStateAsync
    };
})();

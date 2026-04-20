/* ============================================================
   STORAGE ENGINE — localStorage persistence + crypto
   ============================================================ */
const NebulaStorage = (() => {
    const DB_KEY = 'nebula_research_db_v3';
    const SALT = 'nebula_local_workspace_v3';

    function hashPassword(p) {
        let hash = 0;
        for (let i = 0; i < p.length; i++) {
            const ch = p.charCodeAt(i);
            hash = ((hash << 5) - hash) + ch;
            hash |= 0;
        }
        // SHA-256 like hex
        const encoder = new TextEncoder();
        const data = encoder.encode(p);
        return crypto.subtle.digest('SHA-256', data).then(buf => {
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        });
    }

    function hashPasswordSync(p) {
        let h = 0x811c9dc5;
        for (let i = 0; i < p.length; i++) {
            h ^= p.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return (h >>> 0).toString(16).padStart(8, '0') + '_' +
            p.split('').reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0).toString(16);
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

        // Legacy migration
        if (db && db.repository && !Object.keys(rawWS).length) {
            const demoWS = state.workspaces['demo@nebula.ai'] || blankWorkspace();
            if (!demoWS.repository.length) demoWS.repository = db.repository;
            if (!demoWS.search_history.length) demoWS.search_history = db.search_history || [];
            state.workspaces['demo@nebula.ai'] = demoWS;
        }

        return state;
    }

    function saveState(state) {
        const data = {
            schema_version: 3,
            users: state.users,
            workspaces: state.workspaces,
            user_interest: state.user_interest,
            community_messages: state.community_messages,
        };
        saveDB(data);
    }

    function ensureWorkspace(state, email) {
        if (!email) return blankWorkspace();
        if (!state.workspaces[email]) state.workspaces[email] = blankWorkspace();
        state.workspaces[email] = normalizeWorkspace(state.workspaces[email]);
        return state.workspaces[email];
    }

    function syncWorkspaceState(state, email) {
        if (!email) {
            state.repository = [];
            state.search_history = [];
            return;
        }
        const ws = ensureWorkspace(state, email);
        state.repository = ws.repository;
        state.search_history = ws.search_history;
    }

    return {
        hashPasswordSync,
        hashPassword,
        blankWorkspace,
        normalizeWorkspace,
        initState,
        saveState,
        ensureWorkspace,
        syncWorkspaceState,
    };
})();

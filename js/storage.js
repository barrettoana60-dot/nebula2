/* ============================================================
   STORAGE ENGINE — LOCAL STORAGE (Reliable, No Encryption)
   ============================================================ */
const NebulaStorage = (() => {

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
            const saved = localStorage.getItem('nebula_db_v4');
            if (saved) {
                const parsed = JSON.parse(saved);
                parsed.logged_in = false;
                parsed.current_user = null;
                if (!parsed.workspaces) parsed.workspaces = {};
                if (!parsed.users) parsed.users = {};
                if (!parsed.user_interest) parsed.user_interest = {};
                parsed.repository = [];
                parsed.search_history = [];
                return parsed;
            }
            // Try migrating from v3
            const oldSaved = localStorage.getItem('nebula_db_v3');
            if (oldSaved) {
                const parsed = JSON.parse(oldSaved);
                parsed.logged_in = false;
                parsed.current_user = null;
                if (!parsed.workspaces) parsed.workspaces = {};
                if (!parsed.users) parsed.users = {};
                if (!parsed.user_interest) parsed.user_interest = {};
                parsed.repository = [];
                parsed.search_history = [];
                // Clean encrypted data that can't be decrypted
                for (const email of Object.keys(parsed.workspaces)) {
                    const ws = parsed.workspaces[email];
                    if (ws && ws.repository) {
                        ws.repository = ws.repository.map(doc => {
                            if (doc.text && doc.text.startsWith('ENC::')) doc.text = '';
                            if (doc.summary && doc.summary.startsWith('ENC::')) doc.summary = '(resumo criptografado)';
                            return doc;
                        });
                    }
                }
                localStorage.setItem('nebula_db_v4', JSON.stringify(parsed));
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

    async function setEncryptionKey(password) {
        // No-op: encryption removed for reliability
    }

    async function syncWorkspaceStateAsync(state, email) {
        if (!email) {
            state.repository = [];
            state.search_history = [];
            return;
        }
        const ws = state.workspaces[email] || blankWorkspace();
        state.repository = JSON.parse(JSON.stringify(ws.repository || []));
        state.search_history = [...(ws.search_history || [])];
    }

    function syncWorkspaceState(state, email) {
        // Synchronous version — no double render
        if (!email) {
            state.repository = [];
            state.search_history = [];
            return;
        }
        const ws = state.workspaces[email] || blankWorkspace();
        state.repository = JSON.parse(JSON.stringify(ws.repository || []));
        state.search_history = [...(ws.search_history || [])];
    }

    function saveState(state) {
        try {
            if (state.current_user) {
                const email = state.current_user;
                if (!state.workspaces) state.workspaces = {};
                if (!state.workspaces[email]) state.workspaces[email] = blankWorkspace();

                // Trim text to reduce storage: max 4000 chars per doc
                const repoToSave = (state.repository || []).map(doc => {
                    const clone = { ...doc };
                    if (clone.text && clone.text.length > 4000) {
                        clone.text = clone.text.slice(0, 4000);
                    }
                    return clone;
                });

                state.workspaces[email].repository = repoToSave;
                state.workspaces[email].search_history = [...(state.search_history || [])];
            }

            // Save everything, excluding transient fields
            const toSave = {};
            for (const key of Object.keys(state)) {
                if (key === 'repository' || key === 'search_history') continue;
                toSave[key] = state[key];
            }

            const json = JSON.stringify(toSave);
            localStorage.setItem('nebula_db_v4', json);
            console.log('[Storage] State saved, size:', Math.round(json.length / 1024), 'KB');
        } catch (e) {
            console.error('[Storage] Save failed:', e);
            // If quota exceeded, try to save just users (critical data)
            try {
                const minimal = {
                    users: state.users,
                    workspaces: {},
                    user_interest: state.user_interest || {},
                    community_messages: [],
                    logged_in: state.logged_in,
                    current_user: state.current_user,
                    page: state.page
                };
                // Save workspaces but trim document text aggressively
                for (const email of Object.keys(state.workspaces || {})) {
                    const ws = state.workspaces[email];
                    minimal.workspaces[email] = {
                        repository: (ws.repository || []).map(d => ({
                            ...d,
                            text: (d.text || '').slice(0, 500),
                            ref_samples: []
                        })),
                        search_history: (ws.search_history || []).slice(-10)
                    };
                }
                localStorage.setItem('nebula_db_v4', JSON.stringify(minimal));
                console.warn('[Storage] Saved with reduced data due to quota limits');
            } catch (e2) {
                console.error('[Storage] Critical: even minimal save failed:', e2);
            }
        }
    }

    async function saveStateAsync(state) {
        saveState(state);
    }

    return {
        setEncryptionKey,
        encryptText: async (t) => t,
        decryptText: async (t) => t,
        generateUUID,
        blankWorkspace,
        initState,
        saveState,
        saveStateAsync,
        syncWorkspaceState,
        syncWorkspaceStateAsync
    };
})();

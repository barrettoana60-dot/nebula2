/* ============================================================
   STORAGE ENGINE — SUPABASE INTEGRATION
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
        let parsed = {
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
        try {
            const saved = localStorage.getItem('nebula_db_v5');
            if (saved) {
                const s = JSON.parse(saved);
                parsed = { ...parsed, ...s };
                parsed.logged_in = false;
                parsed.current_user = null;
                parsed.repository = [];
                parsed.search_history = [];
            }
        } catch (e) {
            console.error("Local load fail", e);
        }
        return parsed;
    }

    async function setEncryptionKey(password) {}

    async function syncWorkspaceStateAsync(state, email) {
        if (!email) {
            state.repository = [];
            state.search_history = [];
            return;
        }

        // Pull from Supabase
        if (window.NebulaSupabase) {
            try {
                // Fetch profiles (for community)
                const { data: profiles } = await window.NebulaSupabase.from('profiles').select('*');
                if (profiles) {
                    state.users = {};
                    state.user_interest = {};
                    profiles.forEach(p => {
                        state.users[p.email] = {
                            name: p.name,
                            research: p.research,
                            pass: p.pass,
                            tutorial_completed: p.tutorial_completed
                        };
                        state.user_interest[p.email] = p.interest || {};
                    });
                }

                // Fetch workspace
                const { data: wsData } = await window.NebulaSupabase.from('workspaces').select('*').eq('email', email).single();
                if (wsData) {
                    state.workspaces[email] = {
                        repository: wsData.repository || [],
                        search_history: wsData.search_history || []
                    };
                } else {
                    state.workspaces[email] = blankWorkspace();
                }
            } catch (err) {
                console.error("Supabase sync failed, using local cache:", err);
            }
        }

        const ws = state.workspaces[email] || blankWorkspace();
        state.repository = JSON.parse(JSON.stringify(ws.repository || []));
        state.search_history = [...(ws.search_history || [])];
    }

    function syncWorkspaceState(state, email) {
        if (!email) {
            state.repository = [];
            state.search_history = [];
            return;
        }
        const ws = state.workspaces[email] || blankWorkspace();
        state.repository = JSON.parse(JSON.stringify(ws.repository || []));
        state.search_history = [...(ws.search_history || [])];

        // Ensure user interest is built if missing
        if (!state.user_interest[email] || Object.keys(state.user_interest[email]).length === 0) {
            rebuildInterests(state, email);
        }
    }

    function rebuildInterests(state, email) {
        const docs = (state.workspaces[email] || {}).repository || [];
        if (!docs.length) return;
        
        state.user_interest[email] = {};
        docs.forEach(doc => {
            (doc.keywords || []).slice(0, 10).forEach(kw => {
                state.user_interest[email][kw] = (state.user_interest[email][kw] || 0) + 1;
            });
        });
        console.log(`[Storage] Interests rebuilt for ${email} from ${docs.length} docs.`);
    }

    function saveState(state) {
        try {
            if (state.current_user) {
                const email = state.current_user;
                if (!state.workspaces) state.workspaces = {};
                if (!state.workspaces[email]) state.workspaces[email] = blankWorkspace();

                const repoToSave = (state.repository || []).map(doc => {
                    const clone = { ...doc };
                    if (clone.text && clone.text.length > 2000) {
                        clone.text = clone.text.slice(0, 2000);
                    }
                    return clone;
                });

                state.workspaces[email].repository = repoToSave;
                state.workspaces[email].search_history = [...(state.search_history || [])];
            }

            const toSave = {};
            for (const key of Object.keys(state)) {
                if (key === 'repository' || key === 'search_history') continue;
                toSave[key] = state[key];
            }
            localStorage.setItem('nebula_db_v5', JSON.stringify(toSave));
            console.log('[Storage] Local cache saved');

        } catch (e) {
            console.error('[Storage] Local Save failed:', e);
        }
    }

    async function saveStateAsync(state) {
        saveState(state); // save locally first
        
        if (state.current_user && window.NebulaSupabase) {
            const email = state.current_user;
            const user = state.users[email];
            if (!user) return;
            
            try {
                // Upsert Profile
                await window.NebulaSupabase.from('profiles').upsert({
                    email: email,
                    name: user.name,
                    research: user.research,
                    pass: user.pass,
                    tutorial_completed: user.tutorial_completed || false,
                    interest: state.user_interest[email] || {}
                });

                // Upsert Workspace
                const ws = state.workspaces[email] || blankWorkspace();
                await window.NebulaSupabase.from('workspaces').upsert({
                    email: email,
                    repository: ws.repository || [],
                    search_history: ws.search_history || []
                });
                
                console.log("[Supabase] Data synced to cloud.");
            } catch (err) {
                console.error("[Supabase] Sync failed:", err);
            }
        }
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
        syncWorkspaceStateAsync,
        rebuildInterests
    };
})();

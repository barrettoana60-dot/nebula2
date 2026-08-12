/* ============================================================
   STORAGE ENGINE — SUPABASE INTEGRATION & REAL-TIME SYNC
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
            profile_views: {},
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

        cleanDemoResearchers(parsed);
        return parsed;
    }

    function cleanDemoResearchers(state) {
        if (!state || !state.users) return;
        Object.keys(state.users).forEach(e => {
            if (e.startsWith('demo_')) {
                delete state.users[e];
                if (state.workspaces) delete state.workspaces[e];
                if (state.user_interest) delete state.user_interest[e];
            }
        });
    }

    async function setEncryptionKey(password) {}

    function normalizeUserRegistry(state) {
        if (!state) return;
        const normUsers = {};
        Object.entries(state.users || {}).forEach(([email, user]) => {
            const key = (email || '').toLowerCase().trim();
            if (!key || key.startsWith('demo_')) return;
            normUsers[key] = { ...(normUsers[key] || {}), ...user };
        });
        state.users = normUsers;

        const normWs = {};
        Object.entries(state.workspaces || {}).forEach(([email, ws]) => {
            const key = (email || '').toLowerCase().trim();
            if (!key) return;
            normWs[key] = ws;
        });
        state.workspaces = normWs;

        const normInterest = {};
        Object.entries(state.user_interest || {}).forEach(([email, interest]) => {
            const key = (email || '').toLowerCase().trim();
            if (!key) return;
            normInterest[key] = { ...(normInterest[key] || {}), ...interest };
        });
        state.user_interest = normInterest;

        if (state.current_user) {
            state.current_user = state.current_user.toLowerCase().trim();
        }
    }

    async function syncWorkspaceStateAsync(state, email) {
        if (!email) {
            state.repository = [];
            state.search_history = [];
            return;
        }

        const emailKey = (email || '').toLowerCase().trim();

        if (window.NebulaSupabase) {
            try {
                const { data: myProfile } = await window.NebulaSupabase
                    .from('profiles').select('*').eq('email', emailKey).maybeSingle();
                if (myProfile) {
                    const localPhoto = (state.users[emailKey] || {}).photo || null;
                    const dbPhoto = myProfile.interest?._photo || myProfile.photo || null;
                    state.users[emailKey] = {
                        name: myProfile.name,
                        research: myProfile.research,
                        pass: myProfile.pass || state.users[emailKey]?.pass || '',
                        tutorial_completed: myProfile.tutorial_completed,
                        photo: dbPhoto || localPhoto
                    };
                    if (!state.user_interest) state.user_interest = {};
                    const cleanInterest = { ...(myProfile.interest || {}) };
                    delete cleanInterest._photo;
                    state.user_interest[emailKey] = cleanInterest;
                }

                const { data: myWs } = await window.NebulaSupabase
                    .from('workspaces').select('email, repository, search_history, inbox')
                    .eq('email', emailKey).maybeSingle();
                if (myWs) {
                    if (!state.workspaces) state.workspaces = {};
                    state.workspaces[emailKey] = {
                        repository: myWs.repository || [],
                        search_history: myWs.search_history || []
                    };
                    if (myWs.inbox && Array.isArray(myWs.inbox)) {
                        const existingLocal = state.community_messages || [];
                        const combinedMap = new Map();
                        [...myWs.inbox, ...existingLocal].forEach(m => {
                            if (m && m.id) combinedMap.set(m.id, m);
                        });
                        state.community_messages = Array.from(combinedMap.values());
                    }
                }

                const { data: allProfiles } = await window.NebulaSupabase
                    .from('profiles').select('email, name, research, interest, tutorial_completed, pass');
                if (allProfiles) {
                    allProfiles.forEach(p => {
                        const pKey = (p.email || '').toLowerCase().trim();
                        if (!pKey || pKey.startsWith('demo_')) return;
                        const localPhoto = (state.users[pKey] || {}).photo || null;
                        const dbPhoto = p.interest?._photo || p.photo || null;
                        state.users[pKey] = {
                            name: p.name,
                            research: p.research || '',
                            pass: state.users[pKey]?.pass || p.pass || '',
                            tutorial_completed: p.tutorial_completed,
                            photo: dbPhoto || localPhoto
                        };
                        if (p.interest) {
                            if (!state.user_interest) state.user_interest = {};
                            const cleanInterest = { ...p.interest };
                            delete cleanInterest._photo;
                            state.user_interest[pKey] = cleanInterest;
                        }
                    });
                }

                const { data: allWorkspaces } = await window.NebulaSupabase
                    .from('workspaces').select('email, repository');
                if (allWorkspaces) {
                    allWorkspaces.forEach(w => {
                        const wKey = (w.email || '').toLowerCase().trim();
                        if (!wKey) return;
                        if (!state.workspaces) state.workspaces = {};
                        if (!state.workspaces[wKey]) state.workspaces[wKey] = blankWorkspace();
                        state.workspaces[wKey].repository = w.repository || [];
                    });
                }

                Object.keys(state.users).forEach(uKey => rebuildInterests(state, uKey));
            } catch (err) {
                console.error("Supabase sync failed, using local cache:", err);
            }
        }

        normalizeUserRegistry(state);

        if (!state.workspaces) state.workspaces = {};
        if (!state.workspaces[emailKey]) state.workspaces[emailKey] = blankWorkspace();

        const ws = state.workspaces[emailKey] || blankWorkspace();
        state.repository = JSON.parse(JSON.stringify(ws.repository || []));
        state.search_history = [...(ws.search_history || [])];

        saveState(state);
    }

    function syncWorkspaceState(state, email) {
        if (!email) {
            state.repository = [];
            state.search_history = [];
            return;
        }
        if (!state.workspaces) state.workspaces = {};
        if (!state.workspaces[email]) state.workspaces[email] = blankWorkspace();

        const ws = state.workspaces[email] || blankWorkspace();
        state.repository = JSON.parse(JSON.stringify(ws.repository || []));
        state.search_history = [...(ws.search_history || [])];

        rebuildInterests(state, email);
    }

    function rebuildInterests(state, email) {
        if (!state || !email) return;
        if (!state.user_interest) state.user_interest = {};
        if (!state.workspaces) state.workspaces = {};
        if (!state.users) state.users = {};
        state.user_interest[email] = state.user_interest[email] || {};

        const docs = (state.workspaces[email] || {}).repository || [];
        docs.forEach(doc => {
            (doc.keywords || []).slice(0, 10).forEach(kw => {
                const k = (kw || '').toLowerCase().trim();
                if (k) state.user_interest[email][k] = (state.user_interest[email][k] || 0) + 1;
            });
        });

        const user = state.users[email];
        if (user && user.research && typeof TextEngine !== 'undefined') {
            try {
                const researchKw = TextEngine.extractKeywordsTFIDF(user.research, 15);
                researchKw.forEach(kw => {
                    const k = (kw || '').toLowerCase().trim();
                    if (k) state.user_interest[email][k] = (state.user_interest[email][k] || 0) + 2;
                });
            } catch (e) {}
        }
    }

    function saveState(state) {
        try {
            if (state.current_user) {
                const email = state.current_user;
                if (!state.workspaces) state.workspaces = {};
                if (!state.workspaces[email]) state.workspaces[email] = blankWorkspace();

                const repoToSave = (state.repository || []).map(doc => {
                    const clone = { ...doc };
                    if (clone.text && clone.text.length > 80000) {
                        clone.text = clone.text.slice(0, 80000);
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
        } catch (e) {
            console.error('[Storage] Local Save failed:', e);
        }
    }

    async function saveStateAsync(state) {
        saveState(state);

        if (state.current_user && window.NebulaSupabase) {
            const email = (state.current_user || '').toLowerCase().trim();
            state.current_user = email;
            const user = state.users[email];
            if (!user) return;

            try {
                const interestObj = { ...(state.user_interest[email] || {}) };
                if (user.photo) {
                    interestObj._photo = user.photo;
                }
                const profileObj = {
                    email: email,
                    name: user.name,
                    research: user.research,
                    pass: user.pass,
                    tutorial_completed: user.tutorial_completed || false,
                    interest: interestObj
                };
                await window.NebulaSupabase.from('profiles').upsert(profileObj);

                const ws = state.workspaces[email] || blankWorkspace();
                const existingInbox = (state.community_messages || []).slice(-300);

                await window.NebulaSupabase.from('workspaces').upsert({
                    email: email,
                    repository: ws.repository || [],
                    search_history: ws.search_history || [],
                    inbox: existingInbox
                });
            } catch (err) {
                console.error("[Supabase] Sync failed:", err);
            }
        }
    }

    function findUserKey(state, email) {
        const clean = (email || '').toLowerCase().trim();
        if (!clean) return null;
        if (state.users[clean]) return clean;
        return Object.keys(state.users || {}).find(e => e.toLowerCase().trim() === clean) || null;
    }

    function getUserPhoto(state, email) {
        const key = findUserKey(state, email);
        if (!key) return null;
        return state.users[key]?.photo || null;
    }

    async function ensureUserProfile(state, email) {
        const clean = (email || '').toLowerCase().trim();
        if (!clean || clean === 'ai' || clean.startsWith('ai@')) return null;

        let key = findUserKey(state, clean);
        if (key && state.users[key]?.name) return key;

        if (window.NebulaSupabase) {
            try {
                const { data } = await window.NebulaSupabase
                    .from('profiles')
                    .select('email, name, research, interest, tutorial_completed, pass')
                    .eq('email', clean)
                    .maybeSingle();
                if (data) {
                    const dbPhoto = data.interest?._photo || data.photo || null;
                    state.users[data.email] = {
                        name: data.name,
                        research: data.research || '',
                        pass: data.pass || state.users[data.email]?.pass || '',
                        tutorial_completed: data.tutorial_completed,
                        photo: dbPhoto
                    };
                    if (data.interest) {
                        if (!state.user_interest) state.user_interest = {};
                        const cleanInterest = { ...data.interest };
                        delete cleanInterest._photo;
                        state.user_interest[data.email] = cleanInterest;
                    }
                    saveState(state);
                    return data.email;
                }
            } catch (e) {
                console.warn('[Storage] ensureUserProfile failed:', e);
            }
        }

        if (!key) {
            const displayName = clean.split('@')[0];
            state.users[clean] = {
                name: displayName.charAt(0).toUpperCase() + displayName.slice(1),
                research: '',
                pass: '',
                photo: null
            };
            key = clean;
        }
        return key;
    }

    async function saveMessageToSupabase(msg) {
        if (!window.NebulaSupabase || !msg || !msg.text) return false;
        const sender = (msg.sender_email || '').toLowerCase().trim();
        const recipient = (msg.recipient_email || '').toLowerCase().trim();
        try {
            await window.NebulaSupabase.from('community_messages').insert({
                room_id: msg.room_id,
                room_label: msg.room_label || '',
                sender_email: sender,
                sender_name: msg.sender_name || '',
                text: msg.text,
                timestamp: msg.timestamp || Date.now()
            });

            const msgWithMeta = { ...msg, sender_email: sender, recipient_email: recipient };

            for (const userEmail of [sender, recipient]) {
                if (!userEmail || userEmail === 'ai') continue;
                const { data: ws } = await window.NebulaSupabase
                    .from('workspaces')
                    .select('repository, search_history, inbox')
                    .eq('email', userEmail)
                    .maybeSingle();

                const inbox = [...(ws?.inbox || []), msgWithMeta];
                const deduped = [];
                const seen = new Set();
                inbox.slice(-300).forEach(m => {
                    const k = m.id || `${m.timestamp}_${m.sender_email}`;
                    if (!seen.has(k)) { seen.add(k); deduped.push(m); }
                });

                await window.NebulaSupabase.from('workspaces').upsert({
                    email: userEmail,
                    repository: ws?.repository || [],
                    search_history: ws?.search_history || [],
                    inbox: deduped
                });
            }
            return true;
        } catch (e) {
            console.warn('[Storage] saveMessageToSupabase failed:', e);
            return false;
        }
    }

    async function fetchMessagesFromSupabase(roomId, email, peerEmail) {
        if (!window.NebulaSupabase) return [];
        const results = [];
        const cleanMine = (email || '').toLowerCase().trim();
        const cleanPeer = (peerEmail || '').toLowerCase().trim();
        try {
            if (roomId) {
                const { data } = await window.NebulaSupabase
                    .from('community_messages')
                    .select('*')
                    .eq('room_id', roomId)
                    .order('timestamp', { ascending: true })
                    .limit(200);
                if (data) results.push(...data);
            }
            if (email && peerEmail) {
                const { data: ws } = await window.NebulaSupabase
                    .from('workspaces')
                    .select('inbox')
                    .eq('email', cleanMine)
                    .maybeSingle();
                if (ws?.inbox) {
                    const filtered = ws.inbox.filter(m => {
                        const s = (m.sender_email || '').toLowerCase().trim();
                        const r = (m.recipient_email || '').toLowerCase().trim();
                        return (s === cleanPeer && r === cleanMine) || (s === cleanMine && r === cleanPeer);
                    });
                    results.push(...filtered);
                }
            }
        } catch (e) {
            console.warn('[Storage] fetchMessagesFromSupabase failed:', e);
        }
        return results;
    }

    async function fetchCommunityProfilesDirect() {
        const cfg = window.NebulaSupabaseConfig;
        if (!cfg) return [];
        try {
            const url = `${cfg.url}/rest/v1/profiles?select=email,name,research,interest,tutorial_completed,pass&order=name.asc&limit=200`;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            const res = await fetch(url, {
                headers: {
                    'apikey': cfg.key,
                    'Authorization': `Bearer ${cfg.key}`,
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (!res.ok) {
                console.warn('[Storage] fetchCommunityProfilesDirect HTTP', res.status);
                return [];
            }
            return await res.json();
        } catch (e) {
            console.warn('[Storage] fetchCommunityProfilesDirect failed:', e);
            return [];
        }
    }

    async function fetchAllCommunityProfiles() {
        let profiles = await fetchCommunityProfilesDirect();
        if (profiles.length) return profiles;

        if (window.NebulaSupabase) {
            try {
                const { data } = await window.NebulaSupabase
                    .from('profiles')
                    .select('email, name, research, interest, tutorial_completed, pass')
                    .order('name', { ascending: true })
                    .limit(200);
                if (data && data.length) return data;
            } catch (e) {
                console.warn('[Storage] Supabase client profiles fetch failed:', e);
            }
        }

        profiles = await fetchProfilesFromAPI('');
        return profiles || [];
    }

    async function searchCloudProfiles(query) {
        const q = (query || '').trim();
        const all = await fetchAllCommunityProfiles();
        if (!q) return all;

        const ql = q.toLowerCase();
        return all.filter(p => {
            const hay = `${p.name || ''} ${p.research || ''} ${p.email || ''}`.toLowerCase();
            return hay.includes(ql);
        });
    }

    function mergeProfilesIntoState(state, profiles) {
        if (!state.users) state.users = {};
        if (!state.user_interest) state.user_interest = {};
        if (!state.workspaces) state.workspaces = {};

        profiles.forEach(p => {
            const pKey = (p.email || '').toLowerCase().trim();
            if (!pKey || pKey.startsWith('demo_')) return;
            const dbPhoto = p.interest?._photo || p.photo || null;
            state.users[pKey] = {
                name: p.name || pKey,
                research: p.research || '',
                pass: state.users[pKey]?.pass || p.pass || '',
                tutorial_completed: p.tutorial_completed,
                photo: dbPhoto || state.users[pKey]?.photo || null
            };
            if (p.interest) {
                const cleanInterest = { ...p.interest };
                delete cleanInterest._photo;
                state.user_interest[pKey] = { ...(state.user_interest[pKey] || {}), ...cleanInterest };
            }
            if (!state.workspaces[pKey]) state.workspaces[pKey] = blankWorkspace();
        });

        normalizeUserRegistry(state);
        Object.keys(state.users).forEach(uKey => {
            try { rebuildInterests(state, uKey); } catch (e) {}
        });
        saveState(state);
    }

    async function fetchProfilesFromAPI(query) {
        try {
            const url = query
                ? `/api/profiles?q=${encodeURIComponent(query)}`
                : '/api/profiles';
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timeout);
            if (!res.ok) {
                console.warn('[Storage] fetchProfilesFromAPI HTTP', res.status);
                return [];
            }
            const data = await res.json();
            return data.profiles || [];
        } catch (e) {
            console.warn('[Storage] fetchProfilesFromAPI failed:', e);
            return [];
        }
    }

    async function saveProfileViaAPI(profile) {
        try {
            const res = await fetch('/api/profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profile })
            });
            return res.ok;
        } catch (e) {
            return false;
        }
    }

    async function refreshCommunityDirectory(state) {
        if (!state) return 0;

        const profiles = await fetchAllCommunityProfiles();
        mergeProfilesIntoState(state, profiles);
        console.log('[Nebula] Diretório carregado:', profiles.length, 'pesquisadores');
        return profiles.length;
    }

    async function searchResearchersAsync(state, query, currentEmail, limit = 30) {
        const q = (query || '').trim();
        const myEmail = (currentEmail || '').toLowerCase().trim();

        let cloudProfiles = await searchCloudProfiles(q);

        if (!cloudProfiles.length) {
            await refreshCommunityDirectory(state);
            return searchResearchersLocal(state, q, myEmail, limit);
        }

        mergeProfilesIntoState(state, cloudProfiles);
        return searchResearchersLocal(state, q, myEmail, limit);
    }

    function searchResearchersLocal(state, query, currentEmail, limit = 30) {
        const q = (query || '').toLowerCase().trim();
        const myEmail = (currentEmail || '').toLowerCase().trim();
        const results = [];

        Object.entries(state.users || {}).forEach(([email, user]) => {
            const eKey = email.toLowerCase().trim();
            if (!user || eKey.startsWith('demo_')) return;

            const name = (user.name || '').toLowerCase();
            const research = (user.research || '').toLowerCase();
            const interests = Object.keys(state.user_interest[eKey] || {}).join(' ').toLowerCase();
            const haystack = `${name} ${research} ${eKey} ${interests}`;

            if (!q || haystack.includes(q)) {
                let affinity = { similarity: 0, shared_topics: [], connection_points: [], is_strong: false, is_medium: false };
                if (myEmail && eKey !== myEmail) {
                    try { affinity = NetworkEngine.compareRepositories(state, myEmail, eKey); } catch (e) {}
                }
                results.push({
                    email: eKey,
                    name: user.name || eKey,
                    research: user.research || '',
                    photo: user.photo || null,
                    similarity: affinity.similarity,
                    shared_topics: affinity.shared_topics,
                    connection_points: affinity.connection_points,
                    is_strong: affinity.is_strong,
                    is_medium: affinity.is_medium,
                    topic: affinity.shared_topics?.[0] || 'Pesquisa Geral',
                    is_self: eKey === myEmail
                });
            }
        });

        return results.sort((a, b) => {
            if (a.is_self && !b.is_self) return -1;
            if (!a.is_self && b.is_self) return 1;
            return b.similarity - a.similarity;
        }).slice(0, limit);
    }

    function searchResearchers(state, query, excludeEmail, limit = 30) {
        return searchResearchersLocal(state, query, excludeEmail, limit);
    }

    async function syncInboxFromSupabase(state, email) {
        if (!email || !window.NebulaSupabase) return [];
        const clean = email.toLowerCase().trim();
        try {
            const { data: myWs } = await window.NebulaSupabase
                .from('workspaces')
                .select('inbox')
                .eq('email', clean)
                .maybeSingle();

            const all = [...(myWs?.inbox || []), ...(state.community_messages || [])];
            const map = new Map();
            all.forEach(m => {
                if (m && (m.id || m.text)) {
                    const k = m.id || `${m.timestamp}_${m.sender_email}_${(m.text || '').slice(0, 30)}`;
                    map.set(k, m);
                }
            });
            state.community_messages = Array.from(map.values());
            saveState(state);
            return state.community_messages.filter(m =>
                (m.recipient_email || '').toLowerCase().trim() === clean ||
                (m.sender_email || '').toLowerCase().trim() === clean
            );
        } catch (e) {
            console.warn('[Storage] syncInboxFromSupabase failed:', e);
            return [];
        }
    }

    function recordProfileView(state, viewerEmail, viewedEmail) {
        if (!viewerEmail || !viewedEmail || viewerEmail === viewedEmail) return;
        if (!state.profile_views) state.profile_views = {};
        const key = viewedEmail.toLowerCase().trim();
        if (!state.profile_views[key]) state.profile_views[key] = [];
        const viewer = viewerEmail.toLowerCase().trim();
        const existing = state.profile_views[key].find(v => v.viewer === viewer);
        if (existing) {
            existing.timestamp = Date.now();
        } else {
            state.profile_views[key].push({ viewer, timestamp: Date.now() });
        }
        saveState(state);
    }

    function hasViewedProfile(state, viewerEmail, viewedEmail) {
        if (!state.profile_views || !viewerEmail || !viewedEmail) return false;
        const key = viewedEmail.toLowerCase().trim();
        const viewer = viewerEmail.toLowerCase().trim();
        return (state.profile_views[key] || []).some(v => v.viewer === viewer);
    }

    function setTypingIndicator(roomId, email) {
        const key = `nebula_typing_${roomId}_${(email || '').toLowerCase().trim()}`;
        try {
            localStorage.setItem(key, Date.now().toString());
        } catch (e) {}
    }

    function getTypingPeers(roomId, myEmail) {
        const cleanMine = (myEmail || '').toLowerCase().trim();
        const peers = [];
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k || !k.startsWith(`nebula_typing_${roomId}_`)) continue;
                const peerEmail = k.replace(`nebula_typing_${roomId}_`, '');
                if (peerEmail === cleanMine) continue;
                const ts = parseInt(localStorage.getItem(k) || '0');
                if (Date.now() - ts < 4000) peers.push(peerEmail);
            }
        } catch (e) {}
        return peers;
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
        rebuildInterests,
        findUserKey,
        getUserPhoto,
        ensureUserProfile,
        saveMessageToSupabase,
        fetchMessagesFromSupabase,
        syncInboxFromSupabase,
        recordProfileView,
        hasViewedProfile,
        setTypingIndicator,
        getTypingPeers,
        normalizeUserRegistry,
        searchResearchers,
        refreshCommunityDirectory,
        searchResearchersAsync,
        searchResearchersLocal,
        fetchCommunityProfilesDirect,
        fetchProfilesFromAPI,
        saveProfileViaAPI,
    };
})();

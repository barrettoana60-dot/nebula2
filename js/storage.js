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
                // Do NOT clear repository/search_history here — they are loaded per-user from workspaces on login
                parsed.repository = [];
                parsed.search_history = [];
            }
        } catch (e) {
            console.error("Local load fail", e);
        }

        cleanDemoResearchers(parsed);
        hydrateUserMediaFromLocal(parsed);
        return parsed;
    }

    function hydrateUserMediaFromLocal(state) {
        if (!state?.users) return;
        Object.keys(state.users).forEach(email => {
            const key = (email || '').toLowerCase().trim();
            if (!key) return;
            const cover = getUserCoverLocal(key);
            const photo = getUserPhotoLocal(key);
            if (cover) state.users[key].cover = state.users[key].cover || cover;
            if (photo) state.users[key].photo = state.users[key].photo || photo;
        });
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
                    const localPhoto = (state.users[emailKey] || {}).photo || getUserPhotoLocal(emailKey);
                    const localCover = (state.users[emailKey] || {}).cover || getUserCoverLocal(emailKey);
                    const dbPhoto = myProfile.interest?._photo || myProfile.photo || null;
                    const dbCover = myProfile.interest?._cover || null;
                    state.users[emailKey] = {
                        name: myProfile.name,
                        research: myProfile.research,
                        pass: myProfile.pass || state.users[emailKey]?.pass || '',
                        tutorial_completed: myProfile.tutorial_completed,
                        photo: dbPhoto || localPhoto,
                        cover: dbCover || localCover
                    };
                    if (state.users[emailKey].cover) saveUserCoverLocal(emailKey, state.users[emailKey].cover);
                    if (state.users[emailKey].photo) saveUserPhotoLocal(emailKey, state.users[emailKey].photo);
                    if (!state.user_interest) state.user_interest = {};
                    const cleanInterest = { ...(myProfile.interest || {}) };
                    delete cleanInterest._photo;
                    delete cleanInterest._cover;
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
                }

                const { data: allProfiles } = await window.NebulaSupabase
                    .from('profiles').select('email, name, research, interest, tutorial_completed, pass');
                if (allProfiles) {
                    allProfiles.forEach(p => {
                        const pKey = (p.email || '').toLowerCase().trim();
                        if (!pKey || pKey.startsWith('demo_')) return;
                        const localPhoto = (state.users[pKey] || {}).photo || getUserPhotoLocal(pKey);
                        const localCover = (state.users[pKey] || {}).cover || getUserCoverLocal(pKey);
                        const dbPhoto = p.interest?._photo || p.photo || null;
                        const dbCover = p.interest?._cover || null;
                        state.users[pKey] = {
                            name: p.name,
                            research: p.research || '',
                            pass: state.users[pKey]?.pass || p.pass || '',
                            tutorial_completed: p.tutorial_completed,
                            photo: dbPhoto || localPhoto,
                            cover: dbCover || localCover
                        };
                        if (state.users[pKey].cover) saveUserCoverLocal(pKey, state.users[pKey].cover);
                        if (state.users[pKey].photo) saveUserPhotoLocal(pKey, state.users[pKey].photo);
                        if (p.interest) {
                            if (!state.user_interest) state.user_interest = {};
                            const cleanInterest = { ...p.interest };
                            delete cleanInterest._photo;
                            delete cleanInterest._cover;
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
        const remoteRepo = ws.repository || [];

        // Merge: keep everything already in state.repository (added locally this session)
        // and add only remote docs that don't exist locally yet (by ID)
        const localRepo = state.repository || [];
        const localIds = new Set(localRepo.map(d => d.id).filter(Boolean));
        const newFromRemote = remoteRepo.filter(d => d.id && !localIds.has(d.id));
        const merged = [...localRepo, ...newFromRemote];
        state.repository = merged;
        // Also keep workspace in sync so saveState writes the merged list back
        ws.repository = merged;
        state.workspaces[emailKey] = ws;

        // Merge search history without duplicates (by query text)
        state.search_history = mergeSearchHistories(state.search_history || [], ws.search_history || []);
        ws.search_history = state.search_history;

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
        // Merge: don't drop docs already in state.repository
        const localRepo = state.repository || [];
        const wsRepo = ws.repository || [];
        const localIds = new Set(localRepo.map(d => d.id).filter(Boolean));
        const newFromWs = wsRepo.filter(d => d.id && !localIds.has(d.id));
        state.repository = [...localRepo, ...newFromWs];
        ws.repository = state.repository;

        state.search_history = mergeSearchHistories(state.search_history || [], ws.search_history || []);
        ws.search_history = state.search_history;

        rebuildInterests(state, email);
    }

    function mergeSearchHistories(localHistory, remoteHistory) {
        const seen = new Set();
        const merged = [];
        [...localHistory, ...remoteHistory].forEach(h => {
            const entry = typeof h === 'string' ? { query: h } : h;
            const key = (entry?.query || '').toLowerCase().trim();
            if (!key || seen.has(key)) return;
            seen.add(key);
            merged.push(entry);
        });
        merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        return merged.slice(0, 50);
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
                // Always normalize email to avoid workspace key mismatch (e.g. "User@Email.com" vs "user@email.com")
                const email = (state.current_user || '').toLowerCase().trim();
                state.current_user = email;
                if (!state.workspaces) state.workspaces = {};
                if (!state.workspaces[email]) state.workspaces[email] = blankWorkspace();

                const repoToSave = (state.repository || []).map(doc => {
                    const clone = { ...doc };
                    if (clone.text && clone.text.length > 50000) {
                        clone.text = clone.text.slice(0, 50000);
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
            try {
                localStorage.setItem('nebula_db_v5', JSON.stringify(toSave));
            } catch (quotaErr) {
                // Quota exceeded: trim large text fields across other workspaces to fit
                console.warn('[Storage] Quota exceeded, trimming workspaces text:', quotaErr);
                if (toSave.workspaces) {
                    Object.keys(toSave.workspaces).forEach(wsKey => {
                        if (toSave.workspaces[wsKey].repository) {
                            toSave.workspaces[wsKey].repository.forEach(d => {
                                if (d.text && d.text.length > 20000) d.text = d.text.slice(0, 20000);
                            });
                        }
                    });
                }
                localStorage.setItem('nebula_db_v5', JSON.stringify(toSave));
            }
        } catch (e) {
            console.error('[Storage] Local Save failed:', e);
        }
    }

    async function saveStateAsync(state) {
        saveState(state);

        if (state.current_user && window.NebulaSupabaseConfig?.url) {
            const email = (state.current_user || '').toLowerCase().trim();
            state.current_user = email;
            const user = state.users[email];
            if (!user) return false;

            try {
                const interestObj = { ...(state.user_interest[email] || {}) };
                if (user.photo) {
                    interestObj._photo = user.photo;
                    saveUserPhotoLocal(email, user.photo);
                }
                if (user.cover) {
                    interestObj._cover = user.cover;
                    saveUserCoverLocal(email, user.cover);
                }
                const profileObj = {
                    email: email,
                    name: user.name,
                    research: user.research,
                    pass: user.pass,
                    tutorial_completed: user.tutorial_completed || false,
                    interest: interestObj
                };
                await upsertProfileToSupabase(profileObj);

                const ws = state.workspaces[email] || blankWorkspace();
                return await upsertWorkspaceToSupabase(email, ws);
            } catch (err) {
                console.error("[Supabase] Sync failed:", err);
                return false;
            }
        }
        return false;
    }

    async function upsertWorkspaceToSupabase(email, ws) {
        const cfg = window.NebulaSupabaseConfig;
        if (!cfg?.url || !cfg?.key || !email) return false;

        const body = JSON.stringify({
            email: email,
            repository: ws.repository || [],
            search_history: ws.search_history || []
        });

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 60000);
                const res = await fetch(`${cfg.url}/rest/v1/workspaces`, {
                    method: 'POST',
                    headers: {
                        'apikey': cfg.key,
                        'Authorization': `Bearer ${cfg.key}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'resolution=merge-duplicates,return=minimal'
                    },
                    body,
                    signal: controller.signal
                });
                clearTimeout(timeout);
                if (res.ok) return true;
                console.warn(`[Storage] Workspace upsert HTTP ${res.status} (tentativa ${attempt})`);
            } catch (e) {
                console.warn(`[Storage] Workspace upsert falhou (tentativa ${attempt}):`, e);
            }
            await new Promise(r => setTimeout(r, 1200 * attempt));
        }
        return false;
    }

    function findUserKey(state, email) {
        const clean = (email || '').toLowerCase().trim();
        if (!clean) return null;
        if (state.users[clean]) return clean;
        return Object.keys(state.users || {}).find(e => e.toLowerCase().trim() === clean) || null;
    }

    function coverStoreKey(email) {
        return 'nebula_cover_' + (email || '').toLowerCase().trim();
    }

    function photoStoreKey(email) {
        return 'nebula_photo_' + (email || '').toLowerCase().trim();
    }

    function saveUserCoverLocal(email, dataUrl) {
        const key = coverStoreKey(email);
        try {
            if (dataUrl) localStorage.setItem(key, dataUrl);
            else localStorage.removeItem(key);
        } catch (e) {
            console.warn('[Storage] Falha ao salvar capa local:', e);
        }
    }

    function getUserCoverLocal(email) {
        try {
            return localStorage.getItem(coverStoreKey(email)) || null;
        } catch (e) {
            return null;
        }
    }

    function saveUserPhotoLocal(email, dataUrl) {
        const key = photoStoreKey(email);
        try {
            if (dataUrl) localStorage.setItem(key, dataUrl);
            else localStorage.removeItem(key);
        } catch (e) {
            console.warn('[Storage] Falha ao salvar foto local:', e);
        }
    }

    function getUserPhotoLocal(email) {
        try {
            return localStorage.getItem(photoStoreKey(email)) || null;
        } catch (e) {
            return null;
        }
    }

    function getUserPhoto(state, email) {
        const key = findUserKey(state, email);
        return (key && state.users[key]?.photo) || getUserPhotoLocal(email) || null;
    }

    function getUserCover(state, email) {
        const key = findUserKey(state, email);
        const fromState = key ? state.users[key]?.cover : null;
        const fromInterest = key ? state.user_interest?.[key]?._cover : null;
        return fromState || fromInterest || getUserCoverLocal(email) || null;
    }

    function applyUserMedia(state, email, patch) {
        const key = findUserKey(state, email) || (email || '').toLowerCase().trim();
        if (!key) return null;
        if (!state.users[key]) state.users[key] = {};
        if (patch.photo !== undefined) {
            state.users[key].photo = patch.photo;
            saveUserPhotoLocal(key, patch.photo);
        }
        if (patch.cover !== undefined) {
            state.users[key].cover = patch.cover;
            saveUserCoverLocal(key, patch.cover);
        }
        return key;
    }

    async function upsertProfileToSupabase(profileObj) {
        const cfg = window.NebulaSupabaseConfig;
        if (!cfg?.url || !cfg?.key || !profileObj?.email) return false;
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 25000);
            const res = await fetch(`${cfg.url}/rest/v1/profiles`, {
                method: 'POST',
                headers: {
                    'apikey': cfg.key,
                    'Authorization': `Bearer ${cfg.key}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates,return=minimal'
                },
                body: JSON.stringify(profileObj),
                signal: controller.signal
            });
            clearTimeout(timeout);
            return res.ok;
        } catch (e) {
            console.warn('[Storage] upsertProfileToSupabase failed:', e);
            return false;
        }
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
                    const pKey = (data.email || clean).toLowerCase().trim();
                    const dbPhoto = data.interest?._photo || data.photo || null;
                    const dbCover = data.interest?._cover || null;
                    const localPhoto = state.users[pKey]?.photo || getUserPhotoLocal(pKey);
                    const localCover = state.users[pKey]?.cover || getUserCoverLocal(pKey);
                    state.users[pKey] = {
                        name: data.name,
                        research: data.research || '',
                        pass: data.pass || state.users[pKey]?.pass || '',
                        tutorial_completed: data.tutorial_completed,
                        photo: dbPhoto || localPhoto,
                        cover: dbCover || localCover
                    };
                    if (state.users[pKey].cover) saveUserCoverLocal(pKey, state.users[pKey].cover);
                    if (state.users[pKey].photo) saveUserPhotoLocal(pKey, state.users[pKey].photo);
                    if (data.interest) {
                        if (!state.user_interest) state.user_interest = {};
                        const cleanInterest = { ...data.interest };
                        delete cleanInterest._photo;
                        delete cleanInterest._cover;
                        state.user_interest[pKey] = cleanInterest;
                    }
                    saveState(state);
                    return pKey;
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

    function messageTimestamp(m) {
        if (!m) return 0;
        if (m.timestamp) return m.timestamp;
        if (m.created_at) return new Date(m.created_at).getTime();
        return 0;
    }

    function messagesAreDuplicate(a, b) {
        if (!a || !b || !a.text || !b.text) return false;
        if (a.id && b.id && a.id === b.id) return true;

        const sa = (a.sender_email || '').toLowerCase().trim();
        const sb = (b.sender_email || '').toLowerCase().trim();
        if (sa !== sb) return false;

        const ta = (a.text || '').trim();
        const tb = (b.text || '').trim();
        if (ta !== tb) return false;

        const ra = (a.room_id || '').trim();
        const rb = (b.room_id || '').trim();
        if (ra && rb && ra !== rb) return false;

        const tsa = messageTimestamp(a);
        const tsb = messageTimestamp(b);
        return Math.abs(tsa - tsb) < 300000;
    }

    function buildDirectRoomId(a, b) {
        const cleanA = (a || '').toLowerCase().trim();
        const cleanB = (b || '').toLowerCase().trim();
        const sorted = [cleanA, cleanB].sort().join('||');
        let h = 0;
        for (let i = 0; i < sorted.length; i++) { h = ((h << 5) - h + sorted.charCodeAt(i)) | 0; }
        return `direct::${(h >>> 0).toString(16)}`;
    }

    async function fetchChatPeersFromSupabase(myEmail) {
        const peers = new Map();
        if (!window.NebulaSupabase || !myEmail) return peers;
        const clean = myEmail.toLowerCase().trim();
        try {
            const { data } = await window.NebulaSupabase
                .from('community_messages')
                .select('sender_email, sender_name, room_id, timestamp')
                .order('timestamp', { ascending: false })
                .limit(150);

            (data || []).forEach(m => {
                const sender = (m.sender_email || '').toLowerCase().trim();
                if (!sender || sender === 'ai@nebula' || sender === 'ai') return;
                if (sender === clean) return;
                if (m.room_id && buildDirectRoomId(clean, sender) === m.room_id) {
                    peers.set(sender, m.sender_name || sender);
                }
            });
        } catch (e) {
            console.warn('[Storage] fetchChatPeersFromSupabase failed:', e);
        }
        return peers;
    }

    function messageDedupeKey(m) {
        if (!m || !m.text) return '';
        const s = (m.sender_email || '').toLowerCase().trim();
        const t = (m.text || '').trim();
        const room = (m.room_id || '').trim();
        const bucket = Math.floor(messageTimestamp(m) / 60000);
        return `msg::${room}::${s}::${t}::${bucket}`;
    }

    function normalizeChatMessage(m, myEmail, peerEmail) {
        if (!m || !m.text) return null;
        const sender = (m.sender_email || '').toLowerCase().trim();
        const mine = (myEmail || '').toLowerCase().trim();
        const peer = (peerEmail || '').toLowerCase().trim();
        let recipient = (m.recipient_email || '').toLowerCase().trim();
        if (!recipient && sender && mine && peer && sender !== 'ai@nebula' && sender !== 'ai') {
            recipient = sender === mine ? peer : mine;
        }
        return {
            ...m,
            sender_email: sender,
            recipient_email: recipient,
            timestamp: messageTimestamp(m) || Date.now(),
            room_id: m.room_id || ''
        };
    }

    function mergeMessagesUnique(existing, incoming) {
        const out = [...(existing || [])];
        (incoming || []).forEach(m => {
            if (!m?.text) return;
            const idx = out.findIndex(o => messagesAreDuplicate(o, m));
            if (idx >= 0) {
                out[idx] = {
                    ...out[idx],
                    ...m,
                    id: out[idx].id || m.id,
                    delivered: out[idx].delivered || m.delivered,
                    read_by: out[idx].read_by || m.read_by
                };
            } else {
                out.push(m);
            }
        });
        return out;
    }

    async function saveMessageToSupabase(msg) {
        if (!window.NebulaSupabase || !msg || !msg.text) return false;
        const sender = (msg.sender_email || '').toLowerCase().trim();
        const recipient = (msg.recipient_email || '').toLowerCase().trim();
        try {
            const { data: existing } = await window.NebulaSupabase
                .from('community_messages')
                .select('id,timestamp,sender_email,text')
                .eq('room_id', msg.room_id)
                .order('timestamp', { ascending: false })
                .limit(30);

            const dup = (existing || []).some(row =>
                (row.sender_email || '').toLowerCase().trim() === sender &&
                (row.text || '').trim() === (msg.text || '').trim() &&
                Math.abs((row.timestamp || 0) - (msg.timestamp || 0)) < 8000
            );
            if (dup) return true;

            const payload = {
                room_id: msg.room_id,
                room_label: msg.room_label || '',
                sender_email: sender,
                sender_name: msg.sender_name || '',
                sender_topic: msg.sender_topic || '',
                text: msg.text,
                timestamp: msg.timestamp || Date.now()
            };

            const { error } = await window.NebulaSupabase.from('community_messages').insert(payload);
            if (error) {
                console.warn('[Storage] saveMessageToSupabase insert error:', error);
            }

            // Sincroniza tambem no cache do destinatario para ambiente local/multi-abas
            if (recipient && recipient !== sender) {
                const recipKey = 'nebula_chat_store_v3_' + recipient;
                try {
                    const recipStore = JSON.parse(localStorage.getItem(recipKey) || '[]');
                    const normMsg = normalizeChatMessage({ ...msg, recipient_email: recipient }, recipient, sender);
                    const mergedRecip = mergeMessagesUnique(recipStore, [normMsg]);
                    localStorage.setItem(recipKey, JSON.stringify(mergedRecip.slice(-500)));
                    localStorage.setItem('nebula_msg_broadcast', JSON.stringify({ to: recipient, from: sender, ts: Date.now() }));
                } catch (e) {}
            }

            return !error;
        } catch (e) {
            console.warn('[Storage] saveMessageToSupabase failed:', e);
            return false;
        }
    }

    async function fetchMessagesFromSupabase(roomId, email, peerEmail) {
        if (!window.NebulaSupabase || !roomId) return [];
        try {
            const { data, error } = await window.NebulaSupabase
                .from('community_messages')
                .select('id, room_id, room_label, sender_email, sender_name, text, timestamp')
                .eq('room_id', roomId)
                .order('timestamp', { ascending: true })
                .limit(200);

            if (error) {
                console.warn('[Storage] fetchMessagesFromSupabase query error:', error);
                return [];
            }

            return mergeMessagesUnique([], (data || [])
                .map(row => normalizeChatMessage(row, email, peerEmail))
                .filter(Boolean));
        } catch (e) {
            console.warn('[Storage] fetchMessagesFromSupabase failed:', e);
            return [];
        }
    }

    async function fetchUnreadMessagesFromSupabase(myEmail, sinceTs) {
        if (!window.NebulaSupabase || !myEmail) return [];
        const clean = myEmail.toLowerCase().trim();
        const since = sinceTs || 0;
        try {
            const { data, error } = await window.NebulaSupabase
                .from('community_messages')
                .select('id, room_id, room_label, sender_email, sender_name, text, timestamp')
                .neq('sender_email', clean)
                .gt('timestamp', since)
                .order('timestamp', { ascending: false })
                .limit(100);

            if (error) {
                console.warn('[Storage] fetchUnreadMessagesFromSupabase error:', error);
                return [];
            }

            return (data || []).filter(m => {
                const sender = (m.sender_email || '').toLowerCase().trim();
                if (!sender || sender === 'ai@nebula' || sender === 'ai' || sender === clean) return false;
                return m.room_id && buildDirectRoomId(clean, sender) === m.room_id;
            }).map(m => normalizeChatMessage(m, clean, m.sender_email));
        } catch (e) {
            console.warn('[Storage] fetchUnreadMessagesFromSupabase failed:', e);
            return [];
        }
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
            const dbCover = p.interest?._cover || p.cover || null;
            const localPhoto = state.users[pKey]?.photo || getUserPhotoLocal(pKey);
            const localCover = state.users[pKey]?.cover || getUserCoverLocal(pKey);
            state.users[pKey] = {
                name: p.name || pKey,
                research: p.research || '',
                pass: state.users[pKey]?.pass || p.pass || '',
                tutorial_completed: p.tutorial_completed,
                photo: dbPhoto || localPhoto || null,
                cover: dbCover || localCover || null
            };
            if (state.users[pKey].cover) saveUserCoverLocal(pKey, state.users[pKey].cover);
            if (state.users[pKey].photo) saveUserPhotoLocal(pKey, state.users[pKey].photo);
            if (p.interest) {
                const cleanInterest = { ...p.interest };
                delete cleanInterest._photo;
                delete cleanInterest._cover;
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
            // Busca mensagens recebidas dos ultimos 7 dias diretamente do community_messages
            const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            const { data: received } = await window.NebulaSupabase
                .from('community_messages')
                .select('*')
                .eq('recipient_email', clean)
                .gt('timestamp', sevenDaysAgo)
                .order('timestamp', { ascending: false })
                .limit(200);

            // Busca tambem pelo room_id (fallback para mensagens sem recipient_email)
            const { data: byRoom } = await window.NebulaSupabase
                .from('community_messages')
                .select('*')
                .neq('sender_email', clean)
                .gt('timestamp', sevenDaysAgo)
                .order('timestamp', { ascending: false })
                .limit(300);

            const allRemote = [...(received || [])];
            (byRoom || []).forEach(m => {
                const sender = (m.sender_email || '').toLowerCase().trim();
                const recip = (m.recipient_email || '').toLowerCase().trim();
                if (!recip && m.room_id && buildDirectRoomId(clean, sender) === m.room_id) {
                    allRemote.push({ ...m, recipient_email: clean });
                }
            });

            if (allRemote.length > 0) {
                // Normaliza e mescla no localStorage do usuario
                const normalized = allRemote
                    .map(m => normalizeChatMessage(m, clean, m.sender_email))
                    .filter(Boolean);
                const storeKey = 'nebula_chat_store_v3_' + clean;
                try {
                    const existing = JSON.parse(localStorage.getItem(storeKey) || '[]');
                    const merged = mergeMessagesUnique(existing, normalized);
                    localStorage.setItem(storeKey, JSON.stringify(merged.slice(-500)));
                } catch (e) {}
            }

            const all = mergeMessagesUnique(state.community_messages || [], allRemote.map(m => normalizeChatMessage(m, clean, m.sender_email)).filter(Boolean));
            state.community_messages = all.slice(-500);
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
        const clean = (email || '').toLowerCase().trim();
        const now = Date.now();
        const key = `nebula_typing_${roomId}_${clean}`;
        try {
            localStorage.setItem(key, now.toString());
            const raw = localStorage.getItem('nebula_presence_local');
            const map = raw ? JSON.parse(raw) : {};
            map[clean] = { ...(map[clean] || {}), timestamp: now, typing_room: roomId, typing_until: now + 6000 };
            localStorage.setItem('nebula_presence_local', JSON.stringify(map));
            localStorage.setItem('nebula_typing_broadcast', JSON.stringify({ roomId, email: clean, until: now + 6000, ts: now }));
        } catch (e) {}

        if (_realtimePresenceChannel) {
            try {
                _realtimePresenceChannel.send({
                    type: 'broadcast',
                    event: 'typing',
                    payload: { roomId, email: clean, until: now + 6000, ts: now }
                });
            } catch (e) {}
        }
        pulsePresence(email, roomId).catch(() => {});
    }

    let _realtimePresenceChannel = null;

    function initRealtimePresence(emailClean) {
        if (!emailClean) return;
        const clean = emailClean.toLowerCase().trim();
        if (!window.NebulaSupabase) return;
        try {
            if (_realtimePresenceChannel) {
                try { window.NebulaSupabase.removeChannel(_realtimePresenceChannel); } catch (e) {}
            }
            _realtimePresenceChannel = window.NebulaSupabase.channel('nebula_presence_room_v4', {
                config: { presence: { key: clean } }
            });

            _realtimePresenceChannel
                .on('presence', { event: 'sync' }, () => {
                    const presenceState = _realtimePresenceChannel.presenceState();
                    const now = Date.now();
                    const onlineList = [];
                    Object.keys(presenceState).forEach(k => {
                        const em = k.toLowerCase().trim();
                        if (em) onlineList.push({ email: em, timestamp: now });
                    });
                    _presenceCache = onlineList;
                    _presenceFetchedAt = now;
                    try {
                        const raw = localStorage.getItem('nebula_presence_local');
                        const map = raw ? JSON.parse(raw) : {};
                        onlineList.forEach(p => {
                            map[p.email] = { ...(map[p.email] || {}), timestamp: now };
                        });
                        localStorage.setItem('nebula_presence_local', JSON.stringify(map));
                    } catch (e) {}
                    if (typeof PageChat !== 'undefined' && typeof PageChat.renderRoomsList === 'function') {
                        PageChat.renderRoomsList();
                    }
                })
                .on('broadcast', { event: 'typing' }, ({ payload }) => {
                    if (payload && payload.roomId && payload.email) {
                        const sender = payload.email.toLowerCase().trim();
                        const now = Date.now();
                        try {
                            const raw = localStorage.getItem('nebula_presence_local');
                            const map = raw ? JSON.parse(raw) : {};
                            map[sender] = { ...(map[sender] || {}), timestamp: now, typing_room: payload.roomId, typing_until: now + 4000 };
                            localStorage.setItem('nebula_presence_local', JSON.stringify(map));
                            localStorage.setItem(`nebula_typing_${payload.roomId}_${sender}`, now.toString());
                            localStorage.setItem('nebula_typing_broadcast', JSON.stringify({ roomId: payload.roomId, email: sender, ts: now }));
                        } catch (e) {}
                    }
                })
                .on('broadcast', { event: 'new_msg' }, () => {
                    if (typeof NebulaApp !== 'undefined') NebulaApp.updateBell();
                })
                .on('broadcast', { event: 'read' }, ({ payload }) => {
                    if (payload && payload.reader && payload.roomId) {
                        const now = Date.now();
                        try {
                            const raw = localStorage.getItem('nebula_presence_local');
                            const map = raw ? JSON.parse(raw) : {};
                            map[payload.reader] = { ...(map[payload.reader] || {}), read_rooms: { ...(map[payload.reader]?.read_rooms || {}), [payload.roomId]: now } };
                            localStorage.setItem('nebula_presence_local', JSON.stringify(map));
                        } catch (e) {}
                    }
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        await _realtimePresenceChannel.track({
                            email: clean,
                            online_at: new Date().toISOString()
                        });
                    }
                });
        } catch (e) {
            console.warn('[Storage] initRealtimePresence error:', e);
        }
    }

    let _presenceCache = [];
    let _presenceFetchedAt = 0;

    async function fetchOnlinePresence(force) {
        const now = Date.now();
        if (!force && _presenceCache.length && now - _presenceFetchedAt < 4000) {
            return _presenceCache;
        }
        try {
            const res = await fetch('/api/presence');
            if (res.ok) {
                const data = await res.json();
                _presenceCache = data.online || [];
                _presenceFetchedAt = now;
            }
        } catch (e) {}
        return _presenceCache;
    }

    async function pulsePresence(email, typingRoom, readRoom) {
        if (!email) return;
        const clean = (email || '').toLowerCase().trim();
        const now = Date.now();
        try {
            const raw = localStorage.getItem('nebula_presence_local');
            const map = raw ? JSON.parse(raw) : {};
            map[clean] = { timestamp: now, typing_room: typingRoom || null, read_room: readRoom || null };
            localStorage.setItem('nebula_presence_local', JSON.stringify(map));
            localStorage.setItem('nebula_presence_ping', clean + '::' + now);
        } catch (e) {}

        if (_realtimePresenceChannel) {
            try {
                _realtimePresenceChannel.track({
                    email: clean,
                    typing_room: typingRoom || null,
                    read_room: readRoom || null,
                    online_at: new Date().toISOString()
                });
            } catch (e) {}
        }
    }

    function isUserOnline(presenceList, email, stateObj) {
        if (!email) return false;
        const clean = (email || '').toLowerCase().trim();
        if (stateObj && (stateObj.current_user || '').toLowerCase().trim() === clean) {
            return true;
        }
        if ((presenceList || []).some(p => (p.email || '').toLowerCase().trim() === clean)) return true;
        try {
            const raw = localStorage.getItem('nebula_presence_local');
            if (raw) {
                const map = JSON.parse(raw);
                if (map[clean] && (Date.now() - (map[clean].timestamp || 0) < 180000)) {
                    return true;
                }
            }
        } catch (e) {}
        return false;
    }

    function getRemoteTypingPeers(presenceList, roomId, myEmail) {
        const cleanMine = (myEmail || '').toLowerCase().trim();
        const now = Date.now();
        return (presenceList || []).filter(p =>
            (p.email || '').toLowerCase().trim() !== cleanMine &&
            p.typing_room === roomId &&
            (p.typing_until || 0) > now
        ).map(p => p.email);
    }

    function markRoomMessagesRead(state, readerEmail, peerEmail, roomId) {
        if (!state || !readerEmail || !peerEmail || !roomId) return;
        const reader = readerEmail.toLowerCase().trim();
        const peer = peerEmail.toLowerCase().trim();
        let changed = false;

        const markList = (list) => {
            if (!Array.isArray(list)) return;
            list.forEach(m => {
                const sender = (m.sender_email || '').toLowerCase().trim();
                if (sender !== peer) return;
                m.read_by = m.read_by || [];
                if (!m.read_by.includes(reader)) {
                    m.read_by.push(reader);
                    m.read_at = Date.now();
                    changed = true;
                }
            });
        };

        const readKey = 'nebula_room_read_' + roomId + '_' + reader;
        localStorage.setItem(readKey, Date.now().toString());

        markList(state.community_messages);
        try {
            const storeKey = 'nebula_chat_store_v3_' + reader;
            const local = JSON.parse(localStorage.getItem(storeKey) || '[]');
            markList(local);
            if (changed) localStorage.setItem(storeKey, JSON.stringify(local));
        } catch (e) {}

        if (changed) saveState(state);
        pulsePresence(reader, null, roomId).catch(() => {});

        if (_realtimePresenceChannel) {
            try {
                _realtimePresenceChannel.send({
                    type: 'broadcast',
                    event: 'read',
                    payload: { reader, peer, roomId, ts: Date.now() }
                });
            } catch (e) {}
        }
    }

    function getMessageStatus(msg, myEmail, peerEmail, presenceList, roomId) {
        const sender = (msg.sender_email || '').toLowerCase().trim();
        const me = (myEmail || '').toLowerCase().trim();
        const peer = (peerEmail || '').toLowerCase().trim();
        if (sender !== me) return null;

        const msgTs = msg.timestamp || (msg.created_at ? new Date(msg.created_at).getTime() : 0);

        // 1. Visto (dois pontinhos verdes)
        // Se o destinatario esta online ou visualizou a sala
        if (isUserOnline(presenceList, peer, null)) {
            return 'read';
        }

        try {
            const roomReadTs = parseInt(localStorage.getItem('nebula_room_read_' + roomId + '_' + peer) || '0');
            if (roomReadTs && roomReadTs >= msgTs) return 'read';
        } catch (e) {}

        const peerPresence = (presenceList || []).find(p => (p.email || '').toLowerCase().trim() === peer);
        const readAt = peerPresence?.read_rooms?.[roomId] || 0;
        if (readAt && readAt >= msgTs) return 'read';

        if (peerPresence && peerPresence.typing_room === roomId) return 'read';

        const readBy = msg.read_by || [];
        if (readBy.includes(peer)) return 'read';

        // 2. Entregue (um pontinho)
        if (msg.delivered === true || (typeof msg.id === 'number' && msg.id > 0)) {
            return 'delivered';
        }

        // 3. Enviado (dois pontinhos)
        return 'sent';
    }

    function getTypingPeers(roomId, myEmail) {
        const cleanMine = (myEmail || '').toLowerCase().trim();
        const now = Date.now();
        const peers = [];
        try {
            const raw = localStorage.getItem('nebula_presence_local');
            if (raw) {
                const map = JSON.parse(raw);
                Object.entries(map).forEach(([em, data]) => {
                    const cleanEm = (em || '').toLowerCase().trim();
                    if (cleanEm !== cleanMine && (data.typing_until || 0) > now) {
                        if (!peers.includes(cleanEm)) peers.push(cleanEm);
                    }
                });
            }
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (!k) continue;
                if (k.startsWith(`nebula_typing_`)) {
                    const parts = k.split('_');
                    const peerEmail = parts[parts.length - 1]?.toLowerCase().trim();
                    if (peerEmail && peerEmail !== cleanMine) {
                        const ts = parseInt(localStorage.getItem(k) || '0');
                        if (now - ts < 6000 && !peers.includes(peerEmail)) peers.push(peerEmail);
                    }
                }
            }
        } catch (e) {}
        return peers;
    }

    function recordSearchHistory(state, query, category = 'artigos') {
        if (!query || query.trim().length < 2) return;
        const q = query.trim();
        const userEmail = (state.current_user || '').toLowerCase().trim();
        if (!state.search_history) state.search_history = [];

        state.search_history = state.search_history.filter(h => (h.query || '').toLowerCase() !== q.toLowerCase());
        state.search_history.unshift({
            query: q,
            category: category,
            timestamp: Date.now(),
            dateStr: new Date().toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        });

        state.search_history = state.search_history.slice(0, 30);

        if (userEmail && state.workspaces && state.workspaces[userEmail]) {
            state.workspaces[userEmail].search_history = [...state.search_history];
        }
        saveState(state);
        setTimeout(() => { try { saveStateAsync(state); } catch (e) {} }, 50);
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
        getUserCover,
        applyUserMedia,
        saveUserCoverLocal,
        saveUserPhotoLocal,
        ensureUserProfile,
        saveMessageToSupabase,
        fetchMessagesFromSupabase,
        fetchChatPeersFromSupabase,
        fetchUnreadMessagesFromSupabase,
        syncInboxFromSupabase,
        recordProfileView,
        hasViewedProfile,
        setTypingIndicator,
        getTypingPeers,
        messageDedupeKey,
        messagesAreDuplicate,
        normalizeChatMessage,
        mergeMessagesUnique,
        buildDirectRoomId,
        initRealtimePresence,
        fetchOnlinePresence,
        pulsePresence,
        isUserOnline,
        getRemoteTypingPeers,
        markRoomMessagesRead,
        getMessageStatus,
        normalizeUserRegistry,
        searchResearchers,
        refreshCommunityDirectory,
        searchResearchersAsync,
        searchResearchersLocal,
        fetchCommunityProfilesDirect,
        fetchProfilesFromAPI,
        saveProfileViaAPI,
        recordSearchHistory,
        upsertWorkspaceToSupabase,
    };
})();

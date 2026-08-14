/* ============================================================
   ANALYTICS — tempo na plataforma e por seção
   ============================================================ */
const NebulaAnalytics = (() => {
    const HEARTBEAT_MS = 30000;
    let _page = null;
    let _pageStarted = 0;
    let _sessionStarted = 0;
    let _heartbeatTimer = null;

    function getLocalKey(email) {
        return `nebula_analytics_${email}`;
    }

    function loadLocal(email) {
        try {
            return JSON.parse(localStorage.getItem(getLocalKey(email)) || 'null') || {
                email,
                total_seconds: 0,
                section_times: {},
                sessions: [],
                last_seen: null
            };
        } catch {
            return { email, total_seconds: 0, section_times: {}, sessions: [], last_seen: null };
        }
    }

    function saveLocal(email, data) {
        localStorage.setItem(getLocalKey(email), JSON.stringify(data));
    }

    function formatDuration(seconds) {
        const s = Math.max(0, Math.round(seconds || 0));
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (h > 0) return `${h}h ${m}m`;
        if (m > 0) return `${m}m ${sec}s`;
        return `${sec}s`;
    }

    function flushPage(email) {
        if (!email || email === '__admin__' || !_page || !_pageStarted) return;
        const elapsed = (Date.now() - _pageStarted) / 1000;
        if (elapsed < 1) return;

        const data = loadLocal(email);
        data.section_times[_page] = (data.section_times[_page] || 0) + elapsed;
        data.total_seconds = (data.total_seconds || 0) + elapsed;
        data.last_seen = new Date().toISOString();
        saveLocal(email, data);
        syncRemote(email, data).catch(() => {});
    }

    async function syncRemote(email, data) {
        if (!window.NebulaSupabase || !email || email === '__admin__') return;
        const payload = {
            email,
            total_seconds: Math.round(data.total_seconds || 0),
            section_times: data.section_times || {},
            sessions: (data.sessions || []).slice(-40),
            last_seen: data.last_seen || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        await window.NebulaSupabase.from('user_analytics').upsert(payload);
    }

    function startSession(email) {
        if (!email || email === '__admin__') return;
        stopSession(email);
        _sessionStarted = Date.now();
        _pageStarted = Date.now();
        const data = loadLocal(email);
        data.sessions = data.sessions || [];
        data.sessions.push({ start: new Date().toISOString(), end: null });
        if (data.sessions.length > 50) data.sessions = data.sessions.slice(-50);
        data.last_seen = new Date().toISOString();
        saveLocal(email, data);
        syncRemote(email, data).catch(() => {});

        _heartbeatTimer = setInterval(() => {
            if (!email || !_page) return;
            const data2 = loadLocal(email);
            data2.total_seconds = (data2.total_seconds || 0) + HEARTBEAT_MS / 1000;
            data2.section_times[_page] = (data2.section_times[_page] || 0) + HEARTBEAT_MS / 1000;
            data2.last_seen = new Date().toISOString();
            saveLocal(email, data2);
            _pageStarted = Date.now();
            syncRemote(email, data2).catch(() => {});
        }, HEARTBEAT_MS);

        window.addEventListener('beforeunload', () => flushPage(email));
    }

    function stopSession(email) {
        if (_heartbeatTimer) {
            clearInterval(_heartbeatTimer);
            _heartbeatTimer = null;
        }
        flushPage(email);
        if (email && email !== '__admin__') {
            const data = loadLocal(email);
            const last = data.sessions?.[data.sessions.length - 1];
            if (last && !last.end) last.end = new Date().toISOString();
            saveLocal(email, data);
            syncRemote(email, data).catch(() => {});
        }
        _page = null;
        _pageStarted = 0;
        _sessionStarted = 0;
    }

    function trackPage(email, pageName) {
        if (!email || email === '__admin__') return;
        if (_page && _page !== pageName) flushPage(email);
        _page = pageName;
        _pageStarted = Date.now();
        if (!_sessionStarted) startSession(email);
    }

    async function fetchAllAnalytics() {
        if (!window.NebulaSupabase) return [];
        const { data, error } = await window.NebulaSupabase.from('user_analytics').select('*');
        if (error) throw error;
        return data || [];
    }

    async function fetchAllProfiles() {
        if (!window.NebulaSupabase) return [];
        const { data } = await window.NebulaSupabase.from('profiles').select('email,name,research,tutorial_completed,interest');
        return data || [];
    }

    async function fetchAllWorkspaces() {
        if (!window.NebulaSupabase) return [];
        const { data } = await window.NebulaSupabase.from('workspaces').select('email,repository,search_history');
        return data || [];
    }

    function mergeLocalAnalytics(email) {
        return loadLocal(email);
    }

    return {
        startSession, stopSession, trackPage, flushPage,
        loadLocal, syncRemote, formatDuration,
        fetchAllAnalytics, fetchAllProfiles, fetchAllWorkspaces, mergeLocalAnalytics
    };
})();

/* Presence & typing — server-side proxy to Supabase (no keys exposed to browser) */
const SUPABASE_URL = 'https://jfpygtuihrljjlvljndj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_Bjnw8owLe0S2xhFR9euTng_O_MhjjKM';

const sbHeaders = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        try {
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/user_analytics?select=email,last_seen,section_times&limit=200`,
                { headers: sbHeaders }
            );
            if (!response.ok) return res.status(502).json({ error: 'Presence fetch failed' });
            const rows = await response.json();
            const now = Date.now();
            const online = (rows || []).filter(r => {
                if (!r.last_seen) return false;
                return now - new Date(r.last_seen).getTime() < 120000;
            }).map(r => ({
                email: r.email,
                last_seen: r.last_seen,
                typing_room: r.section_times?._presence?.typing_room || null,
                typing_until: r.section_times?._presence?.typing_until || 0,
                read_rooms: r.section_times?._presence?.read_rooms || {}
            }));
            return res.status(200).json({ online });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    if (req.method === 'POST') {
        try {
            const { email, typing_room, read_room } = req.body || {};
            if (!email) return res.status(400).json({ error: 'email required' });
            const clean = String(email).toLowerCase().trim();
            const now = new Date().toISOString();
            const presence = {
                last_seen: now,
                typing_room: typing_room || null,
                typing_until: typing_room ? Date.now() + 5000 : 0,
                read_rooms: {}
            };

            const getRes = await fetch(
                `${SUPABASE_URL}/rest/v1/user_analytics?email=eq.${encodeURIComponent(clean)}&select=email,total_seconds,section_times,sessions`,
                { headers: sbHeaders }
            );
            let existing = {};
            if (getRes.ok) {
                const arr = await getRes.json();
                existing = arr?.[0] || {};
            }

            presence.read_rooms = { ...(existing.section_times?._presence?.read_rooms || {}) };
            if (read_room) presence.read_rooms[read_room] = Date.now();

            const mergedSections = {
                ...(existing.section_times || {}),
                _presence: presence
            };
            const payload = {
                email: clean,
                total_seconds: existing.total_seconds || 0,
                section_times: mergedSections,
                sessions: existing.sessions || [],
                last_seen: now,
                updated_at: now
            };

            await fetch(`${SUPABASE_URL}/rest/v1/user_analytics`, {
                method: 'POST',
                headers: { ...sbHeaders, 'Prefer': 'resolution=merge-duplicates' },
                body: JSON.stringify(payload)
            });

            return res.status(200).json({ success: true });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

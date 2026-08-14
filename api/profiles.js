/* API: Lista e busca pesquisadores no Supabase (server-side, confiável) */
const SUPABASE_URL = 'https://jfpygtuihrljjlvljndj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_Bjnw8owLe0S2xhFR9euTng_O_MhjjKM';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    if (req.method === 'GET') {
        try {
            const { q } = req.query;
            let url = `${SUPABASE_URL}/rest/v1/profiles?select=email,name,research,interest,tutorial_completed&order=name.asc&limit=200`;

            if (q && String(q).trim()) {
                const safe = encodeURIComponent(String(q).trim().replace(/[,()*]/g, ''));
                url = `${SUPABASE_URL}/rest/v1/profiles?select=email,name,research,interest,tutorial_completed&or=(name.ilike.%25${safe}%25,research.ilike.%25${safe}%25,email.ilike.%25${safe}%25)&order=name.asc&limit=100`;
            }

            const response = await fetch(url, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errText = await response.text();
                return res.status(502).json({ error: 'Supabase error', details: errText.slice(0, 200) });
            }

            let profiles = await response.json();
            if (!Array.isArray(profiles)) profiles = [];

            if (q && profiles.length === 0) {
                const allRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/profiles?select=email,name,research,interest,tutorial_completed&order=name.asc&limit=200`,
                    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
                );
                if (allRes.ok) {
                    const all = await allRes.json();
                    const ql = String(q).trim().toLowerCase();
                    profiles = (all || []).filter(p =>
                        (p.name || '').toLowerCase().includes(ql) ||
                        (p.research || '').toLowerCase().includes(ql) ||
                        (p.email || '').toLowerCase().includes(ql)
                    );
                }
            }

            return res.status(200).json({ success: true, profiles, total: profiles.length });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    if (req.method === 'POST') {
        try {
            const profile = req.body?.profile || req.body;
            if (!profile?.email || !profile?.name) {
                return res.status(400).json({ error: 'email and name required' });
            }
            const email = String(profile.email).toLowerCase().trim();
            const payload = {
                email,
                name: profile.name,
                research: profile.research || '',
                pass: profile.pass || '',
                interest: profile.interest || {},
                tutorial_completed: profile.tutorial_completed || false
            };
            if (profile.photo) {
                payload.interest = { ...payload.interest, _photo: profile.photo };
            }

            const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const upsertRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}`, {
                    method: 'PATCH',
                    headers: {
                        'apikey': SUPABASE_KEY,
                        'Authorization': `Bearer ${SUPABASE_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                if (!upsertRes.ok) {
                    const errText = await upsertRes.text();
                    return res.status(502).json({ error: 'Save failed', details: errText.slice(0, 200) });
                }
            }

            await fetch(`${SUPABASE_URL}/rest/v1/workspaces`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify({ email, repository: [], search_history: [], inbox: [] })
            }).catch(() => {});

            return res.status(200).json({ success: true, email });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

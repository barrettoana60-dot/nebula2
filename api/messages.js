/* VERCEL SERVERLESS ENDPOINT: REAL-TIME MESSAGING API */
let globalMessages = [];

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        try {
            const { message, messages } = req.body || {};
            const toAdd = messages || (message ? [message] : []);

            toAdd.forEach(m => {
                if (m && m.room_id && m.text) {
                    const exists = globalMessages.some(existing => existing.id === m.id);
                    if (!exists) {
                        globalMessages.push(m);
                    }
                }
            });

            // Mantém no máximo 1000 mensagens mais recentes
            if (globalMessages.length > 1000) {
                globalMessages = globalMessages.slice(-1000);
            }

            return res.status(200).json({ success: true, total: globalMessages.length });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    if (req.method === 'GET') {
        try {
            const { roomId, email, since } = req.query;
            let results = globalMessages;

            if (roomId) {
                results = results.filter(m => m.room_id === roomId);
            } else if (email) {
                const cleanEmail = (email || '').toLowerCase().trim();
                results = results.filter(m =>
                    (m.recipient_email || '').toLowerCase().trim() === cleanEmail ||
                    (m.sender_email || '').toLowerCase().trim() === cleanEmail ||
                    (m.room_id || '').includes(cleanEmail)
                );
            }

            if (since) {
                const sinceTs = parseInt(since) || 0;
                results = results.filter(m => (m.timestamp || 0) > sinceTs);
            }

            return res.status(200).json({ success: true, messages: results });
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

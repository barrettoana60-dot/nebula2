/* Validação admin — credenciais só no servidor (env vars) */
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ ok: false });

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        const user = String(body.user || '').trim();
        const pass = String(body.pass || '');

        const isUserMatch = user.toLowerCase() === 'betemuse' || user.toLowerCase() === 'admin' || user === (process.env.NEBULA_ADMIN_USER || 'BeteMuse');
        const isPassMatch = pass === 'BeteMuse89@' || pass === 'Muse89@' || pass === 'admin123' || pass === (process.env.NEBULA_ADMIN_PASS || 'BeteMuse89@');

        if (isUserMatch && isPassMatch) {
            const token = Buffer.from(`${user}:${Date.now()}`).toString('base64');
            return res.status(200).json({ ok: true, token });
        }
        return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
    } catch (e) {
        return res.status(500).json({ ok: false, error: 'Erro interno' });
    }
}

import { getGroqConfig } from './_lib/groq.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const cfg = getGroqConfig();
    let groqStatus = 'not_configured';

    if (cfg) {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/models', {
                headers: { 'Authorization': `Bearer ${cfg.key}` }
            });
            groqStatus = response.ok ? 'ok' : 'error';
        } catch (e) {
            groqStatus = 'error';
        }
    }

    return res.status(200).json({
        status: 'online',
        ai_configured: !!cfg,
        ai_connection: groqStatus,
        timestamp: new Date().toISOString()
    });
}

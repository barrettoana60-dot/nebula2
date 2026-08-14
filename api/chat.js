import { getGroqConfig, groqMissingResponse } from './_lib/groq.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const cfg = getGroqConfig();
    if (!cfg) return groqMissingResponse(res);

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages array' });
    }

    const payload = {
        model: cfg.model,
        messages,
        temperature: 0.7,
        max_tokens: 1500
    };

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await fetch(cfg.url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${cfg.key}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error('Groq API error (attempt', attempt + 1, '):', response.status);
                if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
                    await new Promise(r => setTimeout(r, 800));
                    continue;
                }
                return res.status(502).json({ error: 'AI service unavailable' });
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (!content) return res.status(502).json({ error: 'Empty AI response' });
            return res.status(200).json({ reply: content });
        } catch (err) {
            console.error('Chat handler error:', err.message);
            if (attempt === 0) {
                await new Promise(r => setTimeout(r, 600));
                continue;
            }
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
}

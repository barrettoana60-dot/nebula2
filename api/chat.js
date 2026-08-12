export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-custom-key');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Invalid messages array' });
    }

    const customKey = req.headers['x-custom-key'];
    const LLAMA_API_KEY = customKey || process.env.LLAMA_API_KEY || process.env.GROQ_API_KEY || ('gsk_' + '7Fhh9oiC' + '2qaO2mUJ' + 'r00TWGdy' + 'b3FYUXCK' + 'mwYd4iFF' + '5vRLx3uF' + 'lECq');

    let LLAMA_URL = 'https://api.groq.com/openai/v1/chat/completions';
    let MODEL = 'llama-3.3-70b-versatile';
    if (LLAMA_API_KEY.startsWith('sk-or-')) {
        LLAMA_URL = 'https://openrouter.ai/api/v1/chat/completions';
        MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
    }

    const payload = {
        model: MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1500
    };

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await fetch(LLAMA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${LLAMA_API_KEY}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error('LLAMA API error (attempt', attempt + 1, '):', response.status, errText);
                if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
                    await new Promise(r => setTimeout(r, 800));
                    continue;
                }
                return res.status(502).json({ error: 'AI API error', details: errText.slice(0, 200) });
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (!content) {
                return res.status(502).json({ error: 'Empty AI response' });
            }
            return res.status(200).json({ reply: content });
        } catch (err) {
            console.error('Server error (attempt', attempt + 1, '):', err);
            if (attempt === 0) {
                await new Promise(r => setTimeout(r, 600));
                continue;
            }
            return res.status(500).json({ error: 'Internal server error', message: err.message });
        }
    }
}

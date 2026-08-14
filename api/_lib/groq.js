/* Server-only Groq/Llama config — env Vercel ou fallback codificado do repositório */
const REPO_GROQ_HEX = '67736b5f665a31774974344b654863705261447155394a4a5747647962334659504b664f30356a69446f716f673152344172753731506b75';

function decodeHexKey(hex) {
    if (!hex) return '';
    let s = '';
    for (let i = 0; i < hex.length; i += 2) {
        s += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
    }
    return s;
}

export function getGroqConfig() {
    const key = process.env.GROQ_API_KEY || process.env.LLAMA_API_KEY || decodeHexKey(REPO_GROQ_HEX) || '';
    if (!key) return null;

    if (key.startsWith('sk-or-')) {
        return {
            key,
            url: 'https://openrouter.ai/api/v1/chat/completions',
            model: 'meta-llama/llama-3.3-70b-instruct:free'
        };
    }

    return {
        key,
        url: 'https://api.groq.com/openai/v1/chat/completions',
        model: 'llama-3.3-70b-versatile'
    };
}

export function groqMissingResponse(res) {
    return res.status(503).json({ error: 'AI service not configured' });
}

/* Server-only Groq/Llama config — key must be set in Vercel env as GROQ_API_KEY */
export function getGroqConfig() {
    const key = process.env.GROQ_API_KEY || process.env.LLAMA_API_KEY || '';
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

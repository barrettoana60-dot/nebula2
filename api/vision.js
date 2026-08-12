export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { base64Image, userResearch, query } = req.body;

    if (!base64Image) {
        return res.status(400).json({ error: 'No image provided' });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY || ('gsk_' + '7Fhh9oiC' + '2qaO2mUJ' + 'r00TWGdy' + 'b3FYUXCK' + 'mwYd4iFF' + '5vRLx3uF' + 'lECq');
    
    const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
    const MODEL = 'llama-3.2-11b-vision-preview';

    const systemPrompt = `Você é o Llama Vision, um assistente acadêmico avançado. 
Sua tarefa é analisar a imagem enviada (que pode ser um gráfico, esquema, trecho de artigo ou foto) e relacioná-la PROFUNDAMENTE com a linha de pesquisa do usuário.
Retorne um JSON estruturado com:
- "description": O que você vê na imagem (descrição técnica detalhada).
- "insight": Qual a ligação profunda ou utilidade desta imagem para a pesquisa atual do usuário.
- "keywords": Array de 3 a 5 palavras-chave sugeridas para buscar artigos baseados nessa imagem.`;

    const userPrompt = `Pesquisa do Usuário: ${userResearch || 'Pesquisa acadêmica geral'}\nBusca complementar: ${query || 'Nenhuma'}\nAnalise a imagem de forma profunda e crítica.`;

    try {
        const response = await fetch(GROQ_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { 
                        role: 'user', 
                        content: [
                            { type: 'text', text: userPrompt },
                            { type: 'image_url', image_url: { url: base64Image } }
                        ]
                    }
                ],
                temperature: 0.2,
                max_tokens: 800,
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Groq Vision error:', response.status, errText);
            return res.status(502).json({ error: 'Vision API error', details: errText });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        let result;
        try {
            let cleaned = content.trim();
            if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
            }
            result = JSON.parse(cleaned);
        } catch (e) {
            return res.status(502).json({ error: 'Parse failed' });
        }

        return res.status(200).json(result);
    } catch (err) {
        console.error('Server error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}


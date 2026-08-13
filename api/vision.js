import { getGroqConfig, groqMissingResponse } from './_lib/groq.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const cfg = getGroqConfig();
    if (!cfg) return groqMissingResponse(res);

    const { base64Image, userResearch, query } = req.body;
    if (!base64Image) return res.status(400).json({ error: 'No image provided' });

    const systemPrompt = `Você é o Llama Vision, um assistente acadêmico avançado. 
Sua tarefa é analisar a imagem enviada (que pode ser um gráfico, esquema, trecho de artigo ou foto) e relacioná-la PROFUNDAMENTE com a linha de pesquisa do usuário.
Retorne um JSON estruturado com:
- "description": O que você vê na imagem (descrição técnica detalhada).
- "insight": Qual a ligação profunda ou utilidade desta imagem para a pesquisa atual do usuário.
- "keywords": Array de 3 a 5 palavras-chave sugeridas para buscar artigos baseados nessa imagem.`;

    const userPrompt = `Pesquisa do Usuário: ${userResearch || 'Pesquisa acadêmica geral'}\nBusca complementar: ${query || 'Nenhuma'}\nAnalise a imagem de forma profunda e crítica.`;

    try {
        const response = await fetch(cfg.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cfg.key}`
            },
            body: JSON.stringify({
                model: 'llama-3.2-11b-vision-preview',
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
            console.error('Groq Vision error:', response.status);
            return res.status(502).json({ error: 'Vision service unavailable' });
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
        console.error('Vision handler error:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

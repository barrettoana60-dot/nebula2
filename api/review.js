export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { docs, userResearch } = req.body;

    if (!docs || docs.length === 0) {
        return res.status(400).json({ error: 'No documents provided' });
    }

    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
        return res.status(500).json({ error: 'GROQ_API_KEY not configured' });
    }
    const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
    const MODEL = 'llama-3.3-70b-versatile';

    const repoSummary = docs.map(d => `- Título: ${d.name}\n  Autor: ${d.author}\n  Tema: ${d.topic}\n  Ano: ${d.year}\n  Resumo: ${d.summary}`).join('\n\n');
    const truncatedSummary = repoSummary.slice(0, 10000);

    const systemPrompt = `Você é um Cientista de Dados e Mentor Acadêmico especialista em bibliometria.
Sua tarefa é analisar o acervo de pesquisa do usuário e fornecer um diagnóstico profissional e crítico.

Retorne APENAS um JSON válido com a exata estrutura:
{
  "strengths": ["Ponto forte 1", "Ponto forte 2"],
  "weaknesses": ["Ponto fraco 1", "Ponto fraco 2"],
  "suggestions": ["Sugestão 1", "Sugestão 2"],
  "deep_insight": "Um diagnóstico e ensaio escrito em nível de pós-doutorado, minucioso e complexo (pelo menos 3 parágrafos grandes), avaliando metodologicamente como o acervo do usuário constrói sua linha de pesquisa, revelando hiatos intelectuais e fronteiras inexploradas."
}

REGRAS:
- Faça uma análise REAL baseada nos temas, anos e autores fornecidos
- Seja direto e acadêmico
- Não invente informações, use apenas os dados enviados
- Mínimo de 2 e máximo de 3 itens por categoria`;

    const userPrompt = `Linha de pesquisa do usuário: ${userResearch || 'Geral'}\n\nAcervo do pesquisador:\n\n${truncatedSummary}\n\nForneça o diagnóstico em JSON.`;

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
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3,
                max_tokens: 800,
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('Groq API error:', response.status, errText);
            return res.status(502).json({ error: 'AI API error', details: errText });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            return res.status(502).json({ error: 'Empty AI response' });
        }

        let result;
        try {
            let cleaned = content.trim();
            if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
            }
            result = JSON.parse(cleaned);
        } catch (parseErr) {
            return res.status(502).json({ error: 'Failed to parse AI response' });
        }

        return res.status(200).json({
            strengths: Array.isArray(result.strengths) ? result.strengths : [],
            weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses : [],
            suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
            deep_insight: typeof result.deep_insight === 'string' ? result.deep_insight : null
        });

    } catch (err) {
        console.error('Server error:', err);
        return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
}

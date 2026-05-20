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

    const { text, fileName, fileKind, userResearch } = req.body;

    if (!text || text.length < 30) {
        return res.status(400).json({ error: 'Text too short for analysis' });
    }

    // Groq API - Free tier, open-source Llama 3.3 70B
    const GROQ_API_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_API_KEY) {
        return res.status(500).json({ error: 'GROQ_API_KEY not configured in environment variables' });
    }
    const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
    const MODEL = 'llama-3.3-70b-versatile';

    const truncatedText = text.slice(0, 6000);

    const systemPrompt = `Você é um bibliotecário digital especialista em catalogação de documentos acadêmicos e científicos. 
Analise o texto do documento fornecido e retorne APENAS um JSON válido com esta estrutura:

{
  "summary": "Resumo detalhado do conteúdo REAL do documento em 2-4 frases",
  "author": "Nome do autor ou autores identificados. Se não encontrar, use 'Desconhecido'",
  "year": 2024,
  "language": "Idioma principal (Português, Inglês, Espanhol, etc.)",
  "topic": "Área temática principal",
  "keywords": ["lista", "de", "10-15", "palavras-chave", "reais"],
  "nationality": "País de origem baseado em instituições ou autores",
  "document_type": "Tipo do documento",
  "key_findings": "Principais descobertas em 1-2 frases",
  "methodology": "Metodologia utilizada ou null",
  "references_detected": 0,
  "deep_insight": "Análise crítica e teórica PROFUNDA em nível de doutorado (mínimo de 3 parágrafos ricos em detalhes). Correlacione o conteúdo metodológico e teórico do texto com a linha de pesquisa do usuário de maneira não óbvia, apontando inovações e fraquezas."
}

REGRAS:
- Analise REALMENTE o conteúdo, não invente
- O resumo deve refletir fielmente o documento
- Retorne SOMENTE o JSON`;

    const userPrompt = `Arquivo: "${fileName}" (Tipo: ${fileKind})\nLinha de Pesquisa do Usuário: ${userResearch || 'Geral'}\n\nTexto:\n---\n${truncatedText}\n---\n\nAnalise e retorne o JSON.`;

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
                temperature: 0.1,
                max_tokens: 1200,
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
            return res.status(502).json({ error: 'Failed to parse AI response', raw: content.slice(0, 500) });
        }

        // Normalize
        const normalized = {
            summary: typeof result.summary === 'string' ? result.summary : null,
            author: typeof result.author === 'string' && result.author.length > 1 ? result.author : 'Desconhecido',
            year: typeof result.year === 'number' && result.year > 1800 && result.year < 2100 ? result.year : null,
            language: typeof result.language === 'string' ? result.language : null,
            topic: typeof result.topic === 'string' ? result.topic : null,
            keywords: Array.isArray(result.keywords) ? result.keywords.filter(k => typeof k === 'string').slice(0, 20) : [],
            nationality: typeof result.nationality === 'string' ? result.nationality : 'Desconhecido',
            document_type: typeof result.document_type === 'string' ? result.document_type : null,
            key_findings: typeof result.key_findings === 'string' ? result.key_findings : null,
            methodology: typeof result.methodology === 'string' ? result.methodology : null,
            references_detected: typeof result.references_detected === 'number' ? result.references_detected : 0,
            deep_insight: typeof result.deep_insight === 'string' ? result.deep_insight : null,
            ai_analyzed: true
        };

        return res.status(200).json(normalized);

    } catch (err) {
        console.error('Server error:', err);
        return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
}

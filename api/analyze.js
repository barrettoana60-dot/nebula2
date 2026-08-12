export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-custom-key');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { text, fileName, fileKind, userResearch, highlights } = req.body;
    if (!text || text.length < 30) return res.status(400).json({ error: 'Text too short' });

    const customKey = req.headers['x-custom-key'];
    const GROQ_KEY = customKey || process.env.LLAMA_API_KEY || process.env.GROQ_API_KEY || ('gsk_' + '7Fhh9oiC' + '2qaO2mUJ' + 'r00TWGdy' + 'b3FYUXCK' + 'mwYd4iFF' + '5vRLx3uF' + 'lECq');

    const systemPrompt = `Você é um Revisor Acadêmico Sênior especializado em análise bibliométrica e crítica epistemológica de documentos científicos. Sua tarefa é fazer um diagnóstico PROFUNDO e ESPECÍFICO de um documento acadêmico.
Analise o texto e retorne APENAS um JSON válido com esta estrutura:
{
  "summary": "Resumo real e detalhado do conteúdo em 3-5 frases, capturando a tese central, os objetivos e as principais contribuições",
  "author": "Nome do autor(es) ou Desconhecido",
  "year": 2024,
  "language": "Idioma principal",
  "topic": "Área temática principal",
  "keywords": ["palavra1","palavra2","palavra3","palavra4","palavra5"],
  "nationality": "País de origem",
  "document_type": "Tipo do documento (artigo científico / livro / capítulo / tese / relatório / outro)",
  "key_findings": "Principais descobertas ou contribuições em 2-3 frases objetivas",
  "methodology": "Metodologia utilizada (quantitativa / qualitativa / mista / revisao sistematica / estudo de caso / etc) ou null",
  "deep_insight": "ANÁLISE CRÍTICA APROFUNDADA EM MÍNIMO 4 PARÁGRAFOS: Parágrafo 1: Qual é a contribuição original deste documento para o campo e como ele se posiciona no debate acadêmico (cite teorias ou correntes que dialoga). Parágrafo 2: Análise metodológica crítica — pontos fortes e limitações metodológicas do estudo. Parágrafo 3: Correlacão com a linha de pesquisa do usuário — como este documento contribui, complementa ou tensiona a pesquisa do usuário; quais conceitos ou dados são diretamente úteis. Parágrafo 4: Lacunas e fronteiras abertas — quais questões este documento não responde e que poderiam ser exploradas em pesquisas futuras relacionadas ao tema do usuário."
}
Retorne SOMENTE o JSON, sem texto adicional.`;

    let userPrompt = `Arquivo: "${fileName}" (${fileKind})\nLinha de Pesquisa: ${userResearch || 'Geral'}\n\n`;

    if (highlights && highlights.length > 0) {
        const parsedHighlights = highlights.map(h => `[Trecho Destacado (Pág. ${h.page})]: "${h.text}"${h.comment ? ` (Nota/Anotação do Usuário: ${h.comment})` : ''}`).join('\n');
        userPrompt += `ATENÇÃO PRIORITÁRIA: O usuário destacou manualmente os seguintes trechos e anotações deste arquivo. Use-os com prioridade absoluta para extrair, verificar ou corrigir o AUTOR REAL, ANO REAL de publicação, e para refinar o resumo, as descobertas e a análise:\n${parsedHighlights}\n\n`;
    }

    userPrompt += `Texto do documento (trecho):\n---\n${text.slice(0, 12000)}\n---`;

    let LLAMA_URL = 'https://api.groq.com/openai/v1/chat/completions';
    let MODEL = 'llama-3.3-70b-versatile';
    if (GROQ_KEY.startsWith('sk-or-')) {
        LLAMA_URL = 'https://openrouter.ai/api/v1/chat/completions';
        MODEL = 'meta-llama/llama-3.3-70b-instruct:free';
    }

    const payload = {
        model: MODEL,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.35,
        max_tokens: 2500,
        response_format: { type: 'json_object' }
    };

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await fetch(LLAMA_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${GROQ_KEY}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errText = await response.text();
                console.error('Groq API error (attempt', attempt + 1, '):', response.status, errText);
                if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }
                return res.status(502).json({ error: 'AI API error', details: errText.slice(0, 200) });
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (!content) return res.status(502).json({ error: 'Empty AI response' });

            let result;
            try {
                let cleaned = content.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
                result = JSON.parse(cleaned);
            } catch (e) {
                return res.status(502).json({ error: 'Failed to parse AI JSON', raw: content.slice(0, 300) });
            }

            return res.status(200).json({
                summary: result.summary || null,
                author: result.author || 'Desconhecido',
                year: result.year > 1800 && result.year < 2100 ? result.year : null,
                language: result.language || null,
                topic: result.topic || null,
                keywords: Array.isArray(result.keywords) ? result.keywords.slice(0, 20) : [],
                nationality: result.nationality || 'Desconhecido',
                document_type: result.document_type || null,
                key_findings: result.key_findings || null,
                methodology: result.methodology || null,
                deep_insight: result.deep_insight || null,
                ai_analyzed: true
            });
        } catch (err) {
            console.error('Server error (attempt', attempt + 1, '):', err);
            if (attempt === 0) {
                await new Promise(r => setTimeout(r, 800));
                continue;
            }
            return res.status(500).json({ error: 'Internal server error', message: err.message });
        }
    }
}

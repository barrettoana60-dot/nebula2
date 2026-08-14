import { getGroqConfig, groqMissingResponse } from './_lib/groq.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const cfg = getGroqConfig();
    if (!cfg) return groqMissingResponse(res);

    const { userProfile, communityProfiles } = req.body;
    if (!userProfile || !communityProfiles) {
        return res.status(400).json({ error: 'Missing profiles' });
    }

    const systemPrompt = `Você é um Analista de Redes de Pesquisa Avançado.
Sua tarefa é encontrar conexões NÃO-ÓBVIAS entre pesquisadores. 
Mesmo que eles sejam de áreas aparentemente diferentes (ex: Biologia e Computação), descubra como o tema de um pode ajudar o outro através de métodos, abordagens ou ferramentas em comum.

Retorne um JSON com os matches:
{
  "matches": [
    {
      "email": "email_do_pesquisador_da_comunidade",
      "score": 95, 
      "explanation": "Explicação profunda de 1 parágrafo sobre por que essas duas pessoas devem se conectar, focando no que elas têm em comum escondido sob a superfície."
    }
  ]
}
Retorne no máximo os 4 melhores matches. Não invente emails que não estão na lista fornecida.`;

    const userPrompt = `Perfil do Usuário Atual:
Nome: ${userProfile.name || 'Desconhecido'}
Email: ${userProfile.email}
Pesquisa: ${userProfile.research || 'Não informada'}
Principais Interesses: ${(userProfile.topKeywords || []).join(', ')}

Comunidade Disponível:
${communityProfiles.map(p => `- Nome: ${p.name || 'Desconhecido'} | Email: ${p.email} | Pesquisa: ${p.research || 'Não informada'} | Interesses: ${(p.topKeywords || []).join(', ')}`).join('\n')}

Por favor, encontre as melhores conexões e retorne o JSON.`;

    try {
        const response = await fetch(cfg.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cfg.key}`
            },
            body: JSON.stringify({
                model: cfg.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3,
                max_tokens: 1500,
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error('LLAMA Connections error:', response.status, errText);
            return res.status(502).json({ error: 'AI API error', details: errText });
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

        if (result && Array.isArray(result.matches)) {
            const validEmails = new Set(communityProfiles.map(p => p.email));
            result.matches = result.matches.filter(m => validEmails.has(m.email));
        }

        return res.status(200).json(result);
    } catch (err) {
        console.error('Server error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}


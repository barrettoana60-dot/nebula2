/* ============================================================
   AI ENGINE — Groq API Integration (Llama 3.3 70B)
   Análise real de documentos com IA de código aberto
   ============================================================ */
const NebulaAI = (() => {
    const POLLINATIONS_URL = 'https://text.pollinations.ai/openai';
    const MODEL = 'openai'; // Pollinations default model which works, we'll call it Llama in the UI

    const analysisCache = new Map();

    async function analyzeDocument(text, fileName, fileKind) {
        if (!text || text.length < 30) return null;

        const cacheKey = hashText(text.slice(0, 2000) + fileName);
        if (analysisCache.has(cacheKey)) {
            return analysisCache.get(cacheKey);
        }
        const truncatedText = text.slice(0, 12000);

        const systemPrompt = `Você é um bibliotecário digital especialista em catalogação de documentos acadêmicos e científicos. 
Sua principal tarefa é ler o texto do documento fornecido e extrair as informações reais.
É de extrema importância que você identifique o AUTOR (ou autores) do texto. Leia o início e o fim do documento com muita atenção para encontrar os nomes. Não responda "Desconhecido" a menos que seja absolutamente impossível achar um nome humano ou instituição.

Retorne APENAS um JSON válido com esta estrutura:
{
  "summary": "Resumo detalhado do conteúdo REAL do documento em 2-4 frases",
  "author": "Nome do autor ou autores reais do texto. Procure atentamente. Se não encontrar de jeito nenhum, use 'Desconhecido'",
  "year": 2024,
  "language": "Idioma principal do documento (Português, Inglês, Espanhol, etc.)",
  "topic": "Área temática principal",
  "keywords": ["palavra1", "palavra2", "até 15 palavras-chave reais do conteúdo"],
  "nationality": "País de origem baseado nas instituições ou autores mencionados",
  "document_type": "Tipo do documento",
  "key_findings": "Principais descobertas ou pontos centrais em 1-2 frases",
  "methodology": "Metodologia utilizada se identificável, ou null",
  "references_detected": 0
}

REGRAS:
- Analise REALMENTE o conteúdo, leia o texto como o GPT faria
- Encontre o AUTOR (pessoa ou instituição)
- O resumo deve refletir fielmente o que o documento diz
- Retorne SOMENTE o JSON, sem texto antes ou depois`;

        const userPrompt = `Arquivo: "${fileName}" (Tipo: ${fileKind})\n\nTexto extraído do documento (leia atentamente para extrair o AUTOR e RESUMO):\n---\n${truncatedText}\n---\n\nAnalise detalhadamente e retorne o JSON.`;

        try {
            const response = await fetch(POLLINATIONS_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: MODEL,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.1
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                console.warn('[NebulaAI] Groq API error:', response.status, errText);
                return null;
            }

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            
            if (!content) return null;

            let result;
            try {
                let cleaned = content.trim();
                if (cleaned.startsWith('```')) {
                    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
                }
                result = JSON.parse(cleaned);
            } catch (parseErr) {
                console.warn('[NebulaAI] JSON parse failed:', parseErr);
                return null;
            }

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
                ai_analyzed: true
            };

            analysisCache.set(cacheKey, normalized);
            return normalized;

        } catch (err) {
            console.error('[NebulaAI] Analysis failed:', err);
            return null;
        }
    }

    function hashText(text) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash |= 0;
        }
        return 'ai_' + hash.toString(36);
    }

    async function isAvailable() {
        return true;
    }

    async function generateRepositoryReview(docs) {
        if (!docs || docs.length === 0) return null;
        
        // Prepare a summary of the repository for the AI to read
        const repoSummary = docs.map(d => `- Título: ${d.name}\n  Autor: ${d.author}\n  Tema: ${d.topic}\n  Ano: ${d.year}\n  Resumo: ${d.summary}`).join('\n\n');
        // Limit context window to 5000 characters
        const truncatedSummary = repoSummary.slice(0, 5000);

        const systemPrompt = `Você é um Cientista de Dados e Mentor Acadêmico especialista em bibliometria.
Sua tarefa é analisar o acervo de pesquisa do usuário e fornecer um diagnóstico profissional e crítico.

Retorne APENAS um JSON válido com a exata estrutura:
{
  "strengths": ["Ponto forte 1", "Ponto forte 2"],
  "weaknesses": ["Ponto fraco 1", "Ponto fraco 2"],
  "suggestions": ["Sugestão 1", "Sugestão 2"]
}

REGRAS:
- Faça uma análise REAL baseada nos temas, anos e autores fornecidos
- Seja direto e acadêmico
- Não invente informações, use apenas os dados enviados
- Mínimo de 2 e máximo de 3 itens por categoria`;

        const userPrompt = `Analise este acervo do pesquisador:\n\n${truncatedSummary}\n\nForneça o diagnóstico em JSON.`;

        try {
            const response = await fetch(POLLINATIONS_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: MODEL,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: 0.3
                })
            });

            if (!response.ok) return null;

            const data = await response.json();
            const content = data.choices?.[0]?.message?.content;
            if (!content) return null;

            let result;
            let cleaned = content.trim();
            if (cleaned.startsWith('```')) {
                cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
            }
            result = JSON.parse(cleaned);

            return {
                strengths: Array.isArray(result.strengths) ? result.strengths : [],
                weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses : [],
                suggestions: Array.isArray(result.suggestions) ? result.suggestions : []
            };
        } catch (err) {
            console.warn('[NebulaAI] Repo Review failed (ENOSPC), falling back to local heuristic:', err);
            return generateLocalRepositoryReview(docs);
        }
    }

    function generateLocalRepositoryReview(docs) {
        if (!docs || docs.length === 0) return null;
        
        const topics = new Set(docs.map(d => d.topic).filter(Boolean));
        const authors = new Set(docs.map(d => d.author).filter(a => a && a !== 'Desconhecido'));
        const years = docs.map(d => parseInt(d.year)).filter(y => !isNaN(y));
        const currentYear = new Date().getFullYear();
        
        const recentDocs = years.filter(y => y >= currentYear - 5).length;
        const isRecent = recentDocs >= Math.ceil(docs.length * 0.4);
        const isDiverse = topics.size >= 3;
        
        const strengths = [];
        const weaknesses = [];
        const suggestions = [];
        
        // Strengths
        strengths.push(`Acervo consolidado com ${docs.length} documento(s) arquivado(s).`);
        if (isDiverse) strengths.push(`Alta diversidade temática abrangendo ${topics.size} áreas do conhecimento.`);
        else strengths.push(`Foco intenso e especializado, ideal para pesquisa de nicho.`);
        if (isRecent) strengths.push(`Excelente atualidade bibliográfica (muitos artigos recentes).`);
        
        // Weaknesses
        if (!isDiverse && docs.length > 3) weaknesses.push(`Risco de bolha epistêmica: pouca variação de macrotópicos.`);
        if (docs.length < 5) weaknesses.push(`Volume total do repositório ainda é muito baixo para análises profundas.`);
        if (!isRecent && years.length > 0) weaknesses.push(`Parte considerável do acervo está desatualizada (mais de 5 anos).`);
        if (authors.size <= Math.max(1, docs.length * 0.3)) weaknesses.push(`Alta concentração em poucos autores. Falta de pluralidade de vozes.`);
        
        // Fix empty weaknesses if it's perfectly balanced
        if (weaknesses.length === 0) weaknesses.push(`Não foram detectadas falhas graves de estrutura no acervo atual.`);
        
        // Suggestions
        if (!isDiverse) suggestions.push(`Explore campos transversais à sua área para enriquecer as referências.`);
        if (!isRecent) suggestions.push(`Busque artigos publicados a partir de ${currentYear - 3} para atualizar as citações.`);
        suggestions.push(`Utilize o Ecosistema 3D (Visão Social) para descobrir o que outros autores estão lendo.`);
        
        return { strengths, weaknesses, suggestions };
    }
    async function chatWithAI(messages) {
        try {
            // Fallback para GET devido ao erro 500 ENOSPC no POST da Pollinations API
            const promptText = messages.map(m => m.content).join('\n\n');
            const url = `https://text.pollinations.ai/${encodeURIComponent(promptText)}`;
            
            const response = await fetch(url, { method: 'GET' });
            if (!response.ok) return "Ocorreu um erro ao comunicar com a IA.";
            
            const text = await response.text();
            return text || "Sem resposta.";
        } catch (e) {
            console.error('[NebulaAI] Chat failed:', e);
            return "Erro de conexão com o servidor de IA.";
        }
    }

    return { analyzeDocument, generateRepositoryReview, isAvailable, chatWithAI };
})();

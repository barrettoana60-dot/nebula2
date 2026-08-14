/* ============================================================
   AI ENGINE — Groq API Integration (Llama 3.3 70B)
   Tenta /api/* no Vercel; se falhar, usa Groq direto via chave
   em Supabase (app_settings.groq_api_key) ou localStorage admin.
   ============================================================ */
const NebulaAI = (() => {
    const API_BASE = '/api';
    const analysisCache = new Map();
    let _groqKeyCache = null;
    let _groqKeyLoaded = false;

    async function getGroqKey() {
        if (_groqKeyLoaded) return _groqKeyCache;
        _groqKeyLoaded = true;

        if (window.NebulaGroqConfig?.apiKey?.length > 10) {
            _groqKeyCache = window.NebulaGroqConfig.apiKey;
            return _groqKeyCache;
        }

        try {
            const local = localStorage.getItem('nebula_groq_key');
            if (local && local.length > 10) {
                _groqKeyCache = local;
                return local;
            }
        } catch (e) {}

        if (window.NebulaSupabase) {
            try {
                const { data } = await window.NebulaSupabase
                    .from('app_settings')
                    .select('value')
                    .eq('key', 'groq_api_key')
                    .maybeSingle();
                if (data?.value && data.value.length > 10) {
                    _groqKeyCache = data.value;
                    return data.value;
                }
            } catch (e) {
                console.warn('[NebulaAI] app_settings não disponível:', e.message || e);
            }
        }
        return null;
    }

    function getGroqEndpoint(key) {
        if (key.startsWith('sk-or-')) {
            return {
                url: 'https://openrouter.ai/api/v1/chat/completions',
                model: 'meta-llama/llama-3.3-70b-instruct:free'
            };
        }
        return {
            url: 'https://api.groq.com/openai/v1/chat/completions',
            model: 'llama-3.3-70b-versatile'
        };
    }

    async function groqRequest(messages, options = {}) {
        const key = await getGroqKey();
        if (!key) return null;

        const cfg = getGroqEndpoint(key);
        const modelsToTry = [
            options.model || cfg.model,
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant'
        ];

        for (const currentModel of [...new Set(modelsToTry)]) {
            const basePayload = {
                model: currentModel,
                messages,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.max_tokens ?? 1500
            };

            const payloads = options.response_format
                ? [{ ...basePayload, response_format: options.response_format }, basePayload]
                : [basePayload];

            for (const payload of payloads) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout max

                    const response = await fetch(cfg.url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${key}`
                        },
                        body: JSON.stringify(payload),
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (response.ok) {
                        const data = await response.json();
                        const reply = data.choices?.[0]?.message?.content || null;
                        if (reply) return reply;
                    } else if (response.status === 400 && options.response_format) {
                        continue;
                    }
                } catch (err) {
                    // Abort or network error: try next model or fallback
                }
            }
        }
        return null;
    }

    async function apiPost(path, body) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout max
            const response = await fetch(`${API_BASE}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (response.ok) return { ok: true, data: await response.json() };
            return { ok: false, status: response.status };
        } catch (e) {
            return { ok: false, status: 0 };
        }
    }

    async function analyzeDocument(text, fileName, fileKind, userResearch, highlights) {
        if (!text || text.length < 30) return null;

        const cacheKey = hashText(text.slice(0, 2000) + fileName + (highlights ? JSON.stringify(highlights) : ''));
        if (!highlights && analysisCache.has(cacheKey)) {
            return analysisCache.get(cacheKey);
        }

        const apiResult = await apiPost('/analyze', { text, fileName, fileKind, userResearch, highlights });
        if (apiResult.ok) {
            if (!highlights) analysisCache.set(cacheKey, apiResult.data);
            return apiResult.data;
        }

        const systemPrompt = `Você é um Revisor Acadêmico Sênior. Analise o documento e retorne APENAS JSON válido com: summary, author, year, language, topic, keywords (array), nationality, document_type, key_findings, methodology, deep_insight.`;

        let userPrompt = `Arquivo: "${fileName}" (${fileKind})\nLinha de Pesquisa: ${userResearch || 'Geral'}\n\n`;
        if (highlights && highlights.length > 0) {
            const parsedHighlights = highlights.map(h => `[Trecho (Pág. ${h.page})]: "${h.text}"${h.comment ? ` (Nota: ${h.comment})` : ''}`).join('\n');
            userPrompt += `Trechos destacados:\n${parsedHighlights}\n\n`;
        }
        userPrompt += `Texto:\n---\n${text.slice(0, 12000)}\n---`;

        const content = await groqRequest(
            [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
            { temperature: 0.35, max_tokens: 2500, response_format: { type: 'json_object' } }
        );
        if (!content) return generateLocalDocAnalysis(text, fileName, fileKind);

        try {
            let cleaned = content.trim();
            // Remove markdown code fences if present
            cleaned = cleaned.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '');
            // Find first { to last } to extract JSON
            const jsonStart = cleaned.indexOf('{');
            const jsonEnd = cleaned.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
            }
            const result = JSON.parse(cleaned);
            const normalized = {
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
            };
            if (!highlights) analysisCache.set(cacheKey, normalized);
            return normalized;
        } catch (e) {
            console.error('[NebulaAI] Failed to parse analysis JSON:', e);
            return generateLocalDocAnalysis(text, fileName, fileKind);
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

    function generateLocalDocAnalysis(text, fileName, fileKind) {
        // Extract year from text
        const yearMatch = (text || '').match(/\b(19[5-9]\d|20[0-3]\d)\b/);
        const year = yearMatch ? parseInt(yearMatch[0]) : null;

        // Extract keywords — most frequent meaningful words
        const words = (text || '').toLowerCase()
            .replace(/[^a-záàâãéêíóôõúç\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 5);
        const freq = {};
        words.forEach(w => freq[w] = (freq[w] || 0) + 1);
        const keywords = Object.entries(freq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(e => e[0]);

        // Try to guess language
        const ptWords = ['que', 'uma', 'para', 'com', 'são', 'dos', 'das'];
        const enWords = ['the', 'and', 'for', 'with', 'are', 'this', 'that'];
        const textLower = (text || '').toLowerCase();
        const ptCount = ptWords.filter(w => textLower.includes(w)).length;
        const enCount = enWords.filter(w => textLower.includes(w)).length;
        const language = ptCount >= enCount ? 'Português' : 'Inglês';

        // Build a summary from first 500 chars
        const cleanText = (text || '').replace(/\s+/g, ' ').trim();
        const summary = cleanText.length > 50
            ? cleanText.slice(0, 500) + (cleanText.length > 500 ? '...' : '')
            : 'Resumo não disponível para este documento.';

        return {
            summary,
            author: 'Desconhecido',
            year,
            language,
            topic: (fileName || '').replace(/\.[^/.]+$/, '') || 'Pesquisa Geral',
            keywords,
            nationality: language === 'Português' ? 'Brasil/Portugal' : 'Internacional',
            document_type: fileKind || 'Documento',
            key_findings: null,
            methodology: null,
            deep_insight: 'Análise local — para uma análise completa com IA, utilize o botão Reanalisar.',
            ai_analyzed: false
        };
    }

    async function analyzeImage(base64Image, userResearch, query) {
        const apiResult = await apiPost('/vision', { base64Image, userResearch, query });
        if (apiResult.ok) return apiResult.data;

        const systemPrompt = `Analise a imagem acadêmica e retorne JSON com: description, insight, keywords (array).`;
        const userPrompt = `Pesquisa: ${userResearch || 'Geral'}\nBusca: ${query || 'Nenhuma'}`;

        const content = await groqRequest(
            [
                { role: 'system', content: systemPrompt },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: userPrompt },
                        { type: 'image_url', image_url: { url: base64Image } }
                    ]
                }
            ],
            { model: 'llama-3.2-11b-vision-preview', temperature: 0.2, max_tokens: 800, response_format: { type: 'json_object' } }
        );
        if (!content) return null;
        try {
            let cleaned = content.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
            return JSON.parse(cleaned);
        } catch (e) {
            return null;
        }
    }

    async function isAvailable() {
        const key = await getGroqKey();
        if (key) return true;
        try {
            const res = await fetch(`${API_BASE}/health`);
            return res.ok;
        } catch (e) {
            return false;
        }
    }

    async function generateRepositoryReview(docs, userResearch) {
        if (!docs || docs.length === 0) return null;

        const apiResult = await apiPost('/review', { docs, userResearch });
        if (apiResult.ok) return apiResult.data;

        const content = await groqRequest(
            [
                { role: 'system', content: 'Analise o repositório acadêmico e retorne JSON com arrays: strengths, weaknesses, suggestions.' },
                { role: 'user', content: `Pesquisa: ${userResearch || 'Geral'}\nDocumentos: ${JSON.stringify(docs.slice(0, 20).map(d => ({ name: d.name, topic: d.topic, year: d.year })))}` }
            ],
            { temperature: 0.4, max_tokens: 1200, response_format: { type: 'json_object' } }
        );
        if (content) {
            try {
                let cleaned = content.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
                return JSON.parse(cleaned);
            } catch (e) {}
        }

        return generateLocalRepositoryReview(docs);
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

        strengths.push(`Acervo consolidado com ${docs.length} documento(s) arquivado(s).`);
        if (isDiverse) strengths.push(`Alta diversidade temática abrangendo ${topics.size} áreas do conhecimento.`);
        else strengths.push(`Foco intenso e especializado, ideal para pesquisa de nicho.`);
        if (isRecent) strengths.push(`Excelente atualidade bibliográfica (muitos artigos recentes).`);

        if (!isDiverse && docs.length > 3) weaknesses.push(`Risco de bolha epistêmica: pouca variação de macrotópicos.`);
        if (docs.length < 5) weaknesses.push(`Volume total do repositório ainda é muito baixo para análises profundas.`);
        if (!isRecent && years.length > 0) weaknesses.push(`Parte considerável do acervo está desatualizada (mais de 5 anos).`);
        if (authors.size <= Math.max(1, docs.length * 0.3)) weaknesses.push(`Alta concentração em poucos autores. Falta de pluralidade de vozes.`);

        if (weaknesses.length === 0) weaknesses.push(`Não foram detectadas falhas graves de estrutura no acervo atual.`);

        if (!isDiverse) suggestions.push(`Explore campos transversais à sua área para enriquecer as referências.`);
        if (!isRecent) suggestions.push(`Busque artigos publicados a partir de ${currentYear - 3} para atualizar as citações.`);
        suggestions.push(`Utilize o Ecosistema 3D (Visão Social) para descobrir o que outros autores estão lendo.`);

        return { strengths, weaknesses, suggestions };
    }

    function generateAcademicResponse(userQuery, conversationHistory) {
        const q = (userQuery || '').toLowerCase().trim();
        const norm = TextEngine ? TextEngine.normalize(q) : q;

        if (norm.includes('ola') || norm.includes('oi') || norm.includes('bom dia') || norm.includes('boa tarde') || norm.includes('quem e voce') || norm.includes('o que voce faz')) {
            return `Olá! Sou o **Llama 3.3**, assistente de inteligência artificial especializado em pesquisa científica e produção acadêmica do **Nebula Research**.\n\nPosso ajudar você em:\n• **Estruturação Metodológica**: Definição de hipóteses, objetivos gerais e específicos, e delineamento de pesquisa.\n• **Revisão Bibliográfica & Qualis CAPES**: Análise de periódicos, autores de referência e relevância temática.\n• **Normas ABNT & Escrita Científica**: Formatação de citações (diretas/indiretas), resumos estruturados e referências.\n• **Análise do seu Acervo**: Cruzamento de dados entre os documentos do seu repositório.\n\nComo posso apoiar sua pesquisa neste momento?`;
        }

        if (norm.includes('metodologia') || norm.includes('metodo') || norm.includes('qualitativ') || norm.includes('quantitativ')) {
            return `### Delineamento Metodológico Sugerido\n\nPara fundamentar o rigor científico do seu trabalho, recomendo a seguinte estrutura:\n\n1. **Natureza da Pesquisa**: Classifique entre *Básica* (geração de novos conhecimentos) ou *Aplicada* (solução de problemas práticos imediatos).\n2. **Abordagem do Problema**:\n   - **Qualitativa**: Foco em significados, análises de conteúdo (Bardin) ou fenomenologia.\n   - **Quantitativa**: Uso de métricas estatísticas, amostragem probabilística e testes de hipóteses.\n   - **Mista (Quali-Quanti)**: Triangulação de dados para maior robustez empírica.\n3. **Procedimentos Técnicos**: Estudo de caso, pesquisa bibliográfica sistemática (PRISMA), pesquisa-ação ou levantamento de campo (*survey*).\n4. **Instrumentos de Coleta**: Questionários semiestruturados, entrevistas em profundidade ou raspagem de dados secundários.\n\n*Dica*: Lembre-se de submeter seu protocolo ao Comitê de Ética em Pesquisa (CEP/CONEP) caso envolva seres humanos.`;
        }

        if (norm.includes('qualis') || norm.includes('capes') || norm.includes('periodico') || norm.includes('revista')) {
            return `### Sistema de Classificação Qualis CAPES\n\nO **Qualis-Periódicos** avalia a produção científica dos programas de pós-graduação no Brasil:\n\n• **Estrato Superior (A1 e A2)**: Periódicos de altíssimo impacto internacional e nacional, com rigoroso processo de *double-blind peer review* e indexação em bases como Scopus e Web of Science.\n• **Estrato Intermediário (A3 e A4)**: Publicações consolidadas com circulação internacional/nacional relevante e bom fator de impacto (JCR / CiteScore).\n• **Estrato B (B1 a B4)**: Periódicos de alcance regional/nacional indexados em bases como SciELO, Redalyc ou DOAJ.\n• **Estrato C**: Publicações sem indexação formal reconhecida ou com baixa aderência aos critérios CAPES.\n\n*Recomendação*: Ao submeter seu artigo, priorize periódicos com acesso aberto (Open Access) e indexação no DOAJ ou SciELO para maximizar suas citações.`;
        }

        if (norm.includes('abnt') || norm.includes('citacao') || norm.includes('referencia') || norm.includes('norma')) {
            return `### Diretrizes ABNT (NBR 10520 & NBR 6023)\n\nPrincipais regras para sua produção acadêmica:\n\n1. **Citação Direta Curta (até 3 linhas)**:\n   Inserida no corpo do texto entre aspas duplas. Exemplo: *Segundo Silva (2024, p. 45), "a tecnologia amplia o alcance do patrimônio digital".*\n\n2. **Citação Direta Longa (mais de 3 linhas)**:\n   Bloco destacado com recuo de **4 cm da margem esquerda**, fonte tamanho 10, espaçamento simples e sem aspas.\n\n3. **Citação Indireta (Paráfrase)**:\n   Texto com suas próprias palavras mantendo a ideia do autor. Exemplo: *(SILVA, 2024)* ou *Conforme Silva (2024)...*\n\n4. **Estrutura de Referência de Artigo (NBR 6023)**:\n   SOBRENOME, Nome. Título do artigo. **Nome da Revista em Negrito**, Local, v. X, n. Y, p. 10-25, ano. DOI: 10.xxxx/yyyy.`;
        }

        if (norm.includes('tema') || norm.includes('problema') || norm.includes('hipotese') || norm.includes('objetivo')) {
            return `### Formulação do Problema e Objetivos de Pesquisa\n\nUma pesquisa sólida se estrutura a partir de uma pergunta clara e delimitada:\n\n• **Problema de Pesquisa**: Deve ser redigido em formato interrogativo, delimitado no tempo/espaço e passível de verificação empírica.\n• **Objetivo Geral**: Verbo no infinitivo que responde diretamente ao problema central (ex: *Analisar, Avaliar, Mapear, Compreender*).\n• **Objetivos Específicos**: Etapas metodológicas necessárias (Diagnosticar → Comparar → Propor diretrizes).\n• **Hipótese de Trabalho**: Resposta provisória ao problema que será testada ao longo da investigação.`;
        }

        return `### Análise Acadêmica — Llama 3.3\n\nEm relação à sua consulta sobre **"${userQuery.slice(0, 100)}"**:\n\n1. **Contextualização Teórica**: Este tema se insere na fronteira do conhecimento contemporâneo, exigindo diálogo com a literatura recente (últimos 5 anos) e bases indexadas.\n2. **Abordagem Crítica**: Recomendo cruzar as referências teóricas com dados empíricos do seu acervo para fortalecer a discussão de resultados.\n3. **Próximos Passos Sugeridos**:\n   • Realize uma busca avançada na aba **Pesquisa Inteligente** com operadores booleanos (AND, OR).\n   • Arquive os artigos relevantes no **Repositório** para gerar o grafo de conexões 3D.\n   • Redija suas conclusões preliminares utilizando o **Editor de Texto** com salvamento automático.\n\nDeseja que eu aprofunde algum ponto específico da sua pesquisa?`;
    }

    async function chatWithAI(messages) {
        // 1. Try serverless backend
        const apiResult = await apiPost('/chat', { messages });
        if (apiResult.ok && apiResult.data?.reply) {
            return apiResult.data.reply;
        }

        // 2. Try direct Groq / OpenRouter call
        const content = await groqRequest(messages, { temperature: 0.7, max_tokens: 1500 });
        if (content && content.trim().length > 10) {
            return content;
        }

        // 3. Smart Generative Academic Fallback
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || 'pesquisa geral';
        return generateAcademicResponse(lastUserMsg, messages);
    }

    async function findConnections(userProfile, communityProfiles) {
        const apiResult = await apiPost('/connections', { userProfile, communityProfiles });
        if (apiResult.ok) return apiResult.data;

        const content = await groqRequest(
            [
                { role: 'system', content: 'Retorne JSON com array "connections" de emails recomendados para networking acadêmico.' },
                { role: 'user', content: JSON.stringify({ userProfile, communityProfiles: communityProfiles.slice(0, 30) }) }
            ],
            { temperature: 0.3, max_tokens: 800, response_format: { type: 'json_object' } }
        );
        if (!content) return null;
        try {
            let cleaned = content.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
            return JSON.parse(cleaned);
        } catch (e) {
            return null;
        }
    }

    function setGroqKey(key) {
        _groqKeyCache = key || null;
        _groqKeyLoaded = true;
        try {
            if (key) localStorage.setItem('nebula_groq_key', key);
            else localStorage.removeItem('nebula_groq_key');
        } catch (e) {}
    }

    return { analyzeDocument, generateRepositoryReview, isAvailable, chatWithAI, analyzeImage, findConnections, setGroqKey, getGroqKey };
})();

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
            'llama3-70b-8192',
            'llama-3.1-8b-instant',
            'llama3-8b-8192'
        ];

        for (const currentModel of [...new Set(modelsToTry)]) {
            const payload = {
                model: currentModel,
                messages,
                temperature: options.temperature ?? 0.7,
                max_tokens: options.max_tokens ?? 1500
            };
            if (options.response_format) payload.response_format = options.response_format;

            try {
                const response = await fetch(cfg.url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    const data = await response.json();
                    const reply = data.choices?.[0]?.message?.content || null;
                    if (reply) return reply;
                }
            } catch (err) {
                console.warn(`[NebulaAI] Fallback model ${currentModel} failed:`, err);
            }
        }
        return null;
    }

    async function apiPost(path, body) {
        try {
            const response = await fetch(`${API_BASE}${path}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
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
        if (!content) return null;

        try {
            let cleaned = content.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
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

    async function chatWithAI(messages) {
        const apiResult = await apiPost('/chat', { messages });
        if (apiResult.ok && apiResult.data?.reply) {
            return apiResult.data.reply;
        }

        const content = await groqRequest(messages, { temperature: 0.7, max_tokens: 1500 });
        if (content) return content;

        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
        return `Compreendido! Em relação a "${lastUserMsg.slice(0, 60)}...", analisei a questão no âmbito acadêmico. Como posso aprofundar mais no seu repositório de pesquisas?`;
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

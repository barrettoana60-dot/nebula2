/* ============================================================
   AI ENGINE — Groq API Integration (Llama 3.3 70B)
   Análise real de documentos com IA de código aberto
   ============================================================ */
const NebulaAI = (() => {
    const API_BASE = '/api';
    const analysisCache = new Map();

    function getCustomKey() {
        return localStorage.getItem('LLAMA_API_KEY') || '';
    }

    async function analyzeDocument(text, fileName, fileKind, userResearch, highlights) {
        if (!text || text.length < 30) return null;

        const cacheKey = hashText(text.slice(0, 2000) + fileName + (highlights ? JSON.stringify(highlights) : ''));
        if (!highlights && analysisCache.has(cacheKey)) {
            return analysisCache.get(cacheKey);
        }

        try {
            const response = await fetch(`${API_BASE}/analyze`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-custom-key': getCustomKey() 
                },
                body: JSON.stringify({ text, fileName, fileKind, userResearch, highlights })
            });

            if (!response.ok) {
                console.warn('[NebulaAI] API error:', response.status);
                return null;
            }

            const normalized = await response.json();
            if (!highlights) {
                analysisCache.set(cacheKey, normalized);
            }
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

    async function analyzeImage(base64Image, userResearch, query) {
        try {
            const response = await fetch(`${API_BASE}/vision`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-custom-key': getCustomKey() 
                },
                body: JSON.stringify({ base64Image, userResearch, query })
            });
            if (!response.ok) {
                
                return null;
            }
            return await response.json();
        } catch (err) {
            console.error('[NebulaAI] Vision failed:', err);
            return null;
        }
    }

    async function isAvailable() {
        return true;
    }

    async function generateRepositoryReview(docs, userResearch) {
        if (!docs || docs.length === 0) return null;
        
        try {
            const response = await fetch(`${API_BASE}/review`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-custom-key': getCustomKey() 
                },
                body: JSON.stringify({ docs, userResearch })
            });

            if (!response.ok) {
                const errData = await response.json().catch(()=>({}));
                throw new Error(errData.error || 'API error');
            }

            return await response.json();
        } catch (err) {
            console.warn('[NebulaAI] Repo Review failed via API, falling back to local heuristic:', err);
            const fallback = generateLocalRepositoryReview(docs);
            // Hide the error so we just gracefully fall back to local heuristics if Llama fails
            return fallback;
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
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const response = await fetch(`${API_BASE}/chat`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-custom-key': getCustomKey()
                    },
                    body: JSON.stringify({ messages })
                });

                if (!response.ok) {
                    if (attempt === 0) {
                        await new Promise(r => setTimeout(r, 600));
                        continue;
                    }
                    const errData = await response.json().catch(() => ({}));
                    return `Ocorreu um erro ao comunicar com a IA Llama. Detalhe: ${errData.error || response.statusText}.`;
                }

                const data = await response.json();
                return data.reply || 'Sem resposta.';
            } catch (e) {
                if (attempt === 0) {
                    await new Promise(r => setTimeout(r, 600));
                    continue;
                }
                console.error('[NebulaAI] Chat failed:', e);
                return 'Erro de conexão com o servidor de IA. Tente novamente em alguns segundos.';
            }
        }
    }

    async function findConnections(userProfile, communityProfiles) {
        try {
            const response = await fetch(`${API_BASE}/connections`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-custom-key': getCustomKey() 
                },
                body: JSON.stringify({ userProfile, communityProfiles })
            });
            if (!response.ok) {
                
                return null;
            }
            return await response.json();
        } catch (err) {
            console.error('[NebulaAI] Connections failed:', err);
            return null;
        }
    }

    return { analyzeDocument, generateRepositoryReview, isAvailable, chatWithAI, analyzeImage, findConnections };
})();

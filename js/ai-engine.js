/* ============================================================
   AI ENGINE — Serverless API Integration
   Chama /api/analyze que roda server-side com Groq (Llama 3.3)
   ============================================================ */
const NebulaAI = (() => {
    const API_URL = '/api/analyze';
    
    // Cache para evitar chamadas repetidas
    const analysisCache = new Map();

    /**
     * Analisa documento via API serverless (Llama 3.3 70B)
     */
    async function analyzeDocument(text, fileName, fileKind) {
        if (!text || text.length < 30) return null;

        // Cache check
        const cacheKey = hashText(text.slice(0, 2000) + fileName);
        if (analysisCache.has(cacheKey)) {
            return analysisCache.get(cacheKey);
        }

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: text.slice(0, 6000),
                    fileName,
                    fileKind
                })
            });

            if (!response.ok) {
                console.warn('[NebulaAI] API error:', response.status);
                return null;
            }

            const result = await response.json();
            
            if (result.error) {
                console.warn('[NebulaAI] API returned error:', result.error);
                return null;
            }

            // Validar e normalizar
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
            console.error('[NebulaAI] Request failed:', err);
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
        try {
            const r = await fetch(API_URL, { method: 'OPTIONS' });
            return r.ok;
        } catch { return false; }
    }

    return { analyzeDocument, isAvailable };
})();

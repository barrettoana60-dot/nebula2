/* ============================================================
   DOCUMENT ENGINE — PDF/DOCX/CSV parsing + AI-powered analysis
   ============================================================ */
const DocumentEngine = (() => {
    const MAX_TEXT = 80000;

    async function extractTextFromPDF(arrayBuffer) {
        try {
            if (typeof pdfjsLib === 'undefined') return '';
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const parts = [];
            const maxPages = Math.min(pdf.numPages, 40);
            for (let i = 1; i <= maxPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const text = content.items.map(item => item.str).join(' ');
                if (text.trim()) parts.push(text);
            }
            return parts.join('\n').slice(0, MAX_TEXT);
        } catch (e) {
            console.warn('PDF extraction failed:', e);
            return '';
        }
    }

    async function extractTextFromDOCX(arrayBuffer) {
        try {
            if (typeof JSZip === 'undefined') return '';
            const zip = await JSZip.loadAsync(arrayBuffer);
            const docXml = await zip.file('word/document.xml')?.async('text');
            if (!docXml) return '';
            let text = docXml.replace(/<w:t[^>]*>/g, '\n').replace(/<[^>]+>/g, '');
            return text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
        } catch (e) {
            console.warn('DOCX extraction failed:', e);
            return '';
        }
    }

    function extractTextFromCSV(text) {
        try {
            const lines = text.split('\n').filter(l => l.trim());
            if (!lines.length) return '';
            const headers = lines[0];
            const desc = [`Planilha com ${lines.length - 1} linhas.`, `Colunas: ${headers}`];
            desc.push('\nAmostra dos dados:');
            lines.slice(0, 21).forEach(l => desc.push(l));
            return desc.join('\n').slice(0, MAX_TEXT);
        } catch { return ''; }
    }

    function readTextBySuffix(fileName, content) {
        const suffix = fileName.split('.').pop()?.toLowerCase() || '';
        if (suffix === 'pdf') return null; // async
        if (suffix === 'docx') return null; // async
        if (['txt', 'md', 'py', 'json'].includes(suffix)) {
            return (typeof content === 'string' ? content : new TextDecoder().decode(content)).slice(0, MAX_TEXT);
        }
        if (suffix === 'csv') {
            const text = typeof content === 'string' ? content : new TextDecoder().decode(content);
            return extractTextFromCSV(text);
        }
        return '';
    }

    function fileKind(fileName) {
        const suffix = fileName.split('.').pop()?.toLowerCase() || '';
        const map = {
            pdf:'PDF', docx:'Word', txt:'Texto', md:'Markdown',
            csv:'CSV', xlsx:'Planilha', xls:'Planilha',
            png:'Imagem', jpg:'Imagem', jpeg:'Imagem', webp:'Imagem',
            py:'Código', json:'JSON'
        };
        return map[suffix] || 'Arquivo';
    }

    function analyzeDocumentStructure(text) {
        const sections = {};
        const patterns = {
            'Resumo/Abstract': /(?:resumo|abstract)\s*[:\n](.{100,2000}?)(?=\n[A-Z]|\nintrodução|\nintroduction|keywords|palavras)/is,
            'Introdução': /(?:introdução|introduction)\s*[:\n](.{100,2000}?)(?=\n[A-Z]|\nmétodo|\nmaterial)/is,
            'Metodologia': /(?:método|metodologia|methodology|methods)\s*[:\n](.{100,2000}?)(?=\n[A-Z]|\nresultado)/is,
            'Resultados': /(?:resultados|results)\s*[:\n](.{100,2000}?)(?=\n[A-Z]|\ndiscussão|\nconclusão)/is,
            'Conclusão': /(?:conclusão|conclusion)\s*[:\n](.{100,3000}?)(?=\n[A-Z]|\nreferência|$)/is,
        };
        for (const [name, pat] of Object.entries(patterns)) {
            const m = text.match(pat);
            if (m) sections[name] = m[1].trim().slice(0, 500);
        }
        return sections;
    }

    function analyzeImage(file) {
        return new Promise(resolve => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width; canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                try {
                    const data = ctx.getImageData(0, 0, img.width, img.height).data;
                    let rSum = 0, gSum = 0, bSum = 0, brSum = 0;
                    const px = img.width * img.height;
                    for (let i = 0; i < data.length; i += 4) {
                        rSum += data[i]; gSum += data[i+1]; bSum += data[i+2];
                        brSum += data[i]*0.299 + data[i+1]*0.587 + data[i+2]*0.114;
                    }
                    resolve({
                        width: img.width, height: img.height,
                        brightness: Math.round(brSum / px * 100) / 100,
                        r: Math.round(rSum / px * 10) / 10,
                        g: Math.round(gSum / px * 10) / 10,
                        b: Math.round(bSum / px * 10) / 10,
                    });
                } catch {
                    resolve({ width: img.width, height: img.height });
                }
                URL.revokeObjectURL(url);
            };
            img.onerror = () => { URL.revokeObjectURL(url); resolve({}); };
            img.src = url;
        });
    }

    /**
     * Gera UUID v4 compatível com Supabase
     */
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    async function makeDocumentRecord(file, progressCallback, userResearch) {
        const fileName = file.name;
        const kind = fileKind(fileName);
        const suffix = fileName.split('.').pop()?.toLowerCase() || '';
        const bytes = await file.arrayBuffer();
        const sizeKB = Math.round(file.size / 1024 * 10) / 10;

        // 1. Extrair texto do arquivo
        if (progressCallback) progressCallback('Extraindo texto...');
        let text = '';
        if (suffix === 'pdf') {
            text = await extractTextFromPDF(bytes);
        } else if (suffix === 'docx') {
            text = await extractTextFromDOCX(bytes);
        } else {
            text = readTextBySuffix(fileName, bytes) || '';
        }

        const isImage = kind === 'Imagem';
        let imageMeta = {};
        if (isImage) {
            imageMeta = await analyzeImage(file);
        }

        // 2. Tentar análise via IA (Groq/Llama 3.3)
        let aiData = null;
        if (text && text.length >= 30 && typeof NebulaAI !== 'undefined') {
            if (progressCallback) progressCallback('Analisando com IA...');
            try {
                aiData = await NebulaAI.analyzeDocument(text, fileName, kind, userResearch);
                if (aiData) {
                    console.log('[DocumentEngine] AI analysis successful for:', fileName);
                }
            } catch (aiErr) {
                console.warn('[DocumentEngine] AI analysis failed, using local fallback:', aiErr);
            }
        }

        // 3. Usar dados da IA se disponíveis, senão fallback para TextEngine local
        let keywords, topic, summary, author, language, nationality, year;
        let docType = kind;
        let keyFindings = null;
        let methodology = null;
        let refCount = 0;

        if (aiData) {
            // IA analisou com sucesso — usar dados reais
            keywords = aiData.keywords.length > 0 ? aiData.keywords : TextEngine.extractKeywordsTFIDF(text || fileName, 25);
            topic = aiData.topic || TextEngine.detectTopic(text || fileName);
            summary = aiData.summary || TextEngine.generateContextualSummary(text, topic, kind);
            author = aiData.author || 'Desconhecido';
            language = aiData.language || TextEngine.detectLanguage(text);
            nationality = aiData.nationality || TextEngine.inferNationality(text || fileName);
            year = aiData.year || (TextEngine.detectYears(text)[0] || new Date().getFullYear());
            docType = aiData.document_type || kind;
            keyFindings = aiData.key_findings;
            methodology = aiData.methodology;
            refCount = aiData.references_detected || 0;
        } else {
            // Fallback: análise local com TextEngine
            if (progressCallback) progressCallback('Analisando localmente...');
            keywords = TextEngine.extractKeywordsTFIDF(text || fileName, 25);
            topic = TextEngine.detectTopic(text || fileName);
            summary = TextEngine.generateContextualSummary(text, topic, kind) || `Arquivo do tipo ${kind}.`;
            author = text ? TextEngine.extractAuthor(text) : 'Desconhecido';
            language = text ? TextEngine.detectLanguage(text) : 'Desconhecido';
            nationality = TextEngine.inferNationality(text || fileName);
            year = TextEngine.detectYears(text)[0] || new Date().getFullYear();
            const refsData = TextEngine.extractReferences(text);
            refCount = refsData.count;
        }

        const years = TextEngine.detectYears(text);
        const sections = (text && kind === 'PDF') ? analyzeDocumentStructure(text) : {};
        const readability = text ? TextEngine.computeReadability(text) : {};
        const refsData = TextEngine.extractReferences(text);

        // UUID compatível com Supabase
        const id = generateUUID();

        return {
            id, name: fileName, kind, topic, summary, keywords,
            author, years, year: year,
            nationality, language,
            uploaded_at: new Date().toISOString().slice(0, 16).replace('T', ' '),
            text: text.slice(0, 12000),
            full_text_len: text.length,
            image_meta: imageMeta, size_kb: sizeKB,
            sections, readability,
            ref_count: refCount || refsData.count,
            ref_samples: refsData.samples,
            visibility: 'private',
            public_until: null,
            document_type: docType,
            key_findings: keyFindings,
            methodology: methodology,
            deep_insight: aiData ? aiData.deep_insight : null,
            ai_analyzed: !!aiData,
        };
    }

    function relatedDocuments(target, docs, limit = 8) {
        const targetText = [target.summary, (target.keywords || []).join(' '), (target.text || '').slice(0, 2000)].join(' ');
        const out = [];
        for (const doc of docs) {
            if (doc.id === target.id) continue;
            const docText = [doc.summary, (doc.keywords || []).join(' '), (doc.text || '').slice(0, 2000)].join(' ');
            let sim = TextEngine.cosineSimilarity(targetText, docText);
            if (doc.topic === target.topic) sim += 0.10;
            if (sim > 0.05) out.push({ ...doc, similarity: Math.round(sim * 1000) / 10 });
        }
        return out.sort((a, b) => b.similarity - a.similarity).slice(0, limit);
    }

    function localSearch(query, docs) {
        const results = [];
        for (const doc of docs) {
            const text = [doc.name, doc.summary, doc.topic, (doc.keywords || []).join(' '), (doc.text || '').slice(0, 3000)].join(' ');
            const score = TextEngine.scoreRelevance(query, text, doc.keywords || []);
            if (score > 0) results.push({ ...doc, score });
        }
        return results.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    }

    return {
        extractTextFromPDF, extractTextFromDOCX,
        fileKind, makeDocumentRecord, generateUUID,
        relatedDocuments, localSearch,
        analyzeImage,
    };
})();

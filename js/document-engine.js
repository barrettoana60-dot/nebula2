/* ============================================================
   DOCUMENT ENGINE — PDF/DOCX/CSV parsing + AI-powered analysis
   ============================================================ */
const DocumentEngine = (() => {
    const MAX_TEXT = 80000;

    async function extractTextFromPDF(arrayBuffer) {
        try {
            if (typeof pdfjsLib === 'undefined') return { text: '', pages: [] };
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
            const pages = [];
            const maxPages = Math.min(pdf.numPages, 1000);
            
            for (let i = 1; i <= maxPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                
                const items = content.items.map(item => ({
                    str: item.str,
                    x: item.transform[4],
                    y: item.transform[5],
                    w: item.width || 0
                })).filter(it => it.str.trim());

                if (items.length === 0) {
                    pages.push({ number: i, text: '' });
                    continue;
                }

                // Analyze layout columns: single vs double column
                // Find min and max x of printable text
                let minX = 9999, maxX = -9999;
                items.forEach(it => {
                    if (it.x < minX) minX = it.x;
                    if (it.x + it.w > maxX) maxX = it.x + it.w;
                });
                const width = maxX - minX;
                const mid = minX + width / 2;

                // Check how many items are strictly on left side, strictly on right side, vs crossing
                let leftCount = 0, rightCount = 0, crossingCount = 0;
                items.forEach(it => {
                    const left = it.x;
                    const right = it.x + it.w;
                    if (right < mid - 12) leftCount++;
                    else if (left > mid + 12) rightCount++;
                    else crossingCount++;
                });

                // Classify double column layout
                const isDoubleColumn = leftCount > 8 && rightCount > 8 && crossingCount < (leftCount + rightCount) * 0.15;

                // Helper to group list of items into lines by y-coordinate
                const groupItemsIntoLines = (itemsList) => {
                    const linesList = [];
                    let currLine = [];
                    let currY = null;
                    // Sort items by y desc (top to bottom) then x asc
                    itemsList.sort((a, b) => b.y - a.y || a.x - b.x);
                    itemsList.forEach(item => {
                        if (currY === null) {
                            currY = item.y;
                            currLine.push(item);
                        } else if (Math.abs(item.y - currY) > 6) {
                            currLine.sort((a, b) => a.x - b.x);
                            linesList.push(currLine.map(it => it.str).join(' '));
                            currLine = [item];
                            currY = item.y;
                        } else {
                            currLine.push(item);
                        }
                    });
                    if (currLine.length) {
                        currLine.sort((a, b) => a.x - b.x);
                        linesList.push(currLine.map(it => it.str).join(' '));
                    }
                    return linesList;
                };

                let pageText = '';

                if (isDoubleColumn) {
                    // Group all items into horizontal y-bands
                    const bands = [];
                    let currentBand = [];
                    let currentY = null;
                    items.sort((a, b) => b.y - a.y);
                    items.forEach(item => {
                        if (currentY === null) {
                            currentY = item.y;
                            currentBand.push(item);
                        } else if (Math.abs(item.y - currentY) > 7) {
                            bands.push({ y: currentY, items: currentBand });
                            currentBand = [item];
                            currentY = item.y;
                        } else {
                            currentBand.push(item);
                        }
                    });
                    if (currentBand.length) {
                        bands.push({ y: currentY, items: currentBand });
                    }

                    // Process bands
                    let outputTextLines = [];
                    let leftBlock = [];
                    let rightBlock = [];

                    const flushBlocks = () => {
                        if (leftBlock.length) {
                            outputTextLines.push(...groupItemsIntoLines(leftBlock));
                            leftBlock = [];
                        }
                        if (rightBlock.length) {
                            outputTextLines.push(...groupItemsIntoLines(rightBlock));
                            rightBlock = [];
                        }
                    };

                    bands.forEach(band => {
                        // Check if any item in this band is a spanning item
                        let hasSpanning = false;
                        band.items.forEach(it => {
                            if (it.x < mid - 20 && it.x + it.w > mid + 20) {
                                hasSpanning = true;
                            }
                        });

                        if (!hasSpanning) {
                            band.items.forEach(it => {
                                const center = it.x + it.w / 2;
                                if (center < mid) leftBlock.push(it);
                                else rightBlock.push(it);
                            });
                        } else {
                            flushBlocks();
                            band.items.sort((a, b) => a.x - b.x);
                            outputTextLines.push(band.items.map(it => it.str).join(' '));
                        }
                    });
                    flushBlocks();
                    pageText = outputTextLines.join('\n');
                } else {
                    // Single column layout
                    const lines = [];
                    let currentLine = [];
                    let currentY = null;
                    items.sort((a, b) => b.y - a.y);
                    
                    for (const item of items) {
                        if (currentY === null) {
                            currentY = item.y;
                            currentLine.push(item);
                        } else if (Math.abs(item.y - currentY) > 6) {
                            currentLine.sort((a, b) => a.x - b.x);
                            lines.push(currentLine.map(it => it.str).join(' '));
                            currentLine = [item];
                            currentY = item.y;
                        } else {
                            currentLine.push(item);
                        }
                    }
                    if (currentLine.length) {
                        currentLine.sort((a, b) => a.x - b.x);
                        lines.push(currentLine.map(it => it.str).join(' '));
                    }
                    pageText = lines.join('\n');
                }

                pages.push({ number: i, text: pageText.trim() });
            }

            const fullText = pages.map(p => p.text).filter(Boolean).join('\n\n').slice(0, MAX_TEXT);
            return { text: fullText, pages };
        } catch (e) {
            console.warn('PDF extraction failed:', e);
            return { text: '', pages: [] };
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

    function detectAcademicDocType(text, fileName, kind) {
        const t = (text || '').toLowerCase();
        const f = (fileName || '').toLowerCase();
        
        if (t.includes('tese de doutorado') || t.includes('tese apresentada') || t.includes('grau de doutor')) return 'Tese de Doutorado';
        if (t.includes('dissertação de mestrado') || t.includes('dissertacao de mestrado') || t.includes('grau de mestre')) return 'Dissertação de Mestrado';
        if (t.includes('trabalho de conclusão de curso') || t.includes('tcc') || t.includes('monografia')) return 'Monografia / TCC';
        if (t.includes('anais do') || t.includes('congresso') || t.includes('simpósio') || t.includes('simposio') || t.includes('encontro nacional')) return 'Trabalho em Congresso';
        if (t.includes('relatório técnico') || t.includes('relatorio tecnico') || t.includes('relatório de pesquisa')) return 'Relatório Técnico';
        if (t.includes('projeto de pesquisa') || t.includes('plano de trabalho')) return 'Projeto de Pesquisa';
        if (t.includes('livro') || t.includes('capítulo de livro') || t.includes('capitulo de livro') || t.includes('isbn')) return 'Livro / Capítulo';
        if (kind === 'Imagem') return 'Figura / Imagem Científica';
        if (kind === 'Planilha' || kind === 'CSV') return 'Dataset / Planilha de Dados';
        if (kind === 'Código') return 'Script / Código Computacional';
        return 'Artigo Periódico';
    }

    async function makeDocumentRecord(file, progressCallback, userResearch) {
        const fileName = file.name;
        const kind = fileKind(fileName);
        const suffix = fileName.split('.').pop()?.toLowerCase() || '';
        const bytes = await file.arrayBuffer();
        const sizeKB = Math.round(file.size / 1024 * 10) / 10;

        // 1. Extrair texto do arquivo e estruturar páginas
        if (progressCallback) progressCallback('Extraindo texto e páginas...');
        let text = '';
        let pages = [];
        if (suffix === 'pdf') {
            try {
                const res = await extractTextFromPDF(bytes);
                text = res.text;
                pages = res.pages;
            } catch (pdfErr) {
                console.warn('PDF page extraction failed inside makeDocumentRecord:', pdfErr);
            }
        } else if (suffix === 'docx') {
            text = await extractTextFromDOCX(bytes);
        } else {
            text = readTextBySuffix(fileName, bytes) || '';
        }

        // Se não for PDF ou se a extração falhou, simula páginas para o E-Reader
        if (!pages.length && text) {
            const pageSize = 4000;
            let offset = 0;
            let pageNum = 1;
            while (offset < text.length) {
                let end = Math.min(offset + pageSize, text.length);
                if (end < text.length) {
                    const nextSpace = text.indexOf(' ', end);
                    if (nextSpace !== -1 && nextSpace - end < 120) end = nextSpace;
                }
                pages.push({
                    number: pageNum++,
                    text: text.slice(offset, end)
                });
                offset = end;
            }
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
        const autoAcademicType = detectAcademicDocType(text, fileName, kind);
        let docType = aiData ? aiData.document_type || autoAcademicType : autoAcademicType;
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
            text: text.slice(0, 80000),
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
            pages,
            highlights: []
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

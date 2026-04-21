/* ============================================================
   TEXT ENGINE — TF-IDF, tokenizer, stopwords, similarity
   ============================================================ */
const TextEngine = (() => {
    const STOPWORDS = new Set([
        "de","a","o","que","e","do","da","em","um","para","é","com","uma","os","no","se","na","por",
        "mais","as","dos","como","mas","foi","ao","ele","das","tem","à","seu","sua","ou","ser","muito",
        "também","já","entre","sobre","após","antes","durante","cada","esse","essa","isso","estes","essas",
        "this","be","or","by","from","an","at","we","our","their","into","using","use","used",
        "the","of","and","to","in","is","it","that","for","on","as","with","are","between","after","before","during",
        "were","was","has","have","had","been","will","would","could","should","may","might","shall",
        "não","ser","ter","fazer","poder","dever","estar","ir","ver","dar","vir","querer","saber",
        "quando","onde","como","porque","quem","qual","quanto","todo","todos","toda","todas","mesmo","mesma",
        "seu","sua","seus","suas","meu","minha","nosso","nossa","ele","ela","eles","elas","eu","você","nos",
    ]);

    const TOPIC_RULES = {
        "Artes Visuais & História da Arte": ["arte", "artes", "pintura", "fauvismo", "matisse", "vanguarda", "estética", "escultura", "quadro", "galeria", "expressionismo", "cubismo", "impressionismo", "tela", "artista", "obras"],
        "Filosofia & Sociologia": ["filosofia", "sociologia", "sociedade", "pensamento", "existencialismo", "kant", "nietzsche", "marx", "foucault", "ética", "moral"],
        "Literatura & Linguística": ["literatura", "linguística", "poesia", "romance", "sintaxe", "semântica", "autor", "narrativa", "discurso", "texto", "leitura", "gramática"],
        "Inteligência Artificial": ["ia","ai","machine learning","deep learning","rede neural","llm","modelo","algoritmo","transformer","gpt","bert","nlp","visão computacional"],
        "Museologia": ["museu","museologia","acervo","coleção","documentação","patrimônio","preservação","museal","curadoria","exposição"],
        "Computação": ["python","software","sistema","banco de dados","api","código","computação","programação","arquitetura","cloud"],
        "Ciência de Dados": ["dados","estatística","análise","modelo preditivo","cluster","classificação","regressão","visualização","dashboard"],
        "Biomedicina": ["célula","gene","proteína","crispr","biologia","biomédica","terapia","amostra","genoma","ensaio clínico"],
        "Neurociência": ["neurônio","cérebro","memória","sono","sináptica","cognitivo","neuro","fmri","dopamina"],
        "Astrofísica": ["galáxia","cosmologia","matéria escura","lensing","astro","telescópio","gravitacional","buraco negro","exoplaneta"],
        "Psicologia": ["comportamento","psicologia","viés","atenção","emoção","cognição","ansiedade","depressão","terapia cognitiva"],
        "Educação": ["aprendizagem","ensino","estudante","escola","didática","educação","currículo","pedagogia"],
        "Engenharia": ["engenharia","estrutura","material","resistência","circuito","eletrônica","mecânica","termodinâmica"],
        "Direito": ["direito","lei","jurídico","tribunal","contrato","norma","legislação","constitucional"],
        "Economia": ["economia","mercado","inflação","pib","investimento","financeiro","fiscal","monetária"],
    };

    const NATIONALITY_COORDS = {
        "Brasil":{lat:-14.2,lon:-51.9},"Portugal":{lat:39.4,lon:-8.2},"Estados Unidos":{lat:37.1,lon:-95.7},
        "México":{lat:23.6,lon:-102.6},"Argentina":{lat:-38.4,lon:-63.6},"Reino Unido":{lat:55.4,lon:-3.4},
        "França":{lat:46.2,lon:2.2},"Alemanha":{lat:51.2,lon:10.4},"Itália":{lat:41.9,lon:12.6},
        "Espanha":{lat:40.5,lon:-3.7},"Índia":{lat:20.6,lon:79.0},"China":{lat:35.9,lon:104.2},
        "Japão":{lat:36.2,lon:138.3},"Canadá":{lat:56.1,lon:-106.3},"Austrália":{lat:-25.3,lon:133.8},
        "Holanda":{lat:52.3,lon:4.9},"Suécia":{lat:60.1,lon:18.6},"Suíça":{lat:46.8,lon:8.2},
        "Coreia do Sul":{lat:35.9,lon:127.8},"Singapura":{lat:1.3,lon:103.8},
        "Colômbia":{lat:4.6,lon:-74.1},"Chile":{lat:-35.7,lon:-71.5},"Peru":{lat:-9.2,lon:-75.0},
        "Rússia":{lat:61.5,lon:105.3},"Noruega":{lat:60.5,lon:8.5},"Dinamarca":{lat:56.3,lon:9.5},
        "Finlândia":{lat:61.9,lon:25.7},"Áustria":{lat:47.5,lon:14.6},"Bélgica":{lat:50.5,lon:4.5},
        "Irlanda":{lat:53.1,lon:-7.7},"Israel":{lat:31.0,lon:34.9},"Turquia":{lat:39.9,lon:32.9},
        "Polônia":{lat:51.9,lon:19.1},"República Tcheca":{lat:49.8,lon:15.5},
    };

    const COUNTRY_ISO3 = {
        "Brasil":"BRA","Portugal":"PRT","Estados Unidos":"USA","México":"MEX","Argentina":"ARG",
        "Reino Unido":"GBR","França":"FRA","Alemanha":"DEU","Itália":"ITA","Espanha":"ESP",
        "Índia":"IND","China":"CHN","Japão":"JPN","Canadá":"CAN","Austrália":"AUS",
        "Holanda":"NLD","Suécia":"SWE","Suíça":"CHE","Coreia do Sul":"KOR","Singapura":"SGP",
        "Colômbia":"COL","Chile":"CHL","Peru":"PER","Rússia":"RUS","Noruega":"NOR",
        "Dinamarca":"DNK","Finlândia":"FIN","Áustria":"AUT","Bélgica":"BEL",
        "Irlanda":"IRL","Israel":"ISR","Turquia":"TUR","Polônia":"POL","República Tcheca":"CZE",
    };

    const UNIVERSITY_COUNTRY = {
        "usp":"Brasil","unicamp":"Brasil","ufrj":"Brasil","ufmg":"Brasil","unesp":"Brasil","puc":"Brasil","fiocruz":"Brasil",
        "mit":"Estados Unidos","harvard":"Estados Unidos","stanford":"Estados Unidos","yale":"Estados Unidos","princeton":"Estados Unidos","berkeley":"Estados Unidos","columbia":"Estados Unidos","caltech":"Estados Unidos",
        "oxford":"Reino Unido","cambridge":"Reino Unido","imperial":"Reino Unido","ucl":"Reino Unido",
        "sorbonne":"França","cnrs":"França","max planck":"Alemanha","eth zurich":"Suíça",
        "university of toronto":"Canadá","mcgill":"Canadá","universidad de buenos aires":"Argentina",
        "universidade do porto":"Portugal","universidade de coimbra":"Portugal","universidade de lisboa":"Portugal",
        "tsinghua":"China","peking university":"China","university of tokyo":"Japão","kyoto university":"Japão",
        "karolinska":"Suécia","leiden":"Holanda","bologna":"Itália","sapienza":"Itália",
    };

    function normalize(text) {
        if (!text) return '';
        const repl = {'á':'a','à':'a','â':'a','ã':'a','ä':'a','é':'e','ê':'e','è':'e','ë':'e',
            'í':'i','ì':'i','î':'i','ï':'i','ó':'o','ò':'o','ô':'o','õ':'o','ö':'o',
            'ú':'u','ù':'u','û':'u','ü':'u','ç':'c'};
        return text.toLowerCase().split('').map(c => repl[c] || c).join('').replace(/\s+/g, ' ').trim();
    }

    function tokenize(text) {
        const words = (String(text).toLowerCase().match(/[a-zA-ZÀ-ÿ0-9\-]{3,}/g) || []);
        return words.filter(w => !STOPWORDS.has(w) && w.length > 2);
    }

    function extractKeywordsTFIDF(text, topN = 20) {
        if (!text) return [];
        const sentences = text.split(/[.!?]\s+/);
        const words = tokenize(text);
        if (!words.length) return [];
        const tf = {};
        words.forEach(w => { tf[w] = (tf[w] || 0) + 1; });
        const total = words.length || 1;
        const sentencePresence = {};
        sentences.forEach(sent => {
            const sw = new Set(tokenize(sent));
            sw.forEach(w => { sentencePresence[w] = (sentencePresence[w] || 0) + 1; });
        });
        const scores = {};
        for (const [word, count] of Object.entries(tf)) {
            if (word.length < 3) continue;
            const tfScore = count / total;
            const idfScore = Math.log(1 + (sentencePresence[word] || 0));
            const lenBonus = Math.min(word.length / 10, 1.2);
            scores[word] = tfScore * idfScore * lenBonus;
        }
        return Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, topN).map(e => e[0]);
    }

    function summarizeExtractive(text, maxSentences = 4) {
        if (!text || text.length < 100) return (text || '').slice(0, 500) || 'Sem conteúdo disponível.';
        const clean = text.replace(/\n+/g, ' ').trim();
        let sentences = clean.split(/(?<=[.!?])\s+/);
        sentences = sentences.filter(s => s.split(/\s+/).length > 5);
        if (!sentences.length) return text.slice(0, 500);
        const wordFreq = {};
        const allWords = tokenize(text);
        const totalW = allWords.length || 1;
        allWords.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
        for (const w in wordFreq) wordFreq[w] /= totalW;
        const scored = [];
        sentences.forEach((sent, i) => {
            const words = tokenize(sent);
            if (!words.length) return;
            let score = words.reduce((s, w) => s + (wordFreq[w] || 0), 0) / words.length;
            if (i < 3) score *= 1.4;
            if (words.length < 8) score *= 0.6;
            scored.push({ score, sent });
        });
        if (!scored.length) return text.slice(0, 600);
        scored.sort((a, b) => b.score - a.score);
        const top = new Set(scored.slice(0, maxSentences).map(s => s.sent));
        const ordered = sentences.filter(s => top.has(s)).slice(0, maxSentences);
        return ordered.join(' ').slice(0, 1000);
    }

    function detectTopic(text, fallback = 'Pesquisa Geral') {
        const t = normalize(text);
        let best = fallback, bestScore = 0;
        for (const [topic, terms] of Object.entries(TOPIC_RULES)) {
            const score = terms.reduce((s, term) => s + (t.includes(term) ? 2 : 0), 0);
            if (score > bestScore) { bestScore = score; best = topic; }
        }
        return best;
    }

    function detectYears(text) {
        const matches = String(text).match(/\b(19\d{2}|20\d{2})\b/g) || [];
        const now = new Date().getFullYear();
        return [...new Set(matches.map(Number).filter(y => y >= 1900 && y <= now + 2))].sort();
    }

    function inferNationality(text) {
        const t = normalize(text);
        // 1. Check direct country mentions
        for (const country of Object.keys(NATIONALITY_COORDS)) {
            if (t.includes(normalize(country))) return country;
        }
        // 2. Check university/institution mentions
        for (const [uni, country] of Object.entries(UNIVERSITY_COUNTRY)) {
            if (t.includes(normalize(uni))) return country;
        }
        // 3. Language-based heuristic for short texts
        const lang = detectLanguage(text);
        if (lang === 'Português') return 'Brasil';
        if (lang === 'Inglês') return 'Estados Unidos';
        return 'Desconhecido';
    }

    function countryToISO3(countryName) {
        return COUNTRY_ISO3[countryName] || null;
    }

    function cosineSimilarity(textA, textB) {
        if (!textA || !textB) return 0;
        const ta = {}, tb = {};
        tokenize(textA).forEach(w => { ta[w] = (ta[w] || 0) + 1; });
        tokenize(textB).forEach(w => { tb[w] = (tb[w] || 0) + 1; });
        if (!Object.keys(ta).length || !Object.keys(tb).length) return 0;
        const keys = new Set([...Object.keys(ta), ...Object.keys(tb)]);
        let dot = 0, na2 = 0, nb2 = 0;
        keys.forEach(k => {
            const a = ta[k] || 0, b = tb[k] || 0;
            dot += a * b; na2 += a * a; nb2 += b * b;
        });
        const denom = Math.sqrt(na2) * Math.sqrt(nb2);
        return denom ? Math.round((dot / denom) * 10000) / 10000 : 0;
    }

    function scoreRelevance(query, text, keywords) {
        const qTerms = new Set(tokenize(query));
        if (!qTerms.size) return 0;
        const docTerms = new Set([...tokenize(text), ...keywords]);
        const inter = [...qTerms].filter(t => docTerms.has(t)).length;
        const union = new Set([...qTerms, ...docTerms]).size || 1;
        return Math.round((inter / union) * 10000) / 100;
    }

    function extractAuthor(text) {
        if (!text || text.length < 20) return 'Desconhecido';
        // Search only in the first 3000 chars (header area of documents)
        const header = text.slice(0, 3000);
        const patterns = [
            // Explicit labels
            /(?:authors?|autore?s?|by|por|written by|escrito por)[:\s—–-]+([A-ZÀ-ÿ][A-Za-zÀ-ÿ\s,\.;&]{5,120})/i,
            // Academic format: LASTNAME, Firstname
            /\n\s*([A-ZÀ-Ÿ]{2,}[,;]\s*[A-ZÀ-ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ]*)*)/,
            // Name at start of line after title-like text
            /\n\s*([A-ZÀ-ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ]+){1,4})\s*(?:\n|\d{4}|\()/,
            // Simple name pattern with 2-4 capitalized words
            /([A-ZÀ-ÿ][a-zà-ÿ]+(?:\s+(?:de|da|do|dos|das|e|van|von|del|di)\s+)?[A-ZÀ-ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ]+){0,2})\s*\n/,
        ];
        for (const pat of patterns) {
            const m = header.match(pat);
            if (m) {
                let author = m[1].trim().replace(/[\n\r]+/g, ' ').replace(/\s+/g, ' ');
                // Clean trailing punctuation
                author = author.replace(/[,;.]+$/, '').trim();
                // Filter out common false positives
                const lower = author.toLowerCase();
                const falsePositives = ['resumo', 'abstract', 'introduction', 'introdução', 'palavras', 'keywords', 'artigo', 'article', 'capítulo', 'chapter', 'universidade', 'university', 'revista', 'journal', 'volume'];
                if (falsePositives.some(fp => lower.includes(fp))) continue;
                if (author.length > 5 && author.length < 120) return author;
            }
        }
        return 'Desconhecido';
    }

    function detectLanguage(text) {
        const t = text.toLowerCase();
        const pt = ["que","não","para","com","uma","são","está","sendo","como","pelo","pela","dos","das"];
        const en = ["the","and","that","this","with","from","have","been","which","their","abstract"];
        const ptScore = pt.filter(m => t.includes(` ${m} `)).length;
        const enScore = en.filter(m => t.includes(` ${m} `)).length;
        return ptScore >= enScore ? 'Português' : 'Inglês';
    }

    function computeReadability(text) {
        const words = text.match(/\w+/g) || [];
        const sentences = text.split(/[.!?]+/).filter(s => s.split(/\s+/).length > 3);
        if (!words.length || !sentences.length) return { clarity: 50, words: 0, sentences: 0 };
        const avgWPS = words.length / Math.max(sentences.length, 1);
        const vowels = /[aeiouáéíóúàèìòùãõâêîôû]/gi;
        const avgSyl = words.reduce((s, w) => s + Math.max(1, (w.match(vowels) || []).length), 0) / Math.max(words.length, 1);
        let score = 100 - (1.015 * avgWPS) - (84.6 * avgSyl);
        score = Math.max(0, Math.min(100, score));
        return {
            clarity: Math.round(score * 10) / 10,
            words: words.length,
            sentences: sentences.length,
            avg_words_per_sentence: Math.round(avgWPS * 10) / 10,
            estimated_pages: Math.max(1, Math.round(words.length / 300)),
            reading_time_min: Math.max(1, Math.round(words.length / 200)),
        };
    }

    function generateContextualSummary(text, topic, kind) {
        if (!text || text.length < 50) return `Arquivo do tipo ${kind || 'documento'}.`;
        const baseSummary = summarizeExtractive(text, 3);
        const kindLabel = kind === 'PDF' ? 'artigo' : kind === 'Word' ? 'documento' : kind === 'CSV' ? 'planilha' : 'documento';
        const topicLabel = topic && topic !== 'Pesquisa Geral' ? ` na área de ${topic}` : '';
        return `Este ${kindLabel}${topicLabel} aborda: ${baseSummary}`;
    }

    function extractReferences(text) {
        if (!text || text.length < 200) return { count: 0, samples: [] };
        const tail = text.slice(-Math.min(text.length, 8000));
        const refs = [];
        // Pattern 1: [1] Author...
        const bracketRefs = tail.match(/\[\d+\]\s*[A-ZÀ-ÿ][^\[]{10,200}/g) || [];
        bracketRefs.forEach(r => refs.push(r.trim().slice(0, 150)));
        // Pattern 2: LASTNAME, F. (Year).
        const apaRefs = tail.match(/[A-ZÀ-Ÿ]{2,}[,.]\s*[A-ZÀ-ÿ]\..*?\(\d{4}\)/g) || [];
        apaRefs.forEach(r => refs.push(r.trim().slice(0, 150)));
        // Pattern 3: Numbered refs: 1. Author...
        const numRefs = tail.match(/^\d+\.\s+[A-ZÀ-ÿ][A-Za-zÀ-ÿ\s,\.]+/gm) || [];
        numRefs.forEach(r => refs.push(r.trim().slice(0, 150)));
        const unique = [...new Set(refs)];
        return { count: unique.length, samples: unique.slice(0, 10) };
    }

    function recognizeIntent(query) {
        const q = normalize(query);
        const topic = detectTopic(q);
        const years = detectYears(q);
        let intent = 'pesquisa bibliográfica';
        if (['imagem','figura','foto','visual'].some(w => q.includes(w))) intent = 'busca visual';
        else if (['comparar','conectar','relacionar','semelhante'].some(w => q.includes(w))) intent = 'conexão temática';
        else if (['analisar','análise','métricas','tendência'].some(w => q.includes(w))) intent = 'análise';
        const keywords = extractKeywordsTFIDF(query, 12);
        const topicTerms = (TOPIC_RULES[topic] || []).slice(0, 5);
        const suggestions = [];
        [...keywords, ...topicTerms].forEach(t => { if (!suggestions.includes(t)) suggestions.push(t); });
        return { intent, topic, keywords, search_terms: suggestions.slice(0, 12), years };
    }

    function safeTopValue(arr, def = 'N/A') {
        if (!arr || !arr.length) return def;
        const counts = {};
        arr.filter(v => v != null && String(v).trim()).forEach(v => {
            const s = String(v).trim();
            counts[s] = (counts[s] || 0) + 1;
        });
        const entries = Object.entries(counts);
        if (!entries.length) return def;
        return entries.sort((a, b) => b[1] - a[1])[0][0];
    }

    function counter(arr) {
        const c = {};
        arr.forEach(v => { if (v) c[v] = (c[v] || 0) + 1; });
        return Object.entries(c).sort((a, b) => b[1] - a[1]);
    }

    /* ============================================================
       MACHINE LEARNING: Content-Based User Profiling
       ============================================================ */
    
    // Atualiza o perfil de aprendizado do usuário
    function updateProfile(state, email, doc, weight = 1) {
        if (!email || !state.users[email]) return;
        if (!state.user_interest[email] || !state.user_interest[email].topics) {
            state.user_interest[email] = { topics: {}, keywords: {}, total_interactions: 0 };
        }
        
        const profile = state.user_interest[email];
        profile.total_interactions = (profile.total_interactions || 0) + weight;
        
        if (doc.topic) {
            profile.topics[doc.topic] = (profile.topics[doc.topic] || 0) + (2 * weight);
        }
        
        if (doc.keywords && Array.isArray(doc.keywords)) {
            doc.keywords.forEach(kw => {
                profile.keywords[kw] = (profile.keywords[kw] || 0) + (1 * weight);
            });
        }
    }

    // Calcula a afinidade (Score ML) de um documento com o perfil do usuário
    function calculateAffinity(profile, doc) {
        if (!profile || !profile.topics || !profile.keywords || !profile.total_interactions) return 0;
        let score = 0;
        
        if (doc.topic && profile.topics[doc.topic]) {
            score += profile.topics[doc.topic] * 5;
        }
        
        if (doc.keywords && Array.isArray(doc.keywords)) {
            doc.keywords.forEach(kw => {
                if (profile.keywords[kw]) score += profile.keywords[kw] * 2;
            });
        }
        
        return score / Math.max(1, profile.total_interactions);
    }

    function getRecommendations(state, email, docs, limit = 5) {
        const profile = state.user_interest[email];
        if (!profile) return docs.slice(0, limit).map(d => ({ doc: d, score: 0 }));
        
        const scored = docs.map(d => ({ doc: d, score: calculateAffinity(profile, d) }));
        scored.sort((a, b) => b.score - a.score);
        
        return scored.slice(0, limit);
    }

    return {
        STOPWORDS, TOPIC_RULES, NATIONALITY_COORDS, COUNTRY_ISO3,
        normalize, tokenize, extractKeywordsTFIDF, summarizeExtractive,
        detectTopic, detectYears, inferNationality, countryToISO3,
        cosineSimilarity, scoreRelevance,
        extractAuthor, detectLanguage, computeReadability,
        generateContextualSummary, extractReferences,
        recognizeIntent, safeTopValue, counter,
        updateProfile, calculateAffinity, getRecommendations
    };
})();

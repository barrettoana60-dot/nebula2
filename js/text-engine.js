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
        for (const country of Object.keys(NATIONALITY_COORDS)) {
            if (t.includes(country.toLowerCase())) return country;
        }
        return 'Brasil';
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
        const patterns = [
            /(?:author|autor|autores|authors)[:\s]+([A-ZÀ-ÿ][A-Za-zÀ-ÿ\s,\.]{5,80})/i,
            /(?:by|por)\s+([A-ZÀ-ÿ][A-Za-zÀ-ÿ\s]{5,60})/i,
            /\b([A-Z][a-zà-ÿ]+(?:\s+[A-Z][a-zà-ÿ]+){1,3})\s*\n/,
        ];
        for (const pat of patterns) {
            const m = text.match(pat);
            if (m && m[1].trim().length > 5 && m[1].trim().length < 80) return m[1].trim();
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
        if (!state.user_interest[email]) state.user_interest[email] = { topics: {}, keywords: {}, total_interactions: 0 };
        
        const profile = state.user_interest[email];
        profile.total_interactions += weight;
        
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
        if (!profile || profile.total_interactions === 0) return 0;
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
        STOPWORDS, TOPIC_RULES, NATIONALITY_COORDS,
        normalize, tokenize, extractKeywordsTFIDF, summarizeExtractive,
        detectTopic, detectYears, inferNationality,
        cosineSimilarity, scoreRelevance,
        extractAuthor, detectLanguage, computeReadability,
        recognizeIntent, safeTopValue, counter,
        updateProfile, calculateAffinity, getRecommendations
    };
})();

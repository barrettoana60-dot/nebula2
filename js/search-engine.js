/* ============================================================
   SEARCH ENGINE — Academic APIs (SciELO, OpenAlex, DOAJ, etc.)
   ============================================================ */
const SearchEngine = (() => {
    const MAILTO = 'nebula@research.ai';

    const GENERIC_QUERY_TERMS = new Set([
        'tecnologia', 'tecnologico', 'tecnologica', 'tecnologicos', 'tecnologicas',
        'digital', 'digitalizacao', 'sistema', 'sistemas', 'analise', 'pesquisa',
        'estudo', 'estudos', 'desenvolvimento', 'metodo', 'metodos', 'processo',
        'aplicacao', 'aplicacoes', 'ciencia', 'dados', 'novo', 'novos', 'nova', 'novas',
        'area', 'areas', 'geral', 'artigo', 'artigos', 'trabalho', 'resultado', 'resultados'
    ]);

    const TERM_VARIANTS = {
        museu: ['museu', 'museus', 'museal', 'museais', 'museologia', 'museologico', 'museologica', 'museum', 'museums', 'musealization'],
        museus: ['museu', 'museus', 'museal', 'museais', 'museologia', 'museologico', 'museologica', 'museum', 'museums'],
        inovacao: ['inovacao', 'inovador', 'inovadora', 'inovacoes', 'inovative', 'innovation', 'innovative', 'innovations'],
        tecnologia: ['tecnologia', 'tecnologico', 'tecnologica', 'tecnologicos', 'tecnologicas', 'technology', 'technologies', 'technological'],
        tecnologica: ['tecnologia', 'tecnologico', 'tecnologica', 'tecnologicos', 'technology', 'technological'],
        patrimonio: ['patrimonio', 'patrimonial', 'heritage', 'cultural heritage'],
        acervo: ['acervo', 'acervos', 'collection', 'collections']
    };

    const OFF_TOPIC_RULES = {
        museu: {
            triggers: ['museu', 'museus', 'museologia', 'museal', 'exposicao', 'curadoria', 'acervo'],
            mustHave: ['museu', 'museus', 'museal', 'museologia', 'museum', 'museums', 'exposicao', 'exposição', 'curadoria', 'acervo', 'patrimonio'],
            conflicts: ['aliment', 'nutric', 'agroind', 'frigor', 'lacteo', 'lactea', 'cereal', 'zootecn', 'agricult', 'food science', 'culinaria', 'gastronom', 'bebida', 'fruticult', 'piscicult', 'avicult', 'suinocult']
        }
    };

    function getQueryDomainHints(query) {
        const { coreTerms } = parseSearchQuery(query);
        const hints = new Set();
        coreTerms.forEach(t => {
            if (['museu', 'museus', 'museologia', 'museal', 'exposicao', 'curadoria', 'acervo'].some(k => termMatchesText(t, k) || t.includes(k))) {
                hints.add('museu');
            }
        });
        return [...hints];
    }

    function isOffTopicForQuery(article, query) {
        return false;
    }

    function getTermVariants(term) {
        const n = TextEngine.normalize(term);
        const variants = new Set([n]);
        (TERM_VARIANTS[n] || []).forEach(v => variants.add(TextEngine.normalize(v)));
        if (n.length > 4 && n.endsWith('s')) variants.add(n.slice(0, -1));
        if (n.length > 5 && n.endsWith('oes')) variants.add(n.slice(0, -3) + 'ao');
        return [...variants].filter(v => v.length >= 4);
    }

    function termMatchesText(textNorm, term) {
        if (!textNorm || !term) return false;
        return getTermVariants(term).some(v => {
            if (!textNorm.includes(v)) return false;
            if (v.length >= 6) return true;
            const idx = textNorm.indexOf(v);
            const before = idx > 0 ? textNorm[idx - 1] : ' ';
            const after = idx + v.length < textNorm.length ? textNorm[idx + v.length] : ' ';
            const okEdge = !before || /[\s,.;:()\[\]\-/—]/.test(before);
            const okEnd = !after || /[\s,.;:()\[\]\-/—]/.test(after);
            return okEdge && okEnd;
        });
    }

    function parseSearchQuery(query) {
        const raw = TextEngine.tokenize(query || '').filter(t => t.length >= 3);
        const seen = new Set();
        const allTerms = [];
        raw.forEach(t => {
            const n = TextEngine.normalize(t);
            if (!seen.has(n)) { seen.add(n); allTerms.push(n); }
        });
        const coreTerms = allTerms.filter(t => !GENERIC_QUERY_TERMS.has(t));
        const genericTerms = allTerms.filter(t => GENERIC_QUERY_TERMS.has(t));
        return {
            allTerms,
            coreTerms: coreTerms.length ? coreTerms : allTerms,
            genericTerms
        };
    }

    function analyzeQueryMatch(article, query) {
        const { allTerms, coreTerms } = parseSearchQuery(query);
        const titleNorm = TextEngine.normalize(article.title || '');
        const artNorm = TextEngine.normalize(`${article.title || ''} ${article.abstract || ''} ${(article.keywords || []).join(' ')}`);

        const matched = [];
        const matchedCore = [];
        let titleHits = 0;

        allTerms.forEach(term => {
            const inTitle = termMatchesText(titleNorm, term);
            const inBody = termMatchesText(artNorm, term);
            if (inTitle || inBody) {
                matched.push(term);
                if (inTitle) titleHits++;
                if (coreTerms.includes(term)) matchedCore.push(term);
            }
        });

        const coverage = allTerms.length ? matched.length / allTerms.length : 0;
        const coreCoverage = coreTerms.length ? matchedCore.length / coreTerms.length : 0;

        return { allTerms, coreTerms, matched, matchedCore, coverage, coreCoverage, titleHits };
    }

    function articleMatchesQuery(article, query) {
        const { allTerms } = parseSearchQuery(query);
        if (!allTerms.length) return true;
        
        const { matched } = analyzeQueryMatch(article, query);
        // Lenient match: at least 1 term matches
        return matched.length > 0;
    }

    function applyRelevanceGate(ranked, query, limit) {
        const strict = ranked.filter(a => articleMatchesQuery(a, query) && a.affinityScore > 2);
        if (!strict.length) {
            return ranked.slice(0, Math.min(3, limit)).map(a => ({ ...a, weakMatch: true }));
        }

        const topScore = strict[0].affinityScore;
        const floor = topScore * 0.58;
        return strict
            .filter(a => a.affinityScore >= floor)
            .slice(0, limit);
    }

    function scoreQueryFocus(article, query) {
        const { allTerms, coreTerms } = parseSearchQuery(query);
        if (!allTerms.length) return 0;

        const titleNorm = TextEngine.normalize(article.title || '');
        const artText = `${article.title || ''} ${article.abstract || ''} ${(article.keywords || []).join(' ')}`;
        const artNorm = TextEngine.normalize(artText);
        const analysis = analyzeQueryMatch(article, query);

        if (!articleMatchesQuery(article, query)) return 0.1;

        let score = 0;
        score += analysis.coverage * 120;
        score += analysis.coreCoverage * 150;
        score += analysis.titleHits * 35;
        score += TextEngine.cosineSimilarity(query, artText) * 70;
        score += TextEngine.scoreRelevance(query, artText, article.keywords || []) * 8;

        coreTerms.forEach(term => {
            if (termMatchesText(titleNorm, term)) score += 45;
            else if (termMatchesText(artNorm, term)) score += 18;
        });

        if (coreTerms.length >= 2 && analysis.matchedCore.length >= 2) score += 40;

        const onlyGeneric = analysis.matched.every(t => GENERIC_QUERY_TERMS.has(t));
        if (onlyGeneric) score *= 0.05;

        return score;
    }

    function buildSearchApiQueries(query) {
        const q = query.trim();
        const { coreTerms } = parseSearchQuery(q);
        const queries = [q];

        if (coreTerms.length >= 2) {
            const coreQuery = coreTerms.join(' ');
            if (coreQuery !== q) queries.push(coreQuery);
            // Add individual terms as fallback queries
            coreTerms.forEach(t => {
                if (t.length >= 4) queries.push(t);
            });
        }

        return [...new Set(queries.filter(Boolean))].slice(0, 4);
    }

    async function fetchArticlesForQuery(query, limit = 16, filterQuery = null) {
        const perSource = Math.max(4, Math.ceil(limit / 5));
        const [scielo, openalex, ss, doaj, cr, epmc] = await Promise.all([
            searchSciELO(query, perSource),
            searchOpenAlex(query, perSource),
            searchSemanticScholar(query, perSource),
            searchDOAJ(query, perSource),
            searchCrossref(query, perSource),
            searchEuropePMC(query, Math.max(3, perSource - 2))
        ]);
        let articles = dedupeArticles([...scielo, ...openalex, ...ss, ...doaj, ...cr, ...epmc]);
        const gate = filterQuery || query;
        if (gate && gate.trim()) {
            articles = articles.filter(a => !isOffTopicForQuery(a, gate));
        }
        return articles;
    }

    async function fetchSearchResults(state, email, query, limit = 18) {
        const q = (query || '').trim();
        if (!q) return fetchPersonalizedArticles(state, email, '', limit);

        const profile = buildUserLearningProfile(state, email);
        const apiQueries = buildSearchApiQueries(q);

        const batches = await Promise.all(
            apiQueries.map(term => fetchArticlesForQuery(term, limit + 8, q).catch(() => []))
        );

        const ranked = rankArticles(dedupeArticles(batches.flat()), profile, q, true);
        return applyRelevanceGate(ranked, q, limit);
    }

    function getQuerySummary(query) {
        const { allTerms, coreTerms } = parseSearchQuery(query);
        return {
            allTerms,
            coreTerms,
            requiredLabel: coreTerms.length ? coreTerms.join(' + ') : allTerms.join(' + ')
        };
    }

    function openAlexAbstract(invertedIndex) {
        if (!invertedIndex || typeof invertedIndex !== 'object') return '';
        const words = [];
        Object.entries(invertedIndex).forEach(([word, positions]) => {
            (positions || []).forEach(pos => { words[pos] = word; });
        });
        return words.filter(Boolean).join(' ').slice(0, 450);
    }

    function computeQualisCapes(source, citations, url, title) {
        const src = (source || '').toLowerCase();
        const c = parseInt(citations) || 0;
        
        // High impact journals / Top tier
        if (src.includes('nature') || src.includes('science') || src.includes('ieee') || src.includes('acm') || src.includes('lancet') || src.includes('cell') || c >= 50) {
            return { grade: 'A1', color: '#10b981', label: 'Qualis A1 (Alto Impacto Internacional)' };
        }
        if (src.includes('springer') || src.includes('elsevier') || src.includes('wiley') || src.includes('oxford') || src.includes('cambridge') || c >= 25) {
            return { grade: 'A2', color: '#059669', label: 'Qualis A2 (Impacto Internacional)' };
        }
        if (src.includes('scielo') || src.includes('frontiers') || src.includes('mdpi') || src.includes('plos') || c >= 12) {
            return { grade: 'A3', color: '#3b82f6', label: 'Qualis A3 (Excelente Circulação)' };
        }
        if (src.includes('doaj') || src.includes('redalyc') || src.includes('revista') || c >= 6) {
            return { grade: 'A4', color: '#6366f1', label: 'Qualis A4 (Relevância Nacional/Int.)' };
        }
        if (c >= 2 || (url && url.includes('doi.org'))) {
            return { grade: 'B1', color: '#f59e0b', label: 'Qualis B1 (Periódico Indexado)' };
        }
        return { grade: 'B2', color: '#8b5cf6', label: 'Qualis B2 (Produção Acadêmica)' };
    }

    function mapArticle(base) {
        const kwText = `${base.title || ''} ${base.abstract || ''}`;
        const qualisInfo = computeQualisCapes(base.source, base.citations, base.url, base.title);
        return {
            title: base.title || 'Sem título',
            authors: base.authors || 'Não informado',
            year: base.year || '?',
            abstract: (base.abstract || '').slice(0, 400),
            source: base.source || 'Periódico Acadêmico',
            journal: base.source || 'Periódico Acadêmico',
            citations: base.citations || 0,
            url: base.url || '',
            keywords: TextEngine.extractKeywordsTFIDF(kwText, 8),
            topic: TextEngine.detectTopic(kwText),
            provider: base.provider || base.source,
            qualis: qualisInfo.grade,
            qualisLabel: qualisInfo.label,
            qualisColor: qualisInfo.color
        };
    }

    async function searchSemanticScholar(query, limit = 8) {
        try {
            const params = new URLSearchParams({
                query, limit,
                fields: 'title,authors,year,abstract,venue,openAccessPdf,externalIds,citationCount'
            });
            const resp = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?${params}`, { signal: AbortSignal.timeout(12000) });
            if (!resp.ok) return [];
            const data = await resp.json();
            return (data.data || []).map(item => {
                const authors = (item.authors || []).slice(0, 4).map(a => a.name).join(', ');
                const openPdf = item.openAccessPdf || {};
                const doi = (item.externalIds || {}).DOI || '';
                const url = openPdf.url || (doi ? `https://doi.org/${doi}` : '');
                const kwText = `${item.title || ''} ${(item.abstract || '').slice(0, 500)}`;
                return mapArticle({
                    title: item.title || 'Sem título',
                    authors: authors || 'Não informado',
                    year: item.year || '?',
                    abstract: (item.abstract || '').slice(0, 400),
                    source: item.venue || 'Semantic Scholar',
                    citations: item.citationCount || 0,
                    url,
                    provider: 'Semantic Scholar'
                });
            });
        } catch { return []; }
    }

    async function searchCrossref(query, limit = 5) {
        try {
            const params = new URLSearchParams({
                query, rows: limit,
                select: 'title,author,issued,DOI,abstract,container-title,is-referenced-by-count',
                mailto: 'nebula@research.ai'
            });
            const resp = await fetch(`https://api.crossref.org/works?${params}`, { signal: AbortSignal.timeout(12000) });
            if (!resp.ok) return [];
            const items = (await resp.json()).message?.items || [];
            return items.map(item => {
                const title = (item.title || ['Sem título'])[0];
                const authors = (item.author || []).slice(0, 4).map(a => `${a.given || ''} ${a.family || ''}`.trim()).join(', ');
                let year = null;
                if (item.issued?.['date-parts']?.[0]) year = item.issued['date-parts'][0][0];
                const doi = item.DOI || '';
                const abstract = (item.abstract || '').replace(/<[^>]+>/g, ' ').slice(0, 400);
                const kwText = `${title} ${abstract}`;
                return mapArticle({
                    title, authors: authors || 'Não informado',
                    year: year || '?', abstract,
                    source: (item['container-title'] || ['Crossref'])[0],
                    citations: item['is-referenced-by-count'] || 0,
                    url: doi ? `https://doi.org/${doi}` : '',
                    provider: 'Crossref'
                });
            });
        } catch { return []; }
    }

    async function searchSciELO(query, limit = 8) {
        try {
            const params = new URLSearchParams({ q: query, limit: String(limit) });
            const resp = await fetch(`/api/scielo-search?${params}`, { signal: AbortSignal.timeout(14000) });
            if (!resp.ok) return [];
            const data = await resp.json();
            return (data.articles || []).map(a => mapArticle({ ...a, provider: 'SciELO' }));
        } catch { return []; }
    }

    async function searchOpenAlex(query, limit = 8, extraFilter = '') {
        try {
            const params = new URLSearchParams({
                search: query,
                per_page: String(limit),
                mailto: MAILTO,
                select: 'id,title,publication_year,authorships,abstract_inverted_index,cited_by_count,primary_location,doi,open_access'
            });
            if (extraFilter) params.set('filter', extraFilter);
            const resp = await fetch(`https://api.openalex.org/works?${params}`, { signal: AbortSignal.timeout(12000) });
            if (!resp.ok) return [];
            const data = await resp.json();
            return (data.results || []).map(item => {
                const authors = (item.authorships || []).slice(0, 4)
                    .map(a => a.author?.display_name).filter(Boolean).join(', ');
                const abstract = openAlexAbstract(item.abstract_inverted_index);
                const src = item.primary_location?.source?.display_name || 'OpenAlex';
                const doi = item.doi || '';
                return mapArticle({
                    title: item.title || 'Sem título',
                    authors: authors || 'Não informado',
                    year: item.publication_year || '?',
                    abstract,
                    source: src,
                    citations: item.cited_by_count || 0,
                    url: doi || item.primary_location?.landing_page_url || item.id || '',
                    provider: 'OpenAlex'
                });
            });
        } catch { return []; }
    }

    async function searchDOAJ(query, limit = 8) {
        try {
            const q = encodeURIComponent(query.replace(/"/g, ''));
            const resp = await fetch(
                `https://doaj.org/api/search/articles/${q}?page=1&pageSize=${limit}`,
                { signal: AbortSignal.timeout(12000) }
            );
            if (!resp.ok) return [];
            const data = await resp.json();
            return (data.results || []).map(r => {
                const b = r.bibjson || {};
                const title = b.title || 'Sem título';
                const authors = (b.author || []).map(a => a.name).filter(Boolean).join(', ');
                const abstract = (b.abstract || '').replace(/<[^>]+>/g, ' ').trim();
                const year = b.year || b.start_page?.year || '?';
                const journal = b.journal?.title || 'DOAJ';
                const doi = (b.identifier || []).find(i => i.type === 'doi')?.id || '';
                const links = b.link || [];
                const url = links.find(l => l.type === 'fulltext')?.url || (doi ? `https://doi.org/${doi}` : '');
                return mapArticle({
                    title, authors: authors || 'Não informado', year, abstract,
                    source: journal, citations: 0, url,
                    provider: 'DOAJ'
                });
            });
        } catch { return []; }
    }

    async function searchEuropePMC(query, limit = 6) {
        try {
            const params = new URLSearchParams({
                query: `${query} HAS_ABSTRACT:y`,
                format: 'json',
                pageSize: String(limit),
                resultType: 'core'
            });
            const resp = await fetch(`https://www.ebi.ac.uk/europepmc/webservices/rest/search?${params}`, {
                signal: AbortSignal.timeout(12000)
            });
            if (!resp.ok) return [];
            const data = await resp.json();
            return (data.resultList?.result || []).map(item => mapArticle({
                title: item.title || 'Sem título',
                authors: (item.authorString || 'Não informado').slice(0, 120),
                year: item.pubYear || '?',
                abstract: (item.abstractText || '').slice(0, 400),
                source: item.journalTitle || 'Europe PMC',
                citations: item.citedByCount || 0,
                url: item.doi ? `https://doi.org/${item.doi}` : (item.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${item.pmid}/` : ''),
                provider: 'Europe PMC'
            }));
        } catch { return []; }
    }

    function buildRecommendationQuery(userResearch, docs, limitTerms = 8) {
        const baseTerms = userResearch ? TextEngine.extractKeywordsTFIDF(userResearch, 8) : [];
        const repoTerms = [];
        (docs || []).slice(0, 12).forEach(d => repoTerms.push(...(d.keywords || []).slice(0, 4)));
        const merged = [];
        [...baseTerms, ...repoTerms].forEach(t => { if (t && !merged.includes(t)) merged.push(t); });
        return merged.slice(0, limitTerms).join(' ') || userResearch || 'pesquisa acadêmica';
    }

    function buildUserLearningProfile(state, email) {
        const user = (state.users || {})[email] || {};
        const interests = state.user_interest[email] || {};
        const docs = state.repository || [];
        const history = state.search_history || [];

        const learnedTerms = Object.entries(interests)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 30)
            .map(([term, weight]) => ({ term, weight }));

        const researchKeywords = user.research
            ? TextEngine.extractKeywordsTFIDF(user.research, 14)
            : [];

        const repoKeywords = [];
        docs.slice(0, 15).forEach(d => repoKeywords.push(...(d.keywords || []).slice(0, 4)));

        const recentText = history.slice(-8).map(h => h.query || '').join(' ');
        const historyKeywords = recentText
            ? TextEngine.extractKeywordsTFIDF(recentText, 12)
            : [];

        return {
            research: user.research || '',
            name: user.name || '',
            learnedTerms,
            researchKeywords,
            repoKeywords: [...new Set(repoKeywords)].slice(0, 35),
            historyKeywords,
            repoTopics: TextEngine.counter(docs.map(d => d.topic).filter(Boolean)).slice(0, 8),
            dominantTopic: TextEngine.safeTopValue(
                docs.map(d => d.topic).filter(Boolean),
                TextEngine.detectTopic(user.research || '')
            ),
            ownedTitles: docs.map(d => TextEngine.normalize(d.name || '')).filter(Boolean),
            docCount: docs.length,
            searchCount: history.length
        };
    }

    function scoreArticleForUser(article, profile, query, queryFirst = false) {
        let score = 0;
        const artText = `${article.title || ''} ${article.abstract || ''} ${(article.keywords || []).join(' ')}`;
        const artNorm = TextEngine.normalize(artText);
        const hasQuery = query && query.trim();

        if (hasQuery && queryFirst) {
            score = scoreQueryFocus(article, query);
        } else if (hasQuery) {
            score += TextEngine.scoreRelevance(query, artText, article.keywords || []) * 2.5;
            score += TextEngine.cosineSimilarity(query, artText) * 45;
            TextEngine.tokenize(query).forEach(term => {
                if (term.length >= 3 && artNorm.includes(TextEngine.normalize(term))) score += 8;
            });
        }

        if (queryFirst && hasQuery) {
            /* perfil ignorado */
        } else if (!queryFirst || !hasQuery) {
            if (profile.research) {
                score += TextEngine.cosineSimilarity(profile.research, artText) * 30;
            }

            profile.learnedTerms.forEach(({ term, weight }) => {
                const tn = TextEngine.normalize(term);
                if (tn.length >= 3 && artNorm.includes(tn)) {
                    score += Math.min(weight, 12) * 2.2;
                }
            });

            profile.researchKeywords.forEach(kw => {
                if (artNorm.includes(TextEngine.normalize(kw))) score += 5;
            });

            profile.repoKeywords.forEach(kw => {
                if (artNorm.includes(TextEngine.normalize(kw))) score += 3.5;
            });

            profile.historyKeywords.forEach(kw => {
                if (artNorm.includes(TextEngine.normalize(kw))) score += 2.5;
            });

            if (article.topic && article.topic === profile.dominantTopic) score += 12;

            profile.repoTopics.forEach(([topic, count]) => {
                if (article.topic === topic) score += count * 4;
            });
        }

        const year = parseInt(article.year, 10);
        if (!isNaN(year)) {
            if (year >= 2020) score += 4;
            else if (year >= 2015) score += 2;
        }

        const cites = article.citations || 0;
        score += Math.min(Math.log10(cites + 1) * 5, 15);

        const titleNorm = TextEngine.normalize(article.title || '');
        for (const owned of profile.ownedTitles) {
            if (owned.length > 8 && (titleNorm.includes(owned.slice(0, 25)) || owned.includes(titleNorm.slice(0, 25)))) {
                score *= 0.25;
                break;
            }
        }

        return Math.round(score * 10) / 10;
    }

    function dedupeArticles(articles) {
        const seen = new Set();
        return articles.filter(a => {
            const key = TextEngine.normalize(a.title || '').slice(0, 90);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function rankArticles(articles, profile, query, queryFirst = false) {
        const ranked = dedupeArticles(articles)
            .map(art => {
                const analysis = queryFirst && query ? analyzeQueryMatch(art, query) : null;
                return {
                    ...art,
                    affinityScore: scoreArticleForUser(art, profile, query, queryFirst),
                    queryMatchPct: analysis && analysis.allTerms.length
                        ? Math.round((analysis.matched.length / analysis.allTerms.length) * 100)
                        : null,
                    queryTermsMatched: analysis ? analysis.matched.length : null,
                    queryTermsTotal: analysis ? analysis.allTerms.length : null
                };
            })
            .filter(art => {
                if (!queryFirst || !query) return true;
                return art.affinityScore > 1 && articleMatchesQuery(art, query);
            })
            .sort((a, b) => b.affinityScore - a.affinityScore);

        const max = ranked[0]?.affinityScore || 1;
        return ranked.map(art => ({
            ...art,
            affinityPct: Math.min(99, Math.round((art.affinityScore / max) * 100))
        }));
    }

    function learnFromSearch(state, email, query, intentData) {
        if (!email) return;
        if (!state.user_interest[email]) state.user_interest[email] = {};

        const terms = [
            ...(intentData?.keywords || []),
            ...(intentData?.search_terms || []),
            ...TextEngine.extractKeywordsTFIDF(query || '', 10)
        ];

        terms.forEach(t => {
            if (t && t.length >= 3) {
                state.user_interest[email][t] = (state.user_interest[email][t] || 0) + 1;
            }
        });

        if (intentData?.topic) {
            state.user_interest[email][intentData.topic] = (state.user_interest[email][intentData.topic] || 0) + 2;
        }

        state.user_interest[email] = Object.fromEntries(
            Object.entries(state.user_interest[email]).sort((a, b) => b[1] - a[1]).slice(0, 80)
        );
    }

    async function fetchPersonalizedArticles(state, email, query = '', limit = 10) {
        const q = (query || '').trim();
        if (q) return fetchSearchResults(state, email, q, limit);

        const profile = buildUserLearningProfile(state, email);
        const queries = [];

        if (profile.research) queries.push(profile.research.slice(0, 140));

        const learned = profile.learnedTerms.slice(0, 6).map(t => t.term);
        if (learned.length) queries.push(learned.join(' '));

        const repoQuery = buildRecommendationQuery(profile.research, state.repository || [], 8);
        if (repoQuery && !queries.includes(repoQuery)) queries.push(repoQuery);

        if (!queries.length) queries.push(profile.dominantTopic || 'pesquisa acadêmica');

        const uniqueQueries = [...new Set(queries.filter(Boolean))].slice(0, 4);
        const batches = await Promise.all(
            uniqueQueries.map(term => fetchArticlesForQuery(term, 8).catch(() => []))
        );

        return rankArticles(dedupeArticles(batches.flat()), profile, '', false).slice(0, limit);
    }

    return {
        searchSemanticScholar, searchCrossref, searchSciELO, searchOpenAlex, searchDOAJ, searchEuropePMC,
        buildRecommendationQuery, buildUserLearningProfile, rankArticles, learnFromSearch,
        fetchPersonalizedArticles, fetchSearchResults, fetchArticlesForQuery, scoreArticleForUser,
        getQuerySummary, parseSearchQuery
    };
})();

/* ============================================================
   SEARCH ENGINE — Semantic Scholar + CrossRef APIs
   ============================================================ */
const SearchEngine = (() => {
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
                return {
                    title: item.title || 'Sem título',
                    authors: authors || 'Não informado',
                    year: item.year || '?',
                    abstract: (item.abstract || '').slice(0, 400),
                    source: item.venue || 'Semantic Scholar',
                    citations: item.citationCount || 0,
                    url,
                    keywords: TextEngine.extractKeywordsTFIDF(kwText, 8),
                    topic: TextEngine.detectTopic(kwText),
                };
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
                return {
                    title, authors: authors || 'Não informado',
                    year: year || '?', abstract,
                    source: (item['container-title'] || ['Crossref'])[0],
                    citations: item['is-referenced-by-count'] || 0,
                    url: doi ? `https://doi.org/${doi}` : '',
                    keywords: TextEngine.extractKeywordsTFIDF(kwText, 8),
                    topic: TextEngine.detectTopic(kwText),
                };
            });
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

    return { searchSemanticScholar, searchCrossref, buildRecommendationQuery };
})();

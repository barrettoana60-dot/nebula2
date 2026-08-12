/* SciELO search proxy — avoids browser CORS / JS gate on search.scielo.org */
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const q = (req.query.q || '').trim();
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);
    if (!q) return res.status(400).json({ articles: [], error: 'missing q' });

    try {
        const url = `https://search.scielo.org/?q=${encodeURIComponent(q)}&count=${limit}&lang=pt&output=json`;
        const resp = await fetch(url, {
            headers: {
                'User-Agent': 'NebulaResearch/1.0 (academic search; contact@nebula.research)',
                'Accept': 'application/json, text/plain, */*'
            },
            signal: AbortSignal.timeout(15000)
        });

        const raw = await resp.text();
        let data;
        try { data = JSON.parse(raw); } catch { data = null; }

        const items = data?.articles || data?.documents || data?.results || data?.data || [];
        const articles = (Array.isArray(items) ? items : []).slice(0, limit).map(item => {
            const title = item.title || item.document_title || item.display_title || 'Sem título';
            const authors = (item.authors || item.author || [])
                .map(a => (typeof a === 'string' ? a : a.name || a.full_name || '')).filter(Boolean).join(', ')
                || item.authors_string || 'Não informado';
            const abstract = (item.abstract || item.description || item.summary || '').replace(/<[^>]+>/g, ' ').trim();
            const year = item.year || item.publication_year || item.pub_date?.slice(0, 4) || '?';
            const pid = item.pid || item.code || item.id || '';
            const doi = item.doi || '';
            const artUrl = item.url
                || (pid ? `https://www.scielo.br/j/${String(pid).split('/')[0]}/` : '')
                || (doi ? `https://doi.org/${doi}` : '')
                || `https://search.scielo.org/?q=${encodeURIComponent(title)}`;
            return {
                title,
                authors,
                year,
                abstract: abstract.slice(0, 400),
                source: item.journal || item.source || 'SciELO',
                citations: item.cited_by_count || item.citations || 0,
                url: artUrl,
                keywords: [],
                topic: 'Pesquisa Geral',
                provider: 'SciELO'
            };
        });

        return res.status(200).json({ articles, total: articles.length });
    } catch (err) {
        return res.status(200).json({ articles: [], error: err.message });
    }
}

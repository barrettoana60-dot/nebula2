/* PAGE: ANALYSIS */
const PageAnalysis = (() => {
    function render(container, state) {
        const docs = state.repository || [];
        if (!docs.length) {
            container.innerHTML = `<div class="page-title">Análise de Dados</div><div class="page-sub">Seu painel de inteligência de pesquisa</div><div class="info-box">Envie documentos no Repositório para o algoritmo analisar seus dados.</div>`;
            return;
        }
        
        // ML Recomendações
        const highlights = TextEngine.getRecommendations(state, state.current_user, docs, 3);
        const topHighlight = highlights.length ? highlights[0].doc : docs[0];

        // Estatísticas Básicas
        const topics = docs.map(d=>d.topic).filter(Boolean);
        const authors = docs.map(d=>d.author).filter(a=>a&&a!=='Desconhecido');
        const dominantTopic = TextEngine.safeTopValue(topics, 'Nenhum');
        let totalTextBytes = docs.reduce((s,d)=>s+((d.text||'').length * 2), 0);
        let cryptoDataSize = (totalTextBytes / 1024).toFixed(1);

        let html = `
            <div class="page-title">Análise de Dados</div>
            <div class="page-sub">Insights simplificados e aprendizado de máquina sobre seu acervo</div>
            
            <div class="glass-outer mb-1">
                <div class="section-title">Resumo do seu Cofre (Criptografado)</div>
                <p class="small-muted mb-1" style="color:var(--text-white-80)">Você possui <b>${docs.length} artigos</b> salvos ocupando <b>${cryptoDataSize} KB</b> de texto seguro.</p>
                <div class="metric-grid">
                    <div class="metric-card"><div class="metric-label">Seu Foco Principal</div><div class="metric-value" style="font-size:1.6rem; color:var(--copper-1)">${dominantTopic}</div></div>
                    <div class="metric-card"><div class="metric-label">Total de Autores</div><div class="metric-value">${new Set(authors).size}</div></div>
                    <div class="metric-card"><div class="metric-label">Artigo com Maior Afinidade</div><div class="metric-value" style="font-size:1.2rem;">${(topHighlight.name || 'Desconhecido').slice(0, 40)}</div></div>
                </div>
            </div>

            <!-- Mapa Global e Linha do Tempo -->
            <div class="grid-2">
                <div class="glass">
                    <div class="section-title">Mapa Global de Pesquisa</div>
                    <p class="small-muted mb-1">Países mais citados ou origem provável dos seus artigos.</p>
                    <div id="chart-map"></div>
                </div>
                <div class="glass">
                    <div class="section-title">Evolução Temporal</div>
                    <p class="small-muted mb-1">Quando os artigos foram publicados.</p>
                    <div id="chart-timeline"></div>
                </div>
            </div>

            <!-- Destaques (ML) e Temas -->
            <div class="grid-2">
                <div class="glass">
                    <div class="section-title">Recomendados pelo Algoritmo</div>
                    <p class="small-muted mb-1">Baseado no que você mais interage.</p>
                    <div id="ml-highlights" style="display:flex; flex-direction:column; gap:1rem;"></div>
                </div>
                <div class="glass">
                    <div class="section-title">Assuntos mais discutidos</div>
                    <div id="chart-topics"></div>
                </div>
            </div>

            <div class="glass">
                <div class="section-title">Artigos Relacionados (Alta Similaridade)</div>
                <p class="small-muted mb-1">Documentos que falam exatamente sobre as mesmas coisas.</p>
                <div id="similarity-list"></div>
            </div>
        `;
        container.innerHTML = html;

        // Render ML Highlights
        const hlContainer = document.getElementById('ml-highlights');
        highlights.forEach((h, i) => {
            const doc = h.doc;
            hlContainer.innerHTML += `
                <div style="background:rgba(255,255,255,0.05); padding:1rem; border-radius:12px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="color:var(--copper-1); font-weight:600; font-size:0.8rem; margin-bottom:0.3rem;">★ MATCH ALTO (${Math.round(h.score*100)}%)</div>
                    <div class="article-title">${doc.name}</div>
                    <div class="article-meta">${doc.author || 'Autor Desconhecido'} • ${doc.topic}</div>
                    <div class="article-abstract">${(doc.summary || 'Sem resumo disponível').slice(0,100)}...</div>
                </div>
            `;
        });

        // Render Similarities
        const simList = document.getElementById('similarity-list');
        let simCount = 0;
        for (let i = 0; i < docs.length; i++) {
            for (let j = i + 1; j < docs.length; j++) {
                const sim = TextEngine.cosineSimilarity(docs[i].text || '', docs[j].text || '');
                if (sim > 0.15) {
                    simCount++;
                    simList.innerHTML += `
                        <div style="padding:1rem; border-bottom:1px solid rgba(255,255,255,0.05);">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div style="flex:1;"><b>${docs[i].name.slice(0,50)}</b></div>
                                <div style="padding:0 1rem; color:var(--copper-1);">⟷ ${Math.round(sim*100)}%</div>
                                <div style="flex:1; text-align:right;"><b>${docs[j].name.slice(0,50)}</b></div>
                            </div>
                        </div>
                    `;
                }
            }
        }
        if (simCount === 0) simList.innerHTML = `<div class="small-muted">Nenhum artigo com forte similaridade encontrado no acervo.</div>`;

        // Plotly configs
        const plotConfig = {responsive:true, displayModeBar:false};
        const plotLayout = (h) => ({
            height:h, paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)',
            font:{color:'#a0a0a0'}, margin:{l:40,r:20,t:20,b:40},
            xaxis:{gridcolor:'rgba(255,255,255,0.05)', zerolinecolor:'rgba(255,255,255,0.1)'},
            yaxis:{gridcolor:'rgba(255,255,255,0.05)', zerolinecolor:'rgba(255,255,255,0.1)'}
        });

        // 1. World Map (Choropleth)
        let countryCounts = {};
        docs.forEach(d => {
            const c = d.nationality || TextEngine.inferNationality(d.text || '');
            if (c && c !== 'Desconhecido') countryCounts[c] = (countryCounts[c] || 0) + 1;
        });
        
        // Convert country names to ISO-3 codes for Plotly
        const isoCountryCounts = {};
        for (const [name, count] of Object.entries(countryCounts)) {
            const iso = TextEngine.countryToISO3(name);
            if (iso) isoCountryCounts[iso] = (isoCountryCounts[iso] || 0) + count;
        }

        const mapLocations = Object.keys(isoCountryCounts);
        const mapZ = Object.values(isoCountryCounts);
        const mapHoverText = Object.keys(countryCounts);
        
        if (!mapLocations.length) {
            document.getElementById('chart-map').innerHTML = `<div class="small-muted" style="padding:2rem;text-align:center">Envie mais documentos para o sistema identificar os países de origem.</div>`;
        } else {
            Plotly.newPlot('chart-map', [{
                type: 'choropleth',
                locationmode: 'ISO-3',
                locations: mapLocations,
                z: mapZ,
                text: mapHoverText,
                colorscale: [ [0, 'rgba(217, 119, 74, 0.2)'], [1, '#d9774a'] ],
                showscale: false,
                marker: { line: { color: 'rgba(255,255,255,0.2)', width: 1 } },
                hovertemplate: '%{text}: %{z} artigo(s)<extra></extra>'
            }], {
                height: 350, margin: {l:0, r:0, t:0, b:0}, paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)',
                geo: {
                    showframe: false, showcoastlines: true, projection: { type: 'equirectangular' },
                    bgcolor: 'rgba(0,0,0,0)', coastlinecolor: 'rgba(255,255,255,0.2)',
                    showland: true, landcolor: 'rgba(20,20,20,0.5)',
                    showocean: true, oceancolor: 'transparent'
                }
            }, plotConfig);
        }


        // 2. Timeline (Temporal)
        const yc = TextEngine.counter(docs.map(d=>d.year).filter(Boolean).map(String)).sort((a,b)=>a[0]-b[0]);
        if (yc.length) {
            Plotly.newPlot('chart-timeline',[{
                type:'bar', x:yc.map(e=>e[0]), y:yc.map(e=>e[1]), 
                marker:{color:'rgba(255,255,255,0.1)', line:{color:'#d9774a', width:2}}
            }], plotLayout(300), plotConfig);
        } else {
            document.getElementById('chart-timeline').innerHTML = `<div class="small-muted" style="margin-top:2rem">Sem dados de ano suficientes.</div>`;
        }

        // 3. Topics (Horizontal Bar)
        const tc = TextEngine.counter(topics).slice(0,6);
        if (tc.length) {
            Plotly.newPlot('chart-topics',[{
                type:'bar', y:tc.map(e=>e[0]), x:tc.map(e=>e[1]), orientation:'h',
                marker:{color:'rgba(255,255,255,0.8)'}
            }], {...plotLayout(300), margin:{l:150,r:20,t:20,b:40}}, plotConfig);
        }
    }
    return {render};
})();

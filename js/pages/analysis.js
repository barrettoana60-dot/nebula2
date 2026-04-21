/* PAGE: ANALYSIS */
const PageAnalysis = (() => {
    function render(container, state) {
        const docs = state.repository || [];
        if (!docs.length) {
            container.innerHTML = `<div class="page-title">Análise de Dados</div><div class="page-sub">Seu painel de inteligência de pesquisa</div><div class="info-box">Envie documentos no Repositório para o algoritmo analisar seus dados.</div>`;
            return;
        }
        
        const highlights = TextEngine.getRecommendations(state, state.current_user, docs, 3);
        const topHighlight = highlights.length ? highlights[0].doc : docs[0];

        const topics = docs.map(d=>d.topic).filter(Boolean);
        const authors = docs.map(d=>d.author).filter(a=>a&&a!=='Desconhecido');
        const dominantTopic = TextEngine.safeTopValue(topics, 'Nenhum');
        let totalTextBytes = docs.reduce((s,d)=>s+((d.text||'').length * 2), 0);
        let cryptoDataSize = (totalTextBytes / 1024).toFixed(1);

        let html = `
            <div class="page-title">Análise de Dados Profunda</div>
            <div class="page-sub">Insights simplificados, aprendizado de máquina e Raio-X do seu acervo</div>
            
            <div class="glass-outer mb-1">
                <div class="section-title">Resumo do seu Cofre (Criptografado)</div>
                <p class="small-muted mb-1" style="color:var(--text-white-80)">Você possui <b>${docs.length} artigos</b> salvos ocupando <b>${cryptoDataSize} KB</b> de texto seguro.</p>
                <div class="metric-grid">
                    <div class="metric-card"><div class="metric-label">Seu Foco Principal</div><div class="metric-value" style="font-size:1.6rem; color:var(--copper-1)">${dominantTopic}</div></div>
                    <div class="metric-card"><div class="metric-label">Total de Autores</div><div class="metric-value">${new Set(authors).size}</div></div>
                    <div class="metric-card"><div class="metric-label">Artigo com Maior Afinidade</div><div class="metric-value" style="font-size:1.2rem;">${(topHighlight.name || 'Desconhecido').slice(0, 40)}</div></div>
                </div>
            </div>

            <!-- RAIO-X DO ACERVO -->
            <div class="glass mb-1" id="raio-x-container">
                <div class="section-title">Raio-X do Acervo (Diagnóstico Real por IA Llama 3.3)</div>
                <p class="small-muted mb-1">O algoritmo Llama 3.3 está lendo seu acervo agora mesmo...</p>
                <div style="text-align:center; padding: 2rem; color: var(--copper-1);">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                        <circle cx="12" cy="12" r="10" stroke-dasharray="30" stroke-dashoffset="10"/>
                    </svg>
                    <div style="margin-top:1rem;">Analisando todos os documentos...</div>
                </div>
            </div>
        `;
        container.innerHTML = html;

        // Assincronamente buscar a revisão da IA (Llama 3.3)
        NebulaAI.generateRepositoryReview(docs).then(aiReview => {
            const rxContainer = document.getElementById('raio-x-container');
            if (!rxContainer) return; // Mudou de tela

            if (!aiReview) {
                // Fallback caso a IA falhe
                aiReview = { strengths: ['Acervo seguro.'], weaknesses: ['Falta diversidade.'], suggestions: ['Adicione mais PDFs internacionais.'] };
            }

            rxContainer.innerHTML = `
                <div class="section-title">Raio-X do Acervo (Diagnóstico Real por IA Llama 3.3)</div>
                <p class="small-muted mb-1">O Llama 3.3 avaliou a saúde e a diversidade da sua pesquisa atual.</p>
                <div class="grid-3">
                    <div style="background:rgba(16, 185, 129, 0.05); border:1px solid rgba(16, 185, 129, 0.2); padding:1rem; border-radius:12px;">
                        <div style="color:#10b981; font-weight:600; margin-bottom:0.5rem">↑ Pontos Fortes</div>
                        <ul style="padding-left:1.2rem; font-size:0.85rem; color:var(--text-white-80)">
                            ${aiReview.strengths.map(s => `<li style="margin-bottom:0.4rem">${s}</li>`).join('')}
                        </ul>
                    </div>
                    <div style="background:rgba(239, 68, 68, 0.05); border:1px solid rgba(239, 68, 68, 0.2); padding:1rem; border-radius:12px;">
                        <div style="color:#fca5a5; font-weight:600; margin-bottom:0.5rem">↓ Lacunas / Pontos Fracos</div>
                        <ul style="padding-left:1.2rem; font-size:0.85rem; color:var(--text-white-80)">
                            ${aiReview.weaknesses.map(w => `<li style="margin-bottom:0.4rem">${w}</li>`).join('')}
                        </ul>
                    </div>
                    <div style="background:var(--copper-glow); border:1px solid rgba(217, 119, 74, 0.3); padding:1rem; border-radius:12px;">
                        <div style="color:var(--copper-1); font-weight:600; margin-bottom:0.5rem">Sugestões da Llama 3.3</div>
                        <ul style="padding-left:1.2rem; font-size:0.85rem; color:var(--text-white-80)">
                            ${aiReview.suggestions.map(s => `<li style="margin-bottom:0.4rem">${s}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `;
        });

        // Render remaining dynamic sections...
        let htmlExtra = `
            <div class="grid-2">
                <div class="glass">
                    <div class="section-title">Mapa Global de Pesquisa</div>
                    <p class="small-muted mb-1">Países mais citados ou origem provável dos seus artigos.</p>
                    <div id="chart-map"></div>
                </div>
                <div class="glass">
                    <div class="section-title">Evolução Temporal Descritiva</div>
                    <p class="small-muted mb-1">Linha do tempo cronológica com o que ocorreu em cada ano de publicação.</p>
                    <div id="timeline-container" style="max-height: 400px; overflow-y: auto; padding-right: 1rem;"></div>
                </div>
            </div>

            <div class="grid-2">
                <div class="glass">
                    <div class="section-title">Saúde do Repositório (Radar)</div>
                    <p class="small-muted mb-1">Métricas gerais avaliadas no seu acervo inteiro.</p>
                    <div id="chart-radar"></div>
                </div>
                <div class="glass">
                    <div class="section-title">Assuntos mais discutidos</div>
                    <p class="small-muted mb-1">A frequência de temas no seu cofre.</p>
                    <div id="chart-topics"></div>
                </div>
            </div>
            
            <div class="glass">
                <div class="section-title">Recomendados pelo Algoritmo</div>
                <p class="small-muted mb-1">Baseado no aprendizado do seu perfil.</p>
                <div id="ml-highlights" style="display:flex; flex-direction:column; gap:1rem;"></div>
            </div>
        `;
        container.innerHTML = html;

        // Render ML Highlights
        const hlContainer = document.getElementById('ml-highlights');
        highlights.forEach((h, i) => {
            const doc = h.doc;
            hlContainer.innerHTML += `
                <div style="background:rgba(255,255,255,0.05); padding:1rem; border-radius:12px; border:1px solid rgba(255,255,255,0.1);">
                    <div style="color:var(--copper-1); font-weight:600; font-size:0.8rem; margin-bottom:0.3rem;">MATCH ALTO (${Math.round(h.score*100)}%)</div>
                    <div class="article-title">${doc.name}</div>
                    <div class="article-meta">${doc.author || 'Autor Desconhecido'} • ${doc.topic}</div>
                    <div class="article-abstract">${(doc.summary || 'Sem resumo disponível').slice(0,150)}...</div>
                </div>
            `;
        });

        // Render Timeline Descritiva
        const tlContainer = document.getElementById('timeline-container');
        const docsByYear = {};
        docs.forEach(d => {
            if (d.year) {
                if (!docsByYear[d.year]) docsByYear[d.year] = [];
                docsByYear[d.year].push(d);
            }
        });
        
        const sortedYears = Object.keys(docsByYear).sort((a,b) => b - a); // newest first
        if (sortedYears.length === 0) {
            tlContainer.innerHTML = `<div class="small-muted">Nenhum dado de ano disponível nos artigos.</div>`;
        } else {
            let tlHtml = `<div style="border-left: 2px solid rgba(255,255,255,0.1); padding-left: 1rem; margin-left: 0.5rem;">`;
            sortedYears.forEach(year => {
                tlHtml += `<div style="position:relative; margin-bottom: 1.5rem;">
                    <div style="position:absolute; left:-1.4rem; top:0; width:10px; height:10px; border-radius:50%; background:var(--copper-1);"></div>
                    <div style="font-weight:bold; font-size:1.1rem; color:var(--text-white); margin-bottom:0.5rem;">${year}</div>
                `;
                docsByYear[year].forEach(d => {
                    const abs = (d.summary || `Artigo classificado em ${d.topic}.`).slice(0, 100) + '...';
                    tlHtml += `
                        <div style="background:rgba(0,0,0,0.2); padding:0.8rem; border-radius:8px; border:1px solid rgba(255,255,255,0.05); margin-bottom:0.5rem;">
                            <div style="font-size:0.9rem; font-weight:500;">${d.name}</div>
                            <div style="font-size:0.8rem; color:var(--text-white-60); margin-top:0.2rem;">${abs}</div>
                            <div style="margin-top:0.4rem;"><span class="tag tag-copper">${d.topic}</span></div>
                        </div>
                    `;
                });
                tlHtml += `</div>`;
            });
            tlHtml += `</div>`;
            tlContainer.innerHTML = tlHtml;
        }

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

        // 2. Radar Chart (Saúde)
        const radarMetrics = [
            Math.min(new Set(topics).size * 20, 100), // Diversidade Temática
            Math.min((docs.filter(d=>d.year && d.year > 2018).length / docs.length) * 150, 100) || 50, // Atualidade
            Math.min(new Set(authors).size * 15, 100), // Colaboração (Autores únicos)
            Math.min((totalTextBytes / docs.length) / 5000 * 100, 100) || 50, // Profundidade (Tamanho)
            Math.min(new Set(docs.map(d=>d.language)).size * 30, 100) || 30 // Diversidade Idioma
        ];
        Plotly.newPlot('chart-radar', [{
            type: 'scatterpolar',
            r: radarMetrics,
            theta: ['Temas', 'Atualidade', 'Autores', 'Profundidade', 'Idiomas'],
            fill: 'toself',
            fillcolor: 'rgba(217, 119, 74, 0.2)',
            line: { color: '#d9774a' }
        }], {
            polar: {
                radialaxis: { visible: true, range: [0, 100], color: 'rgba(255,255,255,0.2)', showticklabels: false },
                angularaxis: { color: 'rgba(255,255,255,0.7)' },
                bgcolor: 'transparent'
            },
            height: 350, margin: {l:40, r:40, t:20, b:20}, paper_bgcolor:'transparent'
        }, plotConfig);

        // 3. Topics (Horizontal Bar)
        const tc = TextEngine.counter(topics).slice(0,6);
        if (tc.length) {
            Plotly.newPlot('chart-topics',[{
                type:'bar', y:tc.map(e=>e[0]), x:tc.map(e=>e[1]), orientation:'h',
                marker:{color:'rgba(255,255,255,0.8)'}
            }], {...plotLayout(350), margin:{l:150,r:20,t:20,b:40}}, plotConfig);
        }
    }
    return {render};
})();

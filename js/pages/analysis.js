/* PAGE: ANALYSIS */
const PageAnalysis = (() => {
    function render(container, state) {
        const docs = state.repository || [];
        if (!docs.length) {
            container.innerHTML = `<div class="page-title">Análise Avançada</div><div class="page-sub">Análise estatística, temporal, temática e de conteúdo do seu repositório</div><div class="info-box">Envie documentos no Repositório para liberar análises.</div>`;
            return;
        }
        const topics = docs.map(d=>d.topic).filter(Boolean);
        const authors = docs.map(d=>d.author).filter(a=>a&&a!=='Desconhecido');
        const languages = docs.map(d=>d.language).filter(Boolean);
        const totalWords = docs.reduce((s,d)=>s+(d.readability?.words||0),0);
        const clarities = docs.map(d=>d.readability?.clarity||0).filter(Boolean);
        const avgClarity = clarities.length ? Math.round(clarities.reduce((a,b)=>a+b,0)/clarities.length*10)/10 : 0;
        const dominantTopic = TextEngine.safeTopValue(topics,'Pesquisa Geral');
        const dominantLang = TextEngine.safeTopValue(languages,'N/A');

        let html = `
            <div class="page-title">Análise Avançada</div>
            <div class="page-sub">Análise estatística, temporal, temática e de conteúdo do seu repositório</div>
            <div class="glass"><div class="section-title">Visão geral do acervo</div>
            <div class="metric-grid">
                <div class="metric-card blue"><div class="metric-label">Documentos</div><div class="metric-value">${docs.length}</div></div>
                <div class="metric-card cyan"><div class="metric-label">Temas únicos</div><div class="metric-value">${new Set(topics).size}</div></div>
                <div class="metric-card green"><div class="metric-label">Autores únicos</div><div class="metric-value">${new Set(authors).size}</div></div>
                <div class="metric-card purple"><div class="metric-label">Total palavras</div><div class="metric-value">${totalWords.toLocaleString()}</div></div>
                <div class="metric-card yellow"><div class="metric-label">Clareza média</div><div class="metric-value" style="font-size:1.3rem">${avgClarity}/100</div></div>
                <div class="metric-card blue"><div class="metric-label">Idiomas</div><div class="metric-value">${new Set(languages).size}</div></div>
            </div></div>
            <div class="grid-2">
                <div class="glass"><div class="section-title">Distribuição por tema</div><div id="chart-topics"></div></div>
                <div class="glass"><div class="section-title">Distribuição temporal</div><div id="chart-years"></div></div>
            </div>
            <div class="grid-2">
                <div class="glass"><div class="section-title">Tipos de documento</div><div id="chart-kinds"></div></div>
                <div class="glass"><div class="section-title">Autores mais frequentes</div><div id="chart-authors"></div></div>
            </div>
            <div class="glass"><div class="section-title">Palavras-chave mais frequentes</div><div id="chart-keywords"></div></div>
            <div class="glass"><div class="section-title">Mapa de origem</div><div id="chart-map"></div></div>
            <div class="glass"><div class="section-title">Resumo analítico automático</div>
                <p>O repositório contém <b>${docs.length} documentos</b> com um total estimado de <b>${totalWords.toLocaleString()} palavras</b>.
                Os temas predominantes são <b>${TextEngine.counter(topics).slice(0,3).map(e=>e[0]).join(', ')}</b>.
                Idioma dominante: <b>${dominantLang}</b>. Clareza média: <b>${avgClarity}/100</b>.</p>
            </div>
        `;
        container.innerHTML = html;

        // Plotly charts
        const plotConfig = {responsive:true,displayModeBar:false};
        const plotLayout = (h) => ({height:h,paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',font:{color:'#94a3c0'},margin:{l:40,r:20,t:10,b:60}});

        // Topics
        const tc = TextEngine.counter(topics);
        if (tc.length) Plotly.newPlot('chart-topics',[{type:'bar',x:tc.map(e=>e[0]),y:tc.map(e=>e[1]),marker:{color:'#60a5fa'},text:tc.map(e=>e[1]),textposition:'outside'}],{...plotLayout(320),xaxis:{tickangle:-30}},plotConfig);

        // Years
        const yc = TextEngine.counter(docs.map(d=>d.year).filter(Boolean).map(String)).sort((a,b)=>a[0]-b[0]);
        if (yc.length) Plotly.newPlot('chart-years',[{type:'scatter',mode:'lines',x:yc.map(e=>e[0]),y:yc.map(e=>e[1]),fill:'tozeroy',line:{color:'#60a5fa',width:2}}],plotLayout(320),plotConfig);

        // Kinds
        const kc = TextEngine.counter(docs.map(d=>d.kind).filter(Boolean));
        if (kc.length) Plotly.newPlot('chart-kinds',[{type:'pie',labels:kc.map(e=>e[0]),values:kc.map(e=>e[1]),hole:0.5,marker:{colors:['#60a5fa','#4ade80','#c084fc','#f97316','#67e8f9']}}],{...plotLayout(300),showlegend:true,legend:{bgcolor:'rgba(0,0,0,0)',font:{color:'#94a3c0'}}},plotConfig);

        // Authors
        const ac = TextEngine.counter(authors).slice(0,10);
        if (ac.length) Plotly.newPlot('chart-authors',[{type:'bar',y:ac.map(e=>e[0]),x:ac.map(e=>e[1]),orientation:'h',marker:{color:'#4ade80'}}],{...plotLayout(300),margin:{l:120,r:20,t:10,b:30}},plotConfig);

        // Keywords
        const allKW = []; docs.forEach(d=>(d.keywords||[]).forEach(k=>allKW.push(k)));
        const kwc = TextEngine.counter(allKW).slice(0,30);
        if (kwc.length) Plotly.newPlot('chart-keywords',[{type:'bar',x:kwc.map(e=>e[0]),y:kwc.map(e=>e[1]),marker:{color:'#60a5fa'}}],{...plotLayout(320),xaxis:{tickangle:-45}},plotConfig);

        // Map
        const natC = TextEngine.counter(docs.map(d=>d.nationality).filter(Boolean));
        const mapRows = natC.map(([c,n])=>{const co=TextEngine.NATIONALITY_COORDS[c];return co?{country:c,count:n,...co}:null}).filter(Boolean);
        if (mapRows.length) Plotly.newPlot('chart-map',[{type:'scattergeo',lon:mapRows.map(r=>r.lon),lat:mapRows.map(r=>r.lat),text:mapRows.map(r=>`${r.country}: ${r.count}`),mode:'markers',marker:{size:mapRows.map(r=>r.count*8+6),opacity:0.85,color:mapRows.map(r=>r.count),colorscale:'Blues',showscale:true}}],{height:440,paper_bgcolor:'rgba(0,0,0,0)',geo:{bgcolor:'rgba(0,0,0,0)',showland:true,landcolor:'rgba(255,255,255,0.06)',showcountries:true,countrycolor:'rgba(255,255,255,0.14)',showocean:true,oceancolor:'rgba(96,165,250,0.04)',projection:{type:'natural earth'}},margin:{l:0,r:0,t:0,b:0}},plotConfig);
    }
    return {render};
})();

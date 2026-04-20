/* PAGE: ANALYSIS */
const PageAnalysis = (() => {
    function render(container, state) {
        const docs = state.repository || [];
        if (!docs.length) {
            container.innerHTML = `<div class="page-title">Análise Avançada</div><div class="page-sub">Análise estatística e de conteúdo do seu cofre de pesquisa criptografado</div><div class="info-box">Envie documentos no Repositório para liberar análises.</div>`;
            return;
        }
        
        const topics = docs.map(d=>d.topic).filter(Boolean);
        const authors = docs.map(d=>d.author).filter(a=>a&&a!=='Desconhecido');
        const languages = docs.map(d=>d.language).filter(Boolean);
        const totalWords = docs.reduce((s,d)=>s+(d.readability?.words||0),0);
        const clarities = docs.map(d=>d.readability?.clarity||0).filter(Boolean);
        const avgClarity = clarities.length ? Math.round(clarities.reduce((a,b)=>a+b,0)/clarities.length*10)/10 : 0;
        const dominantTopic = TextEngine.safeTopValue(topics,'Pesquisa Geral');
        
        // Tamanho total dos textos em bytes
        let totalTextBytes = docs.reduce((s,d)=>s+((d.text||'').length * 2), 0);
        let cryptoDataSize = (totalTextBytes / 1024).toFixed(1);

        let html = `
            <div class="page-title">Análise Avançada</div>
            <div class="page-sub">Insights aprofundados sobre seu acervo de pesquisa</div>
            
            <div class="glass-outer mb-1">
                <div class="section-title"><span class="crypto-badge">AES-256-GCM Protegido</span> Central de Inteligência</div>
                <p class="small-muted mb-1" style="color:var(--text-white-80)">Seu cofre de pesquisa contém <b>${cryptoDataSize} KB</b> de textos extraídos, totalmente criptografados de ponta a ponta no seu dispositivo.</p>
                <div class="metric-grid">
                    <div class="metric-card"><div class="metric-label">Documentos</div><div class="metric-value">${docs.length}</div></div>
                    <div class="metric-card"><div class="metric-label">Temas únicos</div><div class="metric-value">${new Set(topics).size}</div></div>
                    <div class="metric-card"><div class="metric-label">Total palavras</div><div class="metric-value">${totalWords.toLocaleString()}</div></div>
                    <div class="metric-card"><div class="metric-label">Clareza média</div><div class="metric-value" style="color:var(--copper-1)">${avgClarity}/100</div></div>
                </div>
            </div>

            <div class="grid-2">
                <div class="glass"><div class="section-title">Distribuição por Tema</div><div id="chart-topics"></div></div>
                <div class="glass"><div class="section-title">Distribuição Temporal</div><div id="chart-years"></div></div>
            </div>

            <div class="grid-2">
                <div class="glass"><div class="section-title">Espectro de Legibilidade (Clareza)</div><div id="chart-readability"></div></div>
                <div class="glass"><div class="section-title">Volume por Autor</div><div id="chart-authors"></div></div>
            </div>

            <div class="glass"><div class="section-title">Nuvem de Palavras-Chave</div><div id="chart-keywords"></div></div>
        `;
        container.innerHTML = html;

        // Plotly charts
        const plotConfig = {responsive:true, displayModeBar:false};
        const plotLayout = (h) => ({
            height:h, paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)',
            font:{color:'#a0a0a0'}, margin:{l:40,r:20,t:20,b:40},
            xaxis:{gridcolor:'rgba(255,255,255,0.05)', zerolinecolor:'rgba(255,255,255,0.1)'},
            yaxis:{gridcolor:'rgba(255,255,255,0.05)', zerolinecolor:'rgba(255,255,255,0.1)'}
        });

        // Topics (Bar)
        const tc = TextEngine.counter(topics);
        if (tc.length) Plotly.newPlot('chart-topics',[{type:'bar',x:tc.map(e=>e[0]),y:tc.map(e=>e[1]),marker:{color:'#d9774a'}}],plotLayout(320),plotConfig);

        // Years (Line)
        const yc = TextEngine.counter(docs.map(d=>d.year).filter(Boolean).map(String)).sort((a,b)=>a[0]-b[0]);
        if (yc.length) Plotly.newPlot('chart-years',[{type:'scatter',mode:'lines+markers',x:yc.map(e=>e[0]),y:yc.map(e=>e[1]),line:{color:'#ffffff',width:3},marker:{color:'#d9774a',size:8}}],plotLayout(320),plotConfig);

        // Readability Histogram
        if (clarities.length) Plotly.newPlot('chart-readability',[{type:'histogram',x:clarities,marker:{color:'#a65132'},opacity:0.8}],plotLayout(320),plotConfig);

        // Authors (Horizontal Bar)
        const ac = TextEngine.counter(authors).slice(0,8);
        if (ac.length) Plotly.newPlot('chart-authors',[{type:'bar',y:ac.map(e=>e[0]),x:ac.map(e=>e[1]),orientation:'h',marker:{color:'#ffffff'}}],{...plotLayout(320),margin:{l:120,r:20,t:20,b:40}},plotConfig);

        // Keywords
        const allKW = []; docs.forEach(d=>(d.keywords||[]).forEach(k=>allKW.push(k)));
        const kwc = TextEngine.counter(allKW).slice(0,25);
        if (kwc.length) Plotly.newPlot('chart-keywords',[{type:'scatter',mode:'markers+text',x:kwc.map((_,i)=>i),y:kwc.map(e=>e[1]),text:kwc.map(e=>e[0]),textposition:'top center',marker:{size:kwc.map(e=>Math.max(e[1]*4, 8)),color:kwc.map(e=>e[1]),colorscale:'Reds'}}],{...plotLayout(360),xaxis:{showticklabels:false}},plotConfig);
    }
    return {render};
})();

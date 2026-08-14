/* PAGE: ANALYSIS */
const PageAnalysis = (() => {
    function render(container, state) {
        const docs = state.repository || [];
        const currentTab = state.analysis_tab || 'overview';
        const userObj = state.users[state.current_user] || {};
        const userName = userObj.name || state.current_user || 'Usuário';

        let headerHtml = `
            <div class="page-title">Análise & Ferramentas</div>

            <div class="tabs-bar" style="max-width: 720px; margin-bottom: 2rem;">
                <button class="tab-btn ${currentTab === 'overview' ? 'active' : ''}" id="tab-overview">Visão Geral do Acervo</button>
                <button class="tab-btn ${currentTab === 'autoral' ? 'active' : ''}" id="tab-autoral">Minha Produção (${userName.split(' ')[0]})</button>
                <button class="tab-btn ${currentTab === 'editor' ? 'active' : ''}" id="tab-editor">Editor de Texto</button>
                <button class="tab-btn ${currentTab === 'mindmap' ? 'active' : ''}" id="tab-mindmap">Mapa Mental</button>
            </div>
            
            <div id="analysis-content-area"></div>
        `;
        container.innerHTML = headerHtml;

        document.getElementById('tab-overview').addEventListener('click', () => { state.analysis_tab = 'overview'; render(container, state); });
        document.getElementById('tab-autoral').addEventListener('click', () => { state.analysis_tab = 'autoral'; render(container, state); });
        document.getElementById('tab-editor').addEventListener('click', () => { state.analysis_tab = 'editor'; render(container, state); });
        document.getElementById('tab-mindmap').addEventListener('click', () => { state.analysis_tab = 'mindmap'; render(container, state); });

        const contentArea = document.getElementById('analysis-content-area');

        if (currentTab === 'editor') {
            PageEditor.renderEditor(contentArea, state);
            return;
        } else if (currentTab === 'mindmap') {
            PageEditor.renderMindMap(contentArea, state);
            return;
        } else if (currentTab === 'autoral') {
            renderAutoralAnalysis(contentArea, state, userName);
            return;
        }
        
        // --- Render Overview ---
        renderOverviewAnalysis(contentArea, state, docs);
    }

    // ─── ABA MINHA PRODUÇÃO (ANÁLISE AUTORAL) ─────────────────────
    function renderAutoralAnalysis(contentArea, state, userName) {
        const docs = state.repository || [];
        const userCleanName = userName.toLowerCase().trim();

        // Filtrar apenas a produção ligada ao usuário (onde é autor ou marcado como autoral)
        const autoralDocs = docs.filter(d => {
            if (d.is_authorial || d.topic === 'Produção Autoral') return true;
            if (!d.author || d.author === 'Desconhecido') return false;
            const docAuthorLower = d.author.toLowerCase();
            return docAuthorLower.includes(userCleanName) || userCleanName.includes(docAuthorLower);
        });

        if (!autoralDocs.length) {
            contentArea.innerHTML = `
                <div class="glass-outer" style="padding:3rem; text-align:center;">
                    <div style="font-size:1.3rem; font-weight:700; color:var(--text-white); margin-bottom:0.75rem;">
                        Análise Autoral — ${userName}
                    </div>
                    <p class="small-muted" style="max-width:550px; margin: 0 auto 1.5rem auto;">
                        Você ainda não possui artigos marcados com seu nome como autor ou na pasta <b>"Produção Autoral"</b> no seu Repositório.
                    </p>
                    <button class="btn btn-primary" onclick="NebulaApp.navigate('Repositório')">
                        Ir ao Repositório e Enviar Meus Artigos
                    </button>
                </div>
            `;
            return;
        }

        const autoralTopics = autoralDocs.map(d => d.topic).filter(Boolean);
        const dominantTopic = TextEngine.safeTopValue(autoralTopics, 'Pesquisa Autoral');
        const totalTextBytes = autoralDocs.reduce((s,d)=>s+((d.text||'').length * 2), 0);
        const dataKb = (totalTextBytes / 1024).toFixed(1);

        let html = `
            <div class="glass-outer mb-1">
                <div class="section-title">Minha Produção Científica (Análise Autoral)</div>
                <p class="small-muted mb-1" style="color:var(--text-white-80)">
                    Diagnosticando <b>${autoralDocs.length} publicação(ões) autorais</b> de <b>${userName}</b> (${dataKb} KB).
                </p>
                <div class="metric-grid">
                    <div class="metric-card"><div class="metric-label">Tópico Dominante</div><div class="metric-value" style="font-size:1.5rem; color:var(--color-blue)">${dominantTopic}</div></div>
                    <div class="metric-card"><div class="metric-label">Artigos Autorais</div><div class="metric-value" style="color:#10b981;">${autoralDocs.length}</div></div>
                    <div class="metric-card"><div class="metric-label">Ano Mais Recente</div><div class="metric-value">${Math.max(...autoralDocs.map(d=>parseInt(d.year)||0)) || '2025'}</div></div>
                </div>
            </div>

            <div class="glass mb-1" id="autoral-ai-container">
                <div class="section-title">Avaliação Diagnóstica da Sua Produção (IA)</div>
                <p class="small-muted mb-1">O Llama 3.3 está sintetizando o perfil da sua escrita autoral...</p>
                <div style="text-align:center; padding: 2rem; color: var(--color-blue);">
                    <svg width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                        <circle cx="12" cy="12" r="10" stroke-dasharray="30" stroke-dashoffset="10"/>
                    </svg>
                </div>
            </div>

            <div class="grid-2">
                <div class="glass">
                    <div class="section-title">Lista das Suas Obras Autorais</div>
                    <div style="display:flex; flex-direction:column; gap:0.6rem; max-height:360px; overflow-y:auto; padding-right:0.4rem;">
                        ${autoralDocs.map(d => `
                            <div style="background:rgba(255,255,255,0.45); padding:0.8rem; border-radius:10px; border:1px solid rgba(0,0,0,0.06);">
                                <div style="font-weight:600; font-size:0.92rem; color:var(--text-white);">${d.name}</div>
                                <div style="font-size:0.8rem; color:var(--text-white-60); margin-top:0.2rem;">Autor: <b>${d.author || userName}</b> · ${d.year || ''}</div>
                                <div style="margin-top:0.4rem;"><span class="tag tag-copper">${d.topic || 'Autoral'}</span></div>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="glass">
                    <div class="section-title">Evolução Cronológica da Sua Produção</div>
                    <div id="chart-autoral-timeline"></div>
                </div>
            </div>
        `;
        contentArea.innerHTML = html;

        // IA Autoral
        const userResearch = (state.current_user && state.users[state.current_user]) ? state.users[state.current_user].research : '';
        NebulaAI.generateRepositoryReview(autoralDocs, userResearch).then(aiReview => {
            const aiCont = document.getElementById('autoral-ai-container');
            if (!aiCont) return;
            aiCont.innerHTML = `
                <div class="section-title">Avaliação Diagnóstica da Sua Produção (${userName})</div>
                <div class="grid-3" style="margin-top:1rem;">
                    <div style="background:rgba(16, 185, 129, 0.05); border:1px solid rgba(16, 185, 129, 0.2); padding:1rem; border-radius:12px;">
                        <div style="color:#10b981; font-weight:600; margin-bottom:0.5rem">Seus Pontos de Destaque</div>
                        <ul style="padding-left:1.2rem; font-size:0.85rem; color:var(--text-white-80)">
                            ${(aiReview?.strengths || ['Alta autoridade técnica no tema.']).map(s => `<li style="margin-bottom:0.4rem">${s}</li>`).join('')}
                        </ul>
                    </div>
                    <div style="background:rgba(59, 130, 246, 0.05); border:1px solid rgba(59, 130, 246, 0.2); padding:1rem; border-radius:12px;">
                        <div style="color:var(--color-blue); font-weight:600; margin-bottom:0.5rem">Foco de Impacto</div>
                        <ul style="padding-left:1.2rem; font-size:0.85rem; color:var(--text-white-80)">
                            ${(aiReview?.suggestions || ['Continue expandindo suas citações.']).map(s => `<li style="margin-bottom:0.4rem">${s}</li>`).join('')}
                        </ul>
                    </div>
                    <div style="background:rgba(234, 179, 8, 0.05); border:1px solid rgba(234, 179, 8, 0.2); padding:1rem; border-radius:12px;">
                        <div style="color:#eab308; font-weight:600; margin-bottom:0.5rem">Oportunidades de Publicação</div>
                        <ul style="padding-left:1.2rem; font-size:0.85rem; color:var(--text-white-80)">
                            <li style="margin-bottom:0.4rem">Submeter revisões sistemáticas sobre ${dominantTopic}</li>
                            <li style="margin-bottom:0.4rem">Expandir colaborações no Ecossistema 3D</li>
                        </ul>
                    </div>
                </div>
            `;
        });

        // Plotly Timeline
        const yearsCount = {};
        autoralDocs.forEach(d => {
            const y = d.year || '2025';
            yearsCount[y] = (yearsCount[y] || 0) + 1;
        });
        const sortedY = Object.keys(yearsCount).sort();
        if (sortedY.length) {
            Plotly.newPlot('chart-autoral-timeline', [{
                type: 'bar',
                x: sortedY,
                y: sortedY.map(y => yearsCount[y]),
                marker: { color: '#3b82f6' }
            }], {
                height: 320, paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
                font: { color: '#3a3d46' }, margin: { l: 30, r: 20, t: 20, b: 40 },
                xaxis: { gridcolor: 'rgba(0,0,0,0.06)' }, yaxis: { gridcolor: 'rgba(0,0,0,0.06)' }
            }, { responsive: true, displayModeBar: false });
        }
    }

    // ─── OVERVIEW VISÃO GERAL ──────────────────────────────────────
    function renderOverviewAnalysis(contentArea, state, docs) {
        if (!docs.length) {
            contentArea.innerHTML = `
                <div class="glass-outer" style="padding:3rem; text-align:center;">
                    <div style="font-size:1.2rem; font-weight:700; color:var(--text-white); margin-bottom:0.75rem;">
                        Nenhum Documento no Repositório
                    </div>
                    <p class="small-muted" style="max-width:500px; margin:0 auto 1.5rem auto;">
                        Envie artigos e documentos em PDF/DOCX no Repositório para o sistema gerar gráficos, mapa de saúde, recomendações e diagnósticos de IA.
                    </p>
                    <button class="btn btn-primary" onclick="NebulaApp.navigate('Repositório')">
                        Ir para o Repositório e Enviar Documentos
                    </button>
                </div>
            `;
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
            <div class="glass-outer mb-1">
                <div class="section-title">Resumo do Acervo Global</div>
                <p class="small-muted mb-1" style="color:var(--text-white-80)">Você possui <b>${docs.length} artigos</b> salvos (${cryptoDataSize} KB).</p>
                <div class="metric-grid">
                    <div class="metric-card"><div class="metric-label">Seu Foco Principal</div><div class="metric-value" style="font-size:1.6rem; color:var(--color-blue)">${dominantTopic}</div></div>
                    <div class="metric-card"><div class="metric-label">Total de Autores</div><div class="metric-value">${new Set(authors).size}</div></div>
                    <div class="metric-card"><div class="metric-label">Artigo com Maior Afinidade</div><div class="metric-value" style="font-size:1.2rem;">${(topHighlight.name || 'Desconhecido').slice(0, 40)}</div></div>
                </div>
            </div>

            <!-- ANÁLISE POR IA -->
            <div class="glass mb-1" id="raio-x-container">
                <div class="section-title">Análise por IA (Llama 3.3)</div>
                <p class="small-muted mb-1">Analisando o acervo...</p>
                <div style="text-align:center; padding: 2rem; color: var(--color-blue);">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                        <circle cx="12" cy="12" r="10" stroke-dasharray="30" stroke-dashoffset="10"/>
                    </svg>
                    <div style="margin-top:1rem;">Processando...</div>
                </div>
            </div>

            <div class="grid-2">
                <div class="glass">
                    <div class="section-title">Mapa Global de Pesquisa</div>
                    <p class="small-muted mb-1">Países mais citados ou origem dos artigos.</p>
                    <div id="chart-map"></div>
                </div>
                <div class="glass">
                    <div class="section-title">Evolução Temporal Descritiva</div>
                    <p class="small-muted mb-1">Linha do tempo cronológica das publicações.</p>
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
                    <p class="small-muted mb-1">A frequência de temas no seu acervo.</p>
                    <div id="chart-topics"></div>
                </div>
            </div>
            
            <div class="glass">
                <div class="section-title">Recomendações da IA</div>
                <p class="small-muted mb-1">Artigos sugeridos com base no seu repositório.</p>
                <div id="ml-highlights" style="display:flex; flex-direction:column; gap:1rem; padding: 1rem 0;">
                    <div class="spinner-overlay" style="position:relative; min-height:40px; background:transparent;"><div class="spinner"></div></div>
                </div>
            </div>
        `;
        contentArea.innerHTML = html;

        const userResearch = (state.current_user && state.users[state.current_user]) ? state.users[state.current_user].research : null;

        NebulaAI.generateRepositoryReview(docs, userResearch).then(aiReview => {
            const rxContainer = document.getElementById('raio-x-container');
            if (!rxContainer) return;

            if (!aiReview) {
                aiReview = { strengths: ['Acervo seguro.'], weaknesses: ['Falta diversidade.'], suggestions: ['Adicione mais PDFs.'] };
            }

        rxContainer.innerHTML = `
                <div class="section-title">Análise por IA (Llama 3.3)</div>
                <p class="small-muted mb-1">Avaliação do acervo e da sua pesquisa atual.</p>
                <div class="grid-3" style="margin-bottom:1.5rem;">
                    <div style="background:rgba(16, 185, 129, 0.05); border:1px solid rgba(16, 185, 129, 0.2); padding:1rem; border-radius:12px;">
                        <div style="color:#10b981; font-weight:600; margin-bottom:0.5rem">Pontos Fortes</div>
                        <ul style="padding-left:1.2rem; font-size:0.85rem; color:var(--text-white-80)">
                            ${aiReview.strengths.map(s => `<li style="margin-bottom:0.4rem">${s}</li>`).join('')}
                        </ul>
                    </div>
                    <div style="background:rgba(239, 68, 68, 0.05); border:1px solid rgba(239, 68, 68, 0.2); padding:1rem; border-radius:12px;">
                        <div style="color:#fca5a5; font-weight:600; margin-bottom:0.5rem">Lacunas e Pontos Fracos</div>
                        <ul style="padding-left:1.2rem; font-size:0.85rem; color:var(--text-white-80)">
                            ${aiReview.weaknesses.map(w => `<li style="margin-bottom:0.4rem">${w}</li>`).join('')}
                        </ul>
                    </div>
                    <div style="background:var(--copper-glow); border:1px solid rgba(59, 130, 246, 0.3); padding:1rem; border-radius:12px;">
                        <div style="color:var(--color-blue); font-weight:600; margin-bottom:0.5rem">Recomendações Estratégicas</div>
                        <ul style="padding-left:1.2rem; font-size:0.85rem; color:var(--text-white-80)">
                            ${aiReview.suggestions.map(s => `<li style="margin-bottom:0.4rem">${s}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                ${aiReview.deep_insight ? `
                <div style="border-top:1px solid rgba(0,0,0,0.08); padding-top:1.2rem; margin-top:0.5rem;">
                    <div style="color:var(--color-blue); font-weight:700; font-size:0.95rem; margin-bottom:0.8rem; display:flex; align-items:center; gap:0.5rem;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                        Ensaio Analítico Aprofundado (Nível Pós-Doutorado)
                    </div>
                    <div style="font-size:0.88rem; line-height:1.75; color:var(--text-white-80); white-space:pre-line; text-align:justify; max-height:500px; overflow-y:auto; padding-right:0.5rem;">${aiReview.deep_insight}</div>
                </div>` : ''}
            `;
        });

        // AI Highlights — recomendações profundas e personalizadas
        const hlContainer = document.getElementById('ml-highlights');
        const allKeywords = [...new Set(docs.flatMap(d => Array.isArray(d.keywords) ? d.keywords : []))].slice(0, 20);
        const allAuthors = [...new Set(docs.map(d => d.author).filter(a => a && a !== 'Desconhecido'))].slice(0, 10);
        const allMethodologies = [...new Set(docs.map(d => d.methodology).filter(Boolean))].slice(0, 8);
        const allYears = docs.map(d => d.year).filter(Boolean);
        const mostRecentYear = allYears.length ? Math.max(...allYears.map(Number).filter(n => !isNaN(n))) : new Date().getFullYear();

        const aiPrompt = [
            { role: 'system', content: `Você é um Curador Bibliográfico Especialista e Professor Pesquisador com amplo conhecimento da literatura acadêmica internacional. Sua missão é recomendar obras acadêmicas REAIS e ESPECÍFICAS que o pesquisador ainda não possui no acervo.

REGRAS:
- Recomende EXATAMENTE 5 obras reais (artigos, livros ou capítulos de livros) que realmente existem
- Cada recomendação deve ter: título real, autor(es) real(is), ano aproximado, tipo (artigo/livro/capítulo), justificativa específica de por que complementa a pesquisa do usuário
- Justifique em termos do que está FALTANDO no acervo atual
- Priorize obras dos últimos 5 anos (a partir de ${mostRecentYear - 5})
- Retorne em HTML bem formatado com tags <div>, <h4>, <p>, <b>, <span> — sem markdown, sem bullet points simples
- Inclua para cada obra uma seção "Por que adicionar" com explicação de mínimo 2 frases sobre o impacto desta obra na linha de pesquisa` },
            { role: 'user', content: `LINHA DE PESQUISA: "${userResearch || 'Pesquisa acadêmica geral'}"
TÓPICOS JÁ PRESENTES NO ACERVO: ${Array.from(new Set(topics)).join(', ')}
PALAVRAS-CHAVE DO ACERVO: ${allKeywords.join(', ')}
AUTORES JÁ LIDOS: ${allAuthors.join(', ')}
METODOLOGIAS PRESENTES: ${allMethodologies.join(', ')}
ANO MAIS RECENTE DO ACERVO: ${mostRecentYear}
TOTAL DE DOCUMENTOS: ${docs.length}

Com base nesses dados, recomende 5 obras REAIS e ESPECÍFICAS que estão FALTANDO para fortalecer esta linha de pesquisa. Para cada obra, explique detalhadamente por que ela é essencial.` }
        ];
        NebulaAI.chatWithAI(aiPrompt).then(res => {
            if (hlContainer) {
                let cleanRes = res.replace(/^```(?:html)?\s*/i, '').replace(/\s*```$/i, '');
                hlContainer.innerHTML = `<div style="font-size:0.9rem; line-height:1.7; color:var(--text-white-80);">${cleanRes}</div>`;
            }
        }).catch(() => {
            if (hlContainer) hlContainer.innerHTML = `<div class="small-muted">Recomendações prontas no Ecossistema 3D.</div>`;
        });

        // Timeline
        const tlContainer = document.getElementById('timeline-container');
        const docsByYear = {};
        docs.forEach(d => {
            if (d.year) {
                if (!docsByYear[d.year]) docsByYear[d.year] = [];
                docsByYear[d.year].push(d);
            }
        });
        const sortedYears = Object.keys(docsByYear).sort((a,b) => b - a);
        if (sortedYears.length === 0) {
            tlContainer.innerHTML = `<div class="small-muted">Nenhum dado de ano disponível nos artigos.</div>`;
        } else {
            let tlHtml = `<div style="border-left: 2px solid rgba(0,0,0,0.08); padding-left: 1rem; margin-left: 0.5rem;">`;
            sortedYears.forEach(year => {
                tlHtml += `<div style="position:relative; margin-bottom: 1.5rem;">
                    <div style="position:absolute; left:-1.4rem; top:0; width:10px; height:10px; border-radius:50%; background:var(--color-blue);"></div>
                    <div style="font-weight:bold; font-size:1.1rem; color:var(--text-white); margin-bottom:0.5rem;">${year}</div>`;
                docsByYear[year].forEach(d => {
                    tlHtml += `
                        <div style="background:rgba(255,255,255,0.5); padding:0.8rem; border-radius:8px; border:1px solid rgba(0,0,0,0.06); margin-bottom:0.5rem;">
                            <div style="font-size:0.9rem; font-weight:500;">${d.name}</div>
                            <div style="margin-top:0.4rem;"><span class="tag tag-copper">${d.topic}</span></div>
                        </div>`;
                });
                tlHtml += `</div>`;
            });
            tlHtml += `</div>`;
            tlContainer.innerHTML = tlHtml;
        }

        const plotConfig = {responsive:true, displayModeBar:false};
        const plotLayout = (h) => ({
            height:h, paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)',
            font:{color:'#3a3d46'}, margin:{l:40,r:20,t:20,b:40},
            xaxis:{gridcolor:'rgba(0,0,0,0.06)'}, yaxis:{gridcolor:'rgba(0,0,0,0.06)'}
        });

        // World Map
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
        if (Object.keys(isoCountryCounts).length) {
            Plotly.newPlot('chart-map', [{
                type: 'choropleth', locationmode: 'ISO-3',
                locations: Object.keys(isoCountryCounts), z: Object.values(isoCountryCounts),
                colorscale: [ [0, 'rgba(59, 130, 246, 0.2)'], [1, '#3b82f6'] ], showscale: false
            }], {
                height: 350, margin: {l:0, r:0, t:0, b:0}, paper_bgcolor:'rgba(0,0,0,0)', plot_bgcolor:'rgba(0,0,0,0)',
                geo: { showframe: false, showcoastlines: true, bgcolor: 'rgba(0,0,0,0)', showland: true, landcolor: 'rgba(220,215,200,0.5)' }
            }, plotConfig);
        } else {
            document.getElementById('chart-map').innerHTML = `<div class="small-muted" style="padding:2rem;text-align:center">Envie mais documentos para o mapa.</div>`;
        }

        // Radar Chart
        const radarMetrics = [
            Math.min(new Set(topics).size * 20, 100),
            Math.min((docs.filter(d=>d.year && d.year > 2018).length / docs.length) * 150, 100) || 50,
            Math.min(new Set(authors).size * 15, 100),
            Math.min((totalTextBytes / docs.length) / 5000 * 100, 100) || 50,
            Math.min(new Set(docs.map(d=>d.language)).size * 30, 100) || 30
        ];
        Plotly.newPlot('chart-radar', [{
            type: 'scatterpolar', r: radarMetrics,
            theta: ['Temas', 'Atualidade', 'Autores', 'Profundidade', 'Idiomas'],
            fill: 'toself', fillcolor: 'rgba(59, 130, 246, 0.15)', line: { color: '#3b82f6' }
        }], {
            polar: { radialaxis: { visible: true, range: [0, 100] }, bgcolor: 'transparent' },
            height: 350, margin: {l:40, r:40, t:20, b:20}, paper_bgcolor:'transparent'
        }, plotConfig);

        // Topics
        const tc = TextEngine.counter(topics).slice(0,6);
        if (tc.length) {
            Plotly.newPlot('chart-topics',[{
                type:'bar', y:tc.map(e=>e[0]), x:tc.map(e=>e[1]), orientation:'h',
                marker:{color:'rgba(59, 130, 246, 0.6)'}
            }], {...plotLayout(350), margin:{l:140,r:20,t:20,b:40}}, plotConfig);
        }
    }

    return { render };
})();

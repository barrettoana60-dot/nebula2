/* ============================================================
   STORAGE ENGINE — SUPABASE INTEGRATION
   ============================================================ */
const NebulaStorage = (() => {

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function blankWorkspace() {
        return { repository: [], search_history: [] };
    }

    function initState() {
        let parsed = {
            users: {},
            workspaces: {},
            user_interest: {},
            community_messages: [],
            logged_in: false,
            current_user: null,
            page: 'Tela Principal',
            repository: [],
            search_history: [],
        };
        try {
            const saved = localStorage.getItem('nebula_db_v5');
            if (saved) {
                const s = JSON.parse(saved);
                parsed = { ...parsed, ...s };
                parsed.logged_in = false;
                parsed.current_user = null;
                parsed.repository = [];
                parsed.search_history = [];
            }
        } catch (e) {
            console.error("Local load fail", e);
        }

        // Seed demo community researchers if community is too small
        seedCommunityResearchers(parsed);

        return parsed;
    }

    function seedCommunityResearchers(state) {
        const demoResearchers = [
            {
                email: 'demo_maria@nebula.edu',
                name: 'Maria Oliveira',
                research: 'Inteligência Artificial aplicada à saúde pública, redes neurais convolucionais e aprendizado profundo para diagnóstico médico',
                topics: ['Inteligência Artificial', 'Saúde Pública', 'Deep Learning', 'Redes Neurais', 'Diagnóstico Médico'],
                docs: [
                    { id: 'demo_m1', name: 'Redes Neurais para Detecção de Patologias.pdf', kind: 'PDF', topic: 'Inteligência Artificial', summary: 'Estudo sobre CNNs para detecção automática de doenças pulmonares em imagens de raio-X.', keywords: ['redes neurais', 'inteligência artificial', 'deep learning', 'CNN', 'diagnóstico', 'saúde', 'radiologia', 'patologia'], author: 'Maria Oliveira', year: 2024, language: 'Português', ai_analyzed: true },
                    { id: 'demo_m2', name: 'Machine Learning na Epidemiologia.pdf', kind: 'PDF', topic: 'Saúde Pública', summary: 'Aplicação de algoritmos de machine learning para predição de surtos epidemiológicos.', keywords: ['machine learning', 'epidemiologia', 'saúde pública', 'predição', 'dados', 'algoritmos', 'inteligência artificial'], author: 'Maria Oliveira', year: 2025, language: 'Português', ai_analyzed: true },
                ]
            },
            {
                email: 'demo_carlos@nebula.edu',
                name: 'Carlos Mendes',
                research: 'Processamento de Linguagem Natural, análise semântica de textos jurídicos, NLP com transformers e BERT para documentos legais',
                topics: ['NLP', 'Análise Semântica', 'Direito Digital', 'Transformers', 'Linguística Computacional'],
                docs: [
                    { id: 'demo_c1', name: 'BERT para Classificação Jurídica.pdf', kind: 'PDF', topic: 'NLP', summary: 'Uso de modelos BERT para classificação automática de petições jurídicas.', keywords: ['NLP', 'BERT', 'transformers', 'classificação', 'direito', 'jurídico', 'linguagem natural', 'inteligência artificial'], author: 'Carlos Mendes', year: 2025, language: 'Português', ai_analyzed: true },
                    { id: 'demo_c2', name: 'Análise Semântica de Jurisprudência.pdf', kind: 'PDF', topic: 'Análise Semântica', summary: 'Framework para análise semântica automatizada de decisões judiciais utilizando word embeddings.', keywords: ['semântica', 'jurisprudência', 'embeddings', 'análise textual', 'NLP', 'direito', 'linguística'], author: 'Carlos Mendes', year: 2024, language: 'Português', ai_analyzed: true },
                ]
            },
            {
                email: 'demo_ana@nebula.edu',
                name: 'Ana Souza',
                research: 'Ciência de Dados aplicada à educação, mineração de dados educacionais, learning analytics e avaliação de desempenho estudantil',
                topics: ['Ciência de Dados', 'Educação', 'Learning Analytics', 'Mineração de Dados', 'Avaliação Educacional'],
                docs: [
                    { id: 'demo_a1', name: 'Learning Analytics em Universidades.pdf', kind: 'PDF', topic: 'Ciência de Dados', summary: 'Estudo sobre o uso de learning analytics para prever evasão universitária em instituições brasileiras.', keywords: ['learning analytics', 'ciência de dados', 'educação', 'evasão', 'universidade', 'mineração', 'dados educacionais', 'machine learning'], author: 'Ana Souza', year: 2025, language: 'Português', ai_analyzed: true },
                    { id: 'demo_a2', name: 'Mineração de Dados em Avaliações.pdf', kind: 'PDF', topic: 'Educação', summary: 'Aplicação de técnicas de data mining para análise de padrões em avaliações educacionais.', keywords: ['mineração de dados', 'avaliação', 'educação', 'data mining', 'padrões', 'desempenho', 'estatística'], author: 'Ana Souza', year: 2024, language: 'Português', ai_analyzed: true },
                ]
            },
            {
                email: 'demo_rafael@nebula.edu',
                name: 'Rafael Costa',
                research: 'Visão Computacional, reconhecimento de padrões, detecção de objetos com YOLO e redes neurais aplicadas a imagens de satélite',
                topics: ['Visão Computacional', 'Reconhecimento de Padrões', 'Detecção de Objetos', 'Imagens de Satélite', 'YOLO'],
                docs: [
                    { id: 'demo_r1', name: 'YOLO para Monitoramento Ambiental.pdf', kind: 'PDF', topic: 'Visão Computacional', summary: 'Aplicação de YOLOv8 para detecção de desmatamento em imagens de satélite da Amazônia.', keywords: ['YOLO', 'visão computacional', 'satélite', 'desmatamento', 'amazônia', 'detecção', 'deep learning', 'redes neurais', 'inteligência artificial'], author: 'Rafael Costa', year: 2025, language: 'Português', ai_analyzed: true },
                    { id: 'demo_r2', name: 'Reconhecimento Facial com Deep Learning.pdf', kind: 'PDF', topic: 'Reconhecimento de Padrões', summary: 'Comparação de arquiteturas de redes neurais para reconhecimento facial em ambientes urbanos.', keywords: ['reconhecimento facial', 'deep learning', 'CNN', 'redes neurais', 'biometria', 'visão computacional', 'inteligência artificial'], author: 'Rafael Costa', year: 2024, language: 'Português', ai_analyzed: true },
                ]
            },
            {
                email: 'demo_lucia@nebula.edu',
                name: 'Lúcia Ferreira',
                research: 'Blockchain e segurança da informação, criptografia aplicada, smart contracts e governança digital descentralizada',
                topics: ['Blockchain', 'Segurança da Informação', 'Criptografia', 'Smart Contracts', 'Governança Digital'],
                docs: [
                    { id: 'demo_l1', name: 'Smart Contracts na Administração Pública.pdf', kind: 'PDF', topic: 'Blockchain', summary: 'Proposta de framework baseado em blockchain para transparência em licitações públicas.', keywords: ['blockchain', 'smart contracts', 'administração pública', 'transparência', 'licitação', 'governança', 'descentralização'], author: 'Lúcia Ferreira', year: 2025, language: 'Português', ai_analyzed: true },
                ]
            },
        ];

        const realUserCount = Object.keys(state.users).filter(e => !e.startsWith('demo_')).length;

        demoResearchers.forEach(r => {
            if (!state.users[r.email]) {
                state.users[r.email] = { name: r.name, research: r.research, pass: '__demo__', tutorial_completed: 'v3' };
                state.workspaces[r.email] = { repository: r.docs, search_history: [] };
                state.user_interest[r.email] = {};
                r.docs.forEach(doc => {
                    (doc.keywords || []).forEach(kw => {
                        state.user_interest[r.email][kw] = (state.user_interest[r.email][kw] || 0) + 1;
                    });
                });
            }
        });

        console.log(`[Storage] Community seeded. Total users: ${Object.keys(state.users).length}`);
    }


    async function setEncryptionKey(password) {}

    async function syncWorkspaceStateAsync(state, email) {
        if (!email) {
            state.repository = [];
            state.search_history = [];
            return;
        }

        // Pull from Supabase
        if (window.NebulaSupabase) {
            try {
                // Fetch profiles (for community)
                const { data: profiles } = await window.NebulaSupabase.from('profiles').select('*');
                if (profiles) {
                    state.users = {};
                    state.user_interest = {};
                    profiles.forEach(p => {
                        state.users[p.email] = {
                            name: p.name,
                            research: p.research,
                            pass: p.pass,
                            tutorial_completed: p.tutorial_completed
                        };
                        state.user_interest[p.email] = p.interest || {};
                    });
                }

                // Fetch workspace
                const { data: wsData } = await window.NebulaSupabase.from('workspaces').select('*').eq('email', email).single();
                if (wsData) {
                    state.workspaces[email] = {
                        repository: wsData.repository || [],
                        search_history: wsData.search_history || []
                    };
                } else {
                    state.workspaces[email] = blankWorkspace();
                }
            } catch (err) {
                console.error("Supabase sync failed, using local cache:", err);
            }
        }

        const ws = state.workspaces[email] || blankWorkspace();
        state.repository = JSON.parse(JSON.stringify(ws.repository || []));
        state.search_history = [...(ws.search_history || [])];
    }

    function syncWorkspaceState(state, email) {
        if (!email) {
            state.repository = [];
            state.search_history = [];
            return;
        }
        const ws = state.workspaces[email] || blankWorkspace();
        state.repository = JSON.parse(JSON.stringify(ws.repository || []));
        state.search_history = [...(ws.search_history || [])];

        // Ensure user interest is built if missing
        if (!state.user_interest[email] || Object.keys(state.user_interest[email]).length === 0) {
            rebuildInterests(state, email);
        }
    }

    function rebuildInterests(state, email) {
        const docs = (state.workspaces[email] || {}).repository || [];
        if (!docs.length) return;
        
        state.user_interest[email] = {};
        docs.forEach(doc => {
            (doc.keywords || []).slice(0, 10).forEach(kw => {
                state.user_interest[email][kw] = (state.user_interest[email][kw] || 0) + 1;
            });
        });
        console.log(`[Storage] Interests rebuilt for ${email} from ${docs.length} docs.`);
    }

    function saveState(state) {
        try {
            if (state.current_user) {
                const email = state.current_user;
                if (!state.workspaces) state.workspaces = {};
                if (!state.workspaces[email]) state.workspaces[email] = blankWorkspace();

                const repoToSave = (state.repository || []).map(doc => {
                    const clone = { ...doc };
                    if (clone.text && clone.text.length > 2000) {
                        clone.text = clone.text.slice(0, 2000);
                    }
                    return clone;
                });

                state.workspaces[email].repository = repoToSave;
                state.workspaces[email].search_history = [...(state.search_history || [])];
            }

            const toSave = {};
            for (const key of Object.keys(state)) {
                if (key === 'repository' || key === 'search_history') continue;
                toSave[key] = state[key];
            }
            localStorage.setItem('nebula_db_v5', JSON.stringify(toSave));
            console.log('[Storage] Local cache saved');

        } catch (e) {
            console.error('[Storage] Local Save failed:', e);
        }
    }

    async function saveStateAsync(state) {
        saveState(state); // save locally first
        
        if (state.current_user && window.NebulaSupabase) {
            const email = state.current_user;
            const user = state.users[email];
            if (!user) return;
            
            try {
                // Upsert Profile
                await window.NebulaSupabase.from('profiles').upsert({
                    email: email,
                    name: user.name,
                    research: user.research,
                    pass: user.pass,
                    tutorial_completed: user.tutorial_completed || false,
                    interest: state.user_interest[email] || {}
                });

                // Upsert Workspace
                const ws = state.workspaces[email] || blankWorkspace();
                await window.NebulaSupabase.from('workspaces').upsert({
                    email: email,
                    repository: ws.repository || [],
                    search_history: ws.search_history || []
                });
                
                console.log("[Supabase] Data synced to cloud.");
            } catch (err) {
                console.error("[Supabase] Sync failed:", err);
            }
        }
    }

    return {
        setEncryptionKey,
        encryptText: async (t) => t,
        decryptText: async (t) => t,
        generateUUID,
        blankWorkspace,
        initState,
        saveState,
        saveStateAsync,
        syncWorkspaceState,
        syncWorkspaceStateAsync,
        rebuildInterests
    };
})();

-- ============================================================
-- SQL DE CONFIGURAÇÃO PARA O SUPABASE - NEBULA RESEARCH
-- ============================================================
-- Copie e cole este código no "SQL Editor" do seu painel do Supabase
-- e clique em "Run" (Executar) para criar as tabelas necessárias.

-- 1. Cria a tabela de Perfis de Usuário
CREATE TABLE IF NOT EXISTS public.profiles (
    email TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    research TEXT,
    pass TEXT NOT NULL,
    tutorial_completed TEXT,
    photo TEXT,
    interest JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS photo TEXT;


-- 2. Cria a tabela de Workspaces (onde ficam os Repositórios/PDFs e Histórico)
CREATE TABLE IF NOT EXISTS public.workspaces (
    email TEXT PRIMARY KEY REFERENCES public.profiles(email) ON DELETE CASCADE,
    repository JSONB DEFAULT '[]'::jsonb,
    search_history JSONB DEFAULT '[]'::jsonb,
    inbox JSONB DEFAULT '[]'::jsonb
);

-- Se a tabela já existia, adicione a coluna inbox (ignore o erro se já existir)
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS inbox JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS messages JSONB DEFAULT '[]'::jsonb;

-- 3. Configurações de Segurança (Row Level Security)
-- Como este é um protótipo com login manual, vamos habilitar RLS mas 
-- criar políticas permissivas para o frontend conseguir gravar os dados via Anon Key.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Permite Leitura para todos
CREATE POLICY "Allow public read on profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public read on workspaces" ON public.workspaces FOR SELECT USING (true);

-- Permite Inserção (Insert) para todos (necessário para criar conta)
CREATE POLICY "Allow public insert on profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public insert on workspaces" ON public.workspaces FOR INSERT WITH CHECK (true);

-- Permite Atualização (Update) para todos
CREATE POLICY "Allow public update on profiles" ON public.profiles FOR UPDATE USING (true);
CREATE POLICY "Allow public update on workspaces" ON public.workspaces FOR UPDATE USING (true);

-- Permite Exclusão (Delete) para todos
CREATE POLICY "Allow public delete on profiles" ON public.profiles FOR DELETE USING (true);
CREATE POLICY "Allow public delete on workspaces" ON public.workspaces FOR DELETE USING (true);

-- 4. Otimizações de performance (Índices)
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_workspaces_email ON public.workspaces(email);

-- 5. Tabela de Mensagens da Comunidade (Chat em tempo real entre usuários)
CREATE TABLE IF NOT EXISTS public.community_messages (
    id BIGSERIAL PRIMARY KEY,
    room_id TEXT NOT NULL,
    room_label TEXT,
    sender_email TEXT NOT NULL,
    sender_name TEXT,
    sender_topic TEXT,
    text TEXT NOT NULL,
    timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on community_messages" ON public.community_messages FOR SELECT USING (true);
CREATE POLICY "Allow public insert on community_messages" ON public.community_messages FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_community_messages_room ON public.community_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_community_messages_ts ON public.community_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_community_messages_sender ON public.community_messages(sender_email);

-- 6. Analytics de uso (tempo na plataforma e por seção)
CREATE TABLE IF NOT EXISTS public.user_analytics (
    email TEXT PRIMARY KEY REFERENCES public.profiles(email) ON DELETE CASCADE,
    total_seconds BIGINT DEFAULT 0,
    section_times JSONB DEFAULT '{}'::jsonb,
    sessions JSONB DEFAULT '[]'::jsonb,
    last_seen TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on user_analytics" ON public.user_analytics FOR SELECT USING (true);
CREATE POLICY "Allow public insert on user_analytics" ON public.user_analytics FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on user_analytics" ON public.user_analytics FOR UPDATE USING (true);
CREATE INDEX IF NOT EXISTS idx_user_analytics_last_seen ON public.user_analytics(last_seen);

-- 7. Configurações globais do app (ex.: chave Groq para IA Llama)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read on app_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Allow public upsert on app_settings" ON public.app_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on app_settings" ON public.app_settings FOR UPDATE USING (true);

-- Insira sua chave Groq aqui (substitua YOUR_GROQ_KEY):
-- INSERT INTO public.app_settings (key, value) VALUES ('groq_api_key', 'YOUR_GROQ_KEY')
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

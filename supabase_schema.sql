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
    interest JSONB DEFAULT '{}'::jsonb
);

-- 2. Cria a tabela de Workspaces (onde ficam os Repositórios/PDFs e Histórico)
CREATE TABLE IF NOT EXISTS public.workspaces (
    email TEXT PRIMARY KEY REFERENCES public.profiles(email) ON DELETE CASCADE,
    repository JSONB DEFAULT '[]'::jsonb,
    search_history JSONB DEFAULT '[]'::jsonb
);

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

-- 4. Otimizações de performance (Índices)
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_workspaces_email ON public.workspaces(email);

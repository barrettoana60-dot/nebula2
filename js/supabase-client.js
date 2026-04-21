/* ============================================================
   SUPABASE CLIENT CONFIGURATION
   ============================================================ */

const supabaseUrl = 'https://clrawgyoavelglbitceu.supabase.co';
const supabaseKey = 'sb_publishable_JCkaBGt6kZXZWQ46U55XVw_AZ6kyfJ_';

// A biblioteca do Supabase será injetada globalmente via CDN no index.html
// O objeto window.supabase estará disponível.

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Objeto global para facilitar o acesso
window.NebulaSupabase = supabase;

/* ============================================================
   SUPABASE CLIENT CONFIGURATION
   ============================================================ */

const supabaseUrl = 'https://vmejdjpmvvhvjkzrxywj.supabase.co';
const supabaseKey = 'sb_publishable_sAQwOOdTsgWsdp7v55dmBw_8DEEe0t_';

// A biblioteca do Supabase será injetada globalmente via CDN no index.html
// O objeto window.supabase estará disponível.

const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Objeto global para facilitar o acesso
window.NebulaSupabase = supabase;

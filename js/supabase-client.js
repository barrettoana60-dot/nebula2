/* ============================================================
   SUPABASE CLIENT CONFIGURATION
   ============================================================ */

const supabaseUrl = 'https://vmejdjpmvvhvjkzrxywj.supabase.co';
const supabaseKey = 'sb_publishable_sAQwOOdTsgWsdp7v55dmBw_8DEEe0t_';

// A biblioteca do Supabase será injetada globalmente via CDN no index.html
// Objeto global para facilitar o acesso
window.NebulaSupabase = null;

try {
    if (window.supabase) {
        window.NebulaSupabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        console.log("Supabase client initialized.");
    } else {
        console.error("Supabase script not loaded from CDN.");
    }
} catch (e) {
    console.error("Error initializing Supabase:", e);
}

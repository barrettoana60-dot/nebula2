/* ============================================================
   SUPABASE CLIENT CONFIGURATION
   ============================================================ */
const supabaseUrl = 'https://jfpygtuihrljjlvljndj.supabase.co';
const supabaseKey = 'sb_publishable_Bjnw8owLe0S2xhFR9euTng_O_MhjjKM';

// Global Supabase Client
window.NebulaSupabase = null;

document.addEventListener("DOMContentLoaded", () => {
    if (window.supabase) {
        window.NebulaSupabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        console.log("[Supabase] Client initialized successfully.");
    } else {
        console.error("[Supabase] Fatal error: Supabase script not loaded from CDN.");
    }
});

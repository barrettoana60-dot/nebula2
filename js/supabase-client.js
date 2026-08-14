/* ============================================================
   SUPABASE CLIENT CONFIGURATION (Safe Fail-Fast Client)
   ============================================================ */
const supabaseUrl = 'https://jfpygtuihrljjlvljndj.supabase.co';
const supabaseKey = 'sb_publishable_Bjnw8owLe0S2xhFR9euTng_O_MhjjKM';

window.NebulaSupabaseConfig = { url: supabaseUrl, key: supabaseKey };
window.NebulaSupabase = null;

function initSupabaseClient() {
    if (window.supabase && !window.NebulaSupabase) {
        try {
            window.NebulaSupabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
                auth: { persistSession: false },
                global: { fetch: (url, options) => {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 20000);
                    return fetch(url, { ...options, signal: controller.signal })
                        .finally(() => clearTimeout(timeout));
                }}
            });
            console.log("[Supabase] Cliente inicializado (timeout 20s).");
        } catch (e) {
            console.warn("[Supabase] Supabase indisponível:", e);
        }
    }
}

initSupabaseClient();
document.addEventListener("DOMContentLoaded", initSupabaseClient);

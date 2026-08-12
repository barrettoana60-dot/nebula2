/* ============================================================
   SUPABASE CLIENT CONFIGURATION (Safe Fail-Fast Client)
   ============================================================ */
const supabaseUrl = 'https://jfpygtuihrljjlvljndj.supabase.co';
const supabaseKey = 'sb_publishable_Bjnw8owLe0S2xhFR9euTng_O_MhjjKM';

window.NebulaSupabase = null;

function initSupabaseClient() {
    if (window.supabase && !window.NebulaSupabase) {
        try {
            // Usa o cliente Supabase apenas se houver resposta válida
            window.NebulaSupabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
                auth: { persistSession: false },
                global: { fetch: (url, options) => {
                    const controller = new AbortController();
                    const timeout = setTimeout(() => controller.abort(), 1800); // Fail fast em 1.8s para não travar a UI
                    return fetch(url, { ...options, signal: controller.signal })
                        .finally(() => clearTimeout(timeout));
                }}
            });
            console.log("[Supabase] Cliente seguro inicializado com timeout inteligente.");
        } catch (e) {
            console.warn("[Supabase] Supabase indisponível, usando modo nativo Vercel/Local:", e);
        }
    }
}

initSupabaseClient();
document.addEventListener("DOMContentLoaded", initSupabaseClient);

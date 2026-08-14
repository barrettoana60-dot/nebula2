/* ============================================================
   COOKIES CONSENT & MANAGEMENT
   ============================================================ */
const NebulaCookies = (() => {
    let consentState = {
        essential: true, // Sempre verdadeiro
        analytics: false,
        marketing: false
    };

    function init() {
        const saved = localStorage.getItem('nebula_cookie_consent');
        if (saved) {
            consentState = JSON.parse(saved);
            applyConsent();
        } else {
            showBanner();
        }
    }

    function showBanner() {
        if (document.getElementById('cookie-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'cookie-banner';
        banner.innerHTML = `
            <div class="cookie-content" style="flex-direction: row; justify-content: flex-start; gap: 1rem; align-items: center; background: rgba(218, 200, 179, 0.95); padding: 0.5rem 1rem; border-radius: 4px;">
                <div style="display: flex; gap: 0.5rem; flex-shrink: 0;">
                    <button id="btn-accept-cookies" style="background: #f97316; color: #fff; border: none; padding: 0.6rem 1rem; border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 0.9rem;">Aceitar e Fechar</button>
                    <button id="btn-manage-cookies" style="background: transparent; color: var(--text-white); border: 1px solid rgba(0,0,0,0.15); padding: 0.6rem 1rem; border-radius: 4px; font-weight: 500; cursor: pointer; font-size: 0.9rem;">Gerenciar</button>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-white-80); line-height: 1.4;">
                    Este site usa cookies para melhorar sua experiência. Ao clicar em "Aceitar e Fechar" você concorda com o uso dos cookies, termos e políticas do site. <a href="#" onclick="NebulaCookies.forceManage(); return false;" style="color: #f97316; font-weight: 600; text-decoration: none;">Leia mais</a>
                </div>
            </div>
        `;
        document.body.appendChild(banner);

        // Entrada suave
        setTimeout(() => banner.classList.add('show'), 100);

        document.getElementById('btn-accept-cookies').addEventListener('click', () => {
            consentState.analytics = true;
            consentState.marketing = true;
            saveConsent();
            closeBanner();
        });

        document.getElementById('btn-manage-cookies').addEventListener('click', () => {
            showManageModal();
        });
    }

    function closeBanner() {
        const banner = document.getElementById('cookie-banner');
        if (banner) {
            banner.classList.remove('show');
            setTimeout(() => banner.remove(), 400);
        }
    }

    function showManageModal() {
        const overlay = document.createElement('div');
        overlay.id = 'cookie-modal-overlay';
        overlay.className = 'modal-overlay';
        
        overlay.innerHTML = `
            <div class="modal-content glass" style="max-width: 500px;">
                <div class="section-title">Gerenciar Preferências de Cookies</div>
                <p class="small-muted mb-1">Escolha quais cookies você permite que utilizemos. Sua escolha será salva neste navegador.</p>
                
                <div class="cookie-option">
                    <div class="cookie-info">
                        <b>Estritamente Necessários</b>
                        <p class="small-muted">Essenciais para o sistema funcionar (login, segurança, navegação). Não podem ser desativados.</p>
                    </div>
                    <label class="switch">
                        <input type="checkbox" checked disabled>
                        <span class="slider"></span>
                    </label>
                </div>

                <div class="cookie-option">
                    <div class="cookie-info">
                        <b>Análises e Desempenho</b>
                        <p class="small-muted">Ajudam-nos a entender como os visitantes interagem com o sistema (Google Analytics, erros).</p>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="toggle-analytics" ${consentState.analytics ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>

                <div class="cookie-option">
                    <div class="cookie-info">
                        <b>Personalização e Marketing</b>
                        <p class="small-muted">Usados para entregar conteúdo relevante para sua área de pesquisa e perfis.</p>
                    </div>
                    <label class="switch">
                        <input type="checkbox" id="toggle-marketing" ${consentState.marketing ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>

                <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.5rem;">
                    <button class="btn btn-primary" id="btn-save-cookie-prefs">Salvar Minhas Escolhas</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);

        document.getElementById('btn-save-cookie-prefs').addEventListener('click', () => {
            consentState.analytics = document.getElementById('toggle-analytics').checked;
            consentState.marketing = document.getElementById('toggle-marketing').checked;
            saveConsent();
            overlay.remove();
            closeBanner();
        });
    }

    function saveConsent() {
        localStorage.setItem('nebula_cookie_consent', JSON.stringify(consentState));
        applyConsent();
    }

    function applyConsent() {
        // Lógica de ativação/desativação real baseada no state
        if (consentState.analytics) {
            console.log("[Cookies] Analytics Ativado.");
            // Ex: window.dataLayer = window.dataLayer || [];
        } else {
            console.log("[Cookies] Analytics Desativado.");
        }
    }

    function forceManage() {
        showManageModal();
    }

    return { init, forceManage };
})();

document.addEventListener('DOMContentLoaded', NebulaCookies.init);

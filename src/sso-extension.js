/**
 * AEM CIF SSO Extension - Self-contained, auto-injecting bundle.
 *
 * This script auto-detects CIF sign-in forms on the page and injects
 * a "Login with Adobe Commerce" OAuth2 button. No npm install or code
 * changes required in the consuming AEM project.
 *
 * Configuration is read from:
 *   1. window.aemCifSsoConfig (set by Extension Manager or manually)
 *   2. <script> tag data-attributes on the loading script tag
 */
(function () {
    'use strict';

    var EXTENSION_ID = 'aem-cif-sso-extension';
    var BUTTON_CLASS = 'aem-sso-btn';
    var STATE_KEY = 'sso_oauth_state';

    // CIF sign-in form selectors (covers Venia, standard CIF, and common patterns)
    var SIGN_IN_SELECTORS = [
        'form[class*="signIn"]',
        'form[class*="SignIn"]',
        'form[class*="sign_in"]',
        '[class*="signIn__root"]',
        '[class*="signIn__form"]',
        '[class*="accountMenu__root"] form',
        '.miniaccount__body form'
    ];

    // ── Configuration ──────────────────────────────────────────────────

    function getConfig() {
        var scriptTag = document.querySelector(
            'script[data-sso-extension], script[src*="sso-extension"]'
        );
        var dataConfig = {};
        if (scriptTag) {
            dataConfig = {
                commerceAuthorizeUrl: scriptTag.getAttribute('data-authorize-url'),
                commerceTokenUrl: scriptTag.getAttribute('data-token-url'),
                clientId: scriptTag.getAttribute('data-client-id'),
                redirectUri: scriptTag.getAttribute('data-redirect-uri'),
                buttonLabel: scriptTag.getAttribute('data-button-label')
            };
        }

        var globalConfig = window.aemCifSsoConfig || {};

        return {
            commerceAuthorizeUrl: globalConfig.commerceAuthorizeUrl || dataConfig.commerceAuthorizeUrl || '',
            commerceTokenUrl: globalConfig.commerceTokenUrl || dataConfig.commerceTokenUrl || '',
            clientId: globalConfig.clientId || dataConfig.clientId || '',
            redirectUri: globalConfig.redirectUri || dataConfig.redirectUri || (window.location.origin + '/sso/callback'),
            scope: globalConfig.scope || 'openid email profile',
            buttonLabel: globalConfig.buttonLabel || dataConfig.buttonLabel || 'Login with Adobe Commerce'
        };
    }

    // ── OAuth2 Helpers ─────────────────────────────────────────────────

    function generateState() {
        var array = new Uint8Array(32);
        window.crypto.getRandomValues(array);
        return Array.from(array, function (b) {
            return b.toString(16).padStart(2, '0');
        }).join('');
    }

    function initiateLogin() {
        var config = getConfig();
        if (!config.commerceAuthorizeUrl || !config.clientId) {
            console.error('[SSO Extension] Missing config: commerceAuthorizeUrl and clientId are required.');
            return;
        }

        var state = generateState();
        sessionStorage.setItem(STATE_KEY, state);

        var params = new URLSearchParams({
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            response_type: 'code',
            scope: config.scope,
            state: state
        });

        window.location.href = config.commerceAuthorizeUrl + '?' + params.toString();
    }

    // ── OAuth Callback Handler ─────────────────────────────────────────

    function handleCallback() {
        var params = new URLSearchParams(window.location.search);
        var code = params.get('code');
        var state = params.get('state');
        var error = params.get('error');

        if (!code && !error) return false;

        var container = document.createElement('div');
        container.className = 'aem-sso-callback';
        container.innerHTML =
            '<div class="aem-sso-callback__card">' +
            '  <div class="aem-sso-callback__spinner"></div>' +
            '  <p class="aem-sso-callback__message">Signing you in with Adobe Commerce...</p>' +
            '</div>';
        document.body.appendChild(container);

        if (error) {
            showCallbackError(container, params.get('error_description') || error);
            return true;
        }

        var storedState = sessionStorage.getItem(STATE_KEY);
        sessionStorage.removeItem(STATE_KEY);
        if (!storedState || storedState !== state) {
            showCallbackError(container, 'Security validation failed. Please try again.');
            return true;
        }

        var config = getConfig();
        if (!config.commerceTokenUrl) {
            showCallbackError(container, 'Token endpoint not configured.');
            return true;
        }

        fetch(config.commerceTokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                grant_type: 'authorization_code',
                code: code,
                client_id: config.clientId,
                redirect_uri: config.redirectUri
            })
        })
            .then(function (res) {
                if (!res.ok) throw new Error('Token exchange failed (' + res.status + ')');
                return res.json();
            })
            .then(function (data) {
                var token = data.customer_token || data.access_token;
                if (!token) throw new Error('No token in response');

                // Store token where Peregrine / CIF can find it
                var signinToken = JSON.stringify(token);
                window.localStorage.setItem('signin_token', signinToken);
                document.cookie = 'cif.userToken=' + encodeURIComponent(token) + ';path=/;secure;samesite=strict';

                // Dispatch custom event for any listening CIF code
                window.dispatchEvent(new CustomEvent('aem-sso:login-success', { detail: { token: token } }));

                showCallbackSuccess(container);
                setTimeout(function () {
                    window.location.href = '/';
                }, 1500);
            })
            .catch(function (err) {
                console.error('[SSO Extension] Token exchange error:', err);
                showCallbackError(container, err.message);
            });

        return true;
    }

    function showCallbackError(container, message) {
        var card = container.querySelector('.aem-sso-callback__card');
        card.innerHTML =
            '<p class="aem-sso-callback__message aem-sso-callback__message--error">Login failed</p>' +
            '<p class="aem-sso-callback__detail">' + escapeHtml(message) + '</p>' +
            '<button class="aem-sso-callback__retry" onclick="window.location.href=\'/\'">Back to Sign In</button>';
    }

    function showCallbackSuccess(container) {
        var card = container.querySelector('.aem-sso-callback__card');
        card.innerHTML =
            '<p class="aem-sso-callback__message aem-sso-callback__message--success">Login successful! Redirecting...</p>';
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Button Injection ───────────────────────────────────────────────

    function createSSOButton() {
        var config = getConfig();

        var wrapper = document.createElement('div');
        wrapper.className = 'aem-sso-root';
        wrapper.setAttribute('data-' + EXTENSION_ID, 'true');

        wrapper.innerHTML =
            '<div class="aem-sso-divider">' +
            '  <span class="aem-sso-divider__line"></span>' +
            '  <span class="aem-sso-divider__text">OR</span>' +
            '  <span class="aem-sso-divider__line"></span>' +
            '</div>' +
            '<button class="' + BUTTON_CLASS + '" type="button">' +
            '  <svg class="aem-sso-btn__icon" viewBox="0 0 24 24" width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '    <path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zM9.38 17.5H5.25V6.5l4.13 11zm4.99 0h-2.49L7.1 6.5h2.97l4.3 11zm4.38 0h-2.71l-4.2-11h2.71l4.2 11z" fill="currentColor"/>' +
            '  </svg>' +
            '  <span class="aem-sso-btn__text">' + escapeHtml(config.buttonLabel) + '</span>' +
            '</button>';

        wrapper.querySelector('.' + BUTTON_CLASS).addEventListener('click', initiateLogin);
        return wrapper;
    }

    function injectButton(signInForm) {
        if (signInForm.querySelector('[data-' + EXTENSION_ID + ']')) return;

        var button = createSSOButton();

        if (signInForm.tagName === 'FORM') {
            signInForm.parentNode.insertBefore(button, signInForm.nextSibling);
        } else {
            signInForm.appendChild(button);
        }
    }

    function findAndInject() {
        if (document.querySelector('.aem-sso-root')) return;

        for (var i = 0; i < SIGN_IN_SELECTORS.length; i++) {
            var forms = document.querySelectorAll(SIGN_IN_SELECTORS[i]);
            for (var j = 0; j < forms.length; j++) {
                injectButton(forms[j]);
                if (document.querySelector('.aem-sso-root')) return;
            }
        }
    }

    // ── DOM Observer ───────────────────────────────────────────────────

    function startObserver() {
        findAndInject();

        var observer = new MutationObserver(function () {
            findAndInject();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // ── Initialization ─────────────────────────────────────────────────

    function init() {
        if (window.location.pathname === '/sso/callback') {
            if (handleCallback()) return;
        }

        injectStyles();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', startObserver);
        } else {
            startObserver();
        }

        console.log('[SSO Extension] Initialized (v1.0.0)');
    }

    // ── Inline Styles ──────────────────────────────────────────────────

    function injectStyles() {
        if (document.getElementById(EXTENSION_ID + '-styles')) return;

        var style = document.createElement('style');
        style.id = EXTENSION_ID + '-styles';
        style.textContent =
            '.aem-sso-root{display:flex;flex-direction:column;align-items:center;width:100%;margin-top:1rem}' +
            '.aem-sso-divider{display:flex;align-items:center;width:100%;margin-bottom:1rem}' +
            '.aem-sso-divider__line{flex:1;height:1px;background-color:#ccc}' +
            '.aem-sso-divider__text{padding:0 .75rem;font-size:.75rem;font-weight:600;color:#6d6d6d;text-transform:uppercase;letter-spacing:.05em}' +
            '.aem-sso-btn{display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;padding:.75rem 1.25rem;border:2px solid #eb1000;border-radius:4px;background:#fff;color:#eb1000;font-size:.875rem;font-weight:700;letter-spacing:.025em;cursor:pointer;transition:background .2s,color .2s;font-family:inherit}' +
            '.aem-sso-btn:hover{background:#eb1000;color:#fff}' +
            '.aem-sso-btn:focus{outline:2px solid #1473e6;outline-offset:2px}' +
            '.aem-sso-btn:active{background:#c40b00;border-color:#c40b00;color:#fff}' +
            '.aem-sso-btn__icon{flex-shrink:0}' +
            '.aem-sso-btn__text{white-space:nowrap}' +
            '.aem-sso-callback{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.95);z-index:10000}' +
            '.aem-sso-callback__card{max-width:420px;width:90%;padding:2.5rem 2rem;background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.1);text-align:center;display:flex;flex-direction:column;align-items:center;gap:1rem}' +
            '.aem-sso-callback__spinner{width:40px;height:40px;border:3px solid #e0e0e0;border-top-color:#eb1000;border-radius:50%;animation:aemSsoSpin .8s linear infinite}' +
            '@keyframes aemSsoSpin{to{transform:rotate(360deg)}}' +
            '.aem-sso-callback__message{font-size:1rem;color:#2c2c2c;margin:0}' +
            '.aem-sso-callback__message--error{color:#b00020}' +
            '.aem-sso-callback__message--success{color:#1b7742}' +
            '.aem-sso-callback__detail{font-size:.8125rem;color:#b00020;padding:.5rem 1rem;background:#fce4ec;border-radius:4px;word-break:break-word;margin:0}' +
            '.aem-sso-callback__retry{padding:.625rem 1.5rem;border:2px solid #eb1000;border-radius:4px;background:#eb1000;color:#fff;font-size:.875rem;font-weight:700;cursor:pointer;transition:background .2s;font-family:inherit}' +
            '.aem-sso-callback__retry:hover{background:#c40b00;border-color:#c40b00}';

        document.head.appendChild(style);
    }

    init();
})();

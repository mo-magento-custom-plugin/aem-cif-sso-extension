/**
 * AEM SSO Extension - Generic OAuth2/OIDC login button.
 *
 * Works with ANY identity provider: Okta, Azure AD, Auth0, Keycloak,
 * Adobe Commerce, Google, or any standard OAuth2/OIDC-compliant IdP.
 *
 * Configuration is read from:
 *   1. window.aemSsoConfig (global config object)
 *   2. <script> tag data-attributes on the loading script tag
 */
(function () {
    'use strict';

    var EXTENSION_ID = 'aem-sso-extension';
    var BUTTON_CLASS = 'aem-sso-btn';
    var STATE_KEY = 'sso_oauth_state';
    var NONCE_KEY = 'sso_oauth_nonce';
    var PKCE_VERIFIER_KEY = 'sso_pkce_code_verifier';

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
        var d = {};
        if (scriptTag) {
            d = {
                authorizeUrl:  scriptTag.getAttribute('data-authorize-url'),
                tokenUrl:      scriptTag.getAttribute('data-token-url'),
                userInfoUrl:   scriptTag.getAttribute('data-userinfo-url'),
                clientId:      scriptTag.getAttribute('data-client-id'),
                clientSecret:  scriptTag.getAttribute('data-client-secret'),
                redirectUri:   scriptTag.getAttribute('data-redirect-uri'),
                scope:         scriptTag.getAttribute('data-scope'),
                responseType:  scriptTag.getAttribute('data-response-type'),
                buttonLabel:   scriptTag.getAttribute('data-button-label'),
                buttonIcon:    scriptTag.getAttribute('data-button-icon'),
                providerName:  scriptTag.getAttribute('data-provider-name'),
                tokenField:    scriptTag.getAttribute('data-token-field'),
                contentType:   scriptTag.getAttribute('data-content-type'),
                callbackPath:  scriptTag.getAttribute('data-callback-path'),
                postLoginUrl:  scriptTag.getAttribute('data-post-login-url'),
                extraParams:   scriptTag.getAttribute('data-extra-params'),
                usePkce:      scriptTag.getAttribute('data-use-pkce')
            };
        }

        var g = window.aemSsoConfig || window.aemCifSsoConfig || {};
        var usePkceAttr = d.usePkce || g.usePkce;
        var usePkce = usePkceAttr === undefined || usePkceAttr === '' || usePkceAttr === 'true' || usePkceAttr === '1';

        return {
            authorizeUrl:  g.authorizeUrl  || d.authorizeUrl  || '',
            tokenUrl:      g.tokenUrl      || d.tokenUrl      || '',
            userInfoUrl:   g.userInfoUrl   || d.userInfoUrl   || '',
            clientId:      g.clientId      || d.clientId      || '',
            clientSecret:  g.clientSecret  || d.clientSecret  || '',
            redirectUri:   g.redirectUri   || d.redirectUri   || (window.location.origin + '/sso/callback'),
            scope:         g.scope         || d.scope         || 'openid email profile',
            responseType:  g.responseType  || d.responseType  || 'code',
            buttonLabel:   g.buttonLabel   || d.buttonLabel   || 'Sign in with SSO',
            buttonIcon:    g.buttonIcon    || d.buttonIcon    || 'lock',
            providerName:  g.providerName  || d.providerName  || 'SSO',
            tokenField:    g.tokenField    || d.tokenField    || 'access_token',
            contentType:   g.contentType   || d.contentType   || 'application/x-www-form-urlencoded',
            callbackPath:  g.callbackPath  || d.callbackPath  || '/sso/callback',
            postLoginUrl:  g.postLoginUrl  || d.postLoginUrl  || '/',
            extraParams:   g.extraParams   || (d.extraParams ? JSON.parse(d.extraParams) : {}),
            usePkce:       usePkce
        };
    }

    // ── OAuth2 / OIDC Helpers ───────────────────────────────────────────

    function generateRandom() {
        var array = new Uint8Array(32);
        window.crypto.getRandomValues(array);
        return Array.from(array, function (b) {
            return b.toString(16).padStart(2, '0');
        }).join('');
    }

    function base64UrlEncode(bytes) {
        var binary = '';
        for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    function generateCodeVerifier() {
        var array = new Uint8Array(32);
        window.crypto.getRandomValues(array);
        return base64UrlEncode(array);
    }

    function computeCodeChallenge(verifier) {
        return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
            .then(function (hash) { return base64UrlEncode(new Uint8Array(hash)); });
    }

    function initiateLogin() {
        var config = getConfig();
        if (!config.authorizeUrl || !config.clientId) {
            console.error('[SSO Extension] Missing config: authorizeUrl and clientId are required.');
            return;
        }

        var state = generateRandom();
        var nonce = generateRandom();
        sessionStorage.setItem(STATE_KEY, state);
        sessionStorage.setItem(NONCE_KEY, nonce);

        var params = {
            client_id: config.clientId,
            redirect_uri: config.redirectUri,
            response_type: config.responseType,
            scope: config.scope,
            state: state,
            nonce: nonce
        };

        var usePkce = config.usePkce !== false;
        if (usePkce) {
            var verifier = generateCodeVerifier();
            sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
            computeCodeChallenge(verifier).then(function (challenge) {
                params.code_challenge = challenge;
                params.code_challenge_method = 'S256';
                doRedirect(config, params);
            }).catch(function () {
                sessionStorage.removeItem(PKCE_VERIFIER_KEY);
                params.code_challenge = verifier;
                params.code_challenge_method = 'plain';
                doRedirect(config, params);
            });
        } else {
            doRedirect(config, params);
        }
    }

    function doRedirect(config, params) {
        var extra = config.extraParams;
        if (extra && typeof extra === 'object') {
            for (var key in extra) {
                if (extra.hasOwnProperty(key)) params[key] = extra[key];
            }
        }
        var query = new URLSearchParams(params).toString();
        window.location.href = config.authorizeUrl + '?' + query;
    }

    // ── OAuth Callback Handler ─────────────────────────────────────────

    function handleCallback() {
        var params = new URLSearchParams(window.location.search);
        var hashParams = new URLSearchParams(window.location.hash.replace('#', ''));

        var code = params.get('code');
        var idToken = hashParams.get('id_token') || params.get('id_token');
        var accessToken = hashParams.get('access_token') || params.get('access_token');
        var state = params.get('state') || hashParams.get('state');
        var error = params.get('error') || hashParams.get('error');

        if (!code && !idToken && !accessToken && !error) return false;

        var config = getConfig();

        var container = document.createElement('div');
        container.className = 'aem-sso-callback';
        container.innerHTML =
            '<div class="aem-sso-callback__card">' +
            '  <div class="aem-sso-callback__spinner"></div>' +
            '  <p class="aem-sso-callback__message">Signing you in via ' + escapeHtml(config.providerName) + '...</p>' +
            '</div>';
        document.body.appendChild(container);

        if (error) {
            showCallbackError(container, params.get('error_description') || hashParams.get('error_description') || error);
            return true;
        }

        var storedState = sessionStorage.getItem(STATE_KEY);
        sessionStorage.removeItem(STATE_KEY);
        sessionStorage.removeItem(NONCE_KEY);
        if (storedState && storedState !== state) {
            showCallbackError(container, 'Security validation failed (state mismatch). Please try again.');
            return true;
        }

        if (idToken || accessToken) {
            handleTokenResponse(container, config, {
                id_token: idToken,
                access_token: accessToken
            });
            return true;
        }

        if (!config.tokenUrl) {
            showCallbackError(container, 'Token endpoint (tokenUrl) not configured.');
            return true;
        }

        var codeVerifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
        if (codeVerifier) sessionStorage.removeItem(PKCE_VERIFIER_KEY);

        var body;
        var headers = {};

        if (config.contentType === 'application/json') {
            headers['Content-Type'] = 'application/json';
            var payload = {
                grant_type: 'authorization_code',
                code: code,
                client_id: config.clientId,
                redirect_uri: config.redirectUri
            };
            if (config.clientSecret) payload.client_secret = config.clientSecret;
            if (codeVerifier) payload.code_verifier = codeVerifier;
            body = JSON.stringify(payload);
        } else {
            headers['Content-Type'] = 'application/x-www-form-urlencoded';
            var formData = new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                client_id: config.clientId,
                redirect_uri: config.redirectUri
            });
            if (config.clientSecret) formData.append('client_secret', config.clientSecret);
            if (codeVerifier) formData.append('code_verifier', codeVerifier);
            body = formData.toString();
        }

        fetch(config.tokenUrl, { method: 'POST', headers: headers, body: body })
            .then(function (res) {
                return res.text().then(function (text) {
                    var data;
                    try { data = text ? JSON.parse(text) : {}; } catch (e) { data = {}; }
                    if (!res.ok) {
                        var msg = data.error_description || data.error || data.message || ('Token exchange failed (' + res.status + ')');
                        if (data.error) msg = data.error + (data.error_description ? ': ' + data.error_description : '');
                        throw new Error(msg);
                    }
                    return data;
                });
            })
            .then(function (data) {
                handleTokenResponse(container, config, data);
            })
            .catch(function (err) {
                console.error('[SSO Extension] Token exchange error:', err);
                showCallbackError(container, err.message);
            });

        return true;
    }

    function handleTokenResponse(container, config, data) {
        // Prefer customer_token for Adobe Commerce token session when IdP returns it
        var customerToken = data.customer_token || null;
        var token = customerToken || data[config.tokenField] || data.access_token || data.id_token;
        if (!token) {
            showCallbackError(container, 'No token received from identity provider.');
            return;
        }

        // Adobe Commerce token session: store token for CIF GraphQL, customer session, and cart
        var tokenForSession = customerToken || token;
        var tokenStr = typeof tokenForSession === 'string' ? tokenForSession : JSON.stringify(tokenForSession);
        window.localStorage.setItem('signin_token', tokenStr);
        document.cookie = 'cif.userToken=' + encodeURIComponent(tokenStr) + ';path=/;secure;samesite=strict';
        if (customerToken) {
            window.localStorage.setItem('commerce_customer_token', tokenStr);
        }
        document.cookie = 'sso.idToken=' + encodeURIComponent(data.id_token || '') + ';path=/;secure;samesite=strict';

        if (data.refresh_token) {
            window.localStorage.setItem('sso_refresh_token', data.refresh_token);
        }

        window.dispatchEvent(new CustomEvent('aem-sso:login-success', {
            detail: { token: token, data: data, provider: config.providerName }
        }));

        if (config.userInfoUrl && data.access_token) {
            fetch(config.userInfoUrl, {
                headers: { 'Authorization': 'Bearer ' + data.access_token }
            })
                .then(function (r) { return r.json(); })
                .then(function (profile) {
                    window.localStorage.setItem('sso_user_profile', JSON.stringify(profile));
                    window.dispatchEvent(new CustomEvent('aem-sso:profile-loaded', { detail: profile }));
                })
                .catch(function () { });
        }

        showCallbackSuccess(container, config);
        setTimeout(function () {
            window.location.href = config.postLoginUrl;
        }, 1500);
    }

    function showCallbackError(container, message) {
        var card = container.querySelector('.aem-sso-callback__card');
        card.innerHTML =
            '<p class="aem-sso-callback__message aem-sso-callback__message--error">Login failed</p>' +
            '<p class="aem-sso-callback__detail">' + escapeHtml(message) + '</p>' +
            '<button class="aem-sso-callback__retry" onclick="window.location.href=\'/\'">Back to Sign In</button>';
    }

    function showCallbackSuccess(container, config) {
        var card = container.querySelector('.aem-sso-callback__card');
        card.innerHTML =
            '<p class="aem-sso-callback__message aem-sso-callback__message--success">Logged in via ' + escapeHtml(config.providerName) + '! Redirecting...</p>';
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Button Icons ────────────────────────────────────────────────────

    var ICONS = {
        lock: '<path d="M12 2C9.24 2 7 4.24 7 7v3H6c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-8c0-1.1-.9-2-2-2h-1V7c0-2.76-2.24-5-5-5zm0 2c1.66 0 3 1.34 3 3v3H9V7c0-1.66 1.34-3 3-3zm0 10c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z" fill="currentColor"/>',
        microsoft: '<path d="M3 3h8.5v8.5H3V3zm9.5 0H21v8.5h-8.5V3zM3 12.5h8.5V21H3v-8.5zm9.5 0H21V21h-8.5v-8.5z" fill="currentColor"/>',
        okta: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" fill="currentColor"/>',
        google: '<path d="M21.35 11.1h-9.18v2.73h5.51c-.24 1.26-.98 2.33-2.09 3.04v2.53h3.39c1.97-1.82 3.11-4.49 3.11-7.64 0-.52-.05-1.02-.14-1.5l-.6.84z" fill="#4285F4"/><path d="M12.17 22c2.84 0 5.22-.94 6.96-2.56l-3.39-2.64c-.94.63-2.15 1-3.57 1-2.74 0-5.06-1.85-5.89-4.35H2.77v2.7A10.26 10.26 0 0012.17 22z" fill="#34A853"/><path d="M6.28 13.45a5.9 5.9 0 010-3.77V6.98H2.77a10.26 10.26 0 000 9.17l3.51-2.7z" fill="#FBBC05"/><path d="M12.17 5.33c1.55 0 2.94.53 4.03 1.58l3.02-3.02C17.38 2.18 14.99 1.13 12.17 1.13 7.97 1.13 4.33 3.64 2.77 7.28l3.51 2.7c.83-2.5 3.15-4.65 5.89-4.65z" fill="#EA4335"/>',
        adobe: '<path d="M19.5 3h-15A1.5 1.5 0 003 4.5v15A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-15A1.5 1.5 0 0019.5 3zM9.38 17.5H5.25V6.5l4.13 11zm4.99 0h-2.49L7.1 6.5h2.97l4.3 11zm4.38 0h-2.71l-4.2-11h2.71l4.2 11z" fill="currentColor"/>',
        key: '<path d="M12.65 10a6 6 0 10-1.3 2H17v3h2v-3h2v-2h-8.35zM7 14a4 4 0 110-8 4 4 0 010 8z" fill="currentColor"/>'
    };

    // ── Button Injection ───────────────────────────────────────────────

    function createSSOButton() {
        var config = getConfig();
        var iconKey = config.buttonIcon || 'lock';
        var iconSvg = ICONS[iconKey] || ICONS.lock;

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
            iconSvg +
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
        new MutationObserver(function () { findAndInject(); })
            .observe(document.body, { childList: true, subtree: true });
    }

    // ── Apply commerce_customer_token to AEM session (login + GraphQL) ───

    function applyCommerceCustomerTokenToSession() {
        try {
            var commerceToken = window.localStorage.getItem('commerce_customer_token');
            if (!commerceToken) return;
            // Venia/Peregrine often expect raw token string in signin_token (not JSON-wrapped)
            window.localStorage.setItem('signin_token', commerceToken);
            document.cookie = 'cif.userToken=' + encodeURIComponent(commerceToken) + ';path=/;secure;samesite=strict';
        } catch (e) {}
    }

    // ── Initialization ─────────────────────────────────────────────────

    function init() {
        var config = getConfig();
        if (window.location.pathname === config.callbackPath) {
            if (handleCallback()) return;
        }

        applyCommerceCustomerTokenToSession();
        injectStyles();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', startObserver);
        } else {
            startObserver();
        }

        console.log('[SSO Extension] Initialized (v2.0.0) - Provider:', config.providerName);
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
            '.aem-sso-btn{display:flex;align-items:center;justify-content:center;gap:.5rem;width:100%;padding:.75rem 1.25rem;border:2px solid #1473e6;border-radius:4px;background:#fff;color:#1473e6;font-size:.875rem;font-weight:700;letter-spacing:.025em;cursor:pointer;transition:background .2s,color .2s;font-family:inherit}' +
            '.aem-sso-btn:hover{background:#1473e6;color:#fff}' +
            '.aem-sso-btn:focus{outline:2px solid #1473e6;outline-offset:2px}' +
            '.aem-sso-btn:active{background:#0d66d0;border-color:#0d66d0;color:#fff}' +
            '.aem-sso-btn__icon{flex-shrink:0}' +
            '.aem-sso-btn__text{white-space:nowrap}' +
            '.aem-sso-callback{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.95);z-index:10000}' +
            '.aem-sso-callback__card{max-width:420px;width:90%;padding:2.5rem 2rem;background:#fff;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.1);text-align:center;display:flex;flex-direction:column;align-items:center;gap:1rem}' +
            '.aem-sso-callback__spinner{width:40px;height:40px;border:3px solid #e0e0e0;border-top-color:#1473e6;border-radius:50%;animation:aemSsoSpin .8s linear infinite}' +
            '@keyframes aemSsoSpin{to{transform:rotate(360deg)}}' +
            '.aem-sso-callback__message{font-size:1rem;color:#2c2c2c;margin:0}' +
            '.aem-sso-callback__message--error{color:#b00020}' +
            '.aem-sso-callback__message--success{color:#1b7742}' +
            '.aem-sso-callback__detail{font-size:.8125rem;color:#b00020;padding:.5rem 1rem;background:#fce4ec;border-radius:4px;word-break:break-word;margin:0}' +
            '.aem-sso-callback__retry{padding:.625rem 1.5rem;border:2px solid #1473e6;border-radius:4px;background:#1473e6;color:#fff;font-size:.875rem;font-weight:700;cursor:pointer;transition:background .2s;font-family:inherit}' +
            '.aem-sso-callback__retry:hover{background:#0d66d0;border-color:#0d66d0}';

        document.head.appendChild(style);
    }

    init();
})();

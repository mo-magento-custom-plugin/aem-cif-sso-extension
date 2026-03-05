/**
 * AEM CIF SSO Extension Loader
 *
 * Drop-in loader script for any AEM CIF project. Reads configuration from
 * its own data-* attributes and dynamically loads the main SSO extension
 * script from the hosted URL.
 *
 * Usage:
 *   <script
 *       src="https://mo-magento-custom-plugin.github.io/aem-cif-sso-extension/dist/loader.js"
 *       data-sso-extension
 *       data-authorize-url="https://commerce.example.com/oauth/authorize"
 *       data-token-url="https://commerce.example.com/oauth/token"
 *       data-client-id="your-client-id"
 *       data-redirect-uri="https://publish-pXXX-eXXX.adobeaemcloud.com/sso/callback"
 *       defer>
 *   </script>
 */
(function () {
    'use strict';

    var HOSTED_SCRIPT = 'https://mo-magento-custom-plugin.github.io/aem-cif-sso-extension/src/sso-extension.js';

    var loaderTag = document.currentScript || document.querySelector('script[data-sso-extension]');
    if (!loaderTag) return;

    var script = document.createElement('script');
    script.src = loaderTag.getAttribute('data-script-url') || HOSTED_SCRIPT;
    script.defer = true;
    script.setAttribute('data-sso-extension', '');

    var attrs = ['data-authorize-url', 'data-token-url', 'data-client-id',
                 'data-redirect-uri', 'data-button-label'];
    for (var i = 0; i < attrs.length; i++) {
        var val = loaderTag.getAttribute(attrs[i]);
        if (val) script.setAttribute(attrs[i], val);
    }

    document.head.appendChild(script);
})();

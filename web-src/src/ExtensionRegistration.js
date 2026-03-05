import { register } from '@adobe/uix-guest';

const EXTENSION_ID = 'aem-cif-sso-extension';

function ExtensionRegistration() {
    const init = async () => {
        const guestConnection = await register({
            id: EXTENSION_ID,
            methods: {
                commerce: {
                    getStorefrontExtensions() {
                        const config = guestConnection.configuration || {};
                        return [
                            {
                                id: EXTENSION_ID,
                                label: 'Login with Adobe Commerce (SSO)',
                                description: 'Adds OAuth2 SSO login button to the CIF sign-in form',
                                storefrontScript: config.storefrontScriptUrl || '',
                                configuration: {
                                    commerceAuthorizeUrl: config.commerceAuthorizeUrl || '',
                                    commerceTokenUrl: config.commerceTokenUrl || '',
                                    clientId: config.clientId || '',
                                    redirectUri: config.redirectUri || ''
                                }
                            }
                        ];
                    }
                }
            }
        });

        console.log('[SSO Extension] Registered in Extension Manager', {
            config: guestConnection.configuration
        });
    };

    init().catch(console.error);
    return null;
}

export default ExtensionRegistration;

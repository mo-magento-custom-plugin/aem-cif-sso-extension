import { register } from "@adobe/uix-guest";
import { Text } from "@adobe/react-spectrum";

const EXTENSION_ID = "aem-cif-sso-extension";

function ExtensionRegistration() {
  const init = async () => {
    const guestConnection = await register({
      id: EXTENSION_ID,
      methods: {
        headerMenu: {
          getButtons() {
            return [];
          },
        },
      },
    });

    const config = guestConnection.configuration || {};
    console.log("[SSO Extension] Registered with config:", config);
  };

  init().catch(console.error);

  return <Text>AEM CIF SSO Extension</Text>;
}

export default ExtensionRegistration;

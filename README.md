# AEM CIF SSO Extension

A **zero-install, self-contained** extension that adds a "Login with Adobe Commerce" OAuth2 button to any AEM CIF storefront sign-in form. Register it via **Bring Your Own Extension** in AEM Extension Manager -- no `npm install`, no code changes in your AEM project.

## How It Works

```
1. Host the extension files (web-src/ and src/sso-extension.js)
2. Register in AEM Extension Manager via BYO
3. Configure OAuth parameters in Extension Manager
4. The script auto-detects CIF sign-in forms and injects the button
```

The extension is a single JavaScript file (`src/sso-extension.js`) that:

- **Auto-detects** CIF sign-in forms on the page using DOM selectors
- **Injects** a styled "Login with Adobe Commerce" button with an OR-divider
- **Handles** the full OAuth2 flow (redirect, callback, token exchange)
- **Stores** the customer token where CIF/Peregrine can find it
- **Watches** for dynamically rendered forms using a MutationObserver
- **Includes** all CSS inline -- no external stylesheet needed

## Package Contents

```
aem-cif-sso-extension/
├── src/
│   └── sso-extension.js          # Self-contained storefront script (JS + CSS)
├── web-src/
│   ├── index.html                # BYO entry point for Extension Manager
│   └── src/
│       └── ExtensionRegistration.js  # UIX Guest registration (reference)
├── package.json
└── README.md
```

## Setup (3 Steps)

### Step 1: Host the Extension Files

Upload these two things to any static hosting (Vercel, Netlify, S3, Adobe I/O Runtime, etc.):

| What to host | Purpose |
|---|---|
| `web-src/index.html` | Extension Manager BYO registration page |
| `src/sso-extension.js` | Storefront script that auto-injects the SSO button |

Example hosted URLs:
- `https://your-host.com/index.html` (for Extension Manager)
- `https://your-host.com/sso-extension.js` (for the storefront)

### Step 2: Register in AEM Extension Manager (BYO)

1. Go to https://experience.adobe.com/aem/extension-manager
2. Click **Bring Your Own Extension**
3. Enter the **Extension URL**: `https://your-host.com/index.html`
4. Click the **gear icon** to configure parameters:

| Parameter | Description | Example |
|---|---|---|
| `commerceAuthorizeUrl` | Commerce OAuth2 authorize endpoint | `https://commerce.example.com/oauth/authorize` |
| `commerceTokenUrl` | Commerce token exchange endpoint | `https://commerce.example.com/oauth/token` |
| `clientId` | OAuth2 client ID | `my-sso-client-id` |
| `redirectUri` | Callback URL on your AEM publish instance | `https://publish-pXXX-eXXX.adobeaemcloud.com/sso/callback` |
| `storefrontScriptUrl` | URL to the hosted sso-extension.js | `https://your-host.com/sso-extension.js` |

5. **Enable** the extension for your environment

### Step 3: Load the Script on Your Storefront

Add the script to your storefront pages using **one** of these methods:

**Option A -- Script tag with data attributes (simplest):**

Add this to your page template or experience fragment:

```html
<script
    src="https://your-host.com/sso-extension.js"
    data-sso-extension
    data-authorize-url="https://commerce.example.com/oauth/authorize"
    data-token-url="https://commerce.example.com/oauth/token"
    data-client-id="my-sso-client-id"
    data-redirect-uri="https://publish-pXXX-eXXX.adobeaemcloud.com/sso/callback"
    defer>
</script>
```

**Option B -- Global config object:**

```html
<script>
    window.aemCifSsoConfig = {
        commerceAuthorizeUrl: 'https://commerce.example.com/oauth/authorize',
        commerceTokenUrl: 'https://commerce.example.com/oauth/token',
        clientId: 'my-sso-client-id',
        redirectUri: 'https://publish-pXXX-eXXX.adobeaemcloud.com/sso/callback'
    };
</script>
<script src="https://your-host.com/sso-extension.js" defer></script>
```

**Option C -- AEM Clientlib:**

Create a proxy clientlib that loads the hosted script, or copy `sso-extension.js` into a clientlib folder.

That's it. No `npm install`. No code changes. The script does the rest.

## OAuth2 Flow

```
User clicks "Login with Adobe Commerce"
        │
        ▼
Generate CSRF state token (sessionStorage)
        │
        ▼
Redirect to Commerce /authorize?client_id=...&state=...
        │
        ▼
User authenticates on Commerce
        │
        ▼
Commerce redirects to /sso/callback?code=...&state=...
        │
        ▼
Validate state ──► Exchange code for token (POST /token)
        │
        ▼
Store token (localStorage + cookie)
        │
        ▼
Dispatch 'aem-sso:login-success' event ──► Redirect to homepage
```

## Events

The extension dispatches a custom DOM event on successful login:

```js
window.addEventListener('aem-sso:login-success', function(e) {
    console.log('User logged in with token:', e.detail.token);
});
```

## Token Storage

On successful login, the customer token is stored in:

| Location | Key | Purpose |
|---|---|---|
| `localStorage` | `signin_token` | Peregrine/CIF token storage |
| `cookie` | `cif.userToken` | Server-side CIF access |

## CIF Form Detection

The script auto-detects sign-in forms matching these selectors:

```
form[class*="signIn"]
form[class*="SignIn"]
form[class*="sign_in"]
[class*="signIn__root"]
[class*="signIn__form"]
[class*="accountMenu__root"] form
.miniaccount__body form
```

A `MutationObserver` watches for dynamically rendered forms (e.g., when the user clicks "Sign In" in the header), so the button is injected even on lazily loaded forms.

## Customization

### Custom Button Label

```html
<script
    src="https://your-host.com/sso-extension.js"
    data-sso-extension
    data-button-label="Sign in with Commerce SSO"
    ...
    defer>
</script>
```

Or via global config:

```js
window.aemCifSsoConfig = {
    buttonLabel: 'Sign in with Commerce SSO',
    ...
};
```

### CSS Overrides

All elements use `aem-sso-*` class names. Override in your own stylesheet:

```css
.aem-sso-btn {
    border-color: #0066cc;
    color: #0066cc;
}
.aem-sso-btn:hover {
    background-color: #0066cc;
}
```

### CSS Class Reference

| Class | Element |
|---|---|
| `.aem-sso-root` | Wrapper around divider + button |
| `.aem-sso-divider` | The "OR" divider row |
| `.aem-sso-divider__line` | Horizontal lines in divider |
| `.aem-sso-divider__text` | "OR" text |
| `.aem-sso-btn` | The login button |
| `.aem-sso-btn__icon` | Adobe icon SVG |
| `.aem-sso-btn__text` | Button label text |
| `.aem-sso-callback` | Callback page overlay |
| `.aem-sso-callback__card` | Callback status card |
| `.aem-sso-callback__spinner` | Loading spinner |

## Dispatcher Note

If your AEM dispatcher rewrites all paths to `/content/...`, add an exclusion for the SSO callback:

```apache
RewriteCond %{REQUEST_URI} !^/sso
```

## License

Apache-2.0

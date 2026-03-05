# AEM CIF SSO Extension (BYO)

A **generic, Bring Your Own (BYO)** extension for AEM that adds a "Login with Adobe Commerce" OAuth2 SSO button to any CIF storefront sign-in form.

- **Zero install** -- no `npm install`, no build step, no code changes to your AEM project
- **Self-contained** -- single JS file with inline CSS, auto-detects CIF sign-in forms
- **BYO compatible** -- register in AEM Extension Manager for centralized management
- **Generic** -- works with any AEM CIF storefront (Venia, custom, etc.)

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  GitHub Pages (or any static host)                           │
│                                                              │
│  web-src/index.html ──► Extension Manager BYO registration   │
│  src/sso-extension.js ──► Storefront script (auto-injects)   │
│  dist/loader.js ──► Lightweight loader (optional)            │
└───────────────────────────┬──────────────────────────────────┘
                            │
              ┌─────────────┼──────────────┐
              ▼                            ▼
┌─────────────────────────┐  ┌─────────────────────────────┐
│  AEM Extension Manager  │  │  AEM Publish Storefront      │
│  (management & config)  │  │  (loads sso-extension.js)    │
│                         │  │                               │
│  • Enable/disable       │  │  • Auto-detects sign-in form │
│  • Configure OAuth      │  │  • Injects SSO button        │
│  • Visibility           │  │  • Handles OAuth2 flow       │
└─────────────────────────┘  └─────────────────────────────┘
```

## Package Structure

```
aem-cif-sso-extension/
├── src/
│   └── sso-extension.js       # Self-contained storefront script (JS + CSS)
├── dist/
│   └── loader.js               # Lightweight loader (passes config & loads main script)
├── web-src/
│   └── index.html              # BYO entry point for Extension Manager
├── .github/
│   └── workflows/
│       └── pages.yml           # Auto-deploy to GitHub Pages on push
├── package.json
└── README.md
```

---

## Deployment (3 Steps)

### Step 1: Host on GitHub Pages

1. Push this repo to GitHub (e.g., `https://github.com/your-org/aem-cif-sso-extension`)

2. Enable GitHub Pages:
   - Go to **Settings → Pages**
   - Source: **GitHub Actions**
   - The included workflow (`.github/workflows/pages.yml`) deploys automatically on push

3. After deployment, your files are available at:

   | File | URL |
   |---|---|
   | Extension Manager entry | `https://your-org.github.io/aem-cif-sso-extension/web-src/index.html` |
   | Storefront script | `https://your-org.github.io/aem-cif-sso-extension/src/sso-extension.js` |
   | Loader script | `https://your-org.github.io/aem-cif-sso-extension/dist/loader.js` |

### Step 2: Register in AEM Extension Manager (BYO)

1. Open [Extension Manager](https://experience.adobe.com/aem/extension-manager)
2. Select your **Program** and **Environment**
3. Click **Bring Your Own Extension**
4. Fill in:
   - **Extension Name**: `AEM CIF SSO Extension`
   - **Extension URL**: `https://your-org.github.io/aem-cif-sso-extension/web-src/index.html`
   - **Supported Services**: select **Content Fragments** (required for BYO registration)
5. Click **Add**

6. Configure the extension (click the **gear icon** in the Action column):

   | Key | Value | Description |
   |---|---|---|
   | `COMMERCE_AUTHORIZE_URL` | `https://commerce.example.com/oauth/authorize` | Commerce OAuth2 authorize endpoint |
   | `COMMERCE_TOKEN_URL` | `https://commerce.example.com/oauth/token` | Commerce token exchange endpoint |
   | `CLIENT_ID` | `your-client-id` | OAuth2 client ID |
   | `REDIRECT_URI` | `https://publish-pXXX-eXXX.adobeaemcloud.com/sso/callback` | Callback URL on your AEM publish |
   | `STOREFRONT_SCRIPT_URL` | `https://your-org.github.io/aem-cif-sso-extension/src/sso-extension.js` | Hosted script URL |
   | `BUTTON_LABEL` | `Login with Adobe Commerce` | (Optional) Custom button text |

7. **Enable** the extension

> **Note**: You need **Developer** role (non-prod) or **System Administrator** role (production) to add and enable BYO extensions.

### Step 3: Load the Script on Your Storefront

Since Extension Manager manages Author-side UI, the storefront script needs to be loaded on your publish pages. Choose **one** of these methods (no AEM project source code changes required):

#### Option A: Experience Fragment (Recommended -- No Code Change)

1. In AEM Author, create an **Experience Fragment** at `/content/experience-fragments/sso-loader`
2. Add an **HTML component** with this content:

```html
<script
    src="https://your-org.github.io/aem-cif-sso-extension/dist/loader.js"
    data-sso-extension
    data-authorize-url="https://commerce.example.com/oauth/authorize"
    data-token-url="https://commerce.example.com/oauth/token"
    data-client-id="your-client-id"
    data-redirect-uri="https://publish-pXXX-eXXX.adobeaemcloud.com/sso/callback"
    defer>
</script>
```

3. Include the Experience Fragment in your page template's footer

#### Option B: Google Tag Manager / Launch

Add a **Custom HTML Tag** in GTM or Adobe Launch:

```html
<script
    src="https://your-org.github.io/aem-cif-sso-extension/src/sso-extension.js"
    data-sso-extension
    data-authorize-url="https://commerce.example.com/oauth/authorize"
    data-token-url="https://commerce.example.com/oauth/token"
    data-client-id="your-client-id"
    data-redirect-uri="https://publish-pXXX-eXXX.adobeaemcloud.com/sso/callback"
    defer>
</script>
```

Trigger: All Pages

#### Option C: Direct Script Tag

Add directly to any AEM page template or component:

```html
<script
    src="https://your-org.github.io/aem-cif-sso-extension/src/sso-extension.js"
    data-sso-extension
    data-authorize-url="https://commerce.example.com/oauth/authorize"
    data-token-url="https://commerce.example.com/oauth/token"
    data-client-id="your-client-id"
    data-redirect-uri="https://publish-pXXX-eXXX.adobeaemcloud.com/sso/callback"
    defer>
</script>
```

#### Option D: Global Config Object

```html
<script>
    window.aemCifSsoConfig = {
        commerceAuthorizeUrl: 'https://commerce.example.com/oauth/authorize',
        commerceTokenUrl: 'https://commerce.example.com/oauth/token',
        clientId: 'your-client-id',
        redirectUri: 'https://publish-pXXX-eXXX.adobeaemcloud.com/sso/callback'
    };
</script>
<script src="https://your-org.github.io/aem-cif-sso-extension/src/sso-extension.js" defer></script>
```

---

## How the Extension Works

### Button Injection

1. The script loads on the storefront page
2. A `MutationObserver` watches for CIF sign-in form elements
3. When a sign-in form appears (even dynamically), the SSO button is injected below it
4. The button is styled with inline CSS -- no external stylesheet needed

### OAuth2 Flow

```
User clicks "Login with Adobe Commerce"
        │
        ▼
Generate CSRF state → store in sessionStorage
        │
        ▼
Redirect to Commerce /authorize?client_id=...&state=...
        │
        ▼
User authenticates on Adobe Commerce
        │
        ▼
Commerce redirects to /sso/callback?code=...&state=...
        │
        ▼
Validate state → Exchange code for token (POST /token)
        │
        ▼
Store token (localStorage + cookie) → Redirect to homepage
```

### Token Storage

| Location | Key | Purpose |
|---|---|---|
| `localStorage` | `signin_token` | Peregrine/CIF token storage |
| `cookie` | `cif.userToken` | Server-side CIF access |

### Custom Event

```js
window.addEventListener('aem-sso:login-success', function(e) {
    console.log('SSO login token:', e.detail.token);
});
```

---

## CIF Sign-In Form Detection

The script auto-detects forms matching these selectors:

```
form[class*="signIn"]
form[class*="SignIn"]
form[class*="sign_in"]
[class*="signIn__root"]
[class*="signIn__form"]
[class*="accountMenu__root"] form
.miniaccount__body form
```

A `MutationObserver` ensures the button is injected even when the sign-in form is rendered lazily (e.g., after clicking "Sign In" in the header menu).

---

## Customization

### Button Label

Via data attribute:
```html
<script src="..." data-sso-extension data-button-label="Sign in with Commerce SSO" defer></script>
```

Via global config:
```js
window.aemCifSsoConfig = { buttonLabel: 'Sign in with Commerce SSO' };
```

### CSS Overrides

All elements use `aem-sso-*` class names:

| Class | Element |
|---|---|
| `.aem-sso-root` | Wrapper (divider + button) |
| `.aem-sso-divider` | "OR" divider row |
| `.aem-sso-btn` | The login button |
| `.aem-sso-btn:hover` | Button hover state |
| `.aem-sso-callback` | Callback page overlay |

Example override:
```css
.aem-sso-btn { border-color: #0066cc; color: #0066cc; }
.aem-sso-btn:hover { background-color: #0066cc; }
```

---

## Dispatcher Configuration

If your AEM Dispatcher rewrites all paths to `/content/...`, add an exclusion for the OAuth callback:

```apache
# In dispatcher/src/conf.d/rewrites/rewrite.rules
RewriteCond %{REQUEST_URI} !^/sso
```

---

## Troubleshooting

### "This action is not available at the moment" in Extension Manager

- Ensure you have the correct role (**System Administrator** for production environments)
- Try a different browser or clear cache
- Select **Content Fragments** as the Supported Service
- If the issue persists, use Option A (Experience Fragment) or Option B (GTM) to load the script directly -- the Extension Manager registration is for management/visibility only

### Extension not appearing on storefront

- Check browser console for `[SSO Extension] Initialized` message
- Verify the script URL is accessible (not blocked by CSP)
- Check if your CIF sign-in form matches the detected selectors

### OAuth callback fails

- Ensure your Dispatcher allows `/sso/callback` requests through
- Verify the `redirect_uri` matches exactly what's configured in your Commerce OAuth app
- Check browser console for `[SSO Extension] Token exchange error` messages

---

## For Your GitHub Pages Deployment

Your extension is hosted at:

| Resource | URL |
|---|---|
| Extension Manager entry | `https://mo-magento-custom-plugin.github.io/aem-cif-sso-extension/web-src/index.html` |
| Storefront script | `https://mo-magento-custom-plugin.github.io/aem-cif-sso-extension/src/sso-extension.js` |
| Loader | `https://mo-magento-custom-plugin.github.io/aem-cif-sso-extension/dist/loader.js` |

Quick-start script tag for your storefront:

```html
<script
    src="https://mo-magento-custom-plugin.github.io/aem-cif-sso-extension/dist/loader.js"
    data-sso-extension
    data-authorize-url="YOUR_COMMERCE_AUTHORIZE_URL"
    data-token-url="YOUR_COMMERCE_TOKEN_URL"
    data-client-id="YOUR_CLIENT_ID"
    data-redirect-uri="https://publish-p184640-e1944798.adobeaemcloud.com/sso/callback"
    defer>
</script>
```

---

## License

Apache-2.0

import { getQfOAuthConfig } from "../_shared/qfOAuthConfig.js";
import { buildAuthorizationUrl } from "../_shared/qfAuth.js";

export async function onRequest(context) {
    const { env } = context;
    const config = getQfOAuthConfig(env);
    
    try {
        // Reuse the exact same registered callback URI!
        const REDIRECT_URI = "https://thematicquran.com/auth/callback";
        let { url, state, nonce, codeVerifier } = await buildAuthorizationUrl(env, {
            redirectUri: REDIRECT_URI,
            scopes: "offline_access user collection reading_session bookmark collection preference activity_day goal streak comment note"
        });
        
        // Append prompt=none to ensure no UI is shown
        url += "&prompt=none";
        
        const headers = new Headers();
        headers.append("Location", url);
        headers.append("Cache-Control", "no-store");
        
        // Persist PKCE and CSRF state using the SILENT prefix
        headers.append("Set-Cookie", `qf_silent_auth_state${config.cookieSuffix}=${state}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=300`);
        headers.append("Set-Cookie", `qf_silent_auth_nonce${config.cookieSuffix}=${nonce}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=300`);
        headers.append("Set-Cookie", `qf_silent_pkce_verifier${config.cookieSuffix}=${codeVerifier}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=300`);
        
        return new Response(null, {
            status: 302,
            headers: headers
        });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}

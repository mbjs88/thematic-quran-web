import { getQfOAuthConfig } from "../_shared/qfOAuthConfig.js";
import { buildAuthorizationUrl } from "../_shared/qfAuth.js";

export async function onRequest(context) {
    const { env } = context;
    const config = getQfOAuthConfig(env);
    
    try {
        const REDIRECT_URI = "https://thematicquran.com/auth/callback";
        const { url, state, nonce, codeVerifier } = await buildAuthorizationUrl(env, {
            redirectUri: REDIRECT_URI,
            scopes: "offline_access user collection reading_session"
        });
        
        const headers = new Headers();
        headers.append("Location", url);
        
        // Persist PKCE and CSRF state in secure HttpOnly cookies
        headers.append("Set-Cookie", `qf_auth_state${config.cookieSuffix}=${state}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=3600`);
        headers.append("Set-Cookie", `qf_auth_nonce${config.cookieSuffix}=${nonce}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=3600`);
        headers.append("Set-Cookie", `qf_pkce_verifier${config.cookieSuffix}=${codeVerifier}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=3600`);
        
        return new Response(null, {
            status: 302,
            headers: headers
        });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}

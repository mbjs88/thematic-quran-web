import { exchangeAuthorizationCode } from "../_shared/qfAuth.js";
import { getQfOAuthConfig } from "../_shared/qfOAuthConfig.js";

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const config = getQfOAuthConfig(env);
    
    // Exact match for the registered callback URI
    const REDIRECT_URI = "https://thematicquran.com/auth/callback";

    // 1. Check for JSON payload (Frontend/Native App + Backend Exchange flow)
    if (request.method === "POST" && request.headers.get("content-type")?.includes("application/json")) {
        try {
            const body = await request.json();
            const { code, codeVerifier } = body;
            
            if (!code || !codeVerifier) {
                return new Response(JSON.stringify({ error: "Missing code or codeVerifier in payload" }), { 
                    status: 400,
                    headers: { "Content-Type": "application/json" }
                });
            }

            const tokenData = await exchangeAuthorizationCode({
                env,
                code,
                redirectUri: REDIRECT_URI,
                codeVerifier
            });

            return new Response(JSON.stringify(tokenData), {
                status: 200,
                headers: { "Content-Type": "application/json" }
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: error.message }), { 
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }
    }

    // 2. Otherwise, handle standard Server-Initiated Web flow (GET callback)
    const code = url.searchParams.get("code");
    
    // Check if Quran.com returned an explicit error parameter (e.g. invalid scopes)
    const quranAuthError = url.searchParams.get("error");
    const quranAuthErrorDesc = url.searchParams.get("error_description");
    
    if (quranAuthError) {
        return new Response(`Quran Foundation Auth Error:\n\n${quranAuthError}\n${quranAuthErrorDesc || 'No description provided.'}\n\nPlease check your Developer Dashboard settings again.`, { status: 400 });
    }

    if (!code) {
        return new Response("Missing authorization code from Quran.com. Did you navigate here directly?", { status: 400 });
    }

    const cookieHeader = request.headers.get("Cookie") || "";
    let pkceVerifier = null;
    let authState = null;
    cookieHeader.split(";").forEach(cookie => {
        const parts = cookie.split("=");
        const name = parts[0] ? parts[0].trim() : "";
        if (name === `qf_pkce_verifier${config.cookieSuffix}`) {
            pkceVerifier = parts[1] ? parts[1].trim() : "";
        } else if (name === `qf_auth_state${config.cookieSuffix}`) {
            authState = parts[1] ? parts[1].trim() : "";
        }
    });

    if (!pkceVerifier || !authState) {
        return new Response("Security Error: Missing session cookies.", { status: 400 });
    }

    const stateParam = url.searchParams.get("state");
    if (!stateParam || stateParam !== authState) {
        return new Response("Security Error: CSRF state mismatch.", { status: 400 });
    }

    try {
        const tokenData = await exchangeAuthorizationCode({
            env,
            code,
            redirectUri: REDIRECT_URI,
            codeVerifier: pkceVerifier
        });

        const accessToken = tokenData.access_token;
        const refreshToken = tokenData.refresh_token;
        const headers = new Headers();
        
        headers.append("Set-Cookie", `quran_access_token${config.cookieSuffix}=${accessToken}; Path=/; Secure; SameSite=Lax; Max-Age=2592000`);
        if (refreshToken) {
            headers.append("Set-Cookie", `qf_refresh_token${config.cookieSuffix}=${refreshToken}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000`);
        }
        
        // Erase the temporary session cookies since they are fully spent
        headers.append("Set-Cookie", `qf_pkce_verifier${config.cookieSuffix}=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
        headers.append("Set-Cookie", `qf_auth_state${config.cookieSuffix}=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
        headers.append("Set-Cookie", `qf_auth_nonce${config.cookieSuffix}=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
        headers.append("Location", "/"); 

        return new Response(null, {
            status: 302,
            headers: headers
        });

    } catch (error) {
        // Output exactly "Failed to exchange authorization code for tokens" without leaking details.
        return new Response(error.message, { status: 400 });
    }
}
 
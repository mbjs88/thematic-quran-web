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
    const stateParam = url.searchParams.get("state");
    
    // Parse cookies
    const cookieHeader = request.headers.get("Cookie") || "";
    const cookies = {};
    cookieHeader.split(";").forEach(cookie => {
        const parts = cookie.split("=");
        if(parts.length >= 2) {
            cookies[parts[0].trim()] = parts.slice(1).join("=").trim();
        }
    });

    let isSilent = false;
    let pkceVerifier = null;
    let authState = null;

    // Detect if this is a silent login by matching the state parameter with the silent cookie state
    if (stateParam && stateParam === cookies[`qf_silent_auth_state${config.cookieSuffix}`]) {
        isSilent = true;
        authState = cookies[`qf_silent_auth_state${config.cookieSuffix}`];
        pkceVerifier = cookies[`qf_silent_pkce_verifier${config.cookieSuffix}`];
    } else {
        authState = cookies[`qf_auth_state${config.cookieSuffix}`];
        pkceVerifier = cookies[`qf_pkce_verifier${config.cookieSuffix}`];
    }

    // Helper to send response based on silent vs normal
    function respond(isSuccess, payload, headers = new Headers()) {
        if (isSilent) {
            headers.append("Content-Type", "text/html;charset=UTF-8");
            headers.append("Cache-Control", "no-store");
            const html = `
<!DOCTYPE html>
<html><head><title>Silent Auth</title></head><body>
<script>
    window.parent.postMessage({
        type: 'QURAN_SILENT_AUTH',
        success: ${isSuccess},
        error: ${!isSuccess ? JSON.stringify(payload) : 'null'}
    }, window.location.origin);
</script>
</body></html>`;
            return new Response(html, { status: 200, headers });
        } else {
            if (isSuccess) {
                headers.append("Location", "/"); 
                return new Response(null, { status: 302, headers });
            } else {
                return new Response(payload, { status: 400 });
            }
        }
    }

    // Check if Quran.com returned an explicit error parameter (e.g. invalid scopes, login_required)
    const quranAuthError = url.searchParams.get("error");
    const quranAuthErrorDesc = url.searchParams.get("error_description");
    
    if (quranAuthError) {
        if (isSilent) {
            return respond(false, quranAuthError);
        } else {
            return respond(false, `Quran Foundation Auth Error:\n\n${quranAuthError}\n${quranAuthErrorDesc || 'No description provided.'}\n\nPlease check your Developer Dashboard settings again.`);
        }
    }

    const code = url.searchParams.get("code");
    if (!code) {
        return respond(false, "Missing authorization code from Quran.com. Did you navigate here directly?");
    }

    if (!pkceVerifier || !authState || !stateParam || stateParam !== authState) {
        return respond(false, "Security Error: Missing session cookies or CSRF state mismatch.");
    }

    try {
        const tokenData = await exchangeAuthorizationCode({
            env,
            code,
            redirectUri: REDIRECT_URI, // still "https://thematicquran.com/auth/callback"
            codeVerifier: pkceVerifier
        });

        const accessToken = tokenData.access_token;
        const refreshToken = tokenData.refresh_token;
        const idToken = tokenData.id_token;
        const headers = new Headers();
        
        headers.append("Set-Cookie", `quran_access_token${config.cookieSuffix}=${accessToken}; Path=/; Secure; SameSite=Lax; Max-Age=2592000`);
        if (refreshToken) {
            headers.append("Set-Cookie", `qf_refresh_token${config.cookieSuffix}=${refreshToken}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000`);
        }
        if (idToken) {
            headers.append("Set-Cookie", `quran_id_token${config.cookieSuffix}=${idToken}; Path=/; Secure; SameSite=Lax; Max-Age=2592000`);
        }
        
        // Erase the temporary session cookies since they are fully spent
        if (isSilent) {
            headers.append("Set-Cookie", `qf_silent_pkce_verifier${config.cookieSuffix}=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
            headers.append("Set-Cookie", `qf_silent_auth_state${config.cookieSuffix}=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
            headers.append("Set-Cookie", `qf_silent_auth_nonce${config.cookieSuffix}=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
        } else {
            headers.append("Set-Cookie", `qf_pkce_verifier${config.cookieSuffix}=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
            headers.append("Set-Cookie", `qf_auth_state${config.cookieSuffix}=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
            headers.append("Set-Cookie", `qf_auth_nonce${config.cookieSuffix}=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
        }

        return respond(true, null, headers);

    } catch (error) {
        return respond(false, error.message);
    }
}

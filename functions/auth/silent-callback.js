import { exchangeAuthorizationCode } from "../_shared/qfAuth.js";
import { getQfOAuthConfig } from "../_shared/qfOAuthConfig.js";

function buildResponse(success, errorMsg = "", headers = new Headers()) {
    headers.append("Content-Type", "text/html;charset=UTF-8");
    headers.append("Cache-Control", "no-store");
    const html = `
<!DOCTYPE html>
<html>
<head><title>Silent Auth</title></head>
<body>
<script>
    window.parent.postMessage({
        type: 'QURAN_SILENT_AUTH',
        success: ${success},
        error: ${errorMsg ? JSON.stringify(errorMsg) : 'null'}
    }, window.location.origin);
</script>
</body>
</html>`;
    return new Response(html, { status: 200, headers });
}

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const config = getQfOAuthConfig(env);
    
    // Exact match for the registered callback URI
    const REDIRECT_URI = "https://thematicquran.com/auth/silent-callback";

    // 1. Check for errors (e.g. login_required, interaction_required)
    const quranAuthError = url.searchParams.get("error");
    if (quranAuthError) {
        return buildResponse(false, quranAuthError);
    }

    const code = url.searchParams.get("code");
    if (!code) {
        return buildResponse(false, "missing_code");
    }

    const cookieHeader = request.headers.get("Cookie") || "";
    let pkceVerifier = null;
    let authState = null;
    cookieHeader.split(";").forEach(cookie => {
        const parts = cookie.split("=");
        const name = parts[0] ? parts[0].trim() : "";
        if (name === `qf_silent_pkce_verifier${config.cookieSuffix}`) {
            pkceVerifier = parts[1] ? parts[1].trim() : "";
        } else if (name === `qf_silent_auth_state${config.cookieSuffix}`) {
            authState = parts[1] ? parts[1].trim() : "";
        }
    });

    if (!pkceVerifier || !authState) {
        return buildResponse(false, "missing_session");
    }

    const stateParam = url.searchParams.get("state");
    if (!stateParam || stateParam !== authState) {
        return buildResponse(false, "state_mismatch");
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
        headers.append("Set-Cookie", `qf_silent_pkce_verifier${config.cookieSuffix}=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
        headers.append("Set-Cookie", `qf_silent_auth_state${config.cookieSuffix}=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
        headers.append("Set-Cookie", `qf_silent_auth_nonce${config.cookieSuffix}=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);

        return buildResponse(true, "", headers);

    } catch (error) {
        return buildResponse(false, "token_exchange_failed");
    }
}

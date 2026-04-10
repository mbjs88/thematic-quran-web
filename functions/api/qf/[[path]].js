import { createQfApiClient } from "../../_shared/qfApiClient.js";
import { getQfOAuthConfig } from "../../_shared/qfOAuthConfig.js";

export async function onRequest(context) {
    const { request, env, params } = context;
    const config = getQfOAuthConfig(env);

    const cookieHeader = request.headers.get("Cookie") || "";
    let accessToken = null;
    let refreshToken = null;

    cookieHeader.split(";").forEach(cookie => {
        const parts = cookie.split("=");
        const name = parts[0] ? parts[0].trim() : "";
        if (name === `quran_access_token${config.cookieSuffix}`) {
            accessToken = parts[1] ? parts[1].trim() : "";
        } else if (name === `qf_refresh_token${config.cookieSuffix}`) {
            refreshToken = parts[1] ? parts[1].trim() : "";
        }
    });

    if (!accessToken) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
    }

    const responseHeaders = new Headers();
    responseHeaders.append("Content-Type", "application/json");

    const qfApi = createQfApiClient(env, {
        accessToken,
        refreshToken,
        onTokensRefreshed: async (newAccess, newRefresh) => {
            // Forward refreshed tokens back to client cookies safely alongside payload
            responseHeaders.append("Set-Cookie", `quran_access_token${config.cookieSuffix}=${newAccess}; Path=/; Secure; SameSite=Lax; Max-Age=2592000`);
            responseHeaders.append("Set-Cookie", `qf_refresh_token${config.cookieSuffix}=${newRefresh}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=2592000`);
        }
    });

    // Safely piece the path segments into the API string: /user, /profile, /me, etc
    const routeSegments = Array.isArray(params.path) ? params.path : [params.path];
    const routePath = `/${routeSegments.filter(Boolean).join('/')}`;
    
    try {
        const httpMethod = request.method;
        let qfResponse;
        
        if (httpMethod === 'GET') {
            qfResponse = await qfApi.get(routePath);
        } else if (httpMethod === 'POST') {
            const body = await request.json();
            qfResponse = await qfApi.post(routePath, body);
        } else {
            return new Response(JSON.stringify({ error: "Proxy method not supported" }), { status: 405, headers: responseHeaders });
        }

        const data = await qfResponse.text();
        return new Response(data, {
            status: qfResponse.status,
            headers: responseHeaders
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: responseHeaders });
    }
}

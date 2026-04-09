import { getQfOAuthConfig } from "../../_shared/qfOAuthConfig.js";

export async function onRequest(context) {
    try {
        const config = getQfOAuthConfig(context.env);
        return new Response(JSON.stringify({
            clientId: config.clientId,
            authBaseUrl: config.authBaseUrl
        }), {
            headers: { 
                "Content-Type": "application/json",
                // Disable caching to ensure config is always fresh
                "Cache-Control": "no-cache, no-store, must-revalidate"
            }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}

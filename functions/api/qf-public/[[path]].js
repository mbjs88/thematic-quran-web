import { getQfOAuthConfig } from "../../_shared/qfOAuthConfig.js";

// Public proxy for QF content API (tafsirs, verses, etc.)
// Does NOT require user auth — sends only x-client-id.
export async function onRequest(context) {
    const { request, env, params } = context;
    const config = getQfOAuthConfig(env);

    const urlObj = new URL(request.url);
    const routeSegments = Array.isArray(params.path) ? params.path : [params.path];
    const routePath = `/${routeSegments.filter(Boolean).join('/')}${urlObj.search}`;

    const upstreamUrl = `${config.apiBaseUrl}${routePath}`;

    const headers = new Headers();
    headers.set('x-client-id', config.clientId);

    try {
        const res = await fetch(upstreamUrl, { method: 'GET', headers });
        const body = await res.text();
        return new Response(body, {
            status: res.status,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

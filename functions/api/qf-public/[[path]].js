// Public proxy for Quran.com content API (tafsirs, verses, etc.)
// No user auth required — forwards directly to the public quran.com API.
export async function onRequest(context) {
    const { request, params } = context;

    const urlObj = new URL(request.url);
    const routeSegments = Array.isArray(params.path) ? params.path : [params.path];
    const routePath = `/${routeSegments.filter(Boolean).join('/')}${urlObj.search}`;

    const upstreamUrl = `https://api.quran.com${routePath}`;

    try {
        const res = await fetch(upstreamUrl, { method: 'GET' });
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

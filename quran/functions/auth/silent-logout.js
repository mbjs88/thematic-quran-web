import { getQfOAuthConfig } from "../_shared/qfOAuthConfig.js";

export async function onRequest(context) {
    const { env } = context;
    const config = getQfOAuthConfig(env);

    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.append("Set-Cookie", `quran_access_token${config.cookieSuffix}=; Path=/; Secure; SameSite=Lax; Max-Age=0`);
    headers.append("Set-Cookie", `quran_id_token${config.cookieSuffix}=; Path=/; Secure; SameSite=Lax; Max-Age=0`);
    headers.append("Set-Cookie", `qf_refresh_token${config.cookieSuffix}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

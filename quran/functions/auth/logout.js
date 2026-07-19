import { getQfOAuthConfig } from "../_shared/qfOAuthConfig.js";

export async function onRequest(context) {
    const { env } = context;
    const config = getQfOAuthConfig(env);

    const headers = new Headers();
    // Invalidate main access token cookie
    headers.append("Set-Cookie", `quran_access_token${config.cookieSuffix}=; Path=/; Secure; SameSite=Lax; Max-Age=0`);
    
    // Invalidate id_token cookie
    headers.append("Set-Cookie", `quran_id_token${config.cookieSuffix}=; Path=/; Secure; SameSite=Lax; Max-Age=0`);
    
    // Invalidate refresh token HttpOnly cookie
    headers.append("Set-Cookie", `qf_refresh_token${config.cookieSuffix}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`);
    
    // Add redirect location back to homepage
    headers.append("Location", "/");

    return new Response(null, {
        status: 302,
        headers: headers
    });
}

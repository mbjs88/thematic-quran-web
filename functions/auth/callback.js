export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    if (!code) {
        return new Response("Missing authorization code from Quran.com", { status: 400 });
    }

    // Attempt to extract the PKCE wrapper code left by the frontend
    const cookieHeader = request.headers.get("Cookie") || "";
    let pkceVerifier = null;
    cookieHeader.split(";").forEach(cookie => {
        const parts = cookie.split("=");
        if (parts[0].trim() === "qf_pkce_verifier") {
            pkceVerifier = parts[1].trim();
        }
    });

    if (!pkceVerifier) {
        return new Response("Security Error: Missing PKCE Verifier Cookie in callback.", { status: 400 });
    }

    const CLIENT_ID = env.QURAN_CLIENT_ID || '9791e50d-b76c-494e-a625-f5ea7de386ba';
    const CLIENT_SECRET = env.QURAN_CLIENT_SECRET || 'pEiQIH6pjpIwsjhP6dxa0c1.Xn';
    
    // Exact match for the registered callback URI
    const REDIRECT_URI = "https://thematicquran.com/auth/callback";

    try {
        const tokenResponse = await fetch("https://oauth2.quran.foundation/oauth2/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                grant_type: "authorization_code",
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI,
                code: code,
                code_verifier: pkceVerifier
            })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            return new Response(`Failed to fetch token: ${JSON.stringify(tokenData)}`, { status: tokenResponse.status });
        }

        const accessToken = tokenData.access_token;
        const headers = new Headers();
        
        headers.append("Set-Cookie", `quran_access_token=${accessToken}; Path=/; Secure; SameSite=Lax; Max-Age=2592000`);
        // Erase the temporary PKCE verifier cookie since it is fully spent
        headers.append("Set-Cookie", `qf_pkce_verifier=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
        headers.append("Location", "/"); 

        return new Response(null, {
            status: 302,
            headers: headers
        });

    } catch (error) {
        return new Response("Internal Server Error: " + error.message, { status: 500 });
    }
}

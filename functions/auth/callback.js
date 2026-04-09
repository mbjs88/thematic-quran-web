export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    if (!code) {
        return new Response("Missing authorization code from Quran.com", { status: 400 });
    }

    // You can manage these environment variables in your Cloudflare Pages dashboard.
    // We fall back to the provided ones, although setting the SECRET in the dashboard is safer long-term.
    const CLIENT_ID = env.QURAN_CLIENT_ID || '9791e50d-b76c-494e-a625-f5ea7de386ba';
    const CLIENT_SECRET = env.QURAN_CLIENT_SECRET || 'pEiQIH6pjpIwsjhP6dxa0c1.Xn';
    
    // The redirect URI must perfectly match what was sent in the authorization request
    const REDIRECT_URI = "https://thematicquran.com/auth/callback";

    try {
        // Exchange the authorization code for an access token
        const tokenResponse = await fetch("https://quran.com/oauth/token", {
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
                code: code
            })
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            return new Response(`Failed to fetch token: ${JSON.stringify(tokenData)}`, { status: tokenResponse.status });
        }

        const accessToken = tokenData.access_token;

        // Redirect the user back to the main app interface, passing the token safely in a cookie.
        // We do NOT set HttpOnly so that app.js can read it and attach it to future Quran.com API requests.
        const headers = new Headers();
        
        // Pass token to the frontend. It is valid for the whole domain.
        // In local development, 'Secure' requires HTTPS. Set conditionally if needed.
        headers.append("Set-Cookie", `quran_access_token=${accessToken}; Path=/; Secure; SameSite=Lax; Max-Age=2592000`);
        headers.append("Location", "/"); 

        return new Response(null, {
            status: 302,
            headers: headers
        });

    } catch (error) {
        return new Response("Internal Server Error: " + error.message, { status: 500 });
    }
}

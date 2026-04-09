export function getQfOAuthConfig(env) {
    const clientId = env.QF_CLIENT_ID;
    const clientSecret = env.QF_CLIENT_SECRET;
    const qfEnv = env.QF_ENV || 'prelive';

    if (!clientId) {
        throw new Error("Missing Quran Foundation API credentials. Request access: https://api-docs.quran.foundation/request-access");
    }

    let authBaseUrl, apiBaseUrl;
    if (qfEnv === 'production') {
        authBaseUrl = 'https://oauth2.quran.foundation';
        apiBaseUrl = 'https://apis.quran.foundation';
    } else {
        authBaseUrl = 'https://prelive-oauth2.quran.foundation';
        apiBaseUrl = 'https://apis-prelive.quran.foundation';
    }

    // Explicitly note whether this integration is using a public client or a confidential client
    const isPublicClient = !clientSecret;

    return {
        env: qfEnv,
        clientId,
        clientSecret,
        authBaseUrl,
        apiBaseUrl,
        isPublicClient,
        cookieSuffix: `_${qfEnv}`
    };
}

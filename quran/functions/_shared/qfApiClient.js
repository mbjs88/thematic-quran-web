import { getQfOAuthConfig } from './qfOAuthConfig.js';
import { refreshAccessToken } from './qfAuth.js';

export function createQfApiClient(env, { accessToken, refreshToken, onTokensRefreshed } = {}) {
    const config = getQfOAuthConfig(env);
    
    let currentAccessToken = accessToken;
    let currentRefreshToken = refreshToken;
    let refreshPromise = null;

    async function req(endpoint, options = {}) {
        let url = `${config.apiBaseUrl}${endpoint}`;
        
        const headers = new Headers(options.headers || {});
        headers.set('x-client-id', config.clientId);
        
        if (currentAccessToken) {
            headers.set('x-auth-token', currentAccessToken);
        }

        let response = await fetch(url, { ...options, headers });

        if (response.status === 401 && currentRefreshToken) {
            // Attempt to refresh exactly once if a refresh_token is available
            try {
                if (!refreshPromise) {
                    refreshPromise = refreshAccessToken({
                        env, 
                        refreshToken: currentRefreshToken
                    }).then(async (newTokens) => {
                        currentAccessToken = newTokens.access_token;
                        if (newTokens.refresh_token) {
                            currentRefreshToken = newTokens.refresh_token;
                        }
                        if (onTokensRefreshed) {
                            await onTokensRefreshed(currentAccessToken, currentRefreshToken);
                        }
                    }).finally(() => {
                        refreshPromise = null;
                    });
                }
                
                // Allow concurrent requests to await the single active refresh
                await refreshPromise;

                // Retry original request exactly once
                headers.set('x-auth-token', currentAccessToken);
                response = await fetch(url, { ...options, headers });
            } catch (err) {
                // Do not loop infinite retries, just eat the failure and throw
                throw new Error("Failed to refresh access token");
            }
        }

        if (!response.ok) {
            let errSnippet = '';
            try {
                const cloned = response.clone();
                const text = await cloned.text();
                errSnippet = text.substring(0, 100).replace(/\s+/g, ' ');
            } catch(e) {}
            
            console.error(`[API Error] Env: ${config.env} | Path: /auth/v1${endpoint} | Status: ${response.status} | Body: ${errSnippet}`);
            // Explicitly do not throw here. Allow the literal Quran.com Response to map back seamlessly to the client.
        }

        return response;
    }

    return {
        get: (endpoint, options = {}) => req(endpoint, { ...options, method: 'GET' }),
        post: (endpoint, body, options = {}) => req(endpoint, { ...options, method: 'POST', body: JSON.stringify(body), headers: { ...options.headers, 'Content-Type': 'application/json' } }),
        put: (endpoint, body, options = {}) => req(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body), headers: { ...options.headers, 'Content-Type': 'application/json' } }),
        delete: (endpoint, options = {}) => req(endpoint, { ...options, method: 'DELETE' }),
        fetch: req,
        
        // Exposed securely if logic requires inspecting internal state (without logging it)
        getCurrentTokens: () => ({ accessToken: currentAccessToken, refreshToken: currentRefreshToken })
    };
}

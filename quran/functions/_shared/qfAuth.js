import { getQfOAuthConfig } from './qfOAuthConfig.js';

async function handleOAuthError(response, contextMessage, env) {
    let errCode = 'unknown_error';
    try {
        const cloned = response.clone();
        const body = await cloned.json();
        if (body.error) errCode = body.error;
    } catch (e) {}

    // Safe diagnostics logging
    console.error(`[OAuth2 Error] Env: ${env} | Status: ${response.status} | Code: ${errCode}`);

    let hint = "An unknown error occurred.";
    switch (errCode) {
        case 'invalid_client':
            hint = "wrong client type, using a public-client example with a confidential client, missing secret for a confidential client, wrong client_id/secret, or wrong environment";
            break;
        case 'invalid_grant':
            hint = "code/refresh_token invalid, expired, already used, or clock skew";
            break;
        case 'redirect_uri_mismatch':
            hint = "redirect URI differs from registered value";
            break;
        case 'invalid_scope':
            hint = "scope is misspelled or not allowed";
            break;
    }

    throw new Error(`${contextMessage}: ${hint}`);
}

function base64URLEncode(buffer) {
    return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

function generateRandomString(length) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function buildAuthorizationUrl(env, { redirectUri, scopes }) {
    const config = getQfOAuthConfig(env);
    
    // 1. Generate random params
    const state = generateRandomString(16);
    const nonce = generateRandomString(16);
    
    // 2. Generate PKCE verifier and challenge
    const verifierBytes = new Uint8Array(32);
    crypto.getRandomValues(verifierBytes);
    const codeVerifier = base64URLEncode(verifierBytes);
    
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const hashed = await crypto.subtle.digest('SHA-256', data);
    const codeChallenge = base64URLEncode(hashed);
    
    // 3. Build URL
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: redirectUri,
        scope: scopes || 'offline_access user collection',
        state: state,
        nonce: nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256'
    });
    
    const url = `${config.authBaseUrl}/oauth2/auth?${params.toString()}`;
    
    return {
        url,
        state,
        nonce,
        codeVerifier
    };
}

export async function exchangeAuthorizationCode({ env, code, redirectUri, codeVerifier, isConfidential }) {
    const config = getQfOAuthConfig(env);
    
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', redirectUri);
    params.append('code', code);
    
    if (codeVerifier) {
        params.append('code_verifier', codeVerifier);
    }
    
    const confidential = isConfidential !== undefined ? isConfidential : !config.isPublicClient;

    if (!confidential) {
        params.append('client_id', config.clientId);
    }

    const fetchHeaders = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
    };

    if (confidential) {
        const credentials = btoa(`${config.clientId}:${config.clientSecret}`);
        fetchHeaders['Authorization'] = `Basic ${credentials}`;
    }

    let response;
    try {
        response = await fetch(`${config.authBaseUrl}/oauth2/token`, {
            method: 'POST',
            headers: fetchHeaders,
            body: params.toString()
        });
    } catch (e) {
        throw new Error("Failed to exchange authorization code for tokens");
    }

    if (!response.ok) {
        await handleOAuthError(response, "Failed to exchange authorization code for tokens", config.env);
    }

    const data = await response.json();
    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        id_token: data.id_token,
        expires_in: data.expires_in,
        scope: data.scope,
        token_type: data.token_type
    };
}

export async function refreshAccessToken({ env, refreshToken, isConfidential }) {
    const config = getQfOAuthConfig(env);
    
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    
    const confidential = isConfidential !== undefined ? isConfidential : !config.isPublicClient;

    if (!confidential) {
        params.append('client_id', config.clientId);
    }

    const fetchHeaders = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
    };

    if (confidential) {
        const credentials = btoa(`${config.clientId}:${config.clientSecret}`);
        fetchHeaders['Authorization'] = `Basic ${credentials}`;
    }

    let response;
    try {
        response = await fetch(`${config.authBaseUrl}/oauth2/token`, {
            method: 'POST',
            headers: fetchHeaders,
            body: params.toString()
        });
    } catch (e) {
        throw new Error("Failed to refresh access token");
    }

    if (!response.ok) {
        await handleOAuthError(response, "Failed to refresh access token", config.env);
    }

    const data = await response.json();
    return {
        access_token: data.access_token,
        // The spec allows returning a new refresh token, or continuing tracking the old one
        refresh_token: data.refresh_token || refreshToken,
        id_token: data.id_token,
        expires_in: data.expires_in,
        scope: data.scope,
        token_type: data.token_type
    };
}


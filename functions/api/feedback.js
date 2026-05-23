const ALLOWED_TYPES = new Set([
    "bug",
    "theme-search",
    "audio",
    "account-sync",
    "content",
    "suggestion",
    "other"
]);

const MAX_MESSAGE_LENGTH = 4000;
const MAX_CONTACT_LENGTH = 200;
const MAX_CONTEXT_LENGTH = 12000;
const RATE_LIMIT_PER_HOUR = 5;

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-store"
        }
    });
}

function cleanText(value, maxLength, { multiline = false } = {}) {
    if (typeof value !== "string") return "";
    const normalized = multiline
        ? value.replace(/\r\n?/g, "\n").trim()
        : value.replace(/\s+/g, " ").trim();
    return normalized.slice(0, maxLength);
}

function cleanContext(context) {
    if (!context || typeof context !== "object" || Array.isArray(context)) return {};
    const allowed = [
        "source",
        "pageUrl",
        "viewMode",
        "surah",
        "themeQuery",
        "thematicQueryToken",
        "referrer",
        "userAgent",
        "viewport",
        "language",
        "timezone",
        "submittedAt"
    ];
    const cleaned = {};
    allowed.forEach((key) => {
        const value = context[key];
        if (typeof value === "string" && value.trim()) {
            cleaned[key] = cleanText(value, 1000);
        }
    });

    const serialized = JSON.stringify(cleaned);
    if (serialized.length <= MAX_CONTEXT_LENGTH) return cleaned;
    return {
        source: cleaned.source || "",
        pageUrl: cleaned.pageUrl || "",
        submittedAt: cleaned.submittedAt || "",
        truncated: "true"
    };
}

async function hashRateKey(request, env) {
    const ip = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || "unknown";
    const salt = env.FEEDBACK_RATE_SALT || "thematic-quran-feedback";
    const data = new TextEncoder().encode(`${salt}:${ip}`);
    const digest = await crypto.subtle.digest("SHA-256", data);
    const bytes = Array.from(new Uint8Array(digest));
    return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function checkRateLimit(store, request, env) {
    const key = `feedback-rate:${await hashRateKey(request, env)}`;
    const current = parseInt(await store.get(key) || "0", 10);
    if (current >= RATE_LIMIT_PER_HOUR) return false;
    await store.put(key, String(current + 1), { expirationTtl: 60 * 60 });
    return true;
}

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Allow": "POST, OPTIONS",
                "Cache-Control": "no-store"
            }
        });
    }

    if (request.method !== "POST") {
        return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
    }

    const store = env.FEEDBACK_STORE;
    if (!store || typeof store.put !== "function") {
        return jsonResponse({
            ok: false,
            error: "Feedback storage is not configured yet."
        }, 503);
    }

    let body;
    try {
        body = await request.json();
    } catch (error) {
        return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
    }

    if (body.website) {
        return jsonResponse({ ok: true, id: null });
    }

    const type = ALLOWED_TYPES.has(body.type) ? body.type : "other";
    const message = cleanText(body.message, MAX_MESSAGE_LENGTH, { multiline: true });
    const contact = cleanText(body.contact, MAX_CONTACT_LENGTH);
    const contextData = cleanContext(body.context);

    if (message.length < 10) {
        return jsonResponse({ ok: false, error: "Please include at least 10 characters of feedback." }, 400);
    }

    if (contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) {
        return jsonResponse({ ok: false, error: "Please enter a valid email address, or leave it blank." }, 400);
    }

    const withinLimit = await checkRateLimit(store, request, env);
    if (!withinLimit) {
        return jsonResponse({ ok: false, error: "Too many feedback messages from this connection. Please try again later." }, 429);
    }

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const record = {
        id,
        createdAt,
        type,
        status: "new",
        message,
        contact: contact || null,
        context: contextData,
        schemaVersion: 1
    };

    await store.put(`feedback:${createdAt}:${id}`, JSON.stringify(record), {
        metadata: {
            type,
            hasContact: Boolean(contact),
            source: contextData.source || "unknown"
        }
    });

    return jsonResponse({ ok: true, id }, 201);
}

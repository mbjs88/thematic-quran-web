const STATUSES = new Set(["new", "reviewed", "planned", "done", "ignored", "scam"]);
const TYPES = new Set(["bug", "theme-search", "audio", "account-sync", "content", "suggestion", "other"]);
const GEMINI_MODEL = "gemini-3.5-flash";

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

function requireAdmin(request, env) {
    const configured = env.FEEDBACK_ADMIN_TOKEN;
    if (!configured) return { ok: false, response: jsonResponse({ ok: false, error: "Feedback admin token is not configured." }, 503) };
    const header = request.headers.get("Authorization") || "";
    const bearer = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
    const fallback = request.headers.get("X-Feedback-Admin-Token") || "";
    if (bearer === configured || fallback === configured) return { ok: true };
    return { ok: false, response: jsonResponse({ ok: false, error: "Unauthorized" }, 401) };
}

async function listAllFeedback(store) {
    const items = [];
    let cursor;
    do {
        const page = await store.list({ prefix: "feedback:", cursor, limit: 1000 });
        for (const keyInfo of page.keys || []) {
            if (keyInfo.name.startsWith("feedback-rate:")) continue;
            const raw = await store.get(keyInfo.name);
            if (!raw) continue;
            try {
                const record = JSON.parse(raw);
                items.push({
                    key: keyInfo.name,
                    ...record,
                    status: record.status || "new"
                });
            } catch (error) {
                items.push({
                    key: keyInfo.name,
                    id: keyInfo.name,
                    createdAt: "",
                    status: "new",
                    type: "other",
                    message: "[Unreadable feedback record]",
                    parseError: true
                });
            }
        }
        cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function getPeriodStart(period, now = new Date()) {
    const day = 24 * 60 * 60 * 1000;
    if (period === "7d") return new Date(now.getTime() - 7 * day);
    if (period === "30d") return new Date(now.getTime() - 30 * day);
    if (period === "this-week") {
        const start = new Date(now);
        const dayOfWeek = start.getDay() || 7;
        start.setDate(start.getDate() - dayOfWeek + 1);
        start.setHours(0, 0, 0, 0);
        return start;
    }
    if (period === "last-month") {
        return new Date(now.getFullYear(), now.getMonth() - 1, 1);
    }
    return null;
}

function getPeriodEnd(period, now = new Date()) {
    if (period === "last-month") return new Date(now.getFullYear(), now.getMonth(), 1);
    return null;
}

function filterFeedback(items, filters = {}) {
    const status = filters.status || "all";
    const type = filters.type || "all";
    const period = filters.period || "all";
    const query = cleanText(filters.query || "", 200).toLowerCase();
    const start = filters.from ? new Date(filters.from) : getPeriodStart(period);
    const end = filters.to ? new Date(filters.to) : getPeriodEnd(period);

    return items.filter((item) => {
        if (status !== "all" && item.status !== status) return false;
        if (type !== "all" && item.type !== type) return false;
        if (start || end) {
            const created = new Date(item.createdAt || 0);
            if (start && created < start) return false;
            if (end && created >= end) return false;
        }
        if (query) {
            const haystack = `${item.message || ""} ${item.contact || ""} ${item.context?.themeQuery || ""} ${item.context?.pageUrl || ""}`.toLowerCase();
            if (!haystack.includes(query)) return false;
        }
        return true;
    });
}

function buildSummaryPrompt(items, filters) {
    const compactItems = items.slice(0, 150).map((item) => ({
        key: item.key,
        id: item.id,
        createdAt: item.createdAt,
        type: item.type,
        status: item.status || "new",
        contactProvided: Boolean(item.contact),
        message: item.message,
        context: {
            source: item.context?.source || "",
            pageUrl: item.context?.pageUrl || "",
            viewMode: item.context?.viewMode || "",
            surah: item.context?.surah || "",
            themeQuery: item.context?.themeQuery || "",
            viewport: item.context?.viewport || "",
            timezone: item.context?.timezone || ""
        }
    }));

    return [
        "You are triaging feedback for Thematic Qur'an, a Quran study and listening web app.",
        "Summarise only the supplied feedback records. Do not invent user reports.",
        "Detect scams/spam/phishing/SEO outreach/generic marketing messages and exclude them from product recommendations.",
        "Return strict JSON with this shape:",
        "{",
        '  "headline": "short summary",',
        '  "scope": "what was summarised",',
        '  "totalRecords": 0,',
        '  "usableRecords": 0,',
        '  "scamExcluded": 0,',
        '  "scamKeys": ["feedback:..."],',
        '  "actionablePoints": [{"title":"", "priority":"high|medium|low", "count":0, "evidenceKeys":["feedback:..."], "recommendation":""}],',
        '  "bugs": [{"title":"", "evidenceKeys":["feedback:..."], "nextStep":""}],',
        '  "themeSearchIssues": [{"title":"", "evidenceKeys":["feedback:..."], "nextStep":""}],',
        '  "quickWins": ["short actionable item"],',
        '  "needsReply": [{"key":"feedback:...", "reason":"", "suggestedReply":""}],',
        '  "patterns": ["short recurring pattern"]',
        "}",
        "Prioritise concrete actions over sentiment. Keep recommendations specific and implementable.",
        `Filters: ${JSON.stringify(filters)}`,
        `Records: ${JSON.stringify(compactItems)}`
    ].join("\n");
}

function extractGeminiText(data) {
    return data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
}

function parseJsonResponse(text) {
    const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    return JSON.parse(trimmed);
}

async function callGemini(env, items, filters) {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not configured.");
    const model = env.GEMINI_FEEDBACK_MODEL || GEMINI_MODEL;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
            contents: [{
                role: "user",
                parts: [{ text: buildSummaryPrompt(items, filters) }]
            }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error?.message || `Gemini request failed with ${response.status}`);
    }
    const text = extractGeminiText(data);
    if (!text) throw new Error("Gemini returned an empty summary.");
    return parseJsonResponse(text);
}

async function markScams(store, summary, allItems) {
    const scamKeys = Array.isArray(summary?.scamKeys) ? new Set(summary.scamKeys) : new Set();
    if (!scamKeys.size) return 0;
    let changed = 0;
    for (const item of allItems) {
        if (!scamKeys.has(item.key)) continue;
        const next = {
            ...item,
            status: "scam",
            updatedAt: new Date().toISOString()
        };
        delete next.key;
        await store.put(item.key, JSON.stringify(next), {
            metadata: {
                type: next.type || "other",
                status: "scam",
                hasContact: Boolean(next.contact),
                source: next.context?.source || "unknown"
            }
        });
        changed++;
    }
    return changed;
}

async function handleList(request, store) {
    const url = new URL(request.url);
    const allItems = await listAllFeedback(store);
    const filtered = filterFeedback(allItems, {
        status: url.searchParams.get("status") || "all",
        type: url.searchParams.get("type") || "all",
        period: url.searchParams.get("period") || "all",
        from: url.searchParams.get("from") || "",
        to: url.searchParams.get("to") || "",
        query: url.searchParams.get("query") || ""
    });
    return jsonResponse({
        ok: true,
        total: allItems.length,
        count: filtered.length,
        items: filtered.slice(0, 500)
    });
}

async function handleUpdate(request, store) {
    const body = await request.json().catch(() => ({}));
    const key = cleanText(body.key, 300);
    const status = cleanText(body.status, 40);
    if (!key.startsWith("feedback:")) return jsonResponse({ ok: false, error: "Invalid feedback key." }, 400);
    if (!STATUSES.has(status)) return jsonResponse({ ok: false, error: "Invalid status." }, 400);

    const raw = await store.get(key);
    if (!raw) return jsonResponse({ ok: false, error: "Feedback record not found." }, 404);
    const record = JSON.parse(raw);
    const next = {
        ...record,
        status,
        adminNote: cleanText(body.adminNote, 1000, { multiline: true }) || record.adminNote || "",
        updatedAt: new Date().toISOString()
    };
    await store.put(key, JSON.stringify(next), {
        metadata: {
            type: next.type || "other",
            status,
            hasContact: Boolean(next.contact),
            source: next.context?.source || "unknown"
        }
    });
    return jsonResponse({ ok: true, item: { key, ...next } });
}

async function handleSummarise(request, env, store) {
    const body = await request.json().catch(() => ({}));
    const filters = {
        status: body.status || "new",
        type: body.type || "all",
        period: body.period || "7d",
        from: body.from || "",
        to: body.to || "",
        query: body.query || ""
    };
    const allItems = await listAllFeedback(store);
    const filtered = filterFeedback(allItems, filters);
    if (!filtered.length) {
        return jsonResponse({ ok: true, summary: { headline: "No matching feedback.", totalRecords: 0, usableRecords: 0, scamExcluded: 0, actionablePoints: [], bugs: [], themeSearchIssues: [], quickWins: [], needsReply: [], patterns: [], scamKeys: [] } });
    }
    const summary = await callGemini(env, filtered, filters);
    const markedScams = body.autoMarkScam === false ? 0 : await markScams(store, summary, allItems);
    return jsonResponse({ ok: true, summary, markedScams, model: env.GEMINI_FEEDBACK_MODEL || GEMINI_MODEL });
}

export async function onRequest(context) {
    const { request, env } = context;
    const auth = requireAdmin(request, env);
    if (!auth.ok) return auth.response;

    const store = env.FEEDBACK_STORE;
    if (!store || typeof store.put !== "function") {
        return jsonResponse({ ok: false, error: "Feedback storage is not configured yet." }, 503);
    }

    try {
        if (request.method === "GET") return handleList(request, store);
        if (request.method === "PATCH") return handleUpdate(request, store);
        if (request.method === "POST") return handleSummarise(request, env, store);
        return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
    } catch (error) {
        return jsonResponse({ ok: false, error: error.message || "Feedback admin request failed." }, 500);
    }
}

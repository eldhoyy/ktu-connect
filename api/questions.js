const crypto = require("crypto");
const { getSession, sameOrigin, json } = require("../lib/admin-auth");

async function redis(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Community database is not configured yet.");
  const response = await fetch(url.replace(/\/$/, ""), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command)
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || "Community database request failed.");
  return data.result;
}

async function list(key) {
  const values = await redis(["LRANGE", key, "0", "-1"]);
  return (values || []).map(value => { try { return JSON.parse(value); } catch (_) { return null; } }).filter(Boolean);
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const approved = await list("ktu:questions:approved");
      if (req.query.includePending === "1") {
        const session = getSession(req);
        if (!session) return json(res, 401, { error: "Administrator sign-in required." });
        return json(res, 200, { approved, pending: await list("ktu:questions:pending") });
      }
      return json(res, 200, { approved });
    }
    if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." });
    if (!sameOrigin(req)) return json(res, 403, { error: "Request origin rejected." });
    const body = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");

    if (body.action === "submit") {
      const question = body.question || {};
      const title = String(question.title || "").trim();
      const detail = String(question.detail || "").trim();
      const author = String(question.author || "Anonymous Student").trim();
      const branch = String(question.branch || "KTU Student").trim();
      const category = String(question.category || "General").trim();
      if (title.length < 5 || title.length > 180) return json(res, 400, { error: "Question title must be between 5 and 180 characters." });
      if (detail.length > 4000 || author.length > 60 || branch.length > 60 || category.length > 40) return json(res, 400, { error: "One or more fields are too long." });
      const ip = String(req.headers["x-forwarded-for"] || "unknown").split(",")[0].trim();
      const key = crypto.createHash("sha256").update(ip).digest("hex").slice(0, 24);
      const count = await redis(["INCR", `ktu:qa:rate:${key}`]);
      if (Number(count) === 1) await redis(["EXPIRE", `ktu:qa:rate:${key}`, 3600]);
      if (Number(count) > 5) return json(res, 429, { error: "Too many submissions. Please try again in an hour." });
      const item = {
        id: `q-${crypto.randomUUID()}`, category, title, detail,
        author: author || "Anonymous Student", branch: branch || "KTU Student",
        status: "pending", createdAt: new Date().toISOString()
      };
      await redis(["LPUSH", "ktu:questions:pending", JSON.stringify(item)]);
      return json(res, 201, { success: true, question: item });
    }

    const session = getSession(req);
    if (!session) return json(res, 401, { error: "Administrator sign-in required." });
    const pending = await list("ktu:questions:pending");
    const target = pending.find(item => item.id === body.id);
    if (!target) return json(res, 404, { error: "That question is no longer pending." });

    if (body.action === "approve") {
      const answer = String(body.answer || "").trim();
      if (!answer || answer.length > 5000) return json(res, 400, { error: "Please enter an answer (up to 5,000 characters)." });
      const question = { ...target, status: "approved", answer, answeredAt: new Date().toISOString() };
      await redis(["LPUSH", "ktu:questions:approved", JSON.stringify(question)]);
      await redis(["LREM", "ktu:questions:pending", "1", JSON.stringify(target)]);
      return json(res, 200, { success: true, question });
    }
    if (body.action === "delete") {
      await redis(["LREM", "ktu:questions:pending", "1", JSON.stringify(target)]);
      return json(res, 200, { success: true });
    }
    return json(res, 400, { error: "Unknown question action." });
  } catch (error) {
    console.error("Questions API error:", error.message);
    return json(res, 503, { error: error.message || "Community service is temporarily unavailable." });
  }
};

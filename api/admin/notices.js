const crypto = require("crypto");
const { getSession, sameOrigin, json } = require("../../lib/admin-auth");

const OWNER = "eldhoyy";
const REPO = "ktu-connect";
const FILE_PATH = "notices-store.json";
const API = "https://api.github.com";

async function github(token, path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `GitHub API returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function validateNotice(input) {
  if (!input || typeof input !== "object") throw new Error("Notice details are missing.");
  const title = String(input.title || "").trim();
  const date = String(input.date || "").trim();
  const link = String(input.link || "").trim();
  const details = String(input.details || "").trim();
  const tags = Array.isArray(input.tags) ? input.tags.map(x => String(x).trim()).filter(Boolean) : [];
  if (!title || title.length > 200) throw new Error("Headline is required and must be under 200 characters.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) throw new Error("Please provide a valid notice date.");
  if (details.length > 5000) throw new Error("Notice details are too long.");
  if (tags.length > 10 || tags.some(tag => tag.length > 40)) throw new Error("Please use up to 10 short tags.");
  let parsed;
  try { parsed = new URL(link); } catch (_) { throw new Error("Please provide a valid official link."); }
  if (parsed.protocol !== "https:") throw new Error("Notice links must use HTTPS.");
  return { title, date, link, details, tags };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." });
  if (!sameOrigin(req)) return json(res, 403, { error: "Request origin rejected." });
  const session = getSession(req);
  if (!session) return json(res, 401, { error: "Please sign in as the KTU Connect admin." });

  try {
    const body = typeof req.body === "object" && req.body ? req.body : JSON.parse(req.body || "{}");
    const file = await github(session.accessToken, `/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=main`).catch(error => {
      if (error.status === 404) return null;
      throw error;
    });
    const notices = file ? JSON.parse(Buffer.from(file.content, "base64").toString("utf8")) : [];
    if (!Array.isArray(notices)) throw new Error("The notice store has an invalid format.");

    let result;
    const now = new Date().toISOString();
    if (body.action === "migrateLegacy") {
      const legacyUrl = process.env.LEGACY_NOTICES_URL;
      if (!legacyUrl) return json(res, 400, { error: "Temporary legacy notice source is not configured." });
      const parsedLegacyUrl = new URL(legacyUrl);
      const allowedHost = parsedLegacyUrl.hostname.endsWith(".firebasedatabase.app") || parsedLegacyUrl.hostname.endsWith(".firebaseio.com");
      if (!allowedHost || !parsedLegacyUrl.pathname.endsWith("/ktu_notices.json") || parsedLegacyUrl.protocol !== "https:") {
        return json(res, 400, { error: "Legacy notice source URL is not valid." });
      }
      const legacyResponse = await fetch(parsedLegacyUrl.toString(), { cache: "no-store" });
      if (!legacyResponse.ok) throw new Error("Could not retrieve the previous notice feed.");
      const legacyData = await legacyResponse.json();
      if (!legacyData || typeof legacyData !== "object") throw new Error("The previous notice feed has an invalid format.");
      const entries = Array.isArray(legacyData) ? legacyData.map((value, index) => [String(index), value]) : Object.entries(legacyData);
      const existingIds = new Set(notices.map(item => item.id));
      let imported = 0;
      for (const [legacyId, value] of entries) {
        if (!value || typeof value !== "object" || existingIds.has(legacyId)) continue;
        const dateValue = String(value.date || value.createdAt || "").slice(0, 10);
        const tagsValue = Array.isArray(value.tags) ? value.tags : (typeof value.tags === "string" ? value.tags.split(",").map(tag => tag.trim()) : ["General"]);
        const clean = validateNotice({
          title: value.title,
          date: dateValue,
          link: value.link || "https://ktu.edu.in/Menu/announcements",
          details: value.details || "",
          tags: tagsValue
        });
        notices.push({
          id: legacyId,
          ...clean,
          createdAt: value.createdAt || now,
          updatedAt: value.updatedAt || value.createdAt || now
        });
        existingIds.add(legacyId);
        imported++;
      }
      notices.sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date));
      if (!imported) return json(res, 200, { success: true, imported: 0, count: notices.length, message: "No new previous notices were found." });
      result = { imported };
    } else if (body.action === "create") {
      const clean = validateNotice(body.notice);
      result = { id: `notice-${crypto.randomUUID()}`, ...clean, createdAt: now, updatedAt: now };
      notices.unshift(result);
    } else if (body.action === "update") {
      const index = notices.findIndex(item => item.id === body.id);
      if (index < 0) return json(res, 404, { error: "That notice no longer exists. Refresh the page and try again." });
      const clean = validateNotice(body.notice);
      result = { ...notices[index], ...clean, updatedAt: now };
      notices[index] = result;
    } else if (body.action === "delete") {
      const index = notices.findIndex(item => item.id === body.id);
      if (index < 0) return json(res, 404, { error: "That notice no longer exists." });
      result = notices[index];
      notices.splice(index, 1);
    } else {
      return json(res, 400, { error: "Unknown notice action." });
    }

    const content = Buffer.from(JSON.stringify(notices, null, 2) + "\n", "utf8").toString("base64");
    await github(session.accessToken, `/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
      method: "PUT",
      body: JSON.stringify({
        message: body.action === "migrateLegacy" ? "KTU Connect: import previous notices" : `KTU Connect: ${body.action} notice`,
        content,
        branch: "main",
        ...(file?.sha ? { sha: file.sha } : {})
      })
    });
    return json(res, 200, body.action === "migrateLegacy"
      ? { success: true, imported: result.imported, count: notices.length }
      : { success: true, action: body.action, notice: result, count: notices.length });
  } catch (error) {
    console.error("Notice update failed:", error.message);
    const status = error.status === 409 || error.status === 422 ? 409 : 400;
    return json(res, status, {
      error: status === 409
        ? "The notice data changed at the same time. Refresh the page and try again."
        : error.message || "Could not save the notice."
    });
  }
};

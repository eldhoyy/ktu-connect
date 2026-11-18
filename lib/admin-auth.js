const crypto = require("crypto");

const SESSION_COOKIE = "ktu_admin_session";
const STATE_COOKIE = "ktu_oauth_state";

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return Object.fromEntries(raw.split(";").map(part => {
    const i = part.indexOf("=");
    return i < 0 ? ["", ""] : [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim())];
  }).filter(([key]) => key));
}

function cookie(name, value, maxAge) {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function clearCookie(name) {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function sessionKey() {
  const secret = process.env.KTU_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("KTU_SESSION_SECRET must contain at least 32 characters.");
  return crypto.createHash("sha256").update(secret).digest();
}

function sealSession(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", sessionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

function openSession(value) {
  try {
    const packed = Buffer.from(value, "base64url");
    if (packed.length < 29) return null;
    const iv = packed.subarray(0, 12);
    const tag = packed.subarray(12, 28);
    const encrypted = packed.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", sessionKey(), iv);
    decipher.setAuthTag(tag);
    const payload = JSON.parse(Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8"));
    if (!payload.exp || payload.exp < Date.now() || !payload.accessToken) return null;
    if (String(payload.login).toLowerCase() !== String(process.env.GITHUB_ADMIN_LOGIN || "").toLowerCase()) return null;
    if (process.env.GITHUB_ADMIN_ID && String(payload.id) !== String(process.env.GITHUB_ADMIN_ID)) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function getSession(req) {
  const value = parseCookies(req)[SESSION_COOKIE];
  return value ? openSession(value) : null;
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  const expected = process.env.APP_ORIGIN;
  return !!origin && !!expected && origin.replace(/\/$/, "") === expected.replace(/\/$/, "");
}

module.exports = {
  SESSION_COOKIE, STATE_COOKIE, json, parseCookies, cookie, clearCookie,
  sealSession, getSession, sameOrigin
};

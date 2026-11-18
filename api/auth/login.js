const crypto = require("crypto");
const { cookie, STATE_COOKIE, json } = require("../../lib/admin-auth");

module.exports = function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed." });
  const { GITHUB_CLIENT_ID, APP_ORIGIN } = process.env;
  if (!GITHUB_CLIENT_ID || !APP_ORIGIN) return json(res, 503, { error: "Admin sign-in is not configured yet." });
  const state = crypto.randomBytes(32).toString("hex");
  res.setHeader("Set-Cookie", cookie(STATE_COOKIE, state, 600));
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: `${APP_ORIGIN.replace(/\/$/, "")}/api/auth/callback`,
    scope: "read:user public_repo",
    state
  });
  res.statusCode = 302;
  res.setHeader("Location", `https://github.com/login/oauth/authorize?${params.toString()}`);
  res.end();
};

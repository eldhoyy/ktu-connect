const { clearCookie, SESSION_COOKIE, sameOrigin, json } = require("../_lib/auth");

module.exports = function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." });
  if (!sameOrigin(req)) return json(res, 403, { error: "Request origin rejected." });
  res.setHeader("Set-Cookie", clearCookie(SESSION_COOKIE));
  return json(res, 200, { success: true });
};

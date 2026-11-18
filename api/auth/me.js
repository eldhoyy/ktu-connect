const { getSession, json } = require("../../lib/admin-auth");

module.exports = function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed." });
  const session = getSession(req);
  return json(res, 200, session
    ? { authenticated: true, login: session.login }
    : { authenticated: false });
};

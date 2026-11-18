const crypto = require("crypto");
const {
  STATE_COOKIE, SESSION_COOKIE, parseCookies, cookie, clearCookie,
  sealSession, json
} = require("../../lib/admin-auth");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed." });
  const fail = (message) => {
    res.setHeader("Set-Cookie", clearCookie(STATE_COOKIE));
    res.statusCode = 302;
    res.setHeader("Location", `/updates.html?admin_error=${encodeURIComponent(message)}`);
    res.end();
  };

  try {
    const cookies = parseCookies(req);
    const expectedState = cookies[STATE_COOKIE];
    const returnedState = String(req.query.state || "");
    if (!expectedState || !returnedState || expectedState.length !== returnedState.length ||
        !crypto.timingSafeEqual(Buffer.from(expectedState), Buffer.from(returnedState))) {
      return fail("Sign-in verification failed. Please try again.");
    }
    if (req.query.error || !req.query.code) return fail("GitHub sign-in was cancelled.");

    const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_ADMIN_LOGIN, GITHUB_ADMIN_ID, APP_ORIGIN } = process.env;
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET || !GITHUB_ADMIN_LOGIN || !APP_ORIGIN || !process.env.KTU_SESSION_SECRET) {
      return fail("Admin sign-in is not configured yet.");
    }

    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code: req.query.code,
        redirect_uri: `${APP_ORIGIN.replace(/\/$/, "")}/api/auth/callback`
      })
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) return fail("GitHub could not complete sign-in.");

    const userResponse = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }
    });
    const user = await userResponse.json();
    if (!userResponse.ok || String(user.login).toLowerCase() !== GITHUB_ADMIN_LOGIN.toLowerCase() ||
        (GITHUB_ADMIN_ID && String(user.id) !== String(GITHUB_ADMIN_ID))) {
      return fail("This GitHub account is not authorised to administer KTU Connect.");
    }

    const session = sealSession({
      accessToken: tokenData.access_token,
      login: user.login,
      id: user.id,
      exp: Date.now() + 6 * 60 * 60 * 1000
    });
    res.setHeader("Set-Cookie", [
      cookie(SESSION_COOKIE, session, 6 * 60 * 60),
      clearCookie(STATE_COOKIE)
    ]);
    res.statusCode = 302;
    res.setHeader("Location", "/updates.html?admin=connected");
    res.end();
  } catch (error) {
    console.error("Admin OAuth callback failed:", error.message);
    fail("Sign-in could not be completed. Please try again.");
  }
};

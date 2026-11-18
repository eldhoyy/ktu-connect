module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    return res.end("Method not allowed");
  }
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify({
    status: "ok",
    adminConfigured: Boolean(
      process.env.APP_ORIGIN &&
      process.env.GITHUB_CLIENT_ID &&
      process.env.GITHUB_CLIENT_SECRET &&
      process.env.GITHUB_ADMIN_LOGIN &&
      process.env.KTU_SESSION_SECRET &&
      process.env.KTU_SESSION_SECRET.length >= 32
    ),
    communityConfigured: Boolean(
      process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN
    ),
    legacyNoticeImportConfigured: Boolean(process.env.LEGACY_NOTICES_URL),
    legacyQuestionImportConfigured: Boolean(process.env.LEGACY_QA_BASE_URL)
  }));
};

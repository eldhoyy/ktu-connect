module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    return res.end("Method not allowed");
  }
  try {
    const response = await fetch("https://raw.githubusercontent.com/eldhoyy/ktu-connect/main/notices-store.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Notice feed unavailable");
    const data = await response.json();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    return res.end(JSON.stringify(data));
  } catch (error) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ error: "Notice feed temporarily unavailable." }));
  }
};

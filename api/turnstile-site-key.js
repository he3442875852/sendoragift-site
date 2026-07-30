module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false }));
    return;
  }

  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (!process.env.TURNSTILE_SITE_KEY) {
    res.statusCode = 503;
    res.end(JSON.stringify({ ok: false }));
    return;
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, siteKey: process.env.TURNSTILE_SITE_KEY }));
};

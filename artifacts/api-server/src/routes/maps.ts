import { Router, type IRouter } from "express";

const router: IRouter = Router();

const ALLOWED_HOSTNAMES = new Set([
  "maps.app.goo.gl",
  "goo.gl",
  "maps.google.com",
  "www.google.com",
  "google.com",
]);

router.get("/expand-url", async (req, res) => {
  const { url } = req.query;

  if (typeof url !== "string" || !url) {
    res.status(400).json({ error: "url parameter is required" });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  if (!ALLOWED_HOSTNAMES.has(parsed.hostname)) {
    res.status(400).json({ error: "URL must be a Google Maps link" });
    return;
  }

  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; WalkableApp/1.0; +https://walkable.app)",
      },
    });

    res.json({ url: response.url });
  } catch {
    res.status(502).json({ error: "Failed to expand URL" });
  }
});

export default router;

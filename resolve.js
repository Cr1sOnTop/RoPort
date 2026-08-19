// Vercel serverless function: /api/resolve?url=<roblox share link>
// Fetches the share link server-side (browsers can't do this directly —
// Roblox's pages don't send CORS headers permitting cross-origin reads)
// and extracts the og:title / og:image meta tags, which carry the game's
// name and thumbnail for a private/VIP server share link.

const ALLOWED_HOSTS = new Set(['www.roblox.com', 'roblox.com', 'ro.blox.com']);

function extractMetaContent(html, property) {
  // Find the whole <meta ...> tag containing this property first, then pull
  // its content attribute out — this works regardless of attribute order.
  const tagRegex = new RegExp(`<meta[^>]*property=["']${property}["'][^>]*>`, 'i');
  const tagMatch = html.match(tagRegex);
  if (!tagMatch) return null;
  const contentMatch = tagMatch[0].match(/content=["']([^"']*)["']/i);
  return contentMatch ? decodeEntities(contentMatch[1]) : null;
}

function decodeEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'missing url param' });
  }

  let target;
  try {
    target = new URL(url);
  } catch (err) {
    return res.status(400).json({ error: 'invalid url' });
  }

  // Small allowlist so this can't be used as an open proxy to fetch
  // arbitrary sites on the server's behalf.
  if (!ALLOWED_HOSTS.has(target.hostname) || target.protocol !== 'https:') {
    return res.status(400).json({ error: 'unsupported host' });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RoPortResolver/1.0)' },
      redirect: 'follow',
    });

    if (!upstream.ok) {
      return res.status(502).json({ error: 'upstream error' });
    }

    const html = await upstream.text();
    const gameName = extractMetaContent(html, 'og:title');
    const gameImage = extractMetaContent(html, 'og:image');

    if (!gameName) {
      return res.status(404).json({ error: 'no game info found' });
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ gameName, gameImage: gameImage || null });
  } catch (err) {
    return res.status(502).json({ error: 'fetch failed' });
  }
}

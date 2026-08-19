// Vercel serverless function: /api/resolve?url=<roblox share link>
//
// Roblox's share pages (roblox.com/share-links) always carry a generic
// og:title of "Join Private Server" — it's not the game name, so it can't
// be scraped directly. What the page DOES carry is a
// `roblox:start_place_id` meta tag with the real place ID behind the
// server invite. This function:
//   1. fetches the share page server-side (avoids the browser CORS block)
//   2. reads the start_place_id meta tag
//   3. resolves place -> universe -> game name + icon via Roblox's public,
//      unauthenticated game APIs

const ALLOWED_HOSTS = new Set(['www.roblox.com', 'roblox.com', 'ro.blox.com']);

function extractMetaContent(html, property) {
  // Find the whole <meta ...> tag containing this property first, then pull
  // its content attribute out — this works regardless of attribute order.
  const tagRegex = new RegExp(`<meta[^>]*property=["']${property}["'][^>]*>`, 'i');
  const tagMatch = html.match(tagRegex);
  if (!tagMatch) return null;
  const contentMatch = tagMatch[0].match(/content=["']([^"']*)["']/i);
  return contentMatch ? contentMatch[1] : null;
}

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; RoPortResolver/1.0)' };

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
    const pageResp = await fetch(target.toString(), { headers: UA, redirect: 'follow' });
    if (!pageResp.ok) {
      return res.status(502).json({ error: 'upstream error' });
    }
    const html = await pageResp.text();

    const placeId = extractMetaContent(html, 'roblox:start_place_id');
    if (!placeId) {
      return res.status(404).json({ error: 'no place id found on share page' });
    }

    // place -> universe
    const universeResp = await fetch(
      `https://apis.roblox.com/universes/v1/places/${encodeURIComponent(placeId)}/universe`,
      { headers: UA }
    );
    if (!universeResp.ok) {
      return res.status(502).json({ error: 'universe lookup failed' });
    }
    const universeData = await universeResp.json();
    const universeId = universeData && universeData.universeId;
    if (!universeId) {
      return res.status(404).json({ error: 'no universe found for place' });
    }

    // universe -> game name (and icon, in parallel)
    const [gameResp, iconResp] = await Promise.all([
      fetch(`https://games.roblox.com/v1/games?universeIds=${encodeURIComponent(universeId)}`, { headers: UA }),
      fetch(
        `https://thumbnails.roblox.com/v1/games/icons?universeIds=${encodeURIComponent(universeId)}&size=512x512&format=Png&isCircular=false`,
        { headers: UA }
      ),
    ]);

    let gameName = null;
    if (gameResp.ok) {
      const gameData = await gameResp.json();
      gameName = (gameData && gameData.data && gameData.data[0] && gameData.data[0].name) || null;
    }

    let gameImage = null;
    if (iconResp.ok) {
      const iconData = await iconResp.json();
      gameImage = (iconData && iconData.data && iconData.data[0] && iconData.data[0].imageUrl) || null;
    }

    if (!gameName) {
      return res.status(404).json({ error: 'no game name found' });
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ gameName, gameImage, placeId, universeId });
  } catch (err) {
    return res.status(502).json({ error: 'fetch failed' });
  }
}

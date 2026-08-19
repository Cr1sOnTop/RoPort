// api/resolve.js
//
// Roblox share-link metadata resolver.
//
// Tries to obtain game title/icon from the metadata Roblox exposes
// to social/crawler clients, then falls back to the normal Roblox
// Games + Thumbnails APIs when a place ID is available.

const ALLOWED_HOSTS = new Set([
  "www.roblox.com",
  "roblox.com",
  "ro.blox.com"
]);

const CRAWLERS = [
  {
    name: "Discordbot",
    ua: "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"
  },
  {
    name: "Twitterbot",
    ua: "Twitterbot/1.0"
  },
  {
    name: "Facebook",
    ua: "facebookexternalhit/1.1"
  },
  {
    name: "Googlebot",
    ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
  },
  {
    name: "Browser",
    ua:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/131.0.0.0 Safari/537.36"
  }
];


function getMeta(html, attr, value) {
  const regex = new RegExp(
    `<meta[^>]+${attr}=["']${escapeRegExp(value)}["'][^>]*>`,
    "i"
  );

  const match = html.match(regex);

  if (!match) return null;

  const content = match[0].match(
    /content=["']([^"']*)["']/i
  );

  return content ? decodeHtml(content[1]) : null;
}


function escapeRegExp(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}


function decodeHtml(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}


function getTitleTag(html) {
  const match = html.match(
    /<title[^>]*>([\s\S]*?)<\/title>/i
  );

  if (!match) return null;

  return decodeHtml(
    match[1].replace(/\s+/g, " ").trim()
  );
}


function extractPlaceId(url) {
  try {
    const parsed = new URL(url);

    const match = parsed.pathname.match(
      /^\/games\/(\d+)(?:\/|$)/i
    );

    if (match) {
      return match[1];
    }

    const placeId =
      parsed.searchParams.get("placeId");

    if (
      placeId &&
      /^\d+$/.test(placeId)
    ) {
      return placeId;
    }
  } catch (_) {}

  return null;
}


function extractMetadata(html) {
  const ogTitle =
    getMeta(html, "property", "og:title");

  const ogImage =
    getMeta(html, "property", "og:image");

  const ogDescription =
    getMeta(html, "property", "og:description");

  const twitterTitle =
    getMeta(html, "name", "twitter:title") ||
    getMeta(html, "property", "twitter:title");

  const twitterImage =
    getMeta(html, "name", "twitter:image") ||
    getMeta(html, "property", "twitter:image");

  const description =
    getMeta(html, "name", "description");

  const title =
    ogTitle ||
    twitterTitle ||
    getTitleTag(html);

  const image =
    ogImage ||
    twitterImage;

  return {
    title,
    image,
    description
  };
}


async function fetchPage(url, userAgent) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": userAgent,
      "Accept":
        "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  const html =
    await response.text();

  return {
    response,
    html
  };
}


async function resolveMetadata(url) {
  const attempts = [];

  for (const crawler of CRAWLERS) {
    try {
      const {
        response,
        html
      } = await fetchPage(
        url,
        crawler.ua
      );

      const metadata =
        extractMetadata(html);

      attempts.push({
        crawler: crawler.name,
        status: response.status,
        finalUrl: response.url,
        contentType:
          response.headers.get(
            "content-type"
          ),
        title: metadata.title,
        image: metadata.image,
        description:
          metadata.description
      });

      if (
        metadata.title ||
        metadata.image
      ) {
        return {
          ...metadata,
          crawler: crawler.name,
          finalUrl: response.url,
          attempts
        };
      }
    } catch (error) {
      attempts.push({
        crawler: crawler.name,
        error: error.message
      });
    }
  }

  return {
    title: null,
    image: null,
    description: null,
    crawler: null,
    attempts
  };
}


async function getUniverseId(placeId) {
  const response = await fetch(
    `https://apis.roblox.com/universes/v1/places/${placeId}/universe`,
    {
      headers: {
        "User-Agent": CRAWLERS[0].ua,
        "Accept": "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `Universe API HTTP ${response.status}`
    );
  }

  const data =
    await response.json();

  if (!data?.universeId) {
    throw new Error(
      "Universe ID missing"
    );
  }

  return String(
    data.universeId
  );
}


async function getGameInfo(universeId) {
  const [gameResponse, iconResponse] =
    await Promise.all([
      fetch(
        `https://games.roblox.com/v1/games?universeIds=${universeId}`,
        {
          headers: {
            "Accept": "application/json"
          }
        }
      ),

      fetch(
        "https://thumbnails.roblox.com/v1/games/icons" +
        `?universeIds=${universeId}` +
        "&size=512x512" +
        "&format=Png" +
        "&isCircular=false",
        {
          headers: {
            "Accept": "application/json"
          }
        }
      )
    ]);

  const gameData =
    await gameResponse.json();

  const iconData =
    iconResponse.ok
      ? await iconResponse.json()
      : null;

  const game =
    gameData?.data?.[0];

  if (!game) {
    throw new Error(
      "Game not found"
    );
  }

  return {
    gameName: game.name,
    gameImage:
      iconData?.data?.[0]?.imageUrl ||
      null
  };
}


module.exports = async function handler(
  req,
  res
) {
  if (req.method !== "GET") {
    return res.status(405).json({
      error: "method not allowed"
    });
  }

  const rawUrl =
    req.query?.url;

  if (
    !rawUrl ||
    typeof rawUrl !== "string"
  ) {
    return res.status(400).json({
      error: "missing url param"
    });
  }

  let url;

  try {
    url = new URL(rawUrl);
  } catch (_) {
    return res.status(400).json({
      error: "invalid url"
    });
  }

  if (
    url.protocol !== "https:" ||
    !ALLOWED_HOSTS.has(
      url.hostname.toLowerCase()
    )
  ) {
    return res.status(400).json({
      error: "unsupported host"
    });
  }

  try {
    //
    // First try metadata.
    //
    const metadata =
      await resolveMetadata(
        url.toString()
      );

    //
    // If metadata contains useful information,
    // return it immediately.
    //
    if (
      metadata.title ||
      metadata.image
    ) {
      res.setHeader(
        "Cache-Control",
        "s-maxage=3600, stale-while-revalidate=86400"
      );

      return res.status(200).json({
        gameName:
          metadata.title,
        gameImage:
          metadata.image,
        description:
          metadata.description,
        source:
          "roblox-metadata",
        crawler:
          metadata.crawler
      });
    }

    //
    // Fall back to place ID resolution for
    // old /games/<placeId> URLs.
    //
    const placeId =
      extractPlaceId(
        url.toString()
      );

    if (placeId) {
      const universeId =
        await getUniverseId(
          placeId
        );

      const gameInfo =
        await getGameInfo(
          universeId
        );

      res.setHeader(
        "Cache-Control",
        "s-maxage=3600, stale-while-revalidate=86400"
      );

      return res.status(200).json({
        ...gameInfo,
        placeId,
        universeId,
        source:
          "roblox-api"
      });
    }

    //
    // Nothing was exposed.
    //
    console.error(
      "[RoPort] No metadata found:",
      JSON.stringify(
        metadata.attempts,
        null,
        2
      )
    );

    return res.status(404).json({
      error:
        "Roblox did not expose game metadata for this share link",
      attempts:
        metadata.attempts
    });

  } catch (error) {
    console.error(
      "[RoPort] Resolver error:",
      error
    );

    return res.status(502).json({
      error:
        "Roblox resolver failed",
      details:
        error.message
    });
  }
};

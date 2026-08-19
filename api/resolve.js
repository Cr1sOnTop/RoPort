// api/resolve.js
//
// RoPort Roblox game-info resolver.
//
// Modern private-server links:
//   https://www.roblox.com/share?code=...&type=Server
//
// These don't expose the place ID directly. Roblox DOES expose
// social-preview metadata to crawlers such as Discordbot, so we
// request the page as Discordbot and extract:
//
//   - Game name from the description
//   - Game icon from og:image
//
// Old Roblox game links are also supported:
//   https://www.roblox.com/games/<placeId>/...

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


/*
 * Escape text so it can safely be placed inside a RegExp.
 */
function escapeRegExp(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}


/*
 * Decode the most common HTML entities used by Roblox.
 *
 * Example:
 *
 * Fisch &#x1F41F; [HALIBUT]
 *
 * becomes:
 *
 * Fisch 🐟 [HALIBUT]
 */
function decodeHtml(value) {
  if (!value) return value;

  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#([0-9]+);/g, (_, dec) =>
      String.fromCodePoint(parseInt(dec, 10))
    );
}


/*
 * Read a <meta> tag.
 */
function getMeta(html, attr, value) {
  const regex = new RegExp(
    `<meta[^>]+${attr}=["']${escapeRegExp(value)}["'][^>]*>`,
    "i"
  );

  const match = html.match(regex);

  if (!match) {
    return null;
  }

  const content = match[0].match(
    /content=["']([^"']*)["']/i
  );

  return content
    ? decodeHtml(content[1])
    : null;
}


/*
 * Read <title>.
 */
function getTitleTag(html) {
  const match = html.match(
    /<title[^>]*>([\s\S]*?)<\/title>/i
  );

  if (!match) {
    return null;
  }

  return decodeHtml(
    match[1]
      .replace(/\s+/g, " ")
      .trim()
  );
}


/*
 * Roblox's Discord metadata looks approximately like:
 *
 * Check out Fisch 🐟 [HALIBUT]. It's one of the millions...
 *
 * Extract the actual experience name from that sentence.
 */
function extractGameNameFromDescription(description) {
  if (!description) {
    return null;
  }

  const patterns = [
    /^Check out (.+?)\. It(?:'|’)s one of the millions/i,
    /^Check out (.+?)\. It's one of the millions/i
  ];

  for (const pattern of patterns) {
    const match =
      description.match(pattern);

    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
}


/*
 * Extract all useful social metadata.
 */
function extractMetadata(html) {
  const ogTitle =
    getMeta(
      html,
      "property",
      "og:title"
    );

  const ogImage =
    getMeta(
      html,
      "property",
      "og:image"
    );

  const ogDescription =
    getMeta(
      html,
      "property",
      "og:description"
    );

  const twitterTitle =
    getMeta(
      html,
      "name",
      "twitter:title"
    ) ||
    getMeta(
      html,
      "property",
      "twitter:title"
    );

  const twitterImage =
    getMeta(
      html,
      "name",
      "twitter:image"
    ) ||
    getMeta(
      html,
      "property",
      "twitter:image"
    );

  const description =
    getMeta(
      html,
      "name",
      "description"
    ) ||
    ogDescription;

  /*
   * IMPORTANT:
   *
   * Roblox currently uses:
   *
   * og:title = "Join Private Server"
   *
   * while the actual game name appears at the
   * beginning of the description.
   *
   * Therefore description extraction takes priority.
   */
  const descriptionGameName =
    extractGameNameFromDescription(
      description
    );

  return {
    title:
      descriptionGameName ||
      ogTitle ||
      twitterTitle ||
      getTitleTag(html),

    image:
      ogImage ||
      twitterImage ||
      null,

    description:
      description || null
  };
}


/*
 * Fetch Roblox with a particular crawler identity.
 */
async function fetchPage(
  url,
  userAgent
) {
  const response = await fetch(
    url,
    {
      redirect: "follow",

      headers: {
        "User-Agent": userAgent,

        "Accept":
          "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",

        "Accept-Language":
          "en-US,en;q=0.9"
      }
    }
  );

  const html =
    await response.text();

  return {
    response,
    html
  };
}


/*
 * Try the different social-media crawler identities.
 *
 * Discordbot is first because we know Roblox currently
 * provides the useful game metadata to it.
 */
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

      const attempt = {
        crawler: crawler.name,
        status: response.status,
        finalUrl: response.url,
        contentType:
          response.headers.get(
            "content-type"
          ),
        title:
          metadata.title,
        image:
          metadata.image,
        description:
          metadata.description
      };

      attempts.push(attempt);

      /*
       * We only need either a title or an image
       * to consider the metadata useful.
       */
      if (
        metadata.title ||
        metadata.image
      ) {
        return {
          ...metadata,
          crawler:
            crawler.name,
          finalUrl:
            response.url,
          attempts
        };
      }

    } catch (error) {
      attempts.push({
        crawler:
          crawler.name,

        error:
          error.message
      });
    }
  }

  return {
    title: null,
    image: null,
    description: null,
    crawler: null,
    finalUrl: null,
    attempts
  };
}


/*
 * Extract a place ID from an old-style Roblox URL.
 *
 * Example:
 *
 * /games/16732694052/Fisch
 */
function extractPlaceId(url) {
  try {
    const parsed =
      new URL(url);

    const match =
      parsed.pathname.match(
        /^\/games\/(\d+)(?:\/|$)/i
      );

    if (match) {
      return match[1];
    }

    /*
     * Also support:
     *
     * ?placeId=123
     */
    const placeId =
      parsed.searchParams.get(
        "placeId"
      );

    if (
      placeId &&
      /^\d+$/.test(placeId)
    ) {
      return placeId;
    }

  } catch (_) {}

  return null;
}


/*
 * Place ID -> Universe ID
 */
async function getUniverseId(
  placeId
) {
  const response =
    await fetch(
      `https://apis.roblox.com/universes/v1/places/${encodeURIComponent(placeId)}/universe`,
      {
        headers: {
          "User-Agent":
            CRAWLERS[0].ua,

          "Accept":
            "application/json"
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

  if (
    !data ||
    !data.universeId
  ) {
    throw new Error(
      "Universe ID missing"
    );
  }

  return String(
    data.universeId
  );
}


/*
 * Universe ID -> game name + icon.
 */
async function getGameInfo(
  universeId
) {
  const [
    gameResponse,
    iconResponse
  ] = await Promise.all([
    fetch(
      `https://games.roblox.com/v1/games?universeIds=${encodeURIComponent(universeId)}`,
      {
        headers: {
          "Accept":
            "application/json"
        }
      }
    ),

    fetch(
      "https://thumbnails.roblox.com/v1/games/icons" +
      `?universeIds=${encodeURIComponent(universeId)}` +
      "&size=512x512" +
      "&format=Png" +
      "&isCircular=false",
      {
        headers: {
          "Accept":
            "application/json"
        }
      }
    )
  ]);


  if (!gameResponse.ok) {
    throw new Error(
      `Games API HTTP ${gameResponse.status}`
    );
  }


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
    gameName:
      game.name,

    gameImage:
      iconData?.data?.[0]?.imageUrl ||
      null
  };
}


/*
 * Vercel serverless handler.
 */
module.exports = async function handler(
  req,
  res
) {

  /*
   * GET only.
   */
  if (req.method !== "GET") {
    return res.status(405).json({
      error:
        "method not allowed"
    });
  }


  const rawUrl =
    req.query?.url;


  if (
    !rawUrl ||
    typeof rawUrl !== "string"
  ) {
    return res.status(400).json({
      error:
        "missing url param"
    });
  }


  /*
   * Validate URL.
   */
  let url;

  try {
    url =
      new URL(rawUrl);
  } catch (_) {
    return res.status(400).json({
      error:
        "invalid url"
    });
  }


  /*
   * SECURITY:
   *
   * Only allow Roblox domains.
   */
  if (
    url.protocol !== "https:" ||
    !ALLOWED_HOSTS.has(
      url.hostname.toLowerCase()
    )
  ) {
    return res.status(400).json({
      error:
        "unsupported host"
    });
  }


  try {

    /*
     * ==========================================
     * MODERN ROBLOX SHARE LINK
     * ==========================================
     *
     * /share?code=...&type=Server
     *
     * Try Roblox's social metadata.
     */
    const metadata =
      await resolveMetadata(
        url.toString()
      );


    /*
     * If Roblox gave us metadata,
     * use it.
     */
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


    /*
     * ==========================================
     * OLD ROBLOX GAME LINK
     * ==========================================
     */
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


    /*
     * Nothing useful was exposed.
     */
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
        "Roblox did not expose game metadata for this link",

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

# RoPort

A small utility that converts Roblox web share links (`roblox.com/share?code=...&type=...`) into native `roblox://navigation/share_links?...` deep links.

## 🔗 **Live:** [rconvert.vercel.app](https://rconvert.vercel.app)

> 🤖 **Made with AI.** This tool (design, code, and this README) was built with Claude. Sanity-check the output before relying on it for anything important. i am lazy as hell

## Features

- **Link converter** — paste a share URL, get back the equivalent `roblox://` deep link instantly, no server round-trip.
- **URL anatomy breakdown** — a color-coded view of the host, path, and `code`/`type` params so you can see exactly what's being extracted.
- **Copy / Open buttons** — one tap to copy the converted link, or to open it directly in the Roblox app.
- **Saved servers tab** — save private servers with a name, owner, and link for quick access later (accepts either link format — it auto-converts on save). Copy, open, or delete each entry.
- **Persistence** — saved servers stick around across visits via `localStorage`, saved per-browser.

## Why?

This app was made because of the recent [block](https://devforum.roblox.com/t/i-feel-very-bad-about-the-situation-with-roblox-in-vietnam/4813086) for Roblox sites in Vietnam. The app allows you to join your friends’ private server links even after the block, since it jumps straight to the app rather than passing through the website.

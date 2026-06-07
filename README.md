# Phantom

A Chrome extension that makes tracking scripts useless by flooding them with realistic but fictional behavioral data.

Phantom doesn't block trackers — it **poisons** them. Every mouse movement, scroll, click, hover, and keystroke that a tracker records is buried in noise. The result: your real behavior becomes statistically indistinguishable from fiction.

## What It Does

### Ghost Search (V1)
Issues randomized decoy search queries to Google, Bing, Yahoo, and DuckDuckGo on a timer. Your real searches get lost in the noise. Queries evolve over time using RSS feeds so they stay topical.

### Behavioral Noise Engine (V2)
Injects phantom behavioral data directly into tracker event streams:

- **Mouse trajectories** — Bezier-curved ghost cursors with physics (jitter, overshoot, velocity variation)
- **Scroll patterns** — Fake reading behaviors (skim, careful read, search-and-find, bottom-first)
- **Click heatmaps** — Ghost clicks on safe elements only (never links, buttons, or forms)
- **Hover dwell times** — Poisons the time-on-element signals trackers use for interest profiling
- **Keystroke timing** — Injects phantom modifier key events to corrupt typing rhythm fingerprints

All noise modules share a rotating **persona** — a consistent behavioral profile that changes every 30-120 minutes. This makes statistical separation of signal from noise significantly harder.

### Exposure Dashboard
A built-in dashboard that shows you exactly what's happening:

- **Real vs. spoofed visualization** — Side-by-side canvas replay of your actual mouse behavior vs. what trackers see (real trail in blue, ghost trails in red)
- **Live stats** — Ghost events, phantom clicks, scroll spoofs, keystroke injections, per-page and per-session
- **Tracker detection** — Scans the page for known trackers (Google Analytics, Facebook Pixel, Hotjar, FullStory, etc.) and shows which ones are being poisoned
- **System diagnostic** — One-click verification that all components are running

## How It Works

Phantom runs as two content scripts in different JavaScript worlds:

| Layer | World | Purpose |
|---|---|---|
| `phantom-inject.js` | MAIN | Wraps `EventTarget.prototype.addEventListener` in the page's JS environment. Tracker scripts get wrapped listeners that receive injected ghost events alongside real ones. |
| `phantom.js` + modules | ISOLATED | Orchestrates the noise activity cycle (bursts and idle periods), manages personas, settings, and Chrome API communication. Dispatches autonomous noise events to the shared DOM. |

The MAIN world script intercepts tracker callbacks directly. The ISOLATED world script coordinates everything and communicates state to the MAIN world via `postMessage`.

A service worker (`background.js`) handles ghost search scheduling, RSS query evolution, remote whitelist syncing, and update checking.

## Install

1. Download the latest `.zip` from [phantom.farehard.com](https://phantom.farehard.com) or [GitHub Releases](https://github.com/Dr-Awkward/phantom/releases)
2. Extract it to a folder on your computer — on Windows, right-click the zip and choose **Extract All**; on Mac, double-click it. Don't skip this step: Chrome can't load the extension from inside the zip itself.
3. Open Chrome and go to `chrome://extensions`
4. Turn on **Developer mode** (toggle in the top-right corner)
5. Click **Load unpacked** and select the extracted folder
6. Click the puzzle piece icon in the toolbar to pin Phantom

> **Keep the folder where it is.** Chrome loads Phantom from that folder every time it starts — if you move, rename, or delete it, the extension stops working. Pick a permanent spot (like `Documents/Phantom`) before loading it.

### Update

1. Download the new `.zip`
2. Extract to the same folder (overwrite old files)
3. Go to `chrome://extensions` and click the reload arrow on Phantom
4. Refresh any open website tabs

Phantom also checks for updates automatically and shows a banner in the popup when a new version is available.

## Settings

Click the Phantom icon > **Settings** to configure:

- Toggle individual noise modules (mouse, scroll, click, hover, keystroke)
- Set noise intensity (Low / Medium / High)
- Configure ghost search interval and which search engines to use
- Enable/disable iframe noise injection (disable on slow devices)
- Manage your personal site whitelist

## Whitelist

Phantom automatically disables itself on banking, healthcare, government, and password manager sites where behavioral biometrics are used for security. This whitelist is maintained in the repo and syncs to every installed extension daily.

You can add your own domains in Settings. If you find a site that should be on the community whitelist, [open an issue](https://github.com/Dr-Awkward/phantom/issues).

## Testing

Open `tests/test.html` in Chrome. All 31 unit tests run in-browser with no dependencies. An internet connection is required for two JSON validation tests that load from GitHub when opened via `file://`.

The Exposure Dashboard includes a built-in **System Diagnostic** that verifies all four components are running: service worker, content script, MAIN world event interception, and noise generation.

## Privacy

- Phantom never transmits user data to any server
- Ghost searches go directly to search engines with no proxy
- The extension contacts `raw.githubusercontent.com` once daily to sync the whitelist and check for updates — no cookies, no tokens, just a GET request for a static file
- No analytics, no telemetry, no user accounts, no data collection

## Why Not the Chrome Web Store?

Google rejected it. The `addEventListener` prototype wrapping that makes Phantom work is the same technique that makes Google uncomfortable. Phantom is distributed as a self-hosted zip and via GitHub Releases.

## License

GPL v3 — see [LICENSE](LICENSE) for details.

## Support

If Phantom is useful to you, consider supporting development:

- [phantom.farehard.com](https://phantom.farehard.com)
- [GitHub Sponsors](https://github.com/sponsors/Dr-Awkward)

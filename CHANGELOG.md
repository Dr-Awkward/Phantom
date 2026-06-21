# Changelog

All notable changes to Phantom are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.2.0] - 2026-06-21

### Changed
- Interception-path mouse noise no longer teleports 200-300px from the real cursor in a single
  event. It now walks a continuous, velocity-limited path with `movementX/movementY` matching each
  step, so the ghost cursor reads like a hand instead of a scripted jump. This makes the noise more
  convincing to trackers that actually ingest it (heatmap, session-replay, and analytics tools that
  record raw events).
- Orchestrator-dispatched mouse moves now carry `movementX/movementY` consistent with their position
  delta, for the same reason.

### Notes
- `isTrusted` is **not** spoofed, because it cannot be. In Chrome it is a non-configurable own
  property on every event instance (`[LegacyUnforgeable]`): `defineProperty` throws and there is no
  prototype accessor to override, so a scripted event cannot be made to look trusted from page JS.
  A tracker that runs `if (!e.isTrusted) return;` discards all of Phantom's synthetic events; the
  noise therefore only reaches trackers that do not check the flag (in practice, much analytics and
  heatmap tooling). The only way to emit genuinely trusted events is real user input or
  `chrome.debugger`/CDP, which Phantom does not use. An earlier attempt to spoof `isTrusted` was
  removed once verified impossible in Chrome.

### Added
- Tracker intelligence: `tracker-signatures.json` now classifies each tracker (analytics,
  session-replay, advertising, captcha, anti-bot, fingerprinting) and records whether the noise
  reaches it. The Exposure Dashboard shows an honest per-tracker verdict — "Poisoned" for tools that
  ingest raw events, "Not affected" for those that filter synthetic input (`isTrusted`).
- Bot-detection stand-down: on pages running aggressive anti-bot / fingerprinting systems (Cloudflare
  Bot Management, DataDome, HUMAN/PerimeterX, FingerprintJS), the content script now disables
  behavioral injection entirely — the noise is filtered there and can raise a bot/fraud score against
  the user. Detection is top-frame, via resource-URL match plus a `PerformanceObserver` for
  late-loading scripts.
- Unit tests covering trajectory continuity and movement-delta consistency, plus a regression test
  that pins the `isTrusted` limit (synthetic events stay untrusted; the flag is unforgeable).

## [2.0.3] - 2026-06-09

### Changed
- Maintenance release. No changes to extension behavior. Version numbers and the
  release pipeline were brought back in sync so automated GitHub Releases build
  and publish correctly.

## [2.0.1] - 2026-06-07

### Fixed
- Options page and Exposure Dashboard now render remote whitelist domains, tracker names, and diagnostic details as plain text instead of HTML — defense-in-depth against injection through fetched or bundled data.
- LICENSE preamble replaced with the standard GPL v3 grant text.

### Changed
- Manifest now declares `minimum_chrome_version` 111. Older Chrome can't run MAIN-world content scripts, so Phantom would have silently failed there.
- README install steps clarified for first-time users: zip extraction on Windows/Mac, and a warning that the extension folder must stay in place after loading.

### Added
- GitHub Actions release workflow: builds `phantom.zip` from an allowlist, enforces a 200KB size cap, publishes the SHA256, and refuses to release without a matching changelog entry. The LICENSE file is now bundled in the zip.

## [2.0.0] - 2026-04-01

First public release.

### Added
- **Ghost Search engine** — randomized decoy queries dispatched to Google, Bing, Yahoo, and DuckDuckGo on a configurable schedule. Real searches drown in noise.
- **Behavioral noise injection** — synthetic mouse, scroll, click, hover, and keystroke event streams injected into every tracking script's listeners via `EventTarget.prototype.addEventListener` interception. Real events always pass through first; noise is additive only.
- **Persona engine** — generates consistent behavioral profiles (speedReader, carefulBrowser, etc.) rotated every 30–120 minutes. Shared across all noise modules to defeat statistical separation.
- **Exposure Dashboard** — side-by-side replay of real vs. spoofed behavior, tracker detection, session stats, and a four-check diagnostic.
- **Remote whitelist** — auto-syncs from `raw.githubusercontent.com/Dr-Awkward/phantom/main/whitelist.json` to disable Phantom on banking, healthcare, and government sites where behavioral biometrics are used for fraud detection.
- **Update checking** — daily poll of `version.json` from the same path. Surfaces an update banner in the popup linking to the download site.
- **Settings sync** via `chrome.storage.sync` so preferences follow the user across devices.

### Security
- Synthetic events carry `isTrusted: false`. Most analytics ignore this; keystroke timing is the highest-risk surface for detection.
- `ClickSynth` operates only on safe (non-interactive) elements via an explicit `dangerSelectors` denylist. Never clicks links, buttons, forms, or purchase flows.
- Whitelist check runs before content-script init. Phantom exits immediately on whitelisted domains.
- Fails silently under strict Content Security Policies — never breaks a page.

### Notes
- Manifest V3.
- Distributed as `phantom.zip` via GitHub Releases (Chrome Web Store rejected the extension for `addEventListener` wrapping).
- No telemetry. No analytics. No phone-home. Source is auditable.

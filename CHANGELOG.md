# Changelog

All notable changes to Phantom are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

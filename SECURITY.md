# Security Policy

## Reporting a vulnerability

Email: **coop@farehard.com**

Please include:
- A clear description of the issue and its impact
- Steps to reproduce (URL, page conditions, settings, Chrome version)
- Whether the issue is exploitable, and how
- Proof-of-concept code if available

Do not open a public GitHub issue for security matters until a fix is released.

## What's in scope

- The extension code in this repository (background service worker, content scripts, popup, options, dashboard)
- The remote endpoints the extension fetches: `version.json`, `whitelist.json` from `raw.githubusercontent.com/Dr-Awkward/phantom/main/`
- The download site at `phantom.farehard.com`

## What's out of scope

- Bugs in Chrome, third-party trackers, or websites Phantom runs on
- Behavior on sites where Phantom is whitelisted (banking, healthcare, government — Phantom does not run there by design)
- Reports that the extension can be detected by determined fingerprinting (Phantom's threat model is mass-data-collection, not targeted analysis)

## Response time

I read this email. I'll acknowledge within a week and push a fix or disclose a workaround as soon as I can. No bounty program — this is a one-person project.

## Verifying releases

Each GitHub Release includes a SHA256 of `phantom.zip` in the body. The same SHA256 appears on `phantom.farehard.com`. They should match. If they don't, do not install — email me.

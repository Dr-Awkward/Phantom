# Releasing Phantom

Phantom ships as a `phantom.zip` attached to a GitHub Release. There is no Chrome
Web Store listing. Releases are built and published automatically by
`.github/workflows/release.yml` whenever you push a tag that starts with `v`.

You do not build the zip by hand. You bump a few files, write a changelog entry,
tag the commit, and push. The workflow does the rest.

## What a release actually does

When you push a tag like `v2.0.2`, the workflow:

1. Checks that the tag version matches `manifest.json` `version`. If they differ,
   it fails and nothing is published.
2. Builds `phantom.zip` from an explicit allowlist of files (source, icons,
   data JSON, LICENSE). Nothing else is included.
3. Fails if the zip is over 200KB, which catches anything that leaked into the build.
4. Computes the SHA256 of the zip.
5. Pulls the matching `## [X.Y.Z]` block out of `CHANGELOG.md` for the release notes.
   If there is no matching block, it fails.
6. Creates the GitHub Release named `Phantom vX.Y.Z`, attaches `phantom.zip`,
   and puts the changelog plus the SHA256 and install instructions in the body.

## Before you tag: the four things to update

Do all of these in one commit on `main`.

1. **`manifest.json`** — set `"version"` to the new number, for example `2.0.2`.
   This is the version Chrome shows and the one the tag is checked against.

2. **`version.json`** — set `"version"` to the same number and `"released"` to
   today's date (`YYYY-MM-DD`). The installed extension polls this file once a day
   to decide whether to show the update banner. If you forget this, existing users
   never find out the new version exists. The release workflow does NOT check this
   file, so it is the easiest thing to forget.

3. **`CHANGELOG.md`** — add a new section at the top, directly under the intro:

   ```
   ## [2.0.2] - 2026-06-20

   ### Fixed
   - ...

   ### Changed
   - ...

   ### Added
   - ...
   ```

   The heading must be exactly `## [VERSION] - DATE`. The workflow finds the block
   by matching `## [2.0.2]`, so the version in the brackets has to match the tag
   (minus the `v`) character for character.

4. **Pick the version number.** Use semantic versioning: patch for fixes
   (`2.0.1` to `2.0.2`), minor for new features (`2.0.x` to `2.1.0`), major for
   breaking changes. The tag is `v` plus this number.

## Cutting the release

From inside the `Phantom/` directory, with the four edits committed on `main`:

```bash
# 1. Confirm manifest version is what you expect
jq -r .version manifest.json        # e.g. 2.0.2

# 2. Commit the version bump and changelog
git add manifest.json version.json CHANGELOG.md
git commit -m "Release v2.0.2"

# 3. Tag it (the v-number must equal the manifest version exactly)
git tag v2.0.2

# 4. Push the branch and the tag
git push origin main
git push origin v2.0.2
```

Pushing the tag is what triggers the workflow. Watch it under the repo's
**Actions** tab. When it goes green, the release is live on the **Releases** page
with `phantom.zip` attached.

## After the release

- **Update the download site.** The site in `../phantom-site` (deployed to
  `phantom.farehard.com`) should point at the new zip and show the same SHA256
  that the release body shows. `SECURITY.md` promises users these two match, so
  they need to actually match. Grab the SHA256 from the release body or run
  `sha256sum` on the downloaded zip.
- **Verify the install.** Download the zip from the release, extract it, load it
  unpacked in Chrome (`chrome://extensions` with Developer mode on), and confirm
  the popup shows the new version and the Exposure Dashboard diagnostic passes.

## If the workflow fails

- **Tag does not match manifest.** The most common cause. The tag is `vX.Y.Z`,
  the manifest value is `X.Y.Z` with no `v`. Fix `manifest.json`, delete and
  re-push the tag (see below).
- **No changelog entry found.** The `## [X.Y.Z]` heading in `CHANGELOG.md` does
  not match the tag. Fix the heading, recommit, then re-tag.
- **Zip over 200KB.** Something large was added to the build allowlist in
  `release.yml`, or a large file was committed that the allowlist now picks up.
  Check the "contents" list printed in the workflow log.

To re-tag after a fix:

```bash
git tag -d v2.0.2                 # delete the local tag
git push origin :refs/tags/v2.0.2 # delete the remote tag
# fix and commit, then tag and push again
git tag v2.0.2
git push origin v2.0.2
```

Deleting a tag does not delete a Release that was already published. If a bad
release got created, delete it from the **Releases** page before re-pushing.

# Hub

One page of links for the household. No build step, just static files.

## Profiles

| Profile | Who | Sees | Switching |
|---|---|---|---|
| **Tope** (admin) | You | Everything, plus Pinned, Recent and the Server & admin group | Needs the PIN to get in |
| **Guest** | Visitors | Only links with `"guest"` in `show` | Default on any new device |
| **Kid** | The kid | Only links with `"kid"` in `show`, as big tiles, with no search | Needs the PIN to get out |

Each device remembers its profile, so you enter the PIN once per device.

## Adding or changing a link (`services.json`)

```json
{
  "id": "jellyfin",
  "name": "Jellyfin",
  "short": "Jelly",            // optional: shorter label for the tile
  "url": "https://videos.topearebi.xyz",
  "group": "watch",            // one of the ids in "groups"
  "description": "Shown in the details sheet",
  "keywords": "extra words search should match",
  "show": ["guest", "kid"],    // who else can see it; admin always can. [] = admin only
  "pinned": true,              // optional: pinned by default
  "mirrors": [{ "name": ".se", "url": "https://..." }]   // optional
}
```

To reorder or rename the groups, edit the `groups` list at the top of the file.

## Settings (top of `script.js`)

- `pinHash`: the SHA-256 of your PIN. The default PIN is **1234**. To change it, run `printf 4821 | shasum -a 256` and paste the result in.
- `defaultProfile`, `adminName`, `weather` (location shown under the date).
- `favicons`: site icons come from Google's favicon service, which sends it your hostnames. Set this to `false` to use letter tiles only.

The PIN is a household lock, not real security, because anyone can read these files. To actually protect admin links, put the site behind Cloudflare Access or Tailscale.

## After changing the HTML, CSS or JS

Bump `CACHE_VERSION` in `sw.js` so installed copies of the app pick up the change.

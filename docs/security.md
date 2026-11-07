# Security

Pastekar runs on the public internet, so the design assumes strangers will find it. This document lists the main threats, how each is handled, and what remains a known limit.

## What is protected

| Asset | Risk if exposed |
|---|---|
| Password-protected and burn-after-read pastes | Private team data leaks |
| The ability to create pastes | Malware hosting, storage costs, damage to the domain's reputation |
| The app's origin | Scripts running under the site's domain |
| Service credentials | Full access to data and files |

## Team access

- The passcode is stored only as a scrypt hash, in the `TEAM_PASSCODE_HASH` environment variable.
- A correct passcode sets `pk_session`, a signed cookie that lasts 30 days and is `HttpOnly`, `Secure` and `SameSite=Lax`.
- Passcode comparison is constant-time, and failed attempts are limited to 5 per IP per 15 minutes.
- Use a long, random passcode. A short one is the weakest point in the system.

### When someone leaves the team

A shared passcode can't remove one person. To revoke access:

1. Set a new `TEAM_PASSCODE_HASH`.
2. Set a new `SESSION_SECRET`, which logs everyone out.
3. Redeploy, since Vercel applies environment variable changes on the next deployment.
4. Share the new passcode with the team.

Changing only the passcode leaves existing sessions active.

## Cross-site requests

Routes that change data accept requests only when the `Origin` header matches `APP_URL`. Together with `SameSite=Lax` cookies, this blocks cross-site request forgery.

## Malicious uploads

A file containing HTML, SVG or JavaScript could run scripts if it were served from the app's own domain. Pastekar uses several layers:

1. **Separate origin:** files are only served from `<account-id>.r2.cloudflarestorage.com`, so a script in a file can't reach the app's cookies or pages.
2. **Safe inline list:** only the types below may display in the browser. Everything else, including HTML and SVG, is stored as `application/octet-stream` with `Content-Disposition: attachment`.
3. **Fixed metadata:** the server chooses the type and disposition, and they are signed into the upload URL.
4. **Safe filenames:** control characters and path separators are removed, and names are encoded following RFC 5987.

```text
image/png  image/jpeg  image/gif  image/webp  image/avif
video/mp4  video/webm  audio/mpeg  audio/ogg
```

Pastekar doesn't scan uploads for malware. Viewers should treat downloaded files with normal care.

## Rendering user content

- **Text and code** are rendered as escaped text.
- **Markdown** is sanitized against an allowlist. Raw HTML is removed, and only `http`, `https` and `mailto` links are allowed.
- **`/{slug}/raw`** returns `text/plain` with `X-Content-Type-Options: nosniff` and `Content-Security-Policy: sandbox`.

### Response headers

All app pages send:

| Header | Value or purpose |
|---|---|
| `Content-Security-Policy` | Nonce-based scripts. Images and media are limited to the app and the R2 host. Uploads connect only to the R2 host. |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `no-referrer`, so slugs and signed URLs don't leak to linked sites |
| `X-Robots-Tag` | `noindex, nofollow` on paste routes |
| `Cache-Control` | `no-store` on paste routes |

## Paste privacy

- **Passwords:** hashed with scrypt from `node:crypto`, which needs no native package on Vercel. Attempts are limited to 5 per paste per IP per 15 minutes.
- **Unlock cookies:** signed, bound to the paste ID and password hash, and valid for 1 hour. Changing a password invalidates them.
- **File links:** issued only after expiry and password checks. Download links are valid for 5 minutes, and inline media links for 1 hour.
- **Link previews:** password-protected and burn-after-read pastes show a generic title and description, so previews don't leak their content.
- **Burn after read:** viewing requires a `POST`, so link previews can't trigger it. The delete is atomic. See the [data model](data-model.md#atomic-burn).

## Service credentials

- Credentials live only in Vercel environment variables, never in the repository.
- The R2 token is limited to the one bucket, with object read and write access only.
- The cleanup route requires `CRON_SECRET`.
- The bucket has no public access, and its CORS policy allows only `APP_URL`.

## Abuse limits

| Limit | Value |
|---|---|
| File size | 100 MB |
| Files per paste | 10 |
| Text size | 1 MB |
| Total storage | `MAX_TOTAL_STORAGE_BYTES` |
| Passcode attempts | 5 per IP per 15 minutes |
| Paste password attempts | 5 per paste per IP per 15 minutes |

Size is checked three times: when the upload is requested, in the signed upload URL, and with a `HEAD` request before the file is attached. The final check is the one that's relied on.

## Known limits

- **Pastes without a password are public.** A custom slug like `/passwords` is easy to guess. Sensitive content needs a password, or a random slug at minimum.
- **Content isn't end-to-end encrypted.** Services and anyone with database access can read pastes. Don't store production secrets long term.
- **All team members have equal access,** and there is no record of who created or changed a paste.
- **Burned files stay in the bucket briefly.** They remain for at least 65 minutes and until the next cleanup run, and on a daily schedule that may be about a day. They can't be reached once their signed URLs expire.
- **A signed link can be forwarded** while it is valid: 5 minutes for downloads and 1 hour for inline media.
- **The edit page shows protected content.** Any team session can read a password-protected or burn-after-read paste on `/{slug}/edit` without the password, and without burning it. This follows from equal trust between team members.
- **Public routes aren't rate limited** in the app, so slugs can be probed. Vercel's firewall can be added if this becomes a problem.
- **IP-based limits are imperfect.** An attacker with many addresses can spread attempts, which is another reason to use a long passcode.

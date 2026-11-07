# API

All API routes accept and return JSON and live under `/api`, except the public `raw` and `download` routes under `/{slug}`.

## Conventions

### Access levels

| Level | Meaning |
|---|---|
| Public | No credentials needed |
| Session | Needs the `pk_session` cookie from `POST /api/session` |
| Paste access | Public, but a password-protected paste also needs its unlock cookie |
| Cron | Needs `Authorization: Bearer $CRON_SECRET` |

Requests that change data must also send a same-site `Origin` header. Browsers do this automatically.

### Errors

Errors use one format:

```json
{
  "error": {
    "code": "slug_taken",
    "message": "That link is already in use."
  }
}
```

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `invalid_request` | The body or parameters failed validation |
| 400 | `invalid_slug` | The slug breaks the format rules |
| 400 | `reserved_slug` | The slug is on the reserved list |
| 400 | `file_required` | The paste has several files and no `file` parameter was given |
| 401 | `unauthorized` | Session is missing or invalid |
| 401 | `wrong_passcode` | The team passcode is incorrect |
| 401 | `wrong_password` | The paste password is incorrect |
| 401 | `locked` | The paste needs to be unlocked first |
| 403 | `forbidden` | The `Origin` header failed the same-site check |
| 403 | `reveal_required` | The paste is burn-after-read and must be opened with reveal |
| 404 | `not_found` | The paste doesn't exist, has expired, or has been burned |
| 409 | `slug_taken` | Another paste already uses the slug |
| 413 | `too_large` | The text or file exceeds its size limit |
| 422 | `upload_incomplete` | A file is missing, already used, or its size doesn't match |
| 429 | `rate_limited` | Too many attempts. A `Retry-After` header is included. |
| 507 | `storage_full` | The upload would exceed the total storage limit |

## Session

### `POST /api/session`

Checks the team passcode and sets the session cookie. Access: Public, rate limited.

```json
{ "passcode": "the-team-passcode" }
```

Returns `204` with a `Set-Cookie` header. Errors: `wrong_passcode`, `rate_limited`.

### `DELETE /api/session`

Clears the session cookie. Access: Session. Returns `204`.

## Slugs

### `GET /api/slugs/{slug}`

Checks whether a slug can be used. Access: Session.

```json
{ "slug": "standup-notes", "available": false, "reason": "slug_taken" }
```

`reason` is null when the slug is available, otherwise `invalid_slug`, `reserved_slug` or `slug_taken`.

## Uploads

### `POST /api/uploads`

Registers a file and returns a signed upload URL. Access: Session.

```json
{
  "filename": "design.png",
  "contentType": "image/png",
  "sizeBytes": 2483021
}
```

Response `201`:

```json
{
  "fileId": "6f1c1c1e-6f1f-4a57-9a43-0f1d7a2c8b11",
  "uploadUrl": "https://<account-id>.r2.cloudflarestorage.com/...",
  "method": "PUT",
  "headers": {
    "Content-Type": "image/png",
    "Content-Disposition": "inline"
  },
  "expiresAt": "2026-11-07T15:15:00Z"
}
```

The browser must send the file with exactly these headers, because they are part of the signature. Upload URLs last 15 minutes.

The storage-limit check and the insert run in one transaction under an advisory lock, so parallel requests can't exceed `MAX_TOTAL_STORAGE_BYTES`.

Errors: `invalid_request`, `too_large`, `storage_full`, `unauthorized`.

## Pastes

### `POST /api/pastes`

Creates a paste. Access: Session.

```json
{
  "slug": "standup-notes",
  "title": "Standup notes",
  "format": "markdown",
  "language": null,
  "content": "# Monday\n\n- Ship the login page",
  "fileIds": ["6f1c1c1e-6f1f-4a57-9a43-0f1d7a2c8b11"],
  "password": null,
  "expiresIn": "7d",
  "burnAfterRead": false
}
```

| Field | Required | Notes |
|---|---|---|
| `slug` | No | Random if omitted. See [Routing](routing.md). |
| `title` | No | Up to 200 characters |
| `format` | No | `text` (default), `code` or `markdown` |
| `language` | No | Highlighting language for `code` |
| `content` | Conditional | Up to 1 MB. Required if `fileIds` is empty. |
| `fileIds` | Conditional | Up to 10. Required if `content` is empty. |
| `password` | No | Up to 200 characters |
| `expiresIn` | No | `1h`, `1d`, `7d`, `30d` (default) or `never` |
| `burnAfterRead` | No | Defaults to `false` |

Response `201`:

```json
{
  "slug": "standup-notes",
  "url": "https://your-domain.example/standup-notes",
  "expiresAt": "2026-11-14T15:00:00Z"
}
```

Errors: `invalid_request`, `invalid_slug`, `reserved_slug`, `slug_taken`, `too_large`, `upload_incomplete`, `unauthorized`.

### `PATCH /api/pastes/{slug}`

Updates a paste. Access: Session. Send only the fields to change.

Accepts `slug`, `title`, `format`, `language`, `content`, `password`, `expiresIn` and `burnAfterRead`, with the same rules as create. Setting `password` to null removes the password. A new `expiresIn` counts from the time of the update.

Returns `200` with the same body as create. Errors: the same as create, plus `not_found`.

### `DELETE /api/pastes/{slug}`

Deletes a paste and marks its files for removal. Access: Session. Returns `204`. Errors: `not_found`, `unauthorized`.

### `POST /api/pastes/{slug}/unlock`

Checks a paste password and sets an unlock cookie valid for 1 hour. Access: Public, rate limited.

```json
{ "password": "paste-password" }
```

Returns `204`. Errors: `wrong_password`, `not_found`, `rate_limited`.

### `POST /api/pastes/{slug}/reveal`

Opens a burn-after-read paste and permanently deletes it. Access: Paste access.

Response `200`:

```json
{
  "title": "Temporary credentials",
  "format": "text",
  "language": null,
  "content": "The content, shown once",
  "files": [
    {
      "id": "6f1c1c1e-6f1f-4a57-9a43-0f1d7a2c8b11",
      "filename": "keys.zip",
      "sizeBytes": 1024,
      "url": "https://<account-id>.r2.cloudflarestorage.com/..."
    }
  ]
}
```

Errors: `locked`, `not_found`, and `invalid_request` if the paste isn't burn-after-read.

## Public content routes

### `GET /{slug}/raw`

Returns the text content as `text/plain; charset=utf-8`. Access: Paste access.

Errors: `locked`, `reveal_required`, and `not_found` if the paste doesn't exist or has no text.

### `GET /{slug}/download`

Redirects with `302` to a signed file URL valid for 5 minutes. Access: Paste access.

| Query parameter | Notes |
|---|---|
| `file` | A file ID. Required when the paste has more than one file. |

Errors: `file_required`, `locked`, `reveal_required`, `not_found`.

## Cron

### `GET /api/cron/cleanup`

Runs [cleanup](architecture.md#cleanup). Access: Cron.

Response `200`:

```json
{ "pastesDeleted": 4, "filesDeleted": 7, "rateLimitRowsDeleted": 31 }
```

Errors: `unauthorized`.

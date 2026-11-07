# Deployment

Pastekar runs on three services. GitHub hosts the repository, and Vercel deploys from it on every push to the main branch.

GitHub Pages can't host Pastekar because it serves only static files and has no server or database.

The limits and prices below were checked on 7 November 2026. Check the linked pages before relying on them.

## Plans and costs

### Vercel

Vercel's Hobby plan is restricted to non-commercial personal use. Its [fair use guidelines](https://vercel.com/docs/limits/fair-use-guidelines) count a deployment as commercial if it's for the financial gain of anyone involved in producing it, including a paid employee or consultant writing the code.

**If this is a personal project, Hobby fits. If it's built as part of paid work for a company, use Pro or confirm with Vercel.** See [Vercel pricing](https://vercel.com/pricing).

| Limit | Value | Effect on Pastekar |
|---|---|---|
| [Function request and response size](https://vercel.com/docs/functions/limitations) | 4.5 MB | Files go directly to R2, and text is capped at 1 MB |
| [Hobby cron frequency](https://vercel.com/docs/cron-jobs/usage-and-pricing) | Once a day, with timing accurate only to the hour | Cleanup runs daily, and expiry is checked on read |

### Neon

| Free plan limit | Value |
|---|---|
| Storage | 1 GB per project |
| Compute | 100 CU-hours per project per month |
| Public network transfer | 5 GB per project per month |

If compute or transfer runs out, the database is suspended until the next billing period or an upgrade. If storage runs out, writes that add data fail. A database idle for a while may also take a moment to wake up on the first request.

See [Neon plans](https://neon.com/docs/introduction/plans).

### Cloudflare R2

| Item | Free each month | Beyond that |
|---|---|---|
| Standard storage | 10 GB-month | $0.015 per GB-month |
| Class A operations (uploads) | 1 million | $4.50 per million |
| Class B operations (reads) | 10 million | $0.36 per million |
| Egress | Free | Free |

See [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

Set `MAX_TOTAL_STORAGE_BYTES` to 10 GB or less to stay inside the free allowance.

## Setup

### 1. Create the database

1. Create a project in Neon, in the region closest to your Vercel functions.
2. Copy the pooled connection string for `DATABASE_URL`.

### 2. Create the file bucket

1. Create an R2 bucket named `pastekar-files`, and leave public access off.
2. Create an R2 API token limited to this bucket, with object read and write access.
3. Copy the account ID, access key ID and secret access key.
4. Add the [CORS policy](#r2-cors-policy) below.

### 3. Create secrets

Generate the session and cron secrets:

```sh
openssl rand -hex 32
```

Generate the passcode hash with the project script. It prompts for the passcode and prints a hash that is safe to paste into an `.env` file, because it contains no `$`:

```sh
npm run passcode:hash
```

### 4. Deploy to Vercel

1. Import the GitHub repository into Vercel.
2. Add the [environment variables](#environment-variables).
3. Deploy, then add your domain.
4. Set `APP_URL` to the final domain, update the R2 CORS policy to match, and redeploy.
5. Run the database migrations against `DATABASE_URL`.

**Preview deployments don't support writes.** The `Origin` check and the R2 CORS policy only accept `APP_URL`, so login, create and upload fail on Vercel preview URLs. Test those flows locally and on production.

### 5. Check it works

1. Log in with the passcode, then create a text paste.
2. Upload a small file and download it.
3. Open the paste in a private window to confirm that viewing needs no login.
4. In the Vercel dashboard, confirm the cleanup cron job is listed.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `APP_URL` | Yes | Public site URL, used for links and `Origin` checks |
| `DATABASE_URL` | Yes | Neon pooled connection string |
| `R2_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | Yes | R2 API token key |
| `R2_SECRET_ACCESS_KEY` | Yes | R2 API token secret |
| `R2_BUCKET` | Yes | Bucket name |
| `TEAM_PASSCODE_HASH` | Yes | scrypt hash of the team passcode |
| `SESSION_SECRET` | Yes | Signs session and unlock cookies |
| `CRON_SECRET` | Yes | Protects the cleanup route. Vercel sends it automatically. |
| `MAX_TOTAL_STORAGE_BYTES` | No | Total file storage limit. Default `10737418240` (10 GB). |
| `MAX_FILE_BYTES` | No | Per-file limit. Default `104857600` (100 MB). |
| `MAX_TEXT_BYTES` | No | Text limit. Default `1048576` (1 MB). |
| `MAX_FILES_PER_PASTE` | No | Default `10` |

## Configuration files

### Cron schedule

`vercel.json` runs cleanup at about 03:00 UTC each day:

```json
{
  "crons": [
    { "path": "/api/cron/cleanup", "schedule": "0 3 * * *" }
  ]
}
```

### R2 CORS policy

Replace the origin with your `APP_URL`:

```json
[
  {
    "AllowedOrigins": ["https://your-domain.example"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type", "Content-Disposition"],
    "MaxAgeSeconds": 3600
  }
]
```

Downloads and inline images don't need a CORS rule, because they load as normal page resources.

R2 presigned URLs only work on the `<account-id>.r2.cloudflarestorage.com` domain, [not on custom domains](https://developers.cloudflare.com/r2/api/s3/presigned-urls/). File links therefore show that hostname.

## Backups

| Data | Method |
|---|---|
| Database | Scheduled `pg_dump`, plus Neon's own restore features on your plan |
| Files | `rclone sync` from R2 to another location |

Pastes are temporary by design, so backups are optional unless the team keeps permanent pastes. If you do keep backups, test a restore, and remember that backups keep burned and deleted content until they are rotated.

## Rotating secrets

| Secret | Effect of rotating |
|---|---|
| `TEAM_PASSCODE_HASH` | New logins need the new passcode. Existing sessions continue. |
| `SESSION_SECRET` | Everyone is logged out, and all unlock cookies stop working |
| `CRON_SECRET` | None |
| R2 token | Update both R2 variables together |

Redeploy after any change.

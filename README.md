# Pastekar

Pastekar is a private sharing site for a team, in the style of pastebin and justpaste.it. Paste text, code or Markdown, or upload files and images, then share a short link at a route you choose:

```text
https://your-domain.example/standup-notes
```

> **Status:** text pastes, passwords, burn after read, expiry and the edit page are built. File uploads and the cleanup job are still to come. See the [roadmap](docs/roadmap.md).

## Features

- **Custom routes:** choose the link yourself, or leave it blank for a random one.
- **Share anything:** text, code with syntax highlighting and line numbers, and Markdown with a rendered and source view. Images and files up to 100 MB are planned.
- **Copy and download:** copy a paste or download it as a file from the viewer.
- **Light and dark themes:** follows your system, with a toggle.
- **Multiple files:** attach up to 10 files to one paste, with or without text.
- **Expiry:** links can last 1 hour, 1 day, 7 days, 30 days, or forever.
- **Password protection:** lock an individual paste, including its files.
- **Burn after read:** a paste can delete itself the first time it is opened.
- **Simple access:** the team shares one passcode to create pastes. Anyone with a link can view.

## How it works

| Part | Service | Purpose |
|---|---|---|
| Web app and API | Next.js on Vercel | Pages, validation, access checks |
| Database | Neon Postgres | Paste details and text content |
| File storage | Cloudflare R2 (private bucket) | Uploaded files |

Browsers upload files straight to R2, because Vercel functions can't accept request bodies over 4.5 MB. See the [architecture](docs/architecture.md) for details.

## Documentation

| Document | What it covers |
|---|---|
| [Architecture](docs/architecture.md) | Components, request flows, folder layout |
| [Routing](docs/routing.md) | Slug rules, reserved words, collisions |
| [Data model](docs/data-model.md) | Database schema, file storage layout |
| [API](docs/api.md) | Routes, requests, responses, error codes |
| [Security](docs/security.md) | Threats, protections, known limits |
| [Deployment](docs/deployment.md) | Service setup, environment variables, costs, backups |
| [Roadmap](docs/roadmap.md) | Build phases and acceptance criteria |

## Quick start

You need a current Node.js LTS (built and tested on Node 26) and a Postgres database (a free Neon project works).

```sh
npm install
cp .env.example .env.local     # then fill in the values
npm run passcode:hash          # prints the value for TEAM_PASSCODE_HASH
npm run db:migrate             # applies the schema to DATABASE_URL
npm run dev
```

Other commands: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

For a real deployment, follow the [deployment guide](docs/deployment.md). Vercel preview URLs don't support logging in or creating pastes.

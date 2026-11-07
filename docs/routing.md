# Routing and slugs

A **slug** is the part of the link after the domain. In `https://your-domain.example/standup-notes`, the slug is `standup-notes`. Slugs sit at the root of the site so that links stay short.

## Slug rules

- 1 to 64 characters
- Lowercase letters, digits, hyphens and underscores
- Must start and end with a letter or digit
- One path segment only, so `team/notes` isn't allowed
- Can't be a [reserved word](#reserved-words)

```ts
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/;
```

### Normalization

The app trims whitespace and lowercases the input before validating it, so `Standup-Notes` is saved as `standup-notes`. Spaces and other characters are rejected, not converted, so the saved link is always exactly what the creator expects.

When someone opens a link with capitals, such as `/Standup-Notes`, the app redirects to the lowercase path with a `308`.

## Reserved words

These slugs are rejected because the app uses them or may need them later:

```text
_next  about  admin  api  assets  dashboard  docs  download  edit  favicon.ico
health  help  login  logout  new  raw  robots.txt  settings  sitemap.xml  static
status
```

The list lives in `src/lib/slugs.ts`. Some entries can't pass the slug pattern anyway, but they stay listed as a second safeguard. **Any new top-level route must be added to this list in the same change.**

## Random slugs

If the slug field is empty, the app generates 7 characters from an alphabet without look-alike characters:

```text
23456789abcdefghjkmnpqrstuvwxyz
```

That allows about 27.5 billion combinations. The app retries with a new slug if one is already taken.

## Collisions

Two people can try to claim the same slug at the same moment, so the database decides:

1. The create form calls `GET /api/slugs/{slug}` as the user types, which gives quick feedback.
2. `POST /api/pastes` inserts the row.
3. The `UNIQUE` constraint on `pastes.slug` lets exactly one insert succeed.
4. The other request receives `409 slug_taken`, and the form keeps the user's content so they can pick another slug.

The availability check only improves the experience. It is never treated as a guarantee.

## Slug reuse

A slug becomes available once its paste is deleted, burned or expired.

An expired paste can still occupy its row until cleanup runs, which may be up to a day later. Create and rename therefore delete any expired paste holding the requested slug before inserting. That delete goes through the shared `removePaste` helper, so the paste's files are scheduled for removal like those of any other deleted paste. The availability check treats expired rows as free for the same reason.

Reused slugs have one consequence: an old link can start pointing to new content. Team members should keep this in mind when reusing a well-known slug.

## Renaming

A team member can change a slug from `/{slug}/edit`, following the same rules. The old link stops working immediately, and no redirect is kept.

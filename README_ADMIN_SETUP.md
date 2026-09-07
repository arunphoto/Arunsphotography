# Arun's Photography — Live Admin Portal v2

## What was added
- `admin.html` — protected admin portal.
- `api/auth.js` — server-side admin login session.
- `api/media.js` — GitHub read/write for image and small-video management.
- `api/blob-sign.js` — secure large-video upload URL for Vercel Blob.
- `media-manifest.json` — records removed media and large-video overrides.
- `media-runtime.js` — tiny public-site runtime that hides removed slots and uses large-video overrides.
- `package.json` — adds `@vercel/blob`.
- Existing public pages were only given the runtime script and a small Admin Portal link on `index.html`; the visual design is otherwise preserved.

## Vercel Environment Variables
Add these to the Production environment:

```text
ADMIN_USER=your-admin-id
ADMIN_PASSWORD=use-a-strong-password
ADMIN_SESSION_SECRET=long-random-secret

GITHUB_TOKEN=your-fine-grained-github-token
GITHUB_OWNER=your-github-username-or-org
GITHUB_REPO=your-repository-name
GITHUB_BRANCH=main
GITHUB_COMMITTER_NAME=Arun's Photography Admin
GITHUB_COMMITTER_EMAIL=your-email@example.com
```

The GitHub token should have repository **Contents: read and write** permission for the repository. Do not put this token in `admin.html`.

## Vercel Blob for large videos
Create/connect a **public Vercel Blob** store to the same Vercel project. Client uploads are used for videos larger than 4 MB because Vercel Functions have a 4.5 MB request-body limit. Vercel Blob supports multipart uploads for large files.

## Filename rule
Images use fixed slot names:

```text
Wedding: images/wedding/01.jpg ... 31.jpg
Couples: images/couples-pre-post-wedding/01.jpg ... 27.jpg
Baby: images/baby/01.jpg ... 14.jpg
Traditional: images/traditional/01.jpg ... 17.jpg
Maternity: images/maternity/01.jpg ... 08.jpg
Home: images/hero-1.jpg, hero-2.jpg, hero-3.jpg
```

When you upload a new wedding image to slot `01`, the portal writes it to **exactly** `images/wedding/01.jpg`. It does not create `01(1).jpg`.

Remove means the file is deleted from the repository and the path is placed in `media-manifest.json` so the public slot is hidden rather than showing a broken image. Uploading to the same slot removes that hidden flag and restores the slot.

## Live update flow
Admin → GitHub commit → Vercel production deployment → live website.

Large videos use:
Admin → direct browser upload to Vercel Blob → manifest commit to GitHub → Vercel deployment → live video URL.

# Firefly URL Shortener

A minimal URL shortener service built with Hono and Cloudflare Workers.

## Features

- Custom domain support with Cloudflare Workers
- R2 storage for URL mappings
- Protected API endpoints
- Auto-generated slugs
- Fallback 404 redirects

## Setup

1. Copy `.env.example` to `.env` and fill in your values
2. Install dependencies: `pnpm install`
3. Build: `pnpm run build`
4. Deploy: `pnpm run deploy`

## API Usage

### Create Short URL

`POST /api/create`

Creates a new short URL with optional social media metadata.

#### Headers

- `Authorization: Bearer <AUTH_TOKEN>` (Required)
- `Content-Type: application/json`

#### RequestBody

```json
{
  "redirectTo": "https://your-domain.com",
  "slug": "my-awesome-slug" // Optional
}
```

### Access Short URL

`GET /:slug`

Redirects to the target URL.

### Debug Redirect

`GET /:slug/debug`

Returns information about a redirect.

#### Headers

- `Authorization: Bearer <AUTH_TOKEN>` (Optional)

#### Response (Authenticated)

```json
{
  "success": true,
  "data": {
    "slug": "my-awesome-slug",
    "redirectTo": "https://your-domain.com",
    "createdAt": 1705123456789,
    "meta": {
      "title": "My Page",
      "tags": ["example", "demo"],
      "customField": "any value"
    }
  }
}
```

#### Response (Public)

```json
{
  "success": true,
  "data": {
    "slug": "my-awesome-slug",
    "redirectTo": "https://your-domain.com",
    "createdAt": 1705123456789
  }
}
```

## Notes

- Slugs are auto-generated (4 characters) if not provided
- Auto-generation will retry up to 5 times if collision occurs
- All redirects use 302 (temporary) status code
- Root path ('/') redirects to FALLBACK_404, if not configured, it will return a 404 JSON response

# URL Shortener with Cloudflare Workers

This project is a simple URL shortener built using Cloudflare Workers. It shortens long URLs and provides rich social media sharing previews.

## Features

- Redirects shortened URLs to the original destination.
- Automatically generates Open Graph (OG) meta tags for Facebook and Twitter rich link previews.
- Simple setup using Cloudflare Workers and KV storage.

## How It Works

1. When a `GET` request is made to a shortened URL:
   - It checks the KV namespace for the path.
   - If the URL is found, the Worker will:
     - For social media bots (like Facebook or Twitter), generate an HTML page with OG tags for rich previews.
     - Per regular browsers, redirect a `301` URL to the original target URL.
   - If no URL is found for the path, it returns a `404 Not Found` response.

2. The script only allows `GET` requests. Other HTTP methods will return a `405 Method Not Allowed` response.

## Example

### 1. KV Key-Value Setup

In your Cloudflare KV namespace (`LINKS`).

### 2. Shortened URL

Once the KV is set up, visiting the following shortened URL will trigger the Worker:

**Shortened URL:**  
```
https://your-domain/short-link
```

- **When accessed via a regular browser**:  
  The user will be redirected to `https://www.example.com/long-url.jpg`.

- **When accessed by social media bots (e.g., Facebook or Twitter)**:  
  A preview will be generated with:
  - **Title:** `Example Title`
  - **Image:** `https://www.example.com/image.jpg`

### Example Redirect

- If a user or bot visits `https://your-worker-domain.com/short-link`:
  - A browser will be redirected to `https://www.example.com/long-url.jpg`.
  - A Facebook or Twitter bot will receive an HTML page with OG meta tags that show a preview when shared.

## Setup Instructions

1. Deploy this Cloudflare Worker script.
2. Create a KV namespace called `LINKS`, and link it to your worker.
3. Set your Domain.
```
// Domain configuration
const DOMAIN = '';
```

5. Update your Worker script to use the `LINKS` KV namespace.

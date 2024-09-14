# URL Shortener with Cloudflare Workers

This project is a simple URL shortener built using Cloudflare Workers. It allows for shortening long URLs and providing rich previews for social media sharing.

## Features

- Redirects shortened URLs to the original destination.
- Automatically generates Open Graph (OG) meta tags for Facebook and Twitter rich link previews.
- Simple setup using Cloudflare Workers and KV storage.

## How It Works

1. When a `GET` request is made to a shortened URL:
   - It checks the KV namespace for the path.
   - If the URL is found, the Worker will:
     - For social media bots (like Facebook or Twitter), generate an HTML page with OG tags for rich previews.
     - For regular browsers, perform a `301` redirect to the original target URL.
   - If no URL is found for the path, it returns a `404 Not Found` response.

2. The script only allows `GET` requests. Other HTTP methods will return a `405 Method Not Allowed` response.

## Example

### 1. KV Key-Value Setup

In your Cloudflare KV namespace (`LINKS`), add the following key-value pair:

**Key:** `short-link`

**Value:**  
```
https://www.example.com/long-url.jpg,https://www.example.com/image.jpg,Example Title,This is an example description.
```

- **`https://www.example.com/long-url.jpg`**: The URL where the user will be redirected.
- **`https://www.example.com/image.jpg`**: The image to be shown in social media previews.
- **`Example Title`**: The title for the preview.
- **`This is an example description.`**: The description for the preview.

### 2. Shortened URL

Once the KV is set up, visiting the following shortened URL will trigger the Worker:

**Shortened URL:**  
```
https://your-worker-domain.com/short-link
```

- **When accessed via a regular browser**:  
  The user will be redirected to `https://www.example.com/long-url.jpg`.

- **When accessed by social media bots (e.g., Facebook or Twitter)**:  
  A preview will be generated with:
  - **Title:** `Example Title`
  - **Description:** `This is an example description.`
  - **Image:** `https://www.example.com/image.jpg`

### Example Redirect

- If a user or bot visits `https://your-worker-domain.com/short-link`:
  - A browser will be redirected to `https://www.example.com/long-url.jpg`.
  - A Facebook or Twitter bot will receive an HTML page with OG meta tags that show a preview when shared.

## Setup Instructions

1. Deploy this Cloudflare Worker script.
2. Create a KV namespace called `LINKS`,link it to your worker.
3. Add shortened URL mappings (as demonstrated in the example above) in the format:
   ```
   targetUrl,imageUrl,title,description
   ```

4. Update your Worker script to use the `LINKS` KV namespace.

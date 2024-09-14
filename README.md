# Short-Links-for-CloudFlare-Workers

# URL Shortener with Cloudflare Workers

This project provides a basic URL shortener built using Cloudflare Workers. It allows users to shorten URLs and create social media-friendly link previews.

## Features

- Redirects shortened URLs to the target destination.
- Generates meta tags for rich previews on social media platforms like Facebook and Twitter.
- Simple and lightweight.

## How It Works

- On receiving a `GET` request with the shortened path:
  - If a valid link is found, it checks the `User-Agent` of the request.
  - For social media bots (Facebook/Twitter), it generates an HTML page with Open Graph (`og`) tags for previews.
  - For regular requests, it performs a `301` redirect to the original URL.
  
- If the path doesn't exist, it returns a `404 Not Found` response.
- For unsupported HTTP methods, it returns a `405 Method Not Allowed` response.

## Usage

1. Deploy the Worker to your Cloudflare account.
2. Add shortened URL data to the `LINKS` KV namespace in the format:
   ```
   targetUrl,image,title,description
   ```

## Example

- Visiting `/short-link` will redirect to the original URL or show a preview on social media platforms.

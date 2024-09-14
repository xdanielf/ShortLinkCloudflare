addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  const path = url.pathname.slice(1)

  if (request.method === 'GET') {
    if (path === '') {
      return new Response('Welcome to URL Shortener', { status: 200 })
    }

    const linkData = await LINKS.get(path)
    if (linkData) {
      const [targetUrl, image, title, description] = linkData.split(',').map(item => item.trim())

      if (request.headers.get('User-Agent').includes('facebookexternalhit') || 
          request.headers.get('User-Agent').includes('Twitterbot')) {
        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>${title || 'Shared Link'}</title>
              <meta property="og:title" content="${title || 'Shared Link'}">
              <meta property="og:description" content="${description || ''}">
              <meta property="og:image" content="${image || ''}">
              <meta name="twitter:card" content="summary_large_image">
            </head>
            <body>
              <script>window.location.href = "${targetUrl}";</script>
            </body>
          </html>
        `
        return new Response(html, {
          headers: { 'Content-Type': 'text/html' },
        })
      }

      return Response.redirect(targetUrl, 301)
    }
    return new Response('Not Found', { status: 404 })
  }

  return new Response('Method Not Allowed', { status: 405 })
}

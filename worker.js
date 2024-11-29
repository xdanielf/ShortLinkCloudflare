export default {
  async fetch(request, env) {
    const LINKS = env.LINKS
    const url = new URL(request.url)
    const path = url.pathname.slice(1)
    
    if (request.method === 'GET') {
      if (path === '') {
        return new Response(generateHTML(), {
          headers: { 'Content-Type': 'text/html' },
        })
      }
      
      // Modified list API endpoint
      if (path === 'api/links') {
        const LINKS_PER_PAGE = 30;
        const page = parseInt(url.searchParams.get('page')) || 1;
        const links = [];
        let listComplete = false;
        let cursor = null
        
        while (!listComplete) {
          const response = await LINKS.list(cursor ? { cursor } : {})
          for (const key of response.keys) {
            // Skip stats entries
            if (key.name.startsWith('stats:')) continue;
            
            const value = await LINKS.get(key.name)
            const [url, image, title, timestamp] = value.split(',').map(item => item.trim())
            links.push({ 
              key: key.name, 
              url, 
              image, 
              title: title || url,
              timestamp: parseInt(timestamp) || 0
            })
          }
          cursor = response.cursor
          listComplete = response.list_complete
        }
        
        links.sort((a, b) => b.timestamp - a.timestamp);
        
        const startIndex = (page - 1) * LINKS_PER_PAGE;
        const paginatedLinks = links.slice(startIndex, startIndex + LINKS_PER_PAGE);
        const totalPages = Math.ceil(links.length / LINKS_PER_PAGE);
        
        return new Response(JSON.stringify({
          links: paginatedLinks,
          pagination: {
            currentPage: page,
            totalPages,
            totalLinks: links.length
          }
        }), {
          headers: { 'Content-Type': 'application/json' }
        })
      }

      // Add detail view endpoint
      if (path.startsWith('view/')) {
        const key = path.replace('view/', '')
        const linkData = await LINKS.get(key)
        
        if (linkData) {
          const [url, image, title] = linkData.split(',').map(item => item.trim())
          return new Response(generateDetailHTML(key, url, image, title || url), {
            headers: { 'Content-Type': 'text/html' },
          })
        }
      }

      const linkData = await LINKS.get(path)
      if (linkData) {
        const [targetUrl, image, title] = linkData.split(',').map(item => item.trim())
        
        // Store visit data with stats: prefix
        const visitorInfo = await getVisitorInfo(request);
        const statsKey = `stats:${path}`;
        const existingStats = await LINKS.get(statsKey, 'json') || { visits: [] };
        existingStats.visits.push(visitorInfo);
        await LINKS.put(statsKey, JSON.stringify(existingStats));
        
        if (request.headers.get('User-Agent')?.includes('facebookexternalhit') || 
            request.headers.get('User-Agent')?.includes('Twitterbot')) {
          return new Response(generateMetaTags(targetUrl, image, title), {
            headers: { 'Content-Type': 'text/html' },
          })
        }
        
        return Response.redirect(targetUrl, 301)
      }
      
      // Add stats endpoint
      if (path.startsWith('api/stats/')) {
        const key = path.replace('api/stats/', '');
        const statsKey = `stats:${key}`;
        const stats = await LINKS.get(statsKey, 'json') || { visits: [] };
        return new Response(JSON.stringify(stats), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      return new Response('Not Found', { status: 404 })
    }

    // Modified POST endpoint
    if (request.method === 'POST' && path === 'api/shorten') {
      const data = await request.json()
      const { url, customPath, image, title } = data
      
      const shortPath = customPath || Math.random().toString(36).substr(2, 6)
      const timestamp = Date.now()
      const value = [url, image || '', title || '', timestamp].join(',')
      
      await LINKS.put(shortPath, value)
      
      return new Response(JSON.stringify({
        shortUrl: `https://l.danielmind.tech/${shortPath}`,
        path: shortPath
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // In the main fetch handler, modify DELETE endpoint
    if (request.method === 'DELETE') {
      if (path.startsWith('api/links/')) {
        const key = path.replace('api/links/', '')
        // Delete both link and its stats
        await Promise.all([
          LINKS.delete(key),
          LINKS.delete(`stats:${key}`)
        ])
        return new Response('Deleted', { status: 200 })
      }
      
      if (path.startsWith('api/stats/')) {
        const key = path.replace('api/stats/', '')
        await LINKS.delete(`stats:${key}`)
        return new Response('Deleted', { status: 200 })
      }
    }

    // In the main fetch handler
    if (request.method === 'PUT' && path.startsWith('api/stats/')) {
      const key = path.replace('api/stats/', '');
      const statsKey = `stats:${key}`;
      const data = await request.json();
      await LINKS.put(statsKey, JSON.stringify(data));
      return new Response('Updated', { status: 200 });
    }

    return new Response('Method Not Allowed', { status: 405 })
  }
}

async function getVisitorInfo(request) {
  const cf = request.cf || {};
  const referrer = request.headers.get('referer') || '';
  const userAgent = request.headers.get('user-agent') || '';
  
  return {
    ip: request.headers.get('cf-connecting-ip') || '',
    country: cf.country || '',
    timestamp: Date.now(),
    referrer,
    platform: getReferrerPlatform(referrer, userAgent)
  };
}

function getReferrerPlatform(referrer, userAgent) {
  if (referrer.includes('twitter.com') || referrer.includes('t.co')) {
    return { name: 'Twitter', url: referrer };
  }
  if (referrer.includes('facebook.com')) {
    return { name: 'Facebook', url: referrer };
  }
  return { name: 'Direct', url: '' };
}

function generateMetaTags(url, image, title) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title || 'Shared Link'}</title>
        <meta property="og:title" content="${title || 'Shared Link'}">
        <meta property="og:image" content="${image || ''}">
        <meta name="twitter:card" content="summary_large_image">
      </head>
      <body>
        <script>window.location.href = "${url}";</script>
      </body>
    </html>
  `
}

// Updated detail page HTML generator with homepage styles
function generateDetailHTML(key, url, image, title) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title} - URL Shortener</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
        <style>
          :root {
            --primary: #2563eb;
            --primary-dark: #1d4ed8;
            --success: #22c55e;
          }
          
          body {
            font-family: 'Inter', sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #f8fafc;
            color: #1e293b;
          }
          
          .container {
            background: white;
            padding: 32px;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          
          h1 {
            font-size: 24px;
            font-weight: 600;
            margin: 0 0 24px;
          }
          
          .detail-card {
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          
          .detail-card img {
            max-width: 100%;
            border-radius: 8px;
          }
          
          .detail-card p {
            font-size: 16px;
          }
          
          a {
            color: var(--primary);
            text-decoration: none;
          }
          
          a:hover {
            text-decoration: underline;
          }
          
          .button-group {
            display: flex;
            gap: 12px;
            margin-top: 16px;
          }
          
          button {
            background: var(--primary);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          button:hover {
            background: var(--primary-dark);
          }
          
          .copy-btn {
            background: #f1f5f9;
            color: #475569;
          }
          
          .copy-btn:hover {
            background: #e2e8f0;
          }
          
          .delete-btn {
            background: #fee2e2;
            color: #dc2626;
          }
          
          .delete-btn:hover {
            background: #fecaca;
          }
          
          .material-icons {
            font-size: 18px;
          }
          
          .stats-container {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #ccc;
          }
          
          .visit-item {
            padding: 12px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          
          .visit-source {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .platform-icon {
            width: 20px;
            height: 20px;
          }
          
          .back-btn {
            margin-bottom: 24px;
            background: none;
            padding: 8px;
            border-radius: 50%;
            color: var(--primary);
          }
          
          .back-btn:hover {
            background: #f0f0f0;
          }
          
          .stats-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
          }
          
          .checkbox {
            width: 18px;
            height: 18px;
            margin-right: 12px;
          }
          
          .pagination {
            display: flex;
            gap: 8px;
            align-items: center;
            margin-top: 16px;
          }
          
          .page-btn {
            padding: 6px 12px;
            background: #f0f0f0;
            border-radius: 4px;
          }
          
          .page-btn.active {
            background: var(--primary);
            color: white;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <button class="back-btn" onclick="window.location.href='/'">
            <span class="material-icons">arrow_back</span>
          </button>
          
          <div class="detail-card">
            ${image ? `<img src="${image}" alt="${title}">` : ''}
            <h1>${title}</h1>
            <p><strong>Original URL:</strong> <a href="${url}" target="_blank">${url}</a></p>
            <p><strong>Short URL:</strong> <a href="https://l.danielmind.tech/${key}" target="_blank">https://l.danielmind.tech/${key}</a></p>
            <div class="button-group">
              <button class="copy-btn" onclick="copyToClipboard('https://l.danielmind.tech/${key}')">
                <span class="material-icons">content_copy</span>
                Copy Short URL
              </button>
              <button class="delete-btn" onclick="deleteLink('${key}')">
                <span class="material-icons">delete</span>
                Delete Link
              </button>
            </div>
          </div>
          
          <div class="stats-container">
            <div class="stats-header">
              <h2>Visit History</h2>
              <div class="button-group">
                <button class="delete-btn" onclick="deleteSelectedVisits()">
                  <span class="material-icons">delete_sweep</span>
                </button>
                <label>
                  <input type="checkbox" class="checkbox" onchange="toggleAllVisits(this)">
                  Select All
                </label>
              </div>
            </div>
            <div id="visits-list"></div>
            <div id="pagination" class="pagination"></div>
          </div>
        </div>
        <script>
          async function deleteLink(key) {
            if (!confirm('Are you sure you want to delete this link?')) return;
            try {
              await fetch(\`/api/links/\${key}\`, { method: 'DELETE' });
              window.location.href = '/';
            } catch (err) {
              alert('Error deleting link: ' + err.message);
            }
          }
    
          function copyToClipboard(text) {
            navigator.clipboard.writeText(text)
              .then(() => alert('Copied to clipboard!'))
              .catch(err => console.error('Failed to copy:', err));
          }
          
          const VISITS_PER_PAGE = 100;
          let currentPage = 1;
          let allVisits = [];
          
          async function loadStats() {
            const response = await fetch(\`/api/stats/${key}\`);
            const stats = await response.json();
            allVisits = stats.visits.reverse();
            showPage(1);
          }
          
          function showPage(page) {
            currentPage = page;
            const startIndex = (page - 1) * VISITS_PER_PAGE;
            const endIndex = startIndex + VISITS_PER_PAGE;
            const visits = allVisits.slice(startIndex, endIndex);
            
            const visitsList = document.getElementById('visits-list');
            visitsList.innerHTML = '';
            
            visits.forEach((visit, index) => {
              const date = new Date(visit.timestamp).toLocaleString();
              const visitEl = document.createElement('div');
              visitEl.className = 'visit-item';
              visitEl.innerHTML = \`
                <div class="visit-source">
                  <input type="checkbox" class="checkbox" data-index="\${startIndex + index}">
                  <span class="material-icons">
                    \${visit.platform.name === 'Twitter' ? 'flutter_dash' : 
                      visit.platform.name === 'Facebook' ? 'facebook' : 'link'}
                  </span>
                  \${visit.platform.url ? \`<a href="\${visit.platform.url}" target="_blank">\${visit.platform.name}</a>\` : visit.platform.name}
                </div>
                <div>\${visit.country} · \${date}</div>
              \`;
              visitsList.appendChild(visitEl);
            });
            
            updatePagination();
          }
          
          function updatePagination() {
            const totalPages = Math.ceil(allVisits.length / VISITS_PER_PAGE);
            const pagination = document.getElementById('pagination');
            pagination.innerHTML = '';
            
            for (let i = 1; i <= totalPages; i++) {
              const btn = document.createElement('button');
              btn.className = \`page-btn \${i === currentPage ? 'active' : ''}\`;
              btn.textContent = i;
              btn.onclick = () => showPage(i);
              pagination.appendChild(btn);
            }
          }
          
          function toggleAllVisits(checkbox) {
            const checkboxes = document.querySelectorAll('.visit-item .checkbox');
            checkboxes.forEach(box => box.checked = checkbox.checked);
          }
          
          async function deleteSelectedVisits() {
            const selected = Array.from(document.querySelectorAll('.visit-item .checkbox:checked'))
              .map(checkbox => parseInt(checkbox.dataset.index));
            
            if (!selected.length || !confirm('Delete selected visits?')) return;
            
            try {
              // Remove selected visits
              allVisits = allVisits.filter((_, index) => !selected.includes(index));
              
              if (allVisits.length === 0) {
                // If no visits left, delete the entire stats entry
                await fetch(\`/api/stats/${key}\`, { method: 'DELETE' });
              } else {
                // Update remaining visits
                await fetch(\`/api/stats/${key}\`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ visits: allVisits })
                });
              }
              
              showPage(currentPage);
            } catch (err) {
              alert('Error deleting visits: ' + err.message);
            }
          }
          
          loadStats();
        </script>
      </body>
    </html>
  `;
}

// Modify main page table to show simplified view
function generateHTML() {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>URL Shortener</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
        <style>
          :root {
            --primary: #333;
            --primary-dark: #000;
            --success: #666;
            --background: #f0f0f0;
            --text-color: #1e1e1e;
          }
          
          body {
            font-family: 'Inter', sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
            background: var(--background);
            color: var(--text-color);
          }
          
          .container {
            background: #fff;
            padding: 32px;
            border-radius: 12px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          }
          
          h1 {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 24px;
          }
          
          .form-group {
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 12px;
            margin-bottom: 24px;
          }
          
          .input-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          
          input {
            padding: 10px 16px;
            border: 1px solid #ccc;
            border-radius: 8px;
            font-size: 14px;
            background: #fff;
            transition: border-color 0.2s;
          }
          
          input:focus {
            outline: none;
            border-color: var(--primary);
          }
          
          button {
            background: var(--primary);
            color: #fff;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: background 0.2s;
          }
          
          button:hover {
            background: var(--primary-dark);
          }
          
          .table-container {
            margin-top: 32px;
            overflow-x: auto;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
          }
          
          th {
            text-align: left;
            padding: 12px;
            font-weight: 500;
            border-bottom: 2px solid #ccc;
            color: #555;
          }
          
          td {
            padding: 16px 12px;
            border-bottom: 1px solid #ccc;
            vertical-align: middle;
          }
          
          .link-row {
            display: flex;
            align-items: center;
          }
          
          .thumbnail {
            width: 60px;
            height: 60px;
            object-fit: cover;
            border-radius: 8px;
            margin-right: 16px;
            background-color: #e0e0e0;
          }
          
          a {
            color: var(--primary);
            text-decoration: none;
          }
          
          a:hover {
            text-decoration: underline;
          }
          
          .copy-btn, .delete-btn {
            padding: 6px 12px;
            font-size: 13px;
            background: #e0e0e0;
            color: #333;
          }
          
          .copy-btn:hover, .delete-btn:hover {
            background: #d0d0d0;
          }
          
          .toast {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: var(--success);
            color: #fff;
            padding: 12px 24px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
          }
          
          @keyframes slideIn {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          
          .loading {
            opacity: 0.5;
            pointer-events: none;
          }
          
          .material-icons {
            font-size: 18px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>URL 短链接生成器</h1>
          
          <form id="shortener-form">
            <div class="form-group">
              <div class="input-group">
                <input type="url" id="url" placeholder="输入您要缩短的链接" required>
                <input type="text" id="custom-path" placeholder="自定义路径（可选）">
                <input type="url" id="image" placeholder="预览图片链接（可选）">
                <input type="text" id="title" placeholder="链接标题（可选）">
              </div>
              <button type="submit">
                <span class="material-icons">link</span>
                生成短链接
              </button>
            </div>
          </form>

          <div class="table-container">
            <table id="links-table">
              <thead>
                <tr>
                  <th>链接</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
          <div class="pagination" style="margin-top: 20px; display: flex; justify-content: center; gap: 8px;">
            <button id="prevPage" class="page-btn">
              <span class="material-icons">chevron_left</span>
            </button>
            <span id="pageInfo"></span>
            <button id="nextPage" class="page-btn">
              <span class="material-icons">chevron_right</span>
            </button>
          </div>
        </div>

        <script>
          async function loadLinks(page = 1) {
            const tbody = document.querySelector('#links-table tbody');
            tbody.classList.add('loading');
            
            try {
              const response = await fetch(\`/api/links?page=\${page}\`);
              const data = await response.json();
              tbody.innerHTML = '';
              
              data.links.forEach(link => {
                const row = document.createElement('tr');
                const shortUrl = \`https://l.danielmind.tech/\${link.key}\`;
                const image = link.image || 'https://via.placeholder.com/60';

                row.innerHTML = \`
                  <td>
                    <div class="link-row">
                      <img src="\${image}" alt="缩略图" class="thumbnail">
                      <a href="/view/\${link.key}" class="link-title">
                        \${link.title || link.url}
                      </a>
                    </div>
                  </td>
                  <td>
                    <div style="display:flex;gap:8px;">
                      <button class="copy-btn" onclick="copyToClipboard('\${shortUrl}')">
                        <span class="material-icons">content_copy</span>
                        复制
                      </button>
                      <button class="delete-btn" onclick="deleteLink('\${link.key}')">
                        <span class="material-icons">delete</span>
                        删除
                      </button>
                    </div>
                  </td>
                \`;
                tbody.appendChild(row);
              });
              
              currentPage = data.pagination.currentPage;
              totalPages = data.pagination.totalPages;
              updatePaginationControls();
            } catch (err) {
              console.error('加载链接时出错:', err);
            } finally {
              tbody.classList.remove('loading');
            }
          }

          async function deleteLink(key) {
            if (!confirm('确定要删除此链接吗？')) return;
            try {
              await fetch(\`/api/links/\${key}\`, { method: 'DELETE' });
              await loadLinks();
              showToast('链接已成功删除！');
            } catch (err) {
              alert('删除链接时出错: ' + err.message);
            }
          }

          function showToast(message) {
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.innerHTML = \`
              <span class="material-icons">check_circle</span>
              \${message}
            \`;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
          }

          function copyToClipboard(text) {
            navigator.clipboard.writeText(text)
              .then(() => showToast('已复制到剪贴板！'))
              .catch(err => console.error('复制失败:', err));
          }

          function updatePaginationControls() {
            const prevBtn = document.getElementById('prevPage');
            const nextBtn = document.getElementById('nextPage');
            const pageInfo = document.getElementById('pageInfo');
            
            prevBtn.disabled = currentPage === 1;
            nextBtn.disabled = currentPage === totalPages;
            pageInfo.textContent = \`Page \${currentPage} of \${totalPages}\`;
          }
          
          document.getElementById('prevPage').onclick = () => {
            if (currentPage > 1) loadLinks(currentPage - 1);
          };
          
          document.getElementById('nextPage').onclick = () => {
            if (currentPage < totalPages) loadLinks(currentPage + 1);
          };

          document.getElementById('shortener-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            form.classList.add('loading');
            
            const data = {
              url: document.getElementById('url').value,
              customPath: document.getElementById('custom-path').value,
              image: document.getElementById('image').value,
              title: document.getElementById('title').value
            };

            try {
              const response = await fetch('/api/shorten', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });

              const result = await response.json();
              showToast('短链接生成成功！');
              await loadLinks();
              form.reset();
            } catch (err) {
              alert('生成短链接时出错: ' + err.message);
            } finally {
              form.classList.remove('loading');
            }
          });

          loadLinks();
        </script>
      </body>
    </html>
  `;
}
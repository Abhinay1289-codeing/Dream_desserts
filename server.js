const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
require('dotenv').config();

let PORT = process.env.PORT || 3000;

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Function to inject environment variables into HTML
function injectEnvVars(html) {
  const envScript = `
    <script>
      window.ENV = {
        SUPABASE_URL: '${process.env.SUPABASE_URL || ''}',
        SUPABASE_KEY: '${process.env.SUPABASE_KEY || ''}',
        GOOGLE_MAPS_API_KEY: '${process.env.GOOGLE_MAPS_API_KEY || ''}'
      };
    </script>
  `;
  return html.replace('</head>', envScript + '</head>');
}

const server = http.createServer((req, res) => {
  console.log(`${req.method} ${req.url}`);

  // Add secure HTTP headers
  const secureHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  };

  // Strip query parameters and decode URI
  const parsedUrl = url.parse(req.url);
  let requestPath = decodeURIComponent(parsedUrl.pathname);
  if (requestPath === '/') {
    requestPath = '/index.html';
  }

  let safePath = path.normalize(requestPath).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(__dirname, safePath);
  const resolvedPath = path.resolve(filePath);
  if (!resolvedPath.startsWith(path.resolve(__dirname))) {
    res.writeHead(403, secureHeaders);
    return res.end('403 Forbidden');
  }

  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // Only SPA fallback to index.html if request is an HTML page or has no extension
        if (!extname || extname === '.html') {
          fs.readFile(path.join(__dirname, 'index.html'), (err, htmlContent) => {
            if (err) {
              res.writeHead(404, secureHeaders);
              res.end('Not found');
            } else {
              let html = htmlContent.toString('utf-8');
              html = injectEnvVars(html);
              res.writeHead(200, { 'Content-Type': 'text/html', ...secureHeaders });
              res.end(html, 'utf-8');
            }
          });
        } else {
          res.writeHead(404, secureHeaders);
          res.end('404 Not Found');
        }
      } else {
        res.writeHead(500, secureHeaders);
        res.end('Server error');
      }
    } else {
      if (extname === '.html') {
        let html = content.toString('utf-8');
        html = injectEnvVars(html);
        res.writeHead(200, { 'Content-Type': 'text/html', ...secureHeaders });
        res.end(html, 'utf-8');
      } else {
        const cacheHeader = (extname === '.js' || extname === '.css')
          ? { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
          : {};
        res.writeHead(200, { 'Content-Type': contentType, ...secureHeaders, ...cacheHeader });
        res.end(content, 'utf-8');
      }
    }
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} in use, trying http://localhost:${PORT + 1}...`);
    PORT = PORT + 1;
    server.listen(PORT);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}/`);
});

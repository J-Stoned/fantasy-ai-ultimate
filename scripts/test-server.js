const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Fantasy AI Ultimate - Test</title>
    </head>
    <body style="background: #1a1a2e; color: white; font-family: sans-serif; text-align: center; padding: 50px;">
      <h1>🔥 FANTASY AI ULTIMATE</h1>
      <p>Test server is working!</p>
      <p>Next step: Starting the real app...</p>
    </body>
    </html>
  `);
});

server.listen(3000, '0.0.0.0', () => {
  console.log('✅ Test server running at http://localhost:3000');
  console.log('   Also try: http://127.0.0.1:3000');
});
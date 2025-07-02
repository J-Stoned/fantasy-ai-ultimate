import next from 'next';
import { createServer } from 'http';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = process.env.PORT || 3000;

app.prepare().then(() => {
  const server = createServer((req, res) => {
    handle(req, res);
  });

  server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
    console.log(`> Dashboard available at http://localhost:${port}/dashboard/realtime`);
    console.log('> WebSocket server available at ws://localhost:3001');
  });
});
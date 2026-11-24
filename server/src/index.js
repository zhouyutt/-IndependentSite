import { createApp } from './app.js';
import { config } from './config.js';

const app = createApp();
const server = app.listen(config.port, () => {
  console.info(JSON.stringify({ level: 'info', msg: 'server_started', port: config.port }));
});

function shutdown(signal) {
  console.info(JSON.stringify({ level: 'info', msg: 'shutdown', signal }));
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

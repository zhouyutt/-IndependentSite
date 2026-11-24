import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const policyPaths = ['/privacy', '/terms'];

function redirectPolicyDirectories(server) {
  server.middlewares.use((req, res, next) => {
    const [path] = req.url.split('?');
    if (!policyPaths.includes(path)) return next();
    res.writeHead(308, { Location: req.url.replace(path, path + '/') });
    res.end();
  });
}

export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'policy-directory-redirects',
      configureServer: redirectPolicyDirectories,
      configurePreviewServer: redirectPolicyDirectories
    }
  ],
  build: {
    rollupOptions: {
      input: ['index.html', ...policyPaths.map((path) => `${path.slice(1)}/index.html`)]
    }
  },
  server: {
    port: 5173
  }
});

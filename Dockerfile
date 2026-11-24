FROM node:24-bookworm-slim AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY admin/package.json ./admin/
COPY client/package.json ./client/
COPY server/package.json ./server/

FROM manifests AS storefront-build
RUN npm ci --workspace client --no-audit --no-fund
COPY client/ ./client/
RUN VITE_CATALOG_ONLY=true npm run build --workspace client

FROM manifests AS api
ENV NODE_ENV=production
RUN npm ci --workspace server --omit=dev --no-audit --no-fund && npm cache clean --force
COPY server/src/ ./server/src/
COPY --chown=node:node server/data/products.json ./server/data/products.json
USER node
EXPOSE 3001
CMD ["node", "server/src/index.js"]

FROM caddy:2-alpine AS web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=storefront-build /app/client/dist/ /srv/storefront/

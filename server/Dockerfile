FROM node:22-alpine AS build
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=5000 \
    PYTHON_SERVICE_URL=http://ai-service:8000 \
    SPAWN_PYTHON=false \
    REPORTS_PATH=/data/reports \
    CLIENT_DIST_PATH=/app/no-client-bundle
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev && mkdir -p /data/reports
COPY --from=build /app/server/dist ./dist
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:5000/api/gateway/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]

# CABBA production image: build Vite + bundle Express, then keep only runtime deps.
FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_ENV=development

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/public ./public

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# dist also contains dist/football-worker.cjs and dist/migrate.cjs for the dedicated worker and release migration job.
CMD ["node", "dist/server.cjs"]

# Build from the repo root:  docker build -f apps/server/Dockerfile -t taskflow-sync .
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --workspace @taskflow/server --include-workspace-root=false --ignore-scripts
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/server apps/server
RUN npm run build -w @taskflow/server

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/server/dist ./dist
RUN npm install --omit=dev --no-save ws@8 && npm cache clean --force
USER node
EXPOSE 8787
ENV PORT=8787
HEALTHCHECK CMD wget -qO- http://localhost:${PORT}/health || exit 1
CMD ["node", "dist/index.js"]

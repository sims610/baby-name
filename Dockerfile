# The API server. Build from the repo root, because npm workspaces share the
# lockfile and node_modules there: docker build -t littleroots-server .
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
# npm needs every workspace's package.json, even though the client isn't built here.
COPY client/package.json client/
COPY shared shared
COPY server server
RUN npm ci -w server -w shared --include-workspace-root
RUN npm run build -w server
RUN npm prune --omit=dev && rm -rf client shared server/src

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app/server
COPY --from=build /app /app
EXPOSE 80
# CI writes .env.production. Real environment variables take priority over it.
CMD ["node", "--env-file-if-exists=.env.production", "dist/index.js", "80"]

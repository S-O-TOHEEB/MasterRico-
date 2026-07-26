# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist

# Run as a non-root user rather than the image default (root) — a security
# audit flagged this; node:22-alpine already ships a pre-created "node"
# user/group (uid/gid 1000) for exactly this purpose, so no separate
# useradd step is needed.
RUN chown -R node:node /app
USER node

EXPOSE 3000
# ${PORT:-3000} — Railway/Render inject their own dynamic PORT at runtime, which
# the app already reads correctly (see src/index.ts); the healthcheck needs to
# follow the same variable rather than hardcoding 3000, or it fails on any
# platform that assigns a different port.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1
CMD ["node", "dist/index.js"]

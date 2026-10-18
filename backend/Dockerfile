# Build context is the repository root (see docker-compose.yml).
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production

# Install dependencies first so this layer is cached until package files change.
# The Prisma schema is needed because installing backend runs `prisma generate`.
COPY package.json package-lock.json ./
COPY backend/package.json backend/prisma.config.ts ./backend/
COPY backend/prisma ./backend/prisma
COPY frontend/package.json ./frontend/
COPY e2e/package.json ./e2e/
RUN npm ci -w backend --include=dev

COPY backend/tsconfig.json ./backend/
COPY backend/src ./backend/src
RUN npm run build -w backend

USER node
EXPOSE 3000
CMD ["node", "backend/dist/server.js"]

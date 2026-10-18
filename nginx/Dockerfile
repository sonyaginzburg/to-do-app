# Build context is the repository root (see docker-compose.yml).
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/prisma.config.ts ./backend/
COPY backend/prisma ./backend/prisma
COPY frontend/package.json ./frontend/
COPY e2e/package.json ./e2e/
RUN npm ci -w frontend
COPY frontend ./frontend
RUN npm run build -w frontend

FROM nginx:1.29-alpine
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80

# ── Build stage ────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
COPY packages/web/package.json ./packages/web/
RUN npm install
COPY packages/web/ ./packages/web/
RUN npx vite build packages/web

# ── Production stage ──────────────────────────────
FROM nginx:alpine
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

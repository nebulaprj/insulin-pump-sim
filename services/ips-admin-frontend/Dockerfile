# Stage 1: сборка фронтенда
FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig*.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: production-образ с непривилегированным nginx
FROM nginxinc/nginx-unprivileged:1.30-alpine AS production

# Root нужен только для подготовки файлов образа
USER root
RUN rm -f /etc/nginx/conf.d/default.conf \
    /usr/share/nginx/html/index.html /usr/share/nginx/html/50x.html

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD ["wget", "-q", "--spider", "-T", "3", "http://127.0.0.1:8080/health"]

CMD ["nginx", "-g", "daemon off;"]

# syntax=docker/dockerfile:1

# ============================================
# Landing Page Dockerfile (Astro Static Site)
# ============================================

# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Build the static site
RUN npm run build

# ============================================
# Production stage - Nginx
# ============================================
FROM nginx:alpine AS runner

# Copy nginx template (will be processed at runtime)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Railway uses PORT env var - default to 80 for local
ENV PORT=80

# Expose dynamic port
EXPOSE ${PORT}

CMD ["/bin/sh", "-c", "envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]

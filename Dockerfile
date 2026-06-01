# Stage 1: Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install native addon build tools (required by better-sqlite3 / node-gyp)
RUN apk add --no-cache python3 make g++

# Install dependencies first (for better caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Runner stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install curl for optional healthcheck
RUN apk add --no-cache curl

# Copy standalone bundle (no node_modules needed)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

RUN mkdir -p /data

# Next.js telemetry disable
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3000
CMD ["node", "server.js"]

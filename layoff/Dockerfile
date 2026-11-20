FROM oven/bun:1 AS bun-bin

FROM node:20-bookworm-slim

WORKDIR /app

# Copy Bun runtime from official image (fast installs + full Node.js/Prisma compatibility)
COPY --from=bun-bin /usr/local/bin/bun /usr/local/bin/bun
COPY --from=bun-bin /usr/local/bin/bunx /usr/local/bin/bunx

# Install openssl (required by Prisma) and curl (for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy manifests and Prisma schema first (postinstall runs prisma generate)
COPY package.json bun.lock* ./
COPY prisma ./prisma

# Install dependencies with Bun and BuildKit cache
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --no-save

# Copy the rest of the application code
COPY . .

# Normalize entrypoint line endings and make executable
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

# Dummy DATABASE_URL for build phase
ENV DATABASE_URL="mysql://layoff:placeholder@localhost:3306/layoff_db"

# Generate Prisma client and build Next.js production bundle
RUN bunx prisma generate && bun run build

# Ensure uploads directory exists
RUN mkdir -p /app/uploads

EXPOSE 3005

ENV PORT=3005
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

ENTRYPOINT ["/app/docker-entrypoint.sh"]

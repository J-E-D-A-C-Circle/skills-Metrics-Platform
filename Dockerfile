FROM node:20-bookworm-slim

WORKDIR /app

# Install OpenSSL and ca-certificates (required by Prisma engine) and curl (for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package dependency manifests
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Dummy DATABASE_URL for build phase if Next.js traces modules
ENV DATABASE_URL="postgresql://skm:placeholder@localhost:5432/skill_matrix?schema=public"

# Build Next.js production bundle
RUN npm run build

# Expose Next.js default port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# On container startup: apply database migrations and start the server
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]

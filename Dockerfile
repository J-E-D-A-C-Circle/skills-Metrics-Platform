FROM node:20-bookworm-slim

WORKDIR /app

# Install curl (for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package dependency manifests
COPY package.json package-lock.json ./

# Install dependencies with connection resilience
RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-timeout 300000 \
    && npm ci --no-audit --no-fund --maxsockets 5

# Copy the rest of the application code
COPY . .

# Dummy DATABASE_URL for build phase if Next.js traces modules
ENV DATABASE_URL="mysql://skm:placeholder@localhost:3306/skill_matrix"

# Build Next.js production bundle
RUN npm run build

# Expose Next.js default port
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# On container startup: start the server
CMD ["npm", "run", "start"]

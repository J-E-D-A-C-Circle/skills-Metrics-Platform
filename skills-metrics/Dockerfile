FROM node:20-bookworm-slim

WORKDIR /app

# Install curl (for healthchecks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package dependency manifests
COPY package.json package-lock.json ./

# Install dependencies with connection resilience and BuildKit npm cache
RUN --mount=type=cache,target=/root/.npm \
    npm config set fetch-retries 10 \
    && npm config set fetch-retry-mintimeout 15000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-timeout 300000 \
    && npm ci --no-audit --no-fund --maxsockets 3

# Copy the rest of the application code
COPY . .

# Dummy DATABASE_URL for build phase if Next.js traces modules
ENV DATABASE_URL="mysql://skm:placeholder@localhost:3306/skill_matrix"

# Build Next.js production bundle
RUN npm run build

# Expose Next.js port
EXPOSE 3004

ENV PORT=3004
ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production

# On container startup: start the server
CMD ["npm", "run", "start"]

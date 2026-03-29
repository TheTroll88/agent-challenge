# syntax=docker/dockerfile:1

# ===================================================================
# SolScope — Solana Blockchain Intelligence Agent
# Multi-stage Docker build for Nosana decentralized GPU deployment
# ===================================================================

FROM node:23-slim AS base

# Install system dependencies for native modules (better-sqlite3)
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 \
  make \
  g++ \
  git \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Disable telemetry
ENV ELIZAOS_TELEMETRY_DISABLED=true
ENV DO_NOT_TRACK=1

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy manifests first for layer caching (only reinstall if deps change)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source files
COPY . .

# Create persistent data directory for SQLite
RUN mkdir -p /app/data

# Health check — verify the agent server is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://localhost:3000').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

EXPOSE 3000

ENV NODE_ENV=production
ENV SERVER_PORT=3000

CMD ["pnpm", "start"]

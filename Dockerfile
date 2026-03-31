# ──────────────────────────────────────────────────────────────
#  Smart Attendance System – Web App Docker Image
#  Multi-stage build for Next.js 16 in a pnpm monorepo
# ──────────────────────────────────────────────────────────────

# ── Stage 0 ── Base image ────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── Stage 1 ── Install dependencies ─────────────────────────
FROM base AS deps

# Copy workspace config files first (better layer caching)
COPY pnpm-workspace.yaml ./
COPY pnpm-lock.yaml ./
COPY .npmrc ./
COPY package.json ./

# Copy only the package.json from sub-packages the web app needs
COPY apps/web/package.json ./apps/web/package.json

# Install all dependencies (including devDependencies for the build)
RUN pnpm install --frozen-lockfile

# ── Stage 2 ── Build the Next.js app ────────────────────────
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules

# Copy source code needed for the build
# 1. Root workspace files
COPY package.json ./
COPY pnpm-workspace.yaml ./
COPY .npmrc ./

# 2. Shared packages (supabase types are imported via relative path)
COPY packages ./packages

# 3. Web application source
COPY apps/web ./apps/web

# Set build-time environment variables
# These are needed by Next.js at BUILD time for NEXT_PUBLIC_* variables
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application
WORKDIR /app/apps/web
RUN pnpm build

# ── Stage 3 ── Production runner ────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Don't run as root in production
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Disable telemetry at runtime
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Copy the standalone output
# Next.js standalone copies node_modules it needs into .next/standalone
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# Copy the static assets
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
# Copy the public folder
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

# The standalone server is at apps/web/server.js (monorepo structure)
CMD ["node", "apps/web/server.js"]

# ================================
# Base image
# ================================
FROM oven/bun:1.2.23 AS base
WORKDIR /app

ENV NODE_ENV=production
ENV CI=true
ENV HF_HOME=/app/.cache/huggingface
ENV TRANSFORMERS_CACHE=/app/.cache/huggingface

# ================================
# Dependencies stage
# ================================
FROM base AS deps

# ✅ Install git + git-lfs (BOTH REQUIRED)
RUN apt-get update && \
    apt-get install -y git git-lfs && \
    git lfs install

# Copy root workspace files
COPY package.json bun.lock ./

# Copy opensouls workspace manifests
COPY opensouls/package.json opensouls/
COPY opensouls/packages/core/package.json opensouls/packages/core/
COPY opensouls/packages/engine/package.json opensouls/packages/engine/
COPY opensouls/packages/soul/package.json opensouls/packages/soul/
COPY opensouls/packages/react/package.json opensouls/packages/react/
COPY opensouls/packages/pipeline/package.json opensouls/packages/pipeline/
COPY opensouls/packages/cli/package.json opensouls/packages/cli/
COPY opensouls/packages/soul-engine-cloud/package.json opensouls/packages/soul-engine-cloud/

# soul-engine-cloud frozen dependency
COPY opensouls/packages/soul-engine-cloud/frozen-npm/soul-engine/ \
     opensouls/packages/soul-engine-cloud/frozen-npm/soul-engine/

# App packages
COPY packages/tanaki-speaks/package.json packages/tanaki-speaks/
COPY packages/tanaki-speaks-web/package.json packages/tanaki-speaks-web/
COPY packages/tanaki-speaks-web/public ./packages/tanaki-speaks-web/public


# Install all deps
RUN bun install

# ================================
# Builder stage
# ================================
FROM deps AS builder

# Copy FULL repo (includes .gitattributes + LFS pointers)
COPY . .


RUN git lfs pull

# Generate prisma client
WORKDIR /app/opensouls/packages/soul-engine-cloud
RUN bunx --bun prisma generate

# Warm HuggingFace cache
RUN bun -e "import { pipeline } from '@huggingface/transformers'; await pipeline('feature-extraction', 'mixedbread-ai/mxbai-embed-xsmall-v1');"

# Build frontend (GLBs must already be real files here)
WORKDIR /app/packages/tanaki-speaks-web
RUN bun run build

# ================================
# Runtime stage
# ================================
FROM base AS runner
WORKDIR /app

# Copy built app + assets
COPY --from=builder /app /app

# Runtime data dirs
RUN mkdir -p /app/data /app/data/pglite

WORKDIR /app/packages/tanaki-speaks-web
EXPOSE 3002
EXPOSE 9091

CMD ["bash", "/app/packages/tanaki-speaks-web/start.sh"]

# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
# openssl + libc6-compat are required by Prisma's query engine on Alpine.
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# --- deps: install with the committed lockfile only ---
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# --- build: generate Prisma client and build Next.js ---
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# --- runner: full node_modules (with the generated Prisma Client) kept so
# `prisma migrate deploy` and the default seed (tsx) can run at container start ---
FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/package.json ./package.json
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3006

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]

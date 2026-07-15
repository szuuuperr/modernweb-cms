# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma.config.ts tsconfig.json tsconfig.build.json nest-cli.json ./
COPY prisma ./prisma
COPY src ./src

# prisma.config.ts resolves env('DATABASE_URL') as soon as it loads, even though
# `generate` never opens a connection. This placeholder only exists in the build
# stage — the real URL is injected at runtime by compose.
ENV DATABASE_URL="mysql://placeholder:placeholder@localhost:3306/placeholder"
RUN npx prisma generate && npm run build

# ---- Runtime stage ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

# Full node_modules kept so `prisma migrate deploy` works at container start.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package*.json prisma.config.ts ./
COPY prisma ./prisma

EXPOSE 3000
# dist/src/main, not dist/main: prisma.config.ts at the repo root is part of the
# TS build, so the inferred rootDir is the project root and output is nested.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]

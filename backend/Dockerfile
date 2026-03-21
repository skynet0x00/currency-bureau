FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
RUN npx tsc --outDir dist --rootDir . --module commonjs --target ES2020 --esModuleInterop true --skipLibCheck true prisma/seed.ts

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache openssl
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

# Run migrations + seed then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/prisma/seed.js || true && node dist/index.js"]

EXPOSE 3001

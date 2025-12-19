# Stage 1: Installazione dipendenze
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=optional

# Stage 2: Build dell’app Next.js
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: Esecuzione in produzione
FROM node:22-alpine AS runner
WORKDIR /app

# Ambiente produzione e URL backend relativo
ENV NODE_ENV=production
ENV NEXT_PUBLIC_API_URL=/api

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.mjs ./

# Installa solo le dipendenze di produzione
RUN npm ci --omit=dev --omit=optional

EXPOSE 3000
CMD ["npm","run","start"]

FROM node:22-alpine
WORKDIR /app

# Installazione dipendenze di produzione
COPY package*.json ./
RUN npm ci --only=production

# Copia codice
COPY . .

EXPOSE 3001
CMD ["node", "index.js"]

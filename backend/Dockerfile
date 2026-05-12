FROM node:18-alpine

WORKDIR /app

# Install deps first (layer cache)
COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 4000

# Start: migrate → seed → start
# Seed is idempotent (clears + reinserts) — safe to run on every container start
CMD ["sh", "-c", "npm run migrate && npm run seed && npm start"]

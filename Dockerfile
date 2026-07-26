FROM node:20-alpine

WORKDIR /app

# Copy root and backend package files
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# Install backend dependencies
RUN cd backend && npm install --production=false

# Copy backend application code
COPY backend ./backend
COPY frontend ./frontend

# Generate Prisma Client & Run DB migrations
WORKDIR /app/backend
RUN npx prisma generate

# Build frontend static files
WORKDIR /app/frontend
RUN npm install && npm run build

# Expose local network port 4000
EXPOSE 4000

ENV PORT=4000
ENV HOST=0.0.0.0
ENV NODE_ENV=production

WORKDIR /app/backend
CMD ["sh", "-c", "npx prisma db push && node prisma/seed.js && node server.js"]

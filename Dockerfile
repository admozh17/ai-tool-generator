# Single-stage image that runs the app in dev mode for a fast, simple demo.
FROM node:22-bookworm-slim

WORKDIR /app

# Prisma needs openssl at runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate

EXPOSE 3000

CMD ["sh", "./docker-entrypoint.sh"]

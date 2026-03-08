FROM node:22-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# データディレクトリ作成
RUN mkdir -p /media/input /media/output /media/data/concat /media/data/waveform-cache

# --- 開発用ステージ ---
FROM base AS dev

COPY package.json package-lock.json* ./
RUN npm install

EXPOSE 3501

CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3501"]

# --- 本番ビルド ---
FROM base AS builder

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# --- 本番実行 ---
FROM base AS production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]

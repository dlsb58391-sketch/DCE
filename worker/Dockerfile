# WhatsApp booking-bot worker (whatsapp-web.js + headless Chrome).
# Runs as its OWN Railway service, separate from the Next.js site. It logs in
# once via QR (shown in the dashboard), persists the session on a volume, and
# talks to the site over HTTP (POST /api/whatsapp/*). No web server / port.
FROM node:20-bookworm-slim

# Drive Google Chrome stable instead of Puppeteer's bundled download. Chrome's
# .deb pulls every runtime dependency itself, which is the most reliable way to
# run headless Chrome inside a restricted container (Railway).
ENV PUPPETEER_SKIP_DOWNLOAD=1 \
    CHROME_PATH=/usr/bin/google-chrome-stable \
    NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates wget gnupg fonts-liberation fonts-noto-color-emoji \
    && wget -q -O /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
    && apt-get install -y --no-install-recommends /tmp/chrome.deb \
    && rm -f /tmp/chrome.deb \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY whatsapp-web.mjs ./

CMD ["node", "whatsapp-web.mjs"]

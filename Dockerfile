FROM ghcr.io/puppeteer/puppeteer:23.5.1

RUN apt-get update && apt-get install -y \
    google-chrome-stable

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome


WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci
COPY . .
CMD ["node", "index.js"]
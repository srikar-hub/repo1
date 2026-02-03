FROM mcr.microsoft.com/playwright:v1.41.2-jammy

WORKDIR /app

# Copy package files first to leverage Docker caching
COPY package*.json ./

RUN npm install

COPY . .

# Run node directly. No need for xvfb-run in headless mode.
CMD ["node", "goldWatcher.js"]
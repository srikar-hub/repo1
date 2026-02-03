FROM mcr.microsoft.com/playwright:v1.41.2-jammy

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["xvfb-run", "-a", "node", "goldWatcher.js"]

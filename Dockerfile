FROM mcr.microsoft.com/playwright:v1.41.2-jammy

WORKDIR /app

COPY . .

RUN npm install

CMD ["bash", "-c", "xvfb-run -a node goldWatcher.js"]


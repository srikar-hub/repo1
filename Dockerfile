# UPDATE THIS VERSION to match the error message requirement
FROM mcr.microsoft.com/playwright:v1.58.1-jammy

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies (this installs Playwright 1.58.1)
RUN npm install

# Copy the rest of your files
COPY . .

# Run the correct file name found in your logs
CMD ["node", "goldWatcherFinal.js"]
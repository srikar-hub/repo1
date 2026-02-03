const { chromium } = require("playwright");
const axios = require("axios");
const fs = require("fs");
const cron = require("node-cron");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const FILE = "/tmp/lastPrices.json";

async function sendTelegram(message) {
  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: message,
    });
    console.log("Telegram sent!");
  } catch (err) {
    console.log(err.response?.data || err.message);
  }
}
async function scrapeGold() {
  // Use launchPersistentContext or just launch depending on if you truly need persistence
  // In Docker/Railway, persistence in /tmp is lost on restart anyway.
  const context = await chromium.launchPersistentContext(
    "/tmp/chrome-profile",
    {
      headless: true, // <--- MUST BE TRUE FOR RAILWAY
      // channel: "chrome", // <--- REMOVE THIS. Use the bundled Chromium.
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox", 
        "--disable-dev-shm-usage" // Helps with memory in Docker
      ], 
    }
  );

  const page = await context.newPage();

  // Add a user agent so the site doesn't block the headless browser
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  try {
      await page.goto("https://www.goodreturns.in/gold-rates/", {
        waitUntil: "domcontentloaded", // Faster than 'load'
        timeout: 60000,
      });

      // Reduced timeout, 8s is very long
      await page.waitForTimeout(5000);

      const data = await page.evaluate(() => {
        const get = (id) => {
          const priceEl = document.querySelector(`[id="${id}"]`);
          if (!priceEl) return null;

          const container = priceEl.closest(".gold-each-container");
          const change = container.querySelector(".gold-stock p")?.innerText.trim();
          const alt = container.querySelector(".gold-stock img")?.getAttribute("alt");
          const dir = alt === "price-up" ? "🔼" : "🔽";

          return {
            price: priceEl.innerText.trim(),
            change,
            dir,
          };
        };

        const date = document.querySelector("#metal-price-date")?.innerText.trim();

        return {
          date,
          gold24: get("24K-price"),
          gold22: get("22K-price"),
          gold18: get("18K-price"),
        };
      });

      await context.close();
      return data;
  } catch (error) {
      console.error("Scraping failed:", error);
      await context.close();
      throw error; // Rethrow so main() knows it failed
  }
}

function hasChanged(oldData, newData) {
  if (!oldData) return true;

  return (
    oldData.gold24.price !== newData.gold24.price ||
    oldData.gold22.price !== newData.gold22.price ||
    oldData.gold18.price !== newData.gold18.price
  );
}

async function main() {
  const newData = await scrapeGold();

  let oldData = null;
  if (fs.existsSync(FILE)) {
    oldData = JSON.parse(fs.readFileSync(FILE));
  }

  if (true) {
    const message = `
🟡 Gold Price Update — ${newData.date}

24K: ${newData.gold24.price} ${newData.gold24.dir} ${newData.gold24.change}
22K: ${newData.gold22.price} ${newData.gold22.dir} ${newData.gold22.change}
18K: ${newData.gold18.price} ${newData.gold18.dir} ${newData.gold18.change}
`;

    await sendTelegram(message);
    fs.writeFileSync(FILE, JSON.stringify(newData, null, 2));
    console.log("Price changed. Telegram sent.");
  } else {
    console.log("No price change.");
  }
}

console.log("Gold watcher started...");

// Run once when server starts
main();

// Run once daily at 10:00 AM IST (04:30 UTC)
cron.schedule("30 4 * * *", async () => {
  console.log("Daily gold price check...");
  await main();
});

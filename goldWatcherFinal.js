const { chromium } = require("playwright");
const axios = require("axios");
const fs = require("fs");


const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const FILE = "lastPrices.json";

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
  const context = await chromium.launchPersistentContext(
    "./chrome-profile",
    {
      headless: false,       // IMPORTANT (use xvfb on server)
      channel: "chrome",
      args: ["--no-sandbox"],
    }
  );

  const page = await context.newPage();

  await page.goto("https://www.goodreturns.in/gold-rates/", {
    waitUntil: "load",
    timeout: 60000,
  });

  await page.waitForTimeout(7000);

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

  if (hasChanged(oldData, newData)) {
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

main();

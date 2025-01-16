require('dotenv').config();
const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
const port = process.env.PORT || 3001;

// Chrome browser instance
let browserPromise = null;

app.use(cors());
app.use(express.json());

async function initBrowser() {
  if (!browserPromise) {
    console.log('Launching browser...');
    browserPromise = puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ]
    });
  }
  return browserPromise;
}

async function getPage() {
  const browser = await initBrowser();
  const page = await browser.newPage();
  
  // Set viewport and user agent
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Set extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'application/json, text/plain, */*',
    'Connection': 'keep-alive',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty'
  });

  // Enable request interception
  await page.setRequestInterception(true);
  
  // Only allow necessary resources
  page.on('request', (request) => {
    const resourceType = request.resourceType();
    if (['document', 'xhr', 'fetch', 'script'].includes(resourceType)) {
      request.continue();
    } else {
      request.abort();
    }
  });

  return page;
}

app.get('/api/chatgpt/:shareId', async (req, res) => {
  let page = null;
  
  try {
    const { shareId } = req.params;
    const apiUrl = `https://chatgpt.com/backend-api/share/${shareId}`;
    
    console.log(`\nProcessing request for shareId: ${shareId}`);
    console.log('API URL:', apiUrl);

    // Get a new page
    page = await getPage();

    // Set up response interception
    let responseData = null;
    const responsePromise = new Promise((resolve, reject) => {
      page.on('response', async (response) => {
        if (response.url() === apiUrl) {
          try {
            responseData = await response.json();
            resolve(responseData);
          } catch (e) {
            console.error('Failed to parse response:', e);
            reject(e);
          }
        }
      });

      // Set timeout
      setTimeout(() => {
        reject(new Error('Response timeout after 30s'));
      }, 30000);
    });

    // Navigate to the API URL
    await page.goto(apiUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    // Check for Cloudflare challenge
    const cloudflareContent = await page.content();
    if (cloudflareContent.includes('cf-browser-verification') || cloudflareContent.includes('cf_chl_opt')) {
      console.log('Detected Cloudflare challenge, waiting for resolution...');
      await page.waitForNavigation({
        waitUntil: 'networkidle0',
        timeout: 30000
      });
    }

    try {
      responseData = await responsePromise;
    } catch (e) {
      console.log('Failed to get response from interception, trying page content...');
      // Try to get the pre-formatted content from the page
      responseData = await page.evaluate(() => {
        const pre = document.querySelector('pre');
        if (pre) {
          try {
            return JSON.parse(pre.textContent);
          } catch (e) {
            return null;
          }
        }
        return null;
      });
    }

    if (!responseData) {
      return res.status(500).json({
        error: 'Failed to retrieve data',
        details: 'Could not extract data from the response'
      });
    }

    res.json({
      data: responseData,
      debug: {
        shareId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message || String(error),
      stack: error.stack
    });
  } finally {
    if (page) {
      await page.close();
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Cleanup function for browser
async function cleanup() {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}

// Cleanup on server shutdown
process.on('SIGINT', async () => {
  await cleanup();
  process.exit();
});

// Export the express app for Vercel
module.exports = app;

// Only listen if not running on Vercel
if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Proxy server running on port ${port}`);
  });
}

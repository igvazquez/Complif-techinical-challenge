const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const GRAFANA_URL = 'http://localhost:3001';
const GRAFANA_USER = 'admin';
const GRAFANA_PASS = 'admin';
const OUTPUT_DIR = path.join(__dirname, 'results', 'screenshots');

async function captureGrafana() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  try {
    console.log('Logging into Grafana...');

    // Login to Grafana
    await page.goto(`${GRAFANA_URL}/login`);
    await page.fill('input[name="user"]', GRAFANA_USER);
    await page.fill('input[name="password"]', GRAFANA_PASS);
    await page.click('button[type="submit"]');

    // Wait for login to complete
    await page.waitForURL('**/dashboards**', { timeout: 10000 }).catch(() => {
      console.log('Redirected to:', page.url());
    });

    console.log('Logged in, navigating to dashboard...');

    // Navigate to the Rules Engine Overview dashboard
    await page.goto(`${GRAFANA_URL}/d/rules-engine-overview/rules-engine-overview?orgId=1&refresh=5s`);

    // Wait for panels to load
    await page.waitForTimeout(5000);

    // Take full dashboard screenshot
    console.log('Capturing full dashboard...');
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'grafana-dashboard-full.png'),
      fullPage: true,
    });

    // Take viewport screenshot (what fits on screen)
    console.log('Capturing dashboard viewport...');
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'grafana-dashboard-viewport.png'),
    });

    // Scroll to different sections and capture
    const sections = [
      { name: 'kpis', y: 0 },
      { name: 'transactions', y: 400 },
      { name: 'rules', y: 800 },
      { name: 'cache', y: 1200 },
      { name: 'alerts', y: 1600 },
    ];

    for (const section of sections) {
      console.log(`Capturing ${section.name} section...`);
      await page.evaluate((y) => window.scrollTo(0, y), section.y);
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(OUTPUT_DIR, `grafana-${section.name}.png`),
      });
    }

    // Navigate to Prometheus targets page
    console.log('Capturing Prometheus targets...');
    await page.goto('http://localhost:9090/targets');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'prometheus-targets.png'),
    });

    console.log(`\nScreenshots saved to: ${OUTPUT_DIR}`);
    console.log('Files:');
    fs.readdirSync(OUTPUT_DIR).forEach(file => {
      console.log(`  - ${file}`);
    });

  } catch (error) {
    console.error('Error capturing screenshots:', error.message);
    // Take a screenshot of whatever state we're in for debugging
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'error-state.png'),
    });
  } finally {
    await browser.close();
  }
}

captureGrafana();

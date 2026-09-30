const puppeteer = require('puppeteer');

(async () => {
  console.log("Starting smoke test...");
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    console.log("Navigating to admin.html...");
    await page.goto('http://127.0.0.1:5500/admin.html', { waitUntil: 'networkidle0' });
    
    console.log("Typing PIN ADMIN1...");
    await page.type('#admin-pin-input', 'ADMIN1');
    
    console.log("Clicking login...");
    await page.click('#admin-login-btn');
    
    await page.waitForSelector('#admin-sidebar', { visible: true });
    console.log("Admin Dashboard loaded successfully.");
    
    console.log("Navigating to index.html...");
    await page.goto('http://127.0.0.1:5500/index.html', { waitUntil: 'networkidle0' });
    
    console.log("Typing Student PIN 1111...");
    await page.type('#student-pin', '1111');
    
    console.log("Clicking login...");
    await page.click('#student-login-btn');
    
    await page.waitForSelector('#student-dashboard', { visible: true });
    console.log("Student Dashboard loaded successfully.");
    
    await browser.close();
    console.log("SMOKE TEST PASSED!");
  } catch (err) {
    console.error("SMOKE TEST FAILED: ", err);
    process.exit(1);
  }
})();

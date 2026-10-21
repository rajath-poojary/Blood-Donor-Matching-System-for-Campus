const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests/e2e',
    fullyParallel: false,
    workers: 1,
    timeout: 30_000,
    expect: { timeout: 5_000 },
    reporter: 'list',
    use: {
        baseURL: process.env.BLOODMATCH_E2E_URL || 'http://127.0.0.1:5511',
        browserName: 'chromium',
        headless: true
    }
});

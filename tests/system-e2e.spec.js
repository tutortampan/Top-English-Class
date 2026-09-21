import { test, expect } from '@playwright/test';

test.describe('Top English Program - E2E System Tests', () => {
test.beforeEach(async ({ page }) => {
await page.goto('/');
});

test('Student Login Cascading Containers Verification', async ({ page }) => {
await expect(page.locator('#sec-program')).toBeVisible();
await expect(page.locator('#step-num-1')).toHaveText('1');
await expect(page.locator('#remember-me-banner')).toBeVisible();
});

test('Assessment Runner Anti-Cheat and Timer Integrity', async ({ page }) => {
await page.goto('/assessment.html?Assessment_id=demo-test');
await expect(page.locator('#Assessment-timer')).toBeVisible();
await expect(page.locator('#Assessment-sync-status')).toBeVisible();
});

test('Admin Console ABCD Navigation Verification', async ({ page }) => {
await page.goto('/admin.html');
await expect(page.locator('[data-domain="admin"]')).toBeVisible();
await expect(page.locator('[data-domain="board"]')).toBeVisible();
await expect(page.locator('[data-domain="class"]')).toBeVisible();
await expect(page.locator('[data-domain="desk"]')).toBeVisible();
});
});

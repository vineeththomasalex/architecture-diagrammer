import { test, expect } from '@playwright/test';

test.describe('Architecture Diagrammer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the diagram SVG to be rendered with nodes
    await page.waitForSelector('.diagram-svg .diagram-node', { timeout: 10000 });
  });

  test('page loads with correct heading', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toContainText('System Design Diagrammer');
  });

  test('SVG canvas is present with nodes rendered', async ({ page }) => {
    const svg = page.locator('.diagram-svg');
    await expect(svg).toBeVisible();

    const nodes = page.locator('.diagram-svg .diagram-node');
    const count = await nodes.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('YAML editor textarea is present with default content', async ({ page }) => {
    const textarea = page.locator('textarea.yaml-textarea');
    await expect(textarea).toBeVisible();

    const value = await textarea.inputValue();
    expect(value).toContain('nodes:');
    expect(value).toContain('Client Apps');
    expect(value).toContain('API Gateway');
  });

  test('default nodes are rendered in the SVG', async ({ page }) => {
    const svgText = await page.locator('.diagram-svg').innerHTML();

    // The default YAML is a Netflix system design
    expect(svgText).toContain('Client Apps');
    expect(svgText).toContain('API Gateway');
    expect(svgText).toContain('Load Balancer');
    expect(svgText).toContain('Video Storage');
  });

  test('connections are rendered as paths', async ({ page }) => {
    const connections = page.locator('.diagram-svg .diagram-connection path');
    const count = await connections.count();
    // Default YAML has 3 connections
    expect(count).toBeGreaterThanOrEqual(3);
  });

  test('theme switching changes diagram appearance', async ({ page }) => {
    const canvasPanel = page.locator('.canvas-panel');
    const bgBefore = await canvasPanel.evaluate(el => el.style.background);

    // Switch to light theme
    await page.locator('.toolbar-select').selectOption('light');
    await page.waitForTimeout(300);

    const bgAfter = await canvasPanel.evaluate(el => el.style.background);
    expect(bgAfter).not.toEqual(bgBefore);
  });

  test('auto layout repositions nodes', async ({ page }) => {
    // Get initial positions of nodes
    const nodesBefore = await page.locator('.diagram-svg .diagram-node').evaluateAll(
      nodes => nodes.map(n => n.getAttribute('transform'))
    );

    // Click grid layout button
    await page.locator('.toolbar-btn', { hasText: 'Grid' }).click();
    await page.waitForTimeout(300);

    const nodesAfter = await page.locator('.diagram-svg .diagram-node').evaluateAll(
      nodes => nodes.map(n => n.getAttribute('transform'))
    );

    // At least one node should have moved
    const moved = nodesBefore.some((pos, i) => pos !== nodesAfter[i]);
    expect(moved).toBe(true);
  });

  test('export SVG button exists', async ({ page }) => {
    const exportBtn = page.locator('.toolbar-btn', { hasText: 'SVG' });
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toHaveAttribute('title', 'Download as SVG');
  });
});

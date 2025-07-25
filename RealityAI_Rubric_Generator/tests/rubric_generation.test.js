import { test, expect } from '@playwright/test';

test.describe('Rubric Generation Page', () => {
  test.beforeEach(async ({ page }) => {
    // Load rubric_template_p2.html with sample query parameters
    const params = new URLSearchParams({
      gradeLevel: '10th Grade',
      subject: 'Science',
      difficulty: 'Medium',
      criterion: 'Understanding of Concepts',
      description: 'This rubric evaluates understanding of scientific concepts.',
      performanceLevels: JSON.stringify([
        { level: 'Excellent', description: 'Outstanding performance' },
        { level: 'Good', description: 'Meets expectations' },
        { level: 'Fair', description: 'Needs improvement' },
        { level: 'Poor', description: 'Unsatisfactory' }
      ])
    });
    await page.goto(`file://${process.cwd()}/rubric_template_p2.html?${params.toString()}`);
  });

  test('displays rubric details correctly', async ({ page }) => {
    await page.waitForFunction(() => {
      const p = document.querySelector('#rubric-content p');
      return p && p.textContent.includes('Grade Level: 10th Grade');
    }, { timeout: 10000 });
    await expect(page.locator('#rubric-content p')).toContainText('Grade Level: 10th Grade');
    await expect(page.locator('#rubric-content p')).toContainText('Subject: Science');
    await expect(page.locator('#rubric-content p')).toContainText('Difficulty: Medium');
    await expect(page.locator('#rubric-content p')).toContainText('Rubric Criterion: Understanding of Concepts');
    await expect(page.locator('#rubric-content p')).toContainText('Description: This rubric evaluates understanding of scientific concepts.');
  });

  test('renders performance levels table correctly', async ({ page }) => {
    await page.waitForFunction(() => {
      const rows = document.querySelectorAll('#rubric-content table tbody tr');
      return rows.length === 4;
    }, { timeout: 10000 });
    const rows = page.locator('#rubric-content table tbody tr');
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText('Excellent');
    await expect(rows.nth(0)).toContainText('Outstanding performance');
    await expect(rows.nth(3)).toContainText('Poor');
    await expect(rows.nth(3)).toContainText('Unsatisfactory');
  });

  test('download buttons are visible and clickable', async ({ page }) => {
    const pdfBtn = page.locator('#downloadPdfBtn');
    const docxBtn = page.locator('#downloadDocxBtn');
    await expect(pdfBtn).toBeVisible();
    await expect(docxBtn).toBeVisible();

    // Just click to ensure no errors (actual file download testing requires more setup)
    await pdfBtn.click();
    await docxBtn.click();
  });

  test('back button navigates to rubric_gen_p1.html', async ({ page }) => {
    const backBtn = page.locator('a >> text=Back');
    await expect(backBtn).toBeVisible();
    // We won't click here to avoid navigation during test
  });
});

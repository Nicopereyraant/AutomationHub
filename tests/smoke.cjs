// Exercise the actual standalone HTML in Chromium, without a build step.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");

(async () => {
  const html = fs.readFileSync(path.join(__dirname, "../n8n-cheatsheet.html"));
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/n8n-cheatsheet.html`;
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROMIUM_PATH
        ? { executablePath: process.env.CHROMIUM_PATH }
        : {}),
    });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    // Keep the suite independent of the external font service.
    await page.route("https://fonts.googleapis.com/**", (route) =>
      route.abort(),
    );
    await page.goto(url);
    assert.equal(await page.locator(".card").count(), 51);
    await page.locator("#searchInput").fill("paginacion");
    assert.ok(
      (await page.locator(".card").count()) > 0,
      "accent-insensitive operation search",
    );
    await page.locator("#searchInput").fill("un-nodo-inexistente");
    assert.equal(await page.locator(".card").count(), 0);
    assert.equal(await page.locator("#emptyState").isVisible(), true);
    await page.locator("#clearFilters").click();
    await page.locator('[data-category="ai"]').click();
    assert.equal(await page.locator(".card").count(), 7);
    await page.locator('[data-category="all"]').click();

    // Dialog keyboard behavior and state changes must preserve a useful focus target.
    await page.locator('[data-open="0"]').focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#nodeDialog").isVisible(), true);
    await page.locator("#modalFavorite").click();
    await page.locator("#modalMastered").click();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#nodeDialog").isVisible(), false);
    assert.equal(
      await page.evaluate(() => document.activeElement.dataset.open),
      "0",
    );
    await page.locator("#studyFilter").selectOption("favorites");
    assert.equal(await page.locator(".card").count(), 1);
    await page.reload();
    assert.equal(
      await page.locator('[data-favorite="0"]').getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(await page.locator("#masteredCount").textContent(), "1");
    await page.locator("#studyFilter").selectOption("pending");
    assert.equal(await page.locator(".card").count(), 50);

    await page
      .getByRole("button", { name: "02 Laboratorio", exact: true })
      .click();
    await page.locator("#runLab").click();
    let result = JSON.parse(await page.locator("#labOutput").textContent());
    assert.deepEqual(
      result.true.map((x) => x.json.name),
      ["Ana", "Carla"],
    );
    assert.equal(result.true[0].json.email, "ana@ejemplo.com");
    assert.deepEqual(
      result.false.map((x) => x.json.name),
      ["Bruno"],
    );
    await page.locator("#threshold").fill("90");
    assert.match(
      await page.locator("#labOutput").textContent(),
      /Ejecutá el ejemplo/,
    );
    await page.locator("#runLab").click();
    result = JSON.parse(await page.locator("#labOutput").textContent());
    assert.equal(result.true.length, 0);
    assert.equal(result.false.length, 3);
    await page.locator("#threshold").fill("70");
    await page.locator('[data-sample="missing"]').click();
    await page.locator('[data-step="2"]').click();
    result = JSON.parse(await page.locator("#labOutput").textContent());
    assert.equal(result.true[0].json.email, "");
    assert.equal(result.false[0].json.score, 0);
    await page.locator('[data-sample="empty"]').click();
    await page.locator("#runLab").click();
    assert.deepEqual(
      JSON.parse(await page.locator("#labOutput").textContent()),
      { true: [], false: [] },
    );
    for (const invalid of [
      "not json",
      "{}",
      '[{"json":{"score":"85"}}]',
      '[{"json":{"email":4}}]',
      "[null]",
    ]) {
      await page.locator("#labInput").fill(invalid);
      await page.locator("#runLab").click();
      assert.equal(await page.locator("#labError").isVisible(), true);
      assert.equal(await page.locator("#copyExpression").isDisabled(), true);
    }
    await page.locator("#resetLab").click();
    await page.locator("#threshold").fill("101");
    await page.locator("#runLab").click();
    assert.match(
      await page.locator("#labError").textContent(),
      /entre 0 y 100/,
    );
    await page.locator("#resetLab").click();
    await page
      .locator("#labInput")
      .fill('[{"json":{"name":"<img src=x onerror=alert(1)>","score":85}}]');
    await page.locator("#runLab").click();
    assert.equal(
      await page.locator("#labOutput img").count(),
      0,
      "user input is rendered as text",
    );

    await page.getByRole("button", { name: /03 Desafíos/ }).click();
    await page.locator('[data-answer="0"]').click();
    assert.equal(await page.locator("#quizCount").textContent(), "0/10");
    assert.match(
      await page.locator("#quizFeedback").textContent(),
      /Todavía no/,
    );
    await page.locator("#quizContinue").click();
    const solutions = [1, 0, 2, 1, 2, 0, 1, 2, 0, 1];
    for (let i = 0; i < solutions.length; i++) {
      await page.locator(`[data-question="${i}"]`).click();
      await page.locator(`[data-answer="${solutions[i]}"]`).click();
      assert.equal(
        await page.locator("#quizCount").textContent(),
        `${i + 1}/10`,
      );
    }
    await page.locator('[data-question="0"]').click();
    await page.locator('[data-answer="1"]').click();
    assert.equal(
      await page.locator("#quizCount").textContent(),
      "10/10",
      "repeated answers do not add progress",
    );

    await page.getByRole("button", { name: "04 Mi ruta", exact: true }).click();
    assert.equal(await page.locator("[data-task]").count(), 18);
    await page.locator('[data-task="0-0"]').check();
    assert.equal(await page.locator("#roadCount").textContent(), "6%");
    await page.reload();
    assert.equal(await page.locator("#view-roadmap").isVisible(), true);
    assert.equal(await page.locator('[data-task="0-0"]').isChecked(), true);
    assert.equal(await page.locator("#quizCount").textContent(), "10/10");

    // All four views must fit narrow and wide screens without page overflow.
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const view of ["library", "lab", "quiz", "roadmap"]) {
        await page.locator(`.view-tab[data-view="${view}"]`).click();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `${view} fits ${width}px`,
        );
      }
    }
    // Reset can be cancelled, then confirmed, and survives a reload.
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.locator("#resetProgress").click();
    assert.equal(await page.locator("#quizCount").textContent(), "10/10");
    page.once("dialog", (dialog) => dialog.accept());
    await page.locator("#resetProgress").click();
    await page.reload();
    assert.equal(await page.locator("#quizCount").textContent(), "0/10");
    assert.equal(await page.locator("#masteredCount").textContent(), "0");
    assert.equal(await page.locator('[data-task="0-0"]').isChecked(), false);

    // Blocked or malformed storage must never prevent the application from loading.
    const blocked = await browser.newContext();
    await blocked.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("Blocked", "SecurityError");
        },
      });
    });
    const fallback = await blocked.newPage();
    await fallback.goto(url);
    assert.equal(await fallback.locator(".card").count(), 51);
    assert.equal(await fallback.locator("#storageNote").isVisible(), true);
    await fallback.locator('[data-mastered="0"]').click();
    assert.equal(await fallback.locator("#masteredCount").textContent(), "1");
    await blocked.close();
    await page.evaluate(() =>
      localStorage.setItem("automationhub.n8n.learning.v1", "{broken"),
    );
    await page.reload();
    assert.equal(await page.locator("#nodeCount").textContent(), "51");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: catalogue, keyboard dialog, saved progress, lab branches and validation, all quizzes, roadmap, reset, storage fallback, and responsive layouts.",
    );
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// Exercise the actual standalone HTML in Chromium, without a build step.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const vm = require("node:vm");
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
    assert.equal(await page.locator(".card").count(), 53);
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
    await page.waitForFunction(
      () => document.activeElement.dataset.open === "0",
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
    assert.equal(await page.locator(".card").count(), 52);

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

    await page.getByRole("button", { name: /05 Ejemplos/ }).click();
    assert.equal(await page.locator("[data-example]").count(), 9);
    assert.equal(await page.locator("#examplePrev").isDisabled(), true);
    assert.equal(await page.locator("[data-example-step]").count(), 4);
    await page.locator("#exampleNext").click();
    const preparedOrders = JSON.parse(
      await page.locator("#exampleOutput").textContent(),
    );
    assert.equal(preparedOrders.length, 1);
    assert.equal(preparedOrders[0].json.pedidos.length, 3);
    assert.deepEqual(
      JSON.parse(await page.locator("#exampleSnippetText").textContent()),
      preparedOrders[0].json,
    );
    await page.locator("#exampleNext").click();
    const splitOrders = JSON.parse(
      await page.locator("#exampleOutput").textContent(),
    );
    assert.equal(splitOrders.length, 3);
    await page.locator("#exampleNext").click();
    const branches = JSON.parse(
      await page.locator("#exampleOutput").textContent(),
    );
    assert.deepEqual(
      branches.true,
      splitOrders.filter((item) => item.json.pedido.importe >= 10000),
    );
    assert.deepEqual(
      branches.false,
      splitOrders.filter((item) => item.json.pedido.importe < 10000),
    );
    assert.equal(await page.locator("#exampleNext").isDisabled(), true);
    await page.locator("#exampleExercise summary").click();
    assert.match(
      await page.locator("#exampleAnswer").textContent(),
      /incluye la igualdad/,
    );
    await page.locator("#exampleNode").click();
    assert.equal(await page.locator("#modalName").textContent(), "IF");
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => document.activeElement.id === "exampleNode",
    );

    // Search and area filters compose, including an empty state with no stale detail.
    await page.locator('[data-example-area="administracion"]').click();
    assert.equal(await page.locator("[data-example]").count(), 2);
    await page.locator("#exampleSearch").fill("inexistente");
    assert.equal(await page.locator("#exampleEmpty").isVisible(), true);
    assert.equal(await page.locator("#exampleDetail").isVisible(), false);
    await page.locator("#clearExampleFilters").click();
    await page.locator("#exampleSearch").fill("facturacion");
    assert.equal(
      await page.locator("[data-example]").count(),
      1,
      "accent-insensitive business search",
    );
    await page.locator("#exampleSearch").fill("");

    await page.locator('[data-example="stock"]').click();
    await page.locator('[data-example-step="2"]').click();
    const inventory = JSON.parse(
      await page.locator("#exampleInput").textContent(),
    );
    const stockBranches = JSON.parse(
      await page.locator("#exampleOutput").textContent(),
    );
    assert.deepEqual(
      stockBranches.true,
      inventory.filter((item) => item.json.stock < item.json.minimo),
    );
    assert.deepEqual(
      stockBranches.false,
      inventory.filter((item) => item.json.stock >= item.json.minimo),
    );
    assert.match(
      await page.locator("#exampleBranch").textContent(),
      /Solo true/,
    );

    await page.locator('[data-example="ventas"]').click();
    await page.locator('[data-example-step="3"]').click();
    const paidSales = JSON.parse(
      await page.locator("#exampleInput").textContent(),
    );
    const totalSales = JSON.parse(
      await page.locator("#exampleOutput").textContent(),
    );
    assert.ok(paidSales.every((item) => item.json.estado === "pagada"));
    assert.equal(
      totalSales[0].json.sum_importe,
      paidSales.reduce((sum, item) => sum + item.json.importe, 0),
    );

    await page.locator('[data-example="facturas"]').click();
    await page.locator('[data-example-step="2"]').click();
    const invoiceInput = JSON.parse(
      await page.locator("#exampleInput").textContent(),
    );
    const reminders = JSON.parse(
      await page.locator("#exampleOutput").textContent(),
    );
    assert.deepEqual(
      reminders,
      invoiceInput.filter(
        (item) =>
          item.json.estado === "pendiente" &&
          item.json.vencimiento < "2026-01-15" &&
          !item.json.recordatorio_enviado,
      ),
    );

    await page.locator('[data-example="soporte"]').click();
    await page.locator('[data-example-step="1"]').click();
    const supportRoutes = JSON.parse(
      await page.locator("#exampleOutput").textContent(),
    );
    assert.equal(supportRoutes.soporte.length, 1);
    assert.equal(supportRoutes.facturacion.length, 0);
    assert.equal(supportRoutes.otros.length, 0);
    assert.match(
      await page.locator("#exampleSetup").textContent(),
      /Extra Output/,
    );

    // Every node in every guide links to a real catalogue entry; downloads contain the whole recipe.
    for (const id of [
      "pedidos",
      "leads",
      "stock",
      "ventas",
      "facturas",
      "soporte",
      "errores",
      "reporte-mensual",
      "lotes-subworkflows",
    ]) {
      await page.locator(`[data-example="${id}"]`).click();
      const stepCount = await page.locator("[data-example-step]").count();
      for (let i = 0; i < stepCount; i++) {
        await page.locator(`[data-example-step="${i}"]`).click();
        assert.equal(
          await page
            .locator('[data-example-step][aria-current="step"]')
            .count(),
          1,
        );
        const node = await page
          .locator('[data-example-step="' + i + '"]')
          .getAttribute("data-node");
        assert.equal(
          await page.locator('[data-example-step="' + i + '"] svg').count(),
          1,
          "actual embedded node icon",
        );
        await page.locator("#exampleNode").click();
        assert.equal(await page.locator("#modalName").textContent(), node);
        await page.keyboard.press("Escape");
        assert.ok(
          (await page.locator("#exampleDocs").getAttribute("href")).startsWith(
            "https://docs.n8n.io/integrations/builtin/",
          ),
        );
        JSON.parse(await page.locator("#exampleInput").textContent());
        JSON.parse(await page.locator("#exampleOutput").textContent());
      }
      const downloading = page.waitForEvent("download");
      await page.locator("#downloadExample").click();
      const download = await downloading;
      assert.equal(download.suggestedFilename(), `n8n-ejemplo-${id}.md`);
      const guide = fs.readFileSync(await download.path(), "utf8");
      assert.match(guide, /No es un workflow JSON importable/);
      assert.equal((guide.match(/^### \d+\./gm) || []).length, stepCount);
      assert.ok(
        guide.includes(await page.locator("#exampleName").textContent()),
      );
    }

    await page.locator('[data-example="leads"]').click();
    await page.locator("#exampleToLab").click();
    assert.equal(await page.locator("#view-lab").isVisible(), true);
    const loadedLead = JSON.parse(await page.locator("#labInput").inputValue());
    assert.equal(loadedLead[0].json.email, "ana@cliente.example");
    await page.locator("#runLab").click();
    assert.equal(
      JSON.parse(await page.locator("#labOutput").textContent()).true.length,
      1,
    );
    assert.equal(
      await page.locator("#quizCount").textContent(),
      "10/10",
      "examples preserve learning progress",
    );

    // Node detail can lead to matching business recipes, with focus transferred after closing.
    await page
      .getByRole("button", { name: "01 Biblioteca 53", exact: true })
      .click();
    await page.locator("#studyFilter").selectOption("all");
    await page.locator('[data-open="0"]').click();
    await page.locator("#modalExamples").click();
    await page.waitForFunction(
      () => document.getElementById("view-examples").hidden === false,
    );
    assert.equal(await page.locator("#nodeDialog").isVisible(), false);
    assert.equal(await page.locator("#exampleSearch").inputValue(), "Webhook");
    assert.equal(await page.locator("[data-example]").count(), 1);
    await page.locator("#exampleSearch").fill("");
    await page.reload();
    assert.equal(await page.locator("#view-examples").isVisible(), true);
    assert.equal(await page.locator("[data-example]").count(), 9);

    // The monthly resolver changes real paths in the illustration while preserving a canonical contract.
    await page.locator('[data-example="reporte-mensual"]').click();
    assert.equal(await page.locator("#monthlyControls").isVisible(), true);
    assert.equal(
      await page.locator('[data-step-key$="-create"]').count(),
      2,
      "only month and report are created in the default case",
    );
    await page.locator('[data-step-key="year-search"]').click();
    assert.match(
      await page.locator("#exampleSetup").textContent(),
      /Always Output Data/,
    );
    assert.match(
      await page.locator("#exampleSetup").textContent(),
      /demo-proceso/,
    );
    await page.locator('[data-step-key="month-search"]').click();
    assert.match(
      await page.locator("#exampleSetup").textContent(),
      /demo-year-existing/,
    );
    await page.locator('[data-step-key="report-create"]').click();
    assert.match(
      await page.locator("#exampleSetup").textContent(),
      /Same Folder/,
    );
    await page.locator('[data-step-key="report-set"]').click();
    let reportContext = JSON.parse(
      await page.locator("#exampleOutput").textContent(),
    )[0].json;
    assert.equal(reportContext.yearFolderId, "demo-year-existing");
    assert.equal(reportContext.monthFolderId, "demo-month-created");
    assert.equal(reportContext.reportId, "demo-report-created");
    assert.equal(reportContext.runId, "ventas-2026-10");

    await page.locator('[data-monthly-preset="existing"]').click();
    assert.equal(
      await page.locator('[data-step-key$="-create"]').count(),
      0,
      "existing report never copies the template",
    );
    await page.locator('[data-step-key="report-set"]').click();
    reportContext = JSON.parse(
      await page.locator("#exampleOutput").textContent(),
    )[0].json;
    assert.equal(reportContext.reportId, "demo-report-existing");
    assert.equal(reportContext.monthFolderId, "demo-month-existing");
    await page.locator('[data-monthly-preset="new"]').click();
    assert.equal(await page.locator('[data-step-key$="-create"]').count(), 3);
    assert.equal(await page.locator("#monthlyMonth").isDisabled(), true);
    assert.equal(await page.locator("#monthlyReport").isDisabled(), true);
    await page.locator('[data-step-key="year-search"]').click();
    assert.deepEqual(
      JSON.parse(await page.locator("#exampleOutput").textContent()),
      [{ json: {} }],
    );
    await page.locator('[data-step-key="year-normalize"]').click();
    const normalizer = await page.locator("#exampleSnippetText").textContent();
    const normalizeFiles = (files) =>
      vm.runInNewContext("(function(){" + normalizer + "})()", {
        $input: { all: () => files },
        $: () => ({ first: () => ({ json: { runId: "fixture-run" } }) }),
      });
    assert.equal(normalizeFiles([{ json: {} }])[0].json.candidateId, null);
    assert.equal(
      normalizeFiles([{ json: { id: "one" } }])[0].json.candidateId,
      "one",
    );
    assert.equal(
      normalizeFiles([{ json: { id: "one" } }])[0].json.runId,
      "fixture-run",
    );
    assert.throws(
      () => normalizeFiles([{ json: { id: "one" } }, { json: { id: "two" } }]),
      /Nombre duplicado/,
    );
    await page.locator('[data-step-key="year-if"]').click();
    assert.equal(
      JSON.parse(await page.locator("#exampleOutput").textContent()).true
        .length,
      0,
    );

    await page.locator('[data-monthly-preset="existing"]').click();
    await page.locator('[data-step-key="query"]').click();
    assert.equal(
      await page.locator('[data-step-key="query"]').getAttribute("data-node"),
      "Google BigQuery",
    );
    await page.locator("#monthlySource").selectOption("sql");
    assert.equal(
      await page
        .locator('[data-step-key="query"][aria-current="step"]')
        .count(),
      1,
      "selection follows the same logical step",
    );
    assert.equal(
      await page.locator('[data-step-key="query"]').getAttribute("data-node"),
      "Postgres / MySQL",
    );
    assert.match(
      await page.locator("#exampleSnippetText").textContent(),
      /\$1::date/,
    );
    await page.locator("#monthlySource").selectOption("bigquery");
    await page.locator('[data-step-key="map"]').click();
    const expectedReport = JSON.parse(
      await page.locator("#exampleOutput").textContent(),
    );
    await page.locator('[data-step-key="verify"]').click();
    const verifySnippet = await page
      .locator("#exampleSnippetText")
      .textContent();
    const verifyReport = (rows) =>
      vm.runInNewContext("(function(){" + verifySnippet + "})()", {
        $input: { all: () => rows },
        $: (name) => ({
          all: () => expectedReport,
          first: () => ({ json: { reportId: "fixture-report" } }),
        }),
      })[0].json;
    assert.equal(verifyReport(expectedReport).verified, true);
    assert.equal(verifyReport(expectedReport.slice(0, 2)).verified, false);
    assert.equal(
      verifyReport([...expectedReport, expectedReport[0]]).verified,
      false,
    );
    assert.equal(verifyReport([{ json: {} }]).verified, false);
    await page.locator("#monthlyVerified").uncheck();
    assert.equal(
      await page.locator('[data-step-key="email"]').count(),
      0,
      "incomplete reports have no success-email step",
    );
    await page.locator('[data-step-key="confirmed"]').click();
    const unconfirmed = JSON.parse(
      await page.locator("#exampleOutput").textContent(),
    );
    assert.equal(unconfirmed.true.length, 0);
    assert.equal(unconfirmed.false[0].json.rowsWritten, 2);
    await page.locator('[data-step-key="stop"]').click();
    assert.equal(
      JSON.parse(await page.locator("#exampleOutput").textContent()).emailSent,
      false,
    );
    await page.locator("#monthlyVerified").check();
    assert.equal(await page.locator('[data-step-key="email"]').count(), 1);
    // Changing an ancestor never leaves an impossible child-folder fixture.
    await page.locator("#monthlyYear").uncheck();
    assert.equal(await page.locator("#monthlyMonth").isChecked(), false);
    assert.equal(await page.locator("#monthlyReport").isChecked(), false);
    await page.locator('[data-monthly-preset="month"]').click();

    await page.locator('[data-example="lotes-subworkflows"]').click();
    await page.locator('[data-step-key="parent-call"]').click();
    const childContract = JSON.parse(
      await page.locator("#exampleInput").textContent(),
    )[0].json;
    assert.equal("rows" in childContract, false);
    assert.ok(
      JSON.stringify(childContract).length < 400,
      "small context across workflow boundary",
    );
    await page.locator('[data-step-key="child-return"]').click();
    const ack = JSON.parse(
      await page.locator("#exampleOutput").textContent(),
    )[0].json;
    assert.equal("rows" in ack, false);
    assert.equal(ack.rowsWritten, 2);
    assert.equal(ack.done, false);
    await page.locator('[data-step-key="parent-next"]').click();
    const nextPage = JSON.parse(
      await page.locator("#exampleOutput").textContent(),
    );
    assert.equal(nextPage.true[0].json.pageToken, ack.nextPageToken);
    await page.locator('[data-step-key="parent-confirm"]').click();
    const manifest = JSON.parse(
      await page.locator("#exampleInput").textContent(),
    );
    assert.equal(manifest.confirmedRows, manifest.expectedRows);
    assert.equal(manifest.pendingPages, 0);
    assert.equal(manifest.ambiguousWrites, 0);

    // Batch budget covers both bytes and the total lifetime of a waiting parent.
    assert.equal(await page.locator("#performancePanel").isVisible(), true);
    assert.equal(await page.locator("#budgetBatchCount").textContent(), "200");
    assert.equal(await page.locator("#budgetDuration").textContent(), "599");
    assert.match(
      await page.locator("#budgetAdvice").textContent(),
      /supera el presupuesto/,
    );
    await page.locator("#budgetRows").fill("100");
    await page.locator("#budgetBatch").fill("500");
    assert.equal(await page.locator("#budgetBatchCount").textContent(), "1");
    assert.equal(
      await page.locator("#budgetDuration").textContent(),
      "2",
      "no pause after the last/only batch",
    );
    await page.locator("#budgetPayload").fill("1");
    assert.match(
      await page.locator("#budgetAdvice").textContent(),
      /payload estimado supera/,
    );
    await page.locator("#budgetBatch").fill("0");
    assert.equal(await page.locator("#budgetError").isVisible(), true);
    assert.equal(await page.locator("#budgetResults").isVisible(), false);
    await page.locator("#budgetBatch").fill("10");
    await page.locator("#budgetPause").fill("0");
    assert.equal(await page.locator("#budgetDuration").textContent(), "20");
    assert.equal(await page.locator("#budgetError").isVisible(), false);
    await page.locator("#budgetBatch").fill("1.5");
    assert.equal(await page.locator("#budgetError").isVisible(), true);
    await page.locator("#budgetBatch").fill("500");
    await page.locator("#budgetRows").fill("100000");
    await page.locator("#budgetPause").fill("1");
    await page.locator("#budgetPayload").fill("1024");

    // Inline SVG definitions must never collide across integration logos or repeated nodes.
    const duplicateSvgIds = await page.evaluate(() => {
      const ids = [...document.querySelectorAll("svg [id]")].map((el) => el.id);
      return ids.filter((id, index) => ids.indexOf(id) !== index);
    });
    assert.deepEqual(duplicateSvgIds, []);
    const iconReferencesValid = await page.evaluate(() =>
      [...document.querySelectorAll("svg")].every((svg) => {
        const references = svg.outerHTML.matchAll(/url\(#([^)]+)\)/g);
        return [...references].every((match) =>
          [...svg.querySelectorAll("[id]")].some((el) => el.id === match[1]),
        );
      }),
    );
    assert.equal(iconReferencesValid, true);
    assert.equal(
      await page
        .locator("svg")
        .evaluateAll((icons) =>
          icons.every(
            (svg) =>
              svg.viewBox.baseVal.width > 0 && svg.viewBox.baseVal.height > 0,
          ),
        ),
      true,
      "icons preserve their full artwork when scaled",
    );

    // All five views must fit narrow and wide screens without page overflow.
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const view of ["library", "lab", "quiz", "roadmap", "examples"]) {
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
    // Test each business case at narrow widths as well as the main view shell.
    await page.locator('.view-tab[data-view="examples"]').click();
    for (const width of [320, 375]) {
      await page.setViewportSize({ width, height: 900 });
      for (const id of [
        "pedidos",
        "leads",
        "stock",
        "ventas",
        "facturas",
        "soporte",
        "errores",
        "reporte-mensual",
        "lotes-subworkflows",
      ]) {
        await page.locator(`[data-example="${id}"]`).click();
        await page.locator("#exampleNext").click();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
          `${id} fits ${width}px`,
        );
      }
    }
    await page.locator('.view-tab[data-view="roadmap"]').click();
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
    assert.equal(await fallback.locator(".card").count(), 53);
    assert.equal(await fallback.locator("#storageNote").isVisible(), true);
    await fallback.locator('[data-mastered="0"]').click();
    assert.equal(await fallback.locator("#masteredCount").textContent(), "1");
    await blocked.close();
    await page.evaluate(() =>
      localStorage.setItem("automationhub.n8n.learning.v1", "{broken"),
    );
    await page.reload();
    assert.equal(await page.locator("#nodeCount").textContent(), "53");
    assert.deepEqual(errors, []);
    console.log(
      "PASS: catalogue, keyboard dialog, saved progress, lab branches and validation, all quizzes, roadmap, reset, storage fallback, business examples and guide downloads, monthly create/reuse and confirmation, small subworkflow contracts, SVG icons, budget estimation, and responsive layouts.",
    );
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

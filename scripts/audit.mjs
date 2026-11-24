import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import lighthouse, { desktopConfig } from "lighthouse";
import { launch } from "chrome-launcher";
import { preview } from "vite";

const require = createRequire(import.meta.url);
const categories = ["performance", "accessibility", "best-practices", "seo"];
const metrics = [
  "largest-contentful-paint",
  "cumulative-layout-shift",
  "total-blocking-time",
];
const output = new URL("../reports/lighthouse/", import.meta.url);
await mkdir(output, { recursive: true });

const server = await preview({
  preview: { host: "127.0.0.1", port: 4180, strictPort: true },
});
const origin = "http://127.0.0.1:4180";
const summary = [];
try {
  for (const [page, path] of [
    ["inicio", "/"],
    ["detalhe", "/nft/1"],
  ]) {
    for (const profile of ["mobile", "desktop"]) {
      const measurements = [];
      for (let run = 1; run <= 3; run++) {
        const chrome = await launch({
          chromePath: process.env.CHROMIUM_PATH || undefined,
          chromeFlags: [
            "--headless",
            ...(process.env.CHROME_NO_SANDBOX === "1" ? ["--no-sandbox"] : []),
            ...(process.env.CHROMIUM_SINGLE_PROCESS === "1"
              ? ["--single-process", "--no-zygote"]
              : []),
          ],
        });
        try {
          const result = await lighthouse(
            origin + path,
            {
              port: chrome.port,
              output: "html",
              onlyCategories: categories,
              logLevel: "error",
            },
            profile === "desktop" ? desktopConfig : undefined,
          );
          if (!result || result.lhr.runtimeError) {
            throw new Error(
              result?.lhr.runtimeError?.message || "Auditoria sem resultado.",
            );
          }
          const { lhr } = result;
          const filename = page + "-" + profile + "-" + run;
          await writeFile(new URL(filename + ".html", output), result.report);
          await writeFile(
            new URL(filename + ".json", output),
            JSON.stringify(lhr, null, 2),
          );
          measurements.push(
            Object.fromEntries([
              ...categories.map((id) => [
                id,
                Math.round(lhr.categories[id].score * 100),
              ]),
              ...metrics.map((id) => [id, lhr.audits[id].numericValue]),
            ]),
          );
        } finally {
          await chrome.kill();
        }
      }
      const median = Object.fromEntries(
        Object.keys(measurements[0]).map((key) => [
          key,
          measurements.map((run) => run[key]).sort((a, b) => a - b)[1],
        ]),
      );
      summary.push({ page, profile, median });
    }
  }
  await writeFile(
    new URL("medianas.json", output),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        node: process.version,
        platform: process.platform,
        lighthouse: require("lighthouse/package.json").version,
        summary,
      },
      null,
      2,
    ),
  );
  console.table(
    summary.map(({ page, profile, median }) => ({ page, profile, ...median })),
  );
} finally {
  await new Promise((resolve, reject) =>
    server.httpServer.close((error) => (error ? reject(error) : resolve())),
  );
}

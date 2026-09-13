import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const repository = fileURLToPath(new URL("../", import.meta.url));
const source = join(
  repository,
  "src/web/public/assets/branding/issopen-icon-v1.png",
);
const target = join(repository, "extensions/chrome/assets");

export async function generateExtensionIcons() {
  await mkdir(target, { recursive: true });
  const icon = `data:image/png;base64,${(await readFile(source)).toString("base64")}`;
  const browser = await chromium.launch({ headless: true });
  try {
    for (const size of [16, 48, 128]) {
      const path = join(target, `icon-${size}.png`);
      await mkdir(dirname(path), { recursive: true });
      const page = await browser.newPage({
        viewport: { width: size, height: size },
      });
      await page.setContent(
        `<style>html,body{margin:0;width:${size}px;height:${size}px;background:transparent;overflow:hidden}img{display:block;width:${size}px;height:${size}px;object-fit:contain}</style><img alt="" src="${icon}">`,
      );
      await page.screenshot({ path, omitBackground: true });
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url))
  generateExtensionIcons().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Icon generation failed",
    );
    process.exitCode = 1;
  });

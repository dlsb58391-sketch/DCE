// Generate electron/assets/icon.ico (and icon.png) from the Clinva SVG mark.
// Uses sharp to rasterize the SVG, then png-to-ico to pack multiple sizes.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "public", "clinva-mark.svg");
const OUT_DIR = path.join(ROOT, "electron", "assets");
const PNG = path.join(OUT_DIR, "icon.png");
const ICO = path.join(OUT_DIR, "icon.ico");

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const svg = fs.readFileSync(SRC);

  // 512 master PNG (electron-builder can derive other assets from it).
  await sharp(svg, { density: 384 }).resize(512, 512).png().toFile(PNG);

  // ICO with the standard Windows icon sizes.
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const buffers = await Promise.all(
    sizes.map((s) => sharp(svg, { density: 384 }).resize(s, s).png().toBuffer())
  );
  const ico = await pngToIco(buffers);
  fs.writeFileSync(ICO, ico);

  console.log("icon written:", ICO);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * 生成合法的 favicon.ico（多尺寸 PNG 内嵌 ICO 容器）
 * 背景：旧 favicon.ico 实为改扩展名的 PNG，搜索引擎（百度/Google）按 ICO 结构
 * 严格解析失败，搜索结果回退为默认地球图标。
 * 用法：node scripts/generate-favicon.js
 */
const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "../public/android-chrome-192x192.png");
const OUT = path.join(__dirname, "../src/app/favicon.ico");
const SIZES = [16, 32, 48];

async function main() {
  const pngs = [];
  for (const size of SIZES) {
    const buf = await sharp(SRC)
      .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    pngs.push({ size, buf });
  }

  // ICO 容器：6 字节头 + 每图 16 字节目录项 + 各 PNG 负载
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(pngs.length, 4);

  let offset = 6 + pngs.length * 16;
  const dirEntries = [];
  for (const { size, buf } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // color palette
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(buf.length, 8); // payload size
    e.writeUInt32LE(offset, 12); // payload offset
    offset += buf.length;
    dirEntries.push(e);
  }

  const ico = Buffer.concat([header, ...dirEntries, ...pngs.map((p) => p.buf)]);
  fs.writeFileSync(OUT, ico);
  console.log(`favicon.ico written: ${ico.length} bytes (${SIZES.join("/")}px)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

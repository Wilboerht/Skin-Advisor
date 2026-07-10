const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const PUBLIC_DIR = path.join(__dirname, "..", "public");
const IMAGES_DIR = path.join(PUBLIC_DIR, "images");

// Brand colors
const BRAND_DARK = "#00263e";
const BRAND_BG = "#F5F2E9";
const BRAND_ACCENT = "#8B7355";

function ogImageSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F8F7F3"/>
      <stop offset="100%" stop-color="#F5F2E9"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#00263e" flood-opacity="0.06"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bgGrad)"/>
  
  <!-- Decorative arcs -->
  <path d="M -80 520 Q 300 420 600 520 T 1280 480" fill="none" stroke="#E8E4DA" stroke-width="120" opacity="0.6"/>
  <path d="M -80 580 Q 320 500 620 580 T 1280 560" fill="none" stroke="#DDD8CC" stroke-width="60" opacity="0.5"/>
  
  <!-- Logo mark: stylized "N" from NIHPLOD (simplified polygon representation) -->
  <g transform="translate(160, 215) scale(2.2)" filter="url(#softShadow)">
    <polygon points="40.31 41.556 5.723 0 0 0 0 53.67 6.781 53.67 6.781 12.114 41.368 53.67 47.091 53.67 47.091 0 40.31 0 40.31 41.556" fill="${BRAND_DARK}"/>
    <rect x="59.82995" width="6.78074" height="53.66965" fill="${BRAND_DARK}"/>
    <polygon points="126.696 53.67 126.696 0 119.915 0 119.915 23.445 86.647 23.445 86.647 0 79.866 0 79.866 53.67 86.647 53.67 86.647 30.225 119.915 30.225 119.915 53.67 126.696 53.67" fill="${BRAND_DARK}"/>
    <path d="M180.6666,40.05087H156.84044V93.72052h6.78074V75.87591H180.6666a17.91255,17.91255,0,1,0,0-35.825Zm0,29.04321H163.62118V46.8327H180.6666a11.13075,11.13075,0,1,1,0,22.26138Z" transform="translate(-19.42071 -40.05087)" fill="${BRAND_DARK}"/>
    <polygon points="193.618 0 186.838 0 186.838 53.67 222.397 53.67 222.397 46.888 193.618 46.888 193.618 0" fill="${BRAND_DARK}"/>
    <path d="M266.97433,40.06923c-15.54023,0-26.81926,11.27794-26.81926,26.81631,0,15.53883,11.279,26.81678,26.81926,26.81678,15.53821,0,26.816-11.278,26.816-26.81678C293.79033,51.34717,282.51254,40.06923,266.97433,40.06923Zm0,46.8536c-11.798,0-20.03744-8.23957-20.03744-20.03729,0-11.79725,8.23941-20.03666,20.03744-20.03666,11.796,0,20.03418,8.23941,20.03418,20.03666C287.00851,78.68326,278.77034,86.92283,266.97433,86.92283Z" transform="translate(-19.42071 -40.05087)" fill="${BRAND_DARK}"/>
    <path d="M322.57968,40.05087H302.347V93.72052h20.23272a26.83483,26.83483,0,0,0,0-53.66965Zm0,46.888H309.12661V46.8327h13.45307a20.05308,20.05308,0,0,1,0,40.10615Z" transform="translate(-19.42071 -40.05087)" fill="${BRAND_DARK}"/>
  </g>
  
  <!-- Text content -->
  <text x="160" y="420" font-family="'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif" font-size="52" font-weight="500" fill="#1A1A1A" letter-spacing="0.05em">AI 护肤顾问</text>
  <text x="160" y="480" font-family="'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif" font-size="28" font-weight="300" fill="#5E5E5E" letter-spacing="0.04em">专业 AI 面部识别 · 8 种肤质类型分析</text>
  
  <!-- Subtle accent line -->
  <line x1="160" y1="510" x2="380" y2="510" stroke="${BRAND_ACCENT}" stroke-width="2" opacity="0.5"/>
  
  <!-- Corner mark -->
  <text x="1080" y="580" font-family="'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif" font-size="16" font-weight="400" fill="#8B7355" letter-spacing="0.15em" text-anchor="end">NIHPLOD</text>
</svg>`;
}

function touchIconSvg() {
  // The original logo viewBox is ~330x93. To fit inside 180x180 with padding,
  // scale to ~0.485 so the full wordmark is visible and centered.
  const scale = 0.485;
  const logoW = 329.99361 * scale; // ~160
  const logoH = 92.6393 * scale;   // ~45
  const tx = (180 - logoW) / 2;    // ~10
  const ty = (180 - logoH) / 2;    // ~67

  return `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <rect width="180" height="180" fill="${BRAND_BG}"/>
  <g transform="translate(${tx}, ${ty}) scale(${scale})">
    <polygon points="40.31 41.556 5.723 0 0 0 0 53.67 6.781 53.67 6.781 12.114 41.368 53.67 47.091 53.67 47.091 0 40.31 0 40.31 41.556" fill="${BRAND_DARK}"/>
    <rect x="59.82995" width="6.78074" height="53.66965" fill="${BRAND_DARK}"/>
    <polygon points="126.696 53.67 126.696 0 119.915 0 119.915 23.445 86.647 23.445 86.647 0 79.866 0 79.866 53.67 86.647 53.67 86.647 30.225 119.915 30.225 119.915 53.67 126.696 53.67" fill="${BRAND_DARK}"/>
    <path d="M180.6666,40.05087H156.84044V93.72052h6.78074V75.87591H180.6666a17.91255,17.91255,0,1,0,0-35.825Zm0,29.04321H163.62118V46.8327H180.6666a11.13075,11.13075,0,1,1,0,22.26138Z" transform="translate(-19.42071 -40.05087)" fill="${BRAND_DARK}"/>
    <polygon points="193.618 0 186.838 0 186.838 53.67 222.397 53.67 222.397 46.888 193.618 46.888 193.618 0" fill="${BRAND_DARK}"/>
    <path d="M266.97433,40.06923c-15.54023,0-26.81926,11.27794-26.81926,26.81631,0,15.53883,11.279,26.81678,26.81926,26.81678,15.53821,0,26.816-11.278,26.816-26.81678C293.79033,51.34717,282.51254,40.06923,266.97433,40.06923Zm0,46.8536c-11.798,0-20.03744-8.23957-20.03744-20.03729,0-11.79725,8.23941-20.03666,20.03744-20.03666,11.796,0,20.03418,8.23941,20.03418,20.03666C287.00851,78.68326,278.77034,86.92283,266.97433,86.92283Z" transform="translate(-19.42071 -40.05087)" fill="${BRAND_DARK}"/>
    <path d="M322.57968,40.05087H302.347V93.72052h20.23272a26.83483,26.83483,0,0,0,0-53.66965Zm0,46.888H309.12661V46.8327h13.45307a20.05308,20.05308,0,0,1,0,40.10615Z" transform="translate(-19.42071 -40.05087)" fill="${BRAND_DARK}"/>
  </g>
</svg>`;
}

async function main() {
  if (!fs.existsSync(IMAGES_DIR)) {
    fs.mkdirSync(IMAGES_DIR, { recursive: true });
  }

  // Generate Open Graph image
  const ogSvg = ogImageSvg();
  const ogBuffer = await sharp(Buffer.from(ogSvg))
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(IMAGES_DIR, "og-default.png"), ogBuffer);
  console.log("✓ Generated public/images/og-default.png (1200x630)");

  // Generate Apple touch icon
  const touchSvg = touchIconSvg();
  const touchBuffer = await sharp(Buffer.from(touchSvg))
    .png()
    .toBuffer();
  fs.writeFileSync(path.join(PUBLIC_DIR, "apple-touch-icon.png"), touchBuffer);
  console.log("✓ Generated public/apple-touch-icon.png (180x180)");
}

main().catch((err) => {
  console.error("Failed to generate images:", err);
  process.exit(1);
});

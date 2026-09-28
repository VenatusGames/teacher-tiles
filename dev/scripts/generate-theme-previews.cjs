// Run after generate-theme-artwork.cjs, with sharp installed or on NODE_PATH.
// This is an offline asset build; the app never rasterizes previews at runtime.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const source = path.join(__dirname, '../assets/themes');
const output = path.join(source, 'previews');

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const manifest = {};
  for (const name of fs.readdirSync(source).filter(name => name.endsWith('.svg')).sort()) {
    const input = fs.readFileSync(path.join(source, name));
    const width = Number(input.toString().match(/<svg\b[^>]*\bwidth="([\d.]+)"/)[1]);
    const file = name.replace(/\.svg$/, '.webp');
    // Render at thumbnail resolution, including the 12,000px Cosmos boards.
    // Avoid allocating a full board-size bitmap only to shrink it afterward.
    await sharp(input, { density: 72 * 1200 / width })
      .resize({ width: 1200 }).webp({ quality: 82, effort: 6 })
      .toFile(path.join(output, file));
    manifest[name] = {
      file, sourceSha256: crypto.createHash('sha256').update(input.toString().replace(/\r\n/g, '\n')).digest('hex'),
      bytes: fs.statSync(path.join(output, file)).size,
    };
  }
  fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Saved ${Object.keys(manifest).length} theme previews (${Math.round(Object.values(manifest).reduce((sum, item) => sum + item.bytes, 0) / 1024)} KiB total).`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });

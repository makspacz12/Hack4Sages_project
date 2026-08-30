/**
 * Shrink the planet textures to the size they are actually drawn at.
 *
 * The downloaded set is 2048x1024 per body and 4.9 MB in total. Measured in
 * the running scene, a planet occupies between about 2 and 30 pixels across at
 * ordinary zoom levels, so a 2048-pixel map contributes roughly half a percent
 * of its texels and the GPU shows an average colour regardless. Shipping it
 * would double the payload of a page already carrying a 7.4 MB replay, over
 * conference wifi, for no visible gain.
 *
 * 512x256 is still an order of magnitude more detail than the largest on-screen
 * size, and survives someone zooming right in on a body. The ring is a thin
 * strip and keeps its aspect.
 *
 * Lives under web/ because it imports sharp, and ESM resolves packages
 * relative to the importing FILE rather than the working directory. Run only
 * when the source textures change:
 *   cd web && node tools/prepare_textures.mjs
 */

import { readdir, mkdir, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(WEB, 'public', 'textures', 'src');
const OUT = join(WEB, 'public', 'textures');

const WIDTH = 512;
const HEIGHT = 256;
const RING_HEIGHT = 32;

async function main() {
  await mkdir(OUT, { recursive: true });
  const files = (await readdir(SRC)).filter(f => /\.(jpg|png)$/i.test(f));
  let before = 0;
  let after = 0;

  for (const name of files) {
    const from = join(SRC, name);
    before += (await stat(from)).size;

    // The ring is a radial strip, not a sphere map, so it keeps its shape.
    const isRing = name.includes('ring');
    const target = name.replace(/^2k_/, '').replace(/\.jpg$/i, '.jpg');
    const to = join(OUT, target);

    const pipe = sharp(from).resize(WIDTH, isRing ? RING_HEIGHT : HEIGHT, { fit: 'fill' });
    // The ring needs its alpha channel; everything else is opaque and is
    // smaller as JPEG.
    await (isRing ? pipe.png({ compressionLevel: 9 }) : pipe.jpeg({ quality: 82 })).toFile(to);

    after += (await stat(to)).size;
    process.stdout.write(`${target}\n`);
  }
  const mb = n => `${(n / 1024 / 1024).toFixed(2)} MB`;
  console.log(`\n${files.length} textures: ${mb(before)} -> ${mb(after)}`);
}

main().catch(err => { console.error(err); process.exit(1); });

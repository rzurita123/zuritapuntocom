// Genera las imágenes optimizadas del sitio a partir de js/obras.js.
//
//   npm run images
//
// Por cada obra escribe img/obras/<slug>-{480,960,1600}.webp y registra en js/imagenes.js
// sus dimensiones, color dominante y un placeholder difuminado (LQIP) en base64.
// También genera la foto del artista y la imagen para redes sociales (og.jpg).

import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { obras, artista } from '../js/obras.js';

const ANCHOS = [480, 960, 1600];
const OUT = 'img/obras';

await mkdir(OUT, { recursive: true });

const hex = ({ r, g, b }) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');

function base(obra) {
  const img = sharp(obra.fuente.archivo).rotate();
  return obra.fuente.recorte ? img.extract(obra.fuente.recorte) : img;
}

const imagenes = {};
const slugs = new Set();

for (const obra of obras) {
  if (slugs.has(obra.slug)) throw new Error(`slug duplicado: ${obra.slug}`);
  slugs.add(obra.slug);

  const buf = await base(obra).toBuffer();
  const { width, height } = await sharp(buf).metadata();

  for (const w of ANCHOS) {
    await sharp(buf)
      .resize({ width: Math.min(w, width) })
      .webp({ quality: w >= 1600 ? 82 : 78 })
      .toFile(`${OUT}/${obra.slug}-${w}.webp`);
  }

  const { dominant } = await sharp(buf).resize(64).stats();
  const lqip = await sharp(buf).resize(24).blur(1.2).webp({ quality: 40 }).toBuffer();

  imagenes[obra.slug] = {
    w: width,
    h: height,
    color: hex(dominant),
    lqip: 'data:image/webp;base64,' + lqip.toString('base64'),
  };
  console.log(`✓ ${obra.slug} (${width}×${height})`);
}

await sharp(artista.foto).resize(600, 600, { fit: 'cover', withoutEnlargement: true }).webp({ quality: 85 }).toFile('img/artista.webp');
await sharp(artista.foto).resize(600, 600, { fit: 'cover', withoutEnlargement: true }).jpeg({ quality: 85 }).toFile('img/artista.jpg');

const portada = obras.find((o) => o.destacada);
await base(portada).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 82 }).toFile('img/og.jpg');

await writeFile(
  'js/imagenes.js',
  '// Generado por scripts/build-images.mjs — no editar a mano.\n' +
    'export const imagenes = ' +
    JSON.stringify(imagenes, null, 1) +
    ';\n',
);

console.log(`\n${obras.length} obras procesadas.`);

// Vectoriza la firma real a partir de una foto o escaneo.
//
//   node scripts/firma.mjs [foto] [umbral]
//
// Por defecto usa assets/firma-original.jpg. Escribe img/firma.svg (relleno en currentColor)
// e imprime el `d` y el viewBox para pegar en el <symbol id="s-firma"> de index.html.
// Requiere potrace:  npm install --no-save potrace

import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const potrace = require('potrace');

const foto = process.argv[2] || 'assets/firma-original.jpg';
const umbral = Number(process.argv[3] || 70);

// 1. Tinta en negro sobre blanco. La mediana borra la trama de la tela sin perder el borde del pincel.
const bin = await sharp(foto).greyscale().median(Number(process.env.MED || 9)).threshold(umbral).png().toBuffer();

// 2. Trazado. turdSize descarta motas y agujeritos del pincel seco; alphaMax suaviza esquinas.
const svg = await new Promise((ok, mal) =>
  potrace.trace(bin, { turdSize: 250, optTolerance: 0.5, alphaMax: Number(process.env.ALPHA || 1), threshold: 128 }, (e, out) => (e ? mal(e) : ok(out))),
);
let d = svg.match(/ d="([^"]+)"/)[1];

// 3. Coordenadas con 1 decimal y viewBox ajustado a la firma, con un margen.
d = d.replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n) * 10) / 10));
const nums = d.match(/-?\d+(\.\d+)?/g).map(Number);
const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
const pad = 12;
const x0 = Math.floor(Math.min(...xs)) - pad, y0 = Math.floor(Math.min(...ys)) - pad;
const w = Math.ceil(Math.max(...xs)) + pad - x0, h = Math.ceil(Math.max(...ys)) + pad - y0;
const viewBox = `${x0} ${y0} ${w} ${h}`;

await writeFile(
  'img/firma.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"><path fill="currentColor" fill-rule="evenodd" d="${d}"/></svg>\n`,
);
console.log(JSON.stringify({ viewBox, aspecto: +(w / h).toFixed(3), bytes: d.length }));

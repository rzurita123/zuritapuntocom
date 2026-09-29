// Genera el favicon con la Z de la firma real.
//
//   node scripts/favicon.mjs
//
// Toma assets/firma-original.jpg, aísla la Z (en la firma está unida a la V), la vectoriza
// y escribe favicon.svg (Z negra sobre ocre) y apple-touch-icon.png (180 × 180).
// Requiere potrace:  npm install --no-save potrace

import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const potrace = require('potrace');

const FOTO = 'assets/firma-original.jpg';
// Recuadro de la Z en la foto, y el corte que la separa de la V (sigue el borde izquierdo de la V).
const CAJA = { left: 300, top: 470, width: 370, height: 420 };
const CORTE = [[578, 470], [574, 560], [640, 790], [640, 890], [670, 890], [670, 470]];

const { width: W, height: H } = await sharp(FOTO).metadata();
const tapa = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><polygon fill="#fff" points="${CORTE.map((p) => p.join(',')).join(' ')}"/></svg>`,
);
// (en dos pasos: sharp aplica extract antes que composite dentro de un mismo pipeline)
const tinta = await sharp(FOTO).greyscale().median(5).threshold(70).composite([{ input: tapa }]).png().toBuffer();
const bin = await sharp(tinta).extract(CAJA).png().toBuffer();

const svg = await new Promise((ok, mal) =>
  potrace.trace(bin, { turdSize: 250, optTolerance: 0.5, alphaMax: 0.8, threshold: 128 }, (e, out) => (e ? mal(e) : ok(out))),
);
let d = svg.match(/ d="([^"]+)"/)[1].replace(/-?\d+\.\d+/g, (n) => String(Math.round(Number(n))));

// Centrar la Z en un cuadrado de 64 con margen.
const nums = d.match(/-?\d+/g).map(Number);
const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 === 1);
const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
const lado = Math.max(x1 - x0, y1 - y0) / 0.74; // la Z ocupa ~74 % del ícono
const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
const vb = `${Math.round(cx - lado / 2)} ${Math.round(cy - lado / 2)} ${Math.round(lado)} ${Math.round(lado)}`;
const [vx, vy, vl] = vb.split(' ').map(Number);

const icono = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"><rect x="${vx}" y="${vy}" width="${vl}" height="${vl}" rx="${Math.round(vl * 0.16)}" fill="#b8873a"/><path fill="#14110e" fill-rule="evenodd" d="${d}"/></svg>\n`;
await writeFile('favicon.svg', icono);
await sharp(Buffer.from(icono)).resize(180, 180).png().toFile('apple-touch-icon.png');
console.log(JSON.stringify({ viewBox: vb, bytes: icono.length }));

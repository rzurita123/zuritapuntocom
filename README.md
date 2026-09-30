# zuritapuntocom

Galería online de **Marcelo Zurita**, pintor chileno (1958) radicado en Montevideo.
HTML, CSS y JavaScript vanilla, sin build. Se publica como Worker de Cloudflare: sirve los archivos
estáticos y atiende el formulario de contacto.

## Estructura

```
index.html            página única (portada, galería, sobre la obra, artista, contacto)
404.html              página de error
css/styles.css        estilos
js/obras.js           catálogo de obras: la ÚNICA fuente de datos (títulos, textos, imágenes)
js/imagenes.js        generado por `npm run images` (dimensiones, color dominante, placeholder)
js/main.js            intro, transiciones, galería, visor, animaciones de scroll
img/                  imágenes optimizadas (generadas; se publican)
assets/               fotos originales (fuente de las imágenes optimizadas)
scripts/               imágenes, firma y favicon
src/worker.js         Worker: formulario de contacto (/api/contacto) + archivos estáticos
wrangler.jsonc        configuración del Worker (qué se publica, envío de mails)
.assetsignore         archivos del repo que NO se publican
_headers              caché de imágenes, CSS y JS
```

## Ver el sitio en local

```bash
npm run dev
```

Abre en <http://localhost:5173> con el Worker incluido, así que el formulario funciona: los mails no se
envían, Wrangler los guarda como `.eml` en `.wrangler/tmp/email/` y muestra la ruta en la consola.
Para ver solo lo estático (sin formulario): `npm run dev:estatico`.

## Agregar o editar un cuadro

1. Copiá la foto original a `assets/` (idealmente 1600 px de ancho o más, recortada al lienzo).
2. Agregá una entrada en `js/obras.js`. El orden del array es el orden de la galería.
   Si la foto trae pared o marco, usá `recorte: { left, top, width, height }` en píxeles del original.
3. Generá las imágenes optimizadas (la primera vez hace falta `npm install`):

   ```bash
   npm run images
   ```

4. Commiteá `js/obras.js`, `js/imagenes.js` e `img/`.

Las obras marcadas `destacada: true` alimentan el collage de la portada (se usan las 5 primeras).

## Firma

La firma es la real, vectorizada de una foto (`assets/firma-original.jpg`) con `scripts/firma.mjs`.
Para reemplazarla por una mejor (escaneo en alta, tinta oscura sobre fondo claro):

```bash
npm install --no-save potrace
MED=5 ALPHA=0.8 node scripts/firma.mjs assets/nueva-firma.jpg
```

Eso escribe `img/firma.svg`. Copiar su `viewBox` y su `d` al `<symbol id="s-firma">` de `index.html`,
y usar `viewBox="0 0 ancho alto"` en los `<svg>` que la referencian. Si la forma cambia mucho, ajustar
`FIRMA_TRAZOS` en `js/main.js`: son los trazos que animan la firma "escribiéndose" en la intro y el pie.

El favicon (`favicon.svg` y `apple-touch-icon.png`) es la Z de esa misma foto: `node scripts/favicon.mjs`.

## Formulario de contacto

`src/worker.js` recibe el formulario y lo envía por mail a **zuritamapuche@gmail.com** con Cloudflare
Email Routing, desde `formulario@marcelozurita.com`. "Responder" le contesta a quien escribió.
Descarta bots con un campo trampa invisible y solo acepta envíos desde el propio sitio.

Requisitos en el dashboard de Cloudflare (una sola vez):

1. **Email** → **Email Routing**: activado para `marcelozurita.com`.
2. **Destination addresses**: `zuritamapuche@gmail.com` agregada y **verificada** (llega un mail a esa casilla).

Para cambiar la casilla de destino: `send_email` y `vars.DESTINO` en `wrangler.jsonc` (y verificar la nueva).

## Deploy

Cloudflare Workers, conectado al repo de GitHub: cada push a `main` se publica solo (`npx wrangler deploy`
con `wrangler.jsonc`). Se publican los archivos de la raíz menos lo listado en `.assetsignore`.

## Pendientes

- Dos obras sin datos (no están en Saatchi Art): `sin-titulo-jazz` y `sin-titulo-bodegon` en `js/obras.js`.
  Completar título, año, técnica y medidas.
- La foto del artista es de 300 × 300 px; una de mayor resolución luciría mejor.
- Si llega spam por el formulario: agregar Cloudflare Turnstile (captcha invisible) al Worker.
- Venta online.

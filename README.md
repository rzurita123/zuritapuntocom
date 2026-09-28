# zuritapuntocom

Galería online de **Marcelo Zurita**, pintor chileno (1958) radicado en Montevideo.
Sitio 100 % estático: HTML, CSS y JavaScript vanilla, sin build ni backend.

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
scripts/build-images.mjs
_headers              caché para Cloudflare Pages
```

## Ver el sitio en local

```bash
npm run dev
```

Abre en <http://localhost:5173>. Cualquier servidor estático sirve; abrir `index.html`
con doble clic no funciona porque los módulos JS necesitan `http://`.

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

## Deploy

El sitio se sirve tal cual desde la raíz del repo.

**Cloudflare Pages** (conectado al repo de GitHub):

- Framework preset: *None*
- Build command: *(vacío)*
- Build output directory: `/`

**GitHub Pages**: Settings → Pages → *Deploy from a branch* → `main` / `(root)`.

## Pendientes

- Dos obras sin datos (no están en Saatchi Art): `sin-titulo-jazz` y `sin-titulo-bodegon` en `js/obras.js`.
  Completar título, año, técnica y medidas.
- La foto del artista es de 300 × 300 px; una de mayor resolución luciría mejor.
- El formulario de contacto es de muestra: valida y confirma, pero no envía nada. Para activarlo,
  reemplazar la función `enviar` en `js/main.js` (`bindForm`) por un envío real (un Worker con email, Formspree, etc.).
- Venta online.

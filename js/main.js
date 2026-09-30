import { obras, series } from './obras.js';
import { imagenes } from './imagenes.js';

/* ==========================================================================
   Utilidades
   ========================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const html = document.documentElement;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const EASE = 'cubic-bezier(.7,0,.2,1)';
const EASE_OUT = 'cubic-bezier(.16,1,.3,1)';
const ANCHOS = [480, 960, 1600];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const sget = (k) => { try { return sessionStorage.getItem(k); } catch { return null; } };
const sset = (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* sin storage */ } };

const src = (slug, w) => `img/obras/${slug}-${w}.webp`;
const srcset = (slug) => ANCHOS.map((w) => `${src(slug, w)} ${w}w`).join(', ');
const saatchiUrl = (ruta) => `https://www.saatchiart.com/art/${ruta}/view`;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const catalogo = obras
  .filter((o) => imagenes[o.slug])
  .map((o) => ({ ...o, ...imagenes[o.slug], ar: imagenes[o.slug].w / imagenes[o.slug].h }));
const porSlug = new Map(catalogo.map((o) => [o.slug, o]));

function medidas(o) {
  if (!o.medidas) return '';
  const [a, b] = o.medidas;
  const mayor = Math.max(a, b), menor = Math.min(a, b);
  const [alto, ancho] = o.ar >= 1 ? [menor, mayor] : [mayor, menor];
  return `${alto} × ${ancho} cm`;
}

function decode(img) {
  return Promise.race([img.decode ? img.decode().catch(() => {}) : Promise.resolve(), wait(1200)]);
}

/* ==========================================================================
   Firma: animación "escribiéndose"
   ========================================================================== */
// La firma es una figura rellena (vectorizada de la foto). Para que parezca escribirse
// se enmascara con estos trazos, en orden de escritura y en coordenadas de la foto
// original (ver scripts/firma.mjs), y se van descubriendo uno tras otro.
const FIRMA_TRAZOS = [
  'M120 672L262 665', // guion
  'M330 556L580 550', // Z: barra superior
  'M560 560L438 765', //    diagonal
  'M398 772L655 780', //    base
  'M598 552L718 805', // V: brazo izquierdo
  'M765 810L768 505', //    brazo derecho (también palo de la R)
  'M770 510L900 508Q945 520 930 580Q915 640 835 645', // R: panza
  'M832 650L1000 855', //   pata
  'M1000 505L1008 800', // I
  'M1060 388L1200 298', // tilde
  'M1100 535L1490 518', // T: barra
  'M1222 540L1215 835', //    palo
  'M1290 790L1385 440L1525 835', // A
  'M1672 612L1830 606', // guion
];

/** Largo aproximado de un trazo (rectas y curvas cuadráticas). */
function largoTrazo(d) {
  const n = d.match(/[MLQ]|-?\d+(\.\d+)?/g);
  let x = 0, y = 0, total = 0;
  for (let i = 0; i < n.length; ) {
    const cmd = n[i++];
    if (cmd === 'M') { x = +n[i++]; y = +n[i++]; }
    else if (cmd === 'L') { const nx = +n[i++], ny = +n[i++]; total += Math.hypot(nx - x, ny - y); x = nx; y = ny; }
    else if (cmd === 'Q') {
      const cx = +n[i++], cy = +n[i++], nx = +n[i++], ny = +n[i++];
      let px = x, py = y;
      for (let k = 1; k <= 12; k++) {
        const t = k / 12, u = 1 - t;
        const qx = u * u * x + 2 * u * t * cx + t * t * nx, qy = u * u * y + 2 * u * t * cy + t * t * ny;
        total += Math.hypot(qx - px, qy - py); px = qx; py = qy;
      }
      x = nx; y = ny;
    }
  }
  return total;
}

function prepFirmas() {
  const vb = $('#s-firma').getAttribute('viewBox').split(' ').map(Number);
  const largos = FIRMA_TRAZOS.map(largoTrazo);
  const total = largos.reduce((a, b) => a + b, 0);
  $$('.firma-anim').forEach((svg, i) => {
    const id = `m-firma-${i}`;
    const [, , w, h] = svg.getAttribute('viewBox').split(' ');
    svg.insertAdjacentHTML(
      'afterbegin',
      `<defs><mask id="${id}" maskUnits="userSpaceOnUse" x="-100" y="-100" width="${+w + 200}" height="${+h + 200}">` +
        `<g class="firma-trazos" transform="translate(${-vb[0]} ${-vb[1]})">${FIRMA_TRAZOS.map((d) => `<path d="${d}"/>`).join('')}</g>` +
      `</mask></defs>`,
    );
    $('use', svg).setAttribute('mask', `url(#${id})`);
    let acc = 0;
    svg._trazos = $$('.firma-trazos path', svg).map((p, k) => {
      const t = { p, len: largos[k], start: acc / total, span: largos[k] / total };
      acc += largos[k];
      p.style.strokeDasharray = `${t.len} ${t.len}`;
      return t;
    });
    setFirma(svg, 0);
  });
}

/** Dibuja la firma hasta la fracción p (0 = nada, 1 = completa). */
function setFirma(svg, p) {
  if (!svg._trazos) return;
  svg._trazos.forEach((t) => {
    const f = clamp((p - t.start) / t.span, 0, 1);
    t.p.style.strokeDashoffset = String(t.len * (1 - f));
  });
  svg.classList.toggle('is-drawn', p >= 1);
}

function drawFirma(svg, ms) {
  return new Promise((ok) => {
    const t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const tick = (now) => {
      const t = clamp((now - t0) / ms, 0, 1);
      setFirma(svg, ease(t));
      if (t < 1) requestAnimationFrame(tick); else ok();
    };
    requestAnimationFrame(tick);
  });
}

/* ==========================================================================
   Cortina (intro y navegación entre secciones)
   ========================================================================== */
const wipe = $('.wipe');
const wipeSpans = $$('.wipe > span');
const wipeLabel = $('.wipe__label');
const wipeFirma = $('.wipe__firma');
const wipeText = $('.wipe__text');
let wiping = false;

async function intro() {
  const heroFirma = $('.hero__firma');
  if (reduced) { html.classList.remove('intro-pending'); heroFirma.classList.add('is-here'); return; }
  wiping = true;
  const repeat = sget('zurita-intro') === '1';
  sset('zurita-intro', '1');

  wipe.classList.add('is-active');
  wipeFirma.style.display = '';
  wipeText.textContent = '';
  wipeSpans.forEach((s) => (s.style.transform = 'none'));
  html.classList.remove('intro-pending');

  wipeLabel.style.opacity = 1;
  await drawFirma(wipeFirma, repeat ? 800 : 1900);
  await wait(repeat ? 120 : 320);

  // Se abren las franjas y, a la vez, la firma viaja a su lugar en la portada.
  const franjas = wipeSpans.map((s, i) =>
    s.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-101%)' }], {
      duration: 900, delay: 120 + i * 70, easing: EASE, fill: 'forwards',
    }).finished,
  );
  hero.classList.add('is-in');
  wipe.style.pointerEvents = 'none'; // la página ya se ve: que responda a los clics mientras sale la cortina
  const enPortada = !location.hash || location.hash === '#inicio';
  if (enPortada) {
    const r0 = wipeFirma.getBoundingClientRect();
    const r1 = heroFirma.getBoundingClientRect();
    wipeFirma.style.transformOrigin = '0 0';
    await wipeFirma.animate(
      [{ transform: 'none' }, { transform: `translate(${r1.left - r0.left}px, ${r1.top - r0.top}px) scale(${r1.width / r0.width})` }],
      { duration: 1150, delay: 60, easing: EASE, fill: 'forwards' },
    ).finished;
  } else {
    // Con un link directo a otra sección la portada no está en pantalla: la firma se desvanece.
    wipeLabel.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(-40px)' }], { duration: 500, easing: EASE, fill: 'forwards' });
  }
  heroFirma.classList.add('is-here');
  await Promise.all(franjas);
  resetWipe();
  wiping = false;
}

function resetWipe() {
  wipeSpans.forEach((s) => { s.getAnimations().forEach((a) => a.cancel()); s.style.transform = ''; });
  wipeLabel.getAnimations().forEach((a) => a.cancel());
  wipeFirma.getAnimations().forEach((a) => a.cancel());
  wipeFirma.style.transformOrigin = '';
  setFirma(wipeFirma, 0);
  wipeLabel.style.opacity = '';
  wipe.style.pointerEvents = '';
  wipe.classList.remove('is-active');
}

function jumpTo(id) {
  const el = document.getElementById(id);
  const top = id === 'inicio' || !el ? 0 : el.getBoundingClientRect().top + scrollY;
  scrollTo({ top, behavior: 'instant' });
  history.replaceState(null, '', id === 'inicio' ? location.pathname + location.search : '#' + id);
}

async function goToSection(id, label) {
  if (wiping) return;
  if (viewer.open) await closeViewer();
  const el = document.getElementById(id);
  if (!el) return;
  if (reduced) { jumpTo(id); return; }

  wiping = true;
  const abajo = (id === 'inicio' ? 0 : el.getBoundingClientRect().top) >= 0;
  const from = abajo ? 'translateY(101%)' : 'translateY(-101%)';
  const to = abajo ? 'translateY(-101%)' : 'translateY(101%)';
  const order = (i) => (abajo ? i : wipeSpans.length - 1 - i);

  wipe.classList.add('is-active');
  wipeFirma.style.display = 'none';
  wipeText.textContent = label;

  await Promise.all(
    wipeSpans.map((s, i) =>
      s.animate([{ transform: from }, { transform: 'translateY(0)' }], { duration: 560, delay: order(i) * 40, easing: EASE, fill: 'forwards' }).finished,
    ),
  );
  jumpTo(id);
  await wipeLabel.animate(
    [{ opacity: 0, transform: `translateY(${abajo ? 40 : -40}px)` }, { opacity: 1, transform: 'none' }],
    { duration: 380, easing: EASE_OUT, fill: 'forwards' },
  ).finished;
  await wait(120);
  wipeLabel.animate([{ opacity: 1 }, { opacity: 0, transform: `translateY(${abajo ? -40 : 40}px)` }], { duration: 420, easing: EASE, fill: 'forwards' });
  await Promise.all(
    wipeSpans.map((s, i) =>
      s.animate([{ transform: 'translateY(0)' }, { transform: to }], { duration: 640, delay: 60 + order(i) * 45, easing: EASE, fill: 'forwards' }).finished,
    ),
  );
  resetWipe();
  wiping = false;
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-goto]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  goToSection(a.dataset.goto, a.dataset.label || a.textContent.trim() || 'Inicio');
});

/* ==========================================================================
   Portada: collage constructivo
   ========================================================================== */
const hero = $('.hero');
const heroGrid = $('.hero__grid');

function buildHero() {
  const pinturas = catalogo.filter((o) => o.destacada).slice(0, 5);
  // Celdas a..h del grid; c, f y h son planos de color con símbolos.
  const simbolos = { 2: ['sol', 'var(--ocre)'], 5: ['pez', 'var(--rojo)'], 7: ['estrella', 'var(--azul)'] };
  let p = 0;
  const cells = [];
  for (let i = 0; i < 8; i++) {
    if (simbolos[i]) {
      const [s, c] = simbolos[i];
      cells.push(`<div class="hero__cell" style="--i:${i};--c:${c}" aria-hidden="true"><span class="sym"><svg><use href="#s-${s}"/></svg></span></div>`);
      continue;
    }
    const o = pinturas[p++];
    if (!o) { cells.push(`<div class="hero__cell" style="--i:${i}"></div>`); continue; }
    cells.push(
      `<button class="hero__cell" type="button" style="--i:${i};--c:${o.color}" data-slug="${o.slug}" data-cursor="view" data-title="${esc(o.titulo)}" aria-label="Ver ${esc(o.titulo)}">` +
        `<img src="${src(o.slug, 960)}" srcset="${srcset(o.slug)}" sizes="(max-width: 960px) 70vw, 40vw" alt="" ${i < 2 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">` +
      `</button>`,
    );
  }
  heroGrid.innerHTML = cells.join('');

  heroGrid.addEventListener('click', (e) => {
    const cell = e.target.closest('.hero__cell[data-slug]');
    if (cell) openViewer(cell.dataset.slug, cell.querySelector('img'));
  });

  if (finePointer && !reduced) {
    const imgs = $$('.hero__cell img', heroGrid);
    hero.addEventListener('pointermove', (e) => {
      const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
      imgs.forEach((img, i) => {
        const d = 10 + (i % 3) * 8;
        img.style.setProperty('--px', `${(-nx * d).toFixed(1)}px`);
        img.style.setProperty('--py', `${(-ny * d).toFixed(1)}px`);
      });
    });
  }
}

/* ==========================================================================
   Marquesina de títulos
   ========================================================================== */
const marquee = { track: $('.marquee__track'), x: 0, v: 0, half: 0, visible: true };

function buildMarquee() {
  const syms = ['sol', 'pez', 'estrella', 'ancla', 'luna', 'casa', 'barco', 'reloj'];
  const titulos = catalogo.filter((o) => o.titulo !== 'Sin título').map((o) => o.titulo);
  const item = (t, i) => `<span class="marquee__item">${esc(t)}<svg><use href="#s-${syms[i % syms.length]}"/></svg></span>`;
  const set = titulos.map(item).join('');
  marquee.track.innerHTML = set + set;
  marquee.half = marquee.track.scrollWidth / 2;
  new IntersectionObserver(([en]) => (marquee.visible = en.isIntersecting)).observe($('.marquee'));
  if (!reduced) requestAnimationFrame(tickMarquee);
}

function tickMarquee() {
  if (marquee.visible) {
    marquee.v *= 0.92;
    marquee.x -= 0.6 + marquee.v;
    if (marquee.x <= -marquee.half) marquee.x += marquee.half;
    if (marquee.x > 0) marquee.x -= marquee.half;
    marquee.track.style.transform = `translate3d(${marquee.x}px,0,0)`;
  }
  requestAnimationFrame(tickMarquee);
}

/* ==========================================================================
   Galería: filtros + layout justificado
   ========================================================================== */
const gallery = $('.gallery');
const filtersEl = $('.filters');
const ink = $('.filters__ink');
let filtro = 'todas';
let tiles = [];

function buildGallery() {
  const anios = catalogo.map((o) => o.anio).filter(Boolean);
  $('.obras__count').textContent = `${catalogo.length} obras · ${Math.min(...anios)}–${Math.max(...anios)}`;

  const opciones = [['todas', 'Todas', catalogo.length], ...Object.entries(series).map(([k, v]) => [k, v, catalogo.filter((o) => o.serie === k).length])];
  filtersEl.insertAdjacentHTML(
    'beforeend',
    opciones
      .filter(([, , n]) => n > 0)
      .map(([k, v, n]) => `<button class="filter" type="button" data-filter="${k}" aria-pressed="${k === filtro}">${esc(v)}<sup>${n}</sup></button>`)
      .join(''),
  );
  filtersEl.addEventListener('click', (e) => {
    const b = e.target.closest('.filter');
    if (b && b.dataset.filter !== filtro) setFilter(b.dataset.filter);
  });

  gallery.innerHTML = catalogo
    .map(
      (o) =>
        `<button class="tile" type="button" data-slug="${o.slug}" data-cursor="view" style="--c:${o.color}" aria-label="${esc(o.titulo)}${o.anio ? ', ' + o.anio : ''}">` +
          `<span class="tile__frame" style="background-image:url(${o.lqip})"><img alt="" loading="lazy" decoding="async">` +
          `<span class="tile__cap"><b>${esc(o.titulo)}</b><small>${esc(series[o.serie] || '')}${o.anio ? ' · ' + o.anio : ''}</small></span></span>` +
        `</button>`,
    )
    .join('');

  tiles = $$('.tile', gallery).map((el) => ({ el, obra: porSlug.get(el.dataset.slug), visible: true, img: $('img', el), frame: $('.tile__frame', el) }));

  gallery.addEventListener('click', (e) => {
    const t = e.target.closest('.tile');
    if (t) openViewer(t.dataset.slug, $('img', t));
  });

  if (finePointer && !reduced) {
    gallery.addEventListener('pointermove', (e) => {
      const t = e.target.closest('.tile');
      if (!t) return;
      const r = t.getBoundingClientRect();
      const f = $('.tile__frame', t);
      f.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 8}deg`);
      f.style.setProperty('--rx', `${-((e.clientY - r.top) / r.height - 0.5) * 8}deg`);
    });
    gallery.addEventListener('pointerout', (e) => {
      const t = e.target.closest('.tile');
      if (t && !t.contains(e.relatedTarget)) {
        const f = $('.tile__frame', t);
        f.style.removeProperty('--rx');
        f.style.removeProperty('--ry');
      }
    });
  }

  const imgReady = (img) =>
    img.complete && img.naturalWidth
      ? Promise.resolve()
      : new Promise((ok) => { img.addEventListener('load', ok, { once: true }); img.addEventListener('error', ok, { once: true }); });

  // Cuando una obra entra en pantalla se revela toda su fila junta, de izquierda a
  // derecha, y recién cuando sus imágenes cargaron (con un tope para no trabar).
  const revealRow = (t) => {
    const y = t.pos?.y;
    const row = tiles
      .filter((x) => x.visible && x.pos && !x.queued && Math.abs(x.pos.y - y) < 1)
      .sort((a, b) => a.pos.x - b.pos.x);
    row.forEach((x) => { x.queued = true; io.unobserve(x.el); });
    Promise.race([Promise.all(row.map((x) => imgReady(x.img))), wait(900)]).then(() =>
      row.forEach((x, k) => {
        x.el.style.setProperty('--rd', `${(k * 0.08).toFixed(2)}s`);
        x.el.classList.add('is-seen');
      }),
    );
  };
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const t = tiles.find((x) => x.el === en.target);
      if (t && !t.queued) revealRow(t);
    }),
    { rootMargin: '0px 0px -10% 0px' },
  );
  tiles.forEach((t) => io.observe(t.el));

  // Sin cargar imágenes todavía: el layout definitivo (tras las fuentes) asigna los srcset
  layout(false, false);
  requestAnimationFrame(() => requestAnimationFrame(() => gallery.classList.add('is-ready')));
  moveInk();
}

function layout(stagger, cargar = true) {
  const W = gallery.clientWidth;
  if (!W) return;
  const gap = W < 560 ? 8 : 14;
  const target = W < 560 ? 150 : W < 960 ? 220 : 310;
  const vis = tiles.filter((t) => t.visible);
  let row = [], sum = 0, y = 0;
  const flush = (last) => {
    let h = (W - gap * (row.length - 1)) / sum;
    if (last && h > target * 1.2) h = target;
    let x = 0;
    row.forEach((t) => { t.pos = { x, y, w: h * t.obra.ar, h }; x += h * t.obra.ar + gap; });
    y += h + gap;
    row = []; sum = 0;
  };
  vis.forEach((t) => {
    row.push(t);
    sum += t.obra.ar;
    if ((W - gap * (row.length - 1)) / sum <= target) flush(false);
  });
  if (row.length) flush(true);
  gallery.style.height = `${Math.max(0, y - gap)}px`;

  vis.forEach((t, i) => {
    const s = t.el.style;
    s.setProperty('--x', `${t.pos.x.toFixed(1)}px`);
    s.setProperty('--y', `${t.pos.y.toFixed(1)}px`);
    s.setProperty('--w', `${t.pos.w.toFixed(1)}px`);
    s.setProperty('--h', `${t.pos.h.toFixed(1)}px`);
    s.setProperty('--d', stagger ? `${Math.min(i * 0.022, 0.45).toFixed(3)}s` : '0s');
    t.img.sizes = `${Math.ceil(t.pos.w)}px`;
    if (cargar && !t.img.srcset) { t.img.srcset = srcset(t.obra.slug); t.img.src = src(t.obra.slug, 960); }
    t.el.classList.remove('is-out');
    t.el.tabIndex = 0;
  });
  tiles.filter((t) => !t.visible).forEach((t) => {
    t.el.style.setProperty('--d', '0s');
    t.el.classList.add('is-out');
    t.el.tabIndex = -1;
  });
}

function setFilter(k) {
  filtro = k;
  $$('.filter', filtersEl).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === k)));
  moveInk();
  tiles.forEach((t) => (t.visible = k === 'todas' || t.obra.serie === k));
  layout(true);
  // Las obras que entran vuelven a revelarse
  tiles.filter((t) => t.visible).forEach((t) => t.el.classList.add('is-seen'));
  const top = gallery.getBoundingClientRect().top;
  if (top < -40) scrollTo({ top: scrollY + top - 180, behavior: reduced ? 'instant' : 'smooth' });
}

function moveInk() {
  const b = $(`.filter[data-filter="${filtro}"]`, filtersEl);
  if (!b) return;
  ink.style.width = `${b.offsetWidth}px`;
  ink.style.height = `${b.offsetHeight}px`;
  ink.style.transform = `translate(${b.offsetLeft}px, ${b.offsetTop}px)`;
}

/* ==========================================================================
   Visor
   ========================================================================== */
const viewer = {
  el: $('.viewer'),
  bg: $('.viewer__bg'),
  stage: $('.viewer__stage'),
  frame: $('.viewer__frame'),
  img: $('.viewer__img'),
  loupe: $('.loupe'),
  loupeBtn: $('.viewer__loupe-btn'),
  open: false,
  busy: false,
  pushed: false,
  list: catalogo,
  idx: 0,
  hidden: null,
  returnFocus: null,
};

function fitViewer(o) {
  const cs = getComputedStyle(viewer.stage);
  const maxW = viewer.stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  const maxH = viewer.stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  let w = maxW, h = w / o.ar;
  if (h > maxH) { h = maxH; w = h * o.ar; }
  viewer.img.style.setProperty('--vw', `${Math.round(w)}px`);
  viewer.img.style.setProperty('--vh', `${Math.round(h)}px`);
}

function fillInfo(o) {
  const n = viewer.list.length;
  $('.viewer__count').innerHTML = `<b>${String(viewer.idx + 1).padStart(2, '0')}</b> / ${String(n).padStart(2, '0')}`;
  $('.viewer__title').textContent = o.titulo;
  const meta = [
    ['Año', o.anio],
    ['Técnica', o.tecnica],
    ['Medidas', medidas(o)],
    ['Serie', series[o.serie]],
  ].filter(([, v]) => v);
  $('.viewer__meta').innerHTML = meta.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  $('.viewer__desc').textContent = o.descripcion || '';
  const a = $('.viewer__saatchi');
  if (o.saatchi) { a.href = saatchiUrl(o.saatchi); a.hidden = false; } else { a.hidden = true; }
  viewer.el.style.setProperty('--tint', o.color);
  viewer.img.alt = `${o.titulo}${o.anio ? ', ' + o.anio : ''} — Marcelo Zurita`;
}

function setImage(o, preview) {
  const img = viewer.img;
  img.src = preview || src(o.slug, 960);
  const hi = new Image();
  hi.src = src(o.slug, 1600);
  hi.onload = () => { if (viewer.list[viewer.idx] === o) img.src = hi.src; };
}

/** Rectángulo (en el sistema del frame) que cubre `r0` con el aspecto de `r1`, + recorte. */
function coverTransform(r0, r1) {
  const s = Math.max(r0.width / r1.width, r0.height / r1.height);
  const tx = r0.left + r0.width / 2 - (r1.left + (r1.width * s) / 2);
  const ty = r0.top + r0.height / 2 - (r1.top + (r1.height * s) / 2);
  const ix = ((r1.width * s - r0.width) / 2 / s / r1.width) * 100;
  const iy = ((r1.height * s - r0.height) / 2 / s / r1.height) * 100;
  return { transform: `translate(${tx}px, ${ty}px) scale(${s})`, clipPath: `inset(${iy}% ${ix}% ${iy}% ${ix}%)` };
}

function hideSource(el) {
  if (viewer.hidden) viewer.hidden.style.visibility = '';
  viewer.hidden = el;
  if (el) el.style.visibility = 'hidden';
}

function sourceFor(slug) {
  const t = tiles.find((x) => x.obra.slug === slug && x.visible);
  const candidates = [t?.img, $(`.hero__cell[data-slug="${slug}"] img`)].filter(Boolean);
  return candidates.find((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.bottom > 0 && r.top < innerHeight;
  });
}

async function openViewer(slug, fromImg, { push = true } = {}) {
  const o = porSlug.get(slug);
  if (!o || viewer.open || viewer.busy) return;
  viewer.busy = true;
  viewer.open = true;
  viewer.returnFocus = document.activeElement;

  const visibles = tiles.filter((t) => t.visible).map((t) => t.obra);
  viewer.list = visibles.includes(o) ? visibles : catalogo;
  viewer.idx = viewer.list.indexOf(o);

  fillInfo(o);
  viewer.el.hidden = false;
  html.classList.add('is-locked');
  fitViewer(o);
  setImage(o, fromImg?.currentSrc);

  if (push) { history.pushState({ obra: slug }, '', '#obra/' + slug); viewer.pushed = true; }

  const bgIn = viewer.bg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: reduced ? 1 : 600, easing: EASE_OUT });
  let anim;
  if (fromImg && !reduced) {
    const r0 = fromImg.getBoundingClientRect();
    const r1 = viewer.frame.getBoundingClientRect();
    const start = coverTransform(r0, r1);
    viewer.frame.style.transformOrigin = '0 0';
    hideSource(fromImg);
    anim = viewer.frame.animate([start, { transform: 'none', clipPath: 'inset(0% 0% 0% 0%)' }], { duration: 1000, easing: EASE });
  } else {
    anim = viewer.frame.animate([{ opacity: 0, transform: 'scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: reduced ? 1 : 700, easing: EASE_OUT });
  }
  requestAnimationFrame(() => viewer.el.classList.add('is-open'));
  await Promise.all([anim.finished, bgIn.finished]).catch(() => {});
  $('.viewer__close').focus({ preventScroll: true });
  viewer.busy = false;
}

async function closeViewer({ fromPop = false } = {}) {
  if (!viewer.open) return;
  if (viewer.busy) await wait(300);
  viewer.busy = true;
  setLoupe(false);

  if (!fromPop) {
    if (viewer.pushed) { viewer.pushed = false; viewer.ignorePop = true; history.back(); }
    else history.replaceState(null, '', '#obras');
  }
  viewer.pushed = false;

  const o = viewer.list[viewer.idx];
  const target = sourceFor(o.slug);
  viewer.el.classList.remove('is-open');
  const bgOut = viewer.bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: reduced ? 1 : 650, easing: EASE, fill: 'forwards' });
  let anim;
  if (target && !reduced) {
    const r0 = target.getBoundingClientRect();
    const r1 = viewer.frame.getBoundingClientRect();
    hideSource(target);
    viewer.frame.style.transformOrigin = '0 0';
    anim = viewer.frame.animate([{ transform: 'none', clipPath: 'inset(0% 0% 0% 0%)' }, coverTransform(r0, r1)], { duration: 850, easing: EASE, fill: 'forwards' });
  } else {
    anim = viewer.frame.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(.94)' }], { duration: reduced ? 1 : 450, easing: EASE, fill: 'forwards' });
  }
  await Promise.all([anim.finished, bgOut.finished]).catch(() => {});

  hideSource(null);
  viewer.el.hidden = true;
  viewer.frame.getAnimations().forEach((a) => a.cancel());
  viewer.bg.getAnimations().forEach((a) => a.cancel());
  html.classList.remove('is-locked');
  viewer.open = false;
  viewer.busy = false;
  const back = viewer.returnFocus;
  if (back && document.contains(back) && back.focus) back.focus({ preventScroll: true });
}

async function step(dir) {
  if (!viewer.open || viewer.busy || viewer.list.length < 2) return;
  viewer.busy = true;
  setLoupe(false);
  const n = viewer.list.length;
  viewer.idx = (viewer.idx + dir + n) % n;
  const o = viewer.list[viewer.idx];

  viewer.el.classList.add('is-swapping');
  const outClip = dir > 0 ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)';
  const inClip = dir > 0 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)';
  await viewer.frame.animate(
    [{ clipPath: 'inset(0% 0% 0% 0%)', transform: 'none' }, { clipPath: outClip, transform: `translateX(${-dir * 50}px)` }],
    { duration: reduced ? 1 : 480, easing: EASE, fill: 'forwards' },
  ).finished;

  fillInfo(o);
  fitViewer(o);
  setImage(o);
  await decode(viewer.img);
  history.replaceState({ obra: o.slug }, '', '#obra/' + o.slug);

  viewer.frame.getAnimations().forEach((a) => a.cancel());
  viewer.el.classList.remove('is-swapping');
  await viewer.frame.animate(
    [{ clipPath: inClip, transform: `translateX(${dir * 50}px)` }, { clipPath: 'inset(0% 0% 0% 0%)', transform: 'none' }],
    { duration: reduced ? 1 : 800, easing: EASE_OUT },
  ).finished.catch(() => {});
  viewer.busy = false;
}

/* Lupa para ver la textura de la pintura */
const ZOOM = 2.6;
function setLoupe(on) {
  viewer.el.classList.toggle('is-loupe', on);
  viewer.loupeBtn.setAttribute('aria-pressed', String(on));
  if (!on) viewer.loupe.classList.remove('is-visible');
}
function moveLoupe(e) {
  if (!viewer.el.classList.contains('is-loupe')) return;
  const r = viewer.img.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  const inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
  viewer.loupe.classList.toggle('is-visible', inside);
  if (!inside) return;
  const L = viewer.loupe;
  L.style.transform = '';
  L.style.left = `${e.clientX}px`;
  L.style.top = `${e.clientY}px`;
  L.style.backgroundImage = `url("${viewer.img.currentSrc || viewer.img.src}")`;
  L.style.backgroundSize = `${r.width * ZOOM}px ${r.height * ZOOM}px`;
  L.style.backgroundPosition = `${-(x * ZOOM - 120)}px ${-(y * ZOOM - 120)}px`;
}

function bindViewer() {
  $('.viewer__close').addEventListener('click', () => closeViewer());
  $('.viewer__prev').addEventListener('click', () => step(-1));
  $('.viewer__next').addEventListener('click', () => step(1));
  viewer.loupeBtn.addEventListener('click', () => setLoupe(!viewer.el.classList.contains('is-loupe')));
  viewer.stage.addEventListener('pointermove', moveLoupe);
  viewer.stage.addEventListener('pointerleave', () => viewer.loupe.classList.remove('is-visible'));
  viewer.stage.addEventListener('click', (e) => {
    if (e.target === viewer.stage && !viewer.el.classList.contains('is-loupe')) closeViewer();
  });

  // Deslizar en pantallas táctiles
  let sx = 0, sy = 0, tracking = false;
  viewer.stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    tracking = true; sx = e.clientX; sy = e.clientY;
  });
  viewer.stage.addEventListener('pointerup', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) step(dx < 0 ? 1 : -1);
  });
  viewer.stage.addEventListener('pointercancel', () => (tracking = false));

  document.addEventListener('keydown', (e) => {
    if (!viewer.open) return;
    if (e.key === 'Escape') { e.preventDefault(); closeViewer(); }
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === 'Tab') {
      const f = $$('button, a[href]:not([hidden])', viewer.el).filter((el) => el.offsetParent !== null);
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    }
  });

  addEventListener('popstate', () => {
    if (viewer.ignorePop) { viewer.ignorePop = false; return; }
    const m = location.hash.match(/^#obra\/(.+)$/);
    if (m && !viewer.open) openViewer(decodeURIComponent(m[1]), sourceFor(decodeURIComponent(m[1])), { push: false });
    else if (!m && viewer.open) closeViewer({ fromPop: true });
  });
}

/* ==========================================================================
   Scroll: pared, progreso, navegación, textos ligados al scroll
   ========================================================================== */
const nav = $('.nav');
const progress = $('.progress');
const statement = $('.statement');
const timeline = $('.timeline');
const footerFirma = $('.footer__firma');
let words = [];
let lineas = [];
let walls = [];

/** "Pared" de la página: la da la última sección cuyo borde superior pasó su punto de
    disparo (data-wall-at, fracción de la pantalla; 0.55 por defecto). */
function updateWall() {
  let actual = walls[0];
  for (const el of walls) {
    if (el.getBoundingClientRect().top <= innerHeight * parseFloat(el.dataset.wallAt || '0.55')) actual = el;
  }
  if (actual && document.body.dataset.wall !== actual.dataset.wall) document.body.dataset.wall = actual.dataset.wall;
}
let lastY = scrollY;

function prepStatement() {
  const hl = /^(línea|firme|planos|color|Escuela|Sur|pretexto|pintura|sur|Chile)$/;
  const texto = statement.textContent.trim().replace(/\s+/g, ' ');
  statement.innerHTML = texto
    .split(' ')
    .map((w) => {
      const limpio = w.replace(/[.,;:—–()]/g, '');
      return `<span class="w${hl.test(limpio) ? ' hl' : ''}">${esc(w)}</span>`;
    })
    .join(' ');
  words = $$('.w', statement);
  measureStatement();
}

/** Posición de cada palabra dentro del texto y su orden dentro de la línea (para el barrido). */
function measureStatement() {
  // offsetTop (y no getBoundingClientRect) porque ignora el desplazamiento de las palabras aún ocultas
  lineas = [];
  let linea = null;
  words.forEach((w) => {
    const t = w.offsetParent === statement.offsetParent ? w.offsetTop - statement.offsetTop : w.getBoundingClientRect().top - statement.getBoundingClientRect().top;
    if (!linea || Math.abs(t - linea.top) > 4) { linea = { top: t, words: [] }; lineas.push(linea); }
    w.style.setProperty('--k', linea.words.length);
    linea.words.push(w);
  });
  // Una línea ya revelada sigue revelada (p. ej. después de un resize)
  lineas.forEach((l) => (l.on = l.words.every((w) => w.classList.contains('is-on'))));
}

/** Revela cada línea poco después de que asoma por abajo. Una vez revelada, queda así. */
function revealStatement() {
  if (!lineas.length) return;
  const top = statement.getBoundingClientRect().top;
  const umbral = innerHeight * 0.9;
  lineas.forEach((l) => {
    if (!l.on && top + l.top < umbral) {
      l.on = true;
      l.words.forEach((w) => w.classList.add('is-on'));
    }
  });
}

/* Citas del artista, en rotación. Los textos vienen de `cita` en obras.js (textuales). */
function buildQuotes() {
  const box = $('.quote');
  const con = catalogo.filter((o) => o.cita);
  if (!box || con.length < 2) return;

  const stack = $('.quote__stack', box);
  const count = $('.quote__count', box);
  const bar = $('.quote__bar i', box);
  const fmt = (c) => (/^[a-záéíóúñ]/.test(c) ? '…' + c : c);
  stack.innerHTML = con
    .map(
      (o) =>
        `<blockquote class="quote__item"><p>“${esc(fmt(o.cita))}”</p>` +
        `<footer>Zurita, sobre <cite><button type="button" data-slug="${o.slug}">${esc(o.titulo)}</button></cite></footer></blockquote>`,
    )
    .join('');
  const items = $$('.quote__item', stack);
  $('.quote__controls', box).hidden = false;

  let i = Math.max(0, con.findIndex((o) => o.slug === 'el-gran-molinillo'));
  let busy = false;
  const flags = { hover: false, focus: false, offscreen: true };

  const show = (n) => {
    items.forEach((el, k) => {
      el.classList.toggle('is-active', k === n);
      el.setAttribute('aria-hidden', String(k !== n));
    });
    count.textContent = `${String(n + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')}`;
  };
  const restartBar = () => {
    if (reduced) return;
    box.classList.remove('is-playing');
    void bar.offsetWidth;
    box.classList.add('is-playing');
  };
  const syncPause = () => box.classList.toggle('is-paused', flags.hover || flags.focus || flags.offscreen);

  async function go(dir, manual) {
    if (busy) return;
    busy = true;
    const prev = items[i];
    i = (i + dir + items.length) % items.length;
    const next = items[i];
    stack.setAttribute('aria-live', manual ? 'polite' : 'off');
    if (!reduced) {
      await prev.animate(
        [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-18px)' }],
        { duration: 420, easing: EASE, fill: 'forwards' },
      ).finished;
    }
    show(i);
    prev.getAnimations().forEach((a) => a.cancel());
    if (!reduced) {
      box.animate([{ '--line': 0 }, { '--line': 1 }], { duration: 900, easing: EASE });
      $('p', next).animate(
        [{ opacity: 0, transform: 'translateY(26px)', clipPath: 'inset(0 0 100% 0)' }, { opacity: 1, transform: 'none', clipPath: 'inset(0 0 0 0)' }],
        { duration: 950, easing: EASE_OUT },
      );
      $('footer', next).animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 220, easing: EASE_OUT, fill: 'backwards' });
    }
    restartBar();
    busy = false;
  }

  show(i);
  restartBar();
  syncPause();
  bar.addEventListener('animationend', () => go(1, false));
  $('.quote__next', box).addEventListener('click', () => go(1, true));
  stack.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-slug]');
    if (b) openViewer(b.dataset.slug);
  });
  box.addEventListener('pointerenter', () => { flags.hover = true; syncPause(); });
  box.addEventListener('pointerleave', () => { flags.hover = false; syncPause(); });
  // Solo el foco de teclado pausa; un clic en "siguiente" no debe frenar la rotación
  box.addEventListener('focusin', (e) => { flags.focus = e.target.matches(':focus-visible'); syncPause(); });
  box.addEventListener('focusout', (e) => { if (!box.contains(e.relatedTarget)) { flags.focus = false; syncPause(); } });
  new IntersectionObserver(([en]) => { flags.offscreen = !en.isIntersecting; syncPause(); }).observe(box);
}

function progressOf(el, start, end) {
  // 0 cuando el tope del elemento está en `start`·vh, 1 cuando su base llega a `end`·vh
  const r = el.getBoundingClientRect();
  const a = r.top - innerHeight * start;
  const total = r.height + innerHeight * (start - end);
  return clamp(-a / total, 0, 1);
}

function onScroll() {
  const y = scrollY;
  const dy = y - lastY;
  lastY = y;

  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

  nav.classList.toggle('is-solid', y > 40);
  if (!viewer.open) nav.classList.toggle('is-hidden', dy > 4 && y > innerHeight * 0.6);
  if (dy < -4) nav.classList.remove('is-hidden');

  marquee.v = clamp(marquee.v + Math.abs(dy) * 0.08, 0, 24) * Math.sign(dy || 1);

  revealStatement();
  updateWall();

  const tp = progressOf(timeline, 0.85, 0.7);
  timeline.style.setProperty('--p', tp.toFixed(3));
  const items = timeline.children;
  for (let i = 0; i < items.length; i++) items[i].classList.toggle('is-on', tp >= i / (items.length - 1) - 0.02 || tp > 0.98);

  const fr = footerFirma.getBoundingClientRect();
  setFirma(footerFirma, clamp((innerHeight - fr.top) / (fr.height * 1.1), 0, 1));
}

function observeSections() {
  walls = $$('[data-wall]').filter((el) => el !== document.body);
  updateWall();

  const links = $$('.nav__links a');
  const io2 = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      links.forEach((a) => a.classList.toggle('is-current', a.dataset.goto === en.target.id));
    }),
    { rootMargin: '-45% 0px -50% 0px' },
  );
  $$('main > section[id]').forEach((s) => io2.observe(s));

  const reveal = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      reveal.unobserve(en.target);
    }),
    { threshold: 0.18 },
  );
  $$('.reveal-up, .palette, .retrato').forEach((el) => reveal.observe(el));
  $$('.swatch').forEach((s, i) => s.style.setProperty('--i', i));
  $$('.retrato__cell').forEach((c, i) => c.style.setProperty('--i', i));
}

/* ==========================================================================
   Detalles: cursor, ondas en botones, paleta táctil
   ========================================================================== */
function bindCursor() {
  if (!finePointer || reduced) return;
  const c = $('.cursor');
  let x = innerWidth / 2, y = innerHeight / 2, cx = x, cy = y;
  addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; c.classList.add('is-visible'); }, { passive: true });
  document.addEventListener('pointerleave', () => c.classList.remove('is-visible'));
  document.addEventListener('pointerover', (e) => {
    const t = e.target;
    const view = t.closest('[data-cursor="view"]') && !viewer.open;
    c.classList.toggle('is-view', !!view);
    c.classList.toggle('is-link', !view && !!t.closest('a, button'));
  });
  (function loop() {
    cx += (x - cx) * 0.2;
    cy += (y - cy) * 0.2;
    c.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    requestAnimationFrame(loop);
  })();
}

function bindRipples() {
  if (reduced) return;
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.btn');
    if (!b) return;
    const r = b.getBoundingClientRect();
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.left = `${e.clientX - r.left}px`;
    s.style.top = `${e.clientY - r.top}px`;
    b.appendChild(s);
    const k = Math.hypot(r.width, r.height) / 6;
    s.animate([{ transform: 'scale(0)', opacity: 0.9 }, { transform: `scale(${k})`, opacity: 0 }], { duration: 750, easing: EASE_OUT }).onfinish = () => s.remove();
  });
}

function bindPalette() {
  $$('.swatch').forEach((s) =>
    s.addEventListener('click', () => {
      const open = s.classList.contains('is-open');
      $$('.swatch').forEach((x) => x.classList.remove('is-open'));
      if (!open) s.classList.add('is-open');
    }),
  );
}

/* Formulario de contacto.
   Por ahora es de muestra: valida, simula el envío y confirma, pero no manda nada.
   Para que envíe de verdad, reemplazar la espera en `enviar` por un fetch a un
   servicio de email (un Worker propio, Formspree, etc.). */
function bindForm() {
  const form = $('.form');
  const sent = $('.sent');
  const panel = $('.contacto__panel');
  if (!form) return;
  const fields = $$('.field', form);
  const control = (f) => $('input, textarea', f);

  const validate = (f) => {
    const el = control(f);
    const ok = el.checkValidity() && (!el.required || el.value.trim() !== '');
    f.classList.toggle('is-invalid', !ok);
    el.setAttribute('aria-invalid', String(!ok));
    return ok;
  };
  fields.forEach((f) => {
    const el = control(f);
    const err = $('.field__error', f);
    if (err) { err.id = `${el.id}-error`; el.setAttribute('aria-describedby', err.id); }
    el.addEventListener('blur', () => { if (el.value) validate(f); });
    el.addEventListener('input', () => { if (f.classList.contains('is-invalid')) validate(f); });
  });

  const swap = async (from, to) => {
    panel.style.minHeight = `${panel.offsetHeight}px`;
    if (!reduced) {
      await from.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-16px)' }], { duration: 350, easing: EASE, fill: 'forwards' }).finished;
    }
    from.hidden = true;
    from.getAnimations().forEach((a) => a.cancel());
    to.hidden = false;
    if (!reduced) {
      to.animate(
        [{ opacity: 0, transform: 'translateY(24px)', clipPath: 'inset(0 0 100% 0)' }, { opacity: 1, transform: 'none', clipPath: 'inset(0 0 0 0)' }],
        { duration: 800, easing: EASE_OUT },
      );
    }
    panel.style.minHeight = '';
  };

  const enviar = async () => wait(900);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const invalidos = fields.filter((f) => !validate(f));
    if (invalidos.length) { control(invalidos[0]).focus(); return; }
    const btn = $('.form__submit', form);
    btn.classList.add('is-sending');
    $('span', btn).textContent = 'Enviando…';
    await enviar(new FormData(form));
    const nombre = form.elements.nombre.value.trim().split(/\s+/)[0];
    $('.sent__name', sent).textContent = nombre ? `, ${nombre}` : '';
    await swap(form, sent);
    form.reset();
    btn.classList.remove('is-sending');
    $('span', btn).textContent = 'Enviar mensaje';
    sent.focus({ preventScroll: true });
  });

  $('.sent__again', sent).addEventListener('click', async () => {
    await swap(sent, form);
    control(fields[0]).focus({ preventScroll: true });
  });
}

/* ==========================================================================
   Arranque
   ========================================================================== */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

prepFirmas();
buildHero();
buildMarquee();
buildGallery();
prepStatement();
buildQuotes();
observeSections();
bindViewer();
bindCursor();
bindRipples();
bindPalette();
bindForm();
$('.footer__year').textContent = new Date().getFullYear();

let raf = 0;
addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; onScroll(); }); }, { passive: true });
let rt = 0;
addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => {
    layout(false);
    moveInk();
    measureStatement();
    marquee.half = marquee.track.scrollWidth / 2;
    if (viewer.open) fitViewer(viewer.list[viewer.idx]);
    onScroll();
  }, 120);
});
onScroll();

(async () => {
  await Promise.race([document.fonts?.ready, wait(1500)]);
  layout(false);
  moveInk();
  measureStatement();
  onScroll();
  marquee.half = marquee.track.scrollWidth / 2;
  await intro();
  hero.classList.add('is-in');

  const m = location.hash.match(/^#obra\/(.+)$/);
  if (m) {
    const slug = decodeURIComponent(m[1]);
    if (porSlug.has(slug)) {
      jumpTo('obras');
      history.replaceState({ obra: slug }, '', '#obra/' + slug);
      await wait(100);
      openViewer(slug, sourceFor(slug), { push: false });
    }
  } else if (location.hash.length > 1) {
    const id = location.hash.slice(1);
    if (document.getElementById(id)) jumpTo(id);
  }
})();

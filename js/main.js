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
   Cortina (intro y navegación entre secciones)
   ========================================================================== */
const wipe = $('.wipe');
const wipeSpans = $$('.wipe > span');
const wipeLabel = $('.wipe__label');
const wipeFirma = $('.wipe__firma');
const wipeText = $('.wipe__text');
let wiping = false;

async function intro() {
  if (reduced) { html.classList.remove('intro-pending'); return; }
  wiping = true;
  const repeat = sget('zurita-intro') === '1';
  sset('zurita-intro', '1');

  wipe.classList.add('is-active');
  wipeFirma.style.display = '';
  wipeText.textContent = '';
  wipeSpans.forEach((s) => (s.style.transform = 'none'));
  html.classList.remove('intro-pending');

  wipeLabel.style.opacity = 1;
  await wipeFirma.querySelector('path').animate(
    [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
    { duration: repeat ? 600 : 1500, easing: EASE, fill: 'forwards' },
  ).finished;
  await wait(repeat ? 80 : 280);

  wipeLabel.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-40px)' }], { duration: 500, easing: EASE, fill: 'forwards' });
  await Promise.all(
    wipeSpans.map((s, i) =>
      s.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-101%)' }], {
        duration: 900, delay: 120 + i * 70, easing: EASE, fill: 'forwards',
      }).finished,
    ),
  );
  resetWipe();
  wiping = false;
}

function resetWipe() {
  wipeSpans.forEach((s) => { s.getAnimations().forEach((a) => a.cancel()); s.style.transform = ''; });
  wipeLabel.getAnimations().forEach((a) => a.cancel());
  wipeFirma.querySelector('path').getAnimations().forEach((a) => a.cancel());
  wipeLabel.style.opacity = '';
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
  tiles.forEach((t) => {
    const done = () => t.img.classList.add('is-loaded');
    t.img.addEventListener('load', done, { once: true });
  });

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

  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const t = en.target;
      const x = parseFloat(t.style.getPropertyValue('--x')) || 0;
      t.style.setProperty('--rd', `${((x / gallery.clientWidth) * 0.3).toFixed(2)}s`);
      t.classList.add('is-seen');
      io.unobserve(t);
    }),
    { rootMargin: '0px 0px -8% 0px' },
  );
  tiles.forEach((t) => io.observe(t.el));

  layout(false);
  requestAnimationFrame(() => requestAnimationFrame(() => gallery.classList.add('is-ready')));
  moveInk();
}

function layout(stagger) {
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
    if (!t.img.srcset) { t.img.srcset = srcset(t.obra.slug); t.img.src = src(t.obra.slug, 960); }
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

  if (words.length) {
    const p = progressOf(statement, 0.85, 0.35);
    const on = Math.round(p * words.length);
    words.forEach((w, i) => w.classList.toggle('is-on', i < on));
  }

  const tp = progressOf(timeline, 0.85, 0.7);
  timeline.style.setProperty('--p', tp.toFixed(3));
  const items = timeline.children;
  for (let i = 0; i < items.length; i++) items[i].classList.toggle('is-on', tp >= i / (items.length - 1) - 0.02 || tp > 0.98);

  const fr = footerFirma.getBoundingClientRect();
  footerFirma.style.setProperty('--draw', (1 - clamp((innerHeight - fr.top) / (fr.height * 1.1), 0, 1)).toFixed(3));
}

function observeSections() {
  const walls = $$('[data-wall]').filter((el) => el !== document.body);
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => { if (en.isIntersecting) document.body.dataset.wall = en.target.dataset.wall; }),
    { rootMargin: '-50% 0px -50% 0px' },
  );
  walls.forEach((el) => io.observe(el));

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

/* ==========================================================================
   Arranque
   ========================================================================== */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

buildHero();
buildMarquee();
buildGallery();
prepStatement();
observeSections();
bindViewer();
bindCursor();
bindRipples();
bindPalette();
$('.footer__year').textContent = new Date().getFullYear();

let raf = 0;
addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; onScroll(); }); }, { passive: true });
let rt = 0;
addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => {
    layout(false);
    moveInk();
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

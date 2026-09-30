// Worker del sitio: sirve los archivos estáticos y atiende el formulario de contacto.
//
// POST /api/contacto  { nombre, email, asunto?, mensaje, sitio? }
//   → envía un mail a la casilla configurada en wrangler.jsonc (send_email → CORREO)
//     usando Cloudflare Email Routing. "Responder" en el mail le contesta a quien escribió.
//
// Requiere en el dashboard de Cloudflare: Email Routing activo en marcelozurita.com y la
// casilla de destino verificada (ver README).

import { EmailMessage } from 'cloudflare:email';

const REMITENTE = 'formulario@marcelozurita.com';
const ORIGENES = /^https?:\/\/((www\.)?marcelozurita\.com|[\w-]+\.[\w-]+\.workers\.dev|localhost(:\d+)?|127\.0\.0\.1(:\d+)?)$/;
const EMAIL = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/;
const LIMITES = { nombre: 120, email: 200, asunto: 200, mensaje: 5000 };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/contacto') return contacto(request, env);
    return env.ASSETS.fetch(request);
  },
};

async function contacto(request, env) {
  if (request.method !== 'POST') return json({ ok: false, error: 'Método no permitido' }, 405);

  // Solo desde el propio sitio (frena envíos automáticos desde otras páginas)
  const origen = request.headers.get('Origin') || '';
  if (!ORIGENES.test(origen)) return json({ ok: false, error: 'Origen no permitido' }, 403);

  let datos;
  try {
    datos = await request.json();
  } catch {
    return json({ ok: false, error: 'Datos inválidos' }, 400);
  }

  // Campo trampa: invisible para las personas, los bots lo completan. Se simula éxito.
  if (String(datos.sitio || '').trim()) return json({ ok: true });

  const campo = (k) => String(datos[k] ?? '').trim().slice(0, LIMITES[k]);
  const nombre = campo('nombre'), email = campo('email'), asunto = campo('asunto'), mensaje = campo('mensaje');
  if (!nombre || !mensaje || !EMAIL.test(email)) return json({ ok: false, error: 'Faltan datos o el email no es válido' }, 400);

  const titulo = `Consulta web: ${asunto || nombre}`;
  const cuerpo = [
    `Nombre: ${nombre}`,
    `Email: ${email}`,
    asunto ? `Asunto: ${asunto}` : null,
    '',
    mensaje,
    '',
    '—',
    'Enviado desde el formulario de contacto de marcelozurita.com.',
    'Para responder, usá "Responder": le llega a quien escribió.',
  ].filter((l) => l !== null).join('\r\n');

  const crudo = armarMail({ de: REMITENTE, nombreDe: 'Formulario marcelozurita.com', para: env.DESTINO, responderA: email, titulo, cuerpo });

  try {
    await env.CORREO.send(new EmailMessage(REMITENTE, env.DESTINO, crudo));
  } catch (e) {
    console.error('No se pudo enviar el mail:', e?.message || e);
    return json({ ok: false, error: 'No se pudo enviar el mensaje' }, 502);
  }
  return json({ ok: true });
}

/** Mail en texto plano (RFC 5322), con encabezados y cuerpo en UTF-8. */
function armarMail({ de, nombreDe, para, responderA, titulo, cuerpo }) {
  const b64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
  const enc = (s) => `=?UTF-8?B?${b64(s)}?=`;
  const cuerpo64 = b64(cuerpo).replace(/.{76}/g, '$&\r\n');
  return [
    `From: ${enc(nombreDe)} <${de}>`,
    `To: <${para}>`,
    `Reply-To: <${responderA}>`,
    `Subject: ${enc(titulo)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@marcelozurita.com>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    cuerpo64,
  ].join('\r\n');
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

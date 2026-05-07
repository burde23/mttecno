// functions/api/orders.js
// POST /api/orders → guarda una nueva orden en D1
// ─────────────────────────────────────────────────

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();

    // ── Validación básica ──────────────────────────
    const required = ['nombre','apellido','email','telefono','calle','cp','ciudad','provincia','items'];
    for (const field of required) {
      if (!body[field] || (Array.isArray(body[field]) && body[field].length === 0)) {
        return json({ ok: false, error: `Campo requerido: ${field}` }, 400);
      }
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return json({ ok: false, error: 'El carrito está vacío' }, 400);
    }

    // ── Calcular totales ───────────────────────────
    const subtotal   = body.items.reduce((s, i) => s + (i.ars * i.qty), 0);
    const item_count = body.items.reduce((s, i) => s + i.qty, 0);

    // Sanitizar items: solo guardamos los campos necesarios
    const items = body.items.map(i => ({
      id:     i.id,
      name:   i.name,
      stor:   i.stor   || null,
      ars:    i.ars,
      qty:    i.qty,
      modelo: i.modelo || i.compat || null,
    }));

    // ── Insertar en D1 ─────────────────────────────
    const stmt = env.DB.prepare(`
      INSERT INTO orders
        (nombre, apellido, email, telefono,
         calle, cp, ciudad, provincia, notas,
         subtotal, items_json, item_count, status)
      VALUES
        (?, ?, ?, ?,
         ?, ?, ?, ?, ?,
         ?, ?, ?, 'pendiente')
    `);

    const result = await stmt.bind(
      body.nombre.trim(),
      body.apellido.trim(),
      body.email.trim().toLowerCase(),
      body.telefono.trim(),
      body.calle.trim(),
      body.cp.trim(),
      body.ciudad.trim(),
      body.provincia,
      (body.notas || '').trim(),
      subtotal,
      JSON.stringify(items),
      item_count,
    ).run();

    const orderId = result.meta?.last_row_id;

    return json({
      ok:       true,
      order_id: orderId,
      subtotal,
      message:  '¡Orden registrada! Redirigiendo a MercadoPago…',
    }, 201);

  } catch (err) {
    console.error('[POST /api/orders]', err);
    return json({ ok: false, error: err.message }, 500);
  }
}

// OPTIONS para CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

// ── helpers ───────────────────────────────────────
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}

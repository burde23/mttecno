// functions/api/admin/products.js
// GET    /api/admin/products        → todos los productos
// POST   /api/admin/products        → crear producto
// PUT    /api/admin/products        → actualizar producto
// DELETE /api/admin/products?id=x          → soft delete (desactivar)
// DELETE /api/admin/products?id=x&hard=1   → hard delete (eliminar de DB)

export async function onRequestGet({ request, env }) {
  if (!isAuthorized(request, env)) return json({ ok: false, error: 'No autorizado' }, 401);
  try {
    const { results } = await env.DB.prepare('SELECT * FROM products ORDER BY id ASC').all();
    return json({ ok: true, products: results.map(p => ({ ...p, low: p.low===1, active: p.active===1, modelos: p.modelos ? JSON.parse(p.modelos) : null })) });
  } catch (err) { return json({ ok: false, error: err.message }, 500); }
}

export async function onRequestPost({ request, env }) {
  if (!isAuthorized(request, env)) return json({ ok: false, error: 'No autorizado' }, 401);
  try {
    const b = await request.json();
    if (!b.name || !b.cat) return json({ ok: false, error: 'name y cat son requeridos' }, 400);
    const result = await env.DB.prepare(`
      INSERT INTO products
        (name, stor, ars, ars_old, usd, badge, btxt, stock_qty, low, stock_label, color, cat, url, img, active, offer_end, modelos)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      b.name.trim(), (b.stor||'').trim(),
      b.ars  ? parseInt(b.ars)     : null,
      b.ars_old ? parseInt(b.ars_old) : null,
      b.usd  ? parseInt(b.usd)     : null,
      b.badge||'b-new', (b.btxt||'').trim(),
      parseInt(b.stock_qty||0), b.low?1:0,
      (b.stock_label||'En stock').trim(), (b.color||'#1d1d1f').trim(),
      b.cat.trim(), (b.url||'').trim(),
      b.img ? b.img.trim() : null,
      b.active===false ? 0 : 1,
      b.offer_end || null,
      b.modelos ? JSON.stringify(b.modelos) : null,
    ).run();
    return json({ ok: true, id: result.meta?.last_row_id }, 201);
  } catch (err) { return json({ ok: false, error: err.message }, 500); }
}

export async function onRequestPut({ request, env }) {
  if (!isAuthorized(request, env)) return json({ ok: false, error: 'No autorizado' }, 401);
  try {
    const b = await request.json();
    if (!b.id) return json({ ok: false, error: 'id requerido' }, 400);
    await env.DB.prepare(`
      UPDATE products SET
        name=?, stor=?, ars=?, ars_old=?, usd=?, badge=?, btxt=?,
        stock_qty=?, low=?, stock_label=?, color=?, cat=?, url=?, img=?,
        active=?, offer_end=?, modelos=?, updated_at=datetime('now')
      WHERE id=?
    `).bind(
      b.name.trim(), (b.stor||'').trim(),
      b.ars     ? parseInt(b.ars)     : null,
      b.ars_old ? parseInt(b.ars_old) : null,
      b.usd     ? parseInt(b.usd)     : null,
      b.badge||'b-new', (b.btxt||'').trim(),
      parseInt(b.stock_qty||0), b.low?1:0,
      (b.stock_label||'En stock').trim(), (b.color||'#1d1d1f').trim(),
      b.cat.trim(), (b.url||'').trim(),
      b.img ? b.img.trim() : null,
      b.active===false ? 0 : 1,
      b.offer_end || null,
      b.modelos ? JSON.stringify(b.modelos) : null,
      b.id,
    ).run();
    return json({ ok: true, message: `Producto #${b.id} actualizado` });
  } catch (err) { return json({ ok: false, error: err.message }, 500); }
}

export async function onRequestDelete({ request, env }) {
  if (!isAuthorized(request, env)) return json({ ok: false, error: 'No autorizado' }, 401);
  try {
    const url  = new URL(request.url);
    const id   = parseInt(url.searchParams.get('id'));
    const hard = url.searchParams.get('hard') === '1';
    if (!id || isNaN(id)) return json({ ok: false, error: 'ID inválido' }, 400);
    if (hard) {
      await env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
      return json({ ok: true, message: `Producto #${id} eliminado permanentemente` });
    } else {
      await env.DB.prepare("UPDATE products SET active=0, updated_at=datetime('now') WHERE id=?").bind(id).run();
      return json({ ok: true, message: `Producto #${id} desactivado` });
    }
  } catch (err) { return json({ ok: false, error: err.message }, 500); }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function isAuthorized(r, env) {
  const s = env.ADMIN_SECRET; if (!s) return false;
  return r.headers.get('x-admin-secret') === s;
}
function corsHeaders() {
  return { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers':'Content-Type,x-admin-secret' };
}
function json(data, status=200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type':'application/json', ...corsHeaders() } });
}

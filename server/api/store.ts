import { Router, Request, Response } from 'express';
import { query, pool } from '../db/index.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { createRateLimiter } from '../rateLimit.js';
import { sendEmail, orderConfirmationEmail, orderStatusEmail } from '../email.js';

export const storeRouter = Router();

/** 10 commandes / 15 min / compte : le limiteur global (120/min/IP) laissait
 *  un compte authentifié assécher le stock ou verrouiller les lignes FOR UPDATE. */
const orderRateLimit = createRateLimiter({
  windowMs: 15 * 60_000,
  limit: 10,
  message: 'طلبات كثيرة جداً. يرجى المحاولة لاحقاً.',
  keyPrefix: 'orders',
  keyFn: (req) => req.user?.id ?? req.ip ?? 'unknown',
});

const mapProduct = (row: any) => ({
  id: row.id, name: row.name, description: row.description,
  price: Number(row.price), imageUrl: row.image_url, category: row.category,
  stock: Number(row.stock), active: Boolean(row.active),
  createdAt: new Date(row.created_at).getTime(),
});

const mapOrder = (row: any) => ({
  id: row.id, userId: row.user_id,
  items: Array.isArray(row.items) ? row.items : [],
  total: Number(row.total), status: row.status,
  createdAt: new Date(row.created_at).getTime(),
});

storeRouter.get('/products', async (_req, res) => {
  try {
    const result = await query('SELECT * FROM products WHERE active = true ORDER BY created_at DESC');
    res.json({ products: result.rows.map(mapProduct) });
  } catch (error) {
    console.error('[CABBA] products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

storeRouter.get('/admin/products', requireAdmin, async (_req, res) => {
  try {
    const result = await query('SELECT * FROM products ORDER BY created_at DESC');
    res.json({ products: result.rows.map(mapProduct) });
  } catch (error) {
    console.error('[CABBA] admin products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

storeRouter.post('/products', requireAdmin, async (req, res) => {
  try {
    const { name, description = '', price, imageUrl, category, stock = 0, active = true } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim() || typeof imageUrl !== 'string' || !imageUrl.trim()
      || !Number.isInteger(Number(price)) || Number(price) < 0 || !Number.isInteger(Number(stock)) || Number(stock) < 0
      || typeof category !== 'string' || !category.trim()) {
      res.status(400).json({ error: 'Invalid product data' }); return;
    }
    const result = await query(
      `INSERT INTO products (name, description, price, image_url, category, stock, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name.trim(), typeof description === 'string' ? description.trim() : '', Number(price), imageUrl.trim(), category.trim(), Number(stock), Boolean(active)],
    );
    res.status(201).json({ product: mapProduct(result.rows[0]) });
  } catch (error) {
    console.error('[CABBA] create product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

storeRouter.patch('/products/:id', requireAdmin, async (req, res) => {
  try {
    const { name, description = '', price, imageUrl, category, stock = 0, active = true } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim() || typeof imageUrl !== 'string' || !imageUrl.trim()
      || !Number.isInteger(Number(price)) || Number(price) < 0 || !Number.isInteger(Number(stock)) || Number(stock) < 0
      || typeof category !== 'string' || !category.trim()) {
      res.status(400).json({ error: 'Invalid product data' }); return;
    }
    const result = await query(
      `UPDATE products SET name=$1, description=$2, price=$3, image_url=$4, category=$5,
       stock=$6, active=$7, updated_at=NOW() WHERE id=$8 RETURNING *`,
      [name.trim(), typeof description === 'string' ? description.trim() : '', Number(price), imageUrl.trim(), category.trim(), Number(stock), Boolean(active), req.params.id],
    );
    if (!result.rows.length) { res.status(404).json({ error: 'Product not found' }); return; }
    res.json({ product: mapProduct(result.rows[0]) });
  } catch (error) {
    console.error('[CABBA] update product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

storeRouter.delete('/products/:id', requireAdmin, async (req, res) => {
  try {
    const result = await query('DELETE FROM products WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) { res.status(404).json({ error: 'Product not found' }); return; }
    res.json({ success: true });
  } catch (error) {
    console.error('[CABBA] delete product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

storeRouter.get('/orders', requireAdmin, async (_req, res) => {
  try {
    const result = await query(
      `SELECT o.*, COALESCE(json_agg(json_build_object(
        'productId', oi.product_id, 'name', oi.product_name, 'quantity', oi.quantity, 'price', oi.unit_price
      ) ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
       FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id
       GROUP BY o.id ORDER BY o.created_at DESC`,
    );
    res.json({ orders: result.rows.map(mapOrder) });
  } catch (error) {
    console.error('[CABBA] orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

storeRouter.post('/orders', requireAuth, orderRateLimit, async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    const rawItems = req.body?.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 50) {
      res.status(400).json({ error: 'Invalid order items' }); return;
    }

    const items = rawItems.map((item: any) => ({
      productId: typeof item?.productId === 'string' ? item.productId : '',
      quantity: Number(item?.quantity),
    }));
    if (items.some((item: any) => !item.productId || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100)) {
      res.status(400).json({ error: 'Invalid order item' }); return;
    }

    await client.query('BEGIN');
    let total = 0;
    const lockedItems: Array<{ productId: string; name: string; quantity: number; price: number }> = [];

    for (const item of items) {
      const productResult = await client.query(
        'SELECT id, name, price, stock, active FROM products WHERE id=$1 FOR UPDATE', [item.productId],
      );
      const product = productResult.rows[0];
      if (!product) throw new Error(`المنتج غير موجود: ${item.productId}`);
      if (!product.active) throw new Error(`المنتج غير متاح حالياً: ${product.name}`);
      if (Number(product.stock) < item.quantity) throw new Error(`الكمية المطلوبة غير متوفرة لـ: ${product.name}`);

      total += Number(product.price) * item.quantity;
      lockedItems.push({ productId: product.id, name: product.name, quantity: item.quantity, price: Number(product.price) });
      await client.query('UPDATE products SET stock=stock-$1, updated_at=NOW() WHERE id=$2', [item.quantity, item.productId]);
    }

    const orderResult = await client.query(
      `INSERT INTO orders (user_id,total,status) VALUES ($1,$2,'pending') RETURNING *`,
      [req.user!.id, total],
    );
    const orderId = orderResult.rows[0].id;

    for (const item of lockedItems) {
      await client.query(
        `INSERT INTO order_items (order_id,product_id,product_name,quantity,unit_price)
         VALUES ($1,$2,$3,$4,$5)`,
        [orderId, item.productId, item.name, item.quantity, item.price],
      );
    }
    await client.query('COMMIT');
    // Les +10 points fidélité sont crédités à la confirmation du paiement
    // (server/api/payments.ts). Une commande neuve est 'pending' : l'ancien
    // bloc `if (status === …)` référençait une variable inexistante sous
    // Node (ReferenceError) APRÈS le COMMIT → 500 systématique sur POST
    // /api/store/orders : commande créée, stock décrémenté, panier jamais
    // vidé, panneau de paiement jamais ouvert.
    res.status(201).json({ order: { ...mapOrder(orderResult.rows[0]), items: lockedItems } });

    // Confirmation de commande — asynchrone et best-effort : une panne Resend
    // ne doit jamais faire échouer une commande déjà COMMITée. La
    // déduplication event_key garantit qu'un retry ne renvoie pas deux emails.
    void (async () => {
      const owner = await query('SELECT email FROM users WHERE id=$1 AND deleted_at IS NULL', [req.user!.id]);
      const recipient = owner.rows[0]?.email;
      if (!recipient) return;
      const emailContent = orderConfirmationEmail(
        lockedItems.map((item) => ({ name: item.name, quantity: item.quantity, price: item.price })),
        total,
        orderId,
      );
      await sendEmail({
        userId: req.user!.id,
        to: recipient,
        subject: emailContent.subject,
        html: emailContent.html,
        kind: 'order',
        eventKey: `order-created:${orderId}`,
      });
    })().catch((error) => {
      console.error('[CABBA] order confirmation email:', error?.message ?? error);
    });
  } catch (error: any) {
    // Le ROLLBACK peut échouer si la connexion est morte (la cause même de
    // l'erreur) : ne pas masquer l'erreur d'origine.
    await client.query('ROLLBACK').catch(() => {});
    const message = error instanceof Error ? error.message : 'Order failed';
    if (message.startsWith('المنتج')) { res.status(409).json({ error: message }); return; }
    console.error('[CABBA] create order:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

storeRouter.patch('/orders/:id/status', requireAdmin, async (req, res) => {
  const allowed = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
  const { status } = req.body ?? {};
  if (!allowed.includes(status)) { res.status(400).json({ error: 'Invalid order status' }); return; }

  // Les types Express 5 déclarent les valeurs de params en `string | string[]`
  // (paramètres répétés) : coercion explicite — la route ne porte qu'un seul
  // segment :id, validé UUID par app.param('id') dans server.ts.
  const orderId = String(req.params.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verrou FOR UPDATE : deux admins qui annulent la même commande
    // simultanément ne peuvent pas restocker deux fois.
    const orderResult = await client.query(
      'SELECT id, status FROM orders WHERE id=$1 FOR UPDATE',
      [orderId],
    );
    if (!orderResult.rows.length) {
      await client.query('COMMIT');
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    const previousStatus = orderResult.rows[0].status;

    // BUG MÉTIER corrigé : annuler une commande ne RESTOCKAIT PAS les
    // produits — chaque annulation réduisait silencieusement l'inventaire.
    // Restock sauf depuis un état où la marchandise est déjà partie
    // (delivered) ou déjà rendue (cancelled — idempotence).
    if (status === 'cancelled' && previousStatus !== 'cancelled' && previousStatus !== 'delivered') {
      await client.query(
        `UPDATE products p
         SET stock = p.stock + oi.quantity, updated_at = NOW()
         FROM order_items oi
         WHERE oi.order_id = $1
           AND oi.product_id IS NOT NULL
           AND oi.product_id = p.id`,
        [orderId],
      );
      // product_id NULL = produit retiré du catalogue depuis l'achat :
      // la ligne de commande survit (historique), rien à restocker.
    }

    await client.query(
      'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2',
      [status, orderId],
    );
    await client.query('COMMIT');
    res.json({ success: true });

    // Notification de suivi — seulement pour les statuts qui changent
    // quelque chose POUR LE CLIENT ('pending' et 'processing' = cuisine
    // interne). Asynchrone, dédupliqué par (commande, statut).
    const NOTIFY_STATUSES = new Set(['confirmed', 'shipped', 'delivered', 'cancelled']);
    if (NOTIFY_STATUSES.has(status)) {
      void (async () => {
        const owner = await query(
          `SELECT o.user_id, u.email FROM orders o
           JOIN users u ON u.id = o.user_id
           WHERE o.id = $1 AND u.deleted_at IS NULL`,
          [orderId],
        );
        const row = owner.rows[0];
        if (!row) return; // compte anonymisé depuis : rien à notifier.
        const emailContent = orderStatusEmail(status, orderId);
        await sendEmail({
          userId: row.user_id,
          to: row.email,
          subject: emailContent.subject,
          html: emailContent.html,
          kind: 'order',
          eventKey: `order-status:${orderId}:${status}`,
        });
      })().catch((error) => {
        console.error('[CABBA] order status email:', error?.message ?? error);
      });
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[CABBA] update order:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

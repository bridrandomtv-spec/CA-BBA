import { Router, Request, Response } from 'express';
import { query, pool } from '../db/index.js';
import { requireAdmin, requireAuth } from '../auth.js';

export const storeRouter = Router();

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

storeRouter.post('/orders', requireAuth, async (req: Request, res: Response) => {
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
    res.status(201).json({ order: { ...mapOrder(orderResult.rows[0]), items: lockedItems } });
  } catch (error: any) {
    await client.query('ROLLBACK');
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
  try {
    const result = await query('UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *', [status, req.params.id]);
    if (!result.rows.length) { res.status(404).json({ error: 'Order not found' }); return; }
    res.json({ success: true });
  } catch (error) {
    console.error('[CABBA] update order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

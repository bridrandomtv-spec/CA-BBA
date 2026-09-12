// تنقلات الأنصار — bus des matchs à l'extérieur : vitrine publique,
// réservation en un tap (1 à 6 places), gestion admin des trajets.

import { Router, Request, Response } from 'express';
import { query } from '../db/index.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { isValidationError, optionalString, requireString } from './validate.js';

export const tripsRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const mapTrip = (row: any, taken: number, mySeats: number) => ({
  id: row.id,
  title: row.title,
  meetingPoint: row.meeting_point,
  departureAt: new Date(row.departure_at).toISOString(),
  seatsTotal: Number(row.seats_total),
  seatsTaken: taken,
  seatsLeft: Math.max(0, Number(row.seats_total) - taken),
  price: Number(row.price_dzd),
  active: row.active,
  mySeats,
});

/** Vitrine publique : trajets actifs + places restantes (+ ma réservation si connecté). */
tripsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT * FROM away_trips WHERE active = TRUE ORDER BY departure_at LIMIT 20`,
    );
    const trips = [];
    for (const row of result.rows) {
      const taken = await query(
        `SELECT COALESCE(SUM(seats),0)::int AS n FROM trip_bookings
         WHERE trip_id=$1 AND status='confirmed'`, [row.id]);
      let mySeats = 0;
      if (req.user) {
        const mine = await query(
          `SELECT seats FROM trip_bookings WHERE trip_id=$1 AND user_id=$2 AND status='confirmed'`,
          [row.id, req.user.id]);
        mySeats = mine.rows.length ? Number(mine.rows[0].seats) : 0;
      }
      trips.push(mapTrip(row, Number(taken.rows[0].n), mySeats));
    }
    res.json({ trips });
  } catch (error) {
    console.error('[CABBA] trips list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Réservation (1 à 6 places) : atomique, places vérifiées. */
tripsRouter.post('/:id/book', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id))) { res.status(400).json({ error: 'Identifiant invalide.' }); return; }
    const seats = Number(req.body?.seats);
    if (!Number.isInteger(seats) || seats < 1 || seats > 6) {
      res.status(400).json({ error: 'entre 1 et 6 places.' });
      return;
    }
    const trip = await query('SELECT * FROM away_trips WHERE id=$1', [req.params.id]);
    if (!trip.rows.length || !trip.rows[0].active) { res.status(404).json({ error: 'التنقل غير متاح.' }); return; }
    const taken = await query(
      `SELECT COALESCE(SUM(seats),0)::int AS n FROM trip_bookings
       WHERE trip_id=$1 AND status='confirmed'`, [req.params.id]);
    const left = Number(trip.rows[0].seats_total) - Number(taken.rows[0].n);
    if (seats > left) { res.status(409).json({ error: `Places restantes : ${left}.` }); return; }
    const existing = await query(
      'SELECT id FROM trip_bookings WHERE trip_id=$1 AND user_id=$2', [req.params.id, req.user!.id]);
    if (existing.rows.length) { res.status(409).json({ error: 'لديك حجز بالفعل في هذا التنقل.' }); return; }
    await query(
      `INSERT INTO trip_bookings (trip_id, user_id, seats) VALUES ($1,$2,$3)`,
      [req.params.id, req.user!.id, seats],
    );
    res.status(201).json({ booked: true, seats });
  } catch (error) {
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('[CABBA] trip book:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

tripsRouter.post('/:id/cancel', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id))) { res.status(400).json({ error: 'Identifiant invalide.' }); return; }
    const result = await query(
      `UPDATE trip_bookings SET status='cancelled'
       WHERE trip_id=$1 AND user_id=$2 AND status='confirmed' RETURNING id`,
      [req.params.id, req.user!.id],
    );
    if (!result.rows.length) { res.status(404).json({ error: 'لا حجز لك في هذا التنقل.' }); return; }
    res.json({ cancelled: true });
  } catch (error) {
    console.error('[CABBA] trip cancel:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/** Gestion admin : trajets + inscrits. */
tripsRouter.get('/admin', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await query('SELECT * FROM away_trips ORDER BY departure_at DESC LIMIT 50');
    const trips = [];
    for (const row of result.rows) {
      const taken = await query(
        `SELECT COALESCE(SUM(seats),0)::int AS n FROM trip_bookings
         WHERE trip_id=$1 AND status='confirmed'`, [row.id]);
      const people = await query(
        `SELECT b.seats, u.display_name FROM trip_bookings b JOIN users u ON u.id = b.user_id
         WHERE b.trip_id=$1 AND b.status='confirmed' ORDER BY b.created_at LIMIT 60`, [row.id]);
      trips.push({
        ...mapTrip(row, Number(taken.rows[0].n), 0),
        people: people.rows.map((p: any) => ({ name: p.display_name, seats: Number(p.seats) })),
      });
    }
    res.json({ trips });
  } catch (error) {
    console.error('[CABBA] trips admin:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

tripsRouter.post('/', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const title = requireString(req.body?.title, 'title', 200);
    const meetingPoint = requireString(req.body?.meetingPoint, 'meetingPoint', 200);
    const departureAt = new Date(String(req.body?.departureAt));
    if (Number.isNaN(departureAt.getTime())) { res.status(400).json({ error: 'تاريخ غير صالح.' }); return; }
    const seatsTotal = Number(req.body?.seatsTotal);
    const price = Number(req.body?.price);
    if (!Number.isInteger(seatsTotal) || seatsTotal < 1) { res.status(400).json({ error: 'عدد مقاعد غير صالح.' }); return; }
    if (!Number.isInteger(price) || price < 0) { res.status(400).json({ error: 'سعر غير صالح.' }); return; }
    const result = await query(
      `INSERT INTO away_trips (title, meeting_point, departure_at, seats_total, price_dzd, active)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [title, meetingPoint, departureAt.toISOString(), seatsTotal, price, req.body?.active !== false],
    );
    res.status(201).json({ trip: mapTrip(result.rows[0], 0, 0) });
  } catch (error) {
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('[CABBA] trip create:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

tripsRouter.patch('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id))) { res.status(400).json({ error: 'Identifiant invalide.' }); return; }
    const existing = await query('SELECT * FROM away_trips WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) { res.status(404).json({ error: 'التنقل غير موجود.' }); return; }
    const row = existing.rows[0];
    const title = optionalString(req.body?.title, 'title', 200) ?? row.title;
    const meetingPoint = optionalString(req.body?.meetingPoint, 'meetingPoint', 200) ?? row.meeting_point;
    const active = req.body?.active === undefined ? row.active : Boolean(req.body.active);
    const updated = await query(
      `UPDATE away_trips SET title=$2, meeting_point=$3, active=$4 WHERE id=$1 RETURNING *`,
      [req.params.id, title, meetingPoint, active],
    );
    res.json({ trip: mapTrip(updated.rows[0], 0, 0) });
  } catch (error) {
    if (isValidationError(error)) { res.status(400).json({ error: error.message }); return; }
    console.error('[CABBA] trip update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

tripsRouter.delete('/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!UUID_RE.test(String(req.params.id))) { res.status(400).json({ error: 'Identifiant invalide.' }); return; }
    const result = await query('DELETE FROM away_trips WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) { res.status(404).json({ error: 'التنقل غير موجود.' }); return; }
    res.json({ deleted: true });
  } catch (error) {
    console.error('[CABBA] trip delete:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

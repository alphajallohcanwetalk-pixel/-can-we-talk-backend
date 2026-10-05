import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAuthor } from '../middleware/auth.js';

const router = express.Router();

// Everything is aggregated in here rather than in SQL views, so the dashboard
// needs no extra database objects. The catalogue is small (books, essays and
// orders are in the hundreds at most); if orders ever reach six figures this
// should move to a materialised view.

const PAID = ['paid', 'shipped'];
const monthKey = (iso) => (iso || '').slice(0, 7);          // YYYY-MM
const cents = (n) => Math.round(Number(n) || 0);

function emptyOverview() {
  return {
    revenue: { total_cents: 0, paid_orders: 0, avg_order_cents: 0, by_month: [] },
    orders: { by_status: {}, total: 0, recent: [] },
    best_sellers: [],
    formats: [],
    ratings: { overall_average: 0, total_reviews: 0, distribution: {}, by_book: [], by_essay: [] },
    essays: { total: 0, published: 0, top: [] },
    audiobook: { chapters: 0, units_sold: 0, revenue_cents: 0, top_chapters: [] },
    book_club: { active_members: 0, by_plan: {}, by_status: {} },
    customers: { total: 0, new_30d: 0, buyers: 0, repeat_buyers: 0, top: [] },
    catalog: { books: 0, active_books: 0, formats_offered: 0, low_stock: [] }
  };
}

// GET /api/analytics/overview: every figure the Author Dashboard shows.
router.get('/overview', requireAuth, requireAuthor, async (req, res) => {
  try {
    const [booksRes, formatsRes, ordersRes, itemsRes, commentsRes, essaysRes,
           chaptersRes, chapterBuysRes, profilesRes, subsRes] = await Promise.all([
      supabaseAdmin.from('books').select('id,title,is_active,cover_image_url,created_at'),
      supabaseAdmin.from('book_formats').select('id,book_id,format_name,price_cents,stock_count,is_offered'),
      supabaseAdmin.from('orders').select('id,user_id,status,total_cents,created_at,customer_name'),
      supabaseAdmin.from('order_items').select('id,order_id,book_id,format_name,qty,unit_price_cents,signed'),
      supabaseAdmin.from('comments').select('id,target_type,target_id,rating,body,created_at'),
      supabaseAdmin.from('essays').select('id,title,category,year,published,created_at'),
      supabaseAdmin.from('audiobook_chapters').select('id,book_id,title,price_cents,duration_seconds'),
      supabaseAdmin.from('chapter_purchases').select('chapter_id,user_id,purchased_at'),
      supabaseAdmin.from('profiles').select('id,full_name,email,created_at,book_club_active,book_club_plan'),
      supabaseAdmin.from('book_club_subscriptions').select('id,user_id,plan,status,started_at')
    ]);

    const firstError = [booksRes, formatsRes, ordersRes, itemsRes, commentsRes, essaysRes,
      chaptersRes, chapterBuysRes, profilesRes, subsRes].find((r) => r.error);
    if (firstError) return res.status(500).json({ error: firstError.error.message });

    const books = booksRes.data || [];
    const formats = formatsRes.data || [];
    const orders = ordersRes.data || [];
    const items = itemsRes.data || [];
    const comments = commentsRes.data || [];
    const essays = essaysRes.data || [];
    const chapters = chaptersRes.data || [];
    const chapterBuys = chapterBuysRes.data || [];
    const profiles = profilesRes.data || [];
    const subs = subsRes.data || [];

    const out = emptyOverview();
    const bookById = new Map(books.map((b) => [b.id, b]));
    const paidOrders = orders.filter((o) => PAID.includes(o.status));
    const paidOrderIds = new Set(paidOrders.map((o) => o.id));

    // ---- Revenue -----------------------------------------------------------
    out.revenue.total_cents = paidOrders.reduce((s, o) => s + cents(o.total_cents), 0);
    out.revenue.paid_orders = paidOrders.length;
    out.revenue.avg_order_cents = paidOrders.length
      ? Math.round(out.revenue.total_cents / paidOrders.length) : 0;

    const months = new Map();
    for (const o of paidOrders) {
      const k = monthKey(o.created_at);
      if (!k) continue;
      const row = months.get(k) || { month: k, cents: 0, orders: 0 };
      row.cents += cents(o.total_cents);
      row.orders += 1;
      months.set(k, row);
    }
    out.revenue.by_month = [...months.values()].sort((a, b) => a.month.localeCompare(b.month));

    // ---- Orders ------------------------------------------------------------
    out.orders.total = orders.length;
    for (const o of orders) {
      out.orders.by_status[o.status] = (out.orders.by_status[o.status] || 0) + 1;
    }
    out.orders.recent = [...orders]
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 10)
      .map((o) => ({
        id: o.id, status: o.status, total_cents: cents(o.total_cents),
        created_at: o.created_at, customer_name: o.customer_name
      }));

    // ---- Best sellers and format mix (paid orders only) --------------------
    const perBook = new Map();
    const perFormat = new Map();
    let signedUnits = 0;
    for (const it of items) {
      if (!paidOrderIds.has(it.order_id)) continue;
      const units = Number(it.qty) || 0;
      const revenue = units * cents(it.unit_price_cents);
      if (it.signed) signedUnits += units;

      const b = perBook.get(it.book_id) || { book_id: it.book_id, title: bookById.get(it.book_id)?.title || 'Removed book', units: 0, revenue_cents: 0, orders: new Set() };
      b.units += units;
      b.revenue_cents += revenue;
      b.orders.add(it.order_id);
      perBook.set(it.book_id, b);

      const f = perFormat.get(it.format_name) || { format_name: it.format_name || 'Unspecified', units: 0, revenue_cents: 0 };
      f.units += units;
      f.revenue_cents += revenue;
      perFormat.set(it.format_name, f);
    }
    out.best_sellers = [...perBook.values()]
      .map((b) => ({ ...b, orders: b.orders.size }))
      .sort((a, b) => b.units - a.units || b.revenue_cents - a.revenue_cents);
    out.formats = [...perFormat.values()].sort((a, b) => b.units - a.units);
    out.signed_units = signedUnits;

    // ---- Ratings and reviews ----------------------------------------------
    const rated = comments.filter((c) => Number.isInteger(c.rating));
    out.ratings.total_reviews = comments.length;
    out.ratings.overall_average = rated.length
      ? Math.round((rated.reduce((s, c) => s + c.rating, 0) / rated.length) * 10) / 10 : 0;
    for (let star = 1; star <= 5; star += 1) {
      out.ratings.distribution[star] = rated.filter((c) => c.rating === star).length;
    }

    const groupRatings = (targetType, titleFor) => {
      const map = new Map();
      for (const c of comments.filter((x) => x.target_type === targetType)) {
        const row = map.get(c.target_id) || { id: c.target_id, title: titleFor(c.target_id), reviews: 0, rating_sum: 0, rated: 0 };
        row.reviews += 1;
        if (Number.isInteger(c.rating)) { row.rating_sum += c.rating; row.rated += 1; }
        map.set(c.target_id, row);
      }
      return [...map.values()]
        .map(({ rating_sum, rated, ...r }) => ({
          ...r,
          average: rated ? Math.round((rating_sum / rated) * 10) / 10 : 0
        }))
        .sort((a, b) => b.average - a.average || b.reviews - a.reviews);
    };
    const essayById = new Map(essays.map((e) => [e.id, e]));
    out.ratings.by_book = groupRatings('book', (id) => bookById.get(id)?.title || 'Removed book');
    out.ratings.by_essay = groupRatings('essay', (id) => essayById.get(id)?.title || 'Removed essay');

    // ---- Essays ------------------------------------------------------------
    out.essays.total = essays.length;
    out.essays.published = essays.filter((e) => e.published).length;
    out.essays.by_category = Object.entries(
      essays.reduce((acc, e) => { acc[e.category || 'Uncategorised'] = (acc[e.category || 'Uncategorised'] || 0) + 1; return acc; }, {})
    ).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
    out.essays.top = out.ratings.by_essay.slice(0, 5);

    // ---- Audiobook ---------------------------------------------------------
    const chapterById = new Map(chapters.map((c) => [c.id, c]));
    out.audiobook.chapters = chapters.length;
    out.audiobook.units_sold = chapterBuys.length;
    out.audiobook.revenue_cents = chapterBuys
      .reduce((s, p) => s + cents(chapterById.get(p.chapter_id)?.price_cents), 0);
    const perChapter = new Map();
    for (const p of chapterBuys) {
      const ch = chapterById.get(p.chapter_id);
      const row = perChapter.get(p.chapter_id) || { chapter_id: p.chapter_id, title: ch?.title || 'Removed chapter', units: 0, revenue_cents: 0 };
      row.units += 1;
      row.revenue_cents += cents(ch?.price_cents);
      perChapter.set(p.chapter_id, row);
    }
    out.audiobook.top_chapters = [...perChapter.values()].sort((a, b) => b.units - a.units).slice(0, 5);

    // ---- Book Club ---------------------------------------------------------
    out.book_club.active_members = profiles.filter((p) => p.book_club_active).length;
    for (const s of subs) {
      out.book_club.by_plan[s.plan] = (out.book_club.by_plan[s.plan] || 0) + 1;
      out.book_club.by_status[s.status] = (out.book_club.by_status[s.status] || 0) + 1;
    }

    // ---- Customers ---------------------------------------------------------
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    out.customers.total = profiles.length;
    out.customers.new_30d = profiles.filter((p) => (p.created_at || '') >= thirtyDaysAgo).length;

    const spendByUser = new Map();
    for (const o of paidOrders) {
      if (!o.user_id) continue;
      const row = spendByUser.get(o.user_id) || { user_id: o.user_id, orders: 0, spend_cents: 0 };
      row.orders += 1;
      row.spend_cents += cents(o.total_cents);
      spendByUser.set(o.user_id, row);
    }
    const profileById = new Map(profiles.map((p) => [p.id, p]));
    out.customers.buyers = spendByUser.size;
    out.customers.repeat_buyers = [...spendByUser.values()].filter((r) => r.orders > 1).length;
    out.customers.top = [...spendByUser.values()]
      .sort((a, b) => b.spend_cents - a.spend_cents)
      .slice(0, 5)
      .map((r) => ({
        name: profileById.get(r.user_id)?.full_name || 'Unknown',
        orders: r.orders,
        spend_cents: r.spend_cents
      }));

    // ---- Catalogue health --------------------------------------------------
    out.catalog.books = books.length;
    out.catalog.active_books = books.filter((b) => b.is_active).length;
    out.catalog.formats_offered = formats.filter((f) => f.is_offered !== false).length;
    out.catalog.missing_cover = books.filter((b) => b.is_active && !b.cover_image_url)
      .map((b) => ({ id: b.id, title: b.title }));
    out.catalog.low_stock = formats
      .filter((f) => f.stock_count !== null && f.stock_count <= 5)
      .map((f) => ({
        title: bookById.get(f.book_id)?.title || 'Removed book',
        format_name: f.format_name,
        stock_count: f.stock_count
      }));

    out.generated_at = new Date().toISOString();
    res.json(out);
  } catch (error) {
    console.error('Analytics overview failed:', error.message);
    res.status(500).json({ error: 'Could not build analytics' });
  }
});

export default router;

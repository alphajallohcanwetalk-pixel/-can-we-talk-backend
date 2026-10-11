import { supabaseAdmin } from './supabase.js';

// One place that answers "what may this person read or hear?".
//
// The author owns the work, so his account has every paid feature without
// paying for it. Everyone else gets what they have bought: a Book Club
// membership, an ebook in a paid order, or individual audiobook chapters.

export async function isOwnerAccount(userId) {
  if (!userId) return false;
  const { data } = await supabaseAdmin.from('profiles').select('is_author').eq('id', userId).maybeSingle();
  return Boolean(data?.is_author);
}

// Resolves the user from a bearer token on a public route. Returns null for a
// visitor who is not signed in, rather than failing the request.
export async function optionalUser(req) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  return data?.user || null;
}

export async function ownedChapterIds(userId) {
  if (!userId) return [];
  const { data } = await supabaseAdmin.from('chapter_purchases').select('chapter_id').eq('user_id', userId);
  return (data || []).map((p) => p.chapter_id);
}

export async function ebookBookIds(userId) {
  if (!userId) return [];
  const { data: paid } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('user_id', userId)
    .in('status', ['paid', 'shipped']);
  const orderIds = (paid || []).map((o) => o.id);
  if (!orderIds.length) return [];
  const { data: items } = await supabaseAdmin
    .from('order_items')
    .select('book_id')
    .in('order_id', orderIds)
    .ilike('format_name', 'ebook');
  return [...new Set((items || []).map((i) => i.book_id))];
}

// Everything at once, for the account page and for unlocking content in the
// browser straight after a payment.
export async function libraryFor(userId) {
  const [owner, profileRes, chapters, ebooks] = await Promise.all([
    isOwnerAccount(userId),
    supabaseAdmin.from('profiles').select('book_club_active, book_club_plan').eq('id', userId).maybeSingle(),
    ownedChapterIds(userId),
    ebookBookIds(userId),
  ]);
  const profile = profileRes.data || {};
  return {
    is_owner: owner,
    book_club_active: owner || Boolean(profile.book_club_active),
    book_club_plan: owner ? 'owner' : profile.book_club_plan || null,
    all_chapters: owner,
    chapter_ids: chapters,
    ebook_book_ids: ebooks,
  };
}

// The site's real mailboxes (on the canwetalkvoice.com mail hosting). Only these three exist:
// anything else on the domain bounces.
//   info@   general questions, the main contact, replies to the site's general emails
//   books@  orders, shipping, signed copies, bookstores, the Book Club
//   alpha.jalloh@  Alpha himself: speaking, media and press, replies to readers
export const MAILBOX = {
  general: process.env.MAIL_GENERAL || 'info@canwetalkvoice.com',
  books: process.env.MAIL_BOOKS || 'books@canwetalkvoice.com',
  author: process.env.ADMIN_EMAIL || 'alpha.jalloh@canwetalkvoice.com',
};

// The sender for the site's emails. EMAIL_FROM on Render used questions@, which has no mailbox, so
// replies bounced; that address is swapped for info@ (same domain, so Resend still accepts it).
export function fromAddress() {
  const raw = (process.env.EMAIL_FROM || '').trim();
  if (!raw) return `Can We Talk? <${MAILBOX.general}>`;
  return raw.replace(/questions@canwetalkvoice\.com/i, MAILBOX.general);
}

// Which mailbox a contact form message belongs in, by the reason the visitor chose.
export function mailboxForReason(reason) {
  if (/speaking|media|press/i.test(reason || '')) return MAILBOX.author;
  if (/order|bookstore|signed|book club|shipping|refund/i.test(reason || '')) return MAILBOX.books;
  return MAILBOX.general;
}

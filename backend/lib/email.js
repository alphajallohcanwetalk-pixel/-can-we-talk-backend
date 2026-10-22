import { Resend } from 'resend';
import { MAILBOX, fromAddress } from './mailboxes.js';
import { t } from './i18n.js';

// Made on first send, so building an email (and testing it) needs no key.
let resend = null;
const mail = () => (resend ||= new Resend(process.env.RESEND_API_KEY));
const FROM = fromAddress();

// Names, book titles and essay text are interpolated into HTML below. Escape
// them so a stray angle bracket cannot break the layout or inject markup.
const esc = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const firstName = (name) => esc(String(name ?? '').trim().split(' ')[0] || 'there');
const RTL = new Set(['ar']);

// Readers' emails are written in their language (lang: the profile's language, 'en' by default):
// every sentence goes through t(), from the same dictionaries as the site (backend/i18n).
const wrapper = (bodyHtml, lang = 'en') => `
  <div lang="${esc(lang)}" dir="${RTL.has(lang) ? 'rtl' : 'ltr'}" style="font-family: Georgia, serif; background:#faf8f2; padding:40px 20px;">
    <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #e5e2d8;">
      <div style="height:6px; display:flex;">
        <div style="flex:1; background:#1eb53a;"></div>
        <div style="flex:1; background:#ffffff; border-top:1px solid #eee; border-bottom:1px solid #eee;"></div>
        <div style="flex:1; background:#0072c6;"></div>
      </div>
      <div style="padding:36px 32px;">
        ${bodyHtml}
      </div>
      <div style="padding:20px 32px; background:#f0ede3; font-size:12px; color:#777; text-align:center;">
        Can We Talk? (The Misfit Voice) · Alpha Amadu Jalloh · Sierra Leone
      </div>
    </div>
  </div>
`;

export function welcomeEmail(lang, name) {
  const html = wrapper(`
    <h2 style="margin:0 0 14px;">${esc(t(lang, 'Welcome, {name}', { name: '\u0000' })).replace('\u0000', firstName(name))}</h2>
    <p style="color:#444; line-height:1.6;">
      ${esc(t(lang, 'Your account is live. You can now comment on books and essays, buy audiobook chapters, and, if you join, read every book online through the AJ Book Club.'))}
    </p>
    <p style="color:#444; line-height:1.6;">${esc(t(lang, 'Question Power. Question Society. Question Yourself.'))}</p>
  `, lang);
  return { subject: t(lang, 'Welcome to Can We Talk?'), html };
}

export function orderEmail(lang, order) {
  const itemsHtml = order.items.map(
    (i) => `<tr>
      <td style="padding:8px 0; border-bottom:1px solid #eee;">${esc(i.title)} (${esc(i.format_name)}${i.signed ? ', ' + esc(t(lang, 'signed')) : ''}) × ${Number(i.qty) || 0}</td>
      <td style="padding:8px 0; border-bottom:1px solid #eee; text-align:right;">$${(i.unit_price_cents * i.qty / 100).toFixed(2)}</td>
    </tr>`
  ).join('');
  const no = order.id.slice(0, 8);
  const html = wrapper(`
    <h2 style="margin:0 0 6px;">${esc(t(lang, 'Thank you for your order'))}</h2>
    <p style="color:#777; margin:0 0 20px; font-size:14px;">${esc(t(lang, 'Order #{number}', { number: no }))}</p>
    <table style="width:100%; border-collapse:collapse; font-size:14px; color:#333;">
      ${itemsHtml}
      <tr><td style="padding-top:14px; font-weight:700;">${esc(t(lang, 'Total'))}</td>
          <td style="padding-top:14px; font-weight:700; text-align:right;">$${(order.total_cents / 100).toFixed(2)}</td></tr>
    </table>
    <p style="color:#444; margin-top:24px; line-height:1.6;">
      ${esc(t(lang, "Your order will ship within 2 business days. We'll email tracking details once it's on its way."))}
    </p>
  `, lang);
  return { subject: t(lang, 'Order confirmed: #{number}', { number: no }), html };
}

export function newEssayEmail(lang, essay) {
  const html = wrapper(`
    <span style="font-family:monospace; font-size:11px; letter-spacing:1px; text-transform:uppercase; color:#1eb53a;">${esc(t(lang, 'New Essay Published'))}</span>
    <h2 style="margin:10px 0 14px;">${esc(essay.title)}</h2>
    <p style="color:#444; line-height:1.6;">${esc(essay.excerpt)}</p>
    <a href="${process.env.FRONTEND_URL}" style="display:inline-block; margin-top:18px; background:#0c3d22; color:#fff; padding:12px 22px; border-radius:4px; text-decoration:none; font-size:14px;">${esc(t(lang, 'Read on the site'))} →</a>
  `, lang);
  return { subject: t(lang, 'New essay: {title}', { title: essay.title }), html };
}

export function bookClubWelcomeEmail(lang, name, plan) {
  const html = wrapper(`
    <h2 style="margin:0 0 14px;">${esc(t(lang, 'Welcome to the AJ Book Club'))}</h2>
    <p style="color:#444; line-height:1.6;">
      ${esc(t(lang, "Hi {name}, your {plan} membership is active. Every book is now available to read online, and you'll get new essays a week before anyone else.", { name: String(name ?? '').trim().split(' ')[0] || 'there', plan: t(lang, String(plan)) }))}
    </p>
  `, lang);
  return { subject: t(lang, 'Welcome to the AJ Book Club'), html };
}

export function newsletterConfirmEmail(lang, name, token) {
  const base = process.env.PUBLIC_API_URL || 'https://can-we-talk-backend.onrender.com';
  const confirmUrl = `${base}/api/newsletter/confirm/${encodeURIComponent(token)}`;
  const first = String(name ?? '').trim().split(' ')[0];
  const ask = first
    ? t(lang, '{name}, someone asked to receive new essays from Alpha Amadu Jalloh at this address. Confirm below and you will get each new piece as it is published.', { name: first })
    : t(lang, 'Someone asked to receive new essays from Alpha Amadu Jalloh at this address. Confirm below and you will get each new piece as it is published.');
  const html = wrapper(`
    <h2 style="margin:0 0 14px;">${esc(t(lang, 'Confirm your email'))}</h2>
    <p style="color:#444; line-height:1.6;">${esc(ask)}</p>
    <a href="${confirmUrl}" style="display:inline-block; margin-top:18px; background:#0c3d22; color:#fff; padding:13px 24px; border-radius:4px; text-decoration:none; font-size:14px;">${esc(t(lang, 'Yes, sign me up'))}</a>
    <p style="color:#777; font-size:12px; margin-top:22px; line-height:1.6;">
      ${esc(t(lang, 'If this was not you, ignore this message. Nothing will be sent to you unless you confirm.'))}
    </p>
  `, lang);
  return { subject: t(lang, 'Confirm your email'), html };
}

export async function sendWelcomeEmail(toEmail, name, lang = 'en') {
  return mail().emails.send({ from: FROM, reply_to: MAILBOX.general, to: toEmail, ...welcomeEmail(lang, name) });
}

export async function sendOrderConfirmationEmail(toEmail, order, lang = 'en') {
  return mail().emails.send({ from: FROM, reply_to: MAILBOX.books, to: toEmail, ...orderEmail(lang, order) });
}

// One email per language group (Resend batch sending; for large lists, chunk into batches of ~100).
export async function sendNewEssayAlert(toEmails, essay, lang = 'en') {
  return mail().emails.send({ from: FROM, reply_to: MAILBOX.general, to: toEmails, ...newEssayEmail(lang, essay) });
}

export async function sendBookClubWelcomeEmail(toEmail, name, plan, lang = 'en') {
  return mail().emails.send({ from: FROM, reply_to: MAILBOX.books, to: toEmail, ...bookClubWelcomeEmail(lang, name, plan) });
}

export async function sendNewsletterConfirmation(toEmail, name, token, lang = 'en') {
  return mail().emails.send({ from: FROM, reply_to: MAILBOX.general, to: toEmail, ...newsletterConfirmEmail(lang, name, token) });
}

// A message from the Contact page, to Alpha. Replying in the email app goes straight to the sender.
export async function sendContactToAuthor(toEmail, msg) {
  const html = wrapper(`
    <p style="margin:0 0 6px; color:#777; font-size:13px; text-transform:uppercase; letter-spacing:1px;">${esc(msg.reason || 'Message')}</p>
    <h2 style="margin:0 0 14px;">New message from ${esc(msg.name)}</h2>
    <p style="color:#444; line-height:1.6; white-space:pre-wrap;">${esc(msg.message)}</p>
    <p style="color:#777; font-size:13px; line-height:1.6;">From: ${esc(msg.name)} &lt;${esc(msg.email)}&gt;<br>
    Press Reply to answer them directly, or open the dashboard (Messages) to reply and mark it done.</p>
  `);
  return mail().emails.send({
    from: FROM,
    to: toEmail,
    reply_to: msg.email,
    subject: `${msg.reason || 'Message'}: ${String(msg.name).slice(0, 60)}`,
    html
  });
}

// Alpha's reply from the dashboard, to the person who wrote.
export async function sendContactReply(toEmail, name, reply, original, replyTo) {
  const html = wrapper(`
    <h2 style="margin:0 0 14px;">Hello ${firstName(name)}</h2>
    <p style="color:#444; line-height:1.6; white-space:pre-wrap;">${esc(reply)}</p>
    <p style="color:#444; line-height:1.6;">Alpha Amadu Jalloh</p>
    <div style="margin-top:22px; padding-top:14px; border-top:1px solid #eee; color:#888; font-size:13px; white-space:pre-wrap;">Your message:\n${esc(original)}</div>
  `);
  return mail().emails.send({
    from: FROM,
    to: toEmail,
    reply_to: replyTo || undefined,
    subject: 'Reply from Alpha Amadu Jalloh (Can We Talk?)',
    html
  });
}

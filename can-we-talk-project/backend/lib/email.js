import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.EMAIL_FROM;

const wrapper = (bodyHtml) => `
  <div style="font-family: Georgia, serif; background:#faf8f2; padding:40px 20px;">
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

export async function sendWelcomeEmail(toEmail, name) {
  const html = wrapper(`
    <h2 style="margin:0 0 14px;">Welcome, ${name.split(' ')[0]}</h2>
    <p style="color:#444; line-height:1.6;">
      Your account is live. You can now comment on books and essays, buy audiobook chapters,
      and — if you join — read every book online through the AJ Book Club.
    </p>
    <p style="color:#444; line-height:1.6;">Question Power. Question Society. Question Yourself.</p>
  `);
  return resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: 'Welcome to Can We Talk?',
    html
  });
}

export async function sendOrderConfirmationEmail(toEmail, order) {
  const itemsHtml = order.items.map(
    (i) => `<tr>
      <td style="padding:8px 0; border-bottom:1px solid #eee;">${i.title} (${i.format_name}${i.signed ? ', signed' : ''}) × ${i.qty}</td>
      <td style="padding:8px 0; border-bottom:1px solid #eee; text-align:right;">$${(i.unit_price_cents * i.qty / 100).toFixed(2)}</td>
    </tr>`
  ).join('');

  const html = wrapper(`
    <h2 style="margin:0 0 6px;">Thank you for your order</h2>
    <p style="color:#777; margin:0 0 20px; font-size:14px;">Order #${order.id.slice(0, 8)}</p>
    <table style="width:100%; border-collapse:collapse; font-size:14px; color:#333;">
      ${itemsHtml}
      <tr><td style="padding-top:14px; font-weight:700;">Total</td>
          <td style="padding-top:14px; font-weight:700; text-align:right;">$${(order.total_cents / 100).toFixed(2)}</td></tr>
    </table>
    <p style="color:#444; margin-top:24px; line-height:1.6;">
      Your order will ship within 2 business days. We'll email tracking details once it's on its way.
    </p>
  `);
  return resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: `Order confirmed — #${order.id.slice(0, 8)}`,
    html
  });
}

export async function sendNewEssayAlert(toEmails, essay) {
  const html = wrapper(`
    <span style="font-family:monospace; font-size:11px; letter-spacing:1px; text-transform:uppercase; color:#1eb53a;">New Essay Published</span>
    <h2 style="margin:10px 0 14px;">${essay.title}</h2>
    <p style="color:#444; line-height:1.6;">${essay.excerpt}</p>
    <a href="${process.env.FRONTEND_URL}" style="display:inline-block; margin-top:18px; background:#0c3d22; color:#fff; padding:12px 22px; border-radius:4px; text-decoration:none; font-size:14px;">Read on the site →</a>
  `);
  // Resend supports batch sending; for large lists, chunk into batches of ~100.
  return resend.emails.send({
    from: FROM,
    to: toEmails,
    subject: `New essay: ${essay.title}`,
    html
  });
}

export async function sendBookClubWelcomeEmail(toEmail, name, plan) {
  const html = wrapper(`
    <h2 style="margin:0 0 14px;">Welcome to the AJ Book Club</h2>
    <p style="color:#444; line-height:1.6;">
      Hi ${name.split(' ')[0]}, your ${plan} membership is active. Every book is now available
      to read online, and you'll get new essays a week before anyone else.
    </p>
  `);
  return resend.emails.send({
    from: FROM,
    to: toEmail,
    subject: 'Welcome to the AJ Book Club',
    html
  });
}

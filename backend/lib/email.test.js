import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useDicts } from './i18n.js';
import { welcomeEmail, orderEmail, newEssayEmail, bookClubWelcomeEmail, newsletterConfirmEmail } from './email.js';

useDicts({ fr: {
  'Welcome to Can We Talk?': 'Bienvenue sur Can We Talk?',
  'Welcome, {name}': 'Bienvenue, {name}',
  'New essay: {title}': 'Nouvel essai : {title}',
  'Read on the site': 'Lire sur le site',
  'Thank you for your order': 'Merci pour votre commande',
} });

test('welcome email in English and in French', () => {
  const en = welcomeEmail('en', 'Ada Obi');
  assert.equal(en.subject, 'Welcome to Can We Talk?');
  assert.match(en.html, /Welcome, Ada/);
  const fr = welcomeEmail('fr', 'Ada Obi');
  assert.equal(fr.subject, 'Bienvenue sur Can We Talk?');
  assert.match(fr.html, /Bienvenue, Ada/);
  assert.match(fr.html, /<html lang="fr"|lang="fr"/);
});

test('names are escaped in every language', () => {
  assert.doesNotMatch(welcomeEmail('fr', '<b>x</b>').html, /<b>x<\/b>/);
});

test('new essay email uses the reader language and a translated title when given', () => {
  const m = newEssayEmail('fr', { title: 'La réalité me déteste', excerpt: 'Court' });
  assert.equal(m.subject, 'Nouvel essai : La réalité me déteste');
  assert.match(m.html, /Lire sur le site/);
});

test('order, book club and newsletter emails build in English', () => {
  const o = orderEmail('en', { id: 'abcdef123456', total_cents: 2500, items: [{ title: 'Book', format_name: 'Paperback', qty: 1, unit_price_cents: 2500 }] });
  assert.equal(o.subject, 'Order confirmed: #abcdef12');
  assert.match(o.html, /\$25\.00/);
  assert.equal(orderEmail('fr', { id: 'abcdef123456', total_cents: 0, items: [] }).html.includes('Merci pour votre commande'), true);
  assert.match(bookClubWelcomeEmail('en', 'Ada Obi', 'yearly').html, /Hi Ada, your yearly membership is active/);
  assert.match(newsletterConfirmEmail('en', 'Ada', 'tok').html, /Yes, sign me up/);
});

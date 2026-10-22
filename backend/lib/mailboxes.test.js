import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recipientsFor, MAILBOX } from './mailboxes.js';

test('translation suggestions go to info@ only, never to Alpha', () => {
  assert.deepEqual(recipientsFor('Translation'), { to: [MAILBOX.general], notifyAuthor: false });
});

test('other messages go to their mailbox and to Alpha, with a notification', () => {
  assert.deepEqual(recipientsFor('Bulk / bookstore order'), { to: [MAILBOX.books, MAILBOX.author], notifyAuthor: true });
  assert.deepEqual(recipientsFor('Speaking engagement'), { to: [MAILBOX.author], notifyAuthor: true });
  assert.deepEqual(recipientsFor('General inquiry'), { to: [MAILBOX.general, MAILBOX.author], notifyAuthor: true });
});

# Email setup (Resend)

Written for: whoever has access to the cPanel Zone Editor for canwetalkvoice.com.

## Why this matters

The backend sends welcome emails, order confirmations, Book Club welcomes and
new essay alerts through Resend, from `questions@canwetalkvoice.com`.

Until this is finished, **those emails do not work.** The domain was never added
to Resend at all, and Resend refuses to send from a domain it has not verified.
So order confirmations have not been reaching customers.

This is separate from your cPanel mailboxes. Receiving mail at
`@canwetalkvoice.com` already works. This is only about the site *sending*.

---

## Step 1: add four DNS records

cPanel → **Zone Editor** → Manage for `canwetalkvoice.com` → **Add Record**.

The domain is already registered in Resend (region `eu-west-1`), so these are
the exact values it expects. cPanel appends `.canwetalkvoice.com` to the Name
field automatically, so type the short name exactly as shown.

### Record 1: DKIM signature

```
Type  : TXT
Name  : resend._domainkey
TTL   : 300
Value : p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDvT7eaDr5LXh7rbsCzHEJssv6v4nNIMVAk5ePReh8PIQhSViJlt4SpCzYNbiTJt1kZrmJau54iNZnDi8FFe25RQASK9auC8vqxSR4C/BPHXji6Xx8N/RzbDciUNlUUMqDdzALWVKkrMicBWXyJzGdmKED/VfjQuNDASfklv42ybwIDAQAB
```

Paste that value as one unbroken line. No spaces, no line breaks.

### Record 2: bounce handling

```
Type     : MX
Name     : send
Priority : 10
TTL      : 300
Value    : feedback-smtp.eu-west-1.amazonses.com
```

This is an MX on the **`send`** subdomain. It does not touch your main MX, and
it will not affect your mailboxes.

### Record 3: SPF for the sending subdomain

```
Type  : TXT
Name  : send
TTL   : 300
Value : v=spf1 include:amazonses.com ~all
```

### Record 4: tracking

```
Type  : CNAME
Name  : rsend
TTL   : 300
Value : send.forge.rmta.net
```

---

## Do NOT change your existing SPF record

Your root TXT record stays exactly as it is:

```
v=spf1 +a +mx +ip4:27.50.84.57 include:relay.mailchannels.net ~all
```

That one authorises your cPanel server to send. Resend sends from the `send`
subdomain, which has its own SPF record above. Adding `include:amazonses.com` to
the root record as well is unnecessary, and SPF has a hard limit of ten DNS
lookups that is easy to blow past.

---

## Step 2: verify in Resend

1. Go to <https://resend.com/domains>.
2. Open `canwetalkvoice.com`.
3. Press **Verify DNS Records**.

DNS needs a few minutes to propagate. If it fails, wait and try again rather
than editing the records.

Status should move from `not_started` to `verified`.

---

## Step 3: test a real send

Once verified, create a new account on the site with an address you can check,
and confirm the welcome email arrives in the inbox rather than spam.

Then check the headers. In Gmail, open the message, choose **Show original**,
and look for:

```
SPF:   PASS
DKIM:  PASS
DMARC: PASS
```

All three should pass. If DKIM fails, the TXT value was probably pasted with a
line break in it.

---

## Step 4: tighten DMARC, later

Your current policy is the weakest setting:

```
_dmarc.canwetalkvoice.com   TXT   v=DMARC1; p=none;
```

`p=none` means "do nothing if a message fails checks". That is the right setting
while you are still changing things, because it cannot break delivery.

Once Resend has been verified and sending cleanly for a couple of weeks, move
to quarantine so forged mail claiming to be from your domain lands in spam:

```
v=DMARC1; p=quarantine; rua=mailto:questions@canwetalkvoice.com; pct=100
```

Do not jump straight to `p=reject`. If anything is still misconfigured, reject
silently destroys real mail instead of flagging it.

---

## Troubleshooting

**Emails still not arriving after verification.** Check the Resend dashboard
logs. If sends are failing there, the `EMAIL_FROM` value in Render must match
the verified domain. It should be:
`Can We Talk <questions@canwetalkvoice.com>`

**Mail lands in spam even though SPF and DKIM pass.** New sending domains have
no reputation. Volume builds it. Avoid sending to addresses that bounce, as a
high bounce rate damages reputation quickly.

**MX record worry.** Record 2 is on `send.canwetalkvoice.com`, a different name
from your root domain. Your mailboxes are unaffected.

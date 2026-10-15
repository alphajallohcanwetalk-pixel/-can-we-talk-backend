# Keeping canwetalkvoice.com online without the Serv hosting plan

Written for: whoever does the move (the site owner or B&A Developers). About 30 minutes, plus up to a day
for the change to spread.

## Why
The website runs on GitHub Pages and does not need the Serv cPanel plan. But the domain's DNS (the
address book that tells browsers where canwetalkvoice.com is) is on Serv's nameservers (ns1 to
ns3.serv.com.au), which come with the hosting plan. When the plan ends in December 2026 the address book can
go with it, and the website would go offline even though GitHub is still serving it. Moving the DNS to a free
DNS host removes that dependency. The domain itself stays registered (paid until 3 September 2027,
registrar Synergy Wholesale, managed in the Serv account).

## Steps
1. Create a free Cloudflare account (cloudflare.com) with the site owner's email.
2. Add a site: `canwetalkvoice.com`, Free plan. When Cloudflare offers to scan records, continue.
3. DNS > Records > Import and Export > Import: upload `docs/dns/canwetalkvoice.com.zone` from this repo.
   Make sure every record shows **DNS only** (grey cloud), not proxied.
4. Check the list against the live records (`nslookup -type=TXT canwetalkvoice.com` etc.). The website
   needs: four A records 185.199.108.153 to 185.199.111.153, `www` CNAME `alphajallohcanwetalk-pixel.github.io`,
   and the Resend records on `send` and `resend._domainkey`.
5. Cloudflare shows two nameservers (like `xxx.ns.cloudflare.com`). In the Serv client area, open the domain
   canwetalkvoice.com > Nameservers, replace ns1/ns2/ns3.serv.com.au with Cloudflare's two, save.
6. Within a few hours Cloudflare says the site is Active. Check https://canwetalkvoice.com and
   https://www.canwetalkvoice.com open, and that GitHub (repository Settings > Pages) still shows the custom
   domain with HTTPS.
7. Email: the mailboxes (mail.canwetalkvoice.com) still live on the Serv plan and stop when it ends. Before
   then, move them (for example Zoho Mail free: add its MX, SPF and DKIM records in Cloudflare, remove the Serv
   mail records) or renew the plan.

## Going back
Put Serv's nameservers back in the Serv client area (only while the plan is active).

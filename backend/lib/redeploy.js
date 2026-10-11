// Rebuilds the website's share pages straight after a publish, so a new essay
// or book link shows its cover in WhatsApp within a few minutes rather than at
// the next scheduled rebuild (every two hours).
//
// Optional. Needs GITHUB_DEPLOY_TOKEN on the server: a fine-grained GitHub
// token for this repository with "Actions: read and write" only. Without it,
// nothing happens here and the scheduled rebuild still covers it.

const TOKEN = process.env.GITHUB_DEPLOY_TOKEN || '';
const REPO = process.env.GITHUB_REPO || 'alphajallohcanwetalk-pixel/-can-we-talk-backend';
let timer = null;

// Several saves in a row (cover, then text, then a fix) become one rebuild.
export function requestSiteRebuild() {
  if (!TOKEN) return;
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/deploy-pages.yml/dispatches`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        body: JSON.stringify({ ref: 'main' }),
      });
      if (!res.ok) console.error(JSON.stringify({ type: 'error', scope: 'site_rebuild', status: res.status }));
    } catch (err) {
      console.error(JSON.stringify({ type: 'error', scope: 'site_rebuild', message: err.message }));
    }
  }, 90 * 1000);
}

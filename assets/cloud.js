/* Cloudbook Desk — online sync with Supabase.
   Talks to Supabase's REST endpoints directly with fetch (no third-party library).
   Security model:
   - Only people with a login created by the firm owner can sign in (public sign-up is turned off in Supabase).
   - Row Level Security in the database lets a signed-in user read or change only their own firm's data.
   - The key below is Supabase's *publishable* key. It is meant to be public: on its own it can read nothing.
   - Every save carries a version number, so two devices can never silently overwrite each other. */
(() => {
  'use strict';
  const CFG = {
    url: 'https://btpjwfnobpvcpmfpliyy.supabase.co',
    key: 'sb_publishable_JRCPCsLmxyNQfAGnpc5t_w_m2-k6tvK',
    firm: 'cloudbook',
  };
  const SKEY = 'cloudbook-desk.session';
  let sess = null;
  try { sess = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) { sess = null; }
  if (sess && (typeof sess.refresh_token !== 'string' || !sess.user)) sess = null;

  const keep = (s) => {
    sess = s ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600), user: { id: s.user?.id, email: s.user?.email } } : null;
    try { if (sess) localStorage.setItem(SKEY, JSON.stringify(sess)); else localStorage.removeItem(SKEY); } catch (e) { /* storage blocked */ }
  };
  class CloudError extends Error { constructor(msg, kind) { super(msg); this.kind = kind; } }
  const errText = async (r) => { try { const j = await r.json(); return j.error_description || j.msg || j.message || j.error || ('HTTP ' + r.status); } catch (e) { return 'HTTP ' + r.status; } };

  async function authPost(path, body, bearer) {
    let r;
    try {
      r = await fetch(CFG.url + '/auth/v1/' + path, { method: 'POST', headers: { apikey: CFG.key, 'Content-Type': 'application/json', ...(bearer ? { Authorization: 'Bearer ' + bearer } : {}) }, body: JSON.stringify(body || {}) });
    } catch (e) { throw new CloudError('Cannot reach the online database. Check the internet connection.', 'network'); }
    return r;
  }
  async function refresh() {
    if (!sess) throw new CloudError('Please sign in.', 'auth');
    const r = await authPost('token?grant_type=refresh_token', { refresh_token: sess.refresh_token });
    if (!r.ok) { if (r.status >= 400 && r.status < 500) { keep(null); throw new CloudError('Your session has ended. Please sign in again.', 'auth'); } throw new CloudError(await errText(r), 'server'); }
    keep(await r.json());
  }
  async function token() {
    if (!sess) throw new CloudError('Please sign in.', 'auth');
    if (!sess.access_token || Date.now() / 1000 > sess.expires_at - 60) await refresh();
    return sess.access_token;
  }
  async function rest(path, opts = {}, retried) {
    const t = await token();
    let r;
    try {
      r = await fetch(CFG.url + '/rest/v1/' + path, { method: opts.method || 'GET', headers: { apikey: CFG.key, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', Accept: 'application/json', ...(opts.prefer ? { Prefer: opts.prefer } : {}) }, body: opts.body });
    } catch (e) { throw new CloudError('Cannot reach the online database. Check the internet connection.', 'network'); }
    if (r.status === 401 && !retried) { await refresh(); return rest(path, opts, true); }
    if (!r.ok) throw new CloudError(await errText(r), r.status === 401 || r.status === 403 ? 'auth' : 'server');
    return r.status === 204 ? null : r.json();
  }
  const row = 'desk_state?firm_id=eq.' + encodeURIComponent(CFG.firm);

  window.CloudbookCloud = {
    on: true,
    firm: CFG.firm,
    get user() { return sess ? sess.user : null; },
    signedIn: () => !!sess,
    async signIn(email, password) {
      const r = await authPost('token?grant_type=password', { email, password });
      if (!r.ok) {
        const m = await errText(r);
        throw new CloudError(/invalid/i.test(m) ? 'Email or password is not correct.' : m, r.status === 429 ? 'rate' : 'auth');
      }
      keep(await r.json());
      return sess.user;
    },
    async signOut() {
      if (sess?.access_token) { try { await authPost('logout', {}, sess.access_token); } catch (e) { /* offline: forget locally anyway */ } }
      keep(null);
    },
    // Returns { data, version, updatedAt } or { notMember: true }.
    async pull() {
      const rows = await rest(row + '&select=data,version,updated_at');
      if (!rows || !rows.length) return { notMember: true };
      return { data: rows[0].data, version: Number(rows[0].version) || 0, updatedAt: rows[0].updated_at };
    },
    async version() {
      const rows = await rest(row + '&select=version,updated_at');
      return rows && rows.length ? Number(rows[0].version) || 0 : null;
    },
    // Saves only if nobody else saved since `base`. Returns { ok, version } or { conflict: true }.
    async push(data, base) {
      const rows = await rest(row + '&version=eq.' + Number(base) + '&select=version', { method: 'PATCH', prefer: 'return=representation', body: JSON.stringify({ data, version: Number(base) + 1 }) });
      if (!rows || !rows.length) return { conflict: true };
      return { ok: true, version: Number(rows[0].version) };
    },
    CloudError,
  };
})();

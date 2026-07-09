// Cloudflare Worker — Google OAuth token broker for freelance-tracker-cloud
// 職責：只做兩件事，不存任何資料、不留任何 log
//   POST /exchange  { code }          → 用 authorization code 換 access_token + refresh_token
//   POST /refresh   { refresh_token } → 換新的 access_token
// client_secret 只存在 Worker 的加密環境變數 GOOGLE_CLIENT_SECRET，不在程式碼裡

const CLIENT_ID = '571304600737-nfvsh00822f4b5p00msetkld6qq11vf2.apps.googleusercontent.com';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

// 只允許正式站 + 本機開發
function isAllowedOrigin(origin) {
  return origin === 'https://lancelotwang114.github.io'
    || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = isAllowedOrigin(origin);
    const cors = {
      'Access-Control-Allow-Origin': allowed ? origin : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (!allowed) return json({ error: 'origin_not_allowed' }, 403, cors);
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, cors);
    if (!env.GOOGLE_CLIENT_SECRET) return json({ error: 'secret_not_configured' }, 500, cors);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad_json' }, 400, cors);
    }

    const path = new URL(request.url).pathname;
    let params;
    if (path === '/exchange') {
      if (!body.code) return json({ error: 'missing_code' }, 400, cors);
      params = {
        code: body.code,
        client_id: CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: 'postmessage', // GIS popup 模式的 code 用這個固定值
        grant_type: 'authorization_code',
      };
    } else if (path === '/refresh') {
      if (!body.refresh_token) return json({ error: 'missing_refresh_token' }, 400, cors);
      params = {
        refresh_token: body.refresh_token,
        client_id: CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        grant_type: 'refresh_token',
      };
    } else {
      return json({ error: 'not_found' }, 404, cors);
    }

    // 直接把 Google 的回應（含錯誤）原樣轉回前端，前端據此決定 fallback
    const resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    });
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  },
};

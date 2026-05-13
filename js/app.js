/*!
 * Freelance Tracker (Cloud)
 * https://github.com/lancelotwang114/freelance-tracker-cloud
 *
 * Copyright (c) 2026 lancelotwang114. All rights reserved.
 * Licensed under PolyForm Noncommercial License 1.0.0
 * https://polyformproject.org/licenses/noncommercial/1.0.0/
 *
 * Required Notice: Copyright (c) 2026 lancelotwang114
 *
 * Commercial use is prohibited without prior written permission from the copyright holder.
 * 任何商業用途（販售、公司內部使用、嵌入收費產品、SaaS hosting 等）均需事先書面授權。
 * 商業授權請至 https://github.com/lancelotwang114/freelance-tracker-cloud 開 issue 洽詢。
 */

/* =========================================
   外包收益與排程管理 - 主程式
   ========================================= */

// ============== Data Layer ==============
// v3.0.0-alpha.1：所有 localStorage key 加 cloud- 前綴，與 v2（同 origin lancelotwang114.github.io）完全隔離
const STORAGE_KEY = 'cloud-freelance-tracker-v1';
const CONFIG_KEY = 'cloud-freelance-tracker-config';
const APP_VERSION = '2026-05-13-v3.24.28';  // 與 index.html 的 meta、service-worker.js 的 CACHE_VERSION 同步

// ============== ☁️ Cloud Auth Layer（v3.0.0-alpha.1 起新增）==============
// 後續 commit 會在這個區塊加：sync indicator 接通 / 持久化（token + 過期時間）/ 操作日誌埋點
// 目前已就位：常數、auth state、init / sign-in / sign-out / token revoke / userinfo 抓取與 UI 渲染。
//
// GOOGLE_CLIENT_ID
//   GCP Console「OAuth 2.0 用戶端 ID」(Web application) 產出的值。
//   屬於 lancelotwang114 個人專案 freelance-tracker-cloud。
//   ※ Client ID 是 public 安全的：Google OAuth 設計上要在前端揭露，靠 GCP「已授權的 JavaScript 來源」白名單擋偽造。
//   ※ Client SECRET 才是 secret，但 GIS Token Client（前端隱式流）根本不用 Client Secret。
//   已授權的 JavaScript 來源（在 GCP Console 設定）：
//     - https://lancelotwang114.github.io（GitHub Pages 正式部署）
//     - http://localhost:8080（本機 python -m http.server 預設）
//     - http://127.0.0.1:5500（VS Code Live Server）
const GOOGLE_CLIENT_ID = '571304600737-nfvsh00822f4b5p00msetkld6qq11vf2.apps.googleusercontent.com';

// DRIVE_SCOPE
//   drive.appfolder：只能存取本 app 自己建的「應用程式資料夾」，看不到使用者其他 Drive 檔案。
//   權限粒度最小、Google 也不需審核（非機敏 scope）。
//   參考：https://developers.google.com/workspace/drive/api/guides/appdata
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appfolder';

// AUTH_SCOPES
//   登入時實際請求的全部 scope。drive.appfolder 不含使用者基本資訊，必須額外加：
//     - openid：發 ID token（之後 commit 6 持久化登入狀態用得到）
//     - email：oauth2/v3/userinfo 回傳 email
//     - profile：oauth2/v3/userinfo 回傳 name / picture
//     - calendar.events：v3.1.0 起新增，能讀寫使用者選定的單一 Calendar 內事件
//   都是非機敏 scope，使用者授權畫面會多列出對應權限。
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const CALENDAR_LIST_SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const AUTH_SCOPES = `openid email profile ${DRIVE_SCOPE} ${CALENDAR_SCOPE} ${CALENDAR_LIST_SCOPE}`;

// CLOUD_AUTH_KEY：access token + 過期時間 + user info 存在這個 localStorage key
// 跟 v2 隔離（cloud- 前綴）；存的內容：{ accessToken, tokenExpiresAt, user: { name, email, picture } }
// 不存 refresh token（GIS 隱式流不發 refresh token），1 小時後 token 自然過期再請使用者重登
const CLOUD_AUTH_KEY = 'cloud-freelance-tracker-auth';

// ---------- 認證狀態（記憶體 + localStorage 雙層）----------
let cloudAuthState = {
  initialized: false,    // GIS SDK 是否 init 完成
  tokenClient: null,     // google.accounts.oauth2.TokenClient instance
  accessToken: null,     // 目前的 access token（過期就要重新登入）
  tokenExpiresAt: 0,     // token 過期的 ms epoch
  user: null             // {name, email, picture} 或 null
};

// ---------- 持久化（v3.0.0-alpha.1 commit 6）----------

// 把當前 cloudAuthState 寫入 localStorage（登入成功後呼叫）
function cloudSaveAuthState() {
  try {
    const payload = {
      accessToken: cloudAuthState.accessToken,
      tokenExpiresAt: cloudAuthState.tokenExpiresAt,
      user: cloudAuthState.user,
    };
    localStorage.setItem(CLOUD_AUTH_KEY, JSON.stringify(payload));
  } catch (e) {
    // localStorage 滿了 / 隱私模式禁寫 → 算了，下次重整就要重登
    console.warn('[cloud-auth] save failed:', e);
  }
}

// 從 localStorage 還原 cloudAuthState（app 啟動時呼叫）
// 回傳 true = 還原成功（有 user info）；false = 沒資料 / 損壞 / 沒 user info
// v3.24.9：token 過期不再立刻清掉 — 改成保留 user info，啟動時觸發 silent refresh 自動補新 token
//   解決「關掉 app 過 1 hr 重開 → 看到被登出」的問題
function cloudLoadAuthState() {
  let raw;
  try {
    raw = localStorage.getItem(CLOUD_AUTH_KEY);
  } catch (_) { return false; }
  if (!raw) return false;

  let data;
  try {
    data = JSON.parse(raw);
  } catch (_) {
    try { localStorage.removeItem(CLOUD_AUTH_KEY); } catch (_) {}
    return false;
  }

  // v3.24.9：只要有 user info 就還原（不管 token 是否過期）
  // user info 是 user 主動登入後才有，沒了表示 user 主動登出（cloudClearAuthState）
  if (!data.user) {
    try { localStorage.removeItem(CLOUD_AUTH_KEY); } catch (_) {}
    return false;
  }

  // 還原所有狀態（即使 token 已過期也載入，讓 cloudInitGoogleAuth 的 boot refresh 接手補新 token）
  cloudAuthState.accessToken = data.accessToken || null;
  cloudAuthState.tokenExpiresAt = data.tokenExpiresAt || 0;
  cloudAuthState.user = data.user;
  return true;
}

// 清掉 localStorage（登出時呼叫）
function cloudClearAuthState() {
  try { localStorage.removeItem(CLOUD_AUTH_KEY); } catch (_) {}
}

// 切換三個狀態 div 的顯示（pending / signed-out / signed-in）
function cloudShowAuthState(state) {
  ['pending', 'signed-out', 'signed-in'].forEach(s => {
    const el = document.getElementById('cloud-auth-' + s);
    if (!el) return;
    el.classList.toggle('hidden', s !== state);
  });
}

// GIS SDK 是 async 載入，可能比 app.js 晚 ready，用 polling 等
function cloudWaitForGoogleSDK(maxAttempts = 50) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const tick = () => {
      if (window.google && window.google.accounts && window.google.accounts.oauth2 && window.google.accounts.oauth2.initTokenClient) {
        resolve();
      } else if (++n >= maxAttempts) {
        reject(new Error('GIS SDK 載入逾時（10 秒）'));
      } else {
        setTimeout(tick, 200);
      }
    };
    tick();
  });
}

// app 啟動時自動呼叫一次（檔尾有自啟動 IIFE）
async function cloudInitGoogleAuth() {
  // Step 1：先試著從 localStorage 還原（v3.0.0-alpha.1 commit 6）
  // 若 token 還沒過期，立刻渲染為「已登入」，不用等 GIS SDK 載入
  const restored = cloudLoadAuthState();
  if (restored) {
    cloudRenderSignedIn();
  } else {
    cloudShowAuthState('pending');
  }

  // Step 2：等 GIS SDK ready（async 載入無保證）
  try {
    await cloudWaitForGoogleSDK();
  } catch (e) {
    console.error('[cloud-auth] init failed:', e);
    if (!restored) {
      cloudShowAuthState('signed-out');
      const hint = document.getElementById('cloud-signin-disabled-hint');
      if (hint) hint.textContent = '⚠️ Google 登入元件載入失敗，請檢查網路或刷新頁面';
    }
    // 若已從 localStorage 還原為已登入，就維持那個畫面（cached token 還能用，到期前不阻擋使用者）
    return;
  }

  cloudAuthState.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: AUTH_SCOPES,  // openid + email + profile + drive.appfolder
    callback: cloudOnTokenResponse,
  });
  cloudAuthState.initialized = true;

  // 啟用按鈕、清掉「初始化中」hint
  const btn = document.getElementById('cloud-signin-btn');
  if (btn) btn.disabled = false;
  const hint = document.getElementById('cloud-signin-disabled-hint');
  if (hint) hint.style.display = 'none';

  // 若還沒從還原進入「已登入」狀態，才需要切到 signed-out（已登入則維持）
  if (!restored) {
    cloudShowAuthState('signed-out');
    cloudUpdateSyncIndicator();  // v3.0.0-alpha.1 commit 5：top-bar 顯示「○ 未連雲端」
  } else {
    // v3.22.2：從 localStorage 還原為已登入 → 排程 silent refresh
    // v3.22.10：啟動時若 token 剩不到 30 分鐘，主動先 refresh 一次（不等 setTimeout）
    // 防護「user 上次離開時 token 還有時間，但離開期間電腦睡眠 / 分頁休眠」的情境
    const remainingOnBoot = cloudAuthState.tokenExpiresAt - Date.now();
    // v3.24.28：啟動主動 refresh 門檻從 30 分鐘放寬到 45 分鐘，更積極預防 token 過期
    const PROACTIVE_REFRESH_THRESHOLD = 45 * 60 * 1000; // 45 分鐘
    if (remainingOnBoot < PROACTIVE_REFRESH_THRESHOLD) {
      console.log(`[cloud-auth] boot: token has ${Math.round(remainingOnBoot/60000)}min left, refresh now`);
      _silentRefresh();
    } else {
      _scheduleSilentRefresh();
    }
  }
  // restored 的情境 cloudRenderSignedIn() 已經在前面呼叫過 cloudUpdateSyncIndicator()
  // v3.24.24：防禦性保險 — 不論哪條路徑，init 完成都強制再呼叫一次
  // 修「重整後 sync-indicator 殘留 HTML 預設值『○ 未啟用』而沒被覆蓋」的 bug
  // （可能因為前面 await cloudWaitForGoogleSDK 期間 DOM race / async timing 造成 indicator 沒成功覆蓋）
  cloudUpdateSyncIndicator();

  // v3.22.2 + v3.22.10：多重事件觸發 refresh check
  // 分頁休眠（Chrome Tab Discarding / Edge Sleeping Tabs）會讓 setTimeout 暫停，
  // 用戶切回時 token 可能已過期。三事件並用最大化覆蓋率。
  // v3.24.22：除了 refresh，也順便 throttle 拉雲端最新（家裡推完 → 公司切回分頁自動拿）
  const _checkAndRefreshIfNeeded = (trigger) => {
    if (!cloudAuthState.accessToken || !cloudAuthState.tokenExpiresAt) return;
    const remaining = cloudAuthState.tokenExpiresAt - Date.now();
    if (remaining < REFRESH_BEFORE_EXPIRY_MS) {
      console.log(`[cloud-auth] ${trigger} → token expiring (${Math.round(remaining/60000)}min left), refresh now`);
      _silentRefresh();  // silent refresh 成功會自動 pull（v3.24.22 加的）
    } else {
      _scheduleSilentRefresh();  // 重排（覆蓋可能被休眠壓制的舊 timer）
      // v3.24.22：即使 token 還新，也 throttle 後 auto pull 一次（5 分鐘節流，不會狂打 API）
      if (typeof cloudAutoPullThrottled === 'function') {
        cloudAutoPullThrottled(trigger);
      }
    }
    cloudUpdateSyncIndicator();
  };

  // 1. visibilitychange：分頁從背景切回前景
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      _checkAndRefreshIfNeeded('visibilitychange');
    } else {
      // v3.24.13：切到背景前 → 立刻 flush 還沒推送的資料（不等 debounce）
      if (typeof cloudFlushPush === 'function') cloudFlushPush();
    }
  });

  // 2. focus：視窗從別的 app / tab 切回（mousemove 也算）— 比 visibilitychange 更早觸發
  window.addEventListener('focus', () => _checkAndRefreshIfNeeded('focus'));

  // 3. pageshow：BFCache 恢復（瀏覽器「上一頁」回來、或從休眠喚醒）
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) _checkAndRefreshIfNeeded('pageshow-bfcache');
  });

  // v3.24.13：beforeunload — 關 tab 前最後一次嘗試 flush（不一定能跑完，但盡力）
  window.addEventListener('beforeunload', () => {
    if (typeof cloudFlushPush === 'function') cloudFlushPush();
  });

  // v3.24.15：navigator.onLine 變化 — 離線標記 banner、上線立刻重推
  window.addEventListener('online', () => {
    console.log('[network] 網路恢復');
    if (typeof toast === 'function') toast('🌐 網路恢復，自動重新同步…', 3000);
    cloudPushFailRetries = 0;  // 歸零，立刻重試（不等指數退避）
    if (typeof cloudPushNow === 'function') {
      cloudPushNow().catch(() => {});
    }
  });
  window.addEventListener('offline', () => {
    console.log('[network] 離線');
    if (typeof cloudSetSyncStatus === 'function') {
      cloudSetSyncStatus('error', '📵 離線中，網路恢復後自動同步');
    }
  });

  // v3.22.3：啟動 indicator ticker，讓「30 秒前」自動跳成「1 分前」「2 分前」…
  cloudStartIndicatorTicker();
}

// 點「使用 Google 登入」按鈕（index.html 的 onclick 直接呼叫）
function cloudSignIn() {
  if (!cloudAuthState.initialized || !cloudAuthState.tokenClient) {
    alert('Google 登入元件還沒準備好，請稍候再試');
    return;
  }
  // prompt: '' = 已授權直接放行、未授權跳同意畫面（一般情境用這個）
  // v3.24.22：帶 hint 加速重登 — 指定上次的 Google 帳號，避免跳出帳號選擇器
  const hint = cloudAuthState.user && cloudAuthState.user.email;
  cloudAuthState.tokenClient.requestAccessToken({
    prompt: '',
    ...(hint ? { hint } : {})
  });
}

// ---------- v3.22.2 + v3.22.10：silent token refresh（無感續約 + 多重防護）----------
// GIS 隱式流的 access token 一律 1 小時過期，且不發 refresh token。
// 但只要 Google session 還有效，呼叫 requestAccessToken({ prompt: '' }) 就能直接拿到新 token。
// 過期前 5 分鐘自動跑一次。
//
// v3.22.10 強化（解決分頁休眠 / 電腦睡眠導致 setTimeout 暫停）：
//   1. focus / pageshow / visibilitychange 三事件都會觸發 refresh check
//   2. 失敗 retry 1 次（5 秒後）
//   3. 失敗時不清 cloudAuthState，避免「無預警閃登出」— 改顯示 sync error，user 主動點重登
//   4. 加詳細 console log，方便 user F12 自己看
// v3.24.28：時機提前到過期前 15 分鐘（之前 5 分鐘）— 讓 retry 有更多時間，降低重登機率
const REFRESH_BEFORE_EXPIRY_MS = 15 * 60 * 1000; // 過期前 15 分鐘預先 refresh
// v3.24.25：指數退避陣列（覆蓋 35 秒總長，能挺過更長的網路抖動）
// 之前固定 5 秒 × 1 次太保守，網路抖動就跳紅 banner；改成 5s → 10s → 20s 共 3 次
const REFRESH_RETRY_DELAYS_MS = [5000, 10000, 20000];
const MAX_REFRESH_RETRIES = REFRESH_RETRY_DELAYS_MS.length;  // 3
let _silentRefreshTimer = null;
let _silentRefreshRetryTimer = null;
let _isSilentRefreshing = false;  // 區分手動登入 vs 背景 refresh
let _silentRefreshRetries = 0;    // 連續失敗次數（成功就歸零）

function _scheduleSilentRefresh() {
  if (_silentRefreshTimer) {
    clearTimeout(_silentRefreshTimer);
    _silentRefreshTimer = null;
  }
  if (!cloudAuthState.tokenExpiresAt || !cloudAuthState.tokenClient) return;
  const refreshAt = cloudAuthState.tokenExpiresAt - REFRESH_BEFORE_EXPIRY_MS;
  const delay = refreshAt - Date.now();
  if (delay <= 0) {
    console.log('[cloud-auth] token already expiring, refresh immediately');
    _silentRefresh();
  } else {
    console.log('[cloud-auth] schedule next refresh in', Math.round(delay / 60000), 'min');
    _silentRefreshTimer = setTimeout(_silentRefresh, delay);
  }
}

// v3.24.27：silent refresh safety timer — 30 秒沒收到 callback 就強制 reset
// 防護「GIS SDK 因網路 / 內部 bug 卡住不 callback」造成 _isSilentRefreshing 永遠 true
let _silentRefreshSafetyTimer = null;
const SILENT_REFRESH_SAFETY_TIMEOUT_MS = 30 * 1000;

function _silentRefresh() {
  if (!cloudAuthState.tokenClient) {
    console.warn('[cloud-auth] silent refresh skipped: tokenClient not ready');
    return;
  }
  if (_isSilentRefreshing) {
    console.log('[cloud-auth] silent refresh already in progress, skip');
    return;
  }
  _isSilentRefreshing = true;
  console.log('[cloud-auth] silent refresh starting…');
  // v3.24.27：safety timer — 30 秒沒 callback 視為 GIS 卡住，強制 reset 才能再試
  if (_silentRefreshSafetyTimer) clearTimeout(_silentRefreshSafetyTimer);
  _silentRefreshSafetyTimer = setTimeout(() => {
    if (_isSilentRefreshing) {
      console.warn('[cloud-auth] silent refresh stuck 30s，force reset 旗標');
      _isSilentRefreshing = false;
      _handleSilentRefreshFailure('GIS SDK 30 秒沒回應，可能網路問題');
    }
  }, SILENT_REFRESH_SAFETY_TIMEOUT_MS);
  try {
    // v3.24.22：帶 hint 加速 silent refresh（指定上次的 Google 帳號，避免多帳號切換）
    const hint = cloudAuthState.user && cloudAuthState.user.email;
    cloudAuthState.tokenClient.requestAccessToken({
      prompt: '',
      ...(hint ? { hint } : {})
    });
  } catch (e) {
    _isSilentRefreshing = false;
    if (_silentRefreshSafetyTimer) {
      clearTimeout(_silentRefreshSafetyTimer);
      _silentRefreshSafetyTimer = null;
    }
    console.warn('[cloud-auth] silent refresh threw:', e);
    _handleSilentRefreshFailure(e?.message || String(e));
  }
}

// v3.24.22：節流版自動拉取雲端 — 5 分鐘內最多一次
// 觸發時機：visibilitychange / focus / silent refresh 成功 / heartbeat 偵測到睡眠喚醒
let _lastAutoPullAt = 0;
const AUTO_PULL_THROTTLE_MS = 5 * 60 * 1000;
function cloudAutoPullThrottled(trigger) {
  if (!isCloudSignedIn()) return;
  const now = Date.now();
  if (now - _lastAutoPullAt < AUTO_PULL_THROTTLE_MS) {
    console.log(`[auto-pull] ${trigger}: throttled (${Math.round((now - _lastAutoPullAt)/1000)}s < 5min)`);
    return;
  }
  _lastAutoPullAt = now;
  console.log(`[auto-pull] ${trigger}: pulling…`);
  if (typeof cloudPullNow === 'function') {
    // v3.24.23：auto 觸發 → silent 模式，不跳 alert（race condition 時 token 失效不會打斷使用者）
    cloudPullNow(true).catch(e => console.warn('[auto-pull] failed:', e));
  }
}

// v3.24.22：心跳偵測 — 每 30 秒檢查「距上次心跳的時間差」
// 如果差 > 5 分鐘 = 表示電腦睡眠 / 分頁 throttle 過 → 補 silent refresh + auto pull
// （setInterval 在背景會被 throttle 但喚醒後就會 catch up，比 setTimeout 可靠）
let _lastHeartbeatAt = Date.now();
const HEARTBEAT_CHECK_MS = 30 * 1000;
const HEARTBEAT_STALE_MS = 5 * 60 * 1000;
function _heartbeatTick() {
  const now = Date.now();
  const gap = now - _lastHeartbeatAt;
  _lastHeartbeatAt = now;
  if (gap > HEARTBEAT_STALE_MS && isCloudSignedIn()) {
    console.log(`[heartbeat] gap=${Math.round(gap/1000)}s，電腦剛醒 / tab throttle 結束 → 補 refresh + pull`);
    const remaining = cloudAuthState.tokenExpiresAt - now;
    if (remaining < REFRESH_BEFORE_EXPIRY_MS) {
      _silentRefresh();  // silent refresh 成功後會自動 pull（修法 1 加進去的）
    } else {
      cloudAutoPullThrottled('heartbeat-wake');
    }
  }
}
setInterval(_heartbeatTick, HEARTBEAT_CHECK_MS);

// v3.24.28：periodic refresh check — 每 20 分鐘背景檢查 token 還剩多少
// 即使 visibilitychange / focus / heartbeat 都沒觸發，這個會主動跑
// 目的：把「重登頻率」降到最低（純前端的極致）
const PERIODIC_REFRESH_CHECK_MS = 20 * 60 * 1000;
const PERIODIC_REFRESH_THRESHOLD = 30 * 60 * 1000;  // 剩 < 30 分鐘就主動 refresh
function _periodicRefreshCheck() {
  if (!isCloudSignedIn() || !cloudAuthState.tokenExpiresAt) return;
  const remaining = cloudAuthState.tokenExpiresAt - Date.now();
  if (remaining < PERIODIC_REFRESH_THRESHOLD) {
    console.log(`[cloud-auth] periodic check: token ${Math.round(remaining/60000)}min left → 主動 refresh`);
    _silentRefresh();
  }
}
setInterval(_periodicRefreshCheck, PERIODIC_REFRESH_CHECK_MS);

// v3.22.10：silent refresh 失敗時的處理（不清 state，retry 後仍 fail 才提示）
// v3.24.25：指數退避（5s → 10s → 20s），總共 3 次 retry 容忍 35 秒網路抖動
function _handleSilentRefreshFailure(errMsg) {
  if (_silentRefreshRetries < MAX_REFRESH_RETRIES) {
    const delay = REFRESH_RETRY_DELAYS_MS[_silentRefreshRetries] || REFRESH_RETRY_DELAYS_MS[REFRESH_RETRY_DELAYS_MS.length - 1];
    _silentRefreshRetries++;
    console.log(`[cloud-auth] silent refresh retry #${_silentRefreshRetries}/${MAX_REFRESH_RETRIES} in ${delay/1000}s`);
    if (_silentRefreshRetryTimer) clearTimeout(_silentRefreshRetryTimer);
    _silentRefreshRetryTimer = setTimeout(_silentRefresh, delay);
    return;
  }
  // 重試也失敗 → 通知 user 但不清 state（避免閃登出）
  _silentRefreshRetries = 0;
  console.error('[cloud-auth] silent refresh failed after retries:', errMsg);
  // v3.24.13：toast 飄一下不夠醒目 → 觸發 banner（cloudSetSyncStatus 會連動 banner）
  if (typeof cloudSetSyncStatus === 'function') {
    cloudSetSyncStatus('error', 'Google 連線過期，請點右上角「重新登入」');
  }
  if (typeof toast === 'function') {
    toast('⚠️ Google 連線過期，請點頂部紅條重新登入（資料未同步）', 10000);
  }
}

// GIS callback：拿到 access token（成功 or 失敗都會進這裡）
async function cloudOnTokenResponse(resp) {
  // v3.22.2：抓 silent refresh flag 後立刻清，避免後續流程誤判
  const wasSilentRefresh = _isSilentRefreshing;
  _isSilentRefreshing = false;
  // v3.24.27：GIS callback 來了 → 清 safety timer（避免 30 秒後誤觸發 force reset）
  if (_silentRefreshSafetyTimer) {
    clearTimeout(_silentRefreshSafetyTimer);
    _silentRefreshSafetyTimer = null;
  }

  if (resp.error) {
    console.error('[cloud-auth] token error:', resp);
    if (wasSilentRefresh) {
      // v3.22.10：背景 refresh 失敗 → 走 retry 流程（不清 state，避免閃登出）
      _handleSilentRefreshFailure(resp.error_description || resp.error);
    } else {
      // 手動登入失敗 → 維持原本 alert
      alert('Google 登入失敗：' + (resp.error_description || resp.error));
    }
    return;
  }

  const expiresIn = parseInt(resp.expires_in, 10) || 3600;
  cloudAuthState.accessToken = resp.access_token;
  cloudAuthState.tokenExpiresAt = Date.now() + expiresIn * 1000;
  // v3.22.10：成功 → retry 計數歸零
  _silentRefreshRetries = 0;
  // v3.24.25：成功時也清掉 retry timer，避免之前失敗排的 retry timer 在成功後 5-20 秒又跑一次多餘的 silent refresh
  if (_silentRefreshRetryTimer) {
    clearTimeout(_silentRefreshRetryTimer);
    _silentRefreshRetryTimer = null;
  }

  // v3.22.2：silent refresh 只更新 token + 持久化，不要重抓 userinfo / 不要重跳 calendar prompt
  if (wasSilentRefresh) {
    cloudSaveAuthState();
    if (typeof logAction === 'function') {
      logAction('cloud-token-refresh', { email: cloudAuthState.user && cloudAuthState.user.email });
    }
    _scheduleSilentRefresh();  // 排下一次 refresh
    // v3.22.10：refresh 成功時若之前是 sync error 狀態，恢復為正常
    const wasErrorState = cloudSyncStatus === 'error';
    if (wasErrorState && typeof cloudSetSyncStatus === 'function') {
      cloudSetSyncStatus('idle');
    }
    console.log('[cloud-auth] silent refresh ok, next refresh in ~', Math.round((expiresIn - 300) / 60), 'min');
    // v3.24.22：silent refresh 成功 → 自動拉雲端最新（解「重登後要手動按同步」bug）
    // 從 error 恢復的話一定要 pull；正常 refresh 也 pull（會被 5 分鐘節流擋）
    if (typeof cloudAutoPullThrottled === 'function') {
      if (wasErrorState) {
        // 從錯誤恢復 → 重設節流，立刻 pull
        _lastAutoPullAt = 0;
      }
      cloudAutoPullThrottled(wasErrorState ? 'silent-refresh-recover' : 'silent-refresh-ok');
    }
    return;
  }

  // 以下是首次登入 / 手動重登的完整流程：
  // 拿 userinfo（name / email / 大頭貼）
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': 'Bearer ' + resp.access_token },
    });
    if (!r.ok) throw new Error('userinfo HTTP ' + r.status);
    const u = await r.json();
    cloudAuthState.user = {
      name: u.name || '',
      email: u.email || '',
      picture: u.picture || '',
    };
  } catch (e) {
    console.error('[cloud-auth] userinfo failed:', e);
    // userinfo 拿不到不代表登入失敗，token 還是可用，只是 UI 顯示降級
    cloudAuthState.user = { name: '已登入', email: '（無法取得帳號資訊）', picture: '' };
  }

  // v3.0.0-alpha.1 commit 6：登入成功 → 寫入 localStorage 持久化
  cloudSaveAuthState();
  cloudRenderSignedIn();

  // v3.0.0-alpha.1 commit 7：寫進操作日誌（注意：不記 token，只記 email）
  if (typeof logAction === 'function') {
    logAction('cloud-signin', { email: cloudAuthState.user && cloudAuthState.user.email });
  }

  // v3.0.0-alpha.2：登入成功後立刻初始化 tracker.json（fire-and-forget）
  // 失敗不影響登入狀態，使用者可看 console / 日誌
  cloudInitTrackerFile().catch(e => console.error('[cloud-init] async failed:', e));

  // v3.7.0：首次登入後 prompt「要不要啟用行事曆同步」
  setTimeout(cloudMaybeShowCalendarPrompt, 1500);

  // v3.22.2：登入成功後排程 silent refresh（過期前 5 分鐘自動續約）
  _scheduleSilentRefresh();
}

// v3.7.0：登入後跳一次 prompt 介紹 Calendar 同步
const CAL_PROMPT_KEY = 'cloud-ftCalendarPromptShown_v1';
function cloudMaybeShowCalendarPrompt() {
  if (!isCloudSignedIn()) return;
  // 已 prompt 過 → 不重複跳
  if (localStorage.getItem(CAL_PROMPT_KEY) === '1') return;
  // 已啟用 → 不需要 prompt（使用者已經設定過了）
  const cfg = cloudGetCalendarConfig();
  if (cfg.enabled) { localStorage.setItem(CAL_PROMPT_KEY, '1'); return; }
  const modal = document.getElementById('cal-prompt-modal');
  if (modal) modal.classList.add('open');
}

function cloudAcceptCalendarPrompt() {
  localStorage.setItem(CAL_PROMPT_KEY, '1');
  cloudSaveCalendarConfig({ enabled: true });
  document.getElementById('cal-prompt-modal')?.classList.remove('open');
  switchTab('settings');
  // 等切過去後展開行事曆卡 + 滾過去
  setTimeout(() => {
    const card = document.getElementById('card-calendar');
    if (card) {
      card.classList.remove('collapsed');
      cloudRenderCalendarUI();
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 200);
  if (typeof logAction === 'function') logAction('cloud-calendar-prompt-accept');
}

function cloudDismissCalendarPrompt() {
  localStorage.setItem(CAL_PROMPT_KEY, '1');
  document.getElementById('cal-prompt-modal')?.classList.remove('open');
  toast('行事曆同步已跳過。需要時可到「設定 → 📅 Google 行事曆同步」啟用。', 5000);
  if (typeof logAction === 'function') logAction('cloud-calendar-prompt-dismiss');
}

// 把 cloudAuthState.user 渲染到「已登入」區塊
function cloudRenderSignedIn() {
  if (!cloudAuthState.user) return;
  const u = cloudAuthState.user;
  const setText = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };
  setText('cloud-account-name', u.name || u.email || '（已登入）');
  setText('cloud-account-email', u.email || '');
  setText('cloud-auth-status', '已登入');

  const avatar = document.getElementById('cloud-account-avatar');
  if (avatar) {
    if (u.picture) {
      avatar.src = u.picture;
      avatar.style.display = '';
    } else {
      avatar.removeAttribute('src');
      avatar.style.display = 'none';
    }
  }
  cloudShowAuthState('signed-in');
  cloudUpdateSyncIndicator();  // v3.0.0-alpha.1 commit 5：top-bar 顯示「✓ 已連 Drive」
}

// 點「登出」按鈕（index.html 的 onclick 直接呼叫）
// 策略：先清本機 state + UI 切回未登入（即使 revoke 失敗也讓使用者有登出體驗），
// 再非同步呼叫 google.accounts.oauth2.revoke 通知 Google 撤銷 token。
function cloudSignOut() {
  // v3.0.0-alpha.1 commit 7：先抓 email 再清 state，才記得到誰登出
  const prevEmail = cloudAuthState.user && cloudAuthState.user.email;

  const token = cloudAuthState.accessToken;
  cloudAuthState.accessToken = null;
  cloudAuthState.tokenExpiresAt = 0;
  cloudAuthState.user = null;

  // v3.0.0-alpha.1 commit 6：清 localStorage 防止下次重整又恢復為已登入
  cloudClearAuthState();
  // α2-4a：登出時也清 last-synced 快照（避免別人登入時拿到舊 base 用錯）
  try { localStorage.removeItem(CLOUD_LAST_SYNCED_KEY); } catch (_) {}
  try { localStorage.removeItem(CLOUD_META_KEY); } catch (_) {}

  const setText = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.textContent = txt;
  };
  setText('cloud-auth-status', '未登入');
  cloudShowAuthState('signed-out');
  cloudUpdateSyncIndicator();  // v3.0.0-alpha.1 commit 5：top-bar 切回「○ 未連雲端」

  if (token && window.google && window.google.accounts && window.google.accounts.oauth2 && window.google.accounts.oauth2.revoke) {
    google.accounts.oauth2.revoke(token, () => {
      // revoke 完成（不一定要做事；revoke 失敗也沒差，token 反正會自然過期）
    });
  }

  // v3.0.0-alpha.1 commit 7：寫進操作日誌
  if (typeof logAction === 'function') {
    logAction('cloud-signout', { email: prevEmail });
  }
}

// ---------- top-bar sync indicator 接通（v3.0.0-alpha.1 commit 5）----------

// 把 top-bar 右上角 #sync-indicator 改成反映 v3 雲端同步狀態
// 多態（α2-5 升級）：
//   未登入            → 灰    ○ 未連雲端
//   已登入 + idle     → 綠    ✓ 已同步
//   已登入 + pending  → 藍    ⌛ 待同步…（debounce 計時中，等使用者連續編輯結束）
//   已登入 + syncing  → 藍    ⏳ 同步中…（push API 進行中）
//   已登入 + error    → 紅    ✗ 同步失敗（會跟著「最近錯誤訊息」hover 看得到）
// 注意：v2 既有 setSyncStatus() 已加 short-circuit 讓位，這個 helper 是唯一寫 indicator 的入口
let cloudSyncStatus = 'idle';      // idle | pending | syncing | error
let cloudLastSyncError = null;     // 最近一次失敗訊息，用於 indicator hover

function cloudSetSyncStatus(status, errMsg) {
  const prev = cloudSyncStatus;
  cloudSyncStatus = status;
  cloudLastSyncError = errMsg || null;
  cloudUpdateSyncIndicator();
  // v3.24.13：error / 未登入 → 顯示頂部紅色固定 banner（強提示）
  if (typeof cloudUpdateSyncBanner === 'function') cloudUpdateSyncBanner();
  // v3.23.2：mascot 跟著反應
  // syncing/pending → loading；error → error；success（從 error 恢復）→ success；其他 → 不動
  if (typeof mascotSetState === 'function') {
    if (status === 'error' && prev !== 'error') mascotSetState('error');
    else if (status === 'idle' && prev === 'error') mascotSetState('success');
    else if (status === 'syncing' || status === 'pending') {
      // 只在 mascot 目前是 idle 時才切 loading（避免覆蓋其他事件的 success/error）
      if (mascotState && mascotState.current === 'idle') mascotSetState('loading');
    } else if (status === 'idle' && (mascotState && mascotState.current === 'loading')) {
      mascotSetState('idle');
    }
  }
}

// v3.24.15：cloud init 期間的 loading overlay
// 防止使用者在 mergeStates 跑完之前編輯資料 — race condition 會讓使用者剛改的東西被合併結果蓋掉
function showInitOverlay() {
  let o = document.getElementById('init-overlay');
  if (!o) {
    o = document.createElement('div');
    o.id = 'init-overlay';
    o.className = 'init-overlay';
    o.innerHTML = `
      <div class="init-overlay-spinner"></div>
      <div class="init-overlay-msg">☁️ 從 Google Drive 載入資料中…</div>
      <div class="init-overlay-hint">為避免資料衝突，請稍候 1–3 秒，這段時間先不要編輯</div>
    `;
    document.body.appendChild(o);
  } else {
    o.style.display = 'flex';
  }
}
function hideInitOverlay() {
  const o = document.getElementById('init-overlay');
  if (o) o.remove();
  // v3.24.23：順手 reset init 旗標（cloudInitTrackerFile 每個 return 路徑都走這個函式）
  if (typeof cloudInitInProgress !== 'undefined') cloudInitInProgress = false;
}

// v3.24.13：頂部紅色固定 banner — 同步失敗 / 未登入時強提示
// 出現條件：
//   1. 已登入但 sync error → 「⚠️ 資料未同步到雲端」+ 立刻重試 + 重新登入按鈕
//   2. 未登入但 localStorage 有資料 → 「⚠️ 未登入 Google，資料只在本機」+ 登入按鈕
function cloudUpdateSyncBanner() {
  let banner = document.getElementById('sync-error-banner');
  const signedIn = typeof isCloudSignedIn === 'function' && isCloudSignedIn();
  const hasLocalData = (state && (state.jobs || []).length > 0) || (state && (state.clients || []).length > 0);

  // 決定要不要顯示
  let show = false;
  let mode = '';   // 'sync-fail' / 'not-signed-in'
  let message = '';

  if (signedIn && cloudSyncStatus === 'error') {
    show = true;
    mode = 'sync-fail';
    const errLine = cloudLastSyncError ? `（${cloudLastSyncError}）` : '';
    message = `⚠️ 資料未同步到雲端${errLine}　本機資料安全，但兩地電腦不會即時一致`;
  } else if (!signedIn && hasLocalData) {
    show = true;
    mode = 'not-signed-in';
    message = '⚠️ 未登入 Google，資料只存在本機（其他電腦看不到最新版）';
  }

  if (!show) {
    if (banner) banner.remove();
    document.body.classList.remove('has-sync-banner');
    return;
  }

  // 建 banner（如果沒有）或更新現有
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'sync-error-banner';
    banner.className = 'sync-error-banner';
    document.body.prepend(banner);
    document.body.classList.add('has-sync-banner');
  }

  const btnHtml = mode === 'sync-fail'
    ? `<button class="sync-banner-btn" onclick="cloudRetryPush()">立刻重試</button>
       <button class="sync-banner-btn sync-banner-btn-outline" onclick="cloudSignIn()">重新登入</button>`
    : `<button class="sync-banner-btn" onclick="cloudSignIn()">立刻登入</button>`;

  banner.innerHTML = `
    <span class="sync-banner-msg">${message}</span>
    <span class="sync-banner-actions">${btnHtml}</span>
  `;
}

// v3.22.3：把 ISO 時間轉成中文相對時間（剛剛 / 30 秒前 / 5 分前 / 2 小時前 / 3 天前 / 5/1）
function cloudFormatRelativeTime(iso) {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '';
  const diff = Date.now() - t;
  if (diff < 10 * 1000) return '剛剛';
  if (diff < 60 * 1000) return Math.floor(diff / 1000) + ' 秒前';
  if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + ' 分前';
  if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + ' 小時前';
  if (diff < 7 * 24 * 60 * 60 * 1000) return Math.floor(diff / 86400000) + ' 天前';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// v3.22.3：把 ISO 時間轉成完整中文時間（給 hover title 顯示）
function cloudFormatFullTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('zh-TW', { hour12: false });
  } catch (_) { return iso; }
}

function cloudUpdateSyncIndicator() {
  const el = document.getElementById('sync-indicator');
  // v3.22.9：同時更新右側 account pill 的光暈狀態
  cloudRenderAccountPill();
  // v3.24.20：行事曆 master toggle 隨登入狀態切換 disabled / 提示
  if (typeof cloudUpdateCalSigninGate === 'function') cloudUpdateCalSigninGate();

  if (!el) return;

  if (!isCloudSignedIn()) {
    el.className = 'sync-indicator sync-idle';
    el.innerHTML = '○ 未連雲端';
    el.title = '尚未登入 Google Drive（點擊開啟設定頁登入）';
    return;
  }

  const email = (cloudAuthState.user && cloudAuthState.user.email) || '';
  const accountLine = email ? `\n帳號：${email}` : '';

  // v3.22.9：版本號搬到 hover title（debug 用），主顯示只留時間
  const meta = (typeof cloudGetMeta === 'function') ? cloudGetMeta() : {};
  const syncedVer = meta.lastSyncedVersion || 0;
  const syncedAt = meta.lastSyncedAt || null;
  const relTime = syncedAt ? cloudFormatRelativeTime(syncedAt) : '';
  const fullTime = syncedAt ? cloudFormatFullTime(syncedAt) : '';
  const verLine = syncedVer ? `\n雲端版本 #${syncedVer}` : '';
  const timeLine = syncedAt ? `\n最後同步：${fullTime}（${relTime}）` : '';

  // v3.24.15：未推送筆數標記
  const pendingTag = (cloudPendingChangesCount > 0) ? ` (${cloudPendingChangesCount})` : '';

  switch (cloudSyncStatus) {
    case 'pending':
      el.className = 'sync-indicator sync-syncing';
      el.innerHTML = `⌛ 推送中…${pendingTag}`;
      el.title = `本機有 ${cloudPendingChangesCount} 筆未上傳改動，2 秒後自動推送${timeLine}${verLine}${accountLine}`;
      break;
    case 'syncing':
      el.className = 'sync-indicator sync-syncing';
      el.innerHTML = `⏳ 同步中…${pendingTag}`;
      el.title = `正在推送到 Drive（${cloudPendingChangesCount} 筆改動）${timeLine}${verLine}${accountLine}`;
      break;
    case 'error': {
      el.className = 'sync-indicator sync-error';
      el.innerHTML = '✗ 同步失敗';
      const errLine = cloudLastSyncError ? `\n錯誤：${cloudLastSyncError}` : '';
      el.title = `Drive 同步失敗，本機資料安全，下次改動會自動重試${timeLine}${verLine}${accountLine}${errLine}`;
      break;
    }
    case 'idle':
    default:
      el.className = 'sync-indicator sync-synced';
      // 已同步過：顯示「✓ N 分前同步」；尚未同步過：「✓ 已連線」
      if (syncedAt) {
        el.innerHTML = `✓ ${relTime}同步`;
      } else {
        el.innerHTML = '✓ 已連線';
      }
      el.title = `Google Drive 已連線、資料已同步${timeLine}${verLine}${accountLine}\n（點擊開啟設定頁）`;
  }
}

// v3.22.10：點 pill 的行為 — 已登入 + sync error 時直接觸發重登；其他情況跳設定頁
function cloudOnPillClick() {
  if (isCloudSignedIn() && cloudSyncStatus === 'error') {
    // 連線過期/出錯 → 直接觸發重新登入（最常見的 case 是 token refresh 失敗）
    if (typeof toast === 'function') toast('正在重新連線 Google…', 3000);
    cloudSignIn();
    return;
  }
  switchTab('settings');
}

// v3.22.9：渲染右上 Google 帳號 pill（頭像 + 名字 + 光暈狀態）
function cloudRenderAccountPill() {
  const pill = document.getElementById('cloud-account-pill');
  if (!pill) return;

  // 未登入 → 「+ 登入」灰色 placeholder
  if (!isCloudSignedIn() || !cloudAuthState.user) {
    pill.classList.remove('status-synced', 'status-syncing', 'status-error');
    pill.classList.add('status-idle');
    pill.innerHTML = '<span class="pill-icon">＋</span><span class="pill-name">登入</span>';
    pill.title = '尚未登入 Google Drive（點擊登入）';
    return;
  }

  const u = cloudAuthState.user;
  // 名字優先顯示「first name」（取空白前段）；沒名字用 email 前綴
  const fullName = u.name || '';
  const displayName = fullName.split(' ')[0] || (u.email || '').split('@')[0] || '已登入';
  const picture = u.picture || '';

  // 光暈狀態跟著 cloudSyncStatus
  pill.classList.remove('status-synced', 'status-syncing', 'status-error', 'status-idle');
  switch (cloudSyncStatus) {
    case 'pending':
    case 'syncing':
      pill.classList.add('status-syncing');
      break;
    case 'error':
      pill.classList.add('status-error');
      break;
    case 'idle':
    default:
      pill.classList.add('status-synced');
  }

  // 頭像：有圖用 img，沒圖用第一個字
  const initial = (displayName[0] || '?').toUpperCase();
  const avatarHtml = picture
    ? `<img src="${picture}" alt="${escapeHtml(displayName)}" referrerpolicy="no-referrer">`
    : `<span class="pill-icon">${escapeHtml(initial)}</span>`;

  pill.innerHTML = `${avatarHtml}<span class="pill-name">${escapeHtml(displayName)}</span>`;

  // hover title：完整 email + 同步狀態文字
  const meta = (typeof cloudGetMeta === 'function') ? cloudGetMeta() : {};
  const syncedAt = meta.lastSyncedAt || null;
  const relTime = syncedAt ? cloudFormatRelativeTime(syncedAt) : '';
  const statusText = (cloudSyncStatus === 'error') ? '✗ 同步失敗'
    : (cloudSyncStatus === 'syncing' || cloudSyncStatus === 'pending') ? '⏳ 同步中'
    : (relTime ? `✓ ${relTime}同步` : '✓ 已連線');
  pill.title = `${u.email || ''}\n${statusText}\n（點擊開啟設定頁）`;
}

// v3.22.3：每 30 秒更新一次 indicator，讓相對時間「30 秒前」自動跳成「1 分前」等
let _syncIndicatorTickerId = null;
function cloudStartIndicatorTicker() {
  if (_syncIndicatorTickerId) return;
  _syncIndicatorTickerId = setInterval(() => {
    // 沒登入或已 destroy 就不浪費 tick；indicator DOM 沒掛上去也跳過
    if (!document.getElementById('sync-indicator')) return;
    cloudUpdateSyncIndicator();
  }, 30 * 1000);
}

// ---------- 對外 API（alpha.2 開始寫 Drive API 同步時會用到）----------

// 拿可用的 access token；過期或未登入回 null
// 留 60 秒 buffer 避免「拿到但下一秒就過期」的競爭
function getValidAccessToken() {
  if (!cloudAuthState.accessToken) return null;
  if (Date.now() > cloudAuthState.tokenExpiresAt - 60_000) return null;
  return cloudAuthState.accessToken;
}

// 是否已登入（UI 顯示用；不等同於「token 立刻可用」，後者請用 getValidAccessToken）
function isCloudSignedIn() {
  return !!cloudAuthState.user && !!cloudAuthState.accessToken;
}

// v3.24.26：確保 access token 仍有效，無效則主動觸發 silent refresh 並等待結果
// v3.24.27：timeout 從 15s 延長到 30s，給 silent refresh 失敗 + 3 次指數退避 retry（總 35s）足夠時間
// 修「電腦睡眠喚醒後 silent refresh 還沒完成、driveFetch 就先 throw → 紅 banner 誤觸發」bug
// 用法：在 driveFetch 入口呼叫，token 無效就 await refresh 完成再繼續
async function ensureValidToken(timeoutMs = 30000) {
  if (getValidAccessToken()) return true;
  // 沒登入 / SDK 沒 ready → 不能 refresh
  if (!cloudAuthState.user || !cloudAuthState.tokenClient) return false;

  // 觸發 silent refresh（若已在跑就讓它跑、不重複觸發）
  if (!_isSilentRefreshing) {
    _silentRefresh();
  }

  // 等 silent refresh 完成（_isSilentRefreshing 變 false 且 token valid），或 timeout
  const startTime = Date.now();
  while (true) {
    if (getValidAccessToken()) return true;
    if (!_isSilentRefreshing) {
      // refresh 結束但 token 還無效 → 失敗（可能 Google session 過期、要使用者重登）
      return false;
    }
    if (Date.now() - startTime > timeoutMs) return false;
    await new Promise(r => setTimeout(r, 200));  // poll 每 200ms
  }
}

// v3.24.15：多 tab 偵測（BroadcastChannel）
// 同一個瀏覽器開兩個 tab 時，兩 tab 的 push 會互相蓋（race condition）
// 偵測到時用紅 banner 提示使用者，避免他在多 tab 上同時編輯
const TAB_ID = `tab-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
let _tabChannel = null;
let _otherTabsActive = new Map();   // tabId → lastSeen ms
const TAB_HEARTBEAT_MS = 5000;
const TAB_STALE_MS = 12000;

function _initTabDetection() {
  if (typeof BroadcastChannel === 'undefined') {
    console.log('[multi-tab] BroadcastChannel 不支援，跳過多 tab 偵測');
    return;
  }
  try {
    _tabChannel = new BroadcastChannel('freelance-tracker-cloud-tabs');
  } catch (_) { return; }

  _tabChannel.onmessage = (event) => {
    const data = event.data || {};
    if (data.tabId && data.tabId !== TAB_ID) {
      _otherTabsActive.set(data.tabId, Date.now());
      _renderMultiTabWarning();
    }
  };

  // 廣播「我還活著」每 5 秒一次
  _tabChannel.postMessage({ type: 'heartbeat', tabId: TAB_ID, ts: Date.now() });
  setInterval(() => {
    if (_tabChannel) _tabChannel.postMessage({ type: 'heartbeat', tabId: TAB_ID, ts: Date.now() });
    // 清掉超過 12 秒沒回應的（已關閉）
    const now = Date.now();
    for (const [id, lastSeen] of _otherTabsActive) {
      if (now - lastSeen > TAB_STALE_MS) _otherTabsActive.delete(id);
    }
    _renderMultiTabWarning();
  }, TAB_HEARTBEAT_MS);

  // 關 tab 前廣播
  window.addEventListener('beforeunload', () => {
    try { _tabChannel?.postMessage({ type: 'leaving', tabId: TAB_ID }); } catch (_) {}
  });
}

function _renderMultiTabWarning() {
  const count = _otherTabsActive.size;
  let warn = document.getElementById('multi-tab-warning');
  if (count === 0) {
    if (warn) warn.remove();
    return;
  }
  if (!warn) {
    warn = document.createElement('div');
    warn.id = 'multi-tab-warning';
    warn.className = 'multi-tab-warning';
    document.body.appendChild(warn);
  }
  warn.innerHTML = `⚠️ 偵測到此 app 在 <b>${count + 1}</b> 個分頁同時開啟，<b>請只在一個分頁編輯</b>，避免改動互相覆蓋。`;
}

_initTabDetection();

// 自啟動：app.js 在 body 尾端載入時 DOM 已就緒，直接 init
cloudInitGoogleAuth();

// v3.24.13：app 啟動 1 秒後檢查一次 banner（給 cloudInitGoogleAuth 拉完狀態的時間）
// 例如：上次關閉時 token 已過期 → 重開有 user info 但無 token → 應顯示「未登入」banner
setTimeout(() => {
  if (typeof cloudUpdateSyncBanner === 'function') cloudUpdateSyncBanner();
  // v3.24.20：行事曆 master toggle disable 狀態也同步一次
  if (typeof cloudUpdateCalSigninGate === 'function') cloudUpdateCalSigninGate();
  // v3.24.24：sync-indicator 也再保險一次（修「重整後殘留 ○ 未啟用」的 bug）
  if (typeof cloudUpdateSyncIndicator === 'function') cloudUpdateSyncIndicator();
}, 1000);

// ============== ☁️ Drive API Client（v3.0.0-alpha.2 起新增）==============
// 純 fetch 包裝 Google Drive API v3，scope 限定 drive.appfolder（只動 App Folder）
// 後續 commit 用法：先 getValidAccessToken() 拿 token，再呼叫這層的函式
// 文件：https://developers.google.com/drive/api/reference/rest/v3/files
//
// 注意 ETag / 樂觀鎖：Drive API v3 有提供 file resource 的 etag、但實作有些 quirk；
// 我們改用「在 tracker.json metadata wrapper 內自行記 lastModifiedAt + version」
// 來做應用層樂觀鎖（更可靠、跨 Drive client 都行得通），所以這層 wrapper 不處理 If-Match。

// 自訂 error 類別，方便 caller 區分「需要重新登入」vs「其他錯誤」
class DriveAuthError extends Error {
  constructor(msg) { super(msg); this.name = 'DriveAuthError'; }
}

// 內部 helper：包裝 fetch，自動附 Authorization header、統一錯誤訊息
// v3.1.0：除了 Drive API、Calendar API 也共用此 wrapper，所以錯誤標籤改為 generic「Google API」
// v3.24.26：token 無效時主動等 silent refresh 完成（修「睡眠喚醒後 driveFetch 比 silent refresh 早跑造成紅 banner 誤觸發」）
async function driveFetch(url, options = {}) {
  let token = getValidAccessToken();
  if (!token) {
    // v3.24.26：先等 silent refresh 把 token 補上
    // v3.24.27：訊息改成行動指示（之前「access token 已過期」是技術術語，使用者看了不知道要做啥）
    const ok = await ensureValidToken();
    if (!ok) {
      throw new DriveAuthError('Google 連線需要重新整理，請點右上角「重新登入」');
    }
    token = getValidAccessToken();
    if (!token) {
      throw new DriveAuthError('Google 連線需要重新整理，請點右上角「重新登入」');
    }
  }
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', 'Bearer ' + token);
  const r = await fetch(url, { ...options, headers });
  if (r.status === 401) throw new DriveAuthError('Google 連線需要重新整理，請點右上角「重新登入」');
  if (r.status === 403) {
    // 403 通常是 API 在 GCP 沒啟用、或 quota 超過。Google 的錯誤訊息含啟用連結，直接傳給 caller
    let msg = 'Google API 403：權限不足或 API 未啟用';
    try {
      const errBody = await r.json();
      if (errBody && errBody.error && errBody.error.message) msg = errBody.error.message;
    } catch (_) {}
    throw new Error(msg);
  }
  if (!r.ok) {
    // 推測是哪個 API（從 URL 判斷）讓錯誤訊息更精準
    let apiLabel = 'Google API';
    if (url.includes('drive.google')) apiLabel = 'Drive API';
    else if (url.includes('calendar/v3') || url.includes('calendarList')) apiLabel = 'Calendar API';
    let msg = `${apiLabel} ${r.status}`;
    try {
      const errBody = await r.json();
      if (errBody && errBody.error && errBody.error.message) msg += `: ${errBody.error.message}`;
    } catch (_) { /* 回應不是 JSON 就算了 */ }
    throw new Error(msg);
  }
  return r;
}

// 列出 App Folder 內的檔案
// query 範例：'name = "tracker.json"'、'name contains "snapshot-"'、'mimeType = "application/json"'
// 回傳：[{ id, name, modifiedTime, version, size, mimeType }, ...]
async function driveListAppFolder(query) {
  const params = new URLSearchParams({
    spaces: 'appDataFolder',
    fields: 'files(id, name, modifiedTime, version, size, mimeType)',
    pageSize: '1000',
    orderBy: 'modifiedTime desc',
  });
  if (query) params.set('q', query);
  const r = await driveFetch('https://www.googleapis.com/drive/v3/files?' + params.toString());
  const data = await r.json();
  return data.files || [];
}

// 取得單一檔案的 metadata（不含內容）
async function driveGetFileMeta(fileId) {
  const params = new URLSearchParams({
    fields: 'id, name, modifiedTime, version, size, mimeType',
  });
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${params.toString()}`;
  const r = await driveFetch(url);
  return r.json();
}

// 下載檔案內容（純文字，呼叫端自己解 JSON）
async function driveDownloadFile(fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  const r = await driveFetch(url);
  return r.text();
}

// 在 App Folder 建立新檔
// content 可以是字串（直接寫入）或物件（自動 JSON.stringify）
// 回傳：{ id, name, modifiedTime, version }
async function driveCreateFile(name, content, mimeType = 'application/json') {
  const metadata = {
    name,
    parents: ['appDataFolder'],
    mimeType,
  };
  const boundary = '----driveBoundary' + Math.random().toString(36).slice(2);
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    '',
    typeof content === 'string' ? content : JSON.stringify(content),
    `--${boundary}--`,
    '',
  ].join('\r\n');
  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,modifiedTime,version';
  const r = await driveFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return r.json();
}

// 更新既有檔內容（不改 metadata；要改名請另外用 PATCH metadata-only）
async function driveUpdateFile(fileId, content, mimeType = 'application/json') {
  const url = `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media&fields=id,name,modifiedTime,version`;
  const r = await driveFetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': mimeType },
    body: typeof content === 'string' ? content : JSON.stringify(content),
  });
  return r.json();
}

// 刪除檔（snapshot prune 用）
async function driveDeleteFile(fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
  await driveFetch(url, { method: 'DELETE' });
  return true;
}

// ---------- 圖片上傳 / 下載（v3.0.0-alpha.3 起新增）----------
// 存摺照片從 tracker.json 的 base64 改寫成 Drive App Folder 個別檔
// dataUrl 進、fileId 出；下載時 fileId 進、dataUrl 出（給 <img src> 直接用）

// 上傳：把 dataUrl（含 mime + base64）切出來，組 multipart/related body 上傳
// 用 Content-Transfer-Encoding: base64 直接傳 base64 字串（避免處理 binary fetch body）
// 大小代價：base64 比原始大 33%，50KB JPEG → ~67KB；對單人多裝置情境可接受
async function driveUploadImage(dataUrl, name) {
  if (!isCloudSignedIn()) throw new DriveAuthError('未登入 Google');
  const m = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error('不是合法的 base64 dataURL（必須以 data:image/...;base64, 開頭）');
  const mimeType = m[1];
  const base64 = m[2];

  const metadata = {
    name: name || `image-${Date.now()}.${mimeType.split('/')[1] || 'bin'}`,
    parents: ['appDataFolder'],
    mimeType,
  };
  const boundary = '----driveImgBoundary' + Math.random().toString(36).slice(2);
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    'Content-Transfer-Encoding: base64',
    '',
    base64,
    `--${boundary}--`,
    '',
  ].join('\r\n');

  const url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,size,mimeType';
  const r = await driveFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  return r.json();  // { id, name, size, mimeType }
}

// 下載：blob → dataURL（FileReader.readAsDataURL 自動帶上正確的 data:mime;base64,xxx）
async function driveDownloadImageAsDataUrl(fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  const r = await driveFetch(url);
  const blob = await r.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// ============== 📅 Calendar API Client（v3.1.0 起新增）==============
// scope = calendar.events + calendar.readonly（後者只給「列出 calendars 給使用者選」用）
// 同樣走 driveFetch 共用 token，登入後就能直接打 Calendar API
// 文件：https://developers.google.com/calendar/api/v3/reference/events

// 列出使用者所有 calendars（給選擇器用）
async function calendarListCalendars() {
  const r = await driveFetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?fields=items(id,summary,primary,backgroundColor,accessRole)&maxResults=250');
  const data = await r.json();
  return data.items || [];
}

// 列出指定 calendar 內的事件，可選 filter
// extendedQuery 會被加到 query string，例：'privateExtendedProperty=ftSource=freelance-tracker-cloud'
async function calendarListEvents(calendarId, extendedQuery) {
  const params = new URLSearchParams({
    maxResults: '2500',
    showDeleted: 'false',
    singleEvents: 'true',
    fields: 'items(id,summary,description,start,end,colorId,extendedProperties)',
  });
  let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
  if (extendedQuery) url += '&' + extendedQuery;
  const r = await driveFetch(url);
  const data = await r.json();
  return data.items || [];
}

async function calendarCreateEvent(calendarId, eventResource) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const r = await driveFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventResource),
  });
  return r.json();
}

async function calendarUpdateEvent(calendarId, eventId, eventResource) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  const r = await driveFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventResource),
  });
  return r.json();
}

async function calendarDeleteEvent(calendarId, eventId) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  await driveFetch(url, { method: 'DELETE' });
  return true;
}

// ---------- 存摺照片：fileId 下載 + sessionStorage 快取 + DOM hydrate（α3-3）----------
// 每個 paymentAccount 的存摺照片若用 fileId 儲存，render 時先放 placeholder（[data-bankbook-loading]），
// 然後 cloudHydrateBankbookImages() 掃 DOM 把 placeholder 換成 <img>。
// dataUrl 進 sessionStorage 快取避免反覆下載；同 tab 內第二次顯示就秒出。

function cloudGetBankbookCachedDataUrl(fileId) {
  if (!fileId) return null;
  try { return sessionStorage.getItem(`cloud-bankbook-${fileId}`); }
  catch (_) { return null; }
}

function cloudSetBankbookCachedDataUrl(fileId, dataUrl) {
  if (!fileId || !dataUrl) return;
  try { sessionStorage.setItem(`cloud-bankbook-${fileId}`, dataUrl); }
  catch (e) { console.warn('[bankbook] sessionStorage 滿了:', e); }
}

// 拿 dataUrl：先 cache、再 fallback 下載
async function cloudGetBankbookDataUrl(fileId) {
  if (!fileId) return '';
  const cached = cloudGetBankbookCachedDataUrl(fileId);
  if (cached) return cached;
  if (!isCloudSignedIn()) return '';  // 沒登入下不到
  try {
    const dataUrl = await driveDownloadImageAsDataUrl(fileId);
    cloudSetBankbookCachedDataUrl(fileId, dataUrl);
    return dataUrl;
  } catch (e) {
    console.warn('[bankbook] 下載失敗:', e);
    return '';
  }
}

// 掃 DOM，把所有 [data-bankbook-loading="<fileId>"] 的 placeholder 換成實際 <img>
// idempotent：再次呼叫只會處理還沒被替換掉的
async function cloudHydrateBankbookImages() {
  const placeholders = document.querySelectorAll('[data-bankbook-loading]');
  if (placeholders.length === 0) return;
  for (const el of placeholders) {
    const fileId = el.getAttribute('data-bankbook-loading');
    if (!fileId) continue;
    // 標記為「處理中」避免被同一輪掃到兩次（理論上 outerHTML 會移除 element，但保險起見）
    el.removeAttribute('data-bankbook-loading');
    el.setAttribute('data-bankbook-fetching', fileId);
    try {
      const dataUrl = await cloudGetBankbookDataUrl(fileId);
      if (dataUrl) {
        el.outerHTML = `<img src="${dataUrl}" alt="存摺" style="max-width: 200px; max-height: 120px; border-radius: 6px; border: 1px solid var(--border); margin-top: 6px;">`;
      } else {
        el.outerHTML = `<div style="color:var(--muted);font-size:13px;margin-top:6px;">⚠️ 存摺照片載入失敗（${isCloudSignedIn() ? 'Drive 下載失敗' : '請先登入 Google'}）</div>`;
      }
    } catch (e) {
      console.warn('[bankbook] hydrate 失敗:', e);
      el.outerHTML = `<div style="color:var(--danger);font-size:13px;margin-top:6px;">⚠️ ${cloudEscapeHtml(e.message || '未知錯誤')}</div>`;
    }
  }
}

// ============== ☁️ Drive Sync Layer（v3.0.0-alpha.2 起新增）==============
// 把 v3 的 state + config + paymentAccounts 雙寫到 Drive App Folder 的 tracker.json
// metadata wrapper 結構（schemaVersion / version / lastModifiedAt / lastModifiedBy / data）
// 後續 commit 會在這個 layer 加：debounce 雙寫、三方合併、衝突 modal、snapshot

// localStorage cloud meta：{ trackerFileId, trackerCreatedAt, lastSyncedAt, lastSyncedVersion }
// 跟 CLOUD_AUTH_KEY 分開：auth 跟 sync 兩件事獨立持久化（auth 過期不該清掉 fileId）
const CLOUD_META_KEY = 'cloud-freelance-tracker-meta';
const TRACKER_FILENAME = 'tracker.json';

function cloudGetMeta() {
  try {
    const raw = localStorage.getItem(CLOUD_META_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) { return {}; }
}

function cloudSaveMeta(patch) {
  try {
    const cur = cloudGetMeta();
    localStorage.setItem(CLOUD_META_KEY, JSON.stringify({ ...cur, ...patch }));
  } catch (e) { console.warn('[cloud-sync] meta save failed:', e); }
}

// 把當前 state + config 包成 tracker.json metadata wrapper
// prevVersion：本機已知的雲端版本號（首次建檔填 0；推送時填上次拉到的 version）
function buildTrackerWrapper(prevVersion = 0) {
  const meta = cloudGetMeta();
  const deviceLabel = (typeof getDeviceLabel === 'function') ? getDeviceLabel() : '未命名裝置';
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    version: (prevVersion || 0) + 1,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: deviceLabel,
    createdAt: meta.trackerCreatedAt || new Date().toISOString(),
    data: {
      clients: state.clients || [],
      jobs: state.jobs || [],
      invoiceHistory: state.invoiceHistory || [],  // v3.12.0
      config: config || {}
    }
  };
}

// 解 Drive 上的 tracker.json 內容並驗證
// 回傳：{ ok: true, data, meta } 或 { ok: false, error: '錯誤訊息' }
function unwrapTracker(jsonText) {
  let parsed;
  try { parsed = JSON.parse(jsonText); }
  catch (_) { return { ok: false, error: 'tracker.json 不是合法 JSON' }; }
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'tracker.json 結構不正確（不是物件）' };
  }
  if (!parsed.data || typeof parsed.data !== 'object') {
    return { ok: false, error: 'tracker.json 缺少 data 區塊（schema 不對）' };
  }
  if (parsed.schemaVersion && parsed.schemaVersion > CURRENT_SCHEMA_VERSION) {
    return { ok: false, error: `tracker.json 的 schema v${parsed.schemaVersion} 比本機支援的 v${CURRENT_SCHEMA_VERSION} 新；請更新本機到最新版後再試` };
  }
  return {
    ok: true,
    data: parsed.data,
    meta: {
      schemaVersion: parsed.schemaVersion || 1,
      version: parsed.version || 1,
      lastModifiedAt: parsed.lastModifiedAt || null,
      lastModifiedBy: parsed.lastModifiedBy || null,
      createdAt: parsed.createdAt || null
    }
  };
}

// 把雲端 data 套用到本機 state + config + localStorage + 重繪
function applyTrackerData(data) {
  if (Array.isArray(data.clients)) state.clients = data.clients;
  if (Array.isArray(data.jobs)) state.jobs = data.jobs;
  if (Array.isArray(data.invoiceHistory)) state.invoiceHistory = data.invoiceHistory;  // v3.12.0
  if (data.config && typeof data.config === 'object') config = data.config;
  // 跑一次 migrations 以防雲端資料 schema 較舊
  if (typeof runMigrations === 'function') runMigrations(state);
  if (typeof ensurePaymentAccounts === 'function') ensurePaymentAccounts();
  // 寫回 localStorage（v2 既有 save() 會處理 STORAGE_KEY + CONFIG_KEY）
  if (typeof save === 'function') save();
  // 重繪 UI（v3.1.0-fix：除了 renderAll，也要重灌 settings 頁所有 input
  // 因為 settings 不在 renderAll 範圍，pull/merge 進來新 config 後 input 不會自動更新）
  // v3.3.0：loadUserInfoUI 已刪（settings 「我的收款資訊」card 已搬到請款單分頁）；改成 renderInvoicePayAccountSelect
  if (typeof renderInvoicePayAccountSelect === 'function') renderInvoicePayAccountSelect();
  if (typeof loadReminderConfigUI === 'function') loadReminderConfigUI();
  if (typeof loadInvoiceStatusUI === 'function') loadInvoiceStatusUI();
  // v3.3.0：loadDeviceNameUI 已 dead（裝置名稱輸入 UI 已刪）
  if (typeof renderAll === 'function') renderAll();
}

// 本機是否完全空白（沒業主、沒案件 → 視為「全新裝置」可直接拉雲端）
function isLocalDataEmpty() {
  const noClients = !state.clients || state.clients.length === 0;
  const noJobs = !state.jobs || state.jobs.length === 0;
  return noClients && noJobs;
}

// 登入後初始化 tracker.json
// - 雲端沒檔 → 用本機建一個（先 push）
// - 雲端有檔 + 本機空白 → 自動 pull
// - 雲端有檔 + 本機有資料 → 走三方合併引擎（mergeStates）：
//     資料完全一致 → 靜默合併 + toast「✓ 已跟雲端同步」
//     有差異但無真衝突 → 自動合併
//     真衝突 → 跳衝突 modal 給使用者逐筆挑
// v3.24.23：加併發保護 — cloudOnTokenResponse 跟 cloudPullNow 都可能呼叫 init，避免並發 driveList / driveCreate
let cloudInitInProgress = false;
async function cloudInitTrackerFile() {
  if (!isCloudSignedIn()) return;
  if (cloudInitInProgress) {
    console.log('[cloud-init] already in progress, skip');
    return;
  }
  cloudInitInProgress = true;

  // v3.24.15：init 期間顯示半透明 overlay，避免使用者在 mergeStates 跑之前編輯
  // （race condition：剛改的東西可能被 merge 結果覆蓋）
  if (typeof showInitOverlay === 'function') showInitOverlay();

  let trackerFile = null;
  try {
    const files = await driveListAppFolder(`name = "${TRACKER_FILENAME}" and trashed = false`);
    trackerFile = files[0] || null;
  } catch (e) {
    console.error('[cloud-init] list failed:', e);
    if (typeof hideInitOverlay === 'function') hideInitOverlay();
    if (e instanceof DriveAuthError) {
      alert('Drive 連線失敗：' + e.message);
    } else {
      alert('讀取 Drive 應用程式資料夾失敗：' + e.message);
    }
    return;
  }

  // Case A：雲端沒檔 → 建一個
  if (!trackerFile) {
    try {
      const wrapper = buildTrackerWrapper(0);
      const created = await driveCreateFile(TRACKER_FILENAME, wrapper);
      cloudSaveMeta({
        trackerFileId: created.id,
        trackerCreatedAt: (created && created.createdTime) || wrapper.createdAt,
        // v3.24.21：用 Drive 回傳的 modifiedTime（避免本機時間誤差導致 version check 誤判）
        lastSyncedAt: (created && created.modifiedTime) || wrapper.lastModifiedAt,
        lastSyncedVersion: wrapper.version,
      });
      // α2-4a：剛 push 上去的內容就是「上次成功同步的快照」
      cloudSaveLastSyncedSnapshot(wrapper.data);
      console.log('[cloud-init] 已在 Drive 建立 tracker.json:', created.id);
      if (typeof logAction === 'function') {
        logAction('cloud-init-create', { fileId: created.id, version: wrapper.version });
      }
    } catch (e) {
      console.error('[cloud-init] create failed:', e);
      alert('在 Drive 建立 tracker.json 失敗：' + e.message);
    }
    if (typeof hideInitOverlay === 'function') hideInitOverlay();  // v3.24.15
    return;
  }

  // Case B/C：雲端有檔 → 先下載
  let remoteText;
  try {
    remoteText = await driveDownloadFile(trackerFile.id);
  } catch (e) {
    console.error('[cloud-init] download failed:', e);
    if (typeof hideInitOverlay === 'function') hideInitOverlay();  // v3.24.15
    alert('下載 Drive 上的 tracker.json 失敗：' + e.message);
    return;
  }

  const result = unwrapTracker(remoteText);
  if (!result.ok) {
    console.error('[cloud-init] unwrap failed:', result.error);
    if (typeof hideInitOverlay === 'function') hideInitOverlay();  // v3.24.15
    alert('Drive 上的 tracker.json 解析失敗：' + result.error +
          '\n\n為避免覆寫雲端資料，本次不執行同步。請手動檢查 Drive App Folder 內的檔案。');
    cloudSaveMeta({ trackerFileId: trackerFile.id });  // 至少先記下 fileId
    return;
  }

  // Case B：本機空白 → 自動 pull
  if (isLocalDataEmpty()) {
    applyTrackerData(result.data);
    // v3.24.21：清掉 applyTrackerData → save() → cloudSchedulePush() 的觸發（剛 pull 完不該推回去）
    if (cloudPushTimer) {
      clearTimeout(cloudPushTimer);
      cloudPushTimer = null;
    }
    cloudPendingChangesCount = 0;
    cloudSaveMeta({
      trackerFileId: trackerFile.id,
      trackerCreatedAt: result.meta.createdAt,
      // v3.24.21：用 Drive 的 modifiedTime（list 回傳值，雲端權威時間）而非 wrapper 內 lastModifiedAt
      lastSyncedAt: trackerFile.modifiedTime || result.meta.lastModifiedAt,
      lastSyncedVersion: result.meta.version,
    });
    // α2-4a：剛 pull 下來的內容就是「上次成功同步的快照」
    cloudSaveLastSyncedSnapshot(result.data);
    console.log('[cloud-init] 本機空白，已從 Drive 拉取 tracker.json');
    if (typeof logAction === 'function') {
      logAction('cloud-init-pull', { fileId: trackerFile.id, version: result.meta.version });
    }
    if (typeof hideInitOverlay === 'function') hideInitOverlay();  // v3.24.15
    return;
  }

  // Case C：兩邊都有資料 → 統一走三方合併引擎，不再依 base 有無分流
  //
  // α2-4-revisit（2026-04-29 追加）：
  //   原本 `if 有 base 走 mergeStates / else 走 prompt 三選一` 的二分被砍掉。
  //   理由：mergeStates 對 base=null 有合理行為——
  //     * entity 只在單邊存在 → 視為新增、保留
  //     * 兩邊都有且資料相同 → keep（產生 0 衝突，靜默合併）
  //     * 兩邊都有但欄位不同 → 走 cloudShowConflictModal 逐筆處理
  //   比 prompt 強制「整邊覆蓋」安全，且對「重新登入但資料其實一樣」零打擾。
  await cloudResolveAndMerge({
    remoteData: result.data,
    remoteMeta: result.meta,
    fileId: trackerFile.id,
    trackerCreatedAt: result.meta.createdAt
  });
  cloudSaveMeta({ trackerFileId: trackerFile.id, trackerCreatedAt: result.meta.createdAt });

  // α2-7b：init 結束（不論哪條路徑）→ 確保今天有 auto snapshot（fire-and-forget）
  cloudEnsureDailyAutoSnapshot().catch(e => console.error('[snapshot-auto] async:', e));
  // α3-4：背景遷移既有 base64 存摺照片到 Drive（fire-and-forget）
  cloudMigrateBankbookImages().catch(e => console.error('[bankbook-migrate] async:', e));

  // v3.24.15：所有路徑都跑完了 → 關 overlay
  if (typeof hideInitOverlay === 'function') hideInitOverlay();
}

// ---------- 衝突解決 modal（α2-4b）----------
// 流程：cloudResolveAndMerge() → mergeStates() → 無衝突自動 push、有衝突開 modal
// modal 內容用 JS 動態建 DOM，避免動到 index.html

let cloudConflictState = null;  // { mergedTentative, conflicts, choices, fileId, remoteMeta, trackerCreatedAt }

// 主入口：拿到遠端資料後做三方合併、決定自動套用還是開 modal
async function cloudResolveAndMerge({ remoteData, remoteMeta, fileId, trackerCreatedAt }) {
  const base = cloudGetLastSyncedSnapshot();
  const local = {
    clients: state.clients,
    jobs: state.jobs,
    invoiceHistory: state.invoiceHistory,  // v3.12.0
    config: config
  };
  const result = mergeStates(base, local, remoteData);

  if (result.clean) {
    // 無衝突 → 直接套用合併結果
    applyTrackerData(result.merged);
    // v3.24.21：清掉 applyTrackerData → save() → cloudSchedulePush() 觸發的 2 秒後重推
    if (cloudPushTimer) {
      clearTimeout(cloudPushTimer);
      cloudPushTimer = null;
    }
    cloudPendingChangesCount = 0;

    // v3.24.23：合併結果跟雲端完全一致 → 跳過 push 避免無謂版本 +1
    // 比對 merged data vs remoteData（兩者都是 { clients, jobs, invoiceHistory, config } 結構）
    let skipPush = false;
    try {
      const mergedJson = JSON.stringify(result.merged);
      const remoteJson = JSON.stringify(remoteData);
      if (mergedJson === remoteJson) {
        skipPush = true;
        console.log('[cloud-merge] merged === remote，跳過 push（無實際變動）');
      }
    } catch (_) { /* JSON 失敗 fallback 走 push */ }

    if (skipPush) {
      // 只更新本機 meta（記住已對齊到 remote 的版本，下次比對才正確）
      cloudSaveMeta({
        trackerFileId: fileId,
        trackerCreatedAt: trackerCreatedAt || cloudGetMeta().trackerCreatedAt,
        lastSyncedAt: remoteMeta.lastModifiedAt,
        lastSyncedVersion: remoteMeta.version,
      });
      cloudSaveLastSyncedSnapshot(remoteData);  // base 也更新成 remote
      if (typeof logAction === 'function') {
        logAction('cloud-merge-noop', { fileId, version: remoteMeta.version });
      }
      console.log('[cloud-merge] 對齊完成，無實際差異');
      return;
    }

    // v3.24.23：搶 cloudPushInProgress 鎖，避免跟 cloudPushNow 的 driveUpdateFile 撞車
    // 如果有 push 正在跑 → 標記 pending after，讓 push 結束後再推一次（cloudResolveAndMerge 這次跳過自己的 push）
    if (cloudPushInProgress) {
      cloudPushPendingAfter = true;
      console.log('[cloud-merge] cloudPushNow 正在跑，標記 pendingAfter，本次 merge 不 push');
      return;
    }
    cloudPushInProgress = true;
    try {
      const wrapper = buildTrackerWrapper(remoteMeta.version);
      const updated = await driveUpdateFile(fileId, wrapper);
      cloudSaveMeta({
        trackerFileId: fileId,
        trackerCreatedAt: trackerCreatedAt || cloudGetMeta().trackerCreatedAt,
        // v3.24.21：用 Drive 回傳的 modifiedTime
        lastSyncedAt: (updated && updated.modifiedTime) || wrapper.lastModifiedAt,
        lastSyncedVersion: wrapper.version,
      });
      cloudSaveLastSyncedSnapshot(wrapper.data);
      if (typeof logAction === 'function') {
        logAction('cloud-merge-clean', { fileId, version: wrapper.version });
      }
      console.log(`[cloud-merge] 自動合併完成（無衝突）→ Drive 已更新到 v${wrapper.version}`);
      if (typeof toast === 'function') toast('✓ 已跟雲端同步', 2500);
    } catch (e) {
      console.error('[cloud-merge] push after clean merge failed:', e);
      alert('自動合併成功但推送 Drive 失敗：' + e.message);
    } finally {
      cloudPushInProgress = false;
      // v3.24.23：搶鎖期間若有 pending push，跑完釋放鎖
      if (cloudPushPendingAfter) {
        cloudPushPendingAfter = false;
        setTimeout(() => {
          cloudPushNow().catch(err => console.error('[cloud-push] pending-after async failed:', err));
        }, 0);
      }
    }
    return;
  }

  // 有衝突 → 開 modal
  cloudShowConflictModal({
    mergedTentative: result.merged,
    conflicts: result.conflicts,
    fileId,
    remoteMeta,
    trackerCreatedAt
  });
}

function cloudShowConflictModal({ mergedTentative, conflicts, fileId, remoteMeta, trackerCreatedAt }) {
  cloudConflictState = {
    mergedTentative,
    conflicts,
    choices: conflicts.map(() => 'local'),  // 預設全選本機
    fileId,
    remoteMeta,
    trackerCreatedAt
  };

  // 移除既有 overlay（若有）
  const old = document.getElementById('cloud-conflict-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'cloud-conflict-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);' +
    'display:flex;align-items:center;justify-content:center;padding:20px;';

  const dialog = document.createElement('div');
  dialog.style.cssText =
    'background:var(--card);color:var(--text);border-radius:12px;' +
    'padding:20px;max-width:720px;width:100%;max-height:85vh;overflow:auto;' +
    'box-shadow:0 8px 32px rgba(0,0,0,0.3);';

  dialog.innerHTML =
    '<h2 style="margin:0 0 12px 0;font-size:18px;">⚠️ 偵測到資料衝突</h2>' +
    `<p style="color:var(--muted);font-size:13px;margin-bottom:12px;">` +
    `本機跟雲端都改了相同欄位（共 ${conflicts.length} 筆衝突）。<br>` +
    `請逐筆選擇要保留哪邊的版本（無衝突的改動已自動合併，不需處理）。` +
    `</p>` +
    '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
    `  <button class="btn btn-outline btn-sm" onclick="cloudConflictBatchPick(\'local\')">全部用本機</button>` +
    `  <button class="btn btn-outline btn-sm" onclick="cloudConflictBatchPick(\'remote\')">全部用雲端</button>` +
    '</div>' +
    '<div id="cloud-conflict-list"></div>' +
    '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end;">' +
    '  <button class="btn btn-outline" onclick="cloudConflictCancel()">取消（不上傳）</button>' +
    '  <button class="btn btn-primary" onclick="cloudConflictApply()">套用解決</button>' +
    '</div>';

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  cloudRenderConflictList();
}

function cloudRenderConflictList() {
  const listEl = document.getElementById('cloud-conflict-list');
  if (!listEl || !cloudConflictState) return;
  const html = cloudConflictState.conflicts.map((c, i) => {
    const desc = cloudDescribeConflict(c);
    const choice = cloudConflictState.choices[i];
    return (
      '<div style="border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px;">' +
      `  <div style="font-weight:600;margin-bottom:6px;font-size:13px;">${cloudEscapeHtml(desc.title)}</div>` +
      `  <label style="display:block;margin:4px 0;cursor:pointer;font-size:13px;">` +
      `    <input type="radio" name="cf${i}" value="local" ${choice === 'local' ? 'checked' : ''}` +
      `           onchange="cloudConflictSetChoice(${i}, 'local')">` +
      `    <strong>本機：</strong> ${cloudEscapeHtml(desc.localShort)}` +
      `  </label>` +
      `  <label style="display:block;margin:4px 0;cursor:pointer;font-size:13px;">` +
      `    <input type="radio" name="cf${i}" value="remote" ${choice === 'remote' ? 'checked' : ''}` +
      `           onchange="cloudConflictSetChoice(${i}, 'remote')">` +
      `    <strong>雲端：</strong> ${cloudEscapeHtml(desc.remoteShort)}` +
      `  </label>` +
      '</div>'
    );
  }).join('');
  listEl.innerHTML = html;
}

function cloudDescribeConflict(c) {
  const typeName = { client: '業主', job: '案件', config: '設定' }[c.type] || c.type;
  if (c.kind === 'delete-vs-edit') {
    const sideText = c.side === 'local-deleted' ? '本機已刪 vs 雲端有改動' : '雲端已刪 vs 本機有改動';
    return {
      title: `${typeName} ${c.id} — ${sideText}`,
      localShort: c.localValue ? '保留（含本機改動）' : '刪除',
      remoteShort: c.remoteValue ? '保留（含雲端改動）' : '刪除'
    };
  }
  return {
    title: `${typeName} ${c.id} → 欄位「${c.field}」`,
    localShort: cloudFormatValue(c.localValue),
    remoteShort: cloudFormatValue(c.remoteValue)
  };
}

function cloudFormatValue(v) {
  if (v == null) return '(空)';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v.length > 80 ? v.slice(0, 80) + '…' : v;
  try {
    const s = JSON.stringify(v);
    return s.length > 80 ? s.slice(0, 80) + '…' : s;
  } catch (_) { return String(v); }
}

function cloudEscapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 內聯 onclick 呼叫的函式必須掛在 window；用全域宣告即可
function cloudConflictSetChoice(idx, side) {
  if (!cloudConflictState) return;
  cloudConflictState.choices[idx] = side;
}

function cloudConflictBatchPick(side) {
  if (!cloudConflictState) return;
  cloudConflictState.choices = cloudConflictState.choices.map(() => side);
  cloudRenderConflictList();
}

function cloudConflictCancel() {
  const overlay = document.getElementById('cloud-conflict-overlay');
  if (overlay) overlay.remove();
  cloudConflictState = null;
  console.log('[cloud-merge] 使用者取消衝突解決，本次不同步');
}

async function cloudConflictApply() {
  if (!cloudConflictState) return;
  const { mergedTentative, conflicts, choices, fileId, remoteMeta, trackerCreatedAt } = cloudConflictState;

  // 依使用者選擇覆寫 mergedTentative 中對應欄位
  conflicts.forEach((c, i) => {
    const chosen = choices[i];
    const valueToUse = chosen === 'local' ? c.localValue : c.remoteValue;

    if (c.kind === 'field-conflict') {
      if (c.type === 'config') {
        if (mergedTentative.config) mergedTentative.config[c.field] = valueToUse;
      } else {
        const list = c.type === 'client' ? mergedTentative.clients : mergedTentative.jobs;
        const item = list && list.find(x => x.id === c.id);
        if (item) item[c.field] = valueToUse;
      }
    } else if (c.kind === 'delete-vs-edit') {
      const list = c.type === 'client' ? mergedTentative.clients : mergedTentative.jobs;
      if (!list) return;
      const idx = list.findIndex(x => x.id === c.id);
      // 預設 mergedTentative 在 _cloudMergeEntity 中：
      //   side === 'local-deleted'  → mergedTentative 保留了 remote
      //   side === 'remote-deleted' → mergedTentative 保留了 local
      // 使用者若選相反那邊，要把該 entity 從 list 移除
      if (chosen === 'local' && c.side === 'local-deleted' && idx >= 0) list.splice(idx, 1);
      if (chosen === 'remote' && c.side === 'remote-deleted' && idx >= 0) list.splice(idx, 1);
    }
  });

  // 套用合併結果到本機 + 推 Drive
  applyTrackerData(mergedTentative);

  try {
    const wrapper = buildTrackerWrapper(remoteMeta.version);
    const updated = await driveUpdateFile(fileId, wrapper);
    cloudSaveMeta({
      trackerFileId: fileId,
      trackerCreatedAt: trackerCreatedAt || cloudGetMeta().trackerCreatedAt,
      lastSyncedAt: wrapper.lastModifiedAt,
      lastSyncedVersion: wrapper.version,
    });
    cloudSaveLastSyncedSnapshot(wrapper.data);
    if (typeof logAction === 'function') {
      logAction('cloud-merge-resolved', {
        fileId, version: wrapper.version,
        conflictsResolved: conflicts.length,
        localCount: choices.filter(c => c === 'local').length,
        remoteCount: choices.filter(c => c === 'remote').length
      });
    }
    console.log(`[cloud-merge] 衝突已解決，Drive 已更新到 v${wrapper.version}`);
  } catch (e) {
    console.error('[cloud-merge] push after resolve failed:', e);
    alert('套用合併成功但推送 Drive 失敗：' + e.message);
  }

  const overlay = document.getElementById('cloud-conflict-overlay');
  if (overlay) overlay.remove();
  cloudConflictState = null;
}

// ---------- 三方合併引擎（α2-4a）----------
// 跟「上次成功同步的快照」（base）比對 local 跟 remote 三方
// - 只有單邊改動的欄位 → 自動套用該邊
// - 兩邊都改了同一欄位且值不同 → 收集成 conflict 給 α2-4b modal 處理
//
// 共同祖先快照存在獨立的 localStorage key，避免跟 cloud-freelance-tracker-meta 混淆
// 每次 push / pull 成功後都要更新這份快照（push 用 merged 內容、pull 用 remote 內容）

const CLOUD_LAST_SYNCED_KEY = 'cloud-freelance-tracker-last-synced-snapshot';

function cloudSaveLastSyncedSnapshot(data) {
  try {
    localStorage.setItem(CLOUD_LAST_SYNCED_KEY, JSON.stringify({
      capturedAt: new Date().toISOString(),
      data
    }));
  } catch (e) { console.warn('[cloud-merge] snapshot save failed:', e); }
}

function cloudGetLastSyncedSnapshot() {
  try {
    const raw = localStorage.getItem(CLOUD_LAST_SYNCED_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.data ? parsed.data : null;
  } catch (_) { return null; }
}

// 簡單 deep equal（針對本 schema 的純物件 / 陣列 / 原始型別，沒有 Date / Map / Set）
function _cloudDeepEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!_cloudDeepEqual(a[i], b[i])) return false;
    return true;
  }
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (!_cloudDeepEqual(a[k], b[k])) return false;
  return true;
}

// 合併單一 entity（client / job）。回傳 { merged?, deleted?, conflicts? }
function _cloudMergeEntity(type, id, base, local, remote) {
  // 雙邊都沒了
  if (!local && !remote) return { deleted: true };

  // 單邊缺：判斷是新增、是刪除、還是 delete-vs-edit
  if (!local) {
    if (!base) return { merged: remote };                          // remote 新增
    if (_cloudDeepEqual(base, remote)) return { deleted: true };   // local 刪、remote 沒動 → 同意刪
    return {                                                       // local 刪 vs remote 改
      mergedTentative: remote,
      conflicts: [{ type, id, kind: 'delete-vs-edit', side: 'local-deleted',
                    baseValue: base, localValue: null, remoteValue: remote }]
    };
  }
  if (!remote) {
    if (!base) return { merged: local };                           // local 新增
    if (_cloudDeepEqual(base, local)) return { deleted: true };    // remote 刪、local 沒動 → 同意刪
    return {
      mergedTentative: local,
      conflicts: [{ type, id, kind: 'delete-vs-edit', side: 'remote-deleted',
                    baseValue: base, localValue: local, remoteValue: null }]
    };
  }

  // 三邊都有 → field-level merge
  const merged = {};
  const conflicts = [];
  const baseObj = base || {};
  const allKeys = new Set([...Object.keys(baseObj), ...Object.keys(local), ...Object.keys(remote)]);
  for (const k of allKeys) {
    const bV = baseObj[k], lV = local[k], rV = remote[k];
    const lChanged = !_cloudDeepEqual(bV, lV);
    const rChanged = !_cloudDeepEqual(bV, rV);
    if (!lChanged && !rChanged) {
      if (lV !== undefined) merged[k] = lV;
    } else if (lChanged && !rChanged) {
      merged[k] = lV;
    } else if (!lChanged && rChanged) {
      merged[k] = rV;
    } else if (_cloudDeepEqual(lV, rV)) {
      merged[k] = lV;
    } else {
      // 真衝突：兩邊都改、且值不同
      conflicts.push({ type, id, kind: 'field-conflict', field: k,
                       baseValue: bV, localValue: lV, remoteValue: rV });
      merged[k] = lV;  // 暫保留 local，等使用者決定
    }
  }
  return conflicts.length > 0
    ? { mergedTentative: merged, conflicts }
    : { merged };
}

// 合併 entity 陣列（clients / jobs）
function _cloudMergeEntityList(type, baseList, localList, remoteList) {
  const idOf = (x) => x && x.id;
  const baseMap = new Map((baseList || []).map(x => [idOf(x), x]));
  const localMap = new Map((localList || []).map(x => [idOf(x), x]));
  const remoteMap = new Map((remoteList || []).map(x => [idOf(x), x]));
  const allIds = new Set([...baseMap.keys(), ...localMap.keys(), ...remoteMap.keys()]);

  const merged = [];
  const conflicts = [];
  for (const id of allIds) {
    if (!id) continue;  // 異常資料：跳過沒 id 的
    const r = _cloudMergeEntity(type, id, baseMap.get(id), localMap.get(id), remoteMap.get(id));
    if (r.deleted) continue;
    if (r.merged) merged.push(r.merged);
    else if (r.mergedTentative) {
      merged.push(r.mergedTentative);
      if (r.conflicts) conflicts.push(...r.conflicts);
    }
  }
  return { merged, conflicts };
}

// 合併 config（單一物件，做 field-level diff；含巢狀 userInfo / paymentAccounts）
function _cloudMergeConfig(base, local, remote) {
  const merged = {};
  const conflicts = [];
  const baseObj = base || {};
  const localObj = local || {};
  const remoteObj = remote || {};
  const allKeys = new Set([...Object.keys(baseObj), ...Object.keys(localObj), ...Object.keys(remoteObj)]);
  for (const k of allKeys) {
    const bV = baseObj[k], lV = localObj[k], rV = remoteObj[k];
    const lChanged = !_cloudDeepEqual(bV, lV);
    const rChanged = !_cloudDeepEqual(bV, rV);
    if (!lChanged && !rChanged) {
      if (lV !== undefined) merged[k] = lV;
    } else if (lChanged && !rChanged) {
      merged[k] = lV;
    } else if (!lChanged && rChanged) {
      merged[k] = rV;
    } else if (_cloudDeepEqual(lV, rV)) {
      merged[k] = lV;
    } else {
      conflicts.push({ type: 'config', id: k, kind: 'field-conflict', field: k,
                       baseValue: bV, localValue: lV, remoteValue: rV });
      merged[k] = lV;
    }
  }
  return { merged, conflicts };
}

// 主入口：對 { clients, jobs, config } 三方合併
// 回傳：{ merged, conflicts, clean }
function mergeStates(base, local, remote) {
  const baseData = base || {};
  const c = _cloudMergeEntityList('client', baseData.clients, local.clients, remote.clients);
  const j = _cloudMergeEntityList('job', baseData.jobs, local.jobs, remote.jobs);
  const cfg = _cloudMergeConfig(baseData.config, local.config, remote.config);
  const conflicts = [...c.conflicts, ...j.conflicts, ...cfg.conflicts];
  return {
    merged: { clients: c.merged, jobs: j.merged, config: cfg.merged },
    conflicts,
    clean: conflicts.length === 0
  };
}

// ---------- 雙寫機制（α2-3）----------
// v2 既有的 save() 會在最後呼叫 cloudSchedulePush()
// 策略：每次 save() 觸發後 2 秒內若無新 save() → 才實際推送到 Drive
// 防止使用者連續打字 / 連點按鈕導致每秒打 N 次 API

let cloudPushTimer = null;        // setTimeout 控制
let cloudPushInProgress = false;  // 推送中旗標（防併發）
let cloudPushPendingAfter = false;  // v3.24.13：進行中收到新 save 的話標記「結束後立刻再推」
let cloudPushFailRetries = 0;       // v3.24.13：失敗次數，指數退避重試
let cloudPendingChangesCount = 0;   // v3.24.15：距離上次成功 push，本機改動筆數（顯示在 sync indicator）
const CLOUD_PUSH_DEBOUNCE_MS = 2000;
const CLOUD_PUSH_MAX_RETRIES = 5;
const CLOUD_PUSH_RETRY_DELAYS_MS = [3000, 8000, 20000, 60000, 180000];  // 3s, 8s, 20s, 1m, 3m

// 由 save() 呼叫；登入後且 init 完成才實際排程
function cloudSchedulePush() {
  if (!isCloudSignedIn()) {
    // v3.24.13：未登入時 → 標記資料未同步（banner 會顯示提示）
    cloudSetSyncStatus('error', '未登入 Google，資料只在本機，請登入後同步');
    return;
  }
  const meta = cloudGetMeta();
  if (!meta.trackerFileId) return;  // tracker.json 還沒 init 完成

  if (cloudPushTimer) clearTimeout(cloudPushTimer);
  cloudPushTimer = setTimeout(() => {
    cloudPushTimer = null;
    cloudPushNow().catch(e => console.error('[cloud-push] async failed:', e));
  }, CLOUD_PUSH_DEBOUNCE_MS);

  // α2-5：indicator 立刻顯示「⌛ 待同步…」
  cloudSetSyncStatus('pending');
}

// v3.24.13：立刻 flush（給 visibilitychange / beforeunload 用，跳過 debounce）
function cloudFlushPush() {
  if (!isCloudSignedIn()) return;
  if (cloudPushTimer) {
    clearTimeout(cloudPushTimer);
    cloudPushTimer = null;
    cloudPushNow().catch(() => {});
  }
}

// 立刻推送（debounce 結束時被呼叫，或將來 sync indicator「立刻同步」按鈕呼叫）
async function cloudPushNow() {
  // v3.24.13：併發防護升級 — 進行中時不直接丟，標記「結束後再推」
  if (cloudPushInProgress) {
    cloudPushPendingAfter = true;
    return;
  }
  if (!isCloudSignedIn()) {
    cloudSetSyncStatus('error', '未登入 Google，資料只在本機');
    return;
  }
  const meta = cloudGetMeta();
  if (!meta.trackerFileId) {
    console.warn('[cloud-push] 沒有 trackerFileId，跳過（init 還沒跑完？）');
    return;
  }

  cloudPushInProgress = true;
  cloudSetSyncStatus('syncing');  // α2-5
  try {
    // v3.24.15：樂觀鎖 / version check — push 前先 GET 雲端 metadata，比對 modifiedTime
    // 如果雲端有別人剛改過（例如另一台電腦推過）→ 不直接覆蓋，改觸發重 pull merge
    // 防止「電腦 A 剛推完 → 電腦 B push 用舊 base 蓋掉 A 的改動」
    //
    // v3.24.21 修：加 5 秒緩衝，避免「同一次推送但時間略差」誤判
    // 原本 bug：wrapper.lastModifiedAt 是本機 build 時間、Drive modifiedTime 是寫入時間，
    //          後者一定晚 100-500ms → version check 永遠 true → 無限迴圈推送
    const VERSION_CHECK_BUFFER_MS = 5000;
    try {
      const fileMeta = await driveGetFileMeta(meta.trackerFileId);
      const remoteModifiedTime = fileMeta.modifiedTime;
      const lastSyncedAt = meta.lastSyncedAt;
      // 如果雲端 modifiedTime > 我們的 lastSyncedAt + 緩衝 → 真的有別人改過
      const remoteT = remoteModifiedTime ? new Date(remoteModifiedTime).getTime() : 0;
      const localT = lastSyncedAt ? new Date(lastSyncedAt).getTime() : 0;
      if (remoteT && localT && remoteT > localT + VERSION_CHECK_BUFFER_MS) {
        console.warn(`[cloud-push] ⚠️ 雲端版本較新 (${remoteModifiedTime} > ${lastSyncedAt} + ${VERSION_CHECK_BUFFER_MS}ms)，重 pull merge 防覆蓋`);
        if (typeof logAction === 'function') {
          logAction('cloud-push-conflict-detected', {
            remoteModifiedTime, lastSyncedAt, fileId: meta.trackerFileId
          });
        }
        // 重 pull → 跑 cloudResolveAndMerge 重新合併（內部會處理衝突 modal 或自動合併後 push）
        const remoteText = await driveDownloadFile(meta.trackerFileId);
        const result = unwrapTracker(remoteText);
        if (result.ok) {
          // 走完整 merge 流程（會 push 結果）
          await cloudResolveAndMerge({
            remoteData: result.data,
            remoteMeta: result.meta,
            fileId: meta.trackerFileId,
            trackerCreatedAt: result.meta.createdAt
          });
          // resolveAndMerge 內已 push + setMeta，這裡直接收尾
          cloudPushFailRetries = 0;
          cloudPendingChangesCount = 0;
          cloudSetSyncStatus('idle');
          if (typeof toast === 'function') toast('✓ 偵測到雲端有新版，已自動合併', 3000);
          return;
        }
        // unwrap 失敗 → 走原本流程（風險較高但不能讓 push 永遠卡住）
        console.warn('[cloud-push] 雲端 unwrap 失敗，仍照原本流程嘗試 push');
      }
    } catch (e) {
      // version check 失敗（網路 / token）→ 不阻塞 push，繼續走原本流程
      console.warn('[cloud-push] version check 失敗，跳過繼續 push:', e.message || e);
    }

    const wrapper = buildTrackerWrapper(meta.lastSyncedVersion || 0);
    const updated = await driveUpdateFile(meta.trackerFileId, wrapper);
    cloudSaveMeta({
      // v3.24.21：用 Drive 回傳的 modifiedTime（精確到伺服器寫入時間），而非 wrapper.lastModifiedAt（本機 build 時間，會早 100-500ms）
      lastSyncedAt: (updated && updated.modifiedTime) || wrapper.lastModifiedAt,
      lastSyncedVersion: wrapper.version,
    });
    cloudSaveLastSyncedSnapshot(wrapper.data);  // α2-4a：本機剛 push 的就是新的「上次成功同步」
    if (typeof logAction === 'function') {
      logAction('cloud-push', { fileId: meta.trackerFileId, version: wrapper.version });
    }
    console.log(`[cloud-push] ✓ Drive 已更新到 v${wrapper.version}`);
    cloudPushFailRetries = 0;       // v3.24.13：成功 → 重試計數歸零
    cloudPendingChangesCount = 0;   // v3.24.15：成功 → 待推筆數歸零
    cloudSetSyncStatus('idle');  // α2-5
    // α2-7b：push 成功後檢查今天是否要建 auto snapshot（內含 1 小時節流）
    cloudEnsureDailyAutoSnapshot().catch(e => console.error('[snapshot-auto] async:', e));
  } catch (e) {
    console.error('[cloud-push] failed:', e);
    if (typeof logAction === 'function') {
      logAction('cloud-push-error', { error: e.message || String(e) });
    }
    cloudSetSyncStatus('error', e.message || String(e));  // α2-5
    // v3.24.13：失敗 → 指數退避自動重試（最多 5 次，再失敗就靠 banner 等使用者手動點重試）
    if (cloudPushFailRetries < CLOUD_PUSH_MAX_RETRIES) {
      const delay = CLOUD_PUSH_RETRY_DELAYS_MS[cloudPushFailRetries] || 180000;
      cloudPushFailRetries++;
      console.log(`[cloud-push] ${delay/1000}s 後自動重試 (#${cloudPushFailRetries}/${CLOUD_PUSH_MAX_RETRIES})`);
      setTimeout(() => {
        cloudPushNow().catch(err => console.error('[cloud-push] retry async failed:', err));
      }, delay);
    } else {
      console.error('[cloud-push] 已達最大重試次數，請手動點 banner 重試');
    }
  } finally {
    cloudPushInProgress = false;
    // v3.24.13：併發期間有新 save → 立刻再推一次（不 debounce）
    if (cloudPushPendingAfter) {
      cloudPushPendingAfter = false;
      setTimeout(() => {
        cloudPushNow().catch(err => console.error('[cloud-push] pending-after async failed:', err));
      }, 0);
    }
  }
}

// v3.24.13：手動重試入口（給 banner 的「立刻重試」按鈕用）
function cloudRetryPush() {
  cloudPushFailRetries = 0;
  cloudPushNow().catch(e => console.error('[cloud-push] manual retry failed:', e));
}

// ---------- Drive snapshot（α2-7a）----------
// 在 App Folder 內每筆 snapshot 是獨立 .json 檔
// 命名：snapshot-{ISO ts}-{auto|manual}[-{safe label}].json
// 每筆內容：{ schemaVersion, snapshotMeta: {id, type, label, createdAt, deviceName}, data }
// auto = 自動每日（α2-7b 才接觸發）；manual = 使用者按按鈕建立的（永久保留）

const SNAPSHOT_FILENAME_PREFIX = 'snapshot-';

// 把使用者輸入的 label 轉成檔名安全字串（保留中英數字、底線、連字號）
function _snapshotSafeLabel(label) {
  if (!label) return '';
  return String(label).replace(/[^A-Za-z0-9_一-鿿-]/g, '').slice(0, 30);
}

async function cloudCreateSnapshot(type, label) {
  if (!isCloudSignedIn()) throw new Error('未登入 Google');
  if (type !== 'auto' && type !== 'manual') throw new Error('snapshot type 必須是 auto 或 manual');

  const createdAt = new Date().toISOString();
  const snapshot = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    snapshotMeta: {
      id: 'snap_' + Math.random().toString(36).slice(2, 10),
      type,
      label: label || '',
      createdAt,
      deviceName: (typeof getDeviceLabel === 'function') ? getDeviceLabel() : '未命名裝置'
    },
    data: {
      clients: state.clients || [],
      jobs: state.jobs || [],
      invoiceHistory: state.invoiceHistory || [],  // v3.12.0
      config: config || {}
    }
  };

  const ts = createdAt.replace(/[:.]/g, '-');  // ISO 字串裡的 : 跟 . Drive 都允許但讀不順
  let filename = `${SNAPSHOT_FILENAME_PREFIX}${ts}-${type}`;
  const safe = _snapshotSafeLabel(label);
  if (safe) filename += '-' + safe;
  filename += '.json';

  const created = await driveCreateFile(filename, snapshot);
  if (typeof logAction === 'function') {
    logAction('cloud-snapshot-create', { fileId: created.id, type, label: label || '' });
  }
  return created;
}

async function cloudListSnapshots() {
  if (!isCloudSignedIn()) return [];
  const query = `name contains "${SNAPSHOT_FILENAME_PREFIX}" and trashed = false`;
  const files = await driveListAppFolder(query);
  return files.filter(f => f.name && f.name.startsWith(SNAPSHOT_FILENAME_PREFIX) && f.name.endsWith('.json'));
}

async function cloudDownloadSnapshot(fileId) {
  return driveDownloadFile(fileId);
}

// 拆成兩段：「下載 + 解析」 vs「實際套用」，方便預覽 modal 中間插隊
async function _cloudDownloadParsedSnapshot(fileId) {
  const text = await cloudDownloadSnapshot(fileId);
  let parsed;
  try { parsed = JSON.parse(text); }
  catch (_) { throw new Error('snapshot 不是合法 JSON'); }
  if (!parsed.data || typeof parsed.data !== 'object') {
    throw new Error('snapshot 結構不正確（缺 data 區塊）');
  }
  return parsed;  // { schemaVersion, snapshotMeta, data }
}

// 實際執行還原（在 modal 確認後呼叫）
async function _cloudApplyRestore(parsed, fileId) {
  // 還原前自動建一筆「還原前-」manual snapshot 保險
  try {
    const safetyLabel = '還原前-' + new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
    await cloudCreateSnapshot('manual', safetyLabel);
  } catch (e) {
    console.warn('[snapshot-restore] safety backup failed:', e);
  }

  applyTrackerData(parsed.data);

  // 推回 Drive tracker.json
  const meta = cloudGetMeta();
  if (meta.trackerFileId) {
    try {
      const wrapper = buildTrackerWrapper(meta.lastSyncedVersion || 0);
      await driveUpdateFile(meta.trackerFileId, wrapper);
      cloudSaveMeta({
        lastSyncedAt: wrapper.lastModifiedAt,
        lastSyncedVersion: wrapper.version
      });
      cloudSaveLastSyncedSnapshot(wrapper.data);
    } catch (e) {
      console.error('[snapshot-restore] push to tracker.json failed:', e);
      throw new Error('資料已在本機還原，但推回 Drive tracker.json 失敗：' + e.message + '\n下次手動「立即同步」再試');
    }
  }

  if (typeof logAction === 'function') {
    logAction('cloud-snapshot-restore', { fileId });
  }
}

// 給外部呼叫的舊 API（先保留以免有別處 reference；實際走還原流程的入口是 cloudRestoreSnapshotConfirm）
async function cloudRestoreSnapshot(fileId) {
  if (!isCloudSignedIn()) { alert('請先登入'); return false; }
  try {
    const parsed = await _cloudDownloadParsedSnapshot(fileId);
    await _cloudApplyRestore(parsed, fileId);
    return true;
  } catch (e) {
    alert('還原失敗：' + e.message);
    return false;
  }
}

async function cloudDeleteSnapshot(fileId) {
  if (!isCloudSignedIn()) { alert('請先登入'); return; }
  if (!confirm('確定要刪除這筆 snapshot？此動作無法還原。')) return;
  toastProgress('🗑️ 刪除中…');
  try {
    await driveDeleteFile(fileId);
    toastDismiss();
    toast('✓ 已刪除', 2000);
    if (typeof logAction === 'function') {
      logAction('cloud-snapshot-delete', { fileId });
    }
    await cloudRefreshSnapshotList();
  } catch (e) {
    toastDismiss();
    alert('刪除 snapshot 失敗：' + e.message);
  }
}

// ---------- snapshot UI helpers（α2-7a）----------

async function cloudCreateManualSnapshot() {
  const labelInput = document.getElementById('cloud-snapshot-manual-label');
  const label = labelInput ? labelInput.value.trim() : '';
  // 立刻 toast 給使用者反饋（建立過程約 1~3 秒，不能讓他看著按鈕發呆）
  toastProgress('💾 建立備份中…');
  try {
    await cloudCreateSnapshot('manual', label);
    if (labelInput) labelInput.value = '';
    toastDismiss();
    toast('✓ 備份已建立', 2500);
    await cloudRefreshSnapshotList();
  } catch (e) {
    toastDismiss();
    alert('建立 snapshot 失敗：' + e.message);
  }
}

async function cloudRefreshSnapshotList() {
  const listEl = document.getElementById('cloud-snapshot-list');
  if (!listEl) return;
  if (!isCloudSignedIn()) {
    listEl.innerHTML = '<p style="color:var(--muted);font-size:13px;">請先登入 Google 才能查看備份歷史</p>';
    return;
  }
  listEl.innerHTML = '<p style="color:var(--muted);font-size:13px;">載入中…</p>';
  try {
    const files = await cloudListSnapshots();
    if (files.length === 0) {
      listEl.innerHTML = '<p style="color:var(--muted);font-size:13px;">還沒有任何備份。在上方輸入標籤後按「📦 建立備份」開始第一筆。</p>';
      return;
    }
    // 依 modifiedTime 倒序（最新在上）— driveListAppFolder 已經 orderBy modifiedTime desc，但保險再排
    files.sort((a, b) => (b.modifiedTime || '').localeCompare(a.modifiedTime || ''));
    listEl.innerHTML = files.map(f => _renderSnapshotItem(f)).join('');
  } catch (e) {
    listEl.innerHTML = `<p style="color:var(--danger);font-size:13px;">載入失敗：${cloudEscapeHtml(e.message)}</p>`;
  }
}

function _renderSnapshotItem(f) {
  // 解析檔名：snapshot-2026-04-29T15-30-22-123Z-auto[-label].json
  const m = f.name.match(/^snapshot-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)-(auto|manual)(?:-(.+))?\.json$/);
  let timeStr = f.name;
  let type = '?', label = '';
  if (m) {
    // 把 ISO 還原回標準格式：2026-04-29T15-30-22-123Z → 2026-04-29T15:30:22.123Z
    const isoCandidate = m[1].replace(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, '$1T$2:$3:$4.$5Z');
    try {
      const d = new Date(isoCandidate);
      if (!isNaN(d.getTime())) {
        timeStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ` +
                  `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      }
    } catch(_) {}
    type = m[2];
    label = m[3] || '';
  }
  const typeIcon = type === 'manual' ? '🏷️' : '⏰';
  const typeName = type === 'manual' ? '手動' : '自動';
  const sizeText = _snapshotFormatBytes(f.size);
  const labelHtml = label ? `<span style="color:var(--primary);font-weight:600;">${cloudEscapeHtml(label)}</span> ` : '';

  return `
    <div style="border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:6px;display:flex;align-items:center;gap:8px;">
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;">${typeIcon} ${labelHtml}${cloudEscapeHtml(timeStr)}</div>
        <div style="font-size:11px;color:var(--muted);">${typeName} · ${sizeText}</div>
      </div>
      <button class="btn btn-outline btn-sm" onclick="cloudRestoreSnapshotConfirm('${f.id}', '${cloudEscapeHtml(timeStr)}')">還原</button>
      <button class="btn btn-outline btn-sm" onclick="cloudDeleteSnapshot('${f.id}')" title="刪除這筆 snapshot">🗑️</button>
    </div>
  `;
}

function _snapshotFormatBytes(bytes) {
  if (!bytes) return '—';
  const n = parseInt(bytes, 10);
  if (isNaN(n)) return '—';
  if (n < 1024) return n + ' B';
  if (n < 1024*1024) return (n/1024).toFixed(1) + ' KB';
  return (n/1024/1024).toFixed(2) + ' MB';
}

// ---------- snapshot 自動每日 + 分層保留 prune（α2-7b）----------
// 觸發點：cloudInitTrackerFile 成功 / cloudPushNow 成功 → 都會呼叫 cloudEnsureDailyAutoSnapshot
// 一個 session 內 1 小時節流，避免每次 push 都 list snapshots 浪費 API 配額

let cloudAutoSnapshotCheckedAt = 0;
const CLOUD_AUTO_SNAPSHOT_THROTTLE_MS = 60 * 60 * 1000;  // 1 小時

async function cloudEnsureDailyAutoSnapshot() {
  if (!isCloudSignedIn()) return;
  if (Date.now() - cloudAutoSnapshotCheckedAt < CLOUD_AUTO_SNAPSHOT_THROTTLE_MS) return;
  cloudAutoSnapshotCheckedAt = Date.now();

  try {
    const all = await cloudListSnapshots();
    const today = new Date().toISOString().slice(0, 10);  // YYYY-MM-DD
    // 判斷今天是否已有 auto snapshot：解析檔名第一個 YYYY-MM-DD 並比對
    const hasTodayAuto = all.some(f => {
      const m = f.name.match(/^snapshot-(\d{4}-\d{2}-\d{2})T.*-auto\b/);
      return m && m[1] === today;
    });
    if (hasTodayAuto) {
      console.log('[snapshot-auto] 今天已有 auto snapshot，跳過');
      return;
    }
    console.log('[snapshot-auto] 建立今天的 auto snapshot');
    await cloudCreateSnapshot('auto', '');
    // 順便跑一次 prune（分層保留）
    await cloudPruneSnapshots();
  } catch (e) {
    console.error('[snapshot-auto] failed:', e);
  }
}

// 分層保留：手動 snapshot 不動，auto snapshot 依時段密度減量
//   最近 7 天：全留（每天 1 筆）
//   7-30 天：每週留 1 筆（取該週最新）
//   1-12 個月：每月留 1 筆
//   12+ 個月：每年留 1 筆
async function cloudPruneSnapshots() {
  if (!isCloudSignedIn()) return;
  try {
    const all = await cloudListSnapshots();
    const autos = [];
    for (const f of all) {
      const m = f.name.match(/^snapshot-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z-auto\b/);
      if (!m) continue;
      const iso = `${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`;
      const dt = new Date(iso);
      if (isNaN(dt.getTime())) continue;
      autos.push({ id: f.id, name: f.name, dt });
    }

    if (autos.length === 0) return;

    autos.sort((a, b) => b.dt - a.dt);  // 新 → 舊

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const toKeep = new Set();

    // 最近 7 天：全留
    autos.forEach(s => {
      if (now - s.dt < 7 * DAY) toKeep.add(s.id);
    });

    // 7-30 天：每週留 1 筆（取該週最新者）
    const weekBuckets = new Map();
    autos.forEach(s => {
      const age = now - s.dt;
      if (age < 7 * DAY || age >= 30 * DAY) return;
      const wk = _cloudIsoWeekKey(s.dt);
      const cur = weekBuckets.get(wk);
      if (!cur || s.dt > cur.dt) weekBuckets.set(wk, s);
    });
    weekBuckets.forEach(s => toKeep.add(s.id));

    // 1-12 月：每月留 1 筆
    const monthBuckets = new Map();
    autos.forEach(s => {
      const age = now - s.dt;
      if (age < 30 * DAY || age >= 365 * DAY) return;
      const mk = `${s.dt.getUTCFullYear()}-${String(s.dt.getUTCMonth() + 1).padStart(2, '0')}`;
      const cur = monthBuckets.get(mk);
      if (!cur || s.dt > cur.dt) monthBuckets.set(mk, s);
    });
    monthBuckets.forEach(s => toKeep.add(s.id));

    // 12+ 月：每年留 1 筆
    const yearBuckets = new Map();
    autos.forEach(s => {
      const age = now - s.dt;
      if (age < 365 * DAY) return;
      const yk = String(s.dt.getUTCFullYear());
      const cur = yearBuckets.get(yk);
      if (!cur || s.dt > cur.dt) yearBuckets.set(yk, s);
    });
    yearBuckets.forEach(s => toKeep.add(s.id));

    const toDelete = autos.filter(s => !toKeep.has(s.id));
    if (toDelete.length === 0) {
      console.log('[snapshot-prune] 沒有要刪的');
      return;
    }

    console.log(`[snapshot-prune] 要刪 ${toDelete.length} 筆過期 auto snapshot`);
    let deletedCount = 0;
    for (const s of toDelete) {
      try {
        await driveDeleteFile(s.id);
        deletedCount++;
      } catch (e) {
        console.warn('[snapshot-prune] delete failed:', s.name, e);
      }
    }
    if (deletedCount > 0 && typeof logAction === 'function') {
      logAction('cloud-snapshot-prune', { deletedCount, keptCount: toKeep.size });
    }
  } catch (e) {
    console.error('[snapshot-prune] failed:', e);
  }
}

// ISO 週數 key（YYYY-Www），給分層保留分桶用
function _cloudIsoWeekKey(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  const day = x.getUTCDay() || 7;  // 週日當作 7（變成 ISO Mon-Sun）
  x.setUTCDate(x.getUTCDate() + 4 - day);  // 移到當週週四
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((x - yearStart) / 86400000) + 1) / 7);
  return `${x.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// ---------- 還原預覽 modal（含「目前 vs snapshot」對比）----------
let cloudPendingRestore = null;  // { parsed, fileId, timeStr }

// 計算資料統計（業主數 / 案件數 / 完成 / 已收 / 應收金額 / 已收金額）
function _cloudCalcStats(data) {
  const clients = (data && data.clients) || [];
  const jobs = (data && data.jobs) || [];
  let totalAmount = 0, paidAmount = 0;
  let doneCount = 0, paidCount = 0, cancelledCount = 0;
  for (const j of jobs) {
    if (j.cancelled) { cancelledCount++; continue; }
    const amt = Number(j.amount) || 0;
    totalAmount += amt;
    if (j.done) doneCount++;
    if (Array.isArray(j.payments) && j.payments.length > 0) {
      paidAmount += j.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
    } else if (j.paid) {
      paidAmount += amt;
    }
    if (j.paid) paidCount++;
  }
  return {
    clients: clients.length,
    jobs: jobs.length,
    doneJobs: doneCount,
    paidJobs: paidCount,
    cancelledJobs: cancelledCount,
    totalAmount,
    paidAmount,
    unpaidAmount: totalAmount - paidAmount
  };
}

function _cloudFormatNT(n) {
  return 'NT$ ' + Math.round(n).toLocaleString('en-US');
}

// 渲染對比表格的單一 row（數字欄位）
function _cloudStatsRow(label, current, snap, formatter) {
  const fmt = formatter || ((x) => String(x));
  let diffHtml = '';
  if (current !== snap) {
    const delta = snap - current;
    if (delta > 0) diffHtml = ` <span style="color:#10b981;font-size:11px;">(+${fmt(delta).replace('NT$ ', '')})</span>`;
    else diffHtml = ` <span style="color:#ef4444;font-size:11px;">(${fmt(delta).replace('NT$ ', '-NT$ ').replace('--', '-')})</span>`;
  }
  return `
    <tr>
      <td style="padding:6px 10px;color:var(--muted);font-size:13px;">${label}</td>
      <td style="padding:6px 10px;text-align:right;font-size:13px;">${fmt(current)}</td>
      <td style="padding:6px 10px;text-align:right;font-size:13px;font-weight:600;">${fmt(snap)}${diffHtml}</td>
    </tr>
  `;
}

// 主入口：點還原按鈕 → 載入預覽 → 開 modal
async function cloudRestoreSnapshotConfirm(fileId, timeStr) {
  if (!isCloudSignedIn()) { alert('請先登入'); return; }

  // 立刻 toast 反饋（下載 + 解析約 1~2 秒）
  toastProgress('📥 載入 snapshot 預覽…');
  let parsed;
  try {
    parsed = await _cloudDownloadParsedSnapshot(fileId);
  } catch (e) {
    toastDismiss();
    alert('載入 snapshot 失敗：' + e.message);
    return;
  }
  toastDismiss();

  cloudShowRestorePreviewModal({ parsed, fileId, timeStr });
}

function cloudShowRestorePreviewModal({ parsed, fileId, timeStr }) {
  cloudPendingRestore = { parsed, fileId, timeStr };

  const localStats = _cloudCalcStats({ clients: state.clients, jobs: state.jobs });
  const snapStats = _cloudCalcStats(parsed.data);
  const meta = parsed.snapshotMeta || {};

  const old = document.getElementById('cloud-restore-preview-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'cloud-restore-preview-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);' +
    'display:flex;align-items:center;justify-content:center;padding:20px;';

  const dialog = document.createElement('div');
  dialog.style.cssText =
    'background:var(--card);color:var(--text);border-radius:12px;' +
    'padding:20px;max-width:600px;width:100%;max-height:85vh;overflow:auto;' +
    'box-shadow:0 8px 32px rgba(0,0,0,0.3);';

  const labelHtml = meta.label ? `<div><b>標籤：</b>${cloudEscapeHtml(meta.label)}</div>` : '';
  const deviceHtml = meta.deviceName ? `<div><b>建立裝置：</b>${cloudEscapeHtml(meta.deviceName)}</div>` : '';
  const typeHtml = meta.type === 'manual' ? '🏷️ 手動備份' : '⏰ 自動每日';

  dialog.innerHTML =
    '<h2 style="margin:0 0 12px 0;font-size:18px;">↩ 還原 snapshot 預覽</h2>' +
    `<div style="background:var(--bg);padding:10px 12px;border-radius:8px;font-size:13px;line-height:1.7;margin-bottom:14px;">` +
    `  <div><b>備份時間：</b>${cloudEscapeHtml(timeStr)}</div>` +
    `  <div><b>類型：</b>${typeHtml}</div>` +
    labelHtml + deviceHtml +
    `</div>` +
    '<div style="font-size:13px;color:var(--muted);margin-bottom:6px;">資料變動預覽（紅色為減少、綠色為增加）：</div>' +
    `<table style="width:100%;border-collapse:collapse;margin-bottom:12px;border:1px solid var(--border);border-radius:6px;overflow:hidden;">` +
    `  <thead style="background:var(--bg);">` +
    `    <tr>` +
    `      <th style="padding:6px 10px;text-align:left;font-size:12px;color:var(--muted);font-weight:500;">項目</th>` +
    `      <th style="padding:6px 10px;text-align:right;font-size:12px;color:var(--muted);font-weight:500;">目前</th>` +
    `      <th style="padding:6px 10px;text-align:right;font-size:12px;color:var(--muted);font-weight:500;">還原後</th>` +
    `    </tr>` +
    `  </thead>` +
    `  <tbody>` +
    _cloudStatsRow('業主數', localStats.clients, snapStats.clients) +
    _cloudStatsRow('案件總數', localStats.jobs, snapStats.jobs) +
    _cloudStatsRow('已完成案件', localStats.doneJobs, snapStats.doneJobs) +
    _cloudStatsRow('已收款案件', localStats.paidJobs, snapStats.paidJobs) +
    _cloudStatsRow('已取消案件', localStats.cancelledJobs, snapStats.cancelledJobs) +
    _cloudStatsRow('應收總額', localStats.totalAmount, snapStats.totalAmount, _cloudFormatNT) +
    _cloudStatsRow('已收金額', localStats.paidAmount, snapStats.paidAmount, _cloudFormatNT) +
    _cloudStatsRow('未收金額', localStats.unpaidAmount, snapStats.unpaidAmount, _cloudFormatNT) +
    `  </tbody>` +
    `</table>` +
    `<div style="background:var(--bg);padding:10px 12px;border-radius:8px;font-size:12px;color:var(--muted);margin-bottom:14px;">` +
    `  💡 <b>還原前會自動建一筆「還原前-」備份保險</b>。<br>` +
    `  即使還原後不滿意，也可以從備份歷史再還原回剛才的版本。` +
    `</div>` +
    '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
    '  <button class="btn btn-outline" onclick="cloudClosePreviewModal()">取消</button>' +
    '  <button class="btn btn-primary" onclick="cloudConfirmRestore()">確認還原</button>' +
    '</div>';

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
}

function cloudClosePreviewModal() {
  const overlay = document.getElementById('cloud-restore-preview-overlay');
  if (overlay) overlay.remove();
  cloudPendingRestore = null;
}

async function cloudConfirmRestore() {
  if (!cloudPendingRestore) return;
  const { parsed, fileId } = cloudPendingRestore;
  cloudClosePreviewModal();

  toastProgress('⏳ 還原中…請勿關閉視窗');
  try {
    await _cloudApplyRestore(parsed, fileId);
    toastDismiss();
    toast('✓ 還原完成', 3000);
    await cloudRefreshSnapshotList();
  } catch (e) {
    toastDismiss();
    alert('還原失敗：' + e.message);
  }
}

// ---------- 存摺照片自動遷移：base64 → Drive 個別檔（α3-4）----------
// 觸發：cloudInitTrackerFile 完成後（fire-and-forget）
// 邏輯：掃 paymentAccounts 找「有 base64 但沒 fileId」的 → 逐筆上傳 → 換成 fileId
// 失敗保留原 base64，下次再試；session 內節流 1 小時防重複嘗試

let cloudMigrateBankbookImagesCheckedAt = 0;
const CLOUD_MIGRATE_THROTTLE_MS = 60 * 60 * 1000;  // 1 小時

async function cloudMigrateBankbookImages() {
  if (!isCloudSignedIn()) return;
  if (!cloudGetMeta().trackerFileId) return;
  if (Date.now() - cloudMigrateBankbookImagesCheckedAt < CLOUD_MIGRATE_THROTTLE_MS) return;
  cloudMigrateBankbookImagesCheckedAt = Date.now();

  const accounts = (config && config.userInfo && config.userInfo.paymentAccounts) || [];
  const toMigrate = accounts.filter(a => a.bankbookImage && !a.bankbookImageFileId);
  if (toMigrate.length === 0) return;

  console.log(`[bankbook-migrate] 找到 ${toMigrate.length} 筆 base64 存摺要遷移`);
  let migratedCount = 0;
  for (const a of toMigrate) {
    try {
      const filename = `bankbook-${a.id}-migrated-${Date.now()}.jpg`;
      const uploaded = await driveUploadImage(a.bankbookImage, filename);
      a.bankbookImageFileId = uploaded.id;
      a.bankbookImage = '';
      migratedCount++;
      console.log(`[bankbook-migrate] ✓ ${a.label || a.id} → ${uploaded.id}`);
    } catch (e) {
      console.warn(`[bankbook-migrate] ✗ ${a.label || a.id}:`, e.message || e);
      // 保留原 base64，下次再試
    }
  }

  if (migratedCount > 0) {
    if (typeof logAction === 'function') {
      logAction('cloud-image-migrate', { migratedCount, totalAttempted: toMigrate.length });
    }
    // 寫回 localStorage（save() 內含 cloudSchedulePush 推 Drive）
    if (typeof save === 'function') save();
    // 重繪讓 fileId 路徑生效
    if (typeof renderAll === 'function') renderAll();
    if (typeof toast === 'function') {
      toast(`✓ 已自動把 ${migratedCount} 張存摺照片遷移到 Drive`, 4000);
    }
  }
}

// ============== 📅 Calendar Sync Layer（v3.1.0 起新增）==============
// 把 v3 的 jobs + 5 種提醒 + 每日早報，增量同步到使用者選定的 Google Calendar
// 安全保證：只動帶 ftSource=freelance-tracker-cloud 標記的事件，其他事件 100% 不碰

const CLOUD_CALENDAR_KEY = 'cloud-freelance-tracker-calendar';
const FT_CALENDAR_SOURCE = 'freelance-tracker-cloud';
const CALENDAR_TIMEZONE = 'Asia/Taipei';

// localStorage 結構：
// {
//   calendarId, calendarName,                 ← 使用者選定的目標日曆
//   dailyMorningTime: '09:30',                ← 每日早報 HH:MM（local time）
//   syncTypes: { jobs, unpaidLong, monthEnd, billingDay, slowPay, dailyMorning }
//   autoSync: false,                          ← 改動後 30 秒 debounce 自動同步
//   lastSyncedAt: ISO,
//   lastSyncResult: { added, updated, deleted }
// }

function cloudGetCalendarConfig() {
  try {
    const raw = localStorage.getItem(CLOUD_CALENDAR_KEY);
    const cfg = raw ? JSON.parse(raw) : {};
    // 預設值（v3.7.0：加 enabled master toggle、移除 autoSync — 啟用就自動）
    return {
      enabled: false,                              // v3.7.0：master toggle，OFF = 不 auto sync
      calendarId: '',
      calendarName: '',
      dailyMorningTime: '09:30',
      syncTypes: {
        jobs: true,
        unpaidLong: true,
        monthEnd: true,
        billingDay: true,
        slowPay: true,
        dailyMorning: true,
        ...(cfg.syncTypes || {})
      },
      lastSyncedAt: null,
      lastSyncResult: null,
      ...cfg
    };
  } catch (_) { return { enabled: false, calendarId: '', dailyMorningTime: '09:30', syncTypes: {} }; }
}

function cloudSaveCalendarConfig(patch) {
  try {
    const cur = cloudGetCalendarConfig();
    const next = { ...cur, ...patch };
    localStorage.setItem(CLOUD_CALENDAR_KEY, JSON.stringify(next));
    return next;
  } catch (e) { console.warn('[calendar] save config failed:', e); return null; }
}

// ---------- 標題 / 描述 / 顏色（v3.1.0）----------

// 案件狀態 → emoji + Calendar colorId（1~11）
// colorId 對照：1 Lavender / 2 Sage / 3 Grape / 4 Flamingo / 5 Banana / 6 Tangerine
//                7 Peacock / 8 Graphite / 9 Blueberry / 10 Basil / 11 Tomato
function _calendarJobStatus(j) {
  if (j.cancelled) return { emoji: '⚫️', color: '8' };  // 灰
  if (j.paid) return { emoji: '✅', color: '10' };       // 深綠（已收款）
  if (j.done) return { emoji: '🟢', color: '2' };        // 綠（已完成待收款）
  // 還沒完成 → 看是否逾期 / 即將到期
  const today = new Date(); today.setHours(0,0,0,0);
  const due = j.endDate ? new Date(j.endDate) : new Date(j.date);
  due.setHours(0,0,0,0);
  const daysToDue = Math.round((due - today) / 86400000);
  if (daysToDue < 0) return { emoji: '🔴', color: '11' };       // 紅（逾期）
  if (daysToDue <= 3) return { emoji: '🟡', color: '5' };       // 黃（即將到期）
  return { emoji: '🔵', color: '7' };                            // 藍（進行中）
}

function _calendarBuildJobEvent(job, client, todayStr) {
  const status = _calendarJobStatus(job);
  const cancelPrefix = job.cancelled ? '(已取消) ' : '';
  const summary = `${status.emoji} ${cancelPrefix}${job.title || '(無標題)'} · ${client?.name || '?'}`;

  const lines = [];
  lines.push(`業主：${client?.name || '?'}`);
  lines.push(`金額：NT$ ${(+job.amount || 0).toLocaleString('en-US')}`);
  if (job.tag) lines.push(`類型：${job.tag}`);
  lines.push('─────────');
  let progress = '進行中';
  if (job.cancelled) progress = '已取消';
  else if (job.paid) progress = '已完成已收款';
  else if (job.done) progress = '已完成待收款';
  lines.push(`進度：${progress}`);
  if (job.doneAt) lines.push(`完成日：${job.doneAt}`);
  // 收款累計
  let paidSum = 0;
  if (Array.isArray(job.payments) && job.payments.length > 0) {
    paidSum = job.payments.reduce((s, p) => s + (+p.amount || 0), 0);
  } else if (job.paid) {
    paidSum = +job.amount || 0;
  }
  lines.push(`收款：NT$ ${paidSum.toLocaleString('en-US')} / NT$ ${(+job.amount || 0).toLocaleString('en-US')}`);
  if (job.details) {
    lines.push('─────────');
    lines.push(`詳情：${job.details}`);
  }
  lines.push('');
  lines.push('在 App 中查看：');
  lines.push(`https://lancelotwang114.github.io/freelance-tracker-cloud/#job-${job.id}`);

  return {
    ftKey: `job-${job.id}`,
    summary,
    description: lines.join('\n'),
    start: { date: job.date },
    end: { date: _calendarDayAfter(job.endDate || job.date) },  // Calendar all-day end is exclusive
    colorId: status.color,
  };
}

// Calendar 全天事件 end.date 是 exclusive（不包含當天），所以加 1 天
function _calendarDayAfter(dateStr) {
  if (!dateStr) return dateStr;
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// 收集當天涉及的所有 items（給每日早報用）
function _calendarCollectDayItems(dateStr, cfg) {
  const items = [];
  const clientById = {};
  state.clients.forEach(c => { clientById[c.id] = c; });

  // 案件：今天開始 / 結束 / 區間內的
  if (cfg.syncTypes.jobs) {
    state.jobs.forEach(j => {
      if (j.cancelled) return;  // 取消的不放進每日早報
      const start = j.date || '';
      const end = j.endDate || j.date || '';
      if (start <= dateStr && dateStr <= end) {
        const status = _calendarJobStatus(j);
        const c = clientById[j.clientId];
        const span = (start === dateStr && end === dateStr) ? '今天'
          : (start === dateStr) ? `今天開始（到 ${_calendarShortDate(end)}）`
          : (end === dateStr) ? '今天到期！'
          : `進行中 (${_calendarShortDate(start)}~${_calendarShortDate(end)})`;
        items.push({
          icon: status.emoji,
          // v3.22.5：顯示折扣後應收
          line: `${status.emoji} ${j.title || '(無標題)'} · ${c?.name || '?'}（${span}，NT$ ${jobFinalAmount(j).toLocaleString('en-US')}）`,
          group: '📌 案件'
        });
      }
    });
  }

  // 提醒（5 種，邏輯沿用 v2 的 buildReminderEvents 但改成「今天命中」判斷）
  if (cfg.syncTypes.unpaidLong) {
    state.jobs.forEach(j => {
      if (j.cancelled || j.paid || !j.done || !j.doneAt) return;
      const c = clientById[j.clientId];
      const days = (c?.unpaidRemindDaysOverride != null) ? c.unpaidRemindDaysOverride : (config.unpaidRemindDays || 7);
      const remindStr = _calendarAddDays(j.doneAt, days);
      if (remindStr === dateStr) {
        items.push({
          icon: '🟠',
          line: `🟠 ${c?.name || '?'} 完成 ${days} 天未收款：${j.title}`,
          group: '⏰ 提醒'
        });
      }
    });
  }

  if (cfg.syncTypes.monthEnd) {
    const day = +(dateStr.split('-')[2]);
    const startDay = config.monthEndReminderDay || 25;
    if (day === startDay) {
      items.push({ icon: '📅', line: `📅 月底提醒：可開始整理請款`, group: '⏰ 提醒' });
    }
  }

  if (cfg.syncTypes.billingDay) {
    const [yStr, mStr, dStr] = dateStr.split('-');
    state.clients.forEach(c => {
      if (!c.billingDay || c.billingDay < 1 || c.billingDay > 31) return;
      const remindDays = +c.billingRemindDays || 3;
      // 找這個月的 billing 日
      const bm = new Date(+yStr, +mStr - 1, c.billingDay);
      // 處理月份天數不足
      if (bm.getMonth() !== (+mStr - 1)) return;
      const remindDate = _calendarAddDays(`${bm.getFullYear()}-${String(bm.getMonth()+1).padStart(2,'0')}-${String(bm.getDate()).padStart(2,'0')}`, -remindDays);
      if (remindDate === dateStr) {
        items.push({
          icon: '📋',
          line: `📋 ${c.name} 月 ${c.billingDay} 日請款（提前 ${remindDays} 天）`,
          group: '⏰ 提醒'
        });
      }
    });
  }

  if (cfg.syncTypes.slowPay) {
    // 拖款警告：今天命中的拖款 jobs（每天重新計算）
    if (dateStr === todayStr()) {
      const slowJobs = (typeof computeSlowPayJobs === 'function') ? computeSlowPayJobs(state.jobs.filter(j => !j.cancelled)) : [];
      slowJobs.forEach(j => {
        const c = clientById[j.clientId];
        items.push({
          icon: '🐢',
          line: `🐢 拖款警告：${c?.name || '?'} · ${j.title}（已過 ${j.daysSince} 天）`,
          group: '⏰ 提醒'
        });
      });
    }
  }

  return items;
}

function _calendarAddDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function _calendarShortDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  return parts.length === 3 ? `${+parts[1]}/${+parts[2]}` : dateStr;
}

// 加 N 分鐘到 HH:MM
function _calendarAddMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

// ---------- 建構目標事件（target events）----------

function buildTargetCalendarEvents(cfg) {
  const events = [];
  const clientById = {};
  state.clients.forEach(c => { clientById[c.id] = c; });
  const today = todayStr();

  // v3.24.11：所有提醒類型統一用「通知時間」（cfg.dailyMorningTime，預設 09:30）
  // 改成時間事件後 reminders.overrides minutes:0 才能準時響（含 iOS 行事曆）
  // 註：API 限制全天事件無法當天 X:XX 響，因此把 4 種提醒改成從 09:30 起 15 分鐘的時間事件
  const reminderTime = cfg.dailyMorningTime || '09:30';
  const reminderEndTime = _calendarAddMinutes(reminderTime, 15);

  // 1. 案件本身（保留全天事件 → 月檢視看得到區間，提醒靠每日早報帶）
  if (cfg.syncTypes.jobs) {
    state.jobs.forEach(j => {
      if (!j.date) return;  // 沒日期的不同步
      const c = clientById[j.clientId];
      events.push(_calendarBuildJobEvent(j, c, today));
    });
  }

  // 2. 完成已久未收款提醒
  if (cfg.syncTypes.unpaidLong) {
    state.jobs.forEach(j => {
      if (j.cancelled || j.paid || !j.done || !j.doneAt) return;
      const c = clientById[j.clientId];
      const days = (c?.unpaidRemindDaysOverride != null) ? c.unpaidRemindDaysOverride : (config.unpaidRemindDays || 7);
      const remindStr = _calendarAddDays(j.doneAt, days);
      events.push({
        ftKey: `unpaid-long-${j.id}-${remindStr}`,
        summary: `🟠 ${c?.name || '?'} 完成 ${days} 天未收款 · ${j.title}`,
        // v3.22.5：顯示待收金額（折扣後 - 已收 - 呆帳）
        description: `業主：${c?.name || '?'}\n案件：${j.title}\n待收：NT$ ${jobUnpaidAmount(j).toLocaleString('en-US')}\n完成日：${j.doneAt}\n\n今天已過 ${days} 天還沒收款，可考慮發提醒。`,
        // v3.24.11：改成時間事件 → reminders minutes:0 準時響
        start: { dateTime: `${remindStr}T${reminderTime}:00`, timeZone: CALENDAR_TIMEZONE },
        end:   { dateTime: `${remindStr}T${reminderEndTime}:00`, timeZone: CALENDAR_TIMEZONE },
        colorId: '6',  // Tangerine
      });
    });
  }

  // 3. 月底提醒（未來 12 個月）
  if (cfg.syncTypes.monthEnd) {
    const startDay = config.monthEndReminderDay || 25;
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const dt = new Date(now.getFullYear(), now.getMonth() + i, startDay);
      // 處理 2 月 31 號之類
      if (dt.getMonth() !== ((now.getMonth() + i) % 12 + 12) % 12) continue;
      const dateStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
      if (dateStr < today) continue;
      events.push({
        ftKey: `month-end-${dateStr.slice(0, 7)}`,
        summary: '📅 月底提醒：可開始整理請款',
        description: `每月 ${startDay} 號之後可開始整理本月可請款案件。\n\n到 App 的「請款單」分頁勾選要請款的案件。`,
        // v3.24.11：改成時間事件
        start: { dateTime: `${dateStr}T${reminderTime}:00`, timeZone: CALENDAR_TIMEZONE },
        end:   { dateTime: `${dateStr}T${reminderEndTime}:00`, timeZone: CALENDAR_TIMEZONE },
        colorId: '5',  // Banana
      });
    }
  }

  // 4. 業主固定請款日提醒（未來 12 個月）
  if (cfg.syncTypes.billingDay) {
    const now = new Date();
    state.clients.forEach(c => {
      if (!c.billingDay || c.billingDay < 1 || c.billingDay > 31) return;
      const remindDays = +c.billingRemindDays || 3;
      for (let i = 0; i < 12; i++) {
        const billingDate = new Date(now.getFullYear(), now.getMonth() + i, c.billingDay);
        if (billingDate.getMonth() !== ((now.getMonth() + i) % 12 + 12) % 12) continue;
        const billingStr = `${billingDate.getFullYear()}-${String(billingDate.getMonth()+1).padStart(2,'0')}-${String(billingDate.getDate()).padStart(2,'0')}`;
        const remindStr = _calendarAddDays(billingStr, -remindDays);
        if (remindStr < today) continue;
        events.push({
          ftKey: `billing-${c.id}-${billingStr.slice(0, 7)}`,
          summary: `📋 ${c.name} 月 ${c.billingDay} 日請款（提前 ${remindDays} 天）`,
          description: `業主：${c.name}\n固定請款日：每月 ${c.billingDay} 號\n\n請於 ${billingStr} 前送出請款單。`,
          // v3.24.11：改成時間事件
          start: { dateTime: `${remindStr}T${reminderTime}:00`, timeZone: CALENDAR_TIMEZONE },
          end:   { dateTime: `${remindStr}T${reminderEndTime}:00`, timeZone: CALENDAR_TIMEZONE },
          colorId: '1',  // Lavender
        });
      }
    });
  }

  // 5. 拖款警告（只建今天命中的，每次同步重算）
  if (cfg.syncTypes.slowPay) {
    const slowJobs = (typeof computeSlowPayJobs === 'function') ? computeSlowPayJobs(state.jobs.filter(j => !j.cancelled)) : [];
    slowJobs.forEach(j => {
      const c = clientById[j.clientId];
      events.push({
        ftKey: `slow-pay-${j.id}-${today}`,
        summary: `🐢 拖款警告：${c?.name || '?'} · ${j.title}`,
        // v3.22.5：顯示待收金額
        description: `業主：${c?.name || '?'} 平均收款 ${j.avgDays} 天\n案件：${j.title}\n待收：NT$ ${jobUnpaidAmount(j).toLocaleString('en-US')}\n完成日：${j.doneAt}\n\n已過 ${j.daysSince} 天（超過該業主平均），建議主動聯繫。`,
        // v3.24.11：改成時間事件
        start: { dateTime: `${today}T${reminderTime}:00`, timeZone: CALENDAR_TIMEZONE },
        end:   { dateTime: `${today}T${reminderEndTime}:00`, timeZone: CALENDAR_TIMEZONE },
        colorId: '11',  // Tomato
      });
    });
  }

  // 6. 每日早報（未來 60 天，每天若有事就建一筆）
  if (cfg.syncTypes.dailyMorning && cfg.dailyMorningTime) {
    const startTime = cfg.dailyMorningTime;
    const endTime = _calendarAddMinutes(startTime, 15);
    for (let dayOffset = 0; dayOffset < 60; dayOffset++) {
      const d = new Date();
      d.setDate(d.getDate() + dayOffset);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

      const items = _calendarCollectDayItems(dateStr, cfg);
      if (items.length === 0) continue;

      // 標題：取第一筆作為示意 + 件數
      const firstShort = items[0].line.replace(/^[^\s]+\s/, '').split('（')[0].split('·')[0].trim();
      const summary = `📋 [外包] 今日 ${items.length} 件事${items.length > 1 ? ` · ${firstShort}+${items.length - 1}` : ` · ${firstShort}`}`;

      // 描述：分組列出
      const lines = [`今天 (${dateStr}) 涉及的事項：`, ''];
      const groups = {};
      items.forEach(it => {
        groups[it.group] = groups[it.group] || [];
        groups[it.group].push(it.line);
      });
      Object.keys(groups).forEach(g => {
        lines.push(g);
        groups[g].forEach(l => lines.push('  ' + l));
        lines.push('');
      });
      lines.push('在 App 中查看詳情：');
      lines.push('https://lancelotwang114.github.io/freelance-tracker-cloud/');

      events.push({
        ftKey: `daily-${dateStr}`,
        summary,
        description: lines.join('\n'),
        start: { dateTime: `${dateStr}T${startTime}:00`, timeZone: CALENDAR_TIMEZONE },
        end:   { dateTime: `${dateStr}T${endTime}:00`,   timeZone: CALENDAR_TIMEZONE },
        colorId: '7',  // Peacock
      });
    }
  }

  return events;
}

// 把 target event 物件轉成 Calendar API 需要的 event resource（補上 ftSource 標記）
// v3.24.11：強制帶 reminders.overrides，讓 iOS 行事曆（CalDAV 同步）能收到 alarm
//           - 時間事件：minutes: 0 → 準時通知
//           - 全天事件（只有「案件本身」）：useDefault: false + 空 overrides → 不單獨提醒，靠每日早報帶
function _calendarBuildEventResource(target) {
  const isAllDay = !!(target.start && target.start.date);
  return {
    summary: target.summary,
    description: target.description,
    start: target.start,
    end: target.end,
    colorId: target.colorId,
    reminders: {
      useDefault: false,
      overrides: isAllDay
        ? []                                       // 全天事件不單獨提醒（案件本身保留視覺，靠早報帶）
        : [{ method: 'popup', minutes: 0 }]        // 時間事件：準時通知
    },
    extendedProperties: {
      private: {
        ftSource: FT_CALENDAR_SOURCE,
        ftKey: target.ftKey
      }
    }
  };
}

// 比對既有事件跟目標事件，回傳是否需要更新
function _calendarEventDiffers(existing, target) {
  if ((existing.summary || '') !== target.summary) return true;
  if ((existing.description || '') !== target.description) return true;
  if ((existing.colorId || '') !== (target.colorId || '')) return true;
  // start：v3.24.11 後可能從 date 改成 dateTime（或反之），任一邊不一致就要更新
  if ((target.start.date || null) !== (existing.start?.date || null)) return true;
  if ((target.start.dateTime || null) !== (existing.start?.dateTime || null)) return true;
  // end
  if ((target.end.date || null) !== (existing.end?.date || null)) return true;
  if ((target.end.dateTime || null) !== (existing.end?.dateTime || null)) return true;
  // v3.24.11：reminders 也要比，否則舊事件（沒帶 reminders）不會被升級成有 overrides 的版本
  const exMins = (existing.reminders?.overrides || []).map(o => `${o.method}:${o.minutes}`).sort().join(',');
  const tgMins = (target.reminders?.overrides || []).map(o => `${o.method}:${o.minutes}`).sort().join(',');
  if (exMins !== tgMins) return true;
  // useDefault：舊事件 undefined（吃預設） vs 新事件 false → 視為不同
  const exDefault = existing.reminders?.useDefault;
  const tgDefault = target.reminders?.useDefault;
  if ((exDefault === undefined ? true : !!exDefault) !== !!tgDefault) return true;
  return false;
}

// ---------- 主同步引擎 ----------

let cloudCalendarSyncInProgress = false;

async function cloudSyncCalendar() {
  if (cloudCalendarSyncInProgress) { toast('同步已在進行中…'); return; }
  if (!isCloudSignedIn()) { alert('請先登入 Google'); return; }

  const cfg = cloudGetCalendarConfig();
  if (!cfg.calendarId) { alert('請先選擇要同步的日曆'); return; }

  cloudCalendarSyncInProgress = true;
  try {
    toastProgress('📅 讀取 Calendar 現有事件…', 30000);
    const existing = await calendarListEvents(cfg.calendarId, `privateExtendedProperty=${encodeURIComponent('ftSource=' + FT_CALENDAR_SOURCE)}`);

    toastProgress('🔍 比對差異中…', 30000);
    const existingMap = new Map();
    for (const ev of existing) {
      const key = ev.extendedProperties && ev.extendedProperties.private && ev.extendedProperties.private.ftKey;
      if (key) existingMap.set(key, ev);
    }

    const target = buildTargetCalendarEvents(cfg);
    const targetKeys = new Set(target.map(t => t.ftKey));

    const toCreate = [];
    const toUpdate = [];
    const toDelete = [];
    for (const t of target) {
      const ex = existingMap.get(t.ftKey);
      if (!ex) toCreate.push(t);
      else if (_calendarEventDiffers(ex, t)) toUpdate.push({ ex, t });
    }
    for (const [key, ev] of existingMap) {
      if (!targetKeys.has(key)) toDelete.push(ev);
    }

    let added = 0, updated = 0, deleted = 0;

    if (toCreate.length > 0) {
      toastProgress(`📝 建立 ${toCreate.length} 個新事件…`, 60000);
      for (const t of toCreate) {
        try {
          await calendarCreateEvent(cfg.calendarId, _calendarBuildEventResource(t));
          added++;
        } catch (e) { console.warn('[calendar] create failed:', t.ftKey, e); }
      }
    }
    if (toUpdate.length > 0) {
      toastProgress(`🔧 更新 ${toUpdate.length} 個變動事件…`, 60000);
      for (const { ex, t } of toUpdate) {
        try {
          await calendarUpdateEvent(cfg.calendarId, ex.id, _calendarBuildEventResource(t));
          updated++;
        } catch (e) { console.warn('[calendar] update failed:', t.ftKey, e); }
      }
    }
    if (toDelete.length > 0) {
      toastProgress(`🗑️ 清除 ${toDelete.length} 個過期事件…`, 60000);
      for (const ev of toDelete) {
        try {
          await calendarDeleteEvent(cfg.calendarId, ev.id);
          deleted++;
        } catch (e) { console.warn('[calendar] delete failed:', ev.id, e); }
      }
    }

    const result = { added, updated, deleted };
    cloudSaveCalendarConfig({ lastSyncedAt: new Date().toISOString(), lastSyncResult: result });
    toastDismiss();
    toast(`✓ Calendar 同步完成（新增 ${added} / 更新 ${updated} / 刪除 ${deleted}）`, 4000);
    if (typeof logAction === 'function') {
      logAction('calendar-sync', result);
    }
    cloudRenderCalendarStatus();
  } catch (e) {
    toastDismiss();
    console.error('[calendar] sync failed:', e);
    if (e instanceof DriveAuthError) {
      alert('Calendar 同步失敗：請重新登入 Google\n\n' + e.message);
    } else {
      alert('Calendar 同步失敗：' + e.message);
    }
    if (typeof logAction === 'function') {
      logAction('calendar-sync-error', { error: e.message || String(e) });
    }
  } finally {
    cloudCalendarSyncInProgress = false;
  }
}

// ---------- 自動同步（auto sync）----------

let cloudCalendarAutoSyncTimer = null;

function cloudScheduleCalendarSync() {
  const cfg = cloudGetCalendarConfig();
  // v3.7.0：master toggle 關 / 沒選日曆都不 auto sync（autoSync 欄位已廢除，啟用就自動）
  if (!cfg.enabled || !cfg.calendarId) return;
  if (cloudCalendarAutoSyncTimer) clearTimeout(cloudCalendarAutoSyncTimer);
  // 比 Drive 同步晚一點觸發（debounce 30 秒，避免每改一筆案件就同步一次）
  cloudCalendarAutoSyncTimer = setTimeout(() => {
    cloudCalendarAutoSyncTimer = null;
    cloudSyncCalendar().catch(e => console.error('[calendar-auto] failed:', e));
  }, 30000);
}

// ---------- Calendar UI handlers（v3.1.0）----------

// 卡片展開時觸發：載入既存配置 + 列出 calendars + 渲染狀態
// v3.24.20：根據登入狀態切換行事曆 master toggle 是否可勾 + 「未登入」提示
//           登入後 → checkbox 解鎖、提示 hide
//           未登入 → checkbox disabled、提示顯示
function cloudUpdateCalSigninGate() {
  const cb = document.getElementById('cloud-cal-enabled');
  const hint = document.getElementById('cloud-cal-need-signin');
  const signedIn = (typeof isCloudSignedIn === 'function') && isCloudSignedIn();
  if (cb) {
    cb.disabled = !signedIn;
    if (!signedIn) cb.checked = false;  // 未登入時強制反勾，避免 cfg 被殘留 enabled=true 誤導 UI
  }
  if (hint) hint.classList.toggle('hidden', signedIn);
}

function cloudRenderCalendarUI() {
  // v3.24.20：先同步 signin gate 狀態
  cloudUpdateCalSigninGate();
  if (!isCloudSignedIn()) {
    const status = document.getElementById('cloud-cal-status');
    if (status) status.textContent = '請先登入';
    return;
  }
  const cfg = cloudGetCalendarConfig();

  // v3.7.0：還原 master toggle 狀態 + 切顯示
  const masterCb = document.getElementById('cloud-cal-enabled');
  if (masterCb) masterCb.checked = !!cfg.enabled;
  cloudUpdateCalendarSectionVisibility(!!cfg.enabled);

  // 還原早報時段
  const tEl = document.getElementById('cloud-cal-morning-time');
  if (tEl) tEl.value = cfg.dailyMorningTime || '09:30';

  // v3.8.0：syncTypes 已搬到「通知與提醒」卡的 Calendar channel 欄；也順手刷一下 reminder UI
  if (typeof loadReminderConfigUI === 'function') loadReminderConfigUI();

  // 載入 calendar list（idempotent，已載入就直接顯示）
  cloudRefreshCalendarList();
  cloudRenderCalendarStatus();
}

async function cloudRefreshCalendarList() {
  const sel = document.getElementById('cloud-cal-picker');
  if (!sel) return;
  if (!isCloudSignedIn()) {
    sel.innerHTML = '<option value="">— 請先登入 —</option>';
    return;
  }
  sel.innerHTML = '<option value="">載入中…</option>';
  try {
    const list = await calendarListCalendars();
    const cfg = cloudGetCalendarConfig();
    if (list.length === 0) {
      sel.innerHTML = '<option value="">（沒有任何日曆）</option>';
      return;
    }
    // 排序：primary 第一、其他依名稱
    list.sort((a, b) => {
      if (a.primary && !b.primary) return -1;
      if (!a.primary && b.primary) return 1;
      return (a.summary || '').localeCompare(b.summary || '', 'zh-Hant');
    });
    sel.innerHTML = '<option value="">— 請選擇 —</option>' + list.map(c => {
      const label = c.primary ? `${c.summary}（主要）` : c.summary;
      const selected = (c.id === cfg.calendarId) ? ' selected' : '';
      return `<option value="${cloudEscapeHtml(c.id)}" data-name="${cloudEscapeHtml(c.summary)}"${selected}>${cloudEscapeHtml(label)}</option>`;
    }).join('');
    // 沒選過、列表中又有「外包」→ 給個提示但不自動選
    if (!cfg.calendarId) {
      const hasFreelance = list.find(c => c.summary && c.summary.includes('外包'));
      if (hasFreelance) {
        toast('💡 偵測到名稱含「外包」的日曆，建議選它', 4000);
      }
    }
  } catch (e) {
    console.error('[calendar] list calendars failed:', e);
    sel.innerHTML = '<option value="">（載入失敗，請刷新）</option>';
    // 偵測「Calendar API 未啟用」錯誤 → 給更清楚的引導
    const msg = e.message || '';
    if (msg.includes('Calendar API has not been used') || msg.includes('not been used in project')) {
      const link = msg.match(/https:\/\/console\.developers\.google\.com[^\s]+/);
      const linkUrl = link ? link[0] : 'https://console.developers.google.com/apis/api/calendar-json.googleapis.com/overview';
      alert(
        '⚠️ Google Calendar API 尚未在 GCP 專案啟用\n\n' +
        '解法（30 秒）：\n' +
        '1. 點下方連結（會帶到 GCP Console）\n' +
        '2. 按右上角「啟用 (Enable)」\n' +
        '3. 等 1~2 分鐘 propagate\n' +
        '4. 回來按「🔄 重新整理」\n\n' +
        linkUrl
      );
    } else if (msg.includes('access token') || e instanceof DriveAuthError) {
      alert('登入 token 缺少 Calendar 權限\n\n請登出 → 重新登入（彈窗會多列出 Calendar 權限請求，要勾「允許」）');
    } else {
      toast('載入日曆清單失敗：' + msg);
    }
  }
}

function cloudOnCalendarPicked() {
  const sel = document.getElementById('cloud-cal-picker');
  if (!sel) return;
  const id = sel.value;
  const opt = sel.selectedOptions[0];
  const name = opt && opt.dataset.name ? opt.dataset.name : '';
  cloudSaveCalendarConfig({ calendarId: id, calendarName: name });
  cloudRenderCalendarStatus();
  if (id) toast(`✓ 已選擇日曆：${name}`, 2500);
}

function cloudOnCalendarConfigChange() {
  // v3.8.0：syncTypes 已搬到 reminder card；這裡只處理早報時段
  const tEl = document.getElementById('cloud-cal-morning-time');
  cloudSaveCalendarConfig({
    dailyMorningTime: (tEl && tEl.value) || '09:30'
  });
}

// v3.7.0：master toggle 切換（啟用 / 停用 Calendar 同步）
function cloudOnCalendarEnabledToggle() {
  const cb = document.getElementById('cloud-cal-enabled');
  if (!cb) return;
  // v3.24.20：未登入時擋啟用（即使 disabled 沒生效也擋）
  if (cb.checked && !isCloudSignedIn()) {
    cb.checked = false;
    toast('⚠️ 請先到上方「☁️ 雲端同步」登入 Google', 4000);
    return;
  }
  const enabled = !!cb.checked;
  cloudSaveCalendarConfig({ enabled });
  cloudUpdateCalendarSectionVisibility(enabled);
  cloudRenderCalendarStatus();
  if (enabled) {
    toast('✓ 已啟用 Google 行事曆同步，記得選擇要同步的日曆', 4000);
  } else {
    toast('已停用 Google 行事曆同步（既有事件保留在你的日曆裡，要清的話請手動到 Google 行事曆刪）', 5000);
  }
  if (typeof logAction === 'function') logAction('cloud-calendar-' + (enabled ? 'enable' : 'disable'));
}

// v3.7.0：依 enabled 狀態 toggle 行事曆設定區的可見度
// v3.8.0：同步刷新 reminder card 的 Calendar 欄提示文字
// v3.8.1：master OFF 時把 reminder 卡 Google 行事曆欄的 checkbox 全 disable（保留勾選狀態，啟用後就回來）
function cloudUpdateCalendarSectionVisibility(enabled) {
  const body = document.getElementById('cloud-cal-settings-body');
  if (body) body.classList.toggle('hidden', !enabled);
  const masterStatus = document.getElementById('cloud-cal-master-status');
  if (masterStatus) masterStatus.textContent = enabled ? '已啟用' : '未啟用';
  // v3.24.17 dead refs：下面這些 element 在 v3.24.16 隨「🔔 通知與提醒」card 一起刪了，
  // if (el) 防護住不 crash，保留以備未來恢復矩陣 UI；要清乾淨可整段刪除。
  const calHint = document.getElementById('alert-cal-disabled-hint');
  if (calHint) calHint.classList.toggle('hidden', enabled);
  document.querySelectorAll('.alert-matrix input[id$="-calendar"]').forEach(cb => {
    cb.disabled = !enabled;
  });
  const matrix = document.querySelector('.alert-matrix');
  if (matrix) matrix.classList.toggle('cal-disabled', !enabled);
}

function cloudRenderCalendarStatus() {
  const cfg = cloudGetCalendarConfig();
  const status = document.getElementById('cloud-cal-status');
  const detail = document.getElementById('cloud-cal-sync-status');
  const btn = document.getElementById('cloud-cal-sync-btn');

  if (!cfg.calendarId) {
    if (status) { status.textContent = '未選擇日曆'; status.style.color = 'var(--muted)'; }
    if (detail) detail.innerHTML = '請先在上方選擇要同步的日曆。';
    if (btn) btn.disabled = true;
    return;
  }
  if (status) {
    status.textContent = `✓ ${cfg.calendarName || '已選日曆'}`;
    status.style.color = 'var(--success)';
  }
  if (btn) btn.disabled = false;
  if (detail) {
    if (cfg.lastSyncedAt) {
      const dt = new Date(cfg.lastSyncedAt);
      const dtStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
      const r = cfg.lastSyncResult || {};
      detail.innerHTML = `上次同步：${dtStr}　結果：新增 ${r.added || 0} / 更新 ${r.updated || 0} / 刪除 ${r.deleted || 0}`;
    } else {
      detail.innerHTML = '尚未同步過。按右下「🔄 立即同步」開始第一次同步。';
    }
  }
}

// ---------- 立即同步（α2-6）----------
// 使用者主動觸發：拉雲端最新版 → 走三方合併 → 推回 Drive（如果有改動）
// UI：🔐 Google Drive 同步 卡片內「🔄 立即同步」按鈕

// v3.24.23：加併發保護（避免 visibilitychange + heartbeat + silent refresh recover 三方撞車）
//           silent 參數：auto pull 觸發時不跳 alert（race condition 防護）
let cloudPullInProgress = false;
async function cloudPullNow(silent) {
  if (cloudPullInProgress) {
    console.log('[cloud-pull] already in progress, skip');
    return;
  }
  if (!isCloudSignedIn()) {
    if (!silent) alert('請先登入 Google 帳號');
    return;
  }
  const meta = cloudGetMeta();
  if (!meta.trackerFileId) {
    // 還沒 init 完成 → 改跑 init 流程（idempotent，內部也有併發保護）
    await cloudInitTrackerFile();
    return;
  }

  cloudPullInProgress = true;
  cloudSetSyncStatus('syncing');
  try {
    const remoteText = await driveDownloadFile(meta.trackerFileId);
    const result = unwrapTracker(remoteText);
    if (!result.ok) {
      if (!silent) alert('Drive 上的 tracker.json 解析失敗：' + result.error);
      cloudSetSyncStatus('error', result.error);
      return;
    }

    if (typeof logAction === 'function') {
      logAction('cloud-pull', { fileId: meta.trackerFileId, version: result.meta.version });
    }

    // 走三方合併
    if (cloudGetLastSyncedSnapshot()) {
      await cloudResolveAndMerge({
        remoteData: result.data,
        remoteMeta: result.meta,
        fileId: meta.trackerFileId,
        trackerCreatedAt: result.meta.createdAt
      });
      cloudSetSyncStatus('idle');
    } else {
      // 沒 base 但有 fileId（不太可能發生的狀態）→ 直接 apply 視為「重新初始化 base」
      applyTrackerData(result.data);
      cloudSaveLastSyncedSnapshot(result.data);
      cloudSaveMeta({
        lastSyncedAt: result.meta.lastModifiedAt,
        lastSyncedVersion: result.meta.version
      });
      cloudSetSyncStatus('idle');
    }
    // v3.24.23：手動 / 自動同步都更新節流時間戳，避免 5 分鐘內又被 visibilitychange 觸發
    _lastAutoPullAt = Date.now();
  } catch (e) {
    console.error('[cloud-pull] failed:', e);
    if (typeof logAction === 'function') {
      logAction('cloud-pull-error', { error: e.message || String(e) });
    }
    cloudSetSyncStatus('error', e.message || String(e));
    if (!silent) {
      if (e instanceof DriveAuthError) {
        alert('Drive 連線失敗，請重新登入：' + e.message);
      } else {
        alert('從 Drive 拉取失敗：' + e.message);
      }
    }
  } finally {
    // v3.24.23：finally 確保旗標一定歸零
    cloudPullInProgress = false;
  }
}

// 版本比較（v2.10.1）
// 修正 v2.9.7 vs v2.10.0 的字串比較 bug（'1' < '9' 字元碼，導致大版號被判舊）
// 格式：YYYY-MM-DD-vX.Y.Z → 拆成數字陣列逐位比
// 回傳：-1=a 較舊、0=相同、1=a 較新
function compareAppVersion(a, b) {
  if (!a || !b) return 0;
  const parse = (s) => {
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})-v(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
    if (!m) return null;
    return [+m[1], +m[2], +m[3], +m[4], +(m[5] || 0), +(m[6] || 0)];
  };
  const va = parse(a), vb = parse(b);
  if (!va || !vb) {
    // 格式對不上 → 退回字串比較
    return a < b ? -1 : a > b ? 1 : 0;
  }
  for (let i = 0; i < va.length; i++) {
    if (va[i] !== vb[i]) return va[i] < vb[i] ? -1 : 1;
  }
  return 0;
}

// ============== 操作日誌（v2.9.5）==============
const ACTION_LOG_KEY = 'cloud-ftActionLog_v1';  // v3.0.0-alpha.1：cloud- 前綴隔離 v2
const ACTION_LOG_MAX = 500;
let actionLog = [];

function loadActionLog() {
  try { actionLog = JSON.parse(localStorage.getItem(ACTION_LOG_KEY) || '[]'); }
  catch (_) { actionLog = []; }
}

function saveActionLog() {
  if (actionLog.length > ACTION_LOG_MAX) actionLog = actionLog.slice(-ACTION_LOG_MAX);
  try { localStorage.setItem(ACTION_LOG_KEY, JSON.stringify(actionLog)); } catch (_) {}
}

function logAction(type, details) {
  actionLog.push({
    ts: Date.now(),
    type: type,
    details: details || {}
  });
  saveActionLog();
}

const ACTION_LABELS = {
  'job-create':       { icon: '🆕',   label: '新增案件' },
  'job-edit':         { icon: '✏️',   label: '編輯案件' },
  'job-delete':       { icon: '🗑️',   label: '刪除案件' },
  'job-done':         { icon: '✓',    label: '標完成' },
  'job-undo-done':    { icon: '↩',    label: '取消完成' },
  'job-paid':         { icon: '💰',   label: '標收款' },
  'job-undo-paid':    { icon: '↩',    label: '取消收款' },
  'client-create':    { icon: '🆕',   label: '新增業主' },
  'client-edit':      { icon: '✏️',   label: '編輯業主' },
  'client-delete':    { icon: '🗑️',   label: '刪除業主' },
  'bulk-done':        { icon: '✓',    label: '批次標完成' },
  'bulk-paid':        { icon: '💰',   label: '批次標收款' },
  'bulk-cancel':      { icon: '🚫',   label: '批次取消' },
  'bulk-discount':    { icon: '🏷️',   label: '批次設折扣' },
  'data-import':      { icon: '📥',   label: '匯入資料' },
  'data-clear':       { icon: '⚠️',   label: '清空資料' },
  'data-load-demo':   { icon: '🎲',   label: '載入範例' },
  'snapshot-restore': { icon: '↩',    label: '還原 snapshot' },
  'sync-pull':        { icon: '⬇️',   label: '從雲端拉取' },
  'sync-push':        { icon: '⬆️',   label: '推送到雲端' },
  'invoice-copy':     { icon: '📋',   label: '複製請款單' },
  // v3.0.0-alpha.1 commit 7：Google Drive 登入埋點
  'cloud-signin':     { icon: '🔐',   label: '登入 Google Drive' },
  'cloud-signout':    { icon: '🔓',   label: '登出 Google Drive' },
  // v3.0.0-alpha.2：Drive 同步埋點
  'cloud-init-create': { icon: '🆕',  label: '在 Drive 建立 tracker.json' },
  'cloud-init-pull':   { icon: '⬇️',  label: '從 Drive 拉取 tracker.json' },
  'cloud-init-push':   { icon: '⬆️',  label: '推送本機資料到 Drive' },
  'cloud-push':         { icon: '☁️',  label: '同步到 Drive' },
  'cloud-push-error':   { icon: '⚠️',  label: 'Drive 同步失敗' },
  'cloud-merge-clean':  { icon: '🔀',  label: '自動合併（無衝突）' },
  'cloud-merge-resolved': { icon: '🔧', label: '衝突已解決' },
  'cloud-pull':         { icon: '🔄',  label: '從 Drive 立即同步' },
  'cloud-pull-error':   { icon: '⚠️',  label: 'Drive 拉取失敗' },
  'cloud-snapshot-create':  { icon: '📦', label: '建立雲端 snapshot' },
  'cloud-snapshot-restore': { icon: '↩',  label: '還原雲端 snapshot' },
  'cloud-snapshot-delete':  { icon: '🗑️', label: '刪除雲端 snapshot' },
  'cloud-snapshot-prune':   { icon: '🧹', label: '清理過期 auto snapshot' },
  // v3.0.0-alpha.3：存摺照片獨立化埋點
  'cloud-image-upload':     { icon: '🖼️', label: '上傳存摺照片到 Drive' },
  'cloud-image-delete':     { icon: '🗑️', label: '刪除 Drive 存摺照片' },
  'cloud-image-migrate':    { icon: '📦', label: '存摺照片遷移到 Drive' },
  // v3.1.0：Calendar 同步
  'calendar-sync':          { icon: '📅', label: '同步到 Google Calendar' },
  'calendar-sync-error':    { icon: '⚠️', label: 'Calendar 同步失敗' }
};
const COLORS = ['#ef4444','#f59e0b','#10b981','#2563eb','#8b5cf6','#ec4899','#14b8a6','#64748b'];

let state = {
  clients: [],
  jobs: [],
  // v3.12.0：請款單歷史（每次匯出留一筆 snapshot）
  invoiceHistory: [],
  filters: { clientId: 'all', month: 'current', status: 'all', tag: 'all', expandedYear: null, jobIdsOnly: null, jobIdsOnlyLabel: '' }
};

let config = {
  // 全域提醒參數（v2.7.9 起每個都個別可調，業主層級可覆寫 unpaidRemindDays）
  unpaidRemindDays: 7,           // 完成超過幾天未收款就提醒（全域預設）
  dueSoonDays: 3,                // 「即將到期」前幾天就提醒
  monthEndReminderDay: 25,       // 從每月第幾天開始顯示「月底提醒」
  enableOverdueAlert: true,      // 是否啟用「逾期未完成」提醒
  enableDueSoonAlert: true,      // 是否啟用「即將到期」提醒
  enableUnpaidLongAlert: true,   // 是否啟用「完成超過 N 天未收款」提醒
  enableMonthEndAlert: true,     // 是否啟用「月底提醒」
  enableBillingDayAlert: true,   // 是否啟用「業主固定請款日」提醒
  enableSlowPayAlert: true,      // 是否啟用「智慧拖款警告」

  // 我的收款資訊（顯示在請款單）
  // v2.10.13: bank / account 從單筆改成 paymentAccounts 陣列；舊欄位保留作為 fallback
  userInfo: {
    name: '',
    phone: '',
    email: '',
    invoiceTitle: '',
    bank: '',                          // 舊欄位（migration 後不再使用，但保留向下相容）
    account: '',                       // 舊欄位（同上）
    note: '',
    paymentAccounts: [],               // [{id, label, bank, account, note}]
    selectedPaymentAccountId: ''       // 預設使用哪一筆（請款單帶入）
  },

  // Google Sheet 雙向同步
  sheetConfig: {
    sheetUrl: '',
    apiUrl: '',
    apiToken: '',
    lastSyncAt: null,
    lastPullAt: null,
    cloudVersion: 0,        // 雲端版本（每次 pull/push 後更新）
    cloudLastModifiedAt: null  // 雲端最後修改時間
  },
  sheetSyncEnabled: false,
  sheetPendingPush: false,  // 有待同步但離線時為 true
  cloudFirstMode: false,    // 雲端優先：啟動必須 pull 成功，操作前必檢查
  autoPollEnabled: true,    // 自動偵測雲端（預設啟用）
  autoPollInterval: 30,     // 固定 30 秒（不對外開放設定）

  // 請款單篩選狀態（v2.10.4）
  invStatusMode: 'pending',                                       // pending/reconcile/progress/all/custom
  invCustomStatuses: ['done-unpaid', 'partial'],                  // mode='custom' 時生效

  // Google Calendar 同步
  calEnabled: false,
  calId: '',
  calAutoSync: false,
  calLastSyncAt: null,
  calLastSyncCount: 0,
  // 提醒模式（v2.10.0）：
  //   'follow' = 跟隨 dueSoonDays（預設）
  //   字串數字 = 該分鐘數的提前量；'0' = 不提醒
  calReminderMode: 'follow',

  // 備份追蹤
  lastExportAt: null,
  lastModifiedAt: null,    // 最後一次資料變動時間，用於匯入差異比對
  backupRemindDays: 14,

  // v3.11.0：收益目標（月 / 年）
  goals: {
    monthly: 0,   // 月目標金額（NT$，0 = 未設定）
    yearly: 0     // 年目標金額（NT$，0 = 未設定）
  },

  // 初次使用引導
  onboardingDone: false
};

// 行事曆當前月份
let calCursor = new Date();
calCursor.setDate(1);

// 業主清單展開狀態（哪些業主展開）
let expandedClients = new Set();

// v3.9.0：業主分頁的 detail view 當前看哪一位（null = 列表模式）
let detailClientId = null;

// v3.13.0：案件分頁視圖模式
// v3.21.0 升級：comfort / compact / table / card / board，預設 table
const JOBS_VIEW_KEY = 'cloud-ftJobsView_v1';
let jobsView = (function () {
  try {
    const v = localStorage.getItem(JOBS_VIEW_KEY);
    if (!v) return 'table';  // v3.21.0：新使用者預設報表模式
    // 舊 'list' → 'comfort'
    if (v === 'list') return 'comfort';
    return v;
  } catch (_) { return 'table'; }
})();

// v3.18.0：列表分組模式（none / date / client / status / tag）
const JOBS_GROUP_KEY = 'cloud-ftJobsGroupBy_v1';
let jobsGroupBy = (function () {
  try { return localStorage.getItem(JOBS_GROUP_KEY) || 'none'; } catch (_) { return 'none'; }
})();

// 收益頁模式
let revenueState = {
  mode: 'month',        // 'month' | 'year'
  clientId: 'all',
  range: 12
};

// ============== Schema 版本化框架（v2.1+）==============
// 每升一版資料模型就 +1，並新增對應的 migration 函式
const CURRENT_SCHEMA_VERSION = 18;  // v3.24.7：恢復 case.taxApplied（per-case toggle，全部預設 false）

const SCHEMA_MIGRATIONS = {
  // v1 → v2：加入 paid/doneAt/paidAt 欄位
  1: function(state) {
    state.jobs = (state.jobs || []).map(j => ({
      ...j,
      paid: j.paid ?? false,
      doneAt: j.doneAt ?? (j.done ? (j.date || todayStr()) : null),
      paidAt: j.paidAt ?? (j.paid ? (j.date || todayStr()) : null)
    }));
  },
  // v2 → v3：加入 cancelled / endDate / tag / commission / prepaid
  2: function(state) {
    state.jobs = (state.jobs || []).map(j => ({
      ...j,
      cancelled: j.cancelled ?? false,
      endDate: j.endDate ?? null,
      tag: j.tag ?? ''
    }));
    state.clients = (state.clients || []).map(c => ({
      ...c,
      commissionRate: c.commissionRate ?? 0,
      commissionTo: c.commissionTo ?? '',
      prepaidMode: c.prepaidMode ?? false,
      prepayments: c.prepayments ?? []
    }));
  },
  // v3 → v4：工時 + 時薪欄位（v2.1 新增）
  3: function(state) {
    state.jobs = (state.jobs || []).map(j => ({
      ...j,
      hoursWorked: j.hoursWorked ?? null  // 選填
    }));
  },
  // v4 → v5：估價、子任務、累計工時（v2.6 新增）
  4: function(state) {
    state.jobs = (state.jobs || []).map(j => ({
      ...j,
      isEstimate: j.isEstimate ?? false,    // 草稿/估價單模式
      subtasks: j.subtasks ?? [],            // [{id, text, done}]
      timeSpentMs: j.timeSpentMs ?? 0        // 計時器累計毫秒
    }));
  },
  // v5 → v6：業主固定請款日 + 個別覆寫提醒天數（v2.7.9 新增）
  5: function(state) {
    state.clients = (state.clients || []).map(c => ({
      ...c,
      billingDay: c.billingDay ?? 0,                       // 0 = 不固定 / 1-31 = 該月第幾天
      billingRemindDays: c.billingRemindDays ?? 3,         // 提前幾天提醒
      unpaidRemindDaysOverride: c.unpaidRemindDaysOverride ?? null  // null = 走全域設定
    }));
  },
  // v6 → v7：折扣 + 多筆收款紀錄 + 呆帳（v2.8.0 新增）
  6: function(state) {
    state.jobs = (state.jobs || []).map(j => {
      const next = {
        ...j,
        discountType: j.discountType ?? 'none',   // 'none' | 'fixed' | 'percent'
        discountValue: j.discountValue ?? 0,       // 折扣金額或百分比（正數）
        payments: j.payments ?? [],                // [{id, date, amount, note}]
        writeOff: j.writeOff ?? 0                  // 呆帳金額（不再追討）
      };
      // 自動 migrate：既有 paid+paidAt → 自動產生一筆 payment
      if (next.paid && next.paidAt && !next.payments.length) {
        const finalAmt = +next.amount || 0;  // 此時還沒折扣，原價就是應收
        next.payments = [{
          id: uid(),
          date: next.paidAt,
          amount: finalAmt,
          note: '自動轉換（v2.8.0 升級）'
        }];
      }
      return next;
    });
  },
  // v7 → v8：存摺照片從 base64 dataURL 改成 Drive App Folder 個別檔（v3.0.0-alpha.3 新增）
  // 注意：paymentAccounts 在 config.userInfo 裡（不在 state），實際補欄位由 ensurePaymentAccounts 處理
  // 既有 base64 dataURL 不在 migration 階段上傳（runMigrations 是同步的、不能 await）；
  // 由 cloudMigrateBankbookImages() async helper 在登入後背景跑，每張圖逐一上傳到 Drive 換 fileId
  7: function(state) {
    // state-level 沒東西要動；這個 migration 純粹是版本標記
  },
  // v8 → v9：每筆 job 加 quantity 欄位（預設 1）（v3.2.0 新增）
  // 給請款單顯示「單價 × 數量」用；amount 維持是「總金額」、unitPrice 顯示時計算 = amount / quantity
  8: function(state) {
    state.jobs = (state.jobs || []).map(j => ({
      ...j,
      quantity: j.quantity != null ? j.quantity : 1
    }));
  },
  // v9 → v10：paymentAccount 合併個人資訊（v3.2.0 新增）
  // 每筆 paymentAccount 自帶完整身分（name/phone/email/invoiceTitle/taxId/address/invoiceNote/showPersonalInfo）
  // state-level 無事（paymentAccounts 在 config）；由 ensurePaymentAccounts 補欄位 + 從 top-level userInfo 一次性 backfill
  9: function(state) {
    // 純版本標記
  },
  // v10 → v11：業主加結構化通訊錄 contact (v3.9.0 新增)
  // 給業主 detail 頁的 CRM-lite 通訊錄欄位用
  10: function(state) {
    state.clients = (state.clients || []).map(c => ({
      ...c,
      contact: c.contact || {
        person: '',   // 聯絡人姓名（公司情境，跟 client.name 是公司名）
        phone: '',
        email: '',
        address: ''
      }
    }));
  },
  // v11 → v12：加請款單歷史 invoiceHistory (v3.12.0 新增)
  // 每次匯出 PDF / PNG / 複製 / 列印 都留一筆紀錄
  11: function(state) {
    if (!Array.isArray(state.invoiceHistory)) state.invoiceHistory = [];
  },
  // v12 → v13：業主 + 案件 加 tags[] (v3.14.0 新增)
  // 舊 case.tag 字串自動補進新 case.tags[]（保留 tag 字串相容老 caller）
  12: function(state) {
    state.clients = (state.clients || []).map(c => ({
      ...c,
      tags: Array.isArray(c.tags) ? c.tags : []
    }));
    state.jobs = (state.jobs || []).map(j => {
      let tags = Array.isArray(j.tags) ? j.tags : [];
      if (j.tag && !tags.includes(j.tag)) tags = [j.tag, ...tags];
      return { ...j, tags };
    });
  },
  // v13 → v14：派外包（v3.24.0 新增）
  // - job.outsourceTo / outsourceCost：派外包對象 + 給外包定額
  // 註：v3.24.0 原本還加了 client.requiresInvoice，v3.24.1 改成請款單級別 toggle 後廢棄該欄位
  13: function(state) {
    state.jobs = (state.jobs || []).map(j => ({
      ...j,
      outsourceTo: j.outsourceTo || '',
      outsourceCost: j.outsourceCost != null ? +j.outsourceCost : 0
    }));
  },
  // v14 → v15：扣稅改請款單級別（v3.24.1）
  // 把舊的 client.requiresInvoice 欄位清掉（不需要這屬性了）
  14: function(state) {
    state.clients = (state.clients || []).map(c => {
      if ('requiresInvoice' in c) {
        const { requiresInvoice, ...rest } = c;
        return rest;
      }
      return c;
    });
  },
  // v15 → v16：扣稅改 case 層級（v3.24.2）— 每筆案件自己決定 taxApplied
  // 預設 false（不扣），user 在案件編輯 modal 自行勾選
  15: function(state) {
    state.jobs = (state.jobs || []).map(j => ({
      ...j,
      taxApplied: !!j.taxApplied
    }));
  },
  // v16 → v17：移除 case.taxApplied（v3.24.6）— 算法改 C，全部請款都當含稅
  // 把 taxApplied 欄位刪除（cleanup orphan 欄位）
  16: function(state) {
    state.jobs = (state.jobs || []).map(j => {
      if ('taxApplied' in j) {
        const { taxApplied, ...rest } = j;
        return rest;
      }
      return j;
    });
  },
  // v17 → v18：恢復 case.taxApplied（v3.24.7）— per-case toggle，預設 false
  // ⚠️ v3.24.6 migration 已清掉舊資料，所以全部案件都從 false 開始
  // user 之前在 v3.24.5 勾過的 taxApplied 設定無法復原，要重新勾
  17: function(state) {
    state.jobs = (state.jobs || []).map(j => ({
      ...j,
      taxApplied: !!j.taxApplied  // 沒這欄位的補 false
    }));
  }
};

function runMigrations(state) {
  let v = state.schemaVersion || 1;
  let migratedCount = 0;
  while (v < CURRENT_SCHEMA_VERSION) {
    const fn = SCHEMA_MIGRATIONS[v];
    if (fn) {
      try { fn(state); migratedCount++; }
      catch (err) { console.error(`Migration v${v} 失敗:`, err); }
    }
    v++;
  }
  state.schemaVersion = CURRENT_SCHEMA_VERSION;
  if (migratedCount > 0) {
    console.log(`✓ Schema migrated to v${CURRENT_SCHEMA_VERSION} (ran ${migratedCount} migrations)`);
  }
  return state;
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { state = Object.assign(state, JSON.parse(raw)); } catch(e) {}
  }
  const cfgRaw = localStorage.getItem(CONFIG_KEY);
  if (cfgRaw) {
    try { config = Object.assign(config, JSON.parse(cfgRaw)); } catch(e) {}
  }
  // 強制：雲端優先 + 自動偵測永遠 ON
  config.cloudFirstMode = true;
  config.autoPollEnabled = true;

  // 跑 schema migrations
  runMigrations(state);

  // v2.10.13: 收款帳號從單筆轉多筆（idempotent，舊欄位有值就轉成「預設帳號」）
  ensurePaymentAccounts();

  // 早期版本一次性 migration（業主從備註模式轉儲值制 + 補入儲值紀錄）。
  // 所有裝置同步到雲端後此分支已不會觸發；僅保留結構，名稱與資料皆為 placeholder。
  state.clients.forEach(c => {
    if (c.name === '__LEGACY_PREPAID_MIGRATION__' && !c.prepaidMode && (c.note || '').includes('儲值')) {
      c.prepaidMode = true;
      c.prepayments = [
        { id: uid(), date: '0000-00-00', amount: 0, note: '' }
      ];
      c.note = '';
      state.jobs.forEach(j => {
        if (j.clientId === c.id && !j.paid) {
          j.paid = true;
          j.paidAt = j.paidAt || j.date;
        }
      });
    }
  });

  // 若網址帶 ?client=xxx，進入業主唯讀模式
  const params = new URLSearchParams(location.search);
  const cid = params.get('client');
  if (cid) enterClientMode(cid);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    clients: state.clients,
    jobs: state.jobs,
    invoiceHistory: state.invoiceHistory  // v3.12.0
  }));
  // 記錄最後變動時間（給匯入差異比對用）
  config.lastModifiedAt = new Date().toISOString();
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  // v3.24.15：每次 save() 累計待推筆數（push 成功時歸零）
  cloudPendingChangesCount++;
  // v3.0.0-beta.1：移除 v2 Apps Script schedulePush 觸發
  // v3 雲端同步：debounce 推到 Drive
  if (typeof cloudSchedulePush === 'function') {
    cloudSchedulePush();
  }
  // v3.1.0：若啟用 Calendar 自動同步 → 30 秒 debounce 推到 Calendar
  if (typeof cloudScheduleCalendarSync === 'function') {
    cloudScheduleCalendarSync();
  }
}

// v3.1.0-fix：統一的「config 寫 localStorage + 觸發雲端同步」入口
// 只動 config 的函式（saveUserInfo / saveConfig 等）都該走這個，避免漏推 Drive
function saveConfigOnly() {
  config.lastModifiedAt = new Date().toISOString();  // 給 mergeStates 比對用
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  if (typeof cloudSchedulePush === 'function') cloudSchedulePush();
  if (typeof cloudScheduleCalendarSync === 'function') cloudScheduleCalendarSync();
}

// v3.8.0：alertKey → config 欄位 mapping（desktop channel 寫 config.enable*Alert）
const ALERT_DESKTOP_FIELD = {
  overdue: 'enableOverdueAlert',
  dueSoon: 'enableDueSoonAlert',
  unpaidLong: 'enableUnpaidLongAlert',
  monthEnd: 'enableMonthEndAlert',
  billingDay: 'enableBillingDayAlert',
  slowPay: 'enableSlowPayAlert',
  backup: 'enableBackupAlert'
};

// v3.8.0：使用者切某個提醒類型的某 channel → 立即存
function onAlertChannelToggle(alertKey, channel) {
  const cb = document.getElementById(`alert-${alertKey}-${channel}`);
  if (!cb) return;
  if (channel === 'desktop') {
    const field = ALERT_DESKTOP_FIELD[alertKey];
    if (!field) return;
    config[field] = !!cb.checked;
    saveConfigOnly();
    render();
  } else if (channel === 'calendar') {
    const cur = (typeof cloudGetCalendarConfig === 'function') ? cloudGetCalendarConfig() : { syncTypes: {} };
    cloudSaveCalendarConfig({
      syncTypes: { ...(cur.syncTypes || {}), [alertKey]: !!cb.checked }
    });
    if (typeof cloudScheduleCalendarSync === 'function') cloudScheduleCalendarSync();
  }
}

// v3.8.0：使用者改某個提醒類型的天數參數 → 立即存
function onAlertNumberChange(configField, value) {
  const v = +value;
  if (Number.isNaN(v)) return;
  const limits = {
    dueSoonDays: [1, 30],
    unpaidRemindDays: [1, 120],
    monthEndReminderDay: [20, 31],
    backupRemindDays: [1, 90]
  };
  const [min, max] = limits[configField] || [1, 365];
  config[configField] = Math.max(min, Math.min(max, v));
  saveConfigOnly();
  render();
  if (typeof updateCalendarReminderHint === 'function') updateCalendarReminderHint();
}

// v3.8.0：saveConfig 改成 stub（所有 toggle 已改 immediate save）
function saveConfig() {
  saveConfigOnly();
  render();
  if (typeof updateCalendarReminderHint === 'function') updateCalendarReminderHint();
}

// 載入提醒設定 UI（v3.8.0：新 ID 結構 alert-{key}-{channel} + Calendar channel 從 syncTypes 讀）
function loadReminderConfigUI() {
  const g = (id) => document.getElementById(id);
  // 數字欄位
  if (g('alert-dueSoon-days')) g('alert-dueSoon-days').value = config.dueSoonDays || 3;
  if (g('alert-unpaidLong-days')) g('alert-unpaidLong-days').value = config.unpaidRemindDays || 7;
  if (g('alert-monthEnd-day')) g('alert-monthEnd-day').value = config.monthEndReminderDay || 25;
  if (g('alert-backup-days')) g('alert-backup-days').value = config.backupRemindDays || 14;
  // Desktop channel
  if (g('alert-overdue-desktop')) g('alert-overdue-desktop').checked = config.enableOverdueAlert !== false;
  if (g('alert-dueSoon-desktop')) g('alert-dueSoon-desktop').checked = config.enableDueSoonAlert !== false;
  if (g('alert-unpaidLong-desktop')) g('alert-unpaidLong-desktop').checked = config.enableUnpaidLongAlert !== false;
  if (g('alert-monthEnd-desktop')) g('alert-monthEnd-desktop').checked = config.enableMonthEndAlert !== false;
  if (g('alert-billingDay-desktop')) g('alert-billingDay-desktop').checked = config.enableBillingDayAlert !== false;
  if (g('alert-slowPay-desktop')) g('alert-slowPay-desktop').checked = config.enableSlowPayAlert !== false;
  if (g('alert-backup-desktop')) g('alert-backup-desktop').checked = config.enableBackupAlert !== false;
  // Calendar channel（讀 cloudCalendarConfig.syncTypes）
  const calCfg = (typeof cloudGetCalendarConfig === 'function') ? cloudGetCalendarConfig() : { syncTypes: {} };
  const t = calCfg.syncTypes || {};
  ['unpaidLong', 'monthEnd', 'billingDay', 'slowPay', 'jobs', 'dailyMorning'].forEach(k => {
    const el = g('alert-' + k + '-calendar');
    if (el) el.checked = t[k] !== false;
  });
  // 提示「Google 行事曆 欄需要先啟用 master toggle」+ disable 所有 calendar checkbox
  const hint = g('alert-cal-disabled-hint');
  if (hint) hint.classList.toggle('hidden', !!calCfg.enabled);
  document.querySelectorAll('.alert-matrix input[id$="-calendar"]').forEach(cb => {
    cb.disabled = !calCfg.enabled;
  });
  const matrix = document.querySelector('.alert-matrix');
  if (matrix) matrix.classList.toggle('cal-disabled', !calCfg.enabled);
}

// ============== Utilities ==============
function uid() { return Math.random().toString(36).slice(2, 10); }
function fmt(n) { return 'NT$' + (n || 0).toLocaleString(); }
function thisMonth() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); }
function getMonth(dateStr) { return dateStr ? dateStr.slice(0,7) : ''; }
function todayStr() { const d = new Date(); return d.toISOString().slice(0,10); }
function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate()+days); return d.toISOString().slice(0,10); }
function daysBetween(a, b) {
  const da = new Date(a), db = new Date(b);
  return Math.floor((db - da) / 86400000);
}

let toastTimer = null;
function toast(msg, durationMs) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), durationMs || 2500);
}
// 顯示一個「進行中」訊息（例如「同步中...」）
// v2.10.3：加上安全保險超時 — 即使沒有後續 toast()，也最多顯示 maxMs 毫秒就自動消失
//         避免函式結尾用 alert/confirm 而忘了關 toast 導致訊息卡住
function toastProgress(msg, maxMs) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  // 預設 15 秒上限（網路請求基本都比這短）
  toastTimer = setTimeout(() => t.classList.remove('show'), maxMs || 15000);
}

// v2.10.3：明確關閉目前的 toast（用於 alert/confirm 跳出前先把 progress 收掉）
function toastDismiss() {
  const t = document.getElementById('toast');
  if (t) t.classList.remove('show');
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
}

// ============== v3.16.0：Undo v2（multi-step stack + Redo + Ctrl+Z）==============
// 重大升級：snapshot 永久保留（直到 stack 滿 30 才裁掉最舊的），不再 8 秒過期
// Ctrl+Z 隨時可復原、Ctrl+Shift+Z redo
const UNDO_MAX = 30;
const UNDO_TOAST_MS = 4500;

let undoStack = [];   // 每個 entry: { snapshot: {clients, jobs}, label, timestamp }
let redoStack = [];

function _undoDeepClone(state) {
  return {
    clients: JSON.parse(JSON.stringify(state.clients || [])),
    jobs: JSON.parse(JSON.stringify(state.jobs || []))
  };
}

function pushUndoSnapshot(label) {
  // 把當前 state 整個 snapshot 起來（不含 invoiceHistory，避免拖慢）
  undoStack.push({
    snapshot: _undoDeepClone(state),
    label: label || '已執行動作',
    timestamp: Date.now()
  });
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  // 新動作清空 redo（避免「undo → 改別的東西 → redo 變奇怪狀態」）
  redoStack = [];
  showUndoToast(label);
  if (typeof logAction === 'function') {
    logAction('undo-snapshot', { label, depth: undoStack.length });
  }
}

function showUndoToast(label) {
  const t = document.getElementById('toast');
  if (!t) return;
  const depth = undoStack.length;
  t.innerHTML = `
    <span style="margin-right: 12px;">✓ ${escapeHtml(label)}</span>
    <button id="undo-toast-btn" onclick="performUndo()" style="background: rgba(255,255,255,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.4); padding: 4px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;">↶ 復原</button>
    <span style="margin-left: 8px; font-size: 11px; opacity: 0.7;">${depth}/${UNDO_MAX}</span>
  `;
  t.classList.add('show', 'toast--undo');
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
  toastTimer = setTimeout(() => {
    t.classList.remove('show', 'toast--undo');
    setTimeout(() => { if (!t.classList.contains('show')) t.innerHTML = ''; }, 250);
  }, UNDO_TOAST_MS);
}

function performUndo() {
  if (!undoStack.length) {
    toast('沒有可復原的動作');
    return;
  }
  // 把當前狀態存進 redoStack（讓使用者可以反悔 undo）
  redoStack.push({
    snapshot: _undoDeepClone(state),
    label: undoStack[undoStack.length - 1].label,
    timestamp: Date.now()
  });
  if (redoStack.length > UNDO_MAX) redoStack.shift();
  const entry = undoStack.pop();
  state.clients = entry.snapshot.clients;
  state.jobs = entry.snapshot.jobs;
  // 確保 detail view / modal 內看的案件如果被 undo 影響也重渲染
  save(); render();
  // 顯示確認 toast（不要用 undo toast 樣式，避免混淆）
  const t = document.getElementById('toast');
  if (t) { t.classList.remove('toast--undo'); t.innerHTML = ''; }
  const remaining = undoStack.length;
  toast(`↶ 已復原「${entry.label}」${remaining > 0 ? `（剩 ${remaining} 步）` : ''}`, 3000);
  if (typeof logAction === 'function') {
    logAction('undo', { label: entry.label, remaining });
  }
  // v3.23.3：mascot thinking
  if (typeof mascotSay === 'function') mascotSay('undo-action');
}

function performRedo() {
  if (!redoStack.length) {
    toast('沒有可重做的動作');
    return;
  }
  // 把當前狀態存回 undoStack
  undoStack.push({
    snapshot: _undoDeepClone(state),
    label: redoStack[redoStack.length - 1].label,
    timestamp: Date.now()
  });
  if (undoStack.length > UNDO_MAX) undoStack.shift();
  const entry = redoStack.pop();
  state.clients = entry.snapshot.clients;
  state.jobs = entry.snapshot.jobs;
  save(); render();
  const t = document.getElementById('toast');
  if (t) { t.classList.remove('toast--undo'); t.innerHTML = ''; }
  toast(`↷ 已重做「${entry.label}」`, 3000);
  if (typeof logAction === 'function') {
    logAction('redo', { label: entry.label });
  }
}

// v3.16.0：全域鍵盤監聽 — Ctrl+Z / Cmd+Z 復原，Ctrl+Shift+Z / Cmd+Shift+Z 重做
document.addEventListener('keydown', (e) => {
  // 跳過：input / textarea / select / contenteditable 內讓瀏覽器原生 undo 處理
  const tag = (e.target?.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if (e.target?.isContentEditable) return;
  // 跳過：modal 開時不攔截（避免衝突）
  const anyModalOpen = !!document.querySelector('.modal-bg.open');
  if (anyModalOpen) return;

  const isUndoCombo = (e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z');
  if (!isUndoCombo) return;
  e.preventDefault();
  if (e.shiftKey) performRedo();
  else performUndo();
});

// 為了兼容舊呼叫，clearUndo 留 noop
function clearUndo() { /* v3.16.0: stack 模式，不再單獨 clear */ }

// ============== v3.20.0：手機案件 row 滑動快速 action（純 native touch）==============
// 案件 row 左滑 → 出現「✓ 完成 / 🗑️ 刪除」紅色按鈕
// 案件 row 右滑 → 出現「$ 收款 / 📋 編輯」綠色按鈕
// 只在 touch 裝置啟用、桌面點擊不受影響
const SWIPE_THRESHOLD_PX = 60;   // 拉超過 60px 才算啟動 action
const SWIPE_LOCK_PX = 14;        // 水平移動 > 14px 才鎖定（避免誤觸發 vertical scroll）

let _swipeState = null;
function isTouchDevice() {
  return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

function onJobRowTouchStart(e, jobId) {
  if (!isTouchDevice()) return;
  if (e.touches.length !== 1) return;
  const t = e.touches[0];
  _swipeState = {
    jobId,
    rowEl: e.currentTarget,
    startX: t.clientX,
    startY: t.clientY,
    locked: null  // 'horizontal' / 'vertical'
  };
}

function onJobRowTouchMove(e) {
  if (!_swipeState) return;
  const t = e.touches[0];
  const dx = t.clientX - _swipeState.startX;
  const dy = t.clientY - _swipeState.startY;
  // 第一次判斷方向
  if (!_swipeState.locked) {
    if (Math.abs(dx) > SWIPE_LOCK_PX || Math.abs(dy) > SWIPE_LOCK_PX) {
      _swipeState.locked = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical';
    }
  }
  if (_swipeState.locked !== 'horizontal') return;
  // 拖曳 row（最多 ±100px）
  const tx = Math.max(-100, Math.min(100, dx));
  _swipeState.rowEl.style.transform = `translateX(${tx}px)`;
  // 顯示對應的背景 action 提示
  _swipeState.rowEl.classList.toggle('swipe-left', tx < -SWIPE_THRESHOLD_PX);
  _swipeState.rowEl.classList.toggle('swipe-right', tx > SWIPE_THRESHOLD_PX);
  // 防止頁面 scroll
  e.preventDefault();
}

function onJobRowTouchEnd(e) {
  if (!_swipeState) return;
  const rowEl = _swipeState.rowEl;
  const jobId = _swipeState.jobId;
  // 取最終位移
  const tx = parseFloat((rowEl.style.transform.match(/translateX\(([-0-9.]+)px\)/) || [0, 0])[1]) || 0;
  // 還原 row 視覺
  rowEl.style.transition = 'transform 0.2s ease';
  rowEl.style.transform = '';
  rowEl.classList.remove('swipe-left', 'swipe-right');
  setTimeout(() => { rowEl.style.transition = ''; }, 220);
  // 判斷觸發
  if (tx <= -SWIPE_THRESHOLD_PX) {
    // 左滑 → 預設「標完成」
    swipeActionMarkDone(jobId);
  } else if (tx >= SWIPE_THRESHOLD_PX) {
    // 右滑 → 預設「標收款」
    swipeActionMarkPaid(jobId);
  }
  _swipeState = null;
}

function onJobRowTouchCancel() {
  if (!_swipeState) return;
  _swipeState.rowEl.style.transform = '';
  _swipeState.rowEl.classList.remove('swipe-left', 'swipe-right');
  _swipeState = null;
}

function swipeActionMarkDone(jobId) {
  const j = state.jobs.find(x => x.id === jobId);
  if (!j) return;
  if (j.done) {
    toast('案件已標完成');
    return;
  }
  pushUndoSnapshot(`滑動標完成「${j.title || ''}」`);
  j.done = true;
  if (!j.doneAt) j.doneAt = todayStr();
  save(); render();
}

function swipeActionMarkPaid(jobId) {
  const j = state.jobs.find(x => x.id === jobId);
  if (!j) return;
  if (jobIsFullyPaid(j)) {
    toast('案件已收齊');
    return;
  }
  pushUndoSnapshot(`滑動標收款「${j.title || ''}」`);
  j.done = true;
  if (!j.doneAt) j.doneAt = todayStr();
  // 補一筆 payment 把餘額收齊
  const remain = Math.max(0, jobFinalAmount(j) - jobPaidTotal(j) - (+j.writeOff || 0));
  if (remain > 0) {
    j.payments = j.payments || [];
    j.payments.push({
      id: uid(),
      date: todayStr(),
      amount: remain,
      note: '滑動標收款'
    });
  }
  recomputePaidStatus(j);
  save(); render();
}

// ============== v3.17.0：Quick Add 工具列 ==============
function toggleFabMenu() {
  const wrap = document.getElementById('fab-wrap');
  const menu = document.getElementById('fab-menu');
  if (!wrap || !menu) return;
  const isOpen = wrap.classList.toggle('fab-open');
  menu.classList.toggle('hidden', !isOpen);
  if (isOpen) {
    // 點到外面 close
    setTimeout(() => document.addEventListener('click', _closeFabOnOutside, { once: true }), 50);
  }
}
function _closeFabOnOutside(e) {
  const wrap = document.getElementById('fab-wrap');
  if (wrap && !wrap.contains(e.target)) closeFabMenu();
}
function closeFabMenu() {
  const wrap = document.getElementById('fab-wrap');
  const menu = document.getElementById('fab-menu');
  wrap?.classList.remove('fab-open');
  menu?.classList.add('hidden');
}

function quickAddJob() {
  closeFabMenu();
  if (typeof openJobModal === 'function') openJobModal();
}

function quickAddClient() {
  closeFabMenu();
  if (typeof openClientModal === 'function') openClientModal();
}

function quickStartTimer() {
  closeFabMenu();
  // 如果已在計時 → 跳到該案件
  if (activeTimer.jobId) {
    focusActiveTimerJob();
    return;
  }
  // 否則打開最近一筆案件，使用者按開始
  const recent = [...state.jobs].filter(j => !j.cancelled).sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  if (recent) {
    editJob(recent.id);
    toast('打開最近一筆案件，請按計時器「▶ 開始」', 4000);
  } else {
    toast('還沒有案件，先新增一筆吧');
    quickAddJob();
  }
}

function quickOpenLastJob() {
  closeFabMenu();
  const recent = [...state.jobs].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  if (recent) editJob(recent.id);
  else toast('還沒有案件');
}

function escapeHtml(s) {
  return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function jobStatus(j) {
  if (j.cancelled) return 'cancelled';
  if (j.paid && j.done) return 'paid';
  if (j.paid && !j.done) return 'prepaid';   // 已收款但未完成（儲值制常見）
  if (j.done) return 'done-unpaid';
  return 'pending';
}

// 用於統計：取消的案件不計入
function activeJobs() {
  // v2.6: 估價單不算正式案件，排除在統計外
  return state.jobs.filter(j => !j.cancelled && !j.isEstimate);
}
function estimateJobs() {
  return state.jobs.filter(j => j.isEstimate && !j.cancelled);
}

// ============== 金額計算 helpers（v2.8.0）==============
// 折扣後的應收金額
function jobFinalAmount(j) {
  const base = +j.amount || 0;
  if (j.discountType === 'fixed') return Math.max(0, base - (+j.discountValue || 0));
  if (j.discountType === 'percent') return Math.max(0, Math.round(base * (1 - (+j.discountValue || 0) / 100)));
  return base;
}

// 折扣金額（正數，純呈現用）
function jobDiscountAmount(j) {
  const base = +j.amount || 0;
  if (j.discountType === 'fixed') return Math.min(base, +j.discountValue || 0);
  if (j.discountType === 'percent') return Math.round(base * (+j.discountValue || 0) / 100);
  return 0;
}

// 已收金額（payments 加總）
function jobPaidTotal(j) {
  return (j.payments || []).reduce((s, p) => s + (+p.amount || 0), 0);
}

// 待收金額（應收 - 已收 - 呆帳）
function jobUnpaidAmount(j) {
  return Math.max(0, jobFinalAmount(j) - jobPaidTotal(j) - (+j.writeOff || 0));
}

// 是否視同結清（已收 + 呆帳 >= 應收）
function jobIsFullyPaid(j) {
  return jobPaidTotal(j) + (+j.writeOff || 0) >= jobFinalAmount(j) && jobFinalAmount(j) > 0;
}

// 同步 paid / paidAt 與 payments（每次 payments 變動後呼叫）
function recomputePaidStatus(j) {
  if (jobIsFullyPaid(j)) {
    j.paid = true;
    // paidAt 取最後一筆 payment 的日期
    const last = [...(j.payments || [])].sort((a,b) => (a.date||'').localeCompare(b.date||'')).slice(-1)[0];
    j.paidAt = last ? last.date : (j.paidAt || todayStr());
  } else {
    j.paid = false;
    j.paidAt = null;
  }
}

// 案件的「歸屬月」：endDate 優先，沒有就用 date
function jobBelongMonth(j) {
  return getMonth(j.endDate || j.date);
}

// 案件的「實收金額」：對帳用，**允許負數**反映倒貼
// v3.22.4：先扣折扣再算分潤
// v3.24.0：加外包定額成本扣減
// v3.24.1：拿掉稅項（嘗試用請款單 toggle，但無法連動）
// v3.24.2：稅改 case 層級（j.taxApplied）— 每筆案件自己決定，月度 / 收益自動連動
// v3.24.5：算法順序按 user 要求：請款 → 扣稅 → 扣外包 → 扣分潤（加法交換律結果一樣，但語意清楚）
//   公式：實收 = 折扣後 − 5% 稅（如有）− 外包成本 − 分潤
//   負數合理：派外包成本超過業主應付時 user 倒貼
function jobNetAmount(j) {
  const final = jobFinalAmount(j);                       // 1. 折扣後（業主應付）
  const tax = jobInvoiceTax(j);                          // 2. 先扣 5% 稅（j.taxApplied 為 true 才扣）
  const outsourceCost = +j.outsourceCost || 0;           // 3. 再扣外包成本（定額）
  const commission = jobCommission(j);                   // 4. 最後扣分潤（給介紹人）
  return Math.round(final - tax - outsourceCost - commission); // 允許負數
}

// 案件的分潤金額（給介紹人的）
// v3.22.4：分潤基準改用 jobFinalAmount（折扣後），跟 net 一致
// v3.24.8：分潤基於「未稅金額」算（先扣稅再算分潤，跟 user 描述的順序一致）
//   公式：分潤 = (折扣後 − 稅) × 分潤率
//   範例：5,700 含稅、稅 271、分潤 10% → 分潤 = (5,700 − 271) × 10% = 542.9 ≈ 543
function jobCommission(j) {
  const c = getClient(j.clientId);
  const rate = (c && c.commissionRate) || 0;
  if (rate <= 0) return 0;
  const final = jobFinalAmount(j);
  const tax = jobInvoiceTax(j);
  return Math.round((final - tax) * (rate / 100));
}

// v3.24.2：稅讀 case 層級（j.taxApplied）— 每筆案件自己決定
// v3.24.4：用 /1.05 反推（業主給的是含稅金額）
// v3.24.7：回退 v3.24.6 的「全部都扣」決策，恢復 per-case toggle
//   公式：稅 = j.taxApplied ? (final − round(final / 1.05)) : 0
//   有勾「含稅」的案件才扣，沒勾的不扣（業主直接付，不需報稅）
function jobInvoiceTax(j) {
  if (!j.taxApplied) return 0;
  const final = jobFinalAmount(j);
  if (final <= 0) return 0;
  return final - Math.round(final / 1.05);
}

// v3.24.8：分潤改基於未稅金額算（含稅+分潤情境會差幾元）
function _verifyJobNet() {
  const cases = [
    // [amount, discountType, discountVal, taxApplied, commRate, outsource, expectedNet]
    [10000, 'none',    0,  false, 0,  0,     10000],   // 基本（沒勾稅）
    [10000, 'none',    0,  true,  0,  0,      9524],   // 含稅: 10000-476
    [10000, 'none',    0,  false, 10, 0,      9000],   // 分潤 10%（沒勾稅；分潤=10000×10%=1000）
    // 含稅+分潤：稅=476、未稅=9524、分潤=9524×10%=952、net=10000-476-952=8572
    [10000, 'none',    0,  true,  10, 0,      8572],
    // 完整：8572-5000=3572
    [10000, 'none',    0,  true,  10, 5000,   3572],
    [10000, 'none',    0,  false, 0,  12000, -2000],   // 倒貼（沒勾稅）
    // 折扣 10% → final 9000；稅=429、未稅=8571、分潤=8571×10%=857、外包=5000
    // net = 9000 - 429 - 5000 - 857 = 2714
    [10000, 'percent', 10, true,  10, 5000,   2714],
  ];
  let pass = 0, fail = 0;
  cases.forEach(([amount, dType, dVal, taxApp, rate, oc, expected], i) => {
    const fakeJ = { amount, discountType: dType, discountValue: dVal, taxApplied: taxApp, outsourceCost: oc, payments: [], writeOff: 0 };
    const fakeC = { commissionRate: rate };
    const _real = window.getClient;
    window.getClient = () => fakeC;
    fakeJ.clientId = '_mock_';
    const got = jobNetAmount(fakeJ);
    window.getClient = _real;
    const ok = got === expected;
    console.log(`Case ${i+1}: ${ok ? '✓' : '✗'} expected=${expected} got=${got}`, { amount, dType, dVal, taxApp, rate, oc });
    if (ok) pass++; else fail++;
  });
  console.log(`\n=== _verifyJobNet: ${pass} pass, ${fail} fail ===`);
  return { pass, fail };
}

// 已用過的標籤清單（補全用）
function getUsedTags() {
  // v3.14.0：包含 multi-tag、向下相容單字串 tag
  const tags = new Set();
  state.jobs.forEach(j => {
    if (j.tag) tags.add(j.tag);
    (j.tags || []).forEach(t => tags.add(t));
  });
  return [...tags].sort();
}

// 儲值制業主餘額計算
// v3.22.5：used 改用 jobFinalAmount（折扣後）— 業主實際被扣的就是折扣後金額
function clientBalance(clientId) {
  const c = getClient(clientId);
  if (!c?.prepaidMode) return null;
  const total = (c.prepayments || []).reduce((s,p) => s + (+p.amount||0), 0);
  const used = activeJobs().filter(j => j.clientId === clientId).reduce((s,j) => s + jobFinalAmount(j), 0);
  return { total, used, balance: total - used };
}

function getClient(cid) { return state.clients.find(c => c.id === cid); }

// ============== Tabs ==============
document.querySelectorAll('nav.tabs button').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// v2.3 效能優化：記住目前分頁，只渲染當前可見的內容
let currentTab = 'dashboard';

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('nav.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  ['dashboard','jobs','calendar','revenue','clients','invoice','settings'].forEach(t => {
    document.getElementById('tab-'+t).classList.toggle('hidden', t !== tab);
  });
  // v3.9.0：離開業主分頁時自動回列表（避免下次回來還停在 detail）
  if (tab !== 'clients' && detailClientId) {
    detailClientId = null;
    document.getElementById('client-detail-view')?.classList.add('hidden');
    document.getElementById('client-list-view')?.classList.remove('hidden');
  }
  // v3.17.0：FAB 升級成 Quick Add（單一 ＋ 按鈕，所有功能在 popup menu）
  // 設定/請款/收益分頁仍然隱藏（這些頁面通常不會新增）
  const fabWrap = document.getElementById('fab-wrap');
  if (fabWrap) {
    if (tab === 'settings' || tab === 'invoice' || tab === 'revenue') {
      fabWrap.style.display = 'none';
    } else {
      fabWrap.style.display = '';
    }
  }
  closeFabMenu();
  // 切到該分頁時才重畫該分頁
  renderActiveTab();
}

// ============== Render (main) ==============
// v2.3：只重畫「當前可見分頁」+ 永遠需要的小元素（徽章、提醒）
// 大幅減少 462 案件 + 13 業主下的 reflow / repaint 成本

let renderRafId = null;

function render() {
  // 用 requestAnimationFrame 合併連續多次 render 呼叫成一次
  if (renderRafId) return;
  renderRafId = requestAnimationFrame(() => {
    renderRafId = null;
    renderActiveTab();
    // 永遠都要更新（徽章、提醒、備份狀態都很輕）
    renderAlerts();
    renderBadge();
    renderBackupStatus();
  });
}

function renderActiveTab() {
  switch (currentTab) {
    case 'dashboard': renderDashboard(); break;
    case 'jobs':      renderJobs();      break;
    case 'calendar':  renderCalendar();  break;
    case 'revenue':   renderRevenue();   break;
    case 'clients':
      // v3.9.0：detail mode 時 render detail；否則 render 列表
      if (detailClientId) renderClientDetail();
      else renderClients();
      break;
    case 'invoice':   renderInvoice();   break;
    // settings 不需要 render（純靜態）
  }
}

// 強制全部重畫（特殊場景：例如 import / restore / 切換主題）
function renderAll() {
  renderAlerts();
  renderDashboard();
  renderJobs();
  renderCalendar();
  renderRevenue();
  renderClients();
  renderInvoice();
  renderBadge();
  renderBackupStatus();
  // v3.0.0-alpha.3：把存摺照片 placeholder 換成實際 <img>（fire-and-forget；cache 命中秒出）
  if (typeof cloudHydrateBankbookImages === 'function') {
    cloudHydrateBankbookImages().catch(e => console.warn('[bankbook] hydrate failed:', e));
  }
}

// ============== 批次操作 ==============
let bulkMode = false;
let bulkSelected = new Set();

// v2.7.10: Dashboard 近期案件專屬批次（與 jobs 分頁的 bulkMode 獨立）
let dashBulkMode = false;
let dashBulkSelected = new Set();

function toggleDashBulkMode() {
  dashBulkMode = !dashBulkMode;
  dashBulkSelected.clear();
  renderDashboard();
}

function toggleDashBulkSelect(id) {
  if (dashBulkSelected.has(id)) dashBulkSelected.delete(id);
  else dashBulkSelected.add(id);
  renderDashboard();
}

function dashBulkSelectAll() {
  const recent = [...state.jobs].sort((a,b) => (b.date||'').localeCompare(a.date||'')).slice(0, 10);
  recent.forEach(j => { if (!j.cancelled) dashBulkSelected.add(j.id); });
  renderDashboard();
}

function dashBulkClear() {
  dashBulkSelected.clear();
  renderDashboard();
}

function dashBulkExit() {
  dashBulkMode = false;
  dashBulkSelected.clear();
}

function dashBulkMarkDone() {
  if (!dashBulkSelected.size) return;
  const ids = Array.from(dashBulkSelected);
  // v3.15.0：先 snapshot 才動作
  pushUndoSnapshot(`已標記 ${ids.length} 筆完成`);
  let count = 0;
  let totalAmt = 0;
  ids.forEach(id => {
    const j = state.jobs.find(x => x.id === id);
    if (!j || j.cancelled) return;
    if (!j.done) {
      j.done = true;
      j.doneAt = j.doneAt || todayStr();
      count++;
      totalAmt += jobFinalAmount(j);
    }
  });
  save();
  if (count > 0) logAction('bulk-done', { count, amount: totalAmt });
  dashBulkExit();
  render();
}

function dashBulkMarkPaid() {
  if (!dashBulkSelected.size) return;
  // 用既有的收款日期 modal，並讓 confirmPaidDate 完成後清除 dashBulk 狀態
  const ids = Array.from(dashBulkSelected).filter(id => {
    const j = state.jobs.find(x => x.id === id);
    return j && !j.cancelled;
  });
  if (!ids.length) { toast('沒有可收款的案件'); return; }
  openPaidDateModal(ids);
  // 旗標：modal 確認後要清除 dashBulk
  paidDateContext._fromDashBulk = true;
}

// v2.9.4: 批次設定折扣
function openBulkDiscountModal() {
  if (!dashBulkSelected.size) return;
  const ids = Array.from(dashBulkSelected);
  const total = state.jobs.filter(j => ids.includes(j.id)).reduce((s,j) => s + (+j.amount || 0), 0);
  document.getElementById('bulk-discount-info').textContent = `將套用到 ${ids.length} 筆案件（原價合計 ${fmt(total)}）`;
  document.getElementById('bulk-discount-value').value = '';
  document.querySelectorAll('input[name="bulk-discount-type"]').forEach(r => r.checked = (r.value === 'none'));
  document.getElementById('bulk-discount-modal').classList.add('open');
}

function confirmBulkDiscount() {
  const type = document.querySelector('input[name="bulk-discount-type"]:checked')?.value || 'none';
  const value = +document.getElementById('bulk-discount-value').value || 0;
  if (type !== 'none' && value <= 0) {
    toast('請輸入折扣值');
    return;
  }
  if (type === 'percent' && value > 100) {
    toast('百分比不能超過 100');
    return;
  }
  const ids = Array.from(dashBulkSelected);
  let count = 0;
  ids.forEach(id => {
    const j = state.jobs.find(x => x.id === id);
    if (!j || j.cancelled) return;
    j.discountType = type;
    j.discountValue = type === 'none' ? 0 : value;
    // 折扣變動後，已收款狀態可能改變（應收金額變了）
    recomputePaidStatus(j);
    count++;
  });
  save();
  if (count > 0) logAction('bulk-discount', { count, type, value });
  document.getElementById('bulk-discount-modal').classList.remove('open');
  toast(`✓ 已套用折扣到 ${count} 筆`);
  dashBulkExit();
  render();
}

function dashBulkMarkCancelled() {
  if (!dashBulkSelected.size) return;
  if (!confirm(`確定要把 ${dashBulkSelected.size} 筆案件標記為已取消？\n\n（取消的案件不計入收益統計，但保留紀錄）`)) return;
  const ids = Array.from(dashBulkSelected);
  // v3.15.0：snapshot for undo
  pushUndoSnapshot(`已取消 ${ids.length} 筆案件`);
  ids.forEach(id => {
    const j = state.jobs.find(x => x.id === id);
    if (j) j.cancelled = true;
  });
  save();
  logAction('bulk-cancel', { count: ids.length });
  dashBulkExit();
  render();
}

function toggleBulkMode() {
  bulkMode = !bulkMode;
  bulkSelected.clear();
  document.getElementById('bulk-toggle').textContent = bulkMode ? '✕ 退出批次' : '☑️ 批次操作';
  document.getElementById('bulk-bar').classList.toggle('hidden', !bulkMode);
  renderJobs();
}

function toggleBulkSelect(id) {
  if (bulkSelected.has(id)) bulkSelected.delete(id);
  else bulkSelected.add(id);
  document.getElementById('bulk-count').textContent = `已選 ${bulkSelected.size} 筆`;
  renderJobs();
}

function bulkSelectAll() {
  // v3.24.12：selector 從 `.row[data-job-id]` 改成 `[data-job-id]`，涵蓋 5 種視圖
  // （comfort/compact 用 div.row、table 用 tr、card 用 div.job-card-tile 都有 data-job-id）
  document.querySelectorAll('#jobs-list [data-job-id]').forEach(el => {
    bulkSelected.add(el.getAttribute('data-job-id'));
  });
  document.getElementById('bulk-count').textContent = `已選 ${bulkSelected.size} 筆`;
  renderJobs();
}

function bulkInvert() {
  // v3.24.12：selector 同上
  document.querySelectorAll('#jobs-list [data-job-id]').forEach(el => {
    const id = el.getAttribute('data-job-id');
    if (bulkSelected.has(id)) bulkSelected.delete(id);
    else bulkSelected.add(id);
  });
  document.getElementById('bulk-count').textContent = `已選 ${bulkSelected.size} 筆`;
  renderJobs();
}

function bulkMarkDone() {
  if (!bulkSelected.size) { toast('沒有選任何案件'); return; }
  if (!confirm(`將選中的 ${bulkSelected.size} 筆案件標記為「已完成」（如果已是完成不變）？`)) return;
  // v3.15.0：snapshot for undo
  pushUndoSnapshot(`已標記 ${bulkSelected.size} 筆完成`);
  let n = 0;
  state.jobs.forEach(j => {
    if (bulkSelected.has(j.id) && !j.done) {
      j.done = true;
      j.doneAt = todayStr();
      n++;
    }
  });
  bulkSelected.clear();
  save(); render();
}

function bulkMarkPaid() {
  if (!bulkSelected.size) { toast('沒有選任何案件'); return; }
  // 用收款日期 modal（取代 prompt）
  openPaidDateModal([...bulkSelected]);
}

function bulkDelete() {
  if (!bulkSelected.size) { toast('沒有選任何案件'); return; }
  // v3.15.0：5 筆以下不需要二次驗證（有 undo 接住），多筆才嚴格 confirm
  const cnt = bulkSelected.size;
  if (cnt > 5) {
    if (!confirm(`⚠️ 即將刪除 ${cnt} 筆案件！\n\n8 秒內可復原，超過 8 秒就只能從 Drive 備份還原。確定？`)) return;
    const verify = prompt('最後確認：請輸入「確認刪除」四個字');
    if (verify !== '確認刪除') { toast('已取消'); return; }
  } else {
    if (!confirm(`即將刪除 ${cnt} 筆案件（8 秒內可復原），確定？`)) return;
  }
  pushUndoSnapshot(`已刪除 ${cnt} 筆案件`);
  state.jobs = state.jobs.filter(j => !bulkSelected.has(j.id));
  bulkSelected.clear();
  save(); render();
}

// ============== Reminders / Alerts ==============
let highlightJobIds = new Set();   // 提醒卡片點擊後要 highlight 的案件 id

function setHighlightJobs(ids) {
  highlightJobIds = new Set(ids);
  setTimeout(() => { highlightJobIds = new Set(); }, 2600);
}

// 鎖定只顯示這些案件 id（用於提醒卡片點擊後精確篩選）
function lockJobsToIds(ids, label) {
  state.filters.jobIdsOnly = new Set(ids);
  state.filters.jobIdsOnlyLabel = label || '提醒篩選';
  state.filters.month = 'all';
  state.filters.status = 'all';
  state.filters.clientId = 'all';
  state.filters.tag = 'all';
}

function clearJobsLock() {
  state.filters.jobIdsOnly = null;
  state.filters.jobIdsOnlyLabel = '';
  render();
}

// v2.5: 業主健康度指標
function computeClientHealth(clientId) {
  const c = state.clients.find(x => x.id === clientId);
  if (!c) return null;
  const jobs = state.jobs.filter(j => j.clientId === clientId && !j.cancelled);

  // 1. 平均收款週期
  let cycleSum = 0, cycleCount = 0;
  jobs.forEach(j => {
    if (j.doneAt && j.paidAt) {
      const d = daysBetween(j.doneAt, j.paidAt);
      if (d >= 0 && d <= 365) { cycleSum += d; cycleCount++; }
    }
  });
  const avgPayCycle = cycleCount > 0 ? Math.round(cycleSum / cycleCount) : null;

  // 2. 最近活動：最後一筆有日期的案件
  const dated = jobs.filter(j => j.date).sort((a,b) => (b.date||'').localeCompare(a.date||''));
  const lastJobDate = dated[0]?.date || null;
  const daysSinceLastJob = lastJobDate ? daysBetween(lastJobDate, todayStr()) : null;

  // 3. 單價趨勢：最近 6 個月 vs 之前 6 個月平均
  // v3.22.5：用 jobFinalAmount（折扣後）才是業主實際付的「單價」
  const now = new Date();
  const sixMoAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const twelveMoAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  const recent = [], prev = [];
  jobs.forEach(j => {
    if (!j.date) return;
    const final = jobFinalAmount(j);
    if (!final) return;
    const d = new Date(j.date);
    if (d >= sixMoAgo) recent.push(final);
    else if (d >= twelveMoAgo) prev.push(final);
  });
  const recentAvg = recent.length ? Math.round(recent.reduce((a,b)=>a+b,0) / recent.length) : 0;
  const prevAvg = prev.length ? Math.round(prev.reduce((a,b)=>a+b,0) / prev.length) : 0;
  let trend = 'flat';
  if (prevAvg > 0 && recent.length >= 2) {
    const change = (recentAvg - prevAvg) / prevAvg;
    if (change > 0.15) trend = 'up';
    else if (change < -0.15) trend = 'down';
  }

  // 4. 計分：100 起扣
  let score = 100;
  // 流失：> 90 天沒接案 -30 / > 180 天 -50
  if (daysSinceLastJob !== null) {
    if (daysSinceLastJob > 180) score -= 50;
    else if (daysSinceLastJob > 90) score -= 30;
    else if (daysSinceLastJob > 60) score -= 15;
  } else {
    score -= 20;  // 完全沒接過
  }
  // 拖款：平均 > 60 天 -25 / > 30 天 -10
  if (avgPayCycle !== null) {
    if (avgPayCycle > 60) score -= 25;
    else if (avgPayCycle > 30) score -= 10;
  }
  // 單價：跌 -15 / 升 +5
  if (trend === 'down') score -= 15;
  if (trend === 'up') score += 5;

  score = Math.max(0, Math.min(100, score));

  let label, color;
  if (score >= 75) { label = '健康'; color = 'var(--success)'; }
  else if (score >= 50) { label = '注意'; color = 'var(--warning)'; }
  else { label = '流失中'; color = 'var(--danger)'; }

  return { score, label, color, avgPayCycle, daysSinceLastJob, trend, recentAvg, prevAvg, lastJobDate };
}

// v2.2 智慧待收款：依各業主的歷史平均收款週期判斷異常
// v2.8.1: 改用 payments 第一筆日期計算（更精確；payments 為空才退回 paidAt）
function computeSlowPayJobs(active) {
  const cycleByClient = {};
  state.jobs.forEach(j => {
    if (!j.doneAt || j.cancelled) return;
    if (!jobIsFullyPaid(j)) return;
    // 取該案件最早的 payment 日期當作「實際收款日」
    const firstPay = (j.payments || []).map(p => p.date).filter(Boolean).sort()[0] || j.paidAt;
    if (!firstPay) return;
    const days = daysBetween(j.doneAt, firstPay);
    if (days < 0 || days > 365) return;
    if (!cycleByClient[j.clientId]) cycleByClient[j.clientId] = { sum: 0, count: 0 };
    cycleByClient[j.clientId].sum += days;
    cycleByClient[j.clientId].count++;
  });
  const today = todayStr();
  const slow = [];
  active.forEach(j => {
    if (!j.done || jobIsFullyPaid(j)) return;
    if (!j.doneAt) return;
    const stat = cycleByClient[j.clientId];
    if (!stat || stat.count < 3) return;
    const avg = Math.round(stat.sum / stat.count);
    const daysSince = daysBetween(j.doneAt, today);
    if (daysSince > avg * 1.5 && daysSince > 14) {
      slow.push({ ...j, avgDays: avg, daysSince });
    }
  });
  return slow.sort((a,b) => b.daysSince - a.daysSince);
}

function computeAlerts() {
  const today = todayStr();
  const in3 = addDays(new Date(), config.dueSoonDays || 3);
  const alerts = [];
  const active = activeJobs();  // 排除取消的案件

  // 1. 逾期未完成
  if (config.enableOverdueAlert !== false) {
    const overdue = active.filter(j => !j.done && j.date && j.date < today);
    if (overdue.length) {
      // v3.22.5：用 jobFinalAmount（折扣後應收）
      const amt = overdue.reduce((s,j) => s + jobFinalAmount(j), 0);
      alerts.push({
        type: 'overdue',
        icon: '🔴',
        title: `${overdue.length} 筆逾期未完成`,
        desc: `最早日期 ${overdue.map(j=>j.date).sort()[0]}　涉及金額 ${fmt(amt)}`,
        onClick: () => { lockJobsToIds(overdue.map(j=>j.id), `🔴 逾期未完成（${overdue.length} 筆）`); switchTab('jobs'); }
      });
    }
  }

  // 2. 未來 N 天內到期（含今天）
  if (config.enableDueSoonAlert !== false) {
    const days = config.dueSoonDays || 3;
    const dueSoon = active.filter(j => !j.done && j.date && j.date >= today && j.date <= in3);
    if (dueSoon.length) {
      alerts.push({
        type: 'due-soon',
        icon: '🟡',
        title: `${dueSoon.length} 筆即將到期`,
        desc: `未來 ${days} 天內要交件：${dueSoon.slice(0,2).map(j=>j.title).join('、')}${dueSoon.length>2?'…':''}`,
        onClick: () => { lockJobsToIds(dueSoon.map(j=>j.id), `🟡 未來 ${days} 天到期（${dueSoon.length} 筆）`); switchTab('jobs'); }
      });
    }
  }

  // 3. 已完成但超過 N 天未收款（每筆 job 用該業主的設定，沒設則用全域）
  if (config.enableUnpaidLongAlert !== false) {
    const unpaidLong = active.filter(j => {
      if (!j.done || j.paid || !j.doneAt) return false;
      const c = getClient(j.clientId);
      const days = (c?.unpaidRemindDaysOverride != null) ? c.unpaidRemindDaysOverride : (config.unpaidRemindDays || 7);
      const threshold = addDays(new Date(), -days);
      return j.doneAt <= threshold;
    });
    if (unpaidLong.length) {
      // v3.22.5：用 jobUnpaidAmount（待收金額，已扣折扣 + 已收 + 呆帳）
      const amt = unpaidLong.reduce((s,j) => s + jobUnpaidAmount(j), 0);
      const byClient = {};
      unpaidLong.forEach(j => {
        const c = getClient(j.clientId);
        const name = c ? c.name : '未指定';
        byClient[name] = (byClient[name]||0) + jobUnpaidAmount(j);
      });
      const clientsStr = Object.entries(byClient).map(([n,a]) => `${n} ${fmt(a)}`).join('、');
      alerts.push({
        type: 'unpaid-long',
        icon: '🟠',
        title: `${unpaidLong.length} 筆完成已久未收款`,
        desc: clientsStr,
        amt: fmt(amt),
        onClick: () => { lockJobsToIds(unpaidLong.map(j=>j.id), `🟠 完成已久未收款（${unpaidLong.length} 筆）`); switchTab('jobs'); }
      });
    }
  }

  // 4. 月底提醒（從每月第 N 天起）
  if (config.enableMonthEndAlert !== false) {
    const dom = new Date().getDate();
    const startDay = config.monthEndReminderDay || 25;
    if (dom >= startDay) {
      const thisMonthUnpaid = active.filter(j => j.done && !jobIsFullyPaid(j) && getMonth(j.date) === thisMonth());
      if (thisMonthUnpaid.length) {
        // v3.22.5：用 jobUnpaidAmount（待收）
        const amt = thisMonthUnpaid.reduce((s,j) => s + jobUnpaidAmount(j), 0);
        alerts.push({
          type: 'month-end',
          icon: '📅',
          title: `月底將至，本月有 ${thisMonthUnpaid.length} 筆可請款`,
          desc: `可產生請款單寄給業主　共 ${fmt(amt)}`,
          onClick: () => { lockJobsToIds(thisMonthUnpaid.map(j=>j.id), `📅 本月可請款（${thisMonthUnpaid.length} 筆）`); switchTab('jobs'); }
        });
      }
    }
  }

  // 4b. 業主固定請款日提醒（v2.7.9 新增）
  if (config.enableBillingDayAlert !== false) {
    const now = new Date();
    state.clients.forEach(c => {
      if (!c.billingDay || c.billingDay < 1 || c.billingDay > 31) return;
      const remindDays = +c.billingRemindDays || 3;
      // 計算下一個請款日：先試本月，過了則用下月
      let billingDate = new Date(now.getFullYear(), now.getMonth(), c.billingDay);
      // 處理月份天數不足（e.g. 2 月沒 31 號 → 月底）
      if (billingDate.getMonth() !== now.getMonth()) {
        billingDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      }
      if (billingDate < now) {
        billingDate = new Date(now.getFullYear(), now.getMonth() + 1, c.billingDay);
        if (billingDate.getMonth() !== ((now.getMonth() + 1) % 12)) {
          billingDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        }
      }
      const daysUntil = Math.ceil((billingDate - now) / (1000 * 60 * 60 * 24));
      if (daysUntil < 0 || daysUntil > remindDays) return;
      // 該業主有沒有未收款的案件可請？
      const billable = active.filter(j => j.clientId === c.id && j.done && !jobIsFullyPaid(j));
      if (!billable.length) return;
      // v3.22.5：用 jobUnpaidAmount（待收）
      const amt = billable.reduce((s,j) => s + jobUnpaidAmount(j), 0);
      const dateStr = `${billingDate.getMonth()+1}/${billingDate.getDate()}`;
      alerts.push({
        type: 'billing-day-' + c.id,
        icon: '💼',
        title: `${c.name} 請款日 ${daysUntil === 0 ? '就是今天' : `還有 ${daysUntil} 天`}（${dateStr}）`,
        desc: `${billable.length} 筆可請款　共 ${fmt(amt)}`,
        onClick: () => { lockJobsToIds(billable.map(j=>j.id), `💼 ${c.name} 請款日（${billable.length} 筆）`); switchTab('jobs'); }
      });
    });
  }

  // 5. 儲值餘額不足提醒
  state.clients.forEach(c => {
    const bal = clientBalance(c.id);
    if (bal && bal.balance < 1000) {
      alerts.push({
        type: 'low-balance',
        icon: '💰',
        title: `${c.name} 儲值餘額剩 ${fmt(bal.balance)}`,
        desc: bal.balance < 0 ? '已超支，建議盡快請業主儲值' : '建議提醒業主再儲值',
        onClick: () => { setFilter('clientId', c.id); switchTab('clients'); }
      });
    }
  });

  // 5c. v2.9: 部分收款尾款提醒 — 收過訂金但尾款超過 N 天沒收
  if (config.enableUnpaidLongAlert !== false) {
    const tailDays = +config.unpaidRemindDays || 7;
    const tailThreshold = addDays(new Date(), -tailDays);
    const tailPending = active.filter(j => {
      if (jobIsFullyPaid(j)) return false;
      const pTotal = jobPaidTotal(j);
      if (pTotal <= 0) return false;  // 完全沒收 → 由其他規則處理
      // 最後一筆 payment 的日期
      const lastPay = (j.payments || []).map(p => p.date).filter(Boolean).sort().slice(-1)[0];
      if (!lastPay) return false;
      return lastPay <= tailThreshold;
    });
    if (tailPending.length) {
      const amt = tailPending.reduce((s,j) => s + jobUnpaidAmount(j), 0);
      const sample = tailPending.slice(0, 2).map(j => {
        const c = getClient(j.clientId);
        return `${c?.name || '?'} 尾款 ${fmt(jobUnpaidAmount(j)).replace('NT$','').trim()}`;
      }).join('、');
      alerts.push({
        type: 'tail-pending',
        icon: '🟣',
        title: `${tailPending.length} 筆部分收款的尾款拖款`,
        desc: sample + (tailPending.length > 2 ? '…' : '') + ` · 共待收 ${fmt(amt)}`,
        onClick: () => { lockJobsToIds(tailPending.map(j=>j.id), `🟣 尾款拖款（${tailPending.length} 筆）`); switchTab('jobs'); }
      });
    }
  }

  // 5b. 智慧待收款警告（v2.2）：每個業主的歷史平均收款週期，超過該週期 1.5 倍的案件
  const slowJobs = config.enableSlowPayAlert !== false ? computeSlowPayJobs(active) : [];
  if (slowJobs.length) {
    // v3.22.5：用 jobUnpaidAmount（待收）
    const amt = slowJobs.reduce((s,j) => s + jobUnpaidAmount(j), 0);
    const samples = slowJobs.slice(0, 2).map(s => `${getClient(s.clientId)?.name || '?'} 拖了 ${s.daysSince} 天（平均 ${s.avgDays} 天）`).join('、');
    alerts.push({
      type: 'slow-pay',
      icon: '⏱️',
      title: `${slowJobs.length} 筆異常拖款`,
      desc: samples + (slowJobs.length > 2 ? '…' : '') + ` · 共 ${fmt(amt)}`,
      onClick: () => { lockJobsToIds(slowJobs.map(j=>j.id), `⏱️ 異常拖款（${slowJobs.length} 筆）`); switchTab('jobs'); }
    });
  }

  // 6. 備份提醒（> N 天沒匯出備份 + 有資料時才提示；v3.6.2：加 enableBackupAlert toggle）
  if (state.jobs.length > 0 && (config.enableBackupAlert !== false)) {
    const last = config.lastExportAt;
    const daysAgo = last ? daysBetween(last, today) : Infinity;
    if (daysAgo >= config.backupRemindDays) {
      alerts.push({
        type: 'backup',
        icon: '💾',
        title: last ? `已超過 ${daysAgo} 天沒備份資料` : '尚未匯出任何備份',
        desc: '資料只存在瀏覽器，建議立刻匯出 JSON 存雲端硬碟',
        onClick: () => switchTab('settings')
      });
    }
  }

  return alerts;
}

function renderAlerts() {
  const alerts = computeAlerts();
  const box = document.getElementById('alerts');
  if (!alerts.length) { box.innerHTML = ''; return; }
  box.innerHTML = alerts.map((a, i) => `
    <div class="alert type-${a.type}" data-idx="${i}">
      <div class="alert-icon">${a.icon}</div>
      <div class="alert-content">
        <div class="alert-title">${escapeHtml(a.title)}</div>
        <div class="alert-desc">${escapeHtml(a.desc)}</div>
        ${a.amt ? `<div class="alert-amt">${a.amt}</div>` : ''}
      </div>
    </div>
  `).join('');
  // 綁點擊事件
  box.querySelectorAll('.alert').forEach((el, i) => {
    el.addEventListener('click', alerts[i].onClick);
  });
}

function renderBadge() {
  const count = computeAlerts().length;
  const badge = document.getElementById('dash-badge');
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// ============== Dashboard ==============
function renderDashboard() {
  // v3.6.0：完全無資料時顯示 empty state 引導卡，4 張 stat 數字仍是 $0 但有 CTA
  const isEmpty = (state.clients.length === 0) && (state.jobs.length === 0);
  document.getElementById('dash-empty-state')?.classList.toggle('hidden', !isEmpty);
  // v3.24.18：渲染「今天的重點」清單（沒任何重點時自動 hide）
  if (typeof renderTodayTodo === 'function') renderTodayTodo();

  const m = thisMonth();
  const active = activeJobs();
  const monthJobs = active.filter(j => getMonth(j.date) === m);
  // v2.8.1: 改用 finalAmount 與 payment 計算
  // 「本月已收」= 本月所有 payment 加總（用 payment 的 date 歸月）
  const paidAmt = active.reduce((s, j) => {
    return s + (j.payments || []).filter(p => getMonth(p.date) === m).reduce((ss, p) => ss + (+p.amount || 0), 0);
  }, 0);
  // 「本月待收」= 本月案件（已完成）的 unpaid 加總
  const unpaidAmt = monthJobs.filter(j => j.done).reduce((s, j) => s + jobUnpaidAmount(j), 0);
  const pendingAmt = monthJobs.filter(j => !j.done).reduce((s, j) => s + jobUnpaidAmount(j), 0);
  const year = new Date().getFullYear();
  // 年度已收款：所有 payment 中 date 為今年的加總
  const yearAmt = active.reduce((s, j) => {
    return s + (j.payments || []).filter(p => p.date && p.date.startsWith(year+'')).reduce((ss, p) => ss + (+p.amount || 0), 0);
  }, 0);

  // 計數：本月已有任何 payment 的案件數
  const paidJobCount = active.filter(j => (j.payments || []).some(p => getMonth(p.date) === m)).length;
  // v3.24.18：用 countUpStat 平滑滾動到目標值（200ms），改善「精緻感」
  countUpStat('stat-paid', paidAmt);
  document.getElementById('stat-paid-sub').textContent = paidJobCount + ' 筆';
  countUpStat('stat-unpaid', unpaidAmt);
  document.getElementById('stat-unpaid-sub').textContent = monthJobs.filter(j=>j.done && !jobIsFullyPaid(j)).length + ' 筆';
  countUpStat('stat-pending', pendingAmt);
  document.getElementById('stat-pending-sub').textContent = monthJobs.filter(j=>!j.done).length + ' 筆';
  countUpStat('stat-year', yearAmt);
  document.getElementById('stat-year-sub').textContent = year + ' 年已收款';

  // 近期案件（v2.7.10：擴大到 10 筆 + 支援 dashboard 批次模式）
  const recent = [...state.jobs].sort((a,b) => (b.date||'').localeCompare(a.date||'')).slice(0, 10);
  const recentBox = document.getElementById('recent-jobs');
  if (!recent.length) {
    recentBox.innerHTML = emptyState('還沒有案件', '點右下角 + 新增第一筆');
  } else {
    let html = '';
    if (dashBulkMode) {
      // v3.22.5：批次合計用 jobFinalAmount（折扣後應收）
      const total = recent.filter(j => dashBulkSelected.has(j.id)).reduce((s,j) => s + jobFinalAmount(j), 0);
      const count = recent.filter(j => dashBulkSelected.has(j.id)).length;
      html += `<div style="background: var(--primary-light); border-radius: 8px; padding: 10px; margin-bottom: 10px; display: flex; gap: 8px; flex-wrap: wrap; align-items: center; font-size: 13px;">
        <span style="flex: 1; min-width: 120px; font-weight: 600;">已選 ${count} 筆 ${count ? `· ${fmt(total)}` : ''}</span>
        <button class="btn btn-ghost btn-sm" onclick="dashBulkSelectAll()">全選</button>
        <button class="btn btn-ghost btn-sm" onclick="dashBulkClear()">清除</button>
        <button class="btn btn-success btn-sm" onclick="dashBulkMarkDone()" ${!count?'disabled':''}>✓ 標完成</button>
        <button class="btn btn-primary btn-sm" onclick="dashBulkMarkPaid()" ${!count?'disabled':''}>$ 標收款（選日期）</button>
        <button class="btn btn-outline btn-sm" onclick="openBulkDiscountModal()" ${!count?'disabled':''}>🏷️ 設折扣</button>
        <button class="btn btn-outline btn-sm" onclick="dashBulkMarkCancelled()" ${!count?'disabled':''}>🚫 取消</button>
        <button class="btn btn-outline btn-sm" onclick="toggleDashBulkMode()">✕ 退出</button>
      </div>`;
    }
    html += recent.map(j => jobRow(j, 'dash')).join('');
    recentBox.innerHTML = html;
  }
  // 標題旁的批次按鈕（render 後再更新文字）
  const dashBulkBtn = document.getElementById('dash-bulk-btn');
  if (dashBulkBtn) dashBulkBtn.textContent = dashBulkMode ? '✕ 退出批次' : '☑️ 批次操作';

  // 月度圖：最近 6 個「日曆月份」（v2.10.14：改成由近到遠，當月在最上面）
  // v3.22.5：paid 用 jobFinalAmount（fully paid 案件的實收）、pending 用 jobUnpaidAmount（partial paid 也精確）
  const byMonth = {};
  active.forEach(j => {
    if (!j.date) return;
    const mm = getMonth(j.date);
    if (!byMonth[mm]) byMonth[mm] = { paid: 0, pending: 0 };
    if (j.paid) byMonth[mm].paid += jobFinalAmount(j);
    else if (j.done) byMonth[mm].pending += jobUnpaidAmount(j);
  });
  const months = [];
  const nowRef = new Date();
  nowRef.setDate(1);
  for (let i = 0; i <= 5; i++) {
    const dd = new Date(nowRef);
    dd.setMonth(dd.getMonth() - i);
    const mmKey = dd.getFullYear() + '-' + String(dd.getMonth()+1).padStart(2,'0');
    months.push(mmKey);
    if (!byMonth[mmKey]) byMonth[mmKey] = { paid: 0, pending: 0 };
  }
  const max = Math.max(...months.map(mm => byMonth[mm].paid + byMonth[mm].pending), 1);
  document.getElementById('month-chart').innerHTML = months.length
    ? months.map(mm => {
        const d = byMonth[mm];
        const paidPct = (d.paid/max*100).toFixed(1);
        const pendingPct = (d.pending/max*100).toFixed(1);
        return `<div style="margin: 10px 0;">
          <div style="display:flex; justify-content: space-between; font-size: 12px; color: var(--muted); margin-bottom: 4px;">
            <span>${mm}</span>
            <span style="font-variant-numeric: tabular-nums; color: var(--text);">
              ${fmt(d.paid)}${d.pending ? ` <span style="color: var(--warning);">+待收 ${fmt(d.pending)}</span>` : ''}
            </span>
          </div>
          <div style="background: var(--bg); border-radius: 6px; height: 10px; overflow: hidden; display: flex;">
            <div style="background: var(--success); width: ${paidPct}%; height: 100%;"></div>
            <div style="background: var(--warning); width: ${pendingPct}%; height: 100%;"></div>
          </div>
        </div>`;
      }).join('')
    : '<div class="empty"><div style="font-size: 13px;">尚無統計資料</div></div>';

  // 年度對比
  renderYearComparison();
}

// ============== Year Comparison (Dashboard) ==============
function renderYearComparison() {
  const box = document.getElementById('year-comparison');
  if (!box) return;

  const thisYear = new Date().getFullYear();
  const today = todayStr();
  const sameMonthDay = today.slice(5);  // 'MM-DD'

  // 依年度統計已收款金額 + 去年同期金額
  const byYear = {};
  let lastYearSamePeriod = 0;

  // v2.9: 改用 payment 日期歸年（更精確）
  activeJobs().forEach(j => {
    (j.payments || []).forEach(p => {
      if (!p.date) return;
      const y = p.date.slice(0, 4);
      byYear[y] = (byYear[y] || 0) + (+p.amount || 0);
      if (+y === thisYear - 1 && p.date.slice(5) <= sameMonthDay) {
        lastYearSamePeriod += (+p.amount || 0);
      }
    });
  });

  if (Object.keys(byYear).length === 0) {
    box.innerHTML = '<div class="empty" style="padding: 20px;"><div style="font-size: 13px;">尚無已收款資料</div></div>';
    return;
  }

  const thisYearAmt = byYear[thisYear] || 0;
  const years = Object.keys(byYear).sort().reverse();
  const maxAmt = Math.max(...Object.values(byYear), 1);

  let html = '';

  // 今年 vs 去年同期
  if (lastYearSamePeriod > 0 || thisYearAmt > 0) {
    const delta = lastYearSamePeriod > 0
      ? ((thisYearAmt - lastYearSamePeriod) / lastYearSamePeriod * 100)
      : null;
    const up = thisYearAmt >= lastYearSamePeriod;
    const deltaHtml = delta !== null
      ? `<div class="delta ${up?'up':'down'}">${up?'↑':'↓'} ${Math.abs(delta).toFixed(0)}%</div>`
      : '<div class="delta" style="color: var(--muted);">—</div>';

    html += `<div class="year-compare-summary">
      <div class="side">
        <div class="label">${thisYear} 年累計（至今）</div>
        <div class="value">${fmt(thisYearAmt)}</div>
      </div>
      ${deltaHtml}
      <div class="side" style="text-align: right;">
        <div class="label">${thisYear-1} 年同期</div>
        <div class="value muted">${fmt(lastYearSamePeriod)}</div>
      </div>
    </div>`;
  }

  // 各年度橫條比較
  html += '<div style="margin-top: 6px;">';
  html += years.map(y => {
    const amt = byYear[y];
    const pct = amt / maxAmt * 100;
    const isThisYear = +y === thisYear;
    const barColor = isThisYear ? 'var(--primary)' : 'var(--success)';
    return `<div class="year-compare-row">
      <div class="year-compare-label">
        ${y} 年${isThisYear ? '<span style="color: var(--primary); font-size: 11px; margin-left: 2px;">（至今）</span>' : ''}
      </div>
      <div class="year-compare-bar-box">
        <div class="year-compare-bar" style="width: ${pct}%; background: ${barColor};"></div>
      </div>
      <div class="year-compare-amt">${fmt(amt)}</div>
    </div>`;
  }).join('');
  html += '</div>';

  box.innerHTML = html;
}

// ============== Job Row ==============
function jobRow(j, ctx) {
  // v2.7.10: ctx === 'dash' 用 Dashboard 專屬批次狀態；undefined 用全域 jobs 分頁狀態
  const isDash = ctx === 'dash';
  const inBulk = isDash ? dashBulkMode : bulkMode;
  const selectedSet = isDash ? dashBulkSelected : bulkSelected;
  const toggleFn = isDash ? 'toggleDashBulkSelect' : 'toggleBulkSelect';
  const c = getClient(j.clientId);
  const color = c ? c.color : '#ccc';
  const name = c ? c.name : '未指定';
  const status = jobStatus(j);
  const cancelBadge = j.cancelled ? '<span class="cancelled-badge">已取消</span>' : '';
  // 截止日 badge
  let dueBadge = '';
  if (j.endDate && j.endDate !== j.date) {
    const today = todayStr();
    const isUrgent = !j.done && j.endDate < addDays(new Date(), 3);
    const isOverdue = !j.done && j.endDate < today;
    const cls = isOverdue || isUrgent ? 'urgent' : '';
    dueBadge = `<span class="due-badge ${cls}">截止 ${j.endDate.slice(5)}</span>`;
  }
  // v3.14.0：multi-tag badges（向下相容單字串 tag）
  const allTags = Array.isArray(j.tags) && j.tags.length ? j.tags : (j.tag ? [j.tag] : []);
  const tagBadge = allTags.length ? allTags.map(t => `<span class="tag-badge">${escapeHtml(t)}</span>`).join('') : '';
  // v2.6: 估價單與子任務 badge
  const estimateBadge = j.isEstimate ? '<span class="due-badge urgent" style="background: var(--warning); color: white;">📄 估價</span>' : '';
  const subDone = (j.subtasks || []).filter(s => s.done).length;
  const subTotal = (j.subtasks || []).length;
  const subBadge = subTotal > 0 ? `<span class="tag-badge">☑️ ${subDone}/${subTotal}</span>` : '';
  // v2.8.0: 折扣 + 部分收款 badge
  const discAmt = jobDiscountAmount(j);
  const discountBadge = discAmt > 0 ? `<span class="tag-badge" style="background: var(--warning-light); color: var(--warning);">折扣 ${fmt(discAmt).replace('NT$','').trim()}</span>` : '';
  const paidTotal = jobPaidTotal(j);
  const finalAmt = jobFinalAmount(j);
  const partialBadge = (paidTotal > 0 && !jobIsFullyPaid(j))
    ? `<span class="tag-badge" style="background: var(--warning-light); color: var(--warning);">已收 ${fmt(paidTotal).replace('NT$','').trim()}/${fmt(finalAmt).replace('NT$','').trim()}</span>`
    : '';
  const writeOffBadge = (+j.writeOff > 0) ? `<span class="tag-badge" style="background: var(--muted); color: white;">呆帳 ${fmt(j.writeOff).replace('NT$','').trim()}</span>` : '';
  const hl = highlightJobIds.has(j.id) ? ' highlight' : '';
  const isSelected = selectedSet.has(j.id);
  const selCls = isSelected ? ' selected' : '';

  // 批次模式：顯示批次 checkbox 取代雙勾，整個 row 點擊變成 toggle 選取
  if (inBulk) {
    return `<div class="row state-${status}${hl}${selCls}" data-job-id="${j.id}" onclick="${toggleFn}('${j.id}')">
      <div class="bulk-checkbox ${isSelected?'checked':''}"></div>
      <div class="dot" style="background:${color}"></div>
      <div class="info">
        <div class="title">${escapeHtml(j.title || '（無標題）')}${estimateBadge}${tagBadge}${dueBadge}${subBadge}${discountBadge}${partialBadge}${writeOffBadge}${cancelBadge}</div>
        <div class="meta">${name} · ${j.date || '無日期'}</div>
      </div>
      <div class="amount">${fmt(jobFinalAmount(j))}</div>
    </div>`;
  }

  return `<div class="row state-${status}${hl}" data-job-id="${j.id}"
              onclick="editJob('${j.id}')"
              ontouchstart="onJobRowTouchStart(event, '${j.id}')"
              ontouchmove="onJobRowTouchMove(event)"
              ontouchend="onJobRowTouchEnd(event)"
              ontouchcancel="onJobRowTouchCancel()">
    <div class="check-group" onclick="event.stopPropagation();">
      <div class="check-with-label" onclick="toggleDone('${j.id}')">
        <div class="check ${j.done?'done':''}" title="點一下標記「案件完成」"></div>
        <div class="check-label ${j.done?'done':''}">完成</div>
      </div>
      <div class="check-with-label" onclick="togglePaid('${j.id}')">
        <div class="check paid-check ${j.paid?'done':''}" title="點一下標記「已收款」"></div>
        <div class="check-label ${j.paid?'paid':''}">收款</div>
      </div>
    </div>
    <div class="dot" style="background:${color}"></div>
    <div class="info">
      <div class="title">${escapeHtml(j.title || '（無標題）')}${estimateBadge}${tagBadge}${dueBadge}${subBadge}${discountBadge}${partialBadge}${writeOffBadge}${cancelBadge}</div>
      <div class="meta">${name} · ${j.date || '無日期'}</div>
    </div>
    <div class="amount">${fmt(finalAmt)}</div>
  </div>`;
}

// ============== Jobs Tab ==============
function renderJobs() {
  const fb = document.getElementById('job-filter');
  // 年/月階層式篩選：列出最近 5 年，點開後展開該年的月份
  const allMonths = [...new Set(state.jobs.map(j => getMonth(j.date)).filter(Boolean))].sort().reverse();
  const allYears = [...new Set(allMonths.map(m => m.slice(0,4)))].sort().reverse();
  const recentYears = allYears.slice(0, 5);  // 最近 5 年
  const expandedY = state.filters.expandedYear;
  // 月份篩選 chips（依展開年份顯示）
  const monthChips = expandedY ? allMonths.filter(m => m.startsWith(expandedY + '-')) : [];

  const statusOptions = [
    { v: 'all', label: '全部狀態' },
    { v: 'pending', label: '未完成' },
    { v: 'prepaid', label: '已收·待做' },
    { v: 'done-unpaid', label: '完成待收款' },
    { v: 'partial', label: '🔶 部分收款' },   // v2.9
    { v: 'paid', label: '已完成已收款' },
    { v: 'cancelled', label: '🚫 已取消' },
    { v: 'estimate', label: '📄 估價單' }
  ];
  const usedTags = getUsedTags();
  // 第一排：本月、全部、各年份
  const yearChips = `<button class="chip ${state.filters.month==='current'?'active':''}" onclick="setFilter('month','current')">本月</button>` +
    `<button class="chip ${state.filters.month==='all'?'active':''}" onclick="setFilter('month','all')">全部</button>` +
    recentYears.map(y => {
      const isExpanded = expandedY === y;
      const isActive = state.filters.month?.startsWith(y);
      return `<button class="chip ${isActive?'active':''}" onclick="toggleYearExpand('${y}')">${y} ${isExpanded?'▼':'▶'}</button>`;
    }).join('') +
    `<button class="chip ${state.filters.month==='custom-range'?'active':''}" onclick="openCustomMonthFilter()">📌 自訂範圍</button>`;

  // 第二排：展開的年份顯示其月份
  const monthSubChips = expandedY
    ? '<div style="display: flex; gap: 6px; flex-wrap: wrap; padding: 6px 0 0 24px;">' +
      monthChips.map(m => `<button class="chip ${state.filters.month===m?'active':''}" onclick="setFilter('month','${m}')">${m.slice(5)}月</button>`).join('') +
      '</div>'
    : '';

  // 自訂範圍 inline picker
  const customRangeUI = state.filters.month === 'custom-range'
    ? '<div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; padding: 6px 0 0 24px; font-size: 13px;">' +
      '<span style="color: var(--muted);">範圍：</span>' +
      `<input type="month" id="filter-month-from" value="${state.filters.monthFrom || ''}" onchange="applyMonthRangeFromInputs()" style="max-width: 140px;">` +
      '<span style="color: var(--muted);">~</span>' +
      `<input type="month" id="filter-month-to" value="${state.filters.monthTo || ''}" onchange="applyMonthRangeFromInputs()" style="max-width: 140px;">` +
      '</div>'
    : '';

  fb.innerHTML =
    '<div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">' +
      '<div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">' +
        '<span class="filter-bar-label">月份</span>' + yearChips +
      '</div>' +
      monthSubChips +
      customRangeUI +
      '<div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 4px;">' +
        '<span class="filter-bar-label">狀態</span>' +
        statusOptions.map(s => `<button class="chip ${state.filters.status===s.v?'active':''}" onclick="setFilter('status','${s.v}')">${s.label}</button>`).join('') +
      '</div>' +
      '<div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 4px;">' +
        '<span class="filter-bar-label">業主</span>' +
        `<button class="chip ${state.filters.clientId==='all'?'active':''}" onclick="setFilter('clientId','all')">全部</button>` +
        state.clients.map(c => `<button class="chip ${state.filters.clientId===c.id?'active':''}" onclick="setFilter('clientId','${c.id}')" style="${state.filters.clientId===c.id?'':'border-left: 3px solid '+c.color+';'}">${escapeHtml(c.name)}</button>`).join('') +
      '</div>' +
      (usedTags.length
        ? '<div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 4px;">' +
          '<span class="filter-bar-label">類型</span>' +
          `<button class="chip ${state.filters.tag==='all'?'active':''}" onclick="setFilter('tag','all')">全部</button>` +
          usedTags.map(t => `<button class="chip ${state.filters.tag===t?'active':''}" onclick="setFilter('tag','${escapeHtml(t)}')">${escapeHtml(t)}</button>`).join('') +
          '</div>'
        : '') +
    '</div>';

  // v2.6: 估價單模式單獨檢視；其他狀態自動排除估價單
  let jobs;
  if (state.filters.status === 'estimate') {
    jobs = state.jobs.filter(j => j.isEstimate && !j.cancelled);
  } else {
    jobs = state.jobs.filter(j => !j.isEstimate);
  }

  // 提醒卡片帶來的鎖定篩選（最高優先）
  if (state.filters.jobIdsOnly) {
    jobs = jobs.filter(j => state.filters.jobIdsOnly.has(j.id));
  }

  const fm = state.filters.month;
  if (fm === 'current') jobs = jobs.filter(j => jobBelongMonth(j) === thisMonth());
  else if (fm === 'all') {/* 不過濾 */}
  else if (fm === 'custom-range' && state.filters.monthFrom && state.filters.monthTo) {
    const lo = state.filters.monthFrom, hi = state.filters.monthTo;
    jobs = jobs.filter(j => {
      const m = jobBelongMonth(j);
      return m >= lo && m <= hi;
    });
  }
  else if (fm && /^\d{4}$/.test(fm)) {
    // 整年
    jobs = jobs.filter(j => jobBelongMonth(j).startsWith(fm + '-'));
  }
  else if (fm) jobs = jobs.filter(j => jobBelongMonth(j) === fm);
  if (state.filters.clientId !== 'all') jobs = jobs.filter(j => j.clientId === state.filters.clientId);
  // 'estimate' 狀態已在前面用 isEstimate 篩過了，'partial' 用 paymentTotal 判斷
  if (state.filters.status === 'partial') {
    jobs = jobs.filter(j => !j.cancelled && !j.isEstimate && jobPaidTotal(j) > 0 && !jobIsFullyPaid(j));
  } else if (state.filters.status !== 'all' && state.filters.status !== 'estimate') {
    jobs = jobs.filter(j => jobStatus(j) === state.filters.status);
  }
  // v3.14.0：filter.tag 比對 j.tags[] 跟舊 j.tag 字串都算 hit
  if (state.filters.tag && state.filters.tag !== 'all') {
    const ft = state.filters.tag;
    jobs = jobs.filter(j => {
      const t = Array.isArray(j.tags) ? j.tags : [];
      return t.includes(ft) || j.tag === ft;
    });
  }
  jobs.sort((a,b) => (b.date||'').localeCompare(a.date||''));

  const container = document.getElementById('jobs-list');
  if (!jobs.length) { container.innerHTML = emptyState('沒有符合條件的案件', '換個篩選或新增一筆'); return; }
  // 計算合計時排除取消案件
  const activeInList = jobs.filter(j => !j.cancelled);
  // v2.9: 用 finalAmount + paymentTotal 計算
  const total = activeInList.reduce((s,j) => s + jobFinalAmount(j), 0);
  const paidTotal = activeInList.reduce((s,j) => s + jobPaidTotal(j), 0);
  const unpaidTotal = activeInList.filter(j => j.done).reduce((s,j) => s + jobUnpaidAmount(j), 0);
  const cancelledCount = jobs.filter(j => j.cancelled).length;
  // 鎖定篩選 banner
  const lockBanner = state.filters.jobIdsOnly
    ? `<div style="padding: 8px 12px; background: var(--warning-light); border-radius: 8px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px; font-size: 13px;">
        <span style="flex: 1;">📌 ${escapeHtml(state.filters.jobIdsOnlyLabel || '篩選中')}</span>
        <button class="btn btn-outline btn-sm" onclick="clearJobsLock()">✕ 清除</button>
       </div>`
    : '';

  // v3.21.0：依視圖選對應 render
  let jobsHtml = '';
  const summaryHtml = `<div style="padding: 8px 0 12px; border-bottom: 1px solid var(--border); font-size: 12px; color: var(--muted);">
       共 ${jobs.length} 筆${cancelledCount ? `（含 ${cancelledCount} 筆已取消）` : ''}　已收 <b style="color:var(--success)">${fmt(paidTotal)}</b>
       ${unpaidTotal ? `· 待收 <b style="color:var(--warning)">${fmt(unpaidTotal)}</b>` : ''}
       · 計入統計 ${fmt(total)}
     </div>`;

  if (jobsView === 'board') {
    // 看板獨立 render
    container.innerHTML = lockBanner + summaryHtml;
    applyJobsView();
    renderJobsBoard(jobs);
    return;
  }

  if (jobsView === 'table') {
    jobsHtml = renderJobsTable(jobs);
  } else if (jobsView === 'card') {
    jobsHtml = `<div class="jobs-card-grid">${jobs.map(j => jobRowCard(j)).join('')}</div>`;
  } else if (jobsView === 'compact') {
    // 緊湊列表，分組可用
    if (jobsGroupBy !== 'none') jobsHtml = renderJobsGrouped(jobs, 'compact');
    else jobsHtml = jobs.map(j => jobRowCompact(j)).join('');
  } else {
    // comfort（完整列表，現況），分組可用
    if (jobsGroupBy !== 'none') jobsHtml = renderJobsGrouped(jobs);
    else jobsHtml = jobs.map(jobRow).join('');
  }

  container.innerHTML = lockBanner + summaryHtml + jobsHtml;
  applyJobsView();
}

// v3.18.0：依 jobsGroupBy 把 jobs 分組顯示（含 group header 跟小計）
// v3.21.0：density 參數支援 'comfort' / 'compact'
function renderJobsGrouped(jobs, density) {
  const rowFn = density === 'compact' ? jobRowCompact : jobRow;
  const groups = new Map();
  jobs.forEach(j => {
    let key, label;
    if (jobsGroupBy === 'date') {
      key = (j.date || '').slice(0, 7) || '無日期';
      label = key;
    } else if (jobsGroupBy === 'client') {
      const c = getClient(j.clientId);
      key = c ? c.id : '_none_';
      label = c ? c.name : '（無業主）';
    } else if (jobsGroupBy === 'status') {
      key = jobInvoiceCategory(j);
      const labelMap = {
        pending: '🔄 進行中',
        'done-unpaid': '$ 待收款',
        partial: '🔶 部分收款',
        paid: '✓ 已收款',
        prepaid: '已收·待做',
        cancelled: '🚫 已取消'
      };
      label = labelMap[key] || key;
    } else if (jobsGroupBy === 'tag') {
      const t = (Array.isArray(j.tags) && j.tags.length) ? j.tags[0] : (j.tag || '');
      key = t || '_notag_';
      label = t || '（無標籤）';
    }
    if (!groups.has(key)) groups.set(key, { label, items: [] });
    groups.get(key).items.push(j);
  });
  // 依 key 排序：日期模式用倒序（最新月在最上）
  let sortedKeys = [...groups.keys()];
  if (jobsGroupBy === 'date') {
    sortedKeys.sort((a, b) => (b || '').localeCompare(a || ''));
  } else if (jobsGroupBy === 'client') {
    sortedKeys.sort((a, b) => (groups.get(a).label || '').localeCompare(groups.get(b).label || '', 'zh-Hant'));
  } else if (jobsGroupBy === 'status') {
    const order = ['pending', 'done-unpaid', 'partial', 'prepaid', 'paid', 'cancelled'];
    sortedKeys.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  } else {
    sortedKeys.sort();
  }
  return sortedKeys.map(k => {
    const g = groups.get(k);
    const cnt = g.items.length;
    const sum = g.items.reduce((s, j) => s + jobFinalAmount(j), 0);
    return `<div class="jobs-group">
      <div class="jobs-group-head">
        <span class="jobs-group-label">${escapeHtml(g.label)}</span>
        <span class="jobs-group-meta">${cnt} 筆 · ${fmt(sum)}</span>
      </div>
      <div class="jobs-group-body">${g.items.map(rowFn).join('')}</div>
    </div>`;
  }).join('');
}

function onJobsGroupChange() {
  const sel = document.getElementById('jobs-group-by');
  if (!sel) return;
  jobsGroupBy = sel.value;
  try { localStorage.setItem(JOBS_GROUP_KEY, jobsGroupBy); } catch (_) {}
  renderJobs();
}

// ============== v3.21.0：緊湊 row（一行解決，密度提升 3 倍）==============
function jobRowCompact(j) {
  const c = getClient(j.clientId);
  const color = c ? c.color : '#ccc';
  const name = c ? c.name : '未指定';
  const status = jobStatus(j);
  const dateShort = (j.date || '').slice(5);  // 只顯示 MM-DD
  // 狀態 icon
  const statusIcon = j.cancelled ? '🚫' :
                     (status === 'paid' ? '✅' :
                     (status === 'done-unpaid' ? '$' :
                     (status === 'partial' ? '🔶' :
                     (status === 'prepaid' ? '✓ 待做' :
                     '🔄'))));

  // v3.24.12：批次模式
  if (bulkMode) {
    const isSelected = bulkSelected.has(j.id);
    return `<div class="row-compact state-${status}${isSelected ? ' selected' : ''}" data-job-id="${j.id}"
                onclick="toggleBulkSelect('${j.id}')">
      <div class="bulk-checkbox ${isSelected ? 'checked' : ''}" style="margin-right: 4px;"></div>
      <span class="row-compact-dot" style="background:${color}"></span>
      <span class="row-compact-date">${dateShort || '-'}</span>
      <span class="row-compact-title">${escapeHtml(j.title || '（無標題）')}</span>
      <span class="row-compact-client">· ${escapeHtml(name)}</span>
      <span class="row-compact-amount">${fmt(jobFinalAmount(j)).replace('NT$', '').trim()}</span>
      <span class="row-compact-status">${statusIcon}</span>
    </div>`;
  }

  return `<div class="row-compact state-${status}" data-job-id="${j.id}"
              onclick="editJob('${j.id}')"
              ontouchstart="onJobRowTouchStart(event, '${j.id}')"
              ontouchmove="onJobRowTouchMove(event)"
              ontouchend="onJobRowTouchEnd(event)"
              ontouchcancel="onJobRowTouchCancel()">
    <span class="row-compact-dot" style="background:${color}" onclick="event.stopPropagation(); viewClientDetail('${j.clientId}')" title="跳到該業主"></span>
    <span class="row-compact-date">${dateShort || '-'}</span>
    <span class="row-compact-title">${escapeHtml(j.title || '（無標題）')}</span>
    <span class="row-compact-client">· ${escapeHtml(name)}</span>
    <span class="row-compact-amount">${fmt(jobFinalAmount(j)).replace('NT$', '').trim()}</span>
    <span class="row-compact-status">${statusIcon}</span>
    <span class="row-quick-actions">
      <button onclick="event.stopPropagation(); toggleDone('${j.id}')" title="標完成">✓</button>
      <button onclick="event.stopPropagation(); togglePaid('${j.id}')" title="標收款">$</button>
    </span>
  </div>`;
}

// ============== v3.21.0：報表模式（spreadsheet 風）==============
function renderJobsTable(jobs) {
  if (!jobs.length) return '';
  // v3.24.12：加 bulkMode 支援 — 批次模式下每 row 顯示 checkbox cell + 整 row click 切選取
  const inBulk = bulkMode;
  const rows = jobs.map(j => {
    const c = getClient(j.clientId);
    const color = c ? c.color : '#ccc';
    const name = c ? c.name : '未指定';
    const status = jobStatus(j);
    const isSelected = bulkSelected.has(j.id);
    const statusBadge = j.cancelled ? '<span class="t-badge t-cancelled">🚫 已取消</span>' :
                        (status === 'paid' ? '<span class="t-badge t-paid">✅ 已收</span>' :
                        (status === 'done-unpaid' ? '<span class="t-badge t-unpaid">$ 待收</span>' :
                        (status === 'partial' ? '<span class="t-badge t-partial">🔶 部分</span>' :
                        (status === 'prepaid' ? '<span class="t-badge t-paid">✓ 待做</span>' :
                        '<span class="t-badge t-pending">🔄 進行中</span>'))));
    const tags = (Array.isArray(j.tags) && j.tags.length ? j.tags : (j.tag ? [j.tag] : []));
    const tagsHtml = tags.length ? tags.map(t => `<span class="t-tag">${escapeHtml(t)}</span>`).join('') : '<span class="t-empty">—</span>';

    // v3.24.12：批次模式 → 整 row click toggle、第一格放 checkbox、不顯示快速 action
    if (inBulk) {
      return `<tr data-job-id="${j.id}" class="${isSelected ? 'bulk-selected' : ''}"
                onclick="toggleBulkSelect('${j.id}')">
        <td class="t-bulk"><div class="bulk-checkbox ${isSelected ? 'checked' : ''}"></div></td>
        <td class="t-date">${j.date || '-'}</td>
        <td class="t-client">
          <span class="row-compact-dot" style="background:${color}; vertical-align:middle;"></span>
          ${escapeHtml(name)}
        </td>
        <td class="t-title">${escapeHtml(j.title || '（無標題）')}</td>
        <td class="t-tags">${tagsHtml}</td>
        <td class="t-amount">${fmt(jobFinalAmount(j))}</td>
        <td class="t-status">${statusBadge}</td>
      </tr>`;
    }

    return `<tr data-job-id="${j.id}"
              onclick="editJob('${j.id}')"
              ontouchstart="onJobRowTouchStart(event, '${j.id}')"
              ontouchmove="onJobRowTouchMove(event)"
              ontouchend="onJobRowTouchEnd(event)"
              ontouchcancel="onJobRowTouchCancel()">
      <td class="t-date">${j.date || '-'}</td>
      <td class="t-client" onclick="event.stopPropagation(); viewClientDetail('${j.clientId}')">
        <span class="row-compact-dot" style="background:${color}; vertical-align:middle;"></span>
        ${escapeHtml(name)}
      </td>
      <td class="t-title">${escapeHtml(j.title || '（無標題）')}</td>
      <td class="t-tags">${tagsHtml}</td>
      <td class="t-amount">${fmt(jobFinalAmount(j))}</td>
      <td class="t-status">${statusBadge}</td>
      <td class="t-actions" onclick="event.stopPropagation();">
        <button onclick="toggleDone('${j.id}')" title="標完成">✓</button>
        <button onclick="togglePaid('${j.id}')" title="標收款">$</button>
        <button onclick="editJob('${j.id}')" title="編輯">✏️</button>
      </td>
    </tr>`;
  }).join('');

  // 表頭：批次模式下換成 checkbox 欄 + 沒有 actions 欄
  const headerHtml = inBulk
    ? `<tr>
        <th class="t-bulk"></th>
        <th>日期</th>
        <th>業主</th>
        <th>標題</th>
        <th>標籤</th>
        <th class="t-amount">金額</th>
        <th>狀態</th>
      </tr>`
    : `<tr>
        <th>日期</th>
        <th>業主</th>
        <th>標題</th>
        <th>標籤</th>
        <th class="t-amount">金額</th>
        <th>狀態</th>
        <th></th>
      </tr>`;

  return `<table class="jobs-table${inBulk ? ' bulk-mode' : ''}">
    <thead>${headerHtml}</thead>
    <tbody>${rows}</tbody>
  </table>`;
}

// ============== v3.21.0：卡片視圖（grid 排列）==============
function jobRowCard(j) {
  const c = getClient(j.clientId);
  const color = c ? c.color : '#ccc';
  const name = c ? c.name : '未指定';
  const status = jobStatus(j);
  const tags = (Array.isArray(j.tags) && j.tags.length ? j.tags : (j.tag ? [j.tag] : []));

  // v3.24.12：批次模式
  if (bulkMode) {
    const isSelected = bulkSelected.has(j.id);
    return `<div class="job-card-tile state-${status}${isSelected ? ' selected' : ''}" data-job-id="${j.id}"
                onclick="toggleBulkSelect('${j.id}')">
      <div class="bulk-checkbox ${isSelected ? 'checked' : ''}" style="position: absolute; top: 8px; right: 8px;"></div>
      <div class="job-card-tile-head">
        <span class="row-compact-dot" style="background:${color}"></span>
        <span class="job-card-tile-date">${j.date || '-'}</span>
      </div>
      <div class="job-card-tile-title">${escapeHtml(j.title || '（無標題）')}</div>
      <div class="job-card-tile-client">${escapeHtml(name)}</div>
      ${tags.length ? `<div class="job-card-tile-tags">${tags.map(t => `<span class="tag-chip-mini">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      <div class="job-card-tile-bottom">
        <span class="job-card-tile-amount">${fmt(jobFinalAmount(j))}</span>
      </div>
    </div>`;
  }

  return `<div class="job-card-tile state-${status}" data-job-id="${j.id}"
              onclick="editJob('${j.id}')"
              ontouchstart="onJobRowTouchStart(event, '${j.id}')"
              ontouchmove="onJobRowTouchMove(event)"
              ontouchend="onJobRowTouchEnd(event)"
              ontouchcancel="onJobRowTouchCancel()">
    <div class="job-card-tile-head">
      <span class="row-compact-dot" style="background:${color}"></span>
      <span class="job-card-tile-date">${j.date || '-'}</span>
    </div>
    <div class="job-card-tile-title">${escapeHtml(j.title || '（無標題）')}</div>
    <div class="job-card-tile-client">${escapeHtml(name)}</div>
    ${tags.length ? `<div class="job-card-tile-tags">${tags.map(t => `<span class="tag-chip-mini">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    <div class="job-card-tile-bottom">
      <span class="job-card-tile-amount">${fmt(jobFinalAmount(j))}</span>
      <span class="row-quick-actions">
        <button onclick="event.stopPropagation(); toggleDone('${j.id}')" title="標完成">✓</button>
        <button onclick="event.stopPropagation(); togglePaid('${j.id}')" title="標收款">$</button>
      </span>
    </div>
  </div>`;
}

// ============== v3.13.0：案件分頁 視圖切換 + 看板 ==============
function setJobsView(view) {
  jobsView = view;
  try { localStorage.setItem(JOBS_VIEW_KEY, view); } catch (_) {}
  // 更新 toggle button 視覺
  document.querySelectorAll('#jobs-view-toggle button').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  renderJobs();
}

function applyJobsView() {
  const list = document.getElementById('jobs-list');
  const board = document.getElementById('jobs-board');
  // 看板模式 → 顯示 #jobs-board，其他都用 #jobs-list
  const isBoard = jobsView === 'board';
  if (list) list.classList.toggle('hidden', isBoard);
  if (board) board.classList.toggle('hidden', !isBoard);
  // 看板用拖曳取代批次、分組僅 list-like view 適用
  const bulkBtn = document.getElementById('bulk-toggle');
  if (bulkBtn) bulkBtn.style.display = isBoard ? 'none' : '';
  const groupCtl = document.getElementById('jobs-group-control');
  if (groupCtl) {
    // 只在 comfort / compact 顯示分組
    const supportsGroup = (jobsView === 'comfort' || jobsView === 'compact');
    groupCtl.style.display = supportsGroup ? '' : 'none';
  }
}

// 看板的 4 個 column：用 jobInvoiceCategory 分（與請款單統計一致的分類）
const BOARD_COLUMNS = [
  { key: 'pending',     title: '🔄 進行中',    desc: '未完成' },
  { key: 'done-unpaid', title: '$ 待收款',     desc: '已完成等收款' },
  { key: 'paid',        title: '✓ 已收款',    desc: '完整收齊' },
  { key: 'cancelled',   title: '🚫 已取消',    desc: '保留紀錄' }
];

function renderJobsBoard(jobs) {
  const box = document.getElementById('jobs-board');
  if (!box) return;
  // 把 jobs 依 invoice category 分組
  const groups = {};
  BOARD_COLUMNS.forEach(c => groups[c.key] = []);
  jobs.forEach(j => {
    let cat = jobInvoiceCategory(j);
    // partial / prepaid 都先收進「待收款」column（簡化）
    if (cat === 'partial') cat = 'done-unpaid';
    if (cat === 'prepaid') cat = 'paid';
    if (!groups[cat]) cat = 'pending';
    groups[cat].push(j);
  });
  box.innerHTML = `<div class="jobs-board-grid">${
    BOARD_COLUMNS.map(col => {
      const list = groups[col.key];
      const subTotal = list.reduce((s, j) => s + jobFinalAmount(j), 0);
      return `<div class="board-column" data-status="${col.key}"
                ondragover="onBoardDragOver(event)"
                ondragleave="onBoardDragLeave(event)"
                ondrop="onBoardDrop(event, '${col.key}')">
        <div class="board-column-head">
          <span class="board-column-title">${col.title}</span>
          <span class="board-column-count">${list.length}</span>
        </div>
        <div class="board-column-sub">${col.desc} · ${fmt(subTotal)}</div>
        <div class="board-column-cards">
          ${list.length ? list.map(j => boardCard(j)).join('')
            : '<div class="board-empty">拖案件到這裡</div>'}
        </div>
      </div>`;
    }).join('')
  }</div>`;
}

function boardCard(j) {
  const c = getClient(j.clientId);
  const color = c ? c.color : '#ccc';
  const name = c ? c.name : '未指定';
  const status = jobStatus(j);
  return `<div class="board-card state-${status}" draggable="true"
            data-job-id="${j.id}"
            ondragstart="onBoardDragStart(event, '${j.id}')"
            ondragend="onBoardDragEnd(event)"
            onclick="editJob('${j.id}')">
    <div class="board-card-row">
      <span class="board-card-dot" style="background:${color}"></span>
      <span class="board-card-title">${escapeHtml(j.title || '（無標題）')}</span>
    </div>
    <div class="board-card-meta">
      <span>${j.date || '-'}</span>
      <span class="board-card-amount">${fmt(jobFinalAmount(j))}</span>
    </div>
    <div class="board-card-client">${escapeHtml(name)}</div>
  </div>`;
}

let _boardDragJobId = null;

function onBoardDragStart(e, jobId) {
  _boardDragJobId = jobId;
  e.dataTransfer.effectAllowed = 'move';
  // Firefox 需要 setData 才會觸發 drag
  try { e.dataTransfer.setData('text/plain', jobId); } catch (_) {}
  e.currentTarget.classList.add('dragging');
}

function onBoardDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.board-column.drop-target').forEach(el => el.classList.remove('drop-target'));
  _boardDragJobId = null;
}

function onBoardDragOver(e) {
  e.preventDefault();  // 必須 preventDefault 才允許 drop
  e.dataTransfer.dropEffect = 'move';
  const col = e.currentTarget;
  if (col && !col.classList.contains('drop-target')) col.classList.add('drop-target');
}

function onBoardDragLeave(e) {
  // 只有在離開 column 邊界才移除（避免 hover 子元素時誤觸發）
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drop-target');
  }
}

function onBoardDrop(e, newStatus) {
  e.preventDefault();
  const col = e.currentTarget;
  col.classList.remove('drop-target');
  const jobId = _boardDragJobId;
  if (!jobId) return;
  const j = state.jobs.find(x => x.id === jobId);
  if (!j) return;
  const curStatus = jobInvoiceCategory(j);
  // 已經在該分類就不動
  if (curStatus === newStatus || (curStatus === 'partial' && newStatus === 'done-unpaid') || (curStatus === 'prepaid' && newStatus === 'paid')) {
    return;
  }
  // 依目標 column 套對應狀態變化
  if (newStatus === 'pending') {
    j.done = false;
    j.cancelled = false;
    j.doneAt = null;
  } else if (newStatus === 'done-unpaid') {
    j.done = true;
    j.cancelled = false;
    if (!j.doneAt) j.doneAt = todayStr();
    // 如果已經有 payment、把它清掉？保守起見不清，讓使用者自己處理
  } else if (newStatus === 'paid') {
    j.done = true;
    j.cancelled = false;
    if (!j.doneAt) j.doneAt = todayStr();
    // 直接補 1 筆 payment 把餘額收齊
    const final = jobFinalAmount(j);
    const paidTotal = jobPaidTotal(j);
    const remain = Math.max(0, final - paidTotal - (+j.writeOff || 0));
    if (remain > 0) {
      j.payments = j.payments || [];
      j.payments.push({
        id: uid(),
        date: todayStr(),
        amount: remain,
        note: '從看板拖曳標已收'
      });
    }
    recomputePaidStatus(j);
  } else if (newStatus === 'cancelled') {
    j.cancelled = true;
  }
  if (typeof logAction === 'function') {
    logAction('job-board-move', { jobId, from: curStatus, to: newStatus, title: j.title });
  }
  save();
  renderJobs();
  toast(`✓ 已移到「${BOARD_COLUMNS.find(c => c.key === newStatus)?.title || newStatus}」`, 2500);
}

// ============== Calendar Tab ==============

// ============== Calendar Tab ==============
function calPrev() { calCursor.setMonth(calCursor.getMonth()-1); renderCalendar(); }
function calNext() { calCursor.setMonth(calCursor.getMonth()+1); renderCalendar(); }
function calToday() { calCursor = new Date(); calCursor.setDate(1); renderCalendar(); }

function renderCalendar() {
  const y = calCursor.getFullYear();
  const m = calCursor.getMonth();
  document.getElementById('cal-title').textContent = `${y} 年 ${m+1} 月`;

  const first = new Date(y, m, 1);
  const firstDow = first.getDay(); // 0=日
  const lastDay = new Date(y, m+1, 0).getDate();
  const prevLast = new Date(y, m, 0).getDate();

  const cells = [];
  // 週標題
  ['日','一','二','三','四','五','六'].forEach((d,i) => {
    const cls = i===0?'sun':(i===6?'sat':'');
    cells.push(`<div class="cal-dow ${cls}">${d}</div>`);
  });

  // 前月填充
  for (let i = firstDow-1; i >= 0; i--) {
    cells.push(cellHtml(y, m-1, prevLast-i, true));
  }
  // 當月
  for (let d = 1; d <= lastDay; d++) {
    cells.push(cellHtml(y, m, d, false));
  }
  // 後月填充到 6 週
  const total = firstDow + lastDay;
  const need = Math.ceil(total/7)*7 - total;
  for (let d = 1; d <= need; d++) {
    cells.push(cellHtml(y, m+1, d, true));
  }

  document.getElementById('cal-grid').innerHTML = cells.join('');

  // 本月列表
  const mm = `${y}-${String(m+1).padStart(2,'0')}`;
  const monthJobs = state.jobs
    .filter(j => getMonth(j.date) === mm)
    .sort((a,b) => (a.date||'').localeCompare(b.date||''));
  // 未來 30 天清單
  const today = todayStr();
  const in30 = addDays(new Date(), 30);
  const upcoming = activeJobs()
    .filter(j => j.date && j.date >= today && j.date <= in30)
    .sort((a,b) => (a.date||'').localeCompare(b.date||''));
  const upBox = document.getElementById('cal-upcoming');
  if (upBox) {
    if (!upcoming.length) {
      upBox.innerHTML = '<div class="empty" style="padding: 24px;"><div style="font-size: 13px;">未來 30 天沒有排程</div></div>';
    } else {
      upBox.innerHTML = upcoming.map(j => {
        const c = getClient(j.clientId);
        const color = c ? c.color : '#ccc';
        const status = jobStatus(j);
        const badge = status === 'paid' ? '<span class="badge-status paid">✓ 已收款</span>' :
                      status === 'done-unpaid' ? '<span class="badge-status done-unpaid">$ 待收款</span>' :
                      '<span class="badge-status pending">進行中</span>';
        const dayDelta = daysBetween(today, j.date);
        const dayLabel = dayDelta === 0 ? '今天' : dayDelta === 1 ? '明天' : `${dayDelta}天後`;
        return `<div class="cal-list-row" onclick="editJob('${j.id}')">
          <div class="cal-list-date" style="font-weight: 600; color: ${dayDelta <= 3 ? 'var(--warning)' : 'var(--muted)'};">${j.date.slice(5)} (${dayLabel})</div>
          <div class="dot" style="background:${color}; width: 8px; height: 8px;"></div>
          <div style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(j.title)}</div>
          ${badge}
          <div style="font-variant-numeric: tabular-nums; font-weight: 600; font-size: 13px;">${fmt(+j.amount||0)}</div>
        </div>`;
      }).join('');
    }
  }

  document.getElementById('cal-list-title').textContent = `${mm} 排程列表（${monthJobs.length} 筆）`;
  const listBox = document.getElementById('cal-list');
  if (!monthJobs.length) {
    listBox.innerHTML = emptyState('本月沒有案件', '');
  } else {
    listBox.innerHTML = monthJobs.map(j => {
      const c = getClient(j.clientId);
      const color = c ? c.color : '#ccc';
      const status = jobStatus(j);
      const badge = status === 'paid' ? '<span class="badge-status paid">✓ 已收款</span>' :
                    status === 'done-unpaid' ? '<span class="badge-status done-unpaid">$ 待收款</span>' :
                    '<span class="badge-status pending">進行中</span>';
      return `<div class="cal-list-row" onclick="editJob('${j.id}')">
        <div class="cal-list-date">${(j.date||'').slice(5)}</div>
        <div class="dot" style="background:${color}; width: 8px; height: 8px;"></div>
        <div style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(j.title)}</div>
        ${badge}
        <div style="font-variant-numeric: tabular-nums; font-weight: 600; font-size: 13px;">${fmt(+j.amount||0)}</div>
      </div>`;
    }).join('');
  }
}

function cellHtml(y, m, d, isOther) {
  const dateNorm = new Date(y, m, d);
  // 用 local 日期格式而非 toISOString（避免時區問題）
  const ds = `${dateNorm.getFullYear()}-${String(dateNorm.getMonth()+1).padStart(2,'0')}-${String(dateNorm.getDate()).padStart(2,'0')}`;
  const isToday = ds === todayStr();
  const dow = dateNorm.getDay();
  const dowCls = dow===0?'sun':(dow===6?'sat':'');
  // 該天案件：startDate == ds，或 startDate <= ds <= endDate（跨天）
  const jobs = state.jobs.filter(j => {
    if (j.cancelled) return false;
    if (j.date === ds) return true;
    if (j.endDate && j.date && j.date <= ds && ds <= j.endDate) return true;
    return false;
  });
  const maxShow = 3;
  const chips = jobs.slice(0, maxShow).map(j => {
    const c = getClient(j.clientId);
    const bg = c ? c.color : '#999';
    const status = jobStatus(j);
    let cls = status === 'paid' ? 'paid' : (status === 'done-unpaid' ? 'done-unpaid' : (status === 'prepaid' ? 'prepaid' : ''));
    // 跨天案件加 spans class
    const isSpan = j.endDate && j.date && j.endDate !== j.date && ds !== j.date;
    if (isSpan) cls += ' spans';
    // v3.19.0：拖曳支援（純單天案件才支援，跨天案件 spans cell 不允許拖避免歧義）
    const dragAttrs = isSpan ? '' : `draggable="true" ondragstart="onCalChipDragStart(event, '${j.id}')" ondragend="onCalChipDragEnd(event)"`;
    return `<div class="cal-chip ${cls}" style="background:${bg}" ${dragAttrs} onclick="event.stopPropagation(); editJob('${j.id}')" title="${escapeHtml(j.title)} · ${fmt(+j.amount||0)}${j.endDate?' · '+j.date+' ~ '+j.endDate:''}">${escapeHtml(j.title)}</div>`;
  }).join('');
  const more = jobs.length > maxShow ? `<div class="cal-more">+${jobs.length-maxShow}</div>` : '';
  const classes = ['cal-cell', dowCls, isOther?'other-month':'', isToday?'today':''].filter(Boolean).join(' ');
  // v3.19.0：cell 加 drop target
  return `<div class="${classes}" onclick="quickAddOnDate('${ds}')"
            ondragover="onCalCellDragOver(event)"
            ondragleave="onCalCellDragLeave(event)"
            ondrop="onCalCellDrop(event, '${ds}')"
            data-date="${ds}"><div class="cal-date">${d}</div>${chips}${more}</div>`;
}

// ============== v3.19.0：行事曆拖曳改日期 ==============
let _calDragJobId = null;

function onCalChipDragStart(e, jobId) {
  _calDragJobId = jobId;
  e.dataTransfer.effectAllowed = 'move';
  try { e.dataTransfer.setData('text/plain', jobId); } catch (_) {}
  e.currentTarget.classList.add('cal-chip-dragging');
  // 阻止 cell click 也被觸發
  e.stopPropagation();
}
function onCalChipDragEnd(e) {
  e.currentTarget.classList.remove('cal-chip-dragging');
  document.querySelectorAll('.cal-cell.cal-drop-target').forEach(el => el.classList.remove('cal-drop-target'));
  _calDragJobId = null;
}
function onCalCellDragOver(e) {
  if (!_calDragJobId) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const cell = e.currentTarget;
  if (!cell.classList.contains('cal-drop-target')) cell.classList.add('cal-drop-target');
}
function onCalCellDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('cal-drop-target');
  }
}
function onCalCellDrop(e, newDate) {
  e.preventDefault();
  e.stopPropagation();
  e.currentTarget.classList.remove('cal-drop-target');
  const jobId = _calDragJobId;
  if (!jobId) return;
  const j = state.jobs.find(x => x.id === jobId);
  if (!j) return;
  const oldDate = j.date;
  if (oldDate === newDate) return;
  pushUndoSnapshot(`案件「${j.title || ''}」改到 ${newDate}`);
  // 跨天案件：要同步移 endDate（保持期間長度）
  if (j.endDate && j.date) {
    const span = daysBetween(j.date, j.endDate);
    j.date = newDate;
    j.endDate = addDays(new Date(newDate), span);
  } else {
    j.date = newDate;
  }
  if (typeof logAction === 'function') logAction('job-cal-drag', { jobId, from: oldDate, to: newDate });
  save(); render();
}

function quickAddOnDate(ds) {
  // 點空白格子：快速在那天新增案件
  if (!state.clients.length) { toast('請先新增業主'); switchTab('clients'); openClientModal(); return; }
  openJobModal();
  document.getElementById('job-date').value = ds;
}

// ============== Clients Tab ==============
function toggleClientExpand(cid) {
  if (expandedClients.has(cid)) expandedClients.delete(cid);
  else expandedClients.add(cid);
  renderClients();
}

// 案件分頁年度展開
function toggleYearExpand(y) {
  // 清除提醒/業主排行帶來的鎖定篩選
  state.filters.jobIdsOnly = null;
  state.filters.jobIdsOnlyLabel = '';
  if (state.filters.expandedYear === y) {
    state.filters.expandedYear = null;
    if (state.filters.month?.startsWith(y)) state.filters.month = 'all';
  } else {
    state.filters.expandedYear = y;
    state.filters.month = y;  // 預設選整年
  }
  render();
}

function openCustomMonthFilter() {
  // 清除提醒/業主排行帶來的鎖定篩選
  state.filters.jobIdsOnly = null;
  state.filters.jobIdsOnlyLabel = '';
  // 切換顯示 inline picker
  state.filters.month = 'custom-range';
  state.filters.expandedYear = null;
  // 預設值
  if (!state.filters.monthFrom) state.filters.monthFrom = thisMonth();
  if (!state.filters.monthTo) state.filters.monthTo = thisMonth();
  render();
  // 等 render 後 focus 到 from
  setTimeout(() => document.getElementById('filter-month-from')?.focus(), 50);
}

// ============== v3.9.0：業主 detail 頁（CRM-lite）==============
function viewClientDetail(clientId) {
  detailClientId = clientId;
  document.getElementById('client-list-view')?.classList.add('hidden');
  document.getElementById('client-detail-view')?.classList.remove('hidden');
  renderClientDetail();
  // 滾到頂端
  document.getElementById('tab-clients')?.scrollIntoView({ block: 'start', behavior: 'instant' });
}

function closeClientDetail() {
  detailClientId = null;
  document.getElementById('client-detail-view')?.classList.add('hidden');
  document.getElementById('client-list-view')?.classList.remove('hidden');
  renderClients();
}

function editCurrentDetailClient() {
  if (detailClientId) editClient(detailClientId);
}

function addJobForCurrentClient() {
  if (!detailClientId) return;
  openJobModal();
  // 預選該業主
  setTimeout(() => {
    const sel = document.getElementById('job-client');
    if (sel) {
      sel.value = detailClientId;
      onJobClientChange();
    }
  }, 50);
}

function onClientContactChange() {
  if (!detailClientId) return;
  const c = getClient(detailClientId);
  if (!c) return;
  c.contact = c.contact || {};
  c.contact.person = document.getElementById('client-contact-person').value.trim();
  c.contact.phone = document.getElementById('client-contact-phone').value.trim();
  c.contact.email = document.getElementById('client-contact-email').value.trim();
  c.contact.address = document.getElementById('client-contact-address').value.trim();
  c.note = document.getElementById('client-contact-note').value.trim();
  save();
  // 顯示「已儲存」提示（淡入淡出）
  const hint = document.getElementById('client-contact-saved-hint');
  if (hint) {
    hint.style.opacity = '1';
    clearTimeout(window._contactSavedTimer);
    window._contactSavedTimer = setTimeout(() => { hint.style.opacity = '0'; }, 1500);
  }
}

function renderClientDetail() {
  const c = getClient(detailClientId);
  if (!c) { closeClientDetail(); return; }

  // Header
  document.getElementById('client-detail-name').textContent = c.name;
  const dot = document.getElementById('client-detail-color-dot');
  if (dot) dot.style.background = c.color || '#888';

  // 該業主所有案件（含取消）
  const allJobs = state.jobs.filter(j => j.clientId === c.id);
  const aJobs = allJobs.filter(j => !j.cancelled && !j.isEstimate);

  // 4 個 stat
  const totalAmt = aJobs.reduce((s, j) => s + jobFinalAmount(j), 0);
  const paidAmt = aJobs.reduce((s, j) => s + jobPaidTotal(j), 0);
  const unpaidAmt = aJobs.filter(j => j.done).reduce((s, j) => s + jobUnpaidAmount(j), 0);
  const unpaidCnt = aJobs.filter(j => j.done && !jobIsFullyPaid(j)).length;
  document.getElementById('client-detail-total').textContent = fmt(totalAmt);
  document.getElementById('client-detail-total-sub').textContent = `已收 ${fmt(paidAmt)}`;
  document.getElementById('client-detail-jobcount').textContent = aJobs.length;
  document.getElementById('client-detail-jobcount-sub').textContent = `共 ${allJobs.length} 筆（含取消）`;
  document.getElementById('client-detail-unpaid').textContent = fmt(unpaidAmt);
  document.getElementById('client-detail-unpaid-sub').textContent = `${unpaidCnt} 筆`;

  // 平均收款週期：所有完成且至少有一筆 payment 的案件，計算 doneAt → 第一筆 payment.date 的天數
  const cycles = [];
  aJobs.forEach(j => {
    if (!j.doneAt || !(j.payments || []).length) return;
    const firstPay = [...j.payments].filter(p => p.date).sort((a,b) => (a.date||'').localeCompare(b.date||''))[0];
    if (!firstPay) return;
    const days = daysBetween(j.doneAt, firstPay.date);
    if (days >= 0 && days <= 365) cycles.push(days);
  });
  if (cycles.length) {
    const avg = Math.round(cycles.reduce((a,b) => a+b, 0) / cycles.length);
    document.getElementById('client-detail-paycycle').textContent = avg + ' 天';
    document.getElementById('client-detail-paycycle-sub').textContent = `${cycles.length} 筆樣本`;
  } else {
    document.getElementById('client-detail-paycycle').textContent = '—';
    document.getElementById('client-detail-paycycle-sub').textContent = '尚無資料';
  }

  // Actionable insights
  renderClientInsights(c, aJobs, cycles);

  // 過去 12 個月 mini chart
  renderClientMiniChart(c, aJobs);

  // 通訊錄欄位
  const ct = c.contact || {};
  document.getElementById('client-contact-person').value = ct.person || '';
  document.getElementById('client-contact-phone').value = ct.phone || '';
  document.getElementById('client-contact-email').value = ct.email || '';
  document.getElementById('client-contact-address').value = ct.address || '';
  document.getElementById('client-contact-note').value = c.note || '';

  // v3.14.0：標籤
  renderClientTagsChips();
  refreshAllTagSuggestions();

  // 案件歷史時間軸
  renderClientJobsTimeline(c, allJobs);
  document.getElementById('client-detail-jobs-count').textContent = `(${allJobs.length} 筆，含取消)`;
}

function renderClientInsights(c, aJobs, cycles) {
  const box = document.getElementById('client-detail-insights');
  if (!box) return;
  const insights = [];

  // 1. 最近 90 天無新案件
  const lastDate = aJobs.map(j => j.date || '').filter(Boolean).sort().reverse()[0];
  if (lastDate) {
    const daysSinceLast = daysBetween(lastDate, todayStr());
    if (daysSinceLast >= 90) {
      insights.push({
        kind: 'warn',
        icon: '⏰',
        title: `已 ${daysSinceLast} 天沒有新案件`,
        desc: '可能該主動聯繫一下'
      });
    } else if (daysSinceLast >= 60) {
      insights.push({
        kind: 'info',
        icon: '📅',
        title: `${daysSinceLast} 天前最後一筆案件`,
        desc: ''
      });
    }
  } else if (aJobs.length === 0 && state.jobs.filter(j => j.clientId === c.id).length === 0) {
    insights.push({
      kind: 'info',
      icon: '👋',
      title: '還沒有任何案件',
      desc: '點上方「＋ 新增案件」開始'
    });
  }

  // 2. 拖款比較（該業主平均週期 vs 全體平均）
  if (cycles.length >= 2) {
    const myAvg = Math.round(cycles.reduce((a,b)=>a+b,0) / cycles.length);
    // 全體平均
    const allCycles = [];
    activeJobs().forEach(j => {
      if (!j.doneAt || !(j.payments||[]).length) return;
      const fp = [...j.payments].filter(p => p.date).sort((a,b) => (a.date||'').localeCompare(b.date||''))[0];
      if (!fp) return;
      const d = daysBetween(j.doneAt, fp.date);
      if (d >= 0 && d <= 365) allCycles.push(d);
    });
    if (allCycles.length >= 3) {
      const allAvg = Math.round(allCycles.reduce((a,b)=>a+b,0) / allCycles.length);
      const diff = myAvg - allAvg;
      if (diff >= 7) {
        insights.push({
          kind: 'warn',
          icon: '🐢',
          title: `平均拖款 ${myAvg} 天，比整體平均（${allAvg} 天）多 ${diff} 天`,
          desc: '請款時可考慮多催一次'
        });
      } else if (diff <= -5) {
        insights.push({
          kind: 'good',
          icon: '⚡',
          title: `平均收款 ${myAvg} 天，比整體平均（${allAvg} 天）快 ${-diff} 天`,
          desc: '優質客戶'
        });
      }
    }
  }

  // 3. 年度集中度（該業主佔今年總收入的比例）
  const yr = String(new Date().getFullYear());
  const myYearPaid = aJobs.reduce((s,j) => s + (j.payments||[]).filter(p => (p.date||'').startsWith(yr)).reduce((ss,p) => ss+(+p.amount||0), 0), 0);
  const allYearPaid = activeJobs().reduce((s,j) => s + (j.payments||[]).filter(p => (p.date||'').startsWith(yr)).reduce((ss,p) => ss+(+p.amount||0), 0), 0);
  if (allYearPaid > 0 && myYearPaid > 0) {
    const pct = Math.round(myYearPaid / allYearPaid * 100);
    if (pct >= 50) {
      insights.push({
        kind: 'warn',
        icon: '⚠️',
        title: `年度貢獻佔 ${pct}%`,
        desc: '收入過度集中於單一業主，建議擴展客源'
      });
    } else if (pct >= 30) {
      insights.push({
        kind: 'info',
        icon: '📊',
        title: `年度貢獻佔 ${pct}%`,
        desc: '主要客戶之一'
      });
    }
  }

  // 4. 待收餘額大時提醒
  const unpaidTotal = aJobs.filter(j => j.done).reduce((s,j) => s + jobUnpaidAmount(j), 0);
  if (unpaidTotal >= 50000) {
    insights.push({
      kind: 'warn',
      icon: '💰',
      title: `待收金額 ${fmt(unpaidTotal)}`,
      desc: '建議集中請款'
    });
  }

  if (!insights.length) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = '<div class="card client-insights-card">'
    + '<h3 style="font-size: 14px; margin-bottom: 10px;">💡 智慧分析</h3>'
    + insights.map(i => `
        <div class="client-insight client-insight--${i.kind}">
          <div class="client-insight-icon">${i.icon}</div>
          <div class="client-insight-body">
            <div class="client-insight-title">${escapeHtml(i.title)}</div>
            ${i.desc ? `<div class="client-insight-desc">${escapeHtml(i.desc)}</div>` : ''}
          </div>
        </div>`).join('')
    + '</div>';
}

function renderClientMiniChart(c, aJobs) {
  const svg = document.getElementById('client-detail-chart');
  if (!svg) return;
  const W = Math.max(svg.clientWidth || 600, 320);
  const H = 100;
  const margin = { top: 8, right: 12, bottom: 24, left: 36 };
  const chartW = W - margin.left - margin.right;
  const chartH = H - margin.top - margin.bottom;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  // 算過去 12 個月
  const now = new Date(); now.setDate(1);
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now); d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }
  const buckets = {};
  months.forEach(m => buckets[m] = { paid: 0, unpaid: 0 });
  aJobs.forEach(j => {
    (j.payments||[]).forEach(p => {
      const k = (p.date||'').slice(0,7);
      if (buckets[k]) buckets[k].paid += (+p.amount||0);
    });
    if (j.date) {
      const k = j.date.slice(0,7);
      if (buckets[k] && j.done) {
        buckets[k].unpaid += jobUnpaidAmount(j);
      }
    }
  });
  const data = months.map(m => ({ label: m, ...buckets[m] }));
  const max = Math.max(...data.map(d => d.paid + d.unpaid), 1);
  const niceMax = niceScale(max);
  const barGroupW = chartW / data.length;
  const barW = Math.min(barGroupW * 0.65, 24);

  const parts = [];
  // baseline
  parts.push(`<line x1="${margin.left}" y1="${margin.top + chartH}" x2="${W - margin.right}" y2="${margin.top + chartH}" stroke="#e4e6eb" stroke-width="1"/>`);
  // y-axis 一個 max 刻度
  parts.push(`<text x="${margin.left - 4}" y="${margin.top + 8}" text-anchor="end" fill="#8a8f98" font-size="9">${fmtShort(niceMax)}</text>`);
  parts.push(`<text x="${margin.left - 4}" y="${margin.top + chartH + 4}" text-anchor="end" fill="#8a8f98" font-size="9">0</text>`);
  data.forEach((d, i) => {
    const cx = margin.left + i * barGroupW + barGroupW / 2;
    const bx = cx - barW / 2;
    let y = margin.top + chartH;
    if (d.paid > 0) {
      const h = d.paid / niceMax * chartH;
      y -= h;
      parts.push(`<rect x="${bx}" y="${y}" width="${barW}" height="${h}" fill="#10b981" rx="2"><title>${d.label}　已收 ${fmt(d.paid)}</title></rect>`);
    }
    if (d.unpaid > 0) {
      const h = d.unpaid / niceMax * chartH;
      y -= h;
      parts.push(`<rect x="${bx}" y="${y}" width="${barW}" height="${h}" fill="#f59e0b" rx="2"><title>${d.label}　待收 ${fmt(d.unpaid)}</title></rect>`);
    }
    // 每隔 2 個月顯示一次月份標籤（避免擠）
    if (i % 2 === 0 || i === data.length - 1) {
      parts.push(`<text x="${cx}" y="${H - 8}" text-anchor="middle" fill="#8a8f98" font-size="9">${d.label.slice(5)}</text>`);
    }
  });
  svg.innerHTML = parts.join('');
}

function renderClientJobsTimeline(c, allJobs) {
  const box = document.getElementById('client-detail-jobs-timeline');
  if (!box) return;
  if (!allJobs.length) {
    box.innerHTML = '<div class="reminder-hint" style="text-align: center; padding: 20px;">這位業主還沒有任何案件</div>';
    return;
  }
  // 依日期倒序
  const sorted = [...allJobs].sort((a,b) => (b.date||'').localeCompare(a.date||''));
  // 用既有的 jobRow 渲染（單一風格、可點擊編輯）
  box.innerHTML = sorted.map(j => jobRow(j, 'detail')).join('');
}
// /v3.9.0 業主 detail

function applyMonthRangeFromInputs() {
  const from = document.getElementById('filter-month-from')?.value;
  const to = document.getElementById('filter-month-to')?.value;
  if (!from || !to) return;
  // 清除提醒/業主排行帶來的鎖定篩選
  state.filters.jobIdsOnly = null;
  state.filters.jobIdsOnlyLabel = '';
  state.filters.monthFrom = from <= to ? from : to;
  state.filters.monthTo = from <= to ? to : from;
  render();
}

function renderClients() {
  const container = document.getElementById('clients-list');
  if (!state.clients.length) { container.innerHTML = emptyState('還沒有業主', '點右下角 + 新增第一個業主'); return; }

  // 搜尋詞
  const searchEl = document.getElementById('client-search');
  const q = (searchEl?.value || '').trim().toLowerCase();
  // 排序模式
  const sortEl = document.getElementById('client-sort');
  const sortMode = sortEl?.value || 'recent';

  // 為每個業主計算統計與排序鍵
  let list = state.clients.map(c => {
    const clientJobs = activeJobs().filter(j => j.clientId === c.id);
    const totalAmt = clientJobs.reduce((s,j) => s + jobFinalAmount(j), 0);
    const unpaidAmt = clientJobs.filter(j => j.done).reduce((s,j) => s + jobUnpaidAmount(j), 0);
    const lastDate = clientJobs.map(j => j.date || '').sort().reverse()[0] || '';
    return { client: c, totalAmt, unpaidAmt, lastDate };
  });

  // 搜尋過濾
  if (q) list = list.filter(x => x.client.name.toLowerCase().includes(q) || (x.client.note||'').toLowerCase().includes(q));

  // 排序
  if (sortMode === 'name') list.sort((a,b) => a.client.name.localeCompare(b.client.name, 'zh-TW'));
  else if (sortMode === 'total') list.sort((a,b) => b.totalAmt - a.totalAmt);
  else if (sortMode === 'unpaid') list.sort((a,b) => b.unpaidAmt - a.unpaidAmt);
  else list.sort((a,b) => (b.lastDate || '').localeCompare(a.lastDate || ''));  // recent

  if (!list.length) {
    container.innerHTML = emptyState('沒有符合條件的業主', '換個搜尋詞');
    return;
  }

  container.innerHTML = list.map(({client: c}) => {
    const clientJobs = activeJobs().filter(j => j.clientId === c.id);
    const m = thisMonth();
    const mJobs = clientJobs.filter(j => jobBelongMonth(j) === m);
    // v2.9: 已收用 payment.date 在本月的金額；待收用 jobUnpaidAmount
    const mPaid = clientJobs.reduce((s,j) => s + (j.payments || []).filter(p => getMonth(p.date) === m).reduce((ss,p) => ss + (+p.amount||0), 0), 0);
    const mUnpaid = mJobs.filter(j => j.done).reduce((s,j) => s + jobUnpaidAmount(j), 0);
    const allUnpaid = clientJobs.filter(j => j.done).reduce((s,j) => s + jobUnpaidAmount(j), 0);
    // 分潤資訊
    const introducer = c.commissionTo ? state.clients.find(x => x.id === c.commissionTo) : null;
    // v3.14.0：tags badges
    const tagsHtml = (c.tags || []).length
      ? '<span class="client-tag-badges">' + c.tags.map(t => `<span class="tag-chip-mini">${escapeHtml(t)}</span>`).join('') + '</span>'
      : '';
    const commissionInfo = (c.commissionRate > 0 && introducer)
      ? `<span class="commission-info">介紹人 ${escapeHtml(introducer.name)} · 抽成 ${c.commissionRate}%</span>`
      : '';

    // 儲值制餘額
    const bal = clientBalance(c.id);
    let balanceBadge = '';
    if (bal) {
      const cls = bal.balance < 0 ? 'empty' : (bal.balance < 1000 ? 'low' : '');
      balanceBadge = `<span class="prepaid-badge ${cls}" title="累計儲值 ${fmt(bal.total)} - 已用 ${fmt(bal.used)}">💰 餘額 ${fmt(bal.balance)}</span>`;
    }
    // 活躍度時間軸（v2.10.3 隱藏）
    const timelineHtml = '';

    const isExpanded = expandedClients.has(c.id);
    const expandIcon = isExpanded ? '▼' : '▶';

    // 健康度指標（v2.10.3 隱藏）
    const healthBadge = '';

    // 展開時顯示該業主的案件清單（最近 50 筆，健康度詳情已隱藏）
    let expandedJobsHtml = '';
    if (isExpanded) {
      expandedJobsHtml = `<div style="margin-top: 10px; padding: 12px; background: var(--bg); border-radius: 8px;">`;
      const recent = clientJobs.slice().sort((a,b) => (b.date||'').localeCompare(a.date||'')).slice(0, 50);
      expandedJobsHtml += `
        <div style="font-size: 12px; color: var(--muted); margin-bottom: 6px;">
          最近 ${recent.length} 筆（共 ${clientJobs.length} 筆）
        </div>
        ${recent.map(j => {
          const status = jobStatus(j);
          const statusBadge = status === 'paid' ? '<span class="badge-status paid">✓已收</span>' :
                              status === 'prepaid' ? '<span class="badge-status paid">已收·待做</span>' :
                              status === 'done-unpaid' ? '<span class="badge-status done-unpaid">$待收</span>' :
                              '<span class="badge-status pending">進行中</span>';
          return `<div style="display: flex; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 13px;" onclick="event.stopPropagation(); editJob('${j.id}')">
            <span style="color: var(--muted); min-width: 80px; font-size: 12px;">${j.date || '-'}</span>
            <span style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;">${escapeHtml(j.title || '')}</span>
            ${statusBadge}
            <span style="font-variant-numeric: tabular-nums; font-weight: 600;">${fmt(+j.amount||0)}</span>
          </div>`;
        }).join('')}
      </div>`;
    }

    return `<div style="padding: 14px 0; border-bottom: 1px solid var(--border);">
      <div class="client-header">
        <span style="color: var(--muted); font-size: 12px; min-width: 16px; cursor: pointer;" onclick="toggleClientExpand('${c.id}')" title="展開 / 收合案件清單">${expandIcon}</span>
        <div class="dot" style="background:${c.color}; width: 12px; height: 12px;"></div>
        <!-- v3.9.0：業主名變可點 → 進詳細頁 -->
        <div class="client-name-link" style="font-weight: 600; flex: 1; cursor: pointer;" onclick="viewClientDetail('${c.id}')" title="點開詳細頁">
          ${escapeHtml(c.name)}
          ${tagsHtml}
          ${healthBadge}
          ${balanceBadge}
          ${allUnpaid > 0 && !c.prepaidMode ? `<span class="client-owes">待收 ${fmt(allUnpaid)}</span>` : ''}
          ${commissionInfo}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); viewClientDetail('${c.id}')">詳細 →</button>
      </div>
      <div style="font-size: 13px; color: var(--muted); margin-bottom: 4px; padding-left: 24px;">
        本月已收 ${fmt(mPaid)} · 待收 ${fmt(mUnpaid)} · 累計 ${clientJobs.length} 筆
      </div>
      ${timelineHtml}
      ${expandedJobsHtml}
      <div style="display:flex; gap: 6px; flex-wrap: wrap; margin-top: 8px;">
        <button class="btn btn-outline btn-sm" onclick="setFilter('clientId','${c.id}'); switchTab('jobs')">查看案件</button>
        <button class="btn btn-outline btn-sm" onclick="gotoInvoice('${c.id}')">產生請款單</button>
      </div>
    </div>`;
  }).join('');
}

// ============== Revenue Tab ==============
function setRevenueMode(mode) {
  revenueState.mode = mode;
  document.getElementById('rev-mode-month').classList.toggle('active', mode==='month');
  document.getElementById('rev-mode-year').classList.toggle('active', mode==='year');
  buildRangeOptions();
  renderRevenue();
}

// v3.5.0：Revenue 子分頁切換（總覽 / 趨勢 / 分析）
function switchRevenueSubtab(key) {
  document.querySelectorAll('.rev-subtabs button').forEach(b => {
    b.classList.toggle('active', b.dataset.subtab === key);
  });
  document.querySelectorAll('.rev-subtab-pane').forEach(p => {
    p.classList.toggle('hidden', p.dataset.subtab !== key);
  });
  // 切到趨勢/分析時，重繪該分頁的圖表（避免之前在 hidden 狀態時 SVG 寬度為 0）
  if (key === 'trend') {
    if (typeof renderPaymentTimeline === 'function') renderPaymentTimeline();
    if (typeof renderHeatmap === 'function') renderHeatmap();
    if (typeof renderBusyCycle === 'function') renderBusyCycle();
  } else if (key === 'analysis') {
    if (typeof renderTagPie === 'function') renderTagPie();
    if (typeof renderHourlyTrend === 'function') renderHourlyTrend();
  } else if (key === 'outsource') {
    // v3.24.0：外包對帳子分頁
    if (typeof renderOutsourceReport === 'function') renderOutsourceReport();
  }
}

// ============== v3.24.0：外包對帳子分頁 ==============
function renderOutsourceReport() {
  const sel = document.getElementById('outsource-month');
  const box = document.getElementById('outsource-report');
  if (!sel || !box) return;

  // 找出有外包的月份（jobBelongMonth）
  const allOutsourceJobs = state.jobs.filter(j => !j.cancelled && +j.outsourceCost > 0);
  const months = [...new Set(allOutsourceJobs.map(j => jobBelongMonth(j)).filter(Boolean))].sort().reverse();
  if (!months.length) {
    sel.innerHTML = '<option>—</option>';
    box.innerHTML = `<div class="empty" style="padding: 30px; text-align: center; color: var(--muted);">
      <div style="font-size: 38px; margin-bottom: 6px;">📦</div>
      <div style="font-size: 14px;">還沒有派外包的紀錄</div>
      <div style="font-size: 12px; margin-top: 4px;">在案件 modal 內展開「🤝 派發給外包」就會自動加入這裡</div>
    </div>`;
    return;
  }
  // v3.24.12：預設選「全部月份」（之前選 months[0] 會讓使用者一進來只看到當月，誤以為下拉壞掉）
  const cur = sel.value;
  sel.innerHTML = '<option value="all">全部月份</option>' + months.map(m => `<option value="${m}">${m}</option>`).join('');
  sel.value = cur && (cur === 'all' || months.includes(cur)) ? cur : 'all';

  const month = sel.value;
  const jobs = (month === 'all' ? allOutsourceJobs : allOutsourceJobs.filter(j => jobBelongMonth(j) === month))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // v3.24.12：加 banner 提示「下拉只列有派外包的月份」+ 當前範圍 / 總筆數
  const monthLabel = month === 'all' ? `全部 ${months.length} 個月` : month;
  const banner = `<div class="reminder-hint" style="margin-bottom: 8px; padding: 6px 10px; background: var(--card); border-left: 3px solid var(--primary); font-size: 12px;">
    📦 目前顯示：<b>${monthLabel}</b> · 共 ${jobs.length} 筆外包紀錄
    ${months.length === 1 ? '<br>💡 下拉只列出有派外包的月份，目前只有 1 個月有紀錄' : ''}
  </div>`;

  if (!jobs.length) {
    box.innerHTML = '<div class="empty" style="padding: 20px; text-align: center; color: var(--muted);">該月份沒有派外包紀錄</div>';
    return;
  }

  // 計算合計
  let totalGross = 0, totalOutsource = 0, totalNet = 0;
  // 依外包對象分組
  const byOutsourcer = {};
  jobs.forEach(j => {
    const final = jobFinalAmount(j);
    const outCost = +j.outsourceCost || 0;
    const net = jobNetAmount(j);
    totalGross += final;
    totalOutsource += outCost;
    totalNet += net;
    const key = (j.outsourceTo || '').trim() || '(未填名字)';
    if (!byOutsourcer[key]) byOutsourcer[key] = { count: 0, cost: 0 };
    byOutsourcer[key].count++;
    byOutsourcer[key].cost += outCost;
  });

  const fmtN = (v) => v < 0 ? `<span style="color: var(--danger);">−${fmt(-v)}</span>` : fmt(v);

  const tableRows = jobs.map(j => {
    const c = getClient(j.clientId);
    const cName = c ? c.name : '(已刪除)';
    const cColor = c ? c.color : '#ccc';
    const final = jobFinalAmount(j);
    const outCost = +j.outsourceCost || 0;
    const net = jobNetAmount(j);
    return `<tr>
      <td>${j.date || '-'}</td>
      <td>${escapeHtml(j.title || '(無標題)')}</td>
      <td><span style="display:inline-block;background:${cColor};width:8px;height:8px;border-radius:50%;margin-right:6px;"></span>${escapeHtml(cName)}</td>
      <td>${escapeHtml(j.outsourceTo || '(未填)')}</td>
      <td class="num">${fmt(final)}</td>
      <td class="num" style="color: var(--warning);">−${fmt(outCost)}</td>
      <td class="num"><b>${fmtN(net)}</b></td>
    </tr>`;
  }).join('');

  const groupRows = Object.entries(byOutsourcer)
    .sort((a, b) => b[1].cost - a[1].cost)
    .map(([name, r]) => `<tr>
      <td>${escapeHtml(name)}</td>
      <td class="num">${r.count}</td>
      <td class="num"><b>${fmt(r.cost)}</b></td>
    </tr>`).join('');

  box.innerHTML = `
    ${banner}
    <div style="overflow-x: auto; margin-bottom: 16px;">
      <table class="report-table">
        <thead><tr>
          <th>日期</th><th>案件</th><th>業主</th><th>外包對象</th>
          <th class="num">業主應付</th><th class="num">外包成本</th><th class="num">我實收</th>
        </tr></thead>
        <tbody>
          ${tableRows}
          <tr class="report-total">
            <td colspan="4">合計（${jobs.length} 筆）</td>
            <td class="num">${fmt(totalGross)}</td>
            <td class="num" style="color: var(--warning);">−${fmt(totalOutsource)}</td>
            <td class="num">${fmtN(totalNet)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="card" style="margin-top: 12px; padding: 12px;">
      <h4 style="font-size: 13px; margin-bottom: 8px;">依外包對象彙整</h4>
      <table class="report-table">
        <thead><tr><th>外包對象</th><th class="num">案件數</th><th class="num">給的總額</th></tr></thead>
        <tbody>${groupRows}</tbody>
      </table>
    </div>
  `;
}

function exportOutsourceCSV() {
  const sel = document.getElementById('outsource-month');
  if (!sel) return;
  const month = sel.value;
  const allJobs = state.jobs.filter(j => !j.cancelled && +j.outsourceCost > 0);
  const jobs = (month === 'all' ? allJobs : allJobs.filter(j => jobBelongMonth(j) === month))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (!jobs.length) { toast('該月份沒有外包資料'); return; }

  const headers = ['日期', '案件', '業主', '外包對象', '業主應付', '外包成本', '我實收'];
  const rows = jobs.map(j => {
    const c = getClient(j.clientId);
    return [
      j.date || '',
      (j.title || '').replace(/"/g, '""'),
      c ? c.name : '(已刪除)',
      (j.outsourceTo || '').replace(/"/g, '""'),
      jobFinalAmount(j),
      +j.outsourceCost || 0,
      jobNetAmount(j),
    ];
  });
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `外包對帳-${month === 'all' ? '全部' : month}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('✓ 已匯出 CSV');
}

// 動態產生範圍選單
function buildRangeOptions() {
  const rangeSel = document.getElementById('rev-range');
  if (!rangeSel) return;
  let html = '';
  if (revenueState.mode === 'year') {
    const thisY = new Date().getFullYear();
    const startY = thisY - 4;
    html += `<option value="5" selected>📅 近五年</option>`;
    html += '<option disabled>── 單一年度 ──</option>';
    for (let y = thisY; y >= startY; y--) {
      html += `<option value="year-${y}">${y}</option>`;
    }
    html += '<option disabled>──────────</option>';
    html += `<option value="ytd">📅 ${thisY} 至今</option>`;
    html += '<option value="all">全部歷史</option>';
    html += '<option value="custom">📌 自訂年份範圍</option>';
    revenueState.range = '5';
  } else {
    // v3.24.10：加「當月」「上個月」快捷選項（最常用，放最前）
    html += '<option value="this-month">📅 當月</option>';
    html += '<option value="last-month">📅 上個月</option>';
    html += '<option disabled>──────────</option>';
    html += '<option value="3">最近 3 個月</option>';
    html += '<option value="6" selected>最近 6 個月</option>';
    html += '<option value="12">最近 12 個月</option>';
    html += '<option value="24">最近 24 個月</option>';
    html += '<option value="all">全部</option>';
    html += '<option disabled>──────────</option>';
    html += '<option value="custom">自訂月份範圍</option>';
    revenueState.range = '6';
  }
  rangeSel.innerHTML = html;
  document.getElementById('rev-custom-month')?.classList.add('hidden');
  document.getElementById('rev-custom-year')?.classList.add('hidden');
}

function onRangeChange() {
  const v = document.getElementById('rev-range').value;
  revenueState.range = v;
  // 顯示/隱藏自訂欄位
  const cm = document.getElementById('rev-custom-month');
  const cy = document.getElementById('rev-custom-year');
  cm?.classList.add('hidden');
  cy?.classList.add('hidden');
  if (v === 'custom') {
    if (revenueState.mode === 'month') {
      cm?.classList.remove('hidden');
      // 預設值
      const fromEl = document.getElementById('rev-from-month');
      const toEl = document.getElementById('rev-to-month');
      if (!fromEl.value) {
        const allMonths = [...new Set(state.jobs.map(j => getMonth(j.date)).filter(Boolean))].sort();
        if (allMonths.length) fromEl.value = allMonths[0];
        else fromEl.value = thisMonth();
      }
      if (!toEl.value) toEl.value = thisMonth();
    } else {
      cy?.classList.remove('hidden');
      const fromEl = document.getElementById('rev-from-year');
      const toEl = document.getElementById('rev-to-year');
      if (!fromEl.value) {
        const allYears = [...new Set(state.jobs.map(j => (j.date||'').slice(0,4)).filter(Boolean))].sort();
        if (allYears.length) fromEl.value = allYears[0];
        else fromEl.value = new Date().getFullYear();
      }
      if (!toEl.value) toEl.value = new Date().getFullYear();
    }
  }
  renderRevenue();
}

function renderRevenue() {
  // 填充業主下拉
  const cSel = document.getElementById('rev-client');
  if (cSel) {
    const cur = cSel.value || 'all';
    cSel.innerHTML =
      '<option value="all">全部業主</option>' +
      state.clients.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    cSel.value = state.clients.find(c => c.id === cur) ? cur : 'all';
    revenueState.clientId = cSel.value;
  }

  const rangeSel = document.getElementById('rev-range');
  if (rangeSel) {
    revenueState.range = rangeSel.value;
  }

  // 過濾業主，並排除取消的案件
  let jobs = activeJobs();
  if (revenueState.clientId !== 'all') jobs = jobs.filter(j => j.clientId === revenueState.clientId);

  // v3.22.6：改成 job-centric — 一律按案件所屬月（jobBelongMonth = endDate || date）歸月
  // 「選 4 月就只看 4 月的案子」：4 月案件的已收 / 待收 / 進行中都歸 4 月，不論 payment 日期落哪
  // 這跟下方「月度業主彙整」(jobBelongMonth) 對齊，不再出現兩個 widget 數字打架
  const buckets = {};
  // v3.24.3：bucket 加 gross（原始金額 j.amount sum）+ netAmount（jobNetAmount sum，扣完一切）
  const ensureKey = (k) => { if (!buckets[k]) buckets[k] = { paid: 0, unpaid: 0, pending: 0, gross: 0, netAmount: 0 }; };

  jobs.forEach(j => {
    const belongDate = j.endDate || j.date;
    if (!belongDate) return;
    const key = revenueState.mode === 'year' ? belongDate.slice(0,4) : belongDate.slice(0,7);
    ensureKey(key);
    // 已收：該案件所有 payment 加總
    buckets[key].paid += jobPaidTotal(j);
    // 待收 / 進行中：未收餘額（已扣折扣 + 已收 + 呆帳）
    const unpaidAmt = jobUnpaidAmount(j);
    if (unpaidAmt > 0) {
      if (j.done) buckets[key].unpaid += unpaidAmt;
      else buckets[key].pending += unpaidAmt;
    }
    // v3.24.8：帳面 = 給業主請款（折扣後 jobFinalAmount，跟「月度業主彙整」的「請款金額」對齊）
    //          實際 = jobNetAmount（扣稅 + 分潤 + 外包後我口袋實得）
    buckets[key].gross += jobFinalAmount(j);
    buckets[key].netAmount += jobNetAmount(j);
  });

  let keys = Object.keys(buckets).sort();
  if (!keys.length) keys = [revenueState.mode==='year' ? String(new Date().getFullYear()) : thisMonth()];

  // 補齊空月/空年
  const filled = fillEmptyBuckets(keys, revenueState.mode);
  filled.forEach(k => { if (!buckets[k]) buckets[k] = { paid: 0, unpaid: 0, pending: 0, gross: 0, netAmount: 0 }; });

  // 依 range 決定顯示範圍
  const r = String(revenueState.range);
  let displayKeys = filled;

  if (r === 'this-month') {
    // v3.24.10：當月（月度模式才有意義；年度模式 fallback 到當年）
    if (revenueState.mode === 'month') {
      const ym = thisMonth();
      displayKeys = [ym];
      if (!buckets[ym]) buckets[ym] = { paid: 0, unpaid: 0, pending: 0, gross: 0, netAmount: 0 };
    } else {
      const y = String(new Date().getFullYear());
      displayKeys = [y];
      if (!buckets[y]) buckets[y] = { paid: 0, unpaid: 0, pending: 0, gross: 0, netAmount: 0 };
    }
  } else if (r === 'last-month') {
    // v3.24.10：上個月（月度模式才有意義；年度模式 fallback 到去年）
    if (revenueState.mode === 'month') {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      displayKeys = [ym];
      if (!buckets[ym]) buckets[ym] = { paid: 0, unpaid: 0, pending: 0, gross: 0, netAmount: 0 };
    } else {
      const y = String(new Date().getFullYear() - 1);
      displayKeys = [y];
      if (!buckets[y]) buckets[y] = { paid: 0, unpaid: 0, pending: 0, gross: 0, netAmount: 0 };
    }
  } else if (r === 'all') {
    displayKeys = filled;
  } else if (r === 'ytd') {
    // 今年至今：年度模式才有此選項
    const y = String(new Date().getFullYear());
    displayKeys = filled.filter(k => k === y);
    if (!buckets[y]) buckets[y] = { paid: 0, unpaid: 0, pending: 0, gross: 0, netAmount: 0 };
    if (!displayKeys.length) displayKeys = [y];
  } else if (r.startsWith('year-')) {
    // 單一年度（年度模式）
    const y = r.slice(5);
    displayKeys = [y];
    if (!buckets[y]) buckets[y] = { paid: 0, unpaid: 0, pending: 0, gross: 0, netAmount: 0 };
  } else if (r === 'custom') {
    // 自訂範圍
    if (revenueState.mode === 'month') {
      const from = document.getElementById('rev-from-month')?.value || filled[0];
      const to = document.getElementById('rev-to-month')?.value || filled[filled.length-1];
      const lo = from <= to ? from : to;
      const hi = from <= to ? to : from;
      displayKeys = filled.filter(k => k >= lo && k <= hi);
    } else {
      const from = document.getElementById('rev-from-year')?.value || filled[0];
      const to = document.getElementById('rev-to-year')?.value || filled[filled.length-1];
      const lo = +from <= +to ? +from : +to;
      const hi = +from <= +to ? +to : +from;
      displayKeys = filled.filter(k => +k >= lo && +k <= hi);
    }
  } else {
    // 數字 = 最近 N 個
    const n = +r;
    if (n > 0) {
      // 年度模式：固定取「截至當年」的最近 N 年（不超過今年）
      if (revenueState.mode === 'year') {
        const thisY = new Date().getFullYear();
        const wantedYears = [];
        for (let y = thisY - n + 1; y <= thisY; y++) wantedYears.push(String(y));
        // filled 中存在的部分，加上當年（即使沒資料也顯示）
        displayKeys = wantedYears;
        // 確保 buckets 有當年（沒就建空的）
        wantedYears.forEach(y => { if (!buckets[y]) buckets[y] = { paid: 0, unpaid: 0, pending: 0, gross: 0, netAmount: 0 }; });
      } else {
        // v3.22.4 修：以「當月」為終點往前推 N 個月（保證一定含當月，即使當月沒任何 payment / 案件）
        // 舊版 filled.slice(-n) 是「有資料的最近 N 個月」，當月若沒任何資料就會被漏掉
        const today = new Date();
        const wantedMonths = [];
        for (let i = n - 1; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          wantedMonths.push(k);
          if (!buckets[k]) buckets[k] = { paid: 0, unpaid: 0, pending: 0, gross: 0, netAmount: 0 };
        }
        displayKeys = wantedMonths;
      }
    }
  }

  const data = displayKeys.map(k => ({ label: k, ...buckets[k] }));

  // 「今年至今」模式下，把今年的 label 標註「至今」
  if (r === 'ytd' && revenueState.mode === 'year') {
    const thisY = String(new Date().getFullYear());
    data.forEach(d => {
      if (d.label === thisY) d.label = `${thisY}（至今）`;
    });
  }
  // 單一年度模式：直接顯示年份（不需修改 label）

  // 標題
  const modeLabel = revenueState.mode === 'year' ? '年度' : '月度';
  document.getElementById('rev-chart-title').textContent = `${modeLabel}收益趨勢（${data.length} 期）`;

  // 摘要
  renderRevSummary(data);

  // 主圖表
  drawRevChart(data);

  // 業主貢獻排行
  renderClientRank(jobs, revenueState.range === 'all' ? null : displayKeys);

  // 新增的三張卡片
  renderTagPie();
  renderHeatmap();
  renderMonthlyReport();
  // v2.7
  renderBusyCycle();
  renderHourlyTrend();
  // v2.9: 收款時間軸
  renderPaymentTimeline();
  // v3.11.0: 達成率 + 智慧分析
  renderRevenueGoals();
  renderRevenueInsights();
}

// ============== v3.23.0：Mascot 小幫手 ==============
// 純 inline SVG（user 提供素材：Mascot/下載 (2).svg），純 CSS 動畫，零外部依賴。
// 觸發點：完成案件 / 收款 / 新增 / 達標 / 啟動有逾期 等 ~10 種事件。
// 防擾人：同類事件 30 秒內不重複觸發；對話框 5 秒自動消失。

// v3.23.1：新版素材 (Mascot/0949.svg)，多了「手臂」造型，更立體可愛
// 各部位加 id，未來方便用 CSS class 切換表情 / 狀態（idle/loading/thinking/success/error）
const MASCOT_SVG = `<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse cx="120" cy="200" rx="60" ry="12" fill="#000" opacity="0.08"/>
  <g id="robot">
    <rect id="body" x="50" y="80" width="140" height="110" rx="35" fill="#4F8EF7"/>
    <g id="antenna">
      <line x1="120" y1="40" x2="120" y2="80" stroke="#4F8EF7" stroke-width="6"/>
      <circle cx="120" cy="35" r="10" fill="#4F8EF7"/>
    </g>
    <rect id="face" x="70" y="95" width="100" height="70" rx="20" fill="#ffffff"/>
    <g id="eyes">
      <circle id="eyeL" cx="95" cy="125" r="10" fill="#1F2937"/>
      <circle id="eyeR" cx="145" cy="125" r="10" fill="#1F2937"/>
      <circle cx="92" cy="122" r="3" fill="#fff"/>
      <circle cx="142" cy="122" r="3" fill="#fff"/>
    </g>
    <path id="mouth" d="M90 145 Q120 160 150 145" stroke="#1F2937" stroke-width="4" fill="none" stroke-linecap="round"/>
    <g id="arms">
      <rect x="35" y="100" width="20" height="50" rx="10" fill="#4F8EF7"/>
      <rect x="185" y="100" width="20" height="50" rx="10" fill="#4F8EF7"/>
    </g>
    <g id="legs">
      <ellipse cx="90" cy="185" rx="18" ry="12" fill="#3B82F6"/>
      <ellipse cx="150" cy="185" rx="18" ry="12" fill="#3B82F6"/>
    </g>
    <g id="buttons">
      <circle cx="95" cy="165" r="6" fill="#34D399"/>
      <circle cx="120" cy="165" r="6" fill="#FBBF24"/>
      <circle cx="145" cy="165" r="6" fill="#F87171"/>
    </g>
  </g>
</svg>`;

// 訊息池：每事件 3-6 句，可愛 + 鼓勵風格
const MASCOT_MESSAGES = {
  'job-create':       ['又有案件囉～', '新挑戰，加油！', '又要開始忙碌囉', '太好了，又有事做', '工作上門，衝啊！'],
  'job-done':         ['完成一筆，做得好！', '太棒了，又解決一個', '辛苦了，繼續加油', 'Done！下一個', '產量爆棚，太強了'],
  'job-paid':         ['收到錢錢囉 開心', '叮，入帳！', '💰 又進帳了', '錢錢拿到手，太爽', '心情大好，去喝杯咖啡吧'],
  'job-fully-paid':   ['結清了！這筆完美收尾', '尾款收齊，超開心', '完美完美！', '一筆好結束 ✨'],
  'client-create':    ['新業主加入，加油！', '又一個合作對象', '記得好好對待新業主', '緣分啊～'],
  'job-cancel':       ['好可惜...下次有機會', '沒事，下一個', '別放心上'],
  'job-delete':       ['不要了？掰掰～', '當作沒發生過', '清乾淨了'],
  'goal-reached-monthly': ['🎯 月目標達標了，你是神！', '本月目標 ✓，太厲害了', '達標！犒賞自己一下', '神之手再現'],
  'app-startup-overdue':  ['有人欠你錢喔，記得催一下', '提醒：有逾期未收款的案件', '別忘了去收款！', '催款時間到～'],
  'timer-start':      ['開始計時，專注！', '加油，火力全開', '今天也要好好工作', '集中精神～'],
  'timer-stop':       ['辛苦了，喝口水', '工時記下了！', '休息一下', '做得好～'],
  'streak-3':         ['3 連發，狀態爆棚！', '今天手感超好', '一鼓作氣，再來幾個！', '一波接一波 🔥'],
  'idle-greeting':    ['我在這 ~', '有事找我嗎？', '今天也要加油喔', '叫我做什麼？', '你今天看起來不錯～', '加油加油 💪'],
  'app-startup-quiet':['好久不見，最近還好嗎？', '回來啦～歡迎', '今天又是新的一天'],
  // v3.23.3 新增訊息池
  'big-payment':      ['哇！大筆入帳！', '這筆好大方～', '嘩！這數字可愛 💎', '今天可以加菜了'],
  'search-open':      ['找什麼？我幫你', '🔍 搜尋中…', '想找哪一筆？'],
  'export-pdf':       ['排版中，等等噢', '在做請款單…', '處理中…'],
  'import-success':   ['資料來了！歡迎回來', '匯入成功，繼續加油', '你的資料安然送達'],
  'undo-action':      ['上一步…撤回中', '反悔了？沒事', '幫你還原～'],
  'sleeping':         ['💤 zzZ…', '我先睡一下…', '叫我我會起來'],
  'wake-up':          ['啊？我剛打瞌睡', '你回來啦～', '我醒了我醒了'],
};

const MASCOT_COOLDOWN_MS = 30 * 1000;          // 同類事件 30 秒不重複
const MASCOT_BUBBLE_HIDE_MS = 5000;            // 對話框 5 秒消失
const MASCOT_SHAKE_MS = 400;                   // 抖動動畫
let mascotState = {
  enabled: true,                               // 預設 ON
  name: '',                                    // 個人化名字
  lastTriggerTimes: {},                        // event → timestamp
  hideTimer: null,
  shakeTimer: null,
  stateTimer: null,                            // v3.23.2：暫態狀態自動回 idle 的 timer
  current: 'idle',                             // v3.23.2：current state
};
let mascotInited = false;

// v3.23.2 + v3.23.3：8 種狀態 + 4 種嘴巴（純 SVG path swap）
const MASCOT_STATES = ['idle', 'loading', 'thinking', 'success', 'error', 'searching', 'celebrating', 'sleeping'];
const MASCOT_MOUTHS = {
  happy:   'M90 145 Q120 160 150 145',     // 😊 預設笑
  flat:    'M95 150 L145 150',              // 😐 一條線（loading/thinking/searching/sleeping）
  worried: 'M90 152 Q120 138 150 152',      // 😟 反向弧線（error）
  big:     'M85 142 Q120 168 155 142',      // 😄 大笑（success/celebrating）
  open:    'M118 148 Q120 152 122 148 Q120 144 118 148', // 😮 小 O（shocked，動作不是 state）
};
// state → 嘴巴 map
const MASCOT_STATE_TO_MOUTH = {
  idle: 'happy',
  loading: 'flat',
  thinking: 'flat',
  success: 'big',
  error: 'worried',
  searching: 'flat',
  celebrating: 'big',
  sleeping: 'flat',
};
// 哪些 state 是「暫態」(自動回 idle)
const TRANSIENT_STATES = { success: 2500, error: 2500, celebrating: 1800 };
// searching / sleeping / loading / thinking 是持續狀態，要手動切回 idle

function mascotSetMouth(mouthKey) {
  const m = document.querySelector('#mascot-container #mouth');
  if (!m) return;
  const d = MASCOT_MOUTHS[mouthKey] || MASCOT_MOUTHS.happy;
  m.setAttribute('d', d);
}

// v3.23.3：眼睛切換（用 SVG circle 的 r 屬性）
// open（預設 r=10） / shocked（r=14 大眼）/ closed（r=2 變點，sleeping 用）/ wink（左眼短暫變點）
function mascotSetEyes(mode) {
  const l = document.querySelector('#mascot-container #eyeL');
  const r = document.querySelector('#mascot-container #eyeR');
  if (!l || !r) return;
  switch (mode) {
    case 'shocked':
      l.setAttribute('r', '14');
      r.setAttribute('r', '14');
      break;
    case 'closed':  // sleeping
      l.setAttribute('r', '2');
      r.setAttribute('r', '2');
      break;
    case 'open':
    default:
      l.setAttribute('r', '10');
      r.setAttribute('r', '10');
  }
}

// 隨機眨眼（左眼閉 250ms 再回正）
function mascotWink() {
  const l = document.querySelector('#mascot-container #eyeL');
  if (!l) return;
  const orig = l.getAttribute('r');
  l.setAttribute('r', '2');
  setTimeout(() => l.setAttribute('r', orig || '10'), 220);
}

// 排隨機眨眼計時器（25-45 秒一次，只在 idle 時觸發）
let _mascotWinkTimer = null;
function mascotScheduleWink() {
  if (_mascotWinkTimer) clearTimeout(_mascotWinkTimer);
  const delay = 25000 + Math.random() * 20000;  // 25~45 秒
  _mascotWinkTimer = setTimeout(() => {
    if (mascotState.enabled && mascotState.current === 'idle') mascotWink();
    mascotScheduleWink();  // 排下一次
  }, delay);
}

// Idle 5 分鐘 → sleeping
const MASCOT_IDLE_TIMEOUT = 5 * 60 * 1000;
let _mascotIdleTimer = null;
let _mascotIdleListenerInited = false;

function mascotResetIdleTimer() {
  if (_mascotIdleTimer) clearTimeout(_mascotIdleTimer);
  if (!mascotState.enabled) return;
  _mascotIdleTimer = setTimeout(() => {
    if (mascotState.current === 'idle') mascotSetState('sleeping');
  }, MASCOT_IDLE_TIMEOUT);
}

function mascotInitIdleListener() {
  if (_mascotIdleListenerInited) return;
  _mascotIdleListenerInited = true;
  // throttle：每 10 秒最多 reset 一次（避免 mousemove 每 ms 跑）
  let lastReset = 0;
  const onActivity = () => {
    const now = Date.now();
    // 從 sleeping 立刻甦醒
    if (mascotState.current === 'sleeping') {
      mascotSetState('idle');
      mascotSay('idle-greeting', MASCOT_MESSAGES['wake-up'][Math.floor(Math.random() * MASCOT_MESSAGES['wake-up'].length)]);
    }
    if (now - lastReset < 10000) return;
    lastReset = now;
    mascotResetIdleTimer();
  };
  ['mousemove', 'click', 'keydown', 'scroll', 'touchstart'].forEach(ev =>
    document.addEventListener(ev, onActivity, { passive: true })
  );
}

// 連擊偵測（1 分鐘內 3 筆完成 → celebrating + streak-3）
let _mascotCompletionStreak = 0;
let _mascotLastCompletionAt = 0;
function mascotTrackCompletion() {
  const now = Date.now();
  if (now - _mascotLastCompletionAt < 60 * 1000) {
    _mascotCompletionStreak++;
  } else {
    _mascotCompletionStreak = 1;
  }
  _mascotLastCompletionAt = now;
  if (_mascotCompletionStreak >= 3) {
    mascotSay('streak-3');
    mascotSetState('celebrating');
    _mascotCompletionStreak = 0;  // 重置避免一直觸發
  }
}

// 大筆收款偵測（單筆 ≥ 10000 → shocked 表情 + big-payment 訊息）
const BIG_PAYMENT_THRESHOLD = 10000;
function mascotOnPaymentAdd(amount) {
  if (!mascotState.enabled) return;
  const a = +amount || 0;
  if (a < BIG_PAYMENT_THRESHOLD) return;
  // shocked 表情（不是 state）：大眼 1 秒
  mascotSetEyes('shocked');
  setTimeout(() => mascotSetEyes('open'), 1100);
  mascotSay('big-payment');
}

// 月目標達標偵測（避免每次 render 都重複觸發 — 用 localStorage 記錄最近一次達標的月份）
function mascotCheckMonthlyGoalReached(currentPaid, target) {
  if (!mascotState.enabled || target <= 0 || currentPaid < target) return;
  const thisMo = thisMonth();
  const lastReachedMo = localStorage.getItem('cloud-mascot-last-monthly-goal');
  if (lastReachedMo === thisMo) return;  // 本月已慶祝過
  localStorage.setItem('cloud-mascot-last-monthly-goal', thisMo);
  mascotSay('goal-reached-monthly');
  mascotSetState('celebrating');
}

// 切換 mascot 狀態（8 種 state）
// success / error / celebrating 自動 2.5/2.5/1.8 秒後回 idle
function mascotSetState(state) {
  if (!MASCOT_STATES.includes(state)) state = 'idle';
  const c = document.getElementById('mascot-container');
  if (!c) return;
  // 移除所有 state class
  MASCOT_STATES.forEach(s => c.classList.remove(`state-${s}`));
  c.classList.add(`state-${state}`);
  mascotState.current = state;
  // 嘴巴跟著變
  mascotSetMouth(MASCOT_STATE_TO_MOUTH[state]);
  // v3.23.3：眼睛跟著變（sleeping 閉眼，其他開眼）
  mascotSetEyes(state === 'sleeping' ? 'closed' : 'open');
  // 暫態自動回 idle
  if (mascotState.stateTimer) { clearTimeout(mascotState.stateTimer); mascotState.stateTimer = null; }
  if (TRANSIENT_STATES[state]) {
    mascotState.stateTimer = setTimeout(() => mascotSetState('idle'), TRANSIENT_STATES[state]);
  }
}

// event → state 自動 mapping（mascotSay 會自動套用）
const MASCOT_EVENT_TO_STATE = {
  'job-done': 'success',
  'job-paid': 'success',
  'job-fully-paid': 'success',
  'goal-reached-monthly': 'celebrating',  // v3.23.3：升級為 celebrating（金色光暈）
  'streak-3': 'celebrating',              // v3.23.3
  'big-payment': 'success',               // v3.23.3
  'app-startup-overdue': 'thinking',
  'job-cancel': 'error',
  'search-open': 'searching',             // v3.23.3
  'export-pdf': 'loading',                // v3.23.3
  'import-success': 'success',            // v3.23.3
  'undo-action': 'thinking',              // v3.23.3
  'timer-start': 'loading',               // v3.23.3
  'timer-stop': 'success',                // v3.23.3
};

// 啟動時呼叫一次（從 config 還原 + 注入 SVG + 看情況打招呼）
function mascotInit() {
  if (mascotInited) return;
  mascotInited = true;
  mascotState.enabled = config.mascotEnabled !== false;  // 預設 true（首次也是）
  mascotState.name = config.mascotName || '';
  const c = document.getElementById('mascot-container');
  if (c) {
    c.innerHTML = MASCOT_SVG;
    c.classList.toggle('hidden', !mascotState.enabled);
    // v3.23.2：啟動時 set 預設狀態 idle
    mascotSetState('idle');
    // v3.23.3：啟動 idle 偵測 + 隨機眨眼
    mascotInitIdleListener();
    mascotResetIdleTimer();
    mascotScheduleWink();
  }
  // 同步設定頁 UI
  const cb = document.getElementById('pref-mascot-enabled');
  if (cb) cb.checked = mascotState.enabled;
  const inp = document.getElementById('pref-mascot-name');
  if (inp) inp.value = mascotState.name;

  // 啟動 1.5 秒後看情況打招呼（避免跟 onboarding 同時跳出）
  setTimeout(() => {
    if (!mascotState.enabled) return;
    if (typeof activeJobs !== 'function') return;
    const today = todayStr();
    // 有逾期未完成 → 提醒催收
    const overdue = activeJobs().filter(j => !j.done && j.date && j.date < today);
    if (overdue.length > 0) { mascotSay('app-startup-overdue'); return; }
    // 沒事 → 30% 機率隨機打招呼，避免每次都跳很煩
    if (Math.random() < 0.3) mascotSay('app-startup-quiet');
  }, 1500);
}

// 觸發 mascot 講話（核心 API）
// eventType: 'job-create' / 'job-done' / 'job-paid' / ... 任一 MASCOT_MESSAGES 的 key
function mascotSay(eventType, customMsg) {
  if (!mascotState.enabled) return;
  if (!eventType && !customMsg) return;

  // Cooldown：同類事件 30 秒不重複（idle-greeting 跟 customMsg 不受限）
  if (eventType && eventType !== 'idle-greeting') {
    const now = Date.now();
    if (mascotState.lastTriggerTimes[eventType] && now - mascotState.lastTriggerTimes[eventType] < MASCOT_COOLDOWN_MS) return;
    mascotState.lastTriggerTimes[eventType] = now;
  }

  // 取訊息（custom 優先；否則從 pool 隨機選）
  let msg = customMsg;
  if (!msg) {
    const pool = MASCOT_MESSAGES[eventType];
    if (!pool || !pool.length) return;
    msg = pool[Math.floor(Math.random() * pool.length)];
  }

  // 渲染對話框
  const bubble = document.getElementById('mascot-bubble');
  const nameEl = document.getElementById('mascot-bubble-name');
  const textEl = document.getElementById('mascot-bubble-text');
  if (!bubble || !textEl) return;

  // 名字前綴（有設名字才顯示）
  if (nameEl) nameEl.textContent = mascotState.name ? `${mascotState.name}：` : '';
  textEl.textContent = msg;

  // 重啟 in 動畫
  bubble.classList.remove('hidden');
  bubble.style.animation = 'none';
  void bubble.offsetWidth;  // 強制 reflow
  bubble.style.animation = '';

  // 5 秒後自動消失
  if (mascotState.hideTimer) clearTimeout(mascotState.hideTimer);
  mascotState.hideTimer = setTimeout(mascotHideBubble, MASCOT_BUBBLE_HIDE_MS);

  // mascot 抖動表示有話要說
  const c = document.getElementById('mascot-container');
  if (c) {
    c.classList.add('mascot-shake');
    if (mascotState.shakeTimer) clearTimeout(mascotState.shakeTimer);
    mascotState.shakeTimer = setTimeout(() => c.classList.remove('mascot-shake'), MASCOT_SHAKE_MS);
  }

  // v3.23.2：根據 event 自動切 state（success / error / thinking 會自動 2.5 秒後回 idle）
  if (eventType && MASCOT_EVENT_TO_STATE[eventType]) {
    mascotSetState(MASCOT_EVENT_TO_STATE[eventType]);
  }
}

function mascotHideBubble() {
  const bubble = document.getElementById('mascot-bubble');
  if (bubble) bubble.classList.add('hidden');
  if (mascotState.hideTimer) { clearTimeout(mascotState.hideTimer); mascotState.hideTimer = null; }
}

// 點 mascot → 隨機說一句招呼
function mascotOnClick() {
  mascotSay('idle-greeting');
}

// 設定頁：開關 toggle
function onMascotEnabledChange(checked) {
  mascotState.enabled = !!checked;
  config.mascotEnabled = mascotState.enabled;
  saveConfigOnly();
  const c = document.getElementById('mascot-container');
  if (c) c.classList.toggle('hidden', !mascotState.enabled);
  if (!mascotState.enabled) mascotHideBubble();
  toast(checked ? '✓ 已啟用小幫手' : '✓ 已關閉小幫手', 2000);
}

// 設定頁：取名字
function onMascotNameChange(name) {
  mascotState.name = (name || '').trim().slice(0, 8);
  config.mascotName = mascotState.name;
  saveConfigOnly();
  // 不立刻 toast，因為 user 還在打字
}

// 設定頁：「試試看」按鈕
function mascotTestSay() {
  // 強制顯示一句（不受 cooldown 限制）→ 用 customMsg 繞過
  const pool = MASCOT_MESSAGES['idle-greeting'];
  const msg = pool[Math.floor(Math.random() * pool.length)];
  // 暫時清掉 cooldown，直接呼叫
  delete mascotState.lastTriggerTimes['idle-greeting'];
  mascotSay('idle-greeting', msg);
}

// ============== v3.22.8：顯示偏好（設定頁 toggle）==============
// 把 #pref-show-goals checkbox 的當前狀態同步到畫面（app 啟動時呼叫一次）
function loadDisplayPrefUI() {
  const cb = document.getElementById('pref-show-goals');
  if (cb) cb.checked = !!config.showGoalsCard;
  // v3.24.18：啟動時也立即同步 card 的 hidden 狀態，避免 prefShowGoals=false 但首次載入時 card 還顯示
  const card = document.getElementById('rev-goals-card');
  if (card) card.classList.toggle('hidden', !config.showGoalsCard);
}

// 設定頁 toggle 的 onchange handler
function onTogglePrefShowGoals(checked) {
  config.showGoalsCard = !!checked;
  saveConfigOnly();
  // 立刻反映到收益頁（如果使用者目前在那）
  if (currentTab === 'revenue') {
    renderRevenueGoals();
    renderRevenueInsights();
  }
  // 直接操作 DOM 確保即使在其他分頁也立即生效
  const card = document.getElementById('rev-goals-card');
  if (card) card.classList.toggle('hidden', !checked);
  toast(checked ? '✓ 已顯示收益目標卡片' : '✓ 已隱藏收益目標卡片', 2000);
}

// ============== v3.11.0：達成率 + 預測 + 智慧分析 ==============
function onGoalChange(period, value) {
  const v = Math.max(0, Math.round(+value || 0));
  config.goals = config.goals || { monthly: 0, yearly: 0 };
  if (period === 'monthly') config.goals.monthly = v;
  else if (period === 'yearly') config.goals.yearly = v;
  saveConfigOnly();
  renderRevenueGoals();
  toast(`✓ ${period === 'monthly' ? '本月' : '本年'}目標：${v ? fmt(v) : '已清除'}`, 2500);
}

function renderRevenueGoals() {
  // v3.22.8：依 config.showGoalsCard 決定要不要顯示整張 card（預設 false 隱藏）
  const card = document.getElementById('rev-goals-card');
  const show = !!config.showGoalsCard;
  if (card) card.classList.toggle('hidden', !show);
  if (!show) return;

  const goals = (config.goals || { monthly: 0, yearly: 0 });
  // 還原 input 值
  const mInp = document.getElementById('goal-monthly-input');
  const yInp = document.getElementById('goal-yearly-input');
  if (mInp && document.activeElement !== mInp) mInp.value = goals.monthly || '';
  if (yInp && document.activeElement !== yInp) yInp.value = goals.yearly || '';

  // 算本月已收（payment.date 在本月的加總）
  const m = thisMonth();
  const monthPaid = activeJobs().reduce((s, j) => s + (j.payments || []).filter(p => getMonth(p.date) === m).reduce((ss, p) => ss + (+p.amount || 0), 0), 0);

  // 算本年已收
  const yr = String(new Date().getFullYear());
  const yearPaid = activeJobs().reduce((s, j) => s + (j.payments || []).filter(p => (p.date || '').startsWith(yr)).reduce((ss, p) => ss + (+p.amount || 0), 0), 0);

  // 月度目標 + 進度條
  renderGoalProgress('monthly', monthPaid, goals.monthly, 'month');
  // 年度目標 + 進度條
  renderGoalProgress('yearly', yearPaid, goals.yearly, 'year');

  // v3.23.3：月目標達標 mascot 慶祝（每月只觸發一次）
  if (typeof mascotCheckMonthlyGoalReached === 'function') {
    mascotCheckMonthlyGoalReached(monthPaid, goals.monthly);
  }
}

function renderGoalProgress(kind, current, target, scale) {
  const curEl = document.getElementById(`goal-${kind}-current`);
  const pctEl = document.getElementById(`goal-${kind}-pct`);
  const fillEl = document.getElementById(`goal-${kind}-fill`);
  const fcEl = document.getElementById(`goal-${kind}-forecast`);
  if (curEl) curEl.textContent = `已收 ${fmt(current)}${target > 0 ? ' / ' + fmt(target) : ''}`;
  if (target <= 0) {
    if (pctEl) pctEl.textContent = '尚未設定目標';
    if (pctEl) pctEl.style.color = 'var(--muted)';
    if (fillEl) fillEl.style.width = '0%';
    if (fcEl) fcEl.innerHTML = '👉 點上方輸入框填入目標金額即可看達成率與預估';
    return;
  }
  const pct = Math.round(current / target * 100);
  if (pctEl) {
    pctEl.textContent = pct + '%';
    pctEl.style.color = pct >= 100 ? 'var(--success)' : (pct >= 70 ? 'var(--primary)' : 'var(--warning)');
  }
  if (fillEl) {
    fillEl.style.width = Math.min(100, pct) + '%';
    fillEl.style.background = pct >= 100 ? 'var(--success)' : (pct >= 70 ? 'var(--primary)' : 'var(--warning)');
  }

  // 線性預測：依「目前已過天數 / 期間總天數」推估期末值
  const now = new Date();
  let dayOfPeriod, totalDaysOfPeriod;
  if (scale === 'month') {
    dayOfPeriod = now.getDate();
    totalDaysOfPeriod = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  } else {
    // year
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    dayOfPeriod = Math.floor((now - startOfYear) / 86400000) + 1;
    const endOfYear = new Date(now.getFullYear() + 1, 0, 1);
    totalDaysOfPeriod = Math.floor((endOfYear - startOfYear) / 86400000);
  }
  const projected = Math.round(current / dayOfPeriod * totalDaysOfPeriod);
  const diff = projected - target;
  let fcHtml = '';
  if (current === 0) {
    fcHtml = `📅 已過 ${dayOfPeriod}/${totalDaysOfPeriod} 天，還沒收到任何款項`;
  } else if (diff >= 0) {
    fcHtml = `📈 依目前進度預估期末可達 <b>${fmt(projected)}</b>（<span style="color: var(--success);">超出 ${fmt(diff)}</span>）`;
  } else {
    fcHtml = `📈 依目前進度預估期末可達 <b>${fmt(projected)}</b>（<span style="color: var(--warning);">差 ${fmt(-diff)}</span>）`;
  }
  if (fcEl) fcEl.innerHTML = fcHtml;
}

function renderRevenueInsights() {
  const box = document.getElementById('rev-insights');
  if (!box) return;
  // v3.22.8：跟 #rev-goals-card 同卡片，被 hidden 時就不需要算了
  if (!config.showGoalsCard) { box.innerHTML = ''; return; }
  const insights = [];
  const m = thisMonth();
  const yr = String(new Date().getFullYear());
  const active = activeJobs();

  // 1. 業主集中度警告（本月某業主佔 >= 50% / 30%）
  const monthByClient = {};
  let monthTotal = 0;
  active.forEach(j => {
    (j.payments || []).forEach(p => {
      if (getMonth(p.date) !== m) return;
      const v = +p.amount || 0;
      monthByClient[j.clientId] = (monthByClient[j.clientId] || 0) + v;
      monthTotal += v;
    });
  });
  if (monthTotal > 0) {
    const top = Object.entries(monthByClient).sort((a, b) => b[1] - a[1])[0];
    if (top) {
      const c = state.clients.find(x => x.id === top[0]);
      const pct = Math.round(top[1] / monthTotal * 100);
      if (pct >= 50) {
        insights.push({
          kind: 'warn',
          icon: '⚠️',
          title: `${c ? c.name : '某業主'}佔本月收入 ${pct}%`,
          desc: '收入過度集中於單一業主，建議擴展客源以降低風險'
        });
      } else if (pct >= 35) {
        insights.push({
          kind: 'info',
          icon: '📊',
          title: `${c ? c.name : '某業主'}是本月主力業主（${pct}%）`,
          desc: ''
        });
      }
    }
  }

  // 2. 拖款指數：本月平均收款週期 vs 過去 3 個月平均
  const cyclesAll = [];
  active.forEach(j => {
    if (!j.doneAt || !(j.payments || []).length) return;
    const fp = [...j.payments].filter(p => p.date).sort((a, b) => (a.date || '').localeCompare(b.date || ''))[0];
    if (!fp) return;
    const days = daysBetween(j.doneAt, fp.date);
    if (days < 0 || days > 365) return;
    cyclesAll.push({ payDate: fp.date, days });
  });
  if (cyclesAll.length >= 3) {
    const recentCycles = cyclesAll.filter(c => getMonth(c.payDate) === m).map(c => c.days);
    const last3MonthsCycles = cyclesAll.filter(c => {
      const d = new Date(c.payDate);
      const diff = (new Date() - d) / 86400000;
      return diff >= 30 && diff <= 120;
    }).map(c => c.days);
    if (recentCycles.length >= 1 && last3MonthsCycles.length >= 2) {
      const avgRecent = Math.round(recentCycles.reduce((a, b) => a + b, 0) / recentCycles.length);
      const avgPast = Math.round(last3MonthsCycles.reduce((a, b) => a + b, 0) / last3MonthsCycles.length);
      const diff = avgRecent - avgPast;
      if (diff >= 7) {
        insights.push({
          kind: 'warn',
          icon: '🐢',
          title: `本月平均收款 ${avgRecent} 天，比過去 3 個月（${avgPast} 天）慢 ${diff} 天`,
          desc: '可能該主動催款'
        });
      } else if (diff <= -5) {
        insights.push({
          kind: 'good',
          icon: '⚡',
          title: `本月平均收款 ${avgRecent} 天，比過去 3 個月快 ${-diff} 天`,
          desc: '收款狀況改善'
        });
      }
    }
  }

  // 3. Churn 警告：找出曾經合作但 60-180 天沒新案的業主
  const today = todayStr();
  const churnList = [];
  state.clients.forEach(c => {
    const myJobs = active.filter(j => j.clientId === c.id);
    if (myJobs.length === 0) return;
    const lastJobDate = myJobs.map(j => j.date || '').filter(Boolean).sort().reverse()[0];
    if (!lastJobDate) return;
    const days = daysBetween(lastJobDate, today);
    // 60-180 天 = 高風險區（180+ 視為已流失，可能不必再追）
    if (days >= 60 && days <= 180) churnList.push({ client: c, days });
  });
  if (churnList.length) {
    churnList.sort((a, b) => b.days - a.days);
    const top3 = churnList.slice(0, 3);
    const sample = top3.map(x => `${x.client.name}（${x.days} 天）`).join('、');
    insights.push({
      kind: 'info',
      icon: '👋',
      title: `${churnList.length} 位業主超過 60 天沒下單`,
      desc: sample + (churnList.length > 3 ? `…等 ${churnList.length - 3} 位` : '') + '。可能該主動聯繫'
    });
  }

  // 4. 待收餘額警告
  const allUnpaid = active.filter(j => j.done).reduce((s, j) => s + jobUnpaidAmount(j), 0);
  if (allUnpaid >= 100000) {
    insights.push({
      kind: 'warn',
      icon: '💰',
      title: `總待收金額 ${fmt(allUnpaid)}`,
      desc: '建議集中對所有未收款業主發請款單'
    });
  }

  // 5. 年度集中度（單一業主佔今年總收入 >=50%）
  const yearByClient = {};
  let yearTotal = 0;
  active.forEach(j => {
    (j.payments || []).forEach(p => {
      if (!(p.date || '').startsWith(yr)) return;
      const v = +p.amount || 0;
      yearByClient[j.clientId] = (yearByClient[j.clientId] || 0) + v;
      yearTotal += v;
    });
  });
  if (yearTotal > 0) {
    const yearTop = Object.entries(yearByClient).sort((a, b) => b[1] - a[1])[0];
    if (yearTop) {
      const c = state.clients.find(x => x.id === yearTop[0]);
      const pct = Math.round(yearTop[1] / yearTotal * 100);
      if (pct >= 50) {
        insights.push({
          kind: 'warn',
          icon: '🎯',
          title: `${c ? c.name : '某業主'}佔年度收入 ${pct}%`,
          desc: '收入過度仰賴單一業主，建議拓展更多客戶降低風險'
        });
      }
    }
  }

  if (!insights.length) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = '<h3 style="font-size: 14px; margin: 0 0 8px 0;">💡 智慧分析</h3>'
    + insights.map(i => `
      <div class="client-insight client-insight--${i.kind}">
        <div class="client-insight-icon">${i.icon}</div>
        <div class="client-insight-body">
          <div class="client-insight-title">${escapeHtml(i.title)}</div>
          ${i.desc ? `<div class="client-insight-desc">${escapeHtml(i.desc)}</div>` : ''}
        </div>
      </div>`).join('');
}

function fillEmptyBuckets(keys, mode) {
  if (!keys.length) return [];
  const sorted = [...keys].sort();
  const first = sorted[0];
  const last = sorted[sorted.length-1];
  const result = [];

  if (mode === 'year') {
    const fy = +first, ly = +last;
    for (let y = fy; y <= ly; y++) result.push(String(y));
  } else {
    let [fy, fm] = first.split('-').map(Number);
    const [ly, lm] = last.split('-').map(Number);
    while (fy < ly || (fy === ly && fm <= lm)) {
      result.push(`${fy}-${String(fm).padStart(2,'0')}`);
      fm++;
      if (fm > 12) { fm = 1; fy++; }
    }
  }
  // 補到至少當期
  const now = mode === 'year' ? String(new Date().getFullYear()) : thisMonth();
  if (result.length && result[result.length-1] < now) {
    if (mode === 'year') {
      let y = +result[result.length-1] + 1;
      while (y <= +now) { result.push(String(y)); y++; }
    } else {
      let [y, m] = result[result.length-1].split('-').map(Number);
      m++;
      while (`${y}-${String(m).padStart(2,'0')}` <= now) {
        result.push(`${y}-${String(m).padStart(2,'0')}`);
        m++; if (m > 12) { m = 1; y++; }
      }
    }
  }
  return result;
}

function renderRevSummary(data) {
  const totalPaid = data.reduce((s,d) => s + d.paid, 0);
  const totalUnpaid = data.reduce((s,d) => s + d.unpaid, 0);
  const totalPending = data.reduce((s,d) => s + d.pending, 0);
  const total = totalPaid + totalUnpaid + totalPending;
  // v3.24.3：帳面（j.amount sum）+ 實際（jobNetAmount sum，扣分潤+稅+外包）
  const totalGross = data.reduce((s,d) => s + (d.gross || 0), 0);
  const totalNet = data.reduce((s,d) => s + (d.netAmount || 0), 0);
  const avg = data.length ? Math.round(totalNet / data.length) : 0;
  const best = data.slice().sort((a,b) => (b.netAmount||0) - (a.netAmount||0))[0];

  // 對比上期（用實際）
  const half = Math.floor(data.length / 2);
  const firstHalf = data.slice(0, half).reduce((s,d) => s + (d.netAmount || 0), 0);
  const secondHalf = data.slice(half).reduce((s,d) => s + (d.netAmount || 0), 0);
  let delta = '';
  if (firstHalf > 0 && half > 0) {
    const pct = ((secondHalf - firstHalf) / firstHalf * 100).toFixed(0);
    const up = secondHalf >= firstHalf;
    delta = `<div class="delta ${up?'up':'down'}">${up?'↑':'↓'} ${Math.abs(pct)}% vs 前半期</div>`;
  }

  // v3.24.3：負數金額 helper（實際總收入可能為負 — 倒貼情境）
  const fmtN = (v) => v < 0 ? `<span style="color: var(--danger);">−${fmt(-v)}</span>` : fmt(v);
  const grossVsNetDelta = totalGross !== totalNet
    ? `<div class="delta" style="color: var(--muted);">vs 帳面 ${fmt(totalGross)}</div>`
    : '';

  document.getElementById('rev-summary').innerHTML = `
    <div class="summary-card">
      <div class="label">帳面總收入</div>
      <div class="value">${fmt(totalGross)}</div>
      <div class="delta" style="color: var(--muted);">給業主請款總額（折扣後）</div>
    </div>
    <div class="summary-card">
      <div class="label">實際總收入</div>
      <div class="value">${fmtN(totalNet)}</div>
      ${grossVsNetDelta || delta}
    </div>
    <div class="summary-card">
      <div class="label">已收款</div>
      <div class="value" style="color: var(--success);">${fmt(totalPaid)}</div>
      <div class="delta">${total ? Math.round(totalPaid/total*100) : 0}% 已入帳</div>
    </div>
    <div class="summary-card">
      <div class="label">待收款</div>
      <div class="value" style="color: var(--warning);">${fmt(totalUnpaid)}</div>
      <div class="delta" style="color: var(--muted);">${totalUnpaid ? '待請款或催收' : '全部入帳'}</div>
    </div>
    <div class="summary-card">
      <div class="label">每${revenueState.mode==='year'?'年':'月'}平均</div>
      <div class="value">${fmtN(avg)}</div>
      <div class="delta" style="color: var(--muted);">共 ${data.length} ${revenueState.mode==='year'?'年':'期'}（實際）</div>
    </div>
    ${best && (best.netAmount||0) ? `<div class="summary-card">
      <div class="label">最佳${revenueState.mode==='year'?'年度':'月份'}</div>
      <div class="value" style="font-size: 16px;">${best.label}</div>
      <div class="delta" style="color: var(--primary);">${fmtN(best.netAmount||0)}</div>
    </div>` : ''}
  `;
}

// ============== SVG Charts ==============
function drawRevChart(data) {
  const svg = document.getElementById('rev-chart');
  if (!svg) return;

  const W = Math.max(svg.clientWidth || 700, 320);
  const H = 260;
  const margin = { top: 16, right: 14, bottom: 36, left: 60 };
  const chartW = W - margin.left - margin.right;
  const chartH = H - margin.top - margin.bottom;

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  if (!data.length) {
    svg.innerHTML = `<text x="${W/2}" y="${H/2}" text-anchor="middle" fill="#8a8f98" font-size="13">沒有資料</text>`;
    return;
  }

  // v3.22.8：統一時間順序（最舊在左、最新在右），月度 / 年度都一致
  // 之前 v3.5.0 月度反轉成「最近月在左」，user 後來覺得不直覺改回來
  const displayData = data;

  // v3.5.0：先以時間順序（舊→新）算 cumulative，之後依顯示位置 mapping
  // chronoCum[i] = data[0..i] 的累計 paid+unpaid（i 用原 data 索引）
  const chronoCum = [];
  let acc = 0;
  data.forEach(d => { acc += d.paid + d.unpaid; chronoCum.push(acc); });

  const max = Math.max(...displayData.map(d => d.paid + d.unpaid + d.pending), 1);
  // 取整到漂亮的刻度
  const niceMax = niceScale(max);
  const n = displayData.length;
  const barGroupW = chartW / n;
  const barW = Math.min(barGroupW * 0.6, 50);

  const parts = [];

  // Y 軸格線 + 刻度
  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const y = margin.top + chartH - (i/gridCount) * chartH;
    const val = Math.round(niceMax * i / gridCount);
    parts.push(`<line x1="${margin.left}" y1="${y}" x2="${W-margin.right}" y2="${y}" stroke="#e4e6eb" stroke-width="1"/>`);
    parts.push(`<text x="${margin.left-6}" y="${y+4}" text-anchor="end" fill="#8a8f98" font-size="10">${fmtShort(val)}</text>`);
  }

  // 柱 + 趨勢線點
  const linePoints = [];
  displayData.forEach((d, i) => {
    const cx = margin.left + i * barGroupW + barGroupW/2;
    const bx = cx - barW/2;

    const total = d.paid + d.unpaid + d.pending;
    let yCursor = margin.top + chartH;

    // 已收 (底)
    if (d.paid > 0) {
      const h = d.paid / niceMax * chartH;
      yCursor -= h;
      parts.push(`<rect x="${bx}" y="${yCursor}" width="${barW}" height="${h}" fill="#10b981" rx="2"><title>${d.label}　已收 ${fmt(d.paid)}</title></rect>`);
    }
    // 待收 (中)
    if (d.unpaid > 0) {
      const h = d.unpaid / niceMax * chartH;
      yCursor -= h;
      parts.push(`<rect x="${bx}" y="${yCursor}" width="${barW}" height="${h}" fill="#f59e0b" rx="2"><title>${d.label}　待收 ${fmt(d.unpaid)}</title></rect>`);
    }
    // 進行中 (頂，透明)
    if (d.pending > 0) {
      const h = d.pending / niceMax * chartH;
      yCursor -= h;
      parts.push(`<rect x="${bx}" y="${yCursor}" width="${barW}" height="${h}" fill="#8a8f98" opacity="0.3" rx="2"><title>${d.label}　進行中 ${fmt(d.pending)}</title></rect>`);
    }

    // 趨勢線點
    const ly = margin.top + chartH - (total / niceMax * chartH);
    linePoints.push({ x: cx, y: ly, label: d.label, total });

    // v3.5.0：X 軸標籤改顯示 YYYY-MM 全文（不再 slice(5)）
    // 數量多時隔項顯示，避免擠在一起
    const showLabel = displayData.length > 12 ? (i % 2 === 0) : true;
    if (showLabel) {
      parts.push(`<text x="${cx}" y="${H-margin.bottom+16}" text-anchor="middle" fill="#8a8f98" font-size="10">${d.label}</text>`);
    }
  });

  // v3.22.8：displayData 即 data（時間順序，舊→新），cumPoints 直接 1:1 對應
  const cumPoints = displayData.map((d, i) => {
    const cx = margin.left + i * barGroupW + barGroupW/2;
    return { x: cx, value: chronoCum[i] };
  });
  const cumMax = Math.max(...cumPoints.map(p => p.value), 1);
  cumPoints.forEach(p => {
    p.y = margin.top + chartH - (p.value / cumMax * chartH);
  });

  // 累計線（淡紫虛線，顯示在底層）
  if (cumPoints.length > 1) {
    const cumPath = 'M ' + cumPoints.map(p => `${p.x} ${p.y}`).join(' L ');
    parts.push(`<path d="${cumPath}" stroke="#a855f7" stroke-width="2" fill="none" stroke-dasharray="5,3" opacity="0.55"/>`);
    // v3.5.0：累計總額 label 永遠標在「累計值最大」的點（也就是最新月）
    const peak = cumPoints.reduce((a, b) => b.value > a.value ? b : a, cumPoints[0]);
    const anchor = peak.x > (W / 2) ? 'end' : 'start';
    const dx = anchor === 'end' ? -4 : 4;
    parts.push(`<text x="${peak.x + dx}" y="${peak.y - 6}" text-anchor="${anchor}" fill="#a855f7" font-size="10" font-weight="600">累計 ${fmtShort(peak.value)}</text>`);
  }

  // 當期趨勢線（藍色實線，顯示在上層）
  if (linePoints.length > 1) {
    const d = 'M ' + linePoints.map(p => `${p.x} ${p.y}`).join(' L ');
    parts.push(`<path d="${d}" stroke="#2563eb" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
    linePoints.forEach(p => {
      if (p.total > 0) {
        parts.push(`<circle cx="${p.x}" cy="${p.y}" r="3" fill="#2563eb"/>`);
      }
    });
  }

  svg.innerHTML = parts.join('');
}

function niceScale(max) {
  if (max <= 0) return 1000;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const d = max / pow;
  let nice;
  if (d <= 1) nice = 1;
  else if (d <= 2) nice = 2;
  else if (d <= 5) nice = 5;
  else nice = 10;
  return nice * pow;
}

function fmtShort(n) {
  if (n >= 10000) return Math.round(n/1000) + 'k';
  if (n >= 1000) return (n/1000).toFixed(1).replace('.0','') + 'k';
  return String(n);
}

// ============== 案件類型派圖 ==============
function renderTagPie() {
  const box = document.getElementById('rev-tag-pie');
  if (!box) return;

  const tagAmounts = {};
  activeJobs().forEach(j => {
    if (!jobIsFullyPaid(j) && jobPaidTotal(j) === 0) return;
    const tag = j.tag || '未分類';
    tagAmounts[tag] = (tagAmounts[tag] || 0) + jobNetAmount(j);
  });

  const entries = Object.entries(tagAmounts).filter(([_,v]) => v > 0).sort((a,b) => b[1] - a[1]);
  if (!entries.length) {
    box.innerHTML = '<div class="empty" style="padding: 20px;"><div style="font-size: 13px;">沒有已收款的案件</div></div>';
    return;
  }

  const total = entries.reduce((s, [_,v]) => s + v, 0);
  const cx = 90, cy = 90, r = 78;
  const colors = ['#2563eb','#10b981','#f59e0b','#ec4899','#8b5cf6','#14b8a6','#ef4444','#eab308','#0891b2','#7c3aed','#92400e','#64748b'];

  let startAngle = -Math.PI / 2;
  const slices = entries.map(([tag, amt], i) => {
    const angle = (amt / total) * 2 * Math.PI;
    const endAngle = startAngle + angle;
    let path;
    if (entries.length === 1) {
      path = `M ${cx-r} ${cy} A ${r} ${r} 0 1 1 ${cx+r-0.01} ${cy} A ${r} ${r} 0 1 1 ${cx-r} ${cy}`;
    } else {
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;
      path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    }
    const slice = `<path d="${path}" fill="${colors[i % colors.length]}" stroke="#fff" stroke-width="1.5"><title>${escapeHtml(tag)}：${fmt(amt)} (${(amt/total*100).toFixed(0)}%)</title></path>`;
    startAngle = endAngle;
    return slice;
  });

  const legend = entries.map(([tag, amt], i) => `
    <div class="pie-legend-item">
      <div class="pie-legend-dot" style="background: ${colors[i % colors.length]};"></div>
      <span class="pie-legend-name">${escapeHtml(tag)}</span>
      <span class="pie-legend-amt">${fmt(amt)}</span>
      <span class="pie-legend-pct">${(amt/total*100).toFixed(0)}%</span>
    </div>
  `).join('');

  box.innerHTML = `<div class="pie-container">
    <svg class="pie-svg" viewBox="0 0 180 180" width="180" height="180" xmlns="http://www.w3.org/2000/svg">${slices.join('')}</svg>
    <div class="pie-legend">${legend}</div>
  </div>`;
}

// ============== 工作熱圖 (GitHub-style) ==============
function renderHeatmap() {
  const box = document.getElementById('rev-heatmap');
  if (!box) return;

  const cell = 11;
  const gap = 2;
  const weeks = 53;
  const W = (cell + gap) * weeks + 30;
  const H = (cell + gap) * 7 + 24;

  // 計算每天的收款金額（v2.9: 用 payments 各自日期 + 比例分配 net amount）
  const byDay = {};
  activeJobs().forEach(j => {
    const final = jobFinalAmount(j);
    if (final <= 0) return;
    const net = jobNetAmount(j);
    (j.payments || []).forEach(p => {
      if (!p.date) return;
      const portion = (+p.amount || 0) / final;  // 該筆 payment 佔總比例
      byDay[p.date] = (byDay[p.date] || 0) + Math.round(net * portion);
    });
  });

  const today = new Date();
  // 找開始日：今天 - 365 天，往前找到那週的週日
  const start = new Date(today);
  start.setDate(start.getDate() - 365);
  while (start.getDay() !== 0) start.setDate(start.getDate() - 1);

  const max = Math.max(...Object.values(byDay), 1);
  const colors = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];

  const cells = [];
  const monthLabels = [];
  let lastMonth = -1;

  const todayStrV = todayStr();
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const cur = new Date(start);
      cur.setDate(start.getDate() + w*7 + d);
      const ds = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
      if (ds > todayStrV) continue;
      const amt = byDay[ds] || 0;
      const intensity = amt > 0 ? Math.min(4, Math.ceil(amt / max * 4)) : 0;
      const x = w * (cell+gap) + 22;
      const y = d * (cell+gap) + 18;
      const isToday = ds === todayStrV;
      cells.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${colors[intensity]}" ${isToday?'stroke="var(--primary)" stroke-width="1.5"':''}><title>${ds}　${fmt(amt)}</title></rect>`);
    }
    // 月份 label（每個月的第一個出現）
    const cur = new Date(start);
    cur.setDate(start.getDate() + w*7);
    if (cur.getMonth() !== lastMonth) {
      lastMonth = cur.getMonth();
      monthLabels.push(`<text x="${w * (cell+gap) + 22}" y="14" fill="#8a8f98" font-size="10">${cur.getMonth()+1}月</text>`);
    }
  }

  // 星期 label
  const dowLabels = [];
  ['', '一', '', '三', '', '五', ''].forEach((d, i) => {
    if (d) dowLabels.push(`<text x="0" y="${i*(cell+gap)+27}" fill="#8a8f98" font-size="9">${d}</text>`);
  });

  // 圖例
  const legendCells = colors.map(c => `<div class="heatmap-legend-cell" style="background:${c}"></div>`).join('');

  box.innerHTML = `<div class="heatmap-container">
    <svg class="heatmap-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${monthLabels.join('')}
      ${dowLabels.join('')}
      ${cells.join('')}
    </svg>
  </div>
  <div class="heatmap-legend">
    <span>少</span>${legendCells}<span>多</span>
  </div>`;
}

// ============== 月度業主彙整 ==============
function renderMonthlyReport() {
  const sel = document.getElementById('report-month');
  if (!sel) return;

  // 填月份選單
  const allMonths = [...new Set(state.jobs.map(j => jobBelongMonth(j)).filter(Boolean))].sort().reverse();
  if (!allMonths.length) allMonths.push(thisMonth());
  const cur = sel.value;
  sel.innerHTML = allMonths.map(m => `<option value="${m}">${m}</option>`).join('');
  sel.value = cur && allMonths.includes(cur) ? cur : (allMonths[0] || thisMonth());

  const month = sel.value;
  const monthJobs = activeJobs().filter(j => jobBelongMonth(j) === month);

  const box = document.getElementById('rev-monthly-report');
  if (!box) return;

  if (!monthJobs.length) {
    box.innerHTML = '<div class="empty" style="padding: 20px;"><div style="font-size: 13px;">該月份沒有資料</div></div>';
    return;
  }

  // 依業主彙整
  // v3.24.4：欄位重整 — 業主 / 案件 / 原始 / (分潤?) / 外包 / 請款金額 / 發票稅務 / 實際入帳
  //   請款金額 = sum(jobFinalAmount)（折扣後業主應付）
  //   發票稅務 = sum(jobInvoiceTax)（5% 稅金本身，用 /1.05 反推）
  //   實際入帳 = sum(jobNetAmount)（扣完稅 + 分潤 + 外包後我口袋實得）
  //   差額 = 分潤 + 外包成本（不在三欄中重複顯示，但獨立欄已顯示）
  const byClient = {};
  monthJobs.forEach(j => {
    const c = getClient(j.clientId);
    const cid = j.clientId || 'unknown';
    if (!byClient[cid]) {
      byClient[cid] = {
        client: c, count: 0,
        gross: 0,           // 原始金額（j.amount sum）
        commission: 0,      // 分潤
        outsourceCost: 0,   // 外包
        requestAmt: 0,      // 請款金額（業主應付，jobFinalAmount sum）
        taxAmount: 0,       // 發票稅務（5% 稅金本身）
        netReceived: 0      // 實際入帳（jobNetAmount sum，扣完一切）
      };
    }
    const r = byClient[cid];
    r.count++;
    r.gross += +j.amount || 0;
    r.commission += jobCommission(j);
    r.outsourceCost += +j.outsourceCost || 0;
    r.requestAmt += jobFinalAmount(j);
    r.taxAmount += jobInvoiceTax(j);
    r.netReceived += jobNetAmount(j);
  });

  const rows = Object.values(byClient).sort((a,b) => b.requestAmt - a.requestAmt);

  const totals = rows.reduce((acc, r) => {
    acc.count += r.count;
    acc.gross += r.gross;
    acc.commission += r.commission;
    acc.outsourceCost += r.outsourceCost;
    acc.requestAmt += r.requestAmt;
    acc.taxAmount += r.taxAmount;
    acc.netReceived += r.netReceived;
    return acc;
  }, { count: 0, gross: 0, commission: 0, outsourceCost: 0, requestAmt: 0, taxAmount: 0, netReceived: 0 });

  const showCommission = totals.commission > 0;
  const showOutsource = totals.outsourceCost > 0;
  const fmtN = (v) => v < 0 ? `<span style="color: var(--danger);">−${fmt(-v)}</span>` : fmt(v);

  box.innerHTML = `<div style="overflow-x: auto;">
    <table class="report-table">
      <thead>
        <tr>
          <th>業主</th>
          <th class="num">案件</th>
          <th class="num">原始金額</th>
          ${showCommission ? '<th class="num">分潤</th>' : ''}
          ${showOutsource ? '<th class="num">外包</th>' : ''}
          <th class="num">請款金額</th>
          <th class="num">發票稅務</th>
          <th class="num">實際入帳 <span style="color: var(--muted); font-size: 11px; cursor: help;" title="算法（per-case taxApplied）：&#10;1. 有勾「📨 此案件含 5% 稅」的案件 → 視為含稅，未稅 = final / 1.05、稅金 = final − 未稅&#10;2. 沒勾的案件 → 不扣稅（業主直接付，不需報稅）&#10;3. 實際入帳 = (有勾的未稅 + 沒勾的請款) − 外包 − 分潤&#10;   等同：請款金額 − 發票稅務 − 外包 − 分潤&#10;&#10;範例（4 筆中 1 筆勾稅 4,275、其他 3 筆共 1,425；外包 1,150）：&#10;勾稅部分稅金 = 4,275 − round(4275/1.05) = 204&#10;實際入帳 = 5,700 − 204 − 1,150 = 4,346">ⓘ</span></th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => {
          const name = r.client ? r.client.name : '(已刪除)';
          const color = r.client ? r.client.color : '#ccc';
          return `<tr>
            <td><span class="dot" style="display:inline-block;background:${color};width:8px;height:8px;border-radius:50%;margin-right:6px;"></span>${escapeHtml(name)}</td>
            <td class="num">${r.count}</td>
            <td class="num">${fmt(r.gross)}</td>
            ${showCommission ? `<td class="num" style="color: var(--warning);">${r.commission ? '−'+fmt(r.commission) : '—'}</td>` : ''}
            ${showOutsource ? `<td class="num" style="color: var(--warning);">${r.outsourceCost ? '−'+fmt(r.outsourceCost) : '—'}</td>` : ''}
            <td class="num"><b>${fmt(r.requestAmt)}</b></td>
            <td class="num" style="color: var(--warning);">${r.taxAmount ? '−'+fmt(r.taxAmount) : '—'}</td>
            <td class="num" style="color: var(--success);"><b>${fmtN(r.netReceived)}</b></td>
          </tr>`;
        }).join('')}
        <tr class="report-total">
          <td>合計</td>
          <td class="num">${totals.count}</td>
          <td class="num">${fmt(totals.gross)}</td>
          ${showCommission ? `<td class="num" style="color: var(--warning);">${totals.commission ? '−'+fmt(totals.commission) : '—'}</td>` : ''}
          ${showOutsource ? `<td class="num" style="color: var(--warning);">${totals.outsourceCost ? '−'+fmt(totals.outsourceCost) : '—'}</td>` : ''}
          <td class="num"><b>${fmt(totals.requestAmt)}</b></td>
          <td class="num" style="color: var(--warning);">${totals.taxAmount ? '−'+fmt(totals.taxAmount) : '—'}</td>
          <td class="num" style="color: var(--success);"><b>${fmtN(totals.netReceived)}</b></td>
        </tr>
      </tbody>
    </table>
    <div style="margin-top: 8px; font-size: 11px; color: var(--muted);">
      💡 計算順序：請款金額 → <b>先扣稅務</b> → 再扣外包 → 最後扣分潤 = 實際入帳。
      <br>&nbsp;&nbsp;&nbsp;發票稅務只算有勾「📨 此案件含 5% 稅」的案件（業主給的視為含稅，用 /1.05 反推）。
      <br>&nbsp;&nbsp;&nbsp;沒勾的案件：請款金額直接進實際入帳，不扣稅。
    </div>
  </div>`;
}

function exportMonthlyReportCSV() {
  const sel = document.getElementById('report-month');
  if (!sel) return;
  const month = sel.value;
  const monthJobs = activeJobs().filter(j => jobBelongMonth(j) === month);

  if (!monthJobs.length) { toast('該月沒有資料'); return; }

  // v3.24.4：CSV 對齊月度表格
  const headers = ['業主', '案件數', '原始金額', '分潤', '外包', '請款金額', '發票稅務', '實際入帳'];

  const byClient = {};
  monthJobs.forEach(j => {
    const c = getClient(j.clientId);
    const cid = j.clientId || 'unknown';
    if (!byClient[cid]) byClient[cid] = { name: c?c.name:'(已刪除)', count: 0, gross: 0, commission: 0, outsourceCost: 0, requestAmt: 0, taxAmount: 0, netReceived: 0 };
    const r = byClient[cid];
    r.count++;
    r.gross += +j.amount || 0;
    r.commission += jobCommission(j);
    r.outsourceCost += +j.outsourceCost || 0;
    r.requestAmt += jobFinalAmount(j);
    r.taxAmount += jobInvoiceTax(j);
    r.netReceived += jobNetAmount(j);
  });

  const rows = Object.values(byClient).sort((a,b) => b.requestAmt - a.requestAmt).map(r =>
    [r.name, r.count, r.gross, r.commission, r.outsourceCost, r.requestAmt, r.taxAmount, r.netReceived]);

  const csv = '﻿' + [
    headers.join(','),
    ...rows.map(r => r.map(c => {
      const s = String(c);
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `monthly-report-${month}.csv`;
  a.click();
  toast(`✓ 已匯出 ${month} 月度報表`);
}

// 暫存業主排行的案件 ID 清單，給點擊時跳轉用
let clientRankCache = {};

function renderClientRank(jobs, keysFilter) {
  const box = document.getElementById('rev-client-rank');
  if (!box) return;

  // 若有 keysFilter (非 all)，只計算在範圍內的 jobs
  let scoped = jobs;
  if (keysFilter) {
    scoped = jobs.filter(j => {
      if (!j.date) return false;
      const k = revenueState.mode === 'year' ? j.date.slice(0,4) : j.date.slice(0,7);
      return keysFilter.includes(k);
    });
  }

  const byClient = {};
  scoped.forEach(j => {
    const cid = j.clientId || 'unknown';
    if (!byClient[cid]) byClient[cid] = { paid: 0, unpaid: 0, pending: 0, count: 0, jobIds: [] };
    // v2.8.1: 用 finalAmount + paymentTotal
    const final = jobFinalAmount(j);
    const paid = jobPaidTotal(j);
    const unpaid = Math.max(0, final - paid - (+j.writeOff || 0));
    byClient[cid].paid += paid;
    if (j.done) byClient[cid].unpaid += unpaid;
    else byClient[cid].pending += unpaid;
    byClient[cid].count++;
    byClient[cid].jobIds.push(j.id);
  });

  const rows = Object.entries(byClient)
    .map(([cid, d]) => {
      const c = getClient(cid);
      return { ...d, total: d.paid + d.unpaid, cid, name: c ? c.name : '未指定', color: c ? c.color : '#ccc' };
    })
    .filter(r => r.total > 0)
    .sort((a,b) => b.total - a.total);

  // 暫存到 cache 讓點擊用
  clientRankCache = {};
  rows.forEach(r => { clientRankCache[r.cid] = { jobIds: r.jobIds, name: r.name, count: r.count }; });

  if (!rows.length) {
    box.innerHTML = emptyState('期間內沒有收益資料', '');
    return;
  }

  const maxTotal = rows[0].total;
  box.innerHTML = rows.map(r => {
    const paidPct = r.total ? r.paid / r.total * 100 : 0;
    const unpaidPct = r.total ? r.unpaid / r.total * 100 : 0;
    const barScale = r.total / maxTotal * 100;
    return `<div class="client-rank-row" onclick="clickClientRank('${r.cid}')" style="cursor: pointer;" title="點擊查看 ${r.count} 筆案件">
      <div class="dot" style="background:${r.color}; width: 10px; height: 10px;"></div>
      <div class="client-rank-info">
        <div class="client-rank-name">${escapeHtml(r.name)}<span style="color: var(--muted); font-size: 11px; font-weight: 400;">（${r.count} 筆）</span></div>
        <div class="client-rank-bar-box" style="width: ${barScale}%;">
          <div class="client-rank-bar-paid" style="width: ${paidPct}%;"></div>
          <div class="client-rank-bar-unpaid" style="width: ${unpaidPct}%;"></div>
        </div>
      </div>
      <div class="client-rank-amt">
        ${fmt(r.total)}
        ${r.unpaid ? `<div class="client-rank-amt-sub">（待收 ${fmt(r.unpaid)}）</div>` : ''}
      </div>
    </div>`;
  }).join('');
}

// 點業主排行 → 鎖定篩選那批案件 + 跳案件分頁
function clickClientRank(cid) {
  const cache = clientRankCache[cid];
  if (!cache) return;
  // 範圍標籤（描述當前 revenue 顯示的範圍）
  // v3.24.12：補 this-month / last-month（v3.24.10 加的快捷選項，否則 label 會顯示「最近 last-month 個月」這種怪字串）
  let rangeLabel = '當前範圍';
  const r = String(revenueState.range);
  if (r === 'all') rangeLabel = '全部';
  else if (r === 'ytd') rangeLabel = '今年至今';
  else if (r === 'this-month') rangeLabel = '當月';
  else if (r === 'last-month') rangeLabel = '上個月';
  else if (r === 'custom') {
    rangeLabel = revenueState.mode === 'month' ? '自訂月份範圍' : '自訂年份範圍';
  } else if (revenueState.mode === 'year') {
    rangeLabel = `最近 ${r} 年`;
  } else {
    rangeLabel = `最近 ${r} 個月`;
  }
  lockJobsToIds(cache.jobIds, `${cache.name} · ${rangeLabel}（${cache.count} 筆）`);
  switchTab('jobs');
}

// ============== Modal 內子任務（v2.6）==============
let modalSubtasks = [];

// v3.14.0：modal 內 multi-tag state
let modalJobTags = [];      // 案件 modal 內的 tags
let modalClientTags = [];   // 客戶 modal 內的 tags（如果加的話；目前 detail view 直接 mutate）

// 業主 detail 頁的 tags（直接 mutate state.clients）
function renderClientTagsChips() {
  const c = (typeof detailClientId !== 'undefined' && detailClientId) ? getClient(detailClientId) : null;
  const box = document.getElementById('client-tags-chips');
  if (!box || !c) return;
  c.tags = Array.isArray(c.tags) ? c.tags : [];
  if (!c.tags.length) {
    box.innerHTML = '<span class="reminder-hint" style="font-size: 12px;">還沒有標籤</span>';
    return;
  }
  box.innerHTML = c.tags.map(t => `
    <span class="tag-chip">
      ${escapeHtml(t)}
      <button onclick="removeClientTag('${escapeHtml(t).replace(/'/g, '&#39;')}')" title="移除標籤" aria-label="移除">×</button>
    </span>`).join('');
}

function addClientTagFromInput() {
  const inp = document.getElementById('client-tag-input');
  if (!inp || !detailClientId) return;
  const v = (inp.value || '').trim();
  if (!v) return;
  const c = getClient(detailClientId);
  if (!c) return;
  c.tags = Array.isArray(c.tags) ? c.tags : [];
  if (c.tags.includes(v)) {
    toast(`「${v}」已存在`);
    inp.value = '';
    return;
  }
  c.tags.push(v);
  inp.value = '';
  save();
  renderClientTagsChips();
  refreshAllTagSuggestions();
}

function removeClientTag(tag) {
  if (!detailClientId) return;
  const c = getClient(detailClientId);
  if (!c) return;
  c.tags = (c.tags || []).filter(t => t !== tag);
  save();
  renderClientTagsChips();
}

function onClientTagKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    addClientTagFromInput();
  }
}

// 案件 modal 的 tags
function renderJobTagsChips() {
  const box = document.getElementById('job-tags-chips');
  if (!box) return;
  if (!modalJobTags.length) {
    box.innerHTML = '<span class="reminder-hint" style="font-size: 12px;">還沒有標籤</span>';
    return;
  }
  box.innerHTML = modalJobTags.map(t => `
    <span class="tag-chip">
      ${escapeHtml(t)}
      <button type="button" onclick="removeJobTag('${escapeHtml(t).replace(/'/g, '&#39;')}')" title="移除標籤" aria-label="移除">×</button>
    </span>`).join('');
}

function addJobTagFromInput() {
  const inp = document.getElementById('job-tag');
  if (!inp) return;
  const v = (inp.value || '').trim();
  if (!v) return;
  if (modalJobTags.includes(v)) {
    toast(`「${v}」已存在`);
    inp.value = '';
    return;
  }
  modalJobTags.push(v);
  inp.value = '';
  renderJobTagsChips();
}

function removeJobTag(tag) {
  modalJobTags = modalJobTags.filter(t => t !== tag);
  renderJobTagsChips();
}

function onJobTagKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    addJobTagFromInput();
  }
}

// 收集本 app 內所有用過的標籤（業主 + 案件）→ datalist 自動建議
function getAllUsedTags() {
  const set = new Set();
  state.clients.forEach(c => (c.tags || []).forEach(t => set.add(t)));
  state.jobs.forEach(j => {
    (j.tags || []).forEach(t => set.add(t));
    if (j.tag) set.add(j.tag);  // 向下相容
  });
  return [...set].sort();
}

function refreshAllTagSuggestions() {
  const tags = getAllUsedTags();
  ['tag-suggestions', 'all-tag-suggestions'].forEach(id => {
    const dl = document.getElementById(id);
    if (dl) dl.innerHTML = tags.map(t => `<option value="${escapeHtml(t)}">`).join('');
  });
}

function renderJobSubtasks() {
  const list = document.getElementById('job-subtasks-list');
  const counter = document.getElementById('job-subtasks-counter');
  if (!list) return;
  if (!modalSubtasks.length) {
    list.innerHTML = '<div style="font-size: 12px; color: var(--muted); padding: 4px 0;">尚無子任務</div>';
    if (counter) counter.textContent = '';
    return;
  }
  const done = modalSubtasks.filter(s => s.done).length;
  if (counter) counter.textContent = `（${done}/${modalSubtasks.length}）`;
  list.innerHTML = modalSubtasks.map((s, i) => `
    <div style="display: flex; gap: 8px; align-items: center; padding: 4px 0; font-size: 13px;">
      <input type="checkbox" ${s.done?'checked':''} onchange="toggleJobSubtask(${i})" style="width:auto; margin:0;">
      <span style="flex:1; ${s.done?'text-decoration:line-through; color:var(--muted);':''}">${escapeHtml(s.text)}</span>
      <button type="button" class="btn btn-ghost btn-sm" onclick="removeJobSubtask(${i})" style="color:var(--danger); padding:2px 6px;">✕</button>
    </div>
  `).join('');
}

function addJobSubtask() {
  const inp = document.getElementById('job-subtask-input');
  const text = (inp?.value || '').trim();
  if (!text) return;
  modalSubtasks.push({ id: uid(), text, done: false });
  inp.value = '';
  renderJobSubtasks();
  setTimeout(() => inp.focus(), 50);
}

function toggleJobSubtask(i) {
  if (modalSubtasks[i]) {
    modalSubtasks[i].done = !modalSubtasks[i].done;
    renderJobSubtasks();
  }
}

function removeJobSubtask(i) {
  modalSubtasks.splice(i, 1);
  renderJobSubtasks();
}

// ============== 全局計時器（v3.10.0：從 modal 內升級成跨 modal/分頁/會期常駐）==============
const TIMER_KEY = 'cloud-ftActiveTimer_v1';

// 全局計時器狀態：jobId 不為 null = 有案件「正在計時或暫停中」
//   - startedAt > 0 = 計時中
//   - startedAt === 0 = 暫停中（仍綁定該案件，按繼續就接著跑）
let activeTimer = {
  jobId: null,
  startedAt: 0,
  accumulatedMs: 0
};
let activeTimerTickInterval = null;

function fmtTimerMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function getActiveTimerMs() {
  if (!activeTimer.jobId) return 0;
  const sessionMs = activeTimer.startedAt ? (Date.now() - activeTimer.startedAt) : 0;
  return activeTimer.accumulatedMs + sessionMs;
}

function loadActiveTimerFromStorage() {
  try {
    const raw = localStorage.getItem(TIMER_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && obj.jobId) {
      activeTimer = {
        jobId: obj.jobId,
        startedAt: +obj.startedAt || 0,
        accumulatedMs: +obj.accumulatedMs || 0
      };
      // 還原時若是「計時中」狀態，立刻啟動 tick
      if (activeTimer.startedAt) startActiveTimerTick();
    }
  } catch (e) { console.warn('[timer] restore failed:', e); }
}

function saveActiveTimerToStorage() {
  if (activeTimer.jobId) {
    localStorage.setItem(TIMER_KEY, JSON.stringify(activeTimer));
  } else {
    localStorage.removeItem(TIMER_KEY);
  }
}

function startActiveTimerTick() {
  if (activeTimerTickInterval) clearInterval(activeTimerTickInterval);
  activeTimerTickInterval = setInterval(() => {
    renderActiveTimerWidget();
    refreshModalTimerDisplay();
  }, 1000);
}

function stopActiveTimerTick() {
  if (activeTimerTickInterval) { clearInterval(activeTimerTickInterval); activeTimerTickInterval = null; }
}

// 開始（or 繼續）計時某案件
//   如果切到不同案件 → 先把舊的暫停 + 寫回 timeSpentMs，再切到新案件
function startActiveTimer(jobId) {
  if (!jobId) return;
  if (activeTimer.jobId && activeTimer.jobId !== jobId) {
    // 切換案件：先把舊的暫停 + 存回 timeSpentMs
    pauseActiveTimer({ silent: true });
    // 切到新案件
    activeTimer.jobId = jobId;
    activeTimer.accumulatedMs = (state.jobs.find(j => j.id === jobId)?.timeSpentMs) || 0;
  }
  if (!activeTimer.jobId) {
    activeTimer.jobId = jobId;
    activeTimer.accumulatedMs = (state.jobs.find(j => j.id === jobId)?.timeSpentMs) || 0;
  }
  activeTimer.startedAt = Date.now();
  saveActiveTimerToStorage();
  startActiveTimerTick();
  renderActiveTimerWidget();
  refreshModalTimerDisplay();
  // v3.23.3：mascot 開始計時
  if (typeof mascotSay === 'function') mascotSay('timer-start');
}

// 暫停：保留 jobId，可按繼續接著跑
function pauseActiveTimer(opt = {}) {
  if (!activeTimer.jobId) return;
  if (activeTimer.startedAt) {
    activeTimer.accumulatedMs += Date.now() - activeTimer.startedAt;
    activeTimer.startedAt = 0;
  }
  // 寫回 job.timeSpentMs（每次暫停都即時寫，不靠 modal 關閉）
  const j = state.jobs.find(x => x.id === activeTimer.jobId);
  if (j) {
    j.timeSpentMs = activeTimer.accumulatedMs;
    if (!opt.silent) save();
  }
  saveActiveTimerToStorage();
  stopActiveTimerTick();
  renderActiveTimerWidget();
  refreshModalTimerDisplay();
}

// 結束計時 + 加到工時欄
function finishActiveTimer() {
  if (!activeTimer.jobId) { toast('還沒開始計時'); return; }
  const totalMs = getActiveTimerMs();
  if (totalMs <= 0) { toast('累積時間為 0，無需加到工時'); clearActiveTimer(); return; }
  const hours = +(totalMs / 3600000).toFixed(2);
  const j = state.jobs.find(x => x.id === activeTimer.jobId);
  if (j) {
    j.hoursWorked = +((+j.hoursWorked || 0) + hours).toFixed(2);
    j.timeSpentMs = 0;  // 已結算，歸零
  }
  toast(`✓ 已加 ${hours} 小時到 ${j ? (j.title || '案件') : '案件'} 的工時`);
  // v3.23.3：mascot 結束計時
  if (typeof mascotSay === 'function') mascotSay('timer-stop');
  clearActiveTimer();
  save();
  // 如果 modal 正開的就是這個案件，也同步更新工時 input
  if (typeof editingJobId !== 'undefined' && editingJobId === (j && j.id)) {
    const inp = document.getElementById('job-hours');
    if (inp && j) { inp.value = j.hoursWorked; updateJobHourlyHint(); }
  }
}

// 重設：清空累積但保留 jobId（按繼續會從 0 開始）
function resetActiveTimer() {
  if (!activeTimer.jobId) return;
  if (getActiveTimerMs() > 0) {
    if (!confirm('確定清空這段計時？此案件累計工時會歸零。')) return;
  }
  activeTimer.startedAt = 0;
  activeTimer.accumulatedMs = 0;
  const j = state.jobs.find(x => x.id === activeTimer.jobId);
  if (j) { j.timeSpentMs = 0; save(); }
  saveActiveTimerToStorage();
  stopActiveTimerTick();
  renderActiveTimerWidget();
  refreshModalTimerDisplay();
}

// 完全清掉計時器（不再綁定任何案件）
function clearActiveTimer() {
  activeTimer = { jobId: null, startedAt: 0, accumulatedMs: 0 };
  saveActiveTimerToStorage();
  stopActiveTimerTick();
  renderActiveTimerWidget();
  refreshModalTimerDisplay();
}

// Top bar widget render
function renderActiveTimerWidget() {
  const widget = document.getElementById('active-timer-widget');
  if (!widget) return;
  if (!activeTimer.jobId) {
    widget.classList.add('hidden');
    return;
  }
  widget.classList.remove('hidden');
  const j = state.jobs.find(x => x.id === activeTimer.jobId);
  const display = document.getElementById('active-timer-display');
  if (display) display.textContent = fmtTimerMs(getActiveTimerMs());
  const titleEl = document.getElementById('active-timer-title');
  if (titleEl) titleEl.textContent = j ? (j.title || '無標題案件') : '案件已刪除';
  const isRunning = !!activeTimer.startedAt;
  widget.classList.toggle('running', isRunning);
  const toggleBtn = document.getElementById('active-timer-toggle-btn');
  if (toggleBtn) toggleBtn.textContent = isRunning ? '⏸' : '▶';
}

// Top bar widget 點擊：跳到該案件 modal
function focusActiveTimerJob() {
  if (!activeTimer.jobId) return;
  const j = state.jobs.find(x => x.id === activeTimer.jobId);
  if (!j) {
    if (confirm('原計時案件已被刪除，要清掉計時器嗎？')) clearActiveTimer();
    return;
  }
  editJob(activeTimer.jobId);
}

// Top bar widget 的「⏸/▶」按鈕
function onActiveTimerToggleBtn() {
  if (!activeTimer.jobId) return;
  if (activeTimer.startedAt) pauseActiveTimer();
  else startActiveTimer(activeTimer.jobId);
}

// ----- Modal 計時器 UI（接全局狀態）-----

// 案件 modal 開啟時呼叫，jobId 是當前正在編輯的案件
//   - 如果該案件 === activeTimer.jobId → 顯示當前計時數字 + 適當按鈕
//   - 如果該案件 !== activeTimer.jobId → 顯示該案件的 timeSpentMs 但按鈕是「▶ 開始」
function loadJobTimer(timeSpentMs, jobId) {
  refreshModalTimerDisplay(jobId, timeSpentMs);
}

function refreshModalTimerDisplay(jobId, fallbackTimeSpentMs) {
  const el = document.getElementById('job-timer-display');
  if (!el) return;
  // 用參數或全域 editingJobId
  const targetId = jobId || (typeof editingJobId !== 'undefined' ? editingJobId : null);
  if (activeTimer.jobId && activeTimer.jobId === targetId) {
    // 正在計時或暫停中，顯示全局狀態
    el.textContent = fmtTimerMs(getActiveTimerMs());
    const btn = document.getElementById('job-timer-toggle');
    if (btn) btn.innerHTML = activeTimer.startedAt ? '⏸ 暫停' : '▶ 繼續';
  } else {
    // 沒在計時，顯示該案件的 timeSpentMs（或 fallback）
    const j = targetId ? state.jobs.find(x => x.id === targetId) : null;
    const ms = (j && +j.timeSpentMs) || (+fallbackTimeSpentMs || 0);
    el.textContent = fmtTimerMs(ms);
    const btn = document.getElementById('job-timer-toggle');
    if (btn) btn.innerHTML = '▶ 開始';
  }
}

// modal 內按「▶ 開始 / ⏸ 暫停 / ▶ 繼續」
function toggleJobTimer() {
  const targetId = (typeof editingJobId !== 'undefined') ? editingJobId : null;
  if (!targetId) { toast('請先儲存案件再開始計時'); return; }
  if (activeTimer.jobId === targetId && activeTimer.startedAt) {
    pauseActiveTimer();
  } else {
    // 開始（如果 activeTimer 在跑別的案件，會自動切換）
    if (activeTimer.jobId && activeTimer.jobId !== targetId) {
      const otherJob = state.jobs.find(x => x.id === activeTimer.jobId);
      const otherTitle = otherJob ? (otherJob.title || '案件') : '其他案件';
      if (!confirm(`目前正在計時「${otherTitle}」，要切換到目前這個案件嗎？\n（前一個的計時會自動暫停並寫回工時）`)) return;
    }
    startActiveTimer(targetId);
  }
}

// modal 內按「重設」
function resetJobTimer() {
  const targetId = (typeof editingJobId !== 'undefined') ? editingJobId : null;
  if (!targetId) return;
  // 如果重設的是當前計時案件，呼叫 resetActiveTimer
  if (activeTimer.jobId === targetId) {
    resetActiveTimer();
  } else {
    // 重設別的案件的 timeSpentMs（沒在跑全局計時）
    const j = state.jobs.find(x => x.id === targetId);
    if (j && +j.timeSpentMs > 0) {
      if (!confirm('確定清空此案件累計工時？')) return;
      j.timeSpentMs = 0;
      save();
      refreshModalTimerDisplay();
    }
  }
}

// modal 內按「✓ 結束」
function finishJobTimer() {
  const targetId = (typeof editingJobId !== 'undefined') ? editingJobId : null;
  if (!targetId) return;
  if (activeTimer.jobId === targetId) {
    finishActiveTimer();
  } else {
    // 沒在計時，直接把 timeSpentMs 結算到工時欄
    const j = state.jobs.find(x => x.id === targetId);
    if (!j || !(+j.timeSpentMs)) { toast('還沒開始計時'); return; }
    const hours = +(j.timeSpentMs / 3600000).toFixed(2);
    const inp = document.getElementById('job-hours');
    if (inp) { inp.value = (+inp.value || 0) + hours; updateJobHourlyHint(); }
    j.timeSpentMs = 0;
    save();
    refreshModalTimerDisplay();
    toast(`✓ 已加 ${hours} 小時到工時欄`);
  }
}

function stopJobTimerOnClose() {
  // v3.10.0：modal 關閉計時器繼續跑（top bar widget 持續顯示），這函式變 noop 但留著相容
}

// ============== 估價單（v2.6）==============
async function exportSingleJobPDF() {
  if (!editingJobId) { toast('請先儲存後再匯出'); return; }
  const j = state.jobs.find(x => x.id === editingJobId);
  if (!j) return;
  const c = getClient(j.clientId);
  const a = getActivePaymentAccount();

  // v3.2.1：PDF 匯出前 pre-fetch 存摺照片 dataUrl，避免 html2canvas 截到 placeholder「⏳ 載入中」
  let bankbookDataUrl = '';
  if (a) {
    if (a.bankbookImage) {
      bankbookDataUrl = a.bankbookImage;
    } else if (a.bankbookImageFileId) {
      toastProgress('📷 載入存摺照片…');
      try {
        bankbookDataUrl = await cloudGetBankbookDataUrl(a.bankbookImageFileId);
      } catch (e) {
        console.warn('[pdf-export] 載入存摺照片失敗，繼續匯出（PDF 內無照片）:', e);
      }
    }
  }

  // 用 invoice-view 同樣的 HTML 結構臨時生成
  const tempBox = document.createElement('div');
  tempBox.style.cssText = 'position: fixed; left: -10000px; top: 0; width: 700px; padding: 30px; background: white; color: black; font-family: -apple-system, "PingFang TC", sans-serif;';
  const userName = config.userInfo?.name || '';
  const tag = j.isEstimate ? '估價單' : '請款單（單筆）';
  // 單價 × 數量
  const qty = (j.quantity != null && j.quantity > 0) ? j.quantity : 1;
  const unit = qty > 0 ? Math.round((+j.amount || 0) / qty) : (+j.amount || 0);

  tempBox.innerHTML = `
    <h1 style="font-size: 24px; margin-bottom: 8px; color: black;">${tag}</h1>
    <div style="font-size: 13px; color: #666; margin-bottom: 16px;">
      製單日期：${todayStr()}　${j.isEstimate ? '估價有效期：14 天' : ''}
    </div>
    <div style="border: 1px solid #ddd; padding: 12px; border-radius: 8px; margin-bottom: 16px; color: black;">
      <div style="margin-bottom: 8px;"><b>業主：</b>${escapeHtml(c?.name || '?')}</div>
      <div style="margin-bottom: 8px;"><b>${j.isEstimate ? '預計執行日期' : '案件日期'}：</b>${j.date || '-'}${j.endDate ? ' ~ ' + j.endDate : ''}</div>
      <div style="margin-bottom: 8px;"><b>案件名稱：</b>${escapeHtml(j.title || '')}</div>
      ${j.tag ? `<div style="margin-bottom: 8px;"><b>類型：</b>${escapeHtml(j.tag)}</div>` : ''}
      ${j.details ? `<div style="margin-bottom: 8px;"><b>說明：</b><br><span style="white-space: pre-wrap;">${escapeHtml(j.details)}</span></div>` : ''}
      ${qty > 1 ? `<div style="margin-bottom: 8px;"><b>單價 × 數量：</b>NT$ ${unit.toLocaleString()} × ${qty}</div>` : ''}
    </div>
    <div style="background: #f7f7f7; padding: 12px; border-radius: 8px; text-align: right; color: black;">
      <div style="font-size: 13px; color: #666;">${j.isEstimate ? '估價金額' : '應收金額'}</div>
      <div style="font-size: 28px; font-weight: 700;">NT$ ${(+j.amount||0).toLocaleString()}</div>
    </div>
    ${userName ? `<div style="margin-top: 24px; font-size: 12px; color: #666; border-top: 1px solid #ddd; padding-top: 12px; color: black;">
      <b>承製方：</b>${escapeHtml(userName)}
      ${(() => {
        if (!a) return '';
        const parts = [];
        if (a.bank) parts.push(a.bank);
        if (a.account) parts.push(a.account);
        if (a.holderName) parts.push('戶名 ' + a.holderName);
        const text = parts.length ? `<br>${escapeHtml(parts.join(' / '))}` : '';
        // v3.2.1：dataUrl 已 pre-fetch，直接 inline 不再用 placeholder
        const img = bankbookDataUrl
          ? `<div style="margin-top: 8px;"><img src="${bankbookDataUrl}" alt="存摺" style="max-width: 240px; max-height: 140px; border-radius: 4px; border: 1px solid #ddd;"></div>`
          : '';
        return text + img;
      })()}
    </div>` : ''}
  `;
  document.body.appendChild(tempBox);
  try {
    toastProgress('🎨 渲染中...');
    await loadScript(HTML2CANVAS_CDN);
    const canvas = await html2canvas(tempBox, { scale: 2, backgroundColor: '#ffffff' });
    await loadScript(JSPDF_CDN);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    // v3.21.1：PDF metadata 嵌入著作權資訊（嚇阻 + 追蹤）
    pdf.setProperties({
      title: `${tag}_${c?.name || '案件'}_${todayStr()}`,
      author: 'Generated by Freelance Tracker (Cloud) - lancelotwang114',
      creator: 'https://github.com/lancelotwang114/freelance-tracker-cloud',
      keywords: 'PolyForm Noncommercial 1.0.0; Commercial use prohibited',
      subject: '由 Freelance Tracker (Cloud) 產生'
    });
    const pageW = pdf.internal.pageSize.getWidth();
    const margin = 8;
    const imgW = pageW - margin * 2;
    const imgH = (canvas.height * imgW) / canvas.width;
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, imgW, imgH);
    pdf.save(`${tag}_${c?.name || '案件'}_${todayStr()}.pdf`);
    toastDismiss();
    toast('✓ 已下載 PDF');
  } catch (err) {
    toastDismiss();
    toast('匯出失敗：' + err.message);
  } finally {
    tempBox.remove();
  }
}

function confirmEstimateAsJob() {
  if (!editingJobId) return;
  if (!confirm('確認接案？\n\n會把這張估價單轉成正式案件，計入收益統計。')) return;
  const j = state.jobs.find(x => x.id === editingJobId);
  if (!j) return;
  j.isEstimate = false;
  save();
  toast('✓ 已轉為正式案件');
  closeJobModal();
  render();
}

// ============== iCal 訂閱（v2.5）==============
function getIcalUrl() {
  const cfg = config.sheetConfig;
  if (!cfg?.apiUrl || !cfg?.apiToken) return null;
  return cfg.apiUrl + '?action=ical&token=' + encodeURIComponent(cfg.apiToken);
}

async function copyIcalUrl() {
  const url = getIcalUrl();
  if (!url) { toast('請先設定雲端同步'); return; }
  try {
    await navigator.clipboard.writeText(url);
    toast('✓ 已複製訂閱連結到剪貼簿', 4000);
  } catch (err) {
    // fallback
    prompt('複製此連結（Ctrl+C / Cmd+C）：', url);
  }
}

function showIcalHelp() {
  const url = getIcalUrl();
  const msg = [
    '📅 將案件截止日加入行事曆',
    '',
    '【Google Calendar (網頁)】',
    '1. 左側「其他日曆」旁的 + 號',
    '2. 選「以網址加入」',
    '3. 貼上訂閱連結 → 加入',
    '',
    '【iPhone / iPad】',
    '1. 設定 → 行事曆 → 帳號 → 新增帳號',
    '2. 其他 → 新增訂閱式行事曆',
    '3. 伺服器：貼上訂閱連結',
    '',
    '【macOS 行事曆】',
    '1. 檔案 → 新增行事曆訂閱',
    '2. 貼上連結',
    '',
    '訂閱後行事曆會每 15-60 分鐘自動更新（依 APP 而定）。',
    '截止日會顯示為全天事件，提前 1 天有提醒。'
  ].join('\n');
  alert(msg);
}

// ============== 瀏覽器原生通知（v2.5）==============
const NOTIF_ENABLED_KEY = 'cloud-ftNotifEnabled_v1';      // v3.0.0-alpha.1：cloud- 前綴隔離 v2
const NOTIF_LAST_FIRED_KEY = 'cloud-ftNotifLastFired_v1'; // v3.0.0-alpha.1：cloud- 前綴隔離 v2

function notifSupported() {
  return 'Notification' in window;
}

async function requestNotifPermission() {
  if (!notifSupported()) { toast('此瀏覽器不支援通知'); return; }
  if (Notification.permission === 'granted') {
    localStorage.setItem(NOTIF_ENABLED_KEY, '1');
    toast('✓ 通知已啟用');
    sendTestNotification();
    updateNotifUI();
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    localStorage.setItem(NOTIF_ENABLED_KEY, '1');
    toast('✓ 通知已啟用');
    sendTestNotification();
  } else if (perm === 'denied') {
    toast('❌ 已拒絕。要重新啟用須到瀏覽器設定打開', 5000);
  }
  updateNotifUI();
}

function disableNotif() {
  localStorage.setItem(NOTIF_ENABLED_KEY, '0');
  toast('已停用通知');
  updateNotifUI();
}

function isNotifEnabled() {
  return notifSupported() &&
         Notification.permission === 'granted' &&
         localStorage.getItem(NOTIF_ENABLED_KEY) === '1';
}

function sendTestNotification() {
  if (!isNotifEnabled()) return;
  new Notification('外包收益管理', {
    body: '✓ 通知已啟用！截止日、拖款警告會即時跳出。',
    icon: 'icons/icon.svg',
    tag: 'ftracker-test'
  });
}

// 開頁時掃一次：把 alert 推成系統通知（一天一次，避免狂跳）
function maybeFireNotifications() {
  if (!isNotifEnabled()) return;
  const today = todayStr();
  const lastFired = localStorage.getItem(NOTIF_LAST_FIRED_KEY);
  if (lastFired === today) return;  // 今天已通知過
  const alerts = computeAlerts();
  const important = alerts.filter(a => ['overdue', 'due-soon', 'unpaid-long', 'slow-pay'].includes(a.type));
  if (!important.length) return;
  // 統整成一則
  const top = important[0];
  const more = important.length > 1 ? `（還有 ${important.length - 1} 項）` : '';
  const body = important.map(a => `${a.icon} ${a.title}`).join('\n').slice(0, 200);
  const n = new Notification(top.title + more, {
    body,
    icon: 'icons/icon.svg',
    tag: 'ftracker-daily',
    requireInteraction: false
  });
  n.onclick = () => {
    window.focus();
    switchTab('dashboard');
    n.close();
  };
  localStorage.setItem(NOTIF_LAST_FIRED_KEY, today);
}

// @deprecated v3.24.16 — 桌面通知 UI 已隨「🔔 通知與提醒」card 整段刪除，這函式不會再被任何地方呼叫
// （maybeFireNotifications 也已停掉自動觸發）。整段保留以備未來恢復；如確定永不恢復可整段刪除。
function updateNotifUI() {
  const status = document.getElementById('notif-status');
  const enableBtn = document.getElementById('notif-enable-btn');
  const disableBtn = document.getElementById('notif-disable-btn');
  // v3.6.2：denied 狀態額外顯示瀏覽器設定步驟引導
  const deniedHelp = document.getElementById('notif-denied-help');
  if (!status) return;  // v3.24.16：element 已不存在，永遠 early return
  if (!notifSupported()) {
    status.textContent = '❌ 此瀏覽器不支援';
    if (enableBtn) enableBtn.disabled = true;
    deniedHelp?.classList.add('hidden');
  } else if (Notification.permission === 'denied') {
    status.textContent = '🚫 已被瀏覽器拒絕';
    deniedHelp?.classList.remove('hidden');
    enableBtn?.classList.add('hidden');
    disableBtn?.classList.add('hidden');
  } else if (isNotifEnabled()) {
    status.textContent = '✅ 已啟用';
    enableBtn?.classList.add('hidden');
    disableBtn?.classList.remove('hidden');
    deniedHelp?.classList.add('hidden');
  } else {
    status.textContent = '⏸ 未啟用';
    enableBtn?.classList.remove('hidden');
    disableBtn?.classList.add('hidden');
    deniedHelp?.classList.add('hidden');
  }
}

// v3.3.1：v2 showCloudCapacity（Sheet 容量監控）已物理移除；v3 用 cloudShowSnapshotModal 顯示

// ============== 模糊比對（v2.7）==============
// Levenshtein 距離（標準化到 0-1，1 = 完全一樣）
function similarity(a, b) {
  a = String(a || '').toLowerCase().trim();
  b = String(b || '').toLowerCase().trim();
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;
  // 簡化版 Levenshtein
  const len1 = a.length, len2 = b.length;
  const dp = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));
  for (let i = 0; i <= len1; i++) dp[i][0] = i;
  for (let j = 0; j <= len2; j++) dp[0][j] = j;
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (a[i-1] === b[j-1]) dp[i][j] = dp[i-1][j-1];
      else dp[i][j] = 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return 1 - dp[len1][len2] / Math.max(len1, len2);
}

// 找出可能重複的業主
function findFuzzyDupClients(threshold = 0.75) {
  const cs = state.clients;
  const dupes = [];
  const seen = new Set();
  for (let i = 0; i < cs.length; i++) {
    for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j];
      const s = similarity(a.name, b.name);
      if (s >= threshold && s < 1) {  // 完全一樣的另外處理
        const key = [a.id, b.id].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        dupes.push({ a, b, similarity: +s.toFixed(2) });
      }
    }
  }
  return dupes.sort((x, y) => y.similarity - x.similarity);
}

// 找出可能重複的案件（同業主、同月、相似標題）
function findFuzzyDupJobs(threshold = 0.85) {
  const jobs = state.jobs.filter(j => !j.cancelled && !j.isEstimate);
  // 按 業主+月份 分組
  const groups = {};
  jobs.forEach(j => {
    const key = j.clientId + '|' + (j.date || '').slice(0, 7);
    if (!groups[key]) groups[key] = [];
    groups[key].push(j);
  });
  const dupes = [];
  Object.values(groups).forEach(group => {
    if (group.length < 2) return;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i], b = group[j];
        const s = similarity(a.title, b.title);
        if (s >= threshold) {
          dupes.push({ a, b, similarity: +s.toFixed(2) });
        }
      }
    }
  });
  return dupes.sort((x, y) => y.similarity - x.similarity);
}

// v3.3.1：v2 資料健檢整套（runDataHealthCheck / showHealthCheckModal / runHealthAction）已物理移除

// ============== 範本系統（案件描述常用片語）==============
const TEMPLATES_KEY = 'cloud-ftJobTemplates_v1';  // v3.0.0-alpha.1：cloud- 前綴隔離 v2

function getTemplates() {
  try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]'); }
  catch (_) { return []; }
}
function setTemplates(arr) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(arr));
}

function openTemplatePicker() {
  const box = document.getElementById('template-picker');
  if (!box) return;
  if (!box.classList.contains('hidden')) {
    box.classList.add('hidden');
    return;
  }
  const list = getTemplates();
  if (!list.length) {
    box.innerHTML = '<div style="font-size: 12px; color: var(--muted); padding: 8px; text-align: center;">尚無範本，先在文字框打字後按「💾 存範本」儲存</div>';
  } else {
    box.innerHTML = list.map((t, i) => `
      <div style="display: flex; gap: 6px; align-items: flex-start; padding: 6px; border-bottom: 1px solid var(--border);">
        <div style="flex: 1; font-size: 13px; cursor: pointer; white-space: pre-wrap;" onclick="useTemplate(${i})">${escapeHtml(t.length > 80 ? t.slice(0, 80) + '…' : t)}</div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="deleteTemplate(${i})" style="color: var(--danger); padding: 2px 6px;">✕</button>
      </div>
    `).join('');
  }
  box.classList.remove('hidden');
}

function useTemplate(i) {
  const list = getTemplates();
  const t = list[i];
  if (!t) return;
  const ta = document.getElementById('job-details');
  if (!ta) return;
  // 如果已有內容 → 在後面接上；空的就直接帶入
  ta.value = ta.value.trim() ? (ta.value + '\n' + t) : t;
  document.getElementById('template-picker')?.classList.add('hidden');
  toast('✓ 已帶入範本');
}

function deleteTemplate(i) {
  const list = getTemplates();
  list.splice(i, 1);
  setTemplates(list);
  openTemplatePicker();  // 重畫
  // 再開一次（toggle 邏輯有點繞，直接強制顯示）
  document.getElementById('template-picker')?.classList.remove('hidden');
  toast('已刪除範本');
}

function saveCurrentAsTemplate() {
  const ta = document.getElementById('job-details');
  const text = ta?.value?.trim() || '';
  if (!text) { toast('文字框是空的'); return; }
  if (text.length < 5) { toast('範本內容太短（至少 5 字）'); return; }
  const list = getTemplates();
  if (list.includes(text)) { toast('已有相同範本'); return; }
  list.unshift(text);  // 新範本放最前
  if (list.length > 30) list.length = 30;  // 最多 30 個
  setTemplates(list);
  toast(`✓ 已存範本（共 ${list.length} 個）`, 3000);
}

// ============== Invoice 匯出（PDF / 圖片）==============
const HTML2CANVAS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
const JSPDF_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

function getInvoiceFilename(ext) {
  const sel = document.getElementById('inv-client');
  const c = state.clients.find(x => x.id === sel?.value);
  const cname = c ? c.name : 'invoice';
  const m = document.getElementById('inv-month')?.value || '';
  const mEnd = document.getElementById('inv-month-end')?.value || '';
  const range = (mEnd && mEnd !== m) ? `${m}_${mEnd}` : m;
  return `請款單_${cname}_${range}.${ext}`.replace(/\s+/g, '');
}

async function captureInvoiceCanvas() {
  const view = document.getElementById('invoice-view');
  if (!view || !view.innerHTML.trim()) {
    toast('請先選擇業主與月份');
    return null;
  }
  // v3.2.1：截圖前先等存摺照片 hydrate 完，避免截到「⏳ 載入中」placeholder
  if (typeof cloudHydrateBankbookImages === 'function') {
    toastProgress('📷 載入存摺照片…');
    try { await cloudHydrateBankbookImages(); }
    catch (e) { console.warn('[invoice-export] hydrate 失敗，繼續截圖（PDF 內可能無存摺）:', e); }
  }
  toastProgress('🎨 渲染中...');
  await loadScript(HTML2CANVAS_CDN);
  // 用較高 scale 提升解析度（不會太糊）
  const canvas = await html2canvas(view, {
    scale: 2,
    backgroundColor: getComputedStyle(document.body).getPropertyValue('--card').trim() || '#ffffff',
    useCORS: true,
    logging: false
  });
  return canvas;
}

async function exportInvoicePNG() {
  try {
    const canvas = await captureInvoiceCanvas();
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = getInvoiceFilename('png');
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('✓ 已下載圖片');
    recordInvoiceHistory('png');  // v3.12.0
  } catch (err) {
    toastDismiss();
    toast('匯出失敗：' + err.message);
  }
}

// v2.10.3：直接把請款單圖片複製到剪貼簿，使用者可貼到 LINE / Messenger / Email
async function copyInvoiceImage() {
  try {
    const canvas = await captureInvoiceCanvas();
    if (!canvas) return;
    // Canvas → Blob → ClipboardItem
    canvas.toBlob(async (blob) => {
      if (!blob) { toastDismiss(); toast('產生圖片失敗'); return; }
      try {
        if (!navigator.clipboard || !window.ClipboardItem) {
          toastDismiss();
          alert('此瀏覽器不支援複製圖片到剪貼簿，請改用「下載圖片」按鈕。\n\n（建議瀏覽器：Chrome / Edge / Safari 最新版）');
          return;
        }
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        toastDismiss();
        toast('✓ 已複製，可直接貼到 LINE / Messenger / Email');
        logAction('invoice-copy', { summary: '複製請款單到剪貼簿' });
        recordInvoiceHistory('image-copy');  // v3.12.0
      } catch (err) {
        toastDismiss();
        // 常見原因：頁面沒有 focus、HTTPS 限制等
        if (String(err).includes('NotAllowedError') || String(err).includes('Document is not focused')) {
          alert('複製失敗：請先點一下頁面任何地方再試（瀏覽器要求頁面在前景才允許複製）。');
        } else {
          alert('複製失敗：' + err.message + '\n\n你的瀏覽器可能不支援，請改用「下載圖片」。');
        }
      }
    }, 'image/png');
  } catch (err) {
    toastDismiss();
    toast('匯出失敗：' + err.message);
  }
}

async function exportInvoicePDF() {
  try {
    // v3.23.3：mascot loading
    if (typeof mascotSay === 'function') mascotSay('export-pdf');
    const canvas = await captureInvoiceCanvas();
    if (!canvas) return;
    toastProgress('📄 產生 PDF...');
    await loadScript(JSPDF_CDN);
    const { jsPDF } = window.jspdf;

    // A4 尺寸：210mm × 297mm；用 mm 為單位
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    // v3.21.1：PDF metadata 嵌入著作權資訊
    pdf.setProperties({
      title: '請款單 - ' + todayStr(),
      author: 'Generated by Freelance Tracker (Cloud) - lancelotwang114',
      creator: 'https://github.com/lancelotwang114/freelance-tracker-cloud',
      keywords: 'PolyForm Noncommercial 1.0.0; Commercial use prohibited',
      subject: '由 Freelance Tracker (Cloud) 產生'
    });
    const pageW = pdf.internal.pageSize.getWidth();   // 210
    const pageH = pdf.internal.pageSize.getHeight();  // 297
    const margin = 8;
    const usableW = pageW - margin * 2;

    const imgW = usableW;
    const imgH = (canvas.height * imgW) / canvas.width;
    const imgData = canvas.toDataURL('image/png');

    // 內容比一頁長 → 分頁
    if (imgH <= pageH - margin * 2) {
      pdf.addImage(imgData, 'PNG', margin, margin, imgW, imgH);
    } else {
      // 把整張圖切成多頁
      let position = margin;
      let heightLeft = imgH;
      pdf.addImage(imgData, 'PNG', margin, position, imgW, imgH);
      heightLeft -= (pageH - margin * 2);
      while (heightLeft > 0) {
        position = heightLeft - imgH + margin;  // 負位移把上半部推到頁面外
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgW, imgH);
        heightLeft -= (pageH - margin * 2);
      }
    }
    pdf.save(getInvoiceFilename('pdf'));
    toast('✓ 已下載 PDF');
    recordInvoiceHistory('pdf');  // v3.12.0
    // v3.23.3：完成後切到 success
    if (typeof mascotSetState === 'function') mascotSetState('success');
  } catch (err) {
    toast('匯出失敗：' + err.message);
    // v3.23.3：失敗 error
    if (typeof mascotSetState === 'function') mascotSetState('error');
  }
}

// v3.12.0：列印 wrapper（順手記錄到歷史）
function printInvoice() {
  recordInvoiceHistory('print');
  window.print();
}

// ============== v3.12.0: 請款單歷史紀錄 ==============
const INVOICE_STATUSES = [
  { v: 'pending', label: '⚪ 待寄出', color: 'var(--muted)' },
  { v: 'sent', label: '✉️ 已寄出', color: 'var(--primary)' },
  { v: 'partial', label: '💰 部分收款', color: 'var(--warning)' },
  { v: 'paid', label: '✅ 已收齊', color: 'var(--success)' },
  { v: 'cancelled', label: '❌ 已取消', color: 'var(--muted)' }
];
const INVOICE_FORMAT_LABELS = {
  pdf: '📄 PDF',
  png: '🖼️ PNG',
  'image-copy': '📋 複製圖',
  'text-copy': '📋 複製字',
  print: '🖨️ 列印'
};

// 計算當前請款單視圖對應的「將要記錄的內容」
function getCurrentInvoiceSnapshot() {
  const cid = document.getElementById('inv-client')?.value;
  if (!cid) return null;
  const c = getClient(cid);
  if (!c) return null;
  const mode = document.getElementById('inv-mode')?.value || 'single';
  let rangeStart, rangeEnd, periodLabel;
  if (mode === 'range') {
    let s = document.getElementById('inv-date-start')?.value || '';
    let e = document.getElementById('inv-date-end')?.value || '';
    if (!s || !e) {
      const now = new Date();
      s = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
      e = todayStr();
    }
    if (e < s) { const t = s; s = e; e = t; }
    rangeStart = s; rangeEnd = e; periodLabel = `${s} ~ ${e}`;
  } else {
    const mm = document.getElementById('inv-month')?.value || thisMonth();
    rangeStart = mm + '-01';
    const [yy, mmNum] = mm.split('-').map(Number);
    const lastDay = new Date(yy, mmNum, 0).getDate();
    rangeEnd = mm + '-' + String(lastDay).padStart(2, '0');
    periodLabel = mm;
  }
  const allJobs = state.jobs.filter(j => {
    if (j.clientId !== cid) return false;
    const d = j.date || '';
    return d >= rangeStart && d <= rangeEnd;
  });
  const statusFilter = (typeof getInvoiceStatusFilter === 'function') ? getInvoiceStatusFilter() : null;
  const jobs = statusFilter ? allJobs.filter(j => statusFilter.has(jobInvoiceCategory(j))) : allJobs;
  const acct = getActivePaymentAccount();
  return {
    client: c,
    mode, rangeStart, rangeEnd, periodLabel,
    jobs,
    jobIds: jobs.map(j => j.id),
    totalAmount: jobs.reduce((s, j) => s + jobFinalAmount(j), 0),
    paymentAccount: acct
  };
}

// 每次匯出 / 列印 / 複製 完成後呼叫，記一筆
function recordInvoiceHistory(format) {
  const snap = getCurrentInvoiceSnapshot();
  if (!snap || !snap.jobs.length) return;
  const entry = {
    id: 'inv_' + Math.random().toString(36).slice(2, 12),
    createdAt: new Date().toISOString(),
    clientId: snap.client.id,
    clientName: snap.client.name,
    paymentAccountId: snap.paymentAccount ? snap.paymentAccount.id : '',
    paymentAccountLabel: snap.paymentAccount ? snap.paymentAccount.label : '',
    mode: snap.mode,
    rangeStart: snap.rangeStart,
    rangeEnd: snap.rangeEnd,
    periodLabel: snap.periodLabel,
    jobIds: snap.jobIds,
    jobCount: snap.jobs.length,
    totalAmount: snap.totalAmount,
    status: 'pending',
    statusUpdatedAt: new Date().toISOString(),
    note: '',
    exportFormat: format
  };
  state.invoiceHistory = state.invoiceHistory || [];
  state.invoiceHistory.unshift(entry);
  // 上限 200 筆，避免無限累積
  if (state.invoiceHistory.length > 200) state.invoiceHistory = state.invoiceHistory.slice(0, 200);
  save();
  if (typeof logAction === 'function') {
    logAction('invoice-export', { format, clientName: snap.client.name, jobCount: snap.jobs.length, totalAmount: snap.totalAmount });
  }
  renderInvoiceHistory();
}

function setInvoiceHistoryStatus(historyId, status) {
  const e = (state.invoiceHistory || []).find(x => x.id === historyId);
  if (!e) return;
  e.status = status;
  e.statusUpdatedAt = new Date().toISOString();
  save();
  renderInvoiceHistory();
  if (typeof logAction === 'function') logAction('invoice-status-change', { historyId, status });
  toast(`✓ 已更新狀態為「${(INVOICE_STATUSES.find(x => x.v === status) || {}).label || status}」`, 2500);
}

function deleteInvoiceHistory(historyId) {
  if (!confirm('確定刪除這筆請款紀錄？案件本身不會被刪。')) return;
  state.invoiceHistory = (state.invoiceHistory || []).filter(x => x.id !== historyId);
  save();
  renderInvoiceHistory();
  toast('已刪除這筆紀錄');
}

// 一鍵重發：把 invoice 控制套到該紀錄的條件，使用者再按下方匯出按鈕即可
function reissueInvoice(historyId) {
  const e = (state.invoiceHistory || []).find(x => x.id === historyId);
  if (!e) { toast('找不到此紀錄'); return; }
  const cSel = document.getElementById('inv-client');
  const mSel = document.getElementById('inv-mode');
  const moInp = document.getElementById('inv-month');
  const dsInp = document.getElementById('inv-date-start');
  const deInp = document.getElementById('inv-date-end');
  const paSel = document.getElementById('inv-pay-account');
  if (cSel) cSel.value = e.clientId;
  if (mSel) mSel.value = e.mode;
  if (e.mode === 'range') {
    if (dsInp) dsInp.value = e.rangeStart;
    if (deInp) deInp.value = e.rangeEnd;
  } else {
    if (moInp) moInp.value = e.periodLabel;
  }
  if (paSel && e.paymentAccountId) paSel.value = e.paymentAccountId;
  if (typeof onInvPayAccountChange === 'function') onInvPayAccountChange();
  if (typeof onInvModeChange === 'function') onInvModeChange();
  if (typeof drawInvoice === 'function') drawInvoice();
  document.getElementById('invoice-view')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  toast('✓ 已套用該紀錄條件，按上方匯出按鈕即可重發', 4500);
}

function renderInvoiceHistory() {
  const box = document.getElementById('invoice-history-list');
  if (!box) return;
  const list = state.invoiceHistory || [];
  const cnt = document.getElementById('invoice-history-count');
  if (cnt) cnt.textContent = list.length ? `(${list.length} 筆)` : '';
  if (!list.length) {
    box.innerHTML = '<div class="reminder-hint" style="text-align: center; padding: 20px;">還沒有任何請款紀錄。匯出第一張請款單後就會出現在這裡。</div>';
    return;
  }
  const sorted = [...list].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  box.innerHTML = sorted.map(e => {
    const dt = new Date(e.createdAt);
    const dtStr = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
    const fmtMeta = INVOICE_FORMAT_LABELS[e.exportFormat] || (e.exportFormat || '');
    const statusOptions = INVOICE_STATUSES.map(s => `<option value="${s.v}" ${s.v===e.status?'selected':''}>${s.label}</option>`).join('');
    return `
      <div class="invoice-history-row" data-status="${e.status}">
        <div class="invoice-history-main">
          <div class="invoice-history-line1">
            <span class="invoice-history-date">${dtStr}</span>
            <span class="invoice-history-client">${escapeHtml(e.clientName || '（無業主名）')}</span>
            <span class="invoice-history-amount">${fmt(e.totalAmount)}</span>
          </div>
          <div class="invoice-history-line2">
            ${e.jobCount} 筆案件 · ${escapeHtml(e.periodLabel || '')}${e.paymentAccountLabel ? ' · ' + escapeHtml(e.paymentAccountLabel) : ''} · ${fmtMeta}
          </div>
        </div>
        <div class="invoice-history-actions">
          <select class="invoice-history-status" onchange="setInvoiceHistoryStatus('${e.id}', this.value)" title="更新狀態">${statusOptions}</select>
          <button class="btn btn-outline btn-sm" onclick="reissueInvoice('${e.id}')" title="套用相同條件重新編輯/匯出">📋 重發</button>
          <button class="btn btn-ghost btn-sm" onclick="deleteInvoiceHistory('${e.id}')" title="刪除這筆紀錄" style="color: var(--danger);">🗑️</button>
        </div>
      </div>`;
  }).join('');
}

// ============== v2.9: 收款時間軸 ==============
function renderPaymentTimeline() {
  const box = document.getElementById('rev-payment-timeline');
  if (!box) return;
  // 收集所有 payment（按月分組）
  const byMonth = {};
  activeJobs().forEach(j => {
    (j.payments || []).forEach(p => {
      if (!p.date) return;
      const m = p.date.slice(0, 7);
      if (!byMonth[m]) byMonth[m] = { total: 0, count: 0, byClient: {} };
      byMonth[m].total += +p.amount || 0;
      byMonth[m].count++;
      const c = getClient(j.clientId);
      const cname = c?.name || '?';
      byMonth[m].byClient[cname] = (byMonth[m].byClient[cname] || 0) + (+p.amount || 0);
    });
  });

  // 取最近 12 個月（含空月）
  const now = new Date();
  const months = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  }

  const max = Math.max(...months.map(m => byMonth[m]?.total || 0), 1);
  if (max === 1) {
    box.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--muted); font-size: 13px;">最近 12 個月還沒有收款紀錄</div>';
    return;
  }

  const total = months.reduce((s,m) => s + (byMonth[m]?.total || 0), 0);
  const avgMonthly = Math.round(total / months.filter(m => byMonth[m]?.total > 0).length || 1);

  const bars = months.map(m => {
    const data = byMonth[m] || { total: 0, count: 0 };
    const h = data.total > 0 ? Math.max(8, (data.total / max) * 140) : 4;
    const isCurrent = m === months[months.length - 1];
    const yymm = m.slice(2);  // 26-04
    return `<div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;" title="${m}：${fmt(data.total)} (${data.count} 筆)">
      <div style="font-size: 10px; color: var(--muted);">${data.total>0 ? Math.round(data.total/1000)+'k' : ''}</div>
      <div style="height: ${h}px; width: 70%; background: ${isCurrent?'var(--primary)':'var(--success)'}; border-radius: 3px; opacity: ${data.total>0?1:0.3};"></div>
      <div style="font-size: 10px; color: var(--muted); white-space: nowrap;">${yymm}</div>
    </div>`;
  }).join('');

  box.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-bottom: 12px;">
      <div style="background: var(--bg); padding: 10px; border-radius: 8px;">
        <div style="font-size: 11px; color: var(--muted);">12 個月總入帳</div>
        <div style="font-size: 18px; font-weight: 700; color: var(--success);">${fmt(total)}</div>
      </div>
      <div style="background: var(--bg); padding: 10px; border-radius: 8px;">
        <div style="font-size: 11px; color: var(--muted);">月平均（有入帳的月份）</div>
        <div style="font-size: 18px; font-weight: 700;">${fmt(avgMonthly)}</div>
      </div>
    </div>
    <div style="display: flex; gap: 4px; align-items: flex-end; height: 170px;">${bars}</div>
  `;
}

// ============== v2.7: 忙閒週期分析 ==============
function renderBusyCycle() {
  const box = document.getElementById('rev-busy-cycle');
  if (!box) return;
  const jobs = activeJobs().filter(j => j.date);
  if (jobs.length < 5) {
    box.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--muted); font-size: 13px;">資料量不足（至少 5 筆有日期的案件）</div>';
    return;
  }

  // 月份分布（1-12 月）
  const byMonth = Array(12).fill(0);
  const byMonthAmt = Array(12).fill(0);
  // 週幾分布（0=週日 ~ 6=週六）
  const byDow = Array(7).fill(0);
  const byDowAmt = Array(7).fill(0);

  jobs.forEach(j => {
    const d = new Date(j.date);
    if (isNaN(d)) return;
    const m = d.getMonth();
    const dow = d.getDay();
    byMonth[m]++;
    byDow[dow]++;
    const amt = +j.amount || 0;
    byMonthAmt[m] += amt;
    byDowAmt[dow] += amt;
  });

  const monthNames = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  const dowNames = ['週日','週一','週二','週三','週四','週五','週六'];
  const maxMonth = Math.max(...byMonth, 1);
  const maxDow = Math.max(...byDow, 1);

  // 找出最忙月與最忙日
  const peakMonthIdx = byMonth.indexOf(Math.max(...byMonth));
  const slackMonthIdx = byMonth.indexOf(Math.min(...byMonth.filter(v => v > 0).length ? byMonth.map((v,i) => v === 0 ? Infinity : v) : byMonth));
  const peakDowIdx = byDow.indexOf(Math.max(...byDow));

  const monthBars = monthNames.map((n, i) => {
    const h = Math.max(4, (byMonth[i] / maxMonth) * 100);
    const isPeak = i === peakMonthIdx && byMonth[i] > 0;
    return `<div style="flex:1; display:flex; flex-direction: column; align-items: center; gap: 2px;">
      <div style="font-size: 10px; color: var(--muted);">${byMonth[i] || ''}</div>
      <div style="height: ${h}px; width: 80%; background: ${isPeak ? 'var(--primary)' : 'var(--primary-light)'}; border-radius: 3px;"></div>
      <div style="font-size: 11px; color: ${isPeak ? 'var(--primary)' : 'var(--text)'}; font-weight: ${isPeak?'600':'400'};">${n}</div>
    </div>`;
  }).join('');

  const dowBars = dowNames.map((n, i) => {
    const h = Math.max(4, (byDow[i] / maxDow) * 100);
    const isPeak = i === peakDowIdx && byDow[i] > 0;
    return `<div style="flex:1; display:flex; flex-direction: column; align-items: center; gap: 2px;">
      <div style="font-size: 10px; color: var(--muted);">${byDow[i] || ''}</div>
      <div style="height: ${h}px; width: 80%; background: ${isPeak ? 'var(--success)' : 'var(--success-light)'}; border-radius: 3px;"></div>
      <div style="font-size: 11px; color: ${isPeak ? 'var(--success)' : 'var(--text)'}; font-weight: ${isPeak?'600':'400'};">${n}</div>
    </div>`;
  }).join('');

  // 月份排序找出 Top3 與 Bottom3
  const monthRanked = monthNames.map((n, i) => ({ n, i, count: byMonth[i], amt: byMonthAmt[i] })).sort((a,b) => b.count - a.count);
  const top3 = monthRanked.slice(0, 3).filter(x => x.count > 0).map(x => x.n).join('、') || '—';
  const bot3 = monthRanked.slice(-3).filter(x => x.count > 0).reverse().map(x => x.n).join('、') || '—';

  box.innerHTML = `
    <div style="font-size: 12px; color: var(--muted); margin-bottom: 6px;">📈 月份分布（每月案件數）</div>
    <div style="display: flex; gap: 4px; align-items: flex-end; height: 130px; margin-bottom: 16px;">${monthBars}</div>

    <div style="font-size: 12px; color: var(--muted); margin-bottom: 6px;">📅 週幾分布（每週幾接幾筆）</div>
    <div style="display: flex; gap: 4px; align-items: flex-end; height: 130px; margin-bottom: 12px;">${dowBars}</div>

    <div style="background: var(--bg); padding: 10px; border-radius: 8px; font-size: 13px; line-height: 1.7;">
      <div>🔥 <b>最忙月份</b>：${top3}</div>
      <div>😴 <b>最閒月份</b>：${bot3}</div>
      <div>📅 <b>最常接案的週幾</b>：${dowNames[peakDowIdx]}（${byDow[peakDowIdx]} 筆）</div>
    </div>
  `;
}

// ============== v2.7: 個人時薪趨勢 ==============
function renderHourlyTrend() {
  const box = document.getElementById('rev-hourly-trend');
  if (!box) return;
  // 只看有填工時 + 有金額 + 有日期 + 沒取消 + 不是估價
  const jobs = state.jobs.filter(j => !j.cancelled && !j.isEstimate && j.date && +j.amount > 0 && +j.hoursWorked > 0);
  if (jobs.length < 3) {
    box.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--muted); font-size: 13px;">
      資料量不足（至少 3 筆有填工時的案件）<br>
      <span style="font-size: 11px;">在案件 modal 填「工時」欄位即可累積資料</span>
    </div>`;
    return;
  }

  // 按月分組
  // v3.22.5：時薪用 jobFinalAmount（折扣後）/ 工時，才是實領時薪
  const byMonth = {};
  jobs.forEach(j => {
    const m = getMonth(j.date);
    if (!byMonth[m]) byMonth[m] = { totalAmt: 0, totalHrs: 0, count: 0 };
    byMonth[m].totalAmt += jobFinalAmount(j);
    byMonth[m].totalHrs += +j.hoursWorked;
    byMonth[m].count++;
  });

  const months = Object.keys(byMonth).sort();
  const recent = months.slice(-12);  // 最近 12 個月
  const rates = recent.map(m => {
    const s = byMonth[m];
    return { month: m, rate: s.totalAmt / s.totalHrs, count: s.count };
  });

  if (rates.length < 2) {
    box.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--muted); font-size: 13px;">資料分布太集中（同一個月份）</div>`;
    return;
  }

  const maxRate = Math.max(...rates.map(r => r.rate));
  const minRate = Math.min(...rates.map(r => r.rate));
  const avg = rates.reduce((s,r) => s + r.rate, 0) / rates.length;

  const bars = rates.map(r => {
    const pct = (r.rate / maxRate) * 100;
    const colorClass = r.rate > avg * 1.1 ? 'var(--success)' : (r.rate < avg * 0.9 ? 'var(--warning)' : 'var(--primary)');
    return `<div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px;">
      <div style="font-size: 10px; color: var(--muted);">${Math.round(r.rate).toLocaleString()}</div>
      <div style="height: ${pct * 1.4}px; width: 70%; background: ${colorClass}; border-radius: 3px;" title="${r.month}: NT$ ${Math.round(r.rate)}/hr （${r.count} 筆）"></div>
      <div style="font-size: 10px; color: var(--muted); white-space: nowrap;">${r.month.slice(2)}</div>
    </div>`;
  }).join('');

  // 整體統計
  // v3.22.5：用 jobFinalAmount（折扣後）算實領時薪
  const totalAmt = jobs.reduce((s,j) => s + jobFinalAmount(j), 0);
  const totalHrs = jobs.reduce((s,j) => s + (+j.hoursWorked || 0), 0);
  const overallAvg = totalAmt / totalHrs;
  const trend = rates.length >= 6
    ? (rates.slice(-3).reduce((s,r)=>s+r.rate,0)/3) - (rates.slice(-6,-3).reduce((s,r)=>s+r.rate,0)/3)
    : 0;
  const trendIcon = trend > overallAvg * 0.05 ? '📈 上升' : (trend < -overallAvg * 0.05 ? '📉 下滑' : '➡️ 持平');

  box.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; margin-bottom: 12px;">
      <div style="background: var(--bg); padding: 10px; border-radius: 8px;">
        <div style="font-size: 11px; color: var(--muted);">整體平均時薪</div>
        <div style="font-size: 18px; font-weight: 700; color: var(--primary);">NT$ ${Math.round(overallAvg).toLocaleString()}/hr</div>
      </div>
      <div style="background: var(--bg); padding: 10px; border-radius: 8px;">
        <div style="font-size: 11px; color: var(--muted);">累計工時</div>
        <div style="font-size: 18px; font-weight: 700;">${Math.round(totalHrs).toLocaleString()} 小時</div>
      </div>
      <div style="background: var(--bg); padding: 10px; border-radius: 8px;">
        <div style="font-size: 11px; color: var(--muted);">趨勢（近 3 月 vs 前 3 月）</div>
        <div style="font-size: 16px; font-weight: 600;">${trendIcon}</div>
      </div>
    </div>
    <div style="font-size: 12px; color: var(--muted); margin-bottom: 6px;">最近 ${rates.length} 個月每月平均時薪</div>
    <div style="display: flex; gap: 4px; align-items: flex-end; height: 160px;">${bars}</div>
    <div style="font-size: 11px; color: var(--muted); margin-top: 6px;">
      綠色 = 高於平均 10%；橘色 = 低於平均 10%；藍色 = 接近平均
    </div>
  `;
}

// ============== Invoice Tab ==============
function renderInvoice() {
  const sel = document.getElementById('inv-client');
  const curC = sel.value;
  sel.innerHTML = state.clients.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  if (curC) sel.value = curC;

  const allMonths = [...new Set(state.jobs.map(j => getMonth(j.date)).filter(Boolean))].sort().reverse();
  if (!allMonths.length) allMonths.push(thisMonth());

  const mSel = document.getElementById('inv-month');
  const curM = mSel.value;
  mSel.innerHTML = allMonths.map(m => `<option value="${m}">${m}</option>`).join('');
  if (curM && allMonths.includes(curM)) mSel.value = curM; else mSel.value = thisMonth();

  const mEnd = document.getElementById('inv-month-end');
  if (mEnd) {
    const curMe = mEnd.value;
    mEnd.innerHTML = allMonths.map(m => `<option value="${m}">${m}</option>`).join('');
    if (curMe && allMonths.includes(curMe)) mEnd.value = curMe; else mEnd.value = mSel.value;
  }

  // v2.10.13: 收款帳號下拉
  renderInvoicePayAccountSelect();

  drawInvoice();
}

// v2.10.13: 渲染請款單頁的收款帳號下拉
function renderInvoicePayAccountSelect() {
  const sel = document.getElementById('inv-pay-account');
  if (!sel) return;
  ensurePaymentAccounts();
  const u = config.userInfo || {};
  const list = u.paymentAccounts || [];
  if (!list.length) {
    sel.innerHTML = `<option value="">（尚未設定收款帳號，按右側「➕ 新增」開始）</option>`;
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  sel.innerHTML = list.map(a => {
    const label = a.label || a.bank || '未命名帳號';
    const tail = a.account ? ' · ' + a.account.slice(-4).padStart(4, '*') : '';
    return `<option value="${escapeHtml(a.id)}">${escapeHtml(label)}${escapeHtml(tail)}</option>`;
  }).join('');
  sel.value = u.selectedPaymentAccountId || list[0].id;
  // v3.2.0-ui：picker 重渲染後 → 外層 toggle 跟著更新
  if (typeof syncInvShowPersonalToggles === 'function') syncInvShowPersonalToggles();
}

function onInvPayAccountChange() {
  const sel = document.getElementById('inv-pay-account');
  if (!sel || !sel.value) return;
  config.userInfo.selectedPaymentAccountId = sel.value;
  saveConfigOnly();  // v3.1.0-fix：同步推 Drive
  syncInvShowPersonalToggles();  // v3.2.0-ui：picker 變了 → 外層 toggle 跟著切換目前帳號的設定
  drawInvoice();
}

// v3.2.0-ui：外層 toggle 改變 → 寫入目前選定的 paymentAccount（含個人 + 發票）
function onInvShowPersonalChange() {
  ensurePaymentAccounts();
  const id = (config.userInfo && config.userInfo.selectedPaymentAccountId) || '';
  const list = (config.userInfo && config.userInfo.paymentAccounts) || [];
  const acct = list.find(a => a.id === id);
  if (!acct) {
    toast('還沒選定收款帳號');
    return;
  }
  const cb1 = document.getElementById('inv-show-personal');
  const cb2 = document.getElementById('inv-show-personal-top');
  const cb3 = document.getElementById('inv-show-invoice');
  if (cb1) acct.showPersonalInfo = !!cb1.checked;
  if (cb2) acct.showPersonalInfoOnTop = !!cb2.checked;
  if (cb3) acct.showInvoiceInfo = !!cb3.checked;
  saveConfigOnly();
  drawInvoice();
}

// v3.2.0-ui：從目前選定的 paymentAccount 讀回 3 個 flag 套到 toggle UI
function syncInvShowPersonalToggles() {
  const id = (config.userInfo && config.userInfo.selectedPaymentAccountId) || '';
  const list = (config.userInfo && config.userInfo.paymentAccounts) || [];
  const acct = list.find(a => a.id === id);
  const cb1 = document.getElementById('inv-show-personal');
  const cb2 = document.getElementById('inv-show-personal-top');
  const cb3 = document.getElementById('inv-show-invoice');
  if (cb1) cb1.checked = acct ? (acct.showPersonalInfo !== false) : true;
  if (cb2) cb2.checked = acct ? !!acct.showPersonalInfoOnTop : false;
  if (cb3) cb3.checked = acct ? !!acct.showInvoiceInfo : false;
  // 若沒帳號 → 全部 toggle disabled
  if (cb1) cb1.disabled = !acct;
  if (cb2) cb2.disabled = !acct;
  if (cb3) cb3.disabled = !acct;
}

// v3.2.0：拿目前在請款單下拉選的收款帳號 id
function getInvSelectedAcctId() {
  const sel = document.getElementById('inv-pay-account');
  return sel ? sel.value : '';
}

// v3.2.0：CRUD modal — 開啟（id 為 null 表示新增）
function openPaymentAccountEditor(id) {
  ensurePaymentAccounts();
  const list = (config.userInfo && config.userInfo.paymentAccounts) || [];
  const acct = id ? list.find(a => a.id === id) : null;
  document.getElementById('payment-account-editor-title').textContent = acct ? '編輯收款帳號' : '新增收款帳號';
  document.getElementById('pae-id').value = acct ? acct.id : '';
  document.getElementById('pae-label').value = acct ? (acct.label || '') : '';
  // v3.2.0-ui：showPersonalInfo / showPersonalInfoOnTop / showInvoiceInfo 三個 toggle 已搬到請款單外層
  // modal 內不再讀寫；存檔時直接保留 acct 既有值（編輯）或預設值（新增）
  window._paePending = acct
    ? {
        showPersonalInfo: acct.showPersonalInfo !== false,
        showPersonalInfoOnTop: !!acct.showPersonalInfoOnTop,
        showInvoiceInfo: !!acct.showInvoiceInfo
      }
    : { showPersonalInfo: true, showPersonalInfoOnTop: false, showInvoiceInfo: false };
  document.getElementById('pae-name').value = acct ? (acct.name || '') : '';
  document.getElementById('pae-phone').value = acct ? (acct.phone || '') : '';
  document.getElementById('pae-email').value = acct ? (acct.email || '') : '';
  document.getElementById('pae-invoice-title').value = acct ? (acct.invoiceTitle || '') : '';
  document.getElementById('pae-tax-id').value = acct ? (acct.taxId || '') : '';
  document.getElementById('pae-address').value = acct ? (acct.address || '') : '';
  document.getElementById('pae-invoice-note').value = acct ? (acct.invoiceNote || '') : '';
  document.getElementById('pae-holder-name').value = acct ? (acct.holderName || '') : '';
  document.getElementById('pae-bank').value = acct ? (acct.bank || '') : '';
  document.getElementById('pae-account').value = acct ? (acct.account || '') : '';
  document.getElementById('pae-account-note').value = acct ? (acct.note || '') : '';
  document.getElementById('pae-bankbook-image').value = acct ? (acct.bankbookImage || '') : '';
  document.getElementById('pae-bankbook-fileid').value = acct ? (acct.bankbookImageFileId || '') : '';
  // 渲染 bankbook preview
  paeRenderBankbookPreview();
  document.getElementById('payment-account-editor').classList.add('open');
}

function closePaymentAccountEditor() {
  document.getElementById('payment-account-editor').classList.remove('open');
}

function savePaymentAccountEditor() {
  ensurePaymentAccounts();
  const id = document.getElementById('pae-id').value;
  const data = {
    label: document.getElementById('pae-label').value.trim(),
    // v3.2.0-ui：toggle 已搬出 modal；用暫存的既有值（編輯）或預設（新增）
    showPersonalInfo: (window._paePending && typeof window._paePending.showPersonalInfo === 'boolean') ? window._paePending.showPersonalInfo : true,
    showPersonalInfoOnTop: (window._paePending && typeof window._paePending.showPersonalInfoOnTop === 'boolean') ? window._paePending.showPersonalInfoOnTop : false,
    showInvoiceInfo: (window._paePending && typeof window._paePending.showInvoiceInfo === 'boolean') ? window._paePending.showInvoiceInfo : false,
    name: document.getElementById('pae-name').value.trim(),
    phone: document.getElementById('pae-phone').value.trim(),
    email: document.getElementById('pae-email').value.trim(),
    invoiceTitle: document.getElementById('pae-invoice-title').value.trim(),
    taxId: document.getElementById('pae-tax-id').value.trim(),
    address: document.getElementById('pae-address').value.trim(),
    invoiceNote: document.getElementById('pae-invoice-note').value.trim(),
    holderName: document.getElementById('pae-holder-name').value.trim(),
    bank: document.getElementById('pae-bank').value.trim(),
    account: document.getElementById('pae-account').value.trim(),
    note: document.getElementById('pae-account-note').value.trim(),
    bankbookImage: document.getElementById('pae-bankbook-image').value,
    bankbookImageFileId: document.getElementById('pae-bankbook-fileid').value
  };

  const list = config.userInfo.paymentAccounts;
  if (id) {
    const idx = list.findIndex(a => a.id === id);
    if (idx >= 0) list[idx] = { ...list[idx], ...data };
  } else {
    const newAcct = { id: uid(), ...data };
    list.push(newAcct);
    config.userInfo.selectedPaymentAccountId = newAcct.id;
  }
  saveConfigOnly();
  closePaymentAccountEditor();
  renderInvoicePayAccountSelect();
  drawInvoice();
  toast('✓ 已儲存收款帳號');
}

function deleteSelectedPaymentAccount() {
  const id = getInvSelectedAcctId();
  if (!id) { toast('沒有選中的收款帳號可刪'); return; }
  ensurePaymentAccounts();
  const list = config.userInfo.paymentAccounts;
  const acct = list.find(a => a.id === id);
  if (!acct) return;
  if (!confirm(`確定要刪除收款帳號「${acct.label || acct.bank || '未命名'}」？\n\n（這不會影響任何案件，但下拉選單會少一個選項）`)) return;

  // 若有 Drive 存摺照片，順手刪
  if (acct.bankbookImageFileId && typeof driveDeleteFile === 'function') {
    driveDeleteFile(acct.bankbookImageFileId).catch(e => console.warn('[bankbook] 清除孤兒失敗:', e));
  }

  config.userInfo.paymentAccounts = list.filter(a => a.id !== id);
  if (config.userInfo.selectedPaymentAccountId === id) {
    config.userInfo.selectedPaymentAccountId = (config.userInfo.paymentAccounts[0] && config.userInfo.paymentAccounts[0].id) || '';
  }
  saveConfigOnly();
  renderInvoicePayAccountSelect();
  drawInvoice();
  toast('✓ 已刪除');
}

// 編輯 modal 內存摺照片：壓縮 → 上傳 Drive → 寫 hidden fields
async function paeOnBankbookFileChange(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('請選擇圖片檔'); input.value = ''; return; }

  toastProgress('🖼️ 壓縮圖片中…');
  let dataUrl;
  try {
    dataUrl = await resizeImageToDataUrl(file, 800, 0.7);
  } catch (err) {
    toastDismiss();
    toast('圖片處理失敗：' + (err.message || err));
    input.value = '';
    return;
  }

  // 立刻顯示 preview
  document.getElementById('pae-bankbook-image').value = dataUrl;
  paeRenderBankbookPreview();

  // 嘗試上傳 Drive
  if (isCloudSignedIn() && cloudGetMeta().trackerFileId) {
    toastProgress('☁️ 上傳到 Drive…');
    try {
      const oldFileId = document.getElementById('pae-bankbook-fileid').value;
      const filename = `bankbook-pae-${Date.now()}.jpg`;
      const uploaded = await driveUploadImage(dataUrl, filename);
      document.getElementById('pae-bankbook-fileid').value = uploaded.id;
      document.getElementById('pae-bankbook-image').value = '';  // 清掉 base64
      paeRenderBankbookPreview();
      // 刪舊孤兒
      if (oldFileId && oldFileId !== uploaded.id) {
        driveDeleteFile(oldFileId).catch(() => {});
      }
      toastDismiss();
      toast('✓ 已上傳到 Drive，記得按儲存', 3000);
      if (typeof logAction === 'function') {
        logAction('cloud-image-upload', { fileId: uploaded.id, source: 'pae' });
      }
    } catch (e) {
      console.warn('[bankbook] Drive 上傳失敗，fallback 寫 base64:', e);
      toastDismiss();
      toast('⚠️ Drive 上傳失敗，圖片暫存本機', 4000);
    }
  } else {
    toastDismiss();
    toast('⚠️ 未登入 Drive，圖片暫存本機；登入後自動遷移', 4000);
  }
  input.value = '';
}

function paeClearBankbook() {
  const oldFileId = document.getElementById('pae-bankbook-fileid').value;
  document.getElementById('pae-bankbook-image').value = '';
  document.getElementById('pae-bankbook-fileid').value = '';
  paeRenderBankbookPreview();
  if (oldFileId && typeof driveDeleteFile === 'function') {
    driveDeleteFile(oldFileId).catch(() => {});
  }
  toast('✓ 已清除存摺照片，記得按儲存');
}

function paeRenderBankbookPreview() {
  const base64 = document.getElementById('pae-bankbook-image').value;
  const fileId = document.getElementById('pae-bankbook-fileid').value;
  const preview = document.getElementById('pae-bankbook-preview');
  const label = document.getElementById('pae-bankbook-upload-label');
  const removeBtn = document.getElementById('pae-bankbook-remove-btn');
  if (!preview) return;

  if (base64) {
    preview.innerHTML = `<img src="${base64}" alt="存摺" style="max-width: 200px; max-height: 120px; border-radius: 6px; border: 1px solid var(--border); margin-top: 6px;">`;
    if (label) label.textContent = '更換照片';
    if (removeBtn) removeBtn.style.display = '';
  } else if (fileId) {
    preview.innerHTML = `<div style="color:var(--muted);font-size:13px;margin-top:6px;" data-bankbook-loading="${escapeHtml(fileId)}">⏳ 載入存摺照片中…</div>`;
    if (label) label.textContent = '更換照片';
    if (removeBtn) removeBtn.style.display = '';
    // hydrate
    if (typeof cloudHydrateBankbookImages === 'function') {
      cloudHydrateBankbookImages().catch(() => {});
    }
  } else {
    preview.innerHTML = '';
    if (label) label.textContent = '上傳照片';
    if (removeBtn) removeBtn.style.display = 'none';
  }
}

function onInvModeChange() {
  const mode = document.getElementById('inv-mode').value;
  const monthSel = document.getElementById('inv-month');
  const sep = document.getElementById('inv-range-sep');
  const dateStart = document.getElementById('inv-date-start');
  const dateEnd = document.getElementById('inv-date-end');
  if (mode === 'range') {
    // 區間：藏單月 select、顯示日期 input + ~
    if (monthSel) monthSel.classList.add('hidden');
    if (sep) sep.classList.remove('hidden');
    if (dateStart) dateStart.classList.remove('hidden');
    if (dateEnd) dateEnd.classList.remove('hidden');
    // v3.2.0-ui：第一次切到區間 → 自動填入「本月初 ~ 今天」
    if (dateStart && !dateStart.value) {
      const now = new Date();
      const firstDay = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
      dateStart.value = firstDay;
    }
    if (dateEnd && !dateEnd.value) {
      dateEnd.value = todayStr();
    }
  } else {
    // 單月：顯示 month select、藏日期
    if (monthSel) monthSel.classList.remove('hidden');
    if (sep) sep.classList.add('hidden');
    if (dateStart) dateStart.classList.add('hidden');
    if (dateEnd) dateEnd.classList.add('hidden');
  }
  drawInvoice();
}

// v2.10.5：請款單狀態篩選 — preset 按鈕 + 常駐 checkbox
// 不再有「mode」概念；checkbox 勾選的狀態 = 顯示什麼
// preset 按鈕只是「快速勾選」的捷徑

const INVOICE_STATUS_IDS = {
  'done-unpaid': 'invst-done-unpaid',
  'partial':     'invst-partial',
  'paid':        'invst-paid',
  'pending':     'invst-pending',
  'cancelled':   'invst-cancelled'
};

const INVOICE_PRESETS = {
  'pending':   ['done-unpaid', 'partial'],                                  // 請款模式（預設）
  'reconcile': ['done-unpaid', 'partial', 'paid'],                          // 對帳模式
  'progress':  ['pending'],                                                 // 進度報告
  'all':       ['done-unpaid', 'partial', 'paid', 'pending', 'cancelled']   // 全部
};

const INVOICE_PRESET_LABELS = {
  'pending':   '📋 請款模式',
  'reconcile': '✅ 對帳模式',
  'progress':  '🔄 進度報告',
  'all':       '📦 全部'
};

// 把單一案件對應到 5 種「狀態類別」之一，給請款單篩選用
//   'paid'         = 已完成已收款
//   'partial'      = 部分收款（已收 > 0 且未收清；不論 done 與否）
//   'done-unpaid'  = 已完成待收款（沒有任何收款）
//   'pending'      = 進行中（!done）
//   'cancelled'    = 已取消
function jobInvoiceCategory(j) {
  if (j.cancelled) return 'cancelled';
  if (jobIsFullyPaid(j)) return 'paid';
  const paid = jobPaidTotal(j);
  if (paid > 0 && !jobIsFullyPaid(j)) return 'partial';
  if (j.done) return 'done-unpaid';
  return 'pending';
}

// 從目前 5 個 checkbox 取出勾選的狀態陣列
function getInvoiceCheckedStatuses() {
  const checked = [];
  Object.keys(INVOICE_STATUS_IDS).forEach(k => {
    if (document.getElementById(INVOICE_STATUS_IDS[k])?.checked) checked.push(k);
  });
  return checked;
}

// 把目前勾選狀態存到 config + 比對是否符合某個 preset，回傳該 preset key 或 'custom'
function detectInvoicePreset(checked) {
  const sortedNow = [...checked].sort().join(',');
  for (const [k, list] of Object.entries(INVOICE_PRESETS)) {
    if ([...list].sort().join(',') === sortedNow) return k;
  }
  return 'custom';
}

// 點 preset 按鈕：自動勾起對應的 checkbox 並重繪
function applyInvoicePreset(presetKey) {
  const list = INVOICE_PRESETS[presetKey] || INVOICE_PRESETS.pending;
  Object.keys(INVOICE_STATUS_IDS).forEach(k => {
    const el = document.getElementById(INVOICE_STATUS_IDS[k]);
    if (el) el.checked = list.includes(k);
  });
  onInvoiceStatusChange();
}

// checkbox 任一改動：存 config 並重繪
function onInvoiceStatusChange() {
  const checked = getInvoiceCheckedStatuses();
  config.invCustomStatuses = checked;
  // 同時記下「上次符合哪個 preset」（給 hint 用）；若是自訂組合則設為 'custom'
  config.invStatusMode = detectInvoicePreset(checked);
  saveConfigOnly();  // v3.1.0-fix：同步推 Drive
  syncInvPresetButtons();  // v3.2.0-ui：高亮目前對應的 preset 按鈕
  drawInvoice();
}

// v3.2.0-ui：更新 preset 按鈕視覺 — 目前模式變實心 btn-primary、其他維持 btn-outline
function syncInvPresetButtons() {
  const cur = detectInvoicePreset(getInvoiceCheckedStatuses());  // 'pending' / 'reconcile' / 'progress' / 'all' / 'custom'
  document.querySelectorAll('[data-preset]').forEach(btn => {
    const isActive = (btn.dataset.preset === cur);
    if (isActive) {
      btn.classList.remove('btn-outline');
      btn.classList.add('btn-primary');
    } else {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-outline');
    }
  });
}

// 給 drawInvoice 用：取得目前要顯示的狀態 set
function getInvoiceStatusFilter() {
  return new Set(getInvoiceCheckedStatuses());
}

// 載入請款單篩選 UI 到目前 config 的狀態
function loadInvoiceStatusUI() {
  // 若沒有任何儲存值 → 套用預設「請款模式」
  let cs = config.invCustomStatuses;
  if (!Array.isArray(cs) || cs.length === 0) {
    cs = INVOICE_PRESETS.pending;
  }
  Object.keys(INVOICE_STATUS_IDS).forEach(k => {
    const el = document.getElementById(INVOICE_STATUS_IDS[k]);
    if (el) el.checked = cs.includes(k);
  });
  // v3.2.0-ui：init / 載入完成後 → 高亮目前 preset
  if (typeof syncInvPresetButtons === 'function') syncInvPresetButtons();
}

function drawInvoice() {
  const cid = document.getElementById('inv-client').value;
  const mode = document.getElementById('inv-mode')?.value || 'single';
  const c = getClient(cid);
  const v = document.getElementById('invoice-view');
  if (!c) { v.innerHTML = '<div class="card empty">請先新增業主</div>'; return; }

  // v3.2.0-ui：範圍計算 — 單月用 select、區間用 type=date input
  let rangeStart, rangeEnd, periodLabel;
  if (mode === 'range') {
    let s = document.getElementById('inv-date-start')?.value || '';
    let e = document.getElementById('inv-date-end')?.value || '';
    if (!s || !e) {
      // fallback：本月初 ~ 今天
      const now = new Date();
      s = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
      e = todayStr();
    }
    if (e < s) { const tmp = s; s = e; e = tmp; }
    rangeStart = s;
    rangeEnd = e;
    periodLabel = `${s} ~ ${e}`;
  } else {
    const mm = document.getElementById('inv-month').value;
    rangeStart = mm + '-01';
    // 該月最後一天
    const [yy, mmNum] = mm.split('-').map(Number);
    const lastDay = new Date(yy, mmNum, 0).getDate();
    rangeEnd = mm + '-' + String(lastDay).padStart(2, '0');
    periodLabel = mm;
  }

  // 套用日期過濾（已從 per-month 改成 per-day，兩種模式都統一）
  // 注意：這裡用 state.jobs（不 activeJobs，因為「自訂」可能想包含取消的）
  const allJobs = state.jobs.filter(j => {
    if (j.clientId !== cid) return false;
    const d = j.date || '';
    return d >= rangeStart && d <= rangeEnd;
  });
  const statusFilter = getInvoiceStatusFilter();
  const jobs = allJobs.filter(j => statusFilter.has(jobInvoiceCategory(j)))
                      .sort((a,b) => (a.date||'').localeCompare(b.date||''));

  // 更新 toolbar 提示（顯示目前模式 + 筆數/總額，讓使用者寄出前心理預覽）
  const hintEl = document.getElementById('inv-status-hint');
  if (hintEl) {
    const filteredAmt = jobs.reduce((s,j) => s + jobFinalAmount(j), 0);
    const totalCount = allJobs.length;
    const presetKey = detectInvoicePreset(getInvoiceCheckedStatuses());
    const modeLabel = INVOICE_PRESET_LABELS[presetKey] || '⚙️ 自訂';
    if (jobs.length === 0) {
      hintEl.textContent = `${modeLabel}　（這個範圍沒有符合的案件，共 ${totalCount} 筆）`;
      hintEl.style.color = 'var(--warning)';
    } else {
      hintEl.textContent = `${modeLabel}　→ ${jobs.length}${jobs.length===totalCount?'':'/'+totalCount} 筆 · ${fmt(filteredAmt)}`;
      hintEl.style.color = 'var(--muted)';
    }
  }
  // v2.8.1: 用 finalAmount + payment 計算
  const grossTotal = jobs.reduce((s,j) => s + (+j.amount||0), 0);              // 原價合計
  const discountTotal = jobs.reduce((s,j) => s + jobDiscountAmount(j), 0);      // 折扣合計
  const finalTotal = jobs.reduce((s,j) => s + jobFinalAmount(j), 0);            // 應收合計
  const paidTotal = jobs.reduce((s,j) => s + jobPaidTotal(j), 0);               // 實收合計
  const unpaidTotal = jobs.filter(j => j.done).reduce((s,j) => s + jobUnpaidAmount(j), 0);  // 待收（已完成）
  const pendingTotal = jobs.filter(j => !j.done).reduce((s,j) => s + jobUnpaidAmount(j), 0); // 進行中
  const writeOffTotal = jobs.reduce((s,j) => s + (+j.writeOff || 0), 0);        // 呆帳合計
  const showDiscount = discountTotal > 0;  // v2.9.8: 沒有折扣 → 隱藏整欄

  const u = config.userInfo || {};
  // v3.2.0：個人資訊優先用 active paymentAccount 的（per-account），fallback 到 top-level userInfo
  const activeAcct = getActivePaymentAccount();
  const aPersonal = {
    name:         (activeAcct && activeAcct.name)         || u.name || '',
    phone:        (activeAcct && activeAcct.phone)        || u.phone || '',
    email:        (activeAcct && activeAcct.email)        || u.email || '',
    invoiceTitle: (activeAcct && activeAcct.invoiceTitle) || u.invoiceTitle || '',
    taxId:        (activeAcct && activeAcct.taxId)        || '',
    address:      (activeAcct && activeAcct.address)      || '',
    invoiceNote:  (activeAcct && activeAcct.invoiceNote)  || ''
  };
  const showPersonal = !activeAcct || activeAcct.showPersonalInfo !== false;     // 預設 true（底部 3 欄會顯示個人欄）
  const showPersonalOnTop = !!(activeAcct && activeAcct.showPersonalInfoOnTop);   // 預設 false（不在頂端顯示，避免請款單太長）
  // v3.2.0-ui：發票功能暫時隱藏（feature flag）；資料 / migration / input 保留，未來解 hidden 即可恢復
  const FEATURE_INVOICE_INFO = false;
  const showInvoice = FEATURE_INVOICE_INFO && !!(activeAcct && activeAcct.showInvoiceInfo);
  // v3.2.0-ui：對帳模式才顯示「狀態」欄（給業主看的請款不需要狀態，自己對帳要看）
  const presetKeyForCol = detectInvoicePreset(getInvoiceCheckedStatuses());
  const showStatusCol = (presetKeyForCol === 'reconcile');
  const hasPersonalInfo = showPersonal && (aPersonal.name || aPersonal.phone || aPersonal.email);
  const hasPayInfo = !!(activeAcct && (activeAcct.bank || activeAcct.account));
  const hasInvoiceInfo = showInvoice && (aPersonal.invoiceTitle || aPersonal.taxId || aPersonal.address || aPersonal.invoiceNote);

  // 頂端精簡個人資訊（1 行 inline 形式，可選）
  const topPersonalParts = [];
  if (showPersonalOnTop && aPersonal.name) topPersonalParts.push(escapeHtml(aPersonal.name));
  if (showPersonalOnTop && aPersonal.phone) topPersonalParts.push('📞 ' + escapeHtml(aPersonal.phone));
  if (showPersonalOnTop && aPersonal.email) topPersonalParts.push('✉️ ' + escapeHtml(aPersonal.email));
  const topPersonalLine = topPersonalParts.length > 0
    ? `<div style="text-align: right; color: var(--muted); font-size: 12px; margin-bottom: 4px;">請款方：${topPersonalParts.join(' · ')}</div>`
    : '';

  v.innerHTML = `<div class="invoice" id="invoice-print">
    ${topPersonalLine}
    <div class="invoice-header">
      <div>
        <h2>${periodLabel} 工作明細</h2>
        <div class="meta">業主：${escapeHtml(c.name)}</div>
      </div>
      <div style="text-align: right;">
        <div class="meta">請款日：${todayStr()}</div>
        <div class="meta">共 ${jobs.length} 筆 · ${fmt(finalTotal)}</div>
      </div>
    </div>
    ${jobs.length ? `<table>
      <thead><tr><th>日期</th><th>項目</th><th>說明</th><th class="num">單價</th><th class="num">數量</th>${showDiscount ? '<th class="num">折扣</th>' : ''}<th class="num">應收</th><th class="num">已收</th>${showStatusCol ? '<th>狀態</th>' : ''}</tr></thead>
      <tbody>
        ${jobs.map(j => {
          const final = jobFinalAmount(j);
          const disc = jobDiscountAmount(j);
          const gross = +j.amount || 0;
          const qty = (j.quantity != null && j.quantity > 0) ? j.quantity : 1;
          const unit = qty > 0 ? Math.round(gross / qty) : gross;
          const paid = jobPaidTotal(j);
          const unpaid = jobUnpaidAmount(j);
          const wo = +j.writeOff || 0;
          // v3.2.0-ui：狀態欄文字（只在對帳模式顯示）
          let stLabel = '';
          if (showStatusCol) {
            if (j.cancelled) stLabel = '<span class="badge-status" style="color:var(--muted);">⚫ 已取消</span>';
            else if (jobIsFullyPaid(j)) stLabel = wo > 0 ? '<span class="badge-status paid" title="部分認列呆帳">✓ 結清</span>' : '<span class="badge-status paid">✓ 已收款</span>';
            else if (paid > 0) stLabel = `<span class="badge-status done-unpaid">部分收款 · 還欠 ${fmt(unpaid).replace('NT$','').trim()}</span>`;
            else if (j.done) stLabel = '<span class="badge-status done-unpaid">$ 待收款</span>';
            else stLabel = '<span class="badge-status pending">進行中</span>';
          }
          return `<tr>
            <td>${j.date||'-'}</td>
            <td>${escapeHtml(j.title||'-')}</td>
            <td style="color:var(--muted); font-size: 13px;">${escapeHtml(j.details||'')}</td>
            <td class="num">${fmt(unit)}</td>
            <td class="num">${qty}</td>
            ${showDiscount ? `<td class="num" style="color: ${disc>0?'var(--warning)':'var(--muted)'};">${disc>0 ? '−' + fmt(disc).replace('NT$','').trim() : '—'}</td>` : ''}
            <td class="num"><b>${fmt(final)}</b></td>
            <td class="num" style="color: ${paid>=final?'var(--success)':'var(--muted)'};">${paid>0 ? fmt(paid) : '—'}</td>
            ${showStatusCol ? `<td>${stLabel}</td>` : ''}
          </tr>`;
        }).join('')}
      </tbody>
      <tfoot>
        <tr style="border-top: 2px solid var(--text); font-weight: 600;">
          <td colspan="5" style="text-align: right;">合計</td>
          ${showDiscount ? `<td class="num" style="color: var(--warning);">−${fmt(discountTotal).replace('NT$','').trim()}</td>` : ''}
          <td class="num">${fmt(finalTotal)}</td>
          <td class="num" style="color: var(--success);">${fmt(paidTotal)}</td>
          ${showStatusCol ? '<td></td>' : ''}
        </tr>
      </tfoot>
    </table>
    <div class="invoice-total">
      ${paidTotal ? `<div class="invoice-total-item paid">
        <div class="tot-label">已收款</div>
        <div class="tot-value">${fmt(paidTotal)}</div>
      </div>` : ''}
      ${unpaidTotal ? `<div class="invoice-total-item pending">
        <div class="tot-label">本次請款（已完成待收）</div>
        <div class="tot-value">${fmt(unpaidTotal)}</div>
      </div>` : ''}
      ${pendingTotal ? `<div class="invoice-total-item" style="color: var(--muted);">
        <div class="tot-label">進行中（尚未請款）</div>
        <div class="tot-value" style="color: var(--muted);">${fmt(pendingTotal)}</div>
      </div>` : ''}
      ${writeOffTotal ? `<div class="invoice-total-item" style="color: var(--muted);">
        <div class="tot-label">呆帳（不再追討）</div>
        <div class="tot-value" style="color: var(--muted);">${fmt(writeOffTotal)}</div>
      </div>` : ''}
    </div>

    <!-- v3.2.0：底部 3 欄並排（個人 / 匯款 / 發票）；任何一欄沒料則該欄隱藏，自動 wrap -->
    ${(hasPersonalInfo || hasPayInfo || hasInvoiceInfo) ? `<div style="display: flex; gap: 16px; align-items: flex-start; flex-wrap: wrap; margin-top: 16px;">
      ${hasPersonalInfo ? `<div class="invoice-payment" style="flex: 1; min-width: 220px;">
        <div class="invoice-payment-title">Contact 我的資訊</div>
        ${aPersonal.name ? `<div class="invoice-payment-row"><span class="lbl">姓名</span><span class="val">${escapeHtml(aPersonal.name)}</span></div>` : ''}
        ${aPersonal.phone ? `<div class="invoice-payment-row"><span class="lbl">電話</span><span class="val">${escapeHtml(aPersonal.phone)}</span></div>` : ''}
        ${aPersonal.email ? `<div class="invoice-payment-row"><span class="lbl">Email</span><span class="val" style="word-break: break-all;">${escapeHtml(aPersonal.email)}</span></div>` : ''}
      </div>` : ''}
      ${hasPayInfo ? `<div class="invoice-payment" style="flex: 1; min-width: 240px;">
        <div class="invoice-payment-title">Payment 匯款資訊</div>
        ${activeAcct.bank ? `<div class="invoice-payment-row"><span class="lbl">銀行</span><span class="val">${escapeHtml(activeAcct.bank)}</span></div>` : ''}
        ${activeAcct.account ? `<div class="invoice-payment-row"><span class="lbl">帳號</span><span class="val" style="font-family: monospace;">${escapeHtml(activeAcct.account)}</span></div>` : ''}
        ${(activeAcct.holderName || aPersonal.name) ? `<div class="invoice-payment-row"><span class="lbl">戶名</span><span class="val">${escapeHtml(activeAcct.holderName || aPersonal.name)}</span></div>` : ''}
        ${activeAcct.note ? `<div class="invoice-payment-row" style="font-size: 12px; color: var(--muted);"><span class="lbl">備註</span><span class="val">${escapeHtml(activeAcct.note)}</span></div>` : ''}
        ${activeAcct.bankbookImage
          ? `<div style="margin-top: 12px;"><img src="${activeAcct.bankbookImage}" alt="存摺" style="max-width: 100%; max-height: 160px; border-radius: 6px; border: 1px solid var(--border);"></div>`
          : (activeAcct.bankbookImageFileId
            ? `<div style="margin-top: 12px;color:var(--muted);font-size:13px;" data-bankbook-loading="${escapeHtml(activeAcct.bankbookImageFileId)}">⏳ 載入存摺照片中…</div>`
            : '')}
      </div>` : ''}
      ${hasInvoiceInfo ? `<div class="invoice-payment" style="flex: 1; min-width: 220px;">
        <div class="invoice-payment-title">Invoice 發票資訊</div>
        ${aPersonal.invoiceTitle ? `<div class="invoice-payment-row"><span class="lbl">抬頭</span><span class="val">${escapeHtml(aPersonal.invoiceTitle)}</span></div>` : ''}
        ${aPersonal.taxId ? `<div class="invoice-payment-row"><span class="lbl">統編</span><span class="val" style="font-family: monospace;">${escapeHtml(aPersonal.taxId)}</span></div>` : ''}
        ${aPersonal.address ? `<div class="invoice-payment-row"><span class="lbl">寄送地址</span><span class="val">${escapeHtml(aPersonal.address)}</span></div>` : ''}
        ${aPersonal.invoiceNote ? `<div class="invoice-payment-row" style="font-size: 12px; color: var(--muted);"><span class="lbl">備註</span><span class="val">${escapeHtml(aPersonal.invoiceNote)}</span></div>` : ''}
      </div>` : ''}
    </div>` : ''}

    ${u.note ? `<div style="margin-top: 14px; padding: 10px; font-size: 12px; color: var(--muted); border-top: 1px dashed var(--border);">
      ${escapeHtml(u.note).replace(/\n/g, '<br>')}
    </div>` : ''}
    ` : '<div class="empty">此月份此業主沒有案件</div>'}
  </div>`;
  // v3.1.0-fix：drawInvoice 結尾呼叫 hydrate，因為切到請款單分頁不會走 renderAll，
  // 只走 renderInvoice → drawInvoice，placeholder 沒被 hydrate 替換會卡載入中
  if (typeof cloudHydrateBankbookImages === 'function') {
    cloudHydrateBankbookImages().catch(e => console.warn('[bankbook] hydrate after drawInvoice failed:', e));
  }
  // v3.24.1：對帳區（業主看不到）
  renderInvoiceNetBreakdown();
}

// v3.24.1：請款單對帳區（內部用，匯出時不包含）
// 切換業主 / 月份 / 範圍 / 扣稅 toggle 都會 trigger
function renderInvoiceNetBreakdown() {
  const box = document.getElementById('invoice-net-breakdown');
  const body = document.getElementById('invoice-net-breakdown-body');
  if (!box || !body) return;

  const cid = document.getElementById('inv-client')?.value;
  const c = getClient(cid);
  if (!c) { box.classList.add('hidden'); return; }

  // 用跟 drawInvoice 一致的篩選邏輯抽案件
  const mode = document.getElementById('inv-mode')?.value || 'single';
  let rangeStart, rangeEnd;
  if (mode === 'range') {
    let s = document.getElementById('inv-date-start')?.value;
    let e = document.getElementById('inv-date-end')?.value;
    if (!s || !e) {
      const now = new Date();
      s = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
      e = todayStr();
    }
    if (e < s) { const tmp = s; s = e; e = tmp; }
    rangeStart = s; rangeEnd = e;
  } else {
    const mm = document.getElementById('inv-month')?.value || thisMonth();
    rangeStart = mm + '-01';
    const [yy, mmNum] = mm.split('-').map(Number);
    const lastDay = new Date(yy, mmNum, 0).getDate();
    rangeEnd = mm + '-' + String(lastDay).padStart(2, '0');
  }
  const allJobs = state.jobs.filter(j => {
    if (j.clientId !== cid) return false;
    const d = j.date || '';
    return d >= rangeStart && d <= rangeEnd;
  });
  const statusFilter = getInvoiceStatusFilter();
  const jobs = allJobs.filter(j => statusFilter.has(jobInvoiceCategory(j)));

  // 沒案件 → 隱藏對帳區（避免空畫面）
  if (jobs.length === 0) { box.classList.add('hidden'); return; }

  // 計算（v3.24.2：稅讀 case.taxApplied 而非請款單 toggle）
  const final = jobs.reduce((s, j) => s + jobFinalAmount(j), 0);
  const tax = jobs.reduce((s, j) => s + jobInvoiceTax(j), 0);
  const commission = jobs.reduce((s, j) => s + jobCommission(j), 0);
  const outsourceCost = jobs.reduce((s, j) => s + (+j.outsourceCost || 0), 0);
  const net = final - tax - commission - outsourceCost;
  const paid = jobs.reduce((s, j) => s + jobPaidTotal(j), 0);
  const unpaid = jobs.filter(j => j.done).reduce((s, j) => s + jobUnpaidAmount(j), 0);
  const taxedJobCount = jobs.filter(j => j.taxApplied).length;

  // 條件顯示：有稅 OR 有分潤 OR 有外包 → 顯示完整對帳；否則只顯示業主應付 + 已收 / 待收
  const hasAnyDeduction = tax > 0 || commission > 0 || outsourceCost > 0;
  if (!hasAnyDeduction) {
    // 都沒有扣減項 → 顯示簡版（業主應付 + 已收 / 待收）
    box.classList.remove('hidden');
    body.innerHTML = `
      業主應付　　　　　　 <b>${fmt(final)}</b><br>
      已收　　　　　　　　 <span style="color: var(--success);">${fmt(paid)}</span><br>
      待收　　　　　　　　 <span style="color: var(--warning);">${fmt(unpaid)}</span>
    `;
    return;
  }

  box.classList.remove('hidden');
  const lines = [`業主應付　　　　　　 <b>${fmt(final)}</b>`];
  if (tax > 0) lines.push(`− 5% 自吸收稅 (${taxedJobCount} 筆)　 <span style="color: var(--warning);">−${fmt(tax)}</span>`);
  if (commission > 0) lines.push(`− 分潤　　　　　　　 <span style="color: var(--warning);">−${fmt(commission)}</span>`);
  if (outsourceCost > 0) lines.push(`− 外包成本　　　　　 <span style="color: var(--warning);">−${fmt(outsourceCost)}</span>`);
  const netColor = net < 0 ? 'var(--danger)' : 'var(--success)';
  const netStr = net < 0 ? `⚠️ −${fmt(-net)}（倒貼）` : fmt(net);
  lines.push(`<span style="border-top: 1px solid var(--border); display: inline-block; padding-top: 4px; margin-top: 4px;">我實收　　　　　　　 <b style="color: ${netColor};">${netStr}</b></span>`);
  lines.push(`<br><span style="color: var(--muted); font-size: 11px;">───── 業主收款狀態 ─────</span>`);
  lines.push(`業主已付　　　　　　 <span style="color: var(--success);">${fmt(paid)}</span>`);
  lines.push(`業主待付　　　　　　 <span style="color: var(--warning);">${fmt(unpaid)}</span>`);
  if (tax === 0 && (commission > 0 || outsourceCost > 0)) {
    lines.push(`<br><span style="color: var(--muted); font-size: 11px;">💡 要扣稅請去案件編輯 modal 勾「📨 此案件含 5% 稅」</span>`);
  }
  body.innerHTML = lines.join('<br>');
}

function emptyState(title, sub) {
  return `<div class="empty"><div class="icon">📋</div><div style="font-weight: 500;">${title}</div><div style="font-size: 13px; margin-top: 4px;">${sub}</div></div>`;
}

// ============== Actions ==============
function setFilter(key, value) {
  // 切換任何篩選 → 自動清除提醒/業主排行帶來的鎖定篩選
  state.filters.jobIdsOnly = null;
  state.filters.jobIdsOnlyLabel = '';
  state.filters[key] = value;
  render();
}

// v2.3：只更新單一案件 row（避免 462 筆全重畫）
function updateJobRow(id) {
  const j = state.jobs.find(x => x.id === id);
  if (!j) return;
  const oldRow = document.querySelector(`[data-job-id="${id}"]`);
  if (!oldRow) { renderJobs(); return; }  // 找不到 → 退回完整重畫
  // 用同樣 HTML 取代
  const tmp = document.createElement('div');
  tmp.innerHTML = jobRow(j);
  const newRow = tmp.firstElementChild;
  if (newRow) oldRow.replaceWith(newRow);
}

// v3.24.18：dashboard「今天的重點」卡片
//           聚合：1) 截止當日 2) 即將到期 3 天內 3) 完成超過 N 天未收 4) 月底快到
//           沒任何重點 → 整張卡 hidden（不佔空間）
function renderTodayTodo() {
  const card = document.getElementById('today-todo-card');
  const box = document.getElementById('today-todo-list');
  if (!card || !box) return;

  const today = todayStr();
  const todayDate = new Date(today);
  const items = [];
  const active = (state.jobs || []).filter(j => !j.cancelled);

  // 1. 截止當日（含跨天案件落在今天）
  active.forEach(j => {
    const end = j.endDate || j.date || '';
    if (!end) return;
    if (end === today && !j.done) {
      const c = getClient(j.clientId);
      items.push({
        priority: 1,
        icon: '🔴',
        text: `今天截止：${escapeHtml(j.title || '(無標題)')} · ${c?.name || '?'}`,
        jobId: j.id,
      });
    }
  });

  // 2. 即將到期（明天 ~ 3 天內，但不含今天）
  active.forEach(j => {
    const end = j.endDate || j.date || '';
    if (!end || j.done) return;
    if (end > today) {
      const endDate = new Date(end);
      const daysLeft = Math.round((endDate - todayDate) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 3 && daysLeft > 0) {
        const c = getClient(j.clientId);
        items.push({
          priority: 2,
          icon: '🟡',
          text: `${daysLeft} 天後截止：${escapeHtml(j.title || '(無標題)')} · ${c?.name || '?'}`,
          jobId: j.id,
        });
      }
    }
  });

  // 3. 完成已久未收款（沿用 config.unpaidRemindDays，預設 7）
  const unpaidThreshold = +config.unpaidRemindDays || 7;
  active.forEach(j => {
    if (!j.done || !j.doneAt || jobIsFullyPaid(j)) return;
    const c = getClient(j.clientId);
    const overrideDays = c?.unpaidRemindDaysOverride;
    const days = overrideDays != null ? overrideDays : unpaidThreshold;
    const doneDate = new Date(j.doneAt);
    const daysPassed = Math.round((todayDate - doneDate) / (1000 * 60 * 60 * 24));
    if (daysPassed >= days) {
      items.push({
        priority: 3,
        icon: '🟠',
        text: `完成 ${daysPassed} 天未收款：${escapeHtml(j.title || '(無標題)')} · ${c?.name || '?'} · ${fmt(jobUnpaidAmount(j))}`,
        jobId: j.id,
      });
    }
  });

  // 4. 月底快到提醒（如果今天 ≥ 配置的 monthEndReminderDay）
  const monthEndDay = +config.monthEndReminderDay || 25;
  const todayDayNum = todayDate.getDate();
  if (todayDayNum >= monthEndDay) {
    items.push({
      priority: 4,
      icon: '📅',
      text: `月底快到了！可以開始整理本月可請款的案件了`,
      action: () => switchTab('invoice'),
    });
  }

  // 5. 拖款警告（沿用 computeSlowPayJobs 函式）
  if (typeof computeSlowPayJobs === 'function') {
    const slowJobs = computeSlowPayJobs(active);
    slowJobs.slice(0, 3).forEach(j => {
      const c = getClient(j.clientId);
      items.push({
        priority: 5,
        icon: '🐢',
        text: `拖款警告：${c?.name || '?'} 平均 ${j.avgDays} 天，這筆已 ${j.daysSince} 天 · ${fmt(jobUnpaidAmount(j))}`,
        jobId: j.id,
      });
    });
  }

  // 沒任何重點 → 隱藏卡
  if (items.length === 0) {
    card.classList.add('hidden');
    return;
  }

  card.classList.remove('hidden');
  // 按 priority 排序
  items.sort((a, b) => a.priority - b.priority);
  box.innerHTML = items.map(it => {
    const onClick = it.jobId ? `editJob('${it.jobId}')` : (it.action ? '' : '');
    const cursorStyle = (it.jobId || it.action) ? 'cursor: pointer;' : '';
    const handler = onClick ? `onclick="${onClick}"` : '';
    return `<div class="today-todo-item" ${handler} style="${cursorStyle}">
      <span class="today-todo-icon">${it.icon}</span>
      <span class="today-todo-text">${it.text}</span>
    </div>`;
  }).join('');
}

// v3.24.18：案件 modal 日期欄位快速選擇按鈕
//           type='start' / 'end'  preset='today' / 'tomorrow' / 'nextMon' / 'plus3' / 'plus7' / 'clear'
function setJobDateQuick(type, preset) {
  const id = type === 'end' ? 'job-end-date' : 'job-date';
  const inp = document.getElementById(id);
  if (!inp) return;
  if (preset === 'clear') { inp.value = ''; return; }
  const today = new Date();
  let target = new Date(today);
  if (preset === 'today') {
    // target = today
  } else if (preset === 'tomorrow') {
    target.setDate(target.getDate() + 1);
  } else if (preset === 'nextMon') {
    // 下週一：今天 +(8 - today.getDay()) 天，但 today.getDay()=0(週日) 時是 +1
    const dow = today.getDay();  // 0=Sun, 1=Mon, ..., 6=Sat
    const daysToAdd = dow === 0 ? 1 : (8 - dow);
    target.setDate(target.getDate() + daysToAdd);
  } else if (preset === 'plus3') {
    target.setDate(target.getDate() + 3);
  } else if (preset === 'plus7') {
    target.setDate(target.getDate() + 7);
  }
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  inp.value = `${y}-${m}-${d}`;
}

// v3.24.18：dashboard stat 卡數字平滑滾動（200ms requestAnimationFrame）
// 從元素「上次顯示的數字」滾到 target；首次載入從 0 滾上去
const _countUpLastValues = {};
function countUpStat(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const targetN = +target || 0;
  const startN = _countUpLastValues[elementId] ?? 0;
  // 偏好減動效 → 直接 set
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = fmt(targetN);
    _countUpLastValues[elementId] = targetN;
    return;
  }
  // 差距很小直接 set，避免無謂動畫（< 100 元）
  if (Math.abs(targetN - startN) < 100) {
    el.textContent = fmt(targetN);
    _countUpLastValues[elementId] = targetN;
    return;
  }
  const DURATION_MS = 280;
  const startTime = performance.now();
  function tick(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / DURATION_MS, 1);
    // ease-out cubic 緩動
    const eased = 1 - Math.pow(1 - t, 3);
    const current = Math.round(startN + (targetN - startN) * eased);
    el.textContent = fmt(current);
    if (t < 1) requestAnimationFrame(tick);
    else {
      el.textContent = fmt(targetN);  // 確保最終值精確
      _countUpLastValues[elementId] = targetN;
    }
  }
  requestAnimationFrame(tick);
}

// v3.24.18：找對應 row（涵蓋 5 種視圖 — comfort .row / compact .row-compact / table tr / card .job-card-tile / dashboard 近期案件）
//           加 pulse class 觸發 0.5s 綠光暈或金色光暈，再自動移除
function flashRowPulse(jobId, pulseClass) {
  if (!jobId || !pulseClass) return;
  const els = document.querySelectorAll(`[data-job-id="${jobId}"]`);
  els.forEach(el => {
    el.classList.remove('pulse-success', 'pulse-paid');  // 清掉舊的避免動畫卡住
    // 強制 reflow 讓 animation 重啟
    void el.offsetWidth;
    el.classList.add(pulseClass);
    setTimeout(() => el.classList.remove(pulseClass), 600);
  });
}

function toggleDone(id) {
  const j = state.jobs.find(x => x.id === id); if (!j) return;
  if (j.cancelled) { toast('案件已取消，請先取消「已取消」狀態'); return; }
  j.done = !j.done;
  j.doneAt = j.done ? todayStr() : null;
  if (!j.done) { j.paid = false; j.paidAt = null; }
  save();
  // v2.9.5: 寫日誌
  const c = getClient(j.clientId);
  logAction(j.done ? 'job-done' : 'job-undo-done', { jobId: id, title: j.title, amount: j.amount, clientId: j.clientId, clientName: c?.name });
  updateJobRow(id);
  renderAlerts(); renderBadge();
  // v3.24.18：標完成 → 對應 row 觸發綠光暈微動效
  if (j.done) flashRowPulse(id, 'pulse-success');
  toast(j.done?'✓ 已標記完成':'已改為進行中');
}

function togglePaid(id) {
  const j = state.jobs.find(x => x.id === id); if (!j) return;
  if (j.cancelled) { toast('案件已取消，請先取消「已取消」狀態'); return; }
  if (jobIsFullyPaid(j)) {
    // 取消結清：若有多筆 payments → 提示去 modal 處理；單筆/無 → 直接清掉
    const count = (j.payments || []).length;
    if (count > 1) {
      toast('此案件有多筆收款紀錄，請開啟編輯視窗管理', 4000);
      editJob(id);
      return;
    }
    if (!confirm('將清除這筆案件的收款紀錄。確定？')) return;
    j.payments = [];
    j.writeOff = 0;
    recomputePaidStatus(j);
    save();
    const c = getClient(j.clientId);
    logAction('job-undo-paid', { jobId: id, title: j.title, amount: j.amount, clientId: j.clientId, clientName: c?.name });
    updateJobRow(id);
    renderAlerts(); renderBadge();
    toast('已改為待收款');
  } else {
    openPaidDateModal([id]);
  }
}

// ============== 收款日期 Modal ==============
let paidDateContext = null;  // { jobIds: [...] }

function openPaidDateModal(jobIds) {
  if (!jobIds.length) return;
  paidDateContext = { jobIds: [...jobIds] };
  document.getElementById('paid-date-input').value = todayStr();
  if (jobIds.length === 1) {
    const j = state.jobs.find(x => x.id === jobIds[0]);
    const c = j ? getClient(j.clientId) : null;
    // v3.22.5：單筆顯示折扣後應收
    document.getElementById('paid-date-info').textContent =
      `${c?.name || '?'} · ${j?.title || '(無標題)'} · ${j ? fmt(jobFinalAmount(j)) : 'NT$ 0'}`;
  } else {
    // v3.22.5：批次合計用 jobFinalAmount
    const total = state.jobs
      .filter(j => jobIds.includes(j.id))
      .reduce((s,j) => s + jobFinalAmount(j), 0);
    document.getElementById('paid-date-info').textContent =
      `批次標記 ${jobIds.length} 筆案件 · 合計 ${fmt(total)}`;
  }
  document.getElementById('paid-date-modal').classList.add('open');
}

function closePaidDateModal() {
  document.getElementById('paid-date-modal').classList.remove('open');
  paidDateContext = null;
}

function confirmPaidDate() {
  if (!paidDateContext) return;
  const dateStr = document.getElementById('paid-date-input').value;
  if (!dateStr) { toast('請填收款日'); return; }
  const ids = paidDateContext.jobIds;
  let n = 0;
  state.jobs.forEach(j => {
    if (!ids.includes(j.id)) return;
    if (jobIsFullyPaid(j)) return;
    // v2.8.0: 把待收餘額補一筆 payment（而非直接 set paid=true）
    const remaining = jobUnpaidAmount(j);
    if (remaining <= 0) return;
    j.payments = j.payments || [];
    j.payments.push({ id: uid(), date: dateStr, amount: remaining, note: '' });
    j.payments.sort((a,b) => (a.date||'').localeCompare(b.date||''));
    recomputePaidStatus(j);
    n++;
  });
  // v2.9.5: 寫日誌
  if (ids.length === 1) {
    const j = state.jobs.find(x => x.id === ids[0]);
    const c = getClient(j?.clientId);
    logAction('job-paid', { jobId: ids[0], title: j?.title, amount: j?.amount, clientId: j?.clientId, clientName: c?.name, date: dateStr });
  } else if (n > 0) {
    const total = ids.reduce((s, id) => {
      const j = state.jobs.find(x => x.id === id);
      return s + (j ? jobFinalAmount(j) : 0);
    }, 0);
    logAction('bulk-paid', { count: n, amount: total, date: dateStr });
  }
  if (ids.length > 1) bulkSelected.clear();
  if (paidDateContext._fromDashBulk) {
    dashBulkExit();
  }
  closePaidDateModal();
  save(); render();
  // v3.24.18：標收款 → 對應 row 觸發金色光暈微動效（單筆才顯，批次不閃）
  if (ids.length === 1 && n > 0) {
    setTimeout(() => flashRowPulse(ids[0], 'pulse-paid'), 50);  // delay 給 render() 完成
  }
  toast(`💰 ${n} 筆已標記收款 (${dateStr})`, 3000);
}

// ----- Job Modal -----
let editingJobId = null;

// v2.10.12: 業主下拉排序 — 常用 / 最近用過的擺上面（給新增 / 編輯案件用）
// 分數 = 近 90 天案件數 × 3 + 全期案件數；取消的案件不算；分數同則照業主名稱中文排序
function sortedClientsForPicker() {
  const NOW = Date.now();
  const RECENT_MS = 90 * 24 * 60 * 60 * 1000;
  const score = c => {
    const my = state.jobs.filter(j => j.clientId === c.id && !j.cancelled);
    const recent = my.filter(j => {
      const t = new Date(j.date).getTime();
      return !isNaN(t) && (NOW - t) < RECENT_MS;
    }).length;
    return recent * 3 + my.length;
  };
  return [...state.clients].sort((a, b) => {
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return (a.name || '').localeCompare(b.name || '', 'zh-Hant');
  });
}

function openJobModal() {
  if (!state.clients.length) { toast('請先新增業主'); switchTab('clients'); openClientModal(); return; }
  // v3.0.0：移除 tryAcquireLockOrWarn（v2 Apps Script 編輯鎖已拆，v3 用 mergeStates 三方合併處理衝突）
  editingJobId = null;
  document.getElementById('job-modal-title').textContent = '新增案件';
  document.getElementById('job-delete-btn').classList.add('hidden');
  const cs = document.getElementById('job-client');
  cs.innerHTML = sortedClientsForPicker().map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  if (!document.getElementById('job-date').value) {
    document.getElementById('job-date').value = todayStr();
  }
  document.getElementById('job-end-date').value = '';
  document.getElementById('job-title').value = '';
  document.getElementById('job-tag').value = '';
  // v3.14.0：清空 multi-tag
  modalJobTags = [];
  renderJobTagsChips();
  document.getElementById('job-details').value = '';
  document.getElementById('job-amount').value = '';
  // v3.2.0：重設單價 + 數量
  if (document.getElementById('job-unit-price')) document.getElementById('job-unit-price').value = '';
  if (document.getElementById('job-quantity')) document.getElementById('job-quantity').value = 1;
  document.getElementById('job-hours').value = '';
  document.getElementById('job-done').checked = false;
  document.getElementById('job-cancelled').checked = false;
  document.getElementById('job-estimate').checked = false;
  document.getElementById('job-done-at').value = '';
  // v2.8.0: 折扣 + payments 重設
  setDiscountUI('none', 0);
  document.getElementById('job-write-off').value = '';
  modalPayments = [];
  cancelAddJobPayment();
  // v3.24.0：派外包欄位重設
  if (document.getElementById('job-outsource-to')) document.getElementById('job-outsource-to').value = '';
  if (document.getElementById('job-outsource-cost')) document.getElementById('job-outsource-cost').value = '';
  if (document.getElementById('job-outsource-details')) document.getElementById('job-outsource-details').open = false;
  // v3.24.7：恢復扣稅 toggle，新案件預設關
  if (document.getElementById('job-tax-applied')) document.getElementById('job-tax-applied').checked = false;
  updateJobAmountSummary();
  document.getElementById('job-duplicate-btn')?.classList.add('hidden');
  document.getElementById('job-export-estimate-btn')?.classList.add('hidden');
  document.getElementById('job-confirm-estimate-btn')?.classList.add('hidden');
  // v2.6: 子任務 + 計時器（v3.10.0：新案件還沒 ID，計時器只能顯示 0:00:00）
  modalSubtasks = [];
  renderJobSubtasks();
  loadJobTimer(0, null);
  refreshTagSuggestions();
  onJobClientChange();
  updateJobHourlyHint();
  setJobDetailsOpenState(null);  // v3.6.4：新增模式 details 全收摺
  document.getElementById('job-modal').classList.add('open');
}

// ============== v3.6.4：估價單 toggle 改放標題列 ==============
function onJobEstimateToggle() {
  const isEstimate = !!document.getElementById('job-estimate').checked;
  const titleEl = document.getElementById('job-modal-title');
  if (!titleEl) return;
  // 在「新增」「編輯」「估價單」「估價單編輯」之間切
  const cur = titleEl.textContent || '';
  if (isEstimate) {
    if (cur.includes('編輯')) titleEl.textContent = '編輯估價單';
    else if (cur.includes('複製')) titleEl.textContent = '新增估價單（複製自現有）';
    else titleEl.textContent = '新增估價單';
  } else {
    if (cur.includes('編輯')) titleEl.textContent = '編輯案件';
    else if (cur.includes('複製')) titleEl.textContent = '新增案件（複製自現有案件）';
    else titleEl.textContent = '新增案件';
  }
}

// v3.6.4：依案件資料決定 collapsible details 預設展開/收摺
// j = null 表示新增模式（全部收摺），j = job 物件表示編輯模式（有資料的展開）
function setJobDetailsOpenState(j) {
  const discount = document.getElementById('job-discount-details');
  const subtasks = document.getElementById('job-subtasks-details');
  const payments = document.getElementById('job-payments-details');
  if (j) {
    if (discount) discount.open = (j.discountType && j.discountType !== 'none') || (+j.discountValue > 0);
    if (subtasks) subtasks.open = (j.subtasks || []).length > 0;
    if (payments) payments.open = (j.payments || []).length > 0 || (+j.writeOff > 0);
  } else {
    // 新增模式：全部收摺
    if (discount) discount.open = false;
    if (subtasks) subtasks.open = false;
    if (payments) payments.open = false;
  }
}

// ============== Modal 內折扣與收款狀況（v2.8.0）==============
let modalPayments = [];   // [{id, date, amount, note}]

function onDiscountTypeChange() {
  const type = document.querySelector('input[name="job-discount-type"]:checked')?.value || 'none';
  const inp = document.getElementById('job-discount-value');
  inp.disabled = (type === 'none');
  if (type === 'none') inp.value = '';
  if (type === 'percent') {
    inp.max = 100;
    inp.placeholder = '0-100';
  } else {
    inp.removeAttribute('max');
    inp.placeholder = '0';
  }
  updateJobAmountSummary();
}

function setDiscountUI(type, value) {
  document.querySelectorAll('input[name="job-discount-type"]').forEach(r => r.checked = (r.value === (type || 'none')));
  document.getElementById('job-discount-value').value = value || '';
  document.getElementById('job-discount-value').disabled = (!type || type === 'none');
}

// v3.2.0：使用者改單價或數量 → 自動算總金額
let _jobAmountManuallyEdited = false;
function onJobUnitOrQtyChange() {
  const unit = +document.getElementById('job-unit-price').value || 0;
  const qty = Math.max(1, parseInt(document.getElementById('job-quantity').value || '1', 10) || 1);
  const total = unit * qty;
  if (!_jobAmountManuallyEdited) {
    document.getElementById('job-amount').value = total;
    updateJobAmountSummary();
  }
}
// 使用者直接改總金額 → 標記成「手動模式」、反算單價
function onJobAmountManualEdit() {
  _jobAmountManuallyEdited = true;
  const total = +document.getElementById('job-amount').value || 0;
  const qty = Math.max(1, parseInt(document.getElementById('job-quantity').value || '1', 10) || 1);
  if (qty > 0) {
    document.getElementById('job-unit-price').value = Math.round(total / qty);
  }
  // 下次 onJobUnitOrQtyChange 時又恢復自動計算
  setTimeout(() => { _jobAmountManuallyEdited = false; }, 50);
}

// 即時更新「原價 - 折扣 = 應收 / 已收 / 待收」摘要
function updateJobAmountSummary() {
  const summary = document.getElementById('job-amount-summary');
  if (!summary) return;
  const base = +document.getElementById('job-amount').value || 0;
  // v3.24.18：千分位即時 hint（讓使用者輸入大數字時看得清楚）
  const fmtHint = document.getElementById('job-amount-formatted');
  if (fmtHint) fmtHint.textContent = base > 0 ? `≈ ${fmt(base)}` : '';
  const type = document.querySelector('input[name="job-discount-type"]:checked')?.value || 'none';
  const dval = +document.getElementById('job-discount-value').value || 0;
  let final = base, disc = 0;
  if (type === 'fixed') { disc = Math.min(base, dval); final = Math.max(0, base - disc); }
  else if (type === 'percent') { disc = Math.round(base * dval / 100); final = Math.max(0, base - disc); }

  const paid = modalPayments.reduce((s,p) => s + (+p.amount || 0), 0);
  const writeOff = +document.getElementById('job-write-off')?.value || 0;
  const unpaid = Math.max(0, final - paid - writeOff);

  let html = `原價 <b>${fmt(base)}</b>`;
  if (disc > 0) html += ` − 折扣 <b style="color: var(--warning);">${fmt(disc)}</b> = 應收 <b style="color: var(--primary);">${fmt(final)}</b>`;
  if (paid > 0 || writeOff > 0) {
    html += `<br>已收 <b style="color: var(--success);">${fmt(paid)}</b>`;
    if (writeOff > 0) html += ` · 呆帳 <b style="color: var(--muted);">${fmt(writeOff)}</b>`;
    html += ` · 待收 <b style="color: ${unpaid>0?'var(--warning)':'var(--success)'};">${fmt(unpaid)}</b>`;
  }
  summary.innerHTML = html;
  updateJobHourlyHint();
  renderJobPayments();
  // v3.24.0：實收試算
  updateJobNetBreakdown();
}

// v3.24.2：實收試算（有扣稅 / 分潤 / 外包任一才顯示）
function updateJobNetBreakdown() {
  const box = document.getElementById('job-net-breakdown');
  const body = document.getElementById('job-net-breakdown-body');
  if (!box || !body) return;

  const base = +document.getElementById('job-amount').value || 0;
  const type = document.querySelector('input[name="job-discount-type"]:checked')?.value || 'none';
  const dval = +document.getElementById('job-discount-value').value || 0;
  let final = base;
  if (type === 'fixed')   final = Math.max(0, base - Math.min(base, dval));
  else if (type === 'percent') final = Math.max(0, Math.round(base * (1 - dval / 100)));

  const cid = document.getElementById('job-client').value;
  const c = getClient(cid);
  const commissionRate = (c && c.commissionRate) || 0;
  const commission = commissionRate > 0 ? Math.round(final * (commissionRate / 100)) : 0;

  // v3.24.7：恢復 per-case toggle，看 #job-tax-applied checkbox
  const taxApplied = !!document.getElementById('job-tax-applied')?.checked;
  const tax = (taxApplied && final > 0) ? (final - Math.round(final / 1.05)) : 0;

  const outsourceCost = +document.getElementById('job-outsource-cost')?.value || 0;
  const outsourceTo = (document.getElementById('job-outsource-to')?.value || '').trim();

  const net = final - tax - commission - outsourceCost;

  // v3.24.7：條件顯示 — 有勾稅 / 有分潤 / 有外包才顯示
  if (!taxApplied && commission === 0 && outsourceCost === 0) {
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');

  // v3.24.5：順序改 稅 → 外包 → 分潤（按 user 要求）
  const lines = [`業主應付 <b>${fmt(final)}</b>`];
  if (tax > 0) lines.push(`− 5% 自吸收稅　<span style="color:var(--warning);">−${fmt(tax)}</span>`);
  if (outsourceCost > 0) lines.push(`− 外包${outsourceTo ? '（' + escapeHtml(outsourceTo) + '）' : ''}　<span style="color:var(--warning);">−${fmt(outsourceCost)}</span>`);
  if (commission > 0) lines.push(`− 分潤 ${commissionRate}%　 <span style="color:var(--warning);">−${fmt(commission)}</span>`);
  const netColor = net < 0 ? 'var(--danger)' : 'var(--success)';
  const netStr = net < 0 ? `⚠️ −${fmt(-net)}（倒貼）` : fmt(net);
  lines.push(`<span style="border-top: 1px solid var(--border); display: inline-block; padding-top: 2px; margin-top: 2px;">我實收 <b style="color:${netColor};">${netStr}</b></span>`);
  body.innerHTML = lines.join('<br>');
}

function renderJobPayments() {
  const list = document.getElementById('job-payments-list');
  if (!list) return;
  if (!modalPayments.length) {
    list.innerHTML = '<div style="font-size: 12px; color: var(--muted); padding: 4px 0;">尚無收款紀錄</div>';
  } else {
    list.innerHTML = modalPayments.map((p, i) => `
      <div style="display: flex; gap: 8px; align-items: center; padding: 4px 0; font-size: 13px;">
        <span style="color: var(--muted); min-width: 92px;">${p.date || '-'}</span>
        <span style="flex: 1; color: var(--success); font-weight: 600;">+${fmt(+p.amount||0)}</span>
        <span style="color: var(--muted); font-size: 12px;">${escapeHtml(p.note||'')}</span>
        <button type="button" class="btn btn-ghost btn-sm" onclick="removeJobPayment(${i})" style="color: var(--danger); padding: 2px 6px;">✕</button>
      </div>
    `).join('');
  }
  // 更新狀態 badge
  const base = +document.getElementById('job-amount').value || 0;
  const type = document.querySelector('input[name="job-discount-type"]:checked')?.value || 'none';
  const dval = +document.getElementById('job-discount-value').value || 0;
  let final = base;
  if (type === 'fixed') final = Math.max(0, base - dval);
  else if (type === 'percent') final = Math.max(0, Math.round(base * (1 - dval / 100)));
  const paid = modalPayments.reduce((s,p) => s + (+p.amount || 0), 0);
  const writeOff = +document.getElementById('job-write-off')?.value || 0;
  const badge = document.getElementById('job-payment-status-badge');
  if (badge) {
    if (final === 0) badge.innerHTML = '';
    else if (paid + writeOff >= final) badge.innerHTML = '<span style="background: var(--success-light); color: var(--success); padding: 1px 6px; border-radius: 4px; font-weight: 600;">✓ 已結清</span>';
    else if (paid > 0) badge.innerHTML = `<span style="background: var(--warning-light); color: var(--warning); padding: 1px 6px; border-radius: 4px; font-weight: 600;">部分收款</span>`;
    else badge.innerHTML = `<span style="background: var(--danger-light); color: var(--danger); padding: 1px 6px; border-radius: 4px; font-weight: 600;">未收款</span>`;
  }
  const summaryEl = document.getElementById('job-payment-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `應收 <b>${fmt(final)}</b> · 已收 <b style="color: var(--success);">${fmt(paid)}</b> · 待收 <b style="color: ${final-paid-writeOff>0?'var(--warning)':'var(--muted)'};">${fmt(Math.max(0, final - paid - writeOff))}</b>`;
  }
}

function openAddJobPayment() {
  document.getElementById('job-payment-add-form').classList.remove('hidden');
  document.getElementById('job-payment-add-btn').classList.add('hidden');
  document.getElementById('job-payment-add-date').value = todayStr();
  // 預設帶入剩餘待收金額
  const base = +document.getElementById('job-amount').value || 0;
  const type = document.querySelector('input[name="job-discount-type"]:checked')?.value || 'none';
  const dval = +document.getElementById('job-discount-value').value || 0;
  let final = base;
  if (type === 'fixed') final = Math.max(0, base - dval);
  else if (type === 'percent') final = Math.max(0, Math.round(base * (1 - dval / 100)));
  const paid = modalPayments.reduce((s,p) => s + (+p.amount || 0), 0);
  const writeOff = +document.getElementById('job-write-off')?.value || 0;
  const remaining = Math.max(0, final - paid - writeOff);
  document.getElementById('job-payment-add-amount').value = remaining || '';
  document.getElementById('job-payment-add-note').value = '';
  setTimeout(() => document.getElementById('job-payment-add-amount').focus(), 50);
}

function cancelAddJobPayment() {
  document.getElementById('job-payment-add-form').classList.add('hidden');
  document.getElementById('job-payment-add-btn').classList.remove('hidden');
}

function confirmAddJobPayment() {
  const date = document.getElementById('job-payment-add-date').value;
  const amount = +document.getElementById('job-payment-add-amount').value;
  const note = document.getElementById('job-payment-add-note').value || '';
  if (!date) { toast('請選日期'); return; }
  if (!amount || amount <= 0) { toast('金額無效'); return; }
  modalPayments.push({ id: uid(), date, amount, note });
  modalPayments.sort((a,b) => (a.date||'').localeCompare(b.date||''));
  cancelAddJobPayment();
  updateJobAmountSummary();
  toast('✓ 已新增收款');
}

function removeJobPayment(i) {
  modalPayments.splice(i, 1);
  updateJobAmountSummary();
  toast('已刪除收款紀錄');
}

// 一鍵把待收餘額補一筆收款
function markJobFullyPaid() {
  const base = +document.getElementById('job-amount').value || 0;
  const type = document.querySelector('input[name="job-discount-type"]:checked')?.value || 'none';
  const dval = +document.getElementById('job-discount-value').value || 0;
  let final = base;
  if (type === 'fixed') final = Math.max(0, base - dval);
  else if (type === 'percent') final = Math.max(0, Math.round(base * (1 - dval / 100)));
  const paid = modalPayments.reduce((s,p) => s + (+p.amount || 0), 0);
  const writeOff = +document.getElementById('job-write-off')?.value || 0;
  const remaining = Math.max(0, final - paid - writeOff);
  if (remaining <= 0) { toast('已經結清了'); return; }
  modalPayments.push({ id: uid(), date: todayStr(), amount: remaining, note: '一次收齊' });
  modalPayments.sort((a,b) => (a.date||'').localeCompare(b.date||''));
  updateJobAmountSummary();
  toast(`✓ 已補一筆 ${fmt(remaining)}`);
}

// 工時與時薪即時計算提示
function updateJobHourlyHint() {
  const hint = document.getElementById('job-hourly-hint');
  if (!hint) return;
  const amt = +document.getElementById('job-amount')?.value || 0;
  const hrs = +document.getElementById('job-hours')?.value || 0;
  if (amt > 0 && hrs > 0) {
    const rate = Math.round(amt / hrs);
    hint.innerHTML = `💰 平均時薪：<b>NT$ ${fmt(rate).replace('NT$', '').trim()}/hr</b>`;
  } else {
    hint.innerHTML = '';
  }
}

function refreshTagSuggestions() {
  // v3.14.0：升級成包含業主 + 案件多 tag 的全集（datalist suggestion 兩處共用）
  if (typeof refreshAllTagSuggestions === 'function') {
    refreshAllTagSuggestions();
    return;
  }
  const dl = document.getElementById('tag-suggestions');
  if (!dl) return;
  dl.innerHTML = getUsedTags().map(t => `<option value="${escapeHtml(t)}">`).join('');
}

// 切換業主時：儲值制業主自動勾「已收款」並顯示餘額
function onJobClientChange() {
  const cid = document.getElementById('job-client').value;
  const c = getClient(cid);
  const hint = document.getElementById('job-prepaid-hint');
  if (!c?.prepaidMode) {
    hint?.classList.add('hidden');
    return;
  }
  // 儲值制業主：自動勾「已收款」（編輯時不要強制覆蓋）
  if (!editingJobId) {
    document.getElementById('job-paid').checked = true;
  }
  // 顯示餘額提示
  const bal = clientBalance(cid);
  if (bal && hint) {
    const amt = +document.getElementById('job-amount').value || 0;
    const willBe = bal.balance - amt;
    let warn = '';
    if (willBe < 0) warn = `<br>⚠️ 案件金額超過餘額！會超支 ${fmt(-willBe)}`;
    else if (willBe < 1000) warn = `<br>⚠️ 扣款後餘額剩 ${fmt(willBe)}，建議提醒業主再儲值`;
    hint.innerHTML = `💰 ${escapeHtml(c.name)} 是儲值制，目前餘額 <b>${fmt(bal.balance)}</b>${warn}`;
    hint.classList.remove('hidden');
  }
}

function editJob(id) {
  const j = state.jobs.find(x => x.id === id); if (!j) return;
  editingJobId = id;
  document.getElementById('job-modal-title').textContent = '編輯案件';
  document.getElementById('job-delete-btn').classList.remove('hidden');
  const cs = document.getElementById('job-client');
  cs.innerHTML = sortedClientsForPicker().map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  cs.value = j.clientId;
  document.getElementById('job-date').value = j.date || '';
  document.getElementById('job-end-date').value = j.endDate || '';
  document.getElementById('job-title').value = j.title || '';
  document.getElementById('job-tag').value = '';
  // v3.14.0：載入 multi-tag（向下相容舊單字串 j.tag）
  modalJobTags = Array.isArray(j.tags) ? [...j.tags] : (j.tag ? [j.tag] : []);
  renderJobTagsChips();
  document.getElementById('job-details').value = j.details || '';
  document.getElementById('job-amount').value = j.amount || '';
  // v3.2.0：填入單價 + 數量
  const qty = j.quantity != null ? j.quantity : 1;
  document.getElementById('job-quantity').value = qty;
  const unit = qty > 0 ? Math.round((+j.amount || 0) / qty) : (+j.amount || 0);
  document.getElementById('job-unit-price').value = unit;
  document.getElementById('job-hours').value = j.hoursWorked || '';
  document.getElementById('job-done').checked = !!j.done;
  document.getElementById('job-cancelled').checked = !!j.cancelled;
  document.getElementById('job-estimate').checked = !!j.isEstimate;
  document.getElementById('job-done-at').value = j.doneAt || '';
  // v2.8.0: 折扣 + payments
  setDiscountUI(j.discountType || 'none', j.discountValue || 0);
  document.getElementById('job-write-off').value = j.writeOff || '';
  modalPayments = JSON.parse(JSON.stringify(j.payments || []));
  cancelAddJobPayment();
  // v3.24.0：載入派外包欄位
  if (document.getElementById('job-outsource-to')) document.getElementById('job-outsource-to').value = j.outsourceTo || '';
  if (document.getElementById('job-outsource-cost')) document.getElementById('job-outsource-cost').value = j.outsourceCost || '';
  if (document.getElementById('job-outsource-details')) {
    // 有外包資料時自動展開（讓使用者一眼看到）
    document.getElementById('job-outsource-details').open = !!(j.outsourceCost > 0 || j.outsourceTo);
  }
  // v3.24.7：恢復扣稅 toggle，編輯時還原案件值
  if (document.getElementById('job-tax-applied')) document.getElementById('job-tax-applied').checked = !!j.taxApplied;
  updateJobAmountSummary();
  document.getElementById('job-duplicate-btn')?.classList.remove('hidden');
  // 估價單模式：顯示「轉正」與「估價單 PDF」按鈕
  document.getElementById('job-export-estimate-btn')?.classList.toggle('hidden', !j.isEstimate);
  document.getElementById('job-confirm-estimate-btn')?.classList.toggle('hidden', !j.isEstimate);
  // v2.6: 子任務 + 計時器（v3.10.0：傳 jobId 讓計時器知道是哪個案件 → 對到全局 activeTimer 才顯示計時中狀態）
  modalSubtasks = JSON.parse(JSON.stringify(j.subtasks || []));
  renderJobSubtasks();
  loadJobTimer(j.timeSpentMs || 0, j.id);
  refreshTagSuggestions();
  onJobClientChange();
  updateJobHourlyHint();
  setJobDetailsOpenState(j);  // v3.6.4：依案件資料決定 details 展開（折扣/子任務/收款有資料才展開）
  document.getElementById('job-modal').classList.add('open');
}

// 複製為新案件：保留欄位資料、重設日期/狀態
function duplicateJob() {
  if (!editingJobId) return;
  // 切到「新增」模式但保留現有欄位
  editingJobId = null;
  document.getElementById('job-modal-title').textContent = '新增案件（複製自現有案件）';
  document.getElementById('job-delete-btn').classList.add('hidden');
  document.getElementById('job-duplicate-btn').classList.add('hidden');
  // 清狀態（新案件預設未完成、未收款、未取消、日期改成今天）
  document.getElementById('job-date').value = todayStr();
  document.getElementById('job-end-date').value = '';
  document.getElementById('job-done').checked = false;
  document.getElementById('job-paid').checked = false;
  document.getElementById('job-cancelled').checked = false;
  document.getElementById('job-done-at').value = '';
  document.getElementById('job-paid-at').value = '';
  // 案件名稱加上「(複製)」字樣，方便辨識
  const title = document.getElementById('job-title');
  if (title.value && !title.value.includes('(複製)')) title.value = title.value + ' (複製)';
  toast('✓ 已複製欄位，按儲存即可建立新案件');
}

// 勾選完成時自動填今日（如果空白）
function onJobDoneChange() {
  const checked = document.getElementById('job-done').checked;
  const dateEl = document.getElementById('job-done-at');
  if (checked && !dateEl.value) dateEl.value = todayStr();
  if (!checked) dateEl.value = '';
}
function onJobPaidChange() {
  const checked = document.getElementById('job-paid').checked;
  const dateEl = document.getElementById('job-paid-at');
  if (checked && !dateEl.value) dateEl.value = todayStr();
  if (!checked) dateEl.value = '';
}

function closeJobModal() {
  stopJobTimerOnClose();  // v2.6: 停止計時器
  document.getElementById('job-modal').classList.remove('open');
  document.getElementById('job-date').value = '';
  // v3.0.0：移除 releaseEditLock（v2 編輯鎖已拆）
}

function saveJob() {
  const isDone = document.getElementById('job-done').checked;
  const isCancelled = document.getElementById('job-cancelled').checked;
  const endDate = document.getElementById('job-end-date').value;
  const hoursVal = document.getElementById('job-hours').value;
  const isEstimate = document.getElementById('job-estimate').checked;
  // v3.22.7 修：原本呼叫 getCurrentTimerMs()（函式不存在 → ReferenceError 整個 saveJob 拋錯 → 按鈕沒反應）
  // v3.10.0 起 timer 是全局狀態，startTimer/pauseTimer 已即時把累計 ms 寫回 j.timeSpentMs
  // 這裡只在「該案件正在計時」時才取最新累計值（含目前 session 進行中的部分）；否則維持 payload 不帶
  const editingJob = editingJobId ? state.jobs.find(x => x.id === editingJobId) : null;
  const isCurrentlyActive = editingJobId && activeTimer && activeTimer.jobId === editingJobId;
  const timeSpentMs = isCurrentlyActive
    ? getActiveTimerMs()
    : (editingJob ? (+editingJob.timeSpentMs || 0) : 0);
  // v2.8.0: 折扣 + payments
  const discountType = document.querySelector('input[name="job-discount-type"]:checked')?.value || 'none';
  const discountValue = +document.getElementById('job-discount-value').value || 0;
  const writeOff = +document.getElementById('job-write-off').value || 0;
  const manualDoneAt = document.getElementById('job-done-at').value;

  const payload = {
    clientId: document.getElementById('job-client').value,
    date: document.getElementById('job-date').value,
    endDate: endDate || null,
    title: document.getElementById('job-title').value.trim(),
    // v3.14.0：multi-tag（保留 tag 字串相容老 caller，取陣列第一個）
    tags: [...modalJobTags],
    tag: modalJobTags[0] || '',
    details: document.getElementById('job-details').value.trim(),
    amount: +document.getElementById('job-amount').value || 0,
    // v3.2.0：數量（單價只是顯示用，不存）
    quantity: Math.max(1, parseInt(document.getElementById('job-quantity')?.value || '1', 10) || 1),
    hoursWorked: hoursVal ? +hoursVal : null,
    done: isDone,
    cancelled: isCancelled,
    isEstimate: isEstimate,
    subtasks: [...modalSubtasks],
    timeSpentMs: timeSpentMs,
    // v2.8.0:
    discountType: discountType,
    discountValue: discountValue,
    payments: [...modalPayments],
    writeOff: writeOff,
    // v3.24.0：派外包欄位
    outsourceTo: (document.getElementById('job-outsource-to')?.value || '').trim(),
    outsourceCost: +document.getElementById('job-outsource-cost')?.value || 0,
    // v3.24.7：恢復 case-level taxApplied（per case 自己決定）
    taxApplied: !!document.getElementById('job-tax-applied')?.checked
  };
  if (!payload.title) { toast('請輸入案件名稱'); return; }
  // v3.24.0：擋負金額（0 仍允許 — 估價 / 諮詢用）
  if (payload.amount < 0) { toast('案件金額不能是負數'); return; }
  if (payload.outsourceCost < 0) { toast('外包金額不能是負數'); return; }

  const c = getClient(payload.clientId);
  if (editingJobId) {
    const j = state.jobs.find(x => x.id === editingJobId);
    // v3.23.0：mascot 觸發前的對比快照
    const wasDone = !!j.done;
    const wasFullyPaid = jobIsFullyPaid(j);
    const prevPaymentCount = (j.payments || []).length;
    // 完成日邏輯（保留原樣）
    if (manualDoneAt && payload.done) payload.doneAt = manualDoneAt;
    else if (!j.done && payload.done) payload.doneAt = todayStr();
    else if (!payload.done) payload.doneAt = null;
    else payload.doneAt = j.doneAt;
    Object.assign(j, payload);
    recomputePaidStatus(j);
    logAction('job-edit', { jobId: editingJobId, title: payload.title, amount: payload.amount, clientId: payload.clientId, clientName: c?.name });
    // v3.23.0：觸發 mascot — 優先級 fully-paid > done > paid（同時只取一個）
    if (typeof mascotSay === 'function') {
      if (!wasFullyPaid && jobIsFullyPaid(j)) {
        mascotSay('job-fully-paid');
        if (typeof mascotTrackCompletion === 'function') mascotTrackCompletion();
      } else if (!wasDone && j.done) {
        mascotSay('job-done');
        if (typeof mascotTrackCompletion === 'function') mascotTrackCompletion();
      } else if ((j.payments || []).length > prevPaymentCount && jobPaidTotal(j) > 0) {
        // v3.23.3：偵測大筆收款（取本次新增的 payment 加總）
        const newPayments = (j.payments || []).slice(prevPaymentCount);
        const newPaymentSum = newPayments.reduce((s, p) => s + (+p.amount || 0), 0);
        if (newPaymentSum >= BIG_PAYMENT_THRESHOLD && typeof mascotOnPaymentAdd === 'function') {
          mascotOnPaymentAdd(newPaymentSum);  // shocked + big-payment
        } else {
          mascotSay('job-paid');
        }
      }
    }
  } else {
    payload.doneAt = payload.done ? (manualDoneAt || todayStr()) : null;
    const newJob = { id: uid(), ...payload };
    recomputePaidStatus(newJob);
    state.jobs.push(newJob);
    logAction('job-create', { jobId: newJob.id, title: payload.title, amount: payload.amount, clientId: payload.clientId, clientName: c?.name });
    // v3.23.0：觸發 mascot
    if (typeof mascotSay === 'function') mascotSay('job-create');
  }
  save(); closeJobModal(); render(); toast('已儲存');
}

function deleteJob() {
  if (!editingJobId) return;
  if (!confirm('確定要刪除這筆案件？')) return;
  const j = state.jobs.find(x => x.id === editingJobId);
  const c = j ? getClient(j.clientId) : null;
  // v3.15.0：先 snapshot 再執行
  pushUndoSnapshot(`已刪除案件「${j ? (j.title || '無標題') : ''}」`);
  // v3.10.0：刪掉的案件如果正在計時，清掉計時器
  if (activeTimer.jobId === editingJobId) clearActiveTimer();
  state.jobs = state.jobs.filter(j => j.id !== editingJobId);
  if (j) logAction('job-delete', { jobId: editingJobId, title: j.title, amount: j.amount, clientId: j.clientId, clientName: c?.name });
  // v3.23.0：mascot — 刪除案件
  if (typeof mascotSay === 'function') mascotSay('job-delete');
  save(); closeJobModal(); render();
}

// ----- Client Modal -----
let editingClientId = null;
let pickedColor = COLORS[0];

// v2.7.9: 把 1-31 號的 select option 填好（共用）
function populateBillingDayDropdown(selected) {
  const sel = document.getElementById('client-billing-day');
  if (!sel) return;
  let html = '<option value="0">— 無固定 —</option>';
  for (let d = 1; d <= 31; d++) html += `<option value="${d}">${d} 號</option>`;
  sel.innerHTML = html;
  sel.value = String(selected || 0);
}

function openClientModal() {
  // v3.0.0：移除 tryAcquireLockOrWarn（v2 編輯鎖已拆）
  editingClientId = null;
  document.getElementById('client-modal-title').textContent = '新增業主';
  document.getElementById('client-delete-btn').classList.add('hidden');
  document.getElementById('client-name').value = '';
  document.getElementById('client-note').value = '';
  document.getElementById('client-commission-rate').value = '';
  populateBillingDayDropdown(0);
  document.getElementById('client-billing-remind-days').value = 3;
  document.getElementById('client-unpaid-override').value = '';
  modalPrepayments = [];
  setPaymentMode('normal');
  refreshCommissionDropdown('');
  renderColorPicker(COLORS[state.clients.length % COLORS.length]);
  document.getElementById('client-modal').classList.add('open');
}

function editClient(id) {
  const c = getClient(id); if (!c) return;
  editingClientId = id;
  document.getElementById('client-modal-title').textContent = '編輯業主';
  document.getElementById('client-delete-btn').classList.remove('hidden');
  document.getElementById('client-name').value = c.name;
  document.getElementById('client-note').value = c.note || '';
  document.getElementById('client-commission-rate').value = c.commissionRate || '';
  populateBillingDayDropdown(c.billingDay || 0);
  document.getElementById('client-billing-remind-days').value = c.billingRemindDays || 3;
  document.getElementById('client-unpaid-override').value = c.unpaidRemindDaysOverride != null ? c.unpaidRemindDaysOverride : '';
  modalPrepayments = JSON.parse(JSON.stringify(c.prepayments || []));
  setPaymentMode(c.prepaidMode ? 'prepaid' : 'normal');
  refreshCommissionDropdown(c.commissionTo || '');
  renderColorPicker(c.color);
  document.getElementById('client-modal').classList.add('open');
}

// ============== 儲值紀錄管理（業主 Modal）==============
let modalPrepayments = [];  // Modal 內當前編輯的儲值清單

function setPaymentMode(mode) {
  const radios = document.querySelectorAll('input[name="client-payment-mode"]');
  radios.forEach(r => { r.checked = (r.value === mode); });
  document.getElementById('prepayment-section').classList.toggle('hidden', mode !== 'prepaid');
  if (mode === 'prepaid') renderPrepaymentList();
}

function onPaymentModeChange() {
  const mode = document.querySelector('input[name="client-payment-mode"]:checked')?.value || 'normal';
  document.getElementById('prepayment-section').classList.toggle('hidden', mode !== 'prepaid');
  if (mode === 'prepaid') renderPrepaymentList();
}

function renderPrepaymentList() {
  const list = document.getElementById('prepayment-list');
  if (!list) return;
  if (!modalPrepayments.length) {
    list.innerHTML = '<div style="font-size: 12px; color: var(--muted); padding: 4px 0;">尚無儲值紀錄</div>';
  } else {
    list.innerHTML = modalPrepayments.map((p, i) => `
      <div style="display: flex; gap: 8px; align-items: center; padding: 4px 0; font-size: 13px;">
        <span style="color: var(--muted); min-width: 92px;">${p.date}</span>
        <span style="flex: 1; color: var(--success); font-weight: 600;">+${fmt(+p.amount||0)}</span>
        <span style="color: var(--muted); font-size: 12px;">${escapeHtml(p.note||'')}</span>
        <button type="button" class="btn btn-ghost btn-sm" onclick="removePrepayment(${i})" style="color: var(--danger); padding: 2px 6px;">✕</button>
      </div>
    `).join('');
  }

  // 計算餘額
  // v3.22.5：used 改用 jobFinalAmount（折扣後）— 跟 clientBalance() 對齊
  const total = modalPrepayments.reduce((s,p) => s + (+p.amount||0), 0);
  const used = editingClientId ? activeJobs().filter(j => j.clientId === editingClientId).reduce((s,j) => s + jobFinalAmount(j), 0) : 0;
  const balance = total - used;
  document.getElementById('prepayment-balance').innerHTML =
    `累計儲值：<b>${fmt(total)}</b> · 已使用：<b>${fmt(used)}</b> · ` +
    `<span style="color: ${balance < 1000 ? 'var(--danger)' : 'var(--success)'};">餘額 <b>${fmt(balance)}</b></span>`;
}

// Inline 新增儲值：開啟頁面內表單
function openAddPrepayment() {
  const form = document.getElementById('prepayment-add-form');
  const btn = document.getElementById('prepayment-add-btn');
  if (!form) return;
  // 預設值
  document.getElementById('prepayment-add-date').value = todayStr();
  document.getElementById('prepayment-add-amount').value = '';
  document.getElementById('prepayment-add-note').value = '';
  form.classList.remove('hidden');
  if (btn) btn.classList.add('hidden');
  setTimeout(() => document.getElementById('prepayment-add-amount')?.focus(), 50);
}

function cancelAddPrepayment() {
  document.getElementById('prepayment-add-form')?.classList.add('hidden');
  document.getElementById('prepayment-add-btn')?.classList.remove('hidden');
}

function confirmAddPrepayment() {
  const dateStr = document.getElementById('prepayment-add-date').value;
  const amtStr = document.getElementById('prepayment-add-amount').value;
  const note = document.getElementById('prepayment-add-note').value || '';
  if (!dateStr) { toast('請選日期'); return; }
  const amt = +amtStr;
  if (isNaN(amt) || amt <= 0) { toast('金額無效'); return; }
  modalPrepayments.push({ id: uid(), date: dateStr, amount: amt, note });
  modalPrepayments.sort((a,b) => (a.date||'').localeCompare(b.date||''));
  cancelAddPrepayment();
  renderPrepaymentList();
  toast('✓ 已新增儲值紀錄');
}

// 舊的 prompt 版本保留別名以防其他地方有引用
function addPrepayment() { openAddPrepayment(); }

function removePrepayment(i) {
  // 直接刪除（要復原可重新新增；不再用 confirm 彈窗）
  modalPrepayments.splice(i, 1);
  renderPrepaymentList();
  toast('已刪除一筆儲值紀錄');
}

function refreshCommissionDropdown(selected) {
  const sel = document.getElementById('client-commission-to');
  if (!sel) return;
  // 介紹人選單：列出其他業主（不含自己）
  sel.innerHTML = '<option value="">— 無 —</option>' +
    state.clients
      .filter(c => c.id !== editingClientId)
      .map(c => `<option value="${c.id}" ${selected===c.id?'selected':''}>${escapeHtml(c.name)}</option>`).join('');
}

function closeClientModal() {
  document.getElementById('client-modal').classList.remove('open');
  // v3.0.0：移除 releaseEditLock（v2 編輯鎖已拆）
}

function renderColorPicker(selected) {
  pickedColor = selected;
  const box = document.getElementById('color-picker');
  box.innerHTML = COLORS.map(col => `<div onclick="pickColor('${col}')" style="width: 32px; height: 32px; border-radius: 50%; background: ${col}; cursor: pointer; border: 3px solid ${col===selected?'var(--text)':'transparent'};"></div>`).join('');
}

function pickColor(col) { renderColorPicker(col); }

function saveClient() {
  const name = document.getElementById('client-name').value.trim();
  const note = document.getElementById('client-note').value.trim();
  const commissionRate = +document.getElementById('client-commission-rate').value || 0;
  const commissionTo = document.getElementById('client-commission-to').value;
  const paymentMode = document.querySelector('input[name="client-payment-mode"]:checked')?.value || 'normal';
  // v2.7.9: 請款設定
  const billingDay = +document.getElementById('client-billing-day').value || 0;
  const billingRemindDays = +document.getElementById('client-billing-remind-days').value || 3;
  const unpaidOverrideRaw = document.getElementById('client-unpaid-override').value.trim();
  const unpaidRemindDaysOverride = unpaidOverrideRaw === '' ? null : (+unpaidOverrideRaw || null);
  if (!name) { toast('請輸入業主名稱'); return; }
  const payload = {
    name, note, color: pickedColor,
    commissionRate, commissionTo,
    prepaidMode: paymentMode === 'prepaid',
    prepayments: paymentMode === 'prepaid' ? modalPrepayments : [],
    billingDay,
    billingRemindDays,
    unpaidRemindDaysOverride
  };
  if (editingClientId) {
    const c = getClient(editingClientId);
    Object.assign(c, payload);
    logAction('client-edit', { clientId: editingClientId, name: payload.name });
  } else {
    const newId = uid();
    state.clients.push({ id: newId, ...payload });
    logAction('client-create', { clientId: newId, name: payload.name });
    // v3.23.0：mascot — 新業主
    if (typeof mascotSay === 'function') mascotSay('client-create');
  }
  save(); closeClientModal(); render(); toast('已儲存');
}

function deleteClient() {
  if (!editingClientId) return;
  const c = getClient(editingClientId);
  const cnt = state.jobs.filter(j => j.clientId === editingClientId).length;
  if (!confirm(`確定要刪除業主「${c.name}」？這將同時刪除 ${cnt} 筆案件。`)) return;
  // v3.15.0：snapshot for undo
  pushUndoSnapshot(`已刪除業主「${c.name}」+ ${cnt} 筆案件`);
  state.jobs = state.jobs.filter(j => j.clientId !== editingClientId);
  state.clients = state.clients.filter(x => x.id !== editingClientId);
  logAction('client-delete', { clientId: editingClientId, name: c.name, deletedJobs: cnt });
  save(); closeClientModal(); render();
}

// ----- Invoice actions -----
function gotoInvoice(cid) {
  switchTab('invoice');
  setTimeout(() => {
    document.getElementById('inv-client').value = cid;
    document.getElementById('inv-month').value = thisMonth();
    drawInvoice();
  }, 50);
}

function copyInvoiceText() {
  const cid = document.getElementById('inv-client').value;
  const mode = document.getElementById('inv-mode')?.value || 'single';
  const mm = document.getElementById('inv-month').value;
  const mmEnd = document.getElementById('inv-month-end')?.value || mm;
  const c = getClient(cid); if (!c) return;

  let rangeStart = mm, rangeEnd = mm;
  if (mode === 'range') {
    if (mmEnd < mm) { rangeStart = mmEnd; rangeEnd = mm; }
    else { rangeStart = mm; rangeEnd = mmEnd; }
  }
  const periodLabel = rangeStart === rangeEnd ? rangeStart : `${rangeStart} ~ ${rangeEnd}`;

  const jobs = activeJobs().filter(j => {
    if (j.clientId !== cid) return false;
    const m = getMonth(j.date);
    return m >= rangeStart && m <= rangeEnd;
  }).sort((a,b) => (a.date||'').localeCompare(b.date||''));
  const paid = jobs.reduce((s,j) => s + jobPaidTotal(j), 0);
  const unpaid = jobs.filter(j => j.done).reduce((s,j) => s + jobUnpaidAmount(j), 0);
  const txt = `${periodLabel} ${c.name} 工作明細\n\n` +
    jobs.map(j => {
      const final = jobFinalAmount(j);
      const disc = jobDiscountAmount(j);
      const pTotal = jobPaidTotal(j);
      const st = jobIsFullyPaid(j) ? '✓已收' :
                 (pTotal > 0 ? `部分收款 (已收${fmt(pTotal).replace('NT$','')})` :
                 (j.done ? '$待收' : '進行中'));
      const amtStr = disc > 0 ? `${fmt(+j.amount||0)} − ${fmt(disc).replace('NT$','')} = ${fmt(final)}` : fmt(final);
      return `${j.date} | ${j.title} | ${amtStr} | ${st}${j.details?'\n  '+j.details:''}`;
    }).join('\n') +
    `\n\n本次請款（待收款）：${fmt(unpaid)}` +
    (paid ? `\n已收款：${fmt(paid)}` : '');
  navigator.clipboard.writeText(txt).then(() => {
    toast('✓ 已複製純文字版');
    recordInvoiceHistory('text-copy');  // v3.12.0
  });
}

function enterClientMode(cid) {
  const c = getClient(cid);
  if (!c) { alert('找不到此業主的資料'); return; }
  document.querySelector('nav.tabs').style.display = 'none';
  document.getElementById('fab-add').style.display = 'none';
  document.getElementById('page-title').textContent = c.name + ' - 工作明細';
  document.getElementById('page-sub').textContent = '只讀檢視';
  document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
  const inv = document.getElementById('tab-invoice');
  inv.classList.remove('hidden');
  setTimeout(() => {
    document.getElementById('inv-client').value = cid;
    document.getElementById('inv-client').disabled = true;
    drawInvoice();
  }, 50);
}

// ============== Import / Export / Demo ==============
function exportData() {
  const payload = {
    _exportedAt: new Date().toISOString(),
    _version: 'v1.0',
    _counts: { clients: state.clients.length, jobs: state.jobs.length, invoices: (state.invoiceHistory || []).length },
    clients: state.clients,
    jobs: state.jobs,
    invoiceHistory: state.invoiceHistory,
    config: {
      ...config,
      // 不要把連線密碼一起匯出（匯出資料備份時）
      sheetConfig: undefined,
      calId: undefined
    }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type: 'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `freelance-backup-${todayStr()}.json`;
  a.click();
  // 記錄匯出時間
  config.lastExportAt = todayStr();
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  render();
  toast('✓ 已匯出，備份時間已更新');
}

// ============== 我的收款資訊（v2.10.13 改成多筆收款帳號）==============

// 確保 paymentAccounts 陣列存在；若無但有舊單筆 bank/account → 自動建立「預設帳號」
function ensurePaymentAccounts() {
  config.userInfo = config.userInfo || {};
  const u = config.userInfo;
  if (!Array.isArray(u.paymentAccounts)) u.paymentAccounts = [];
  if (u.paymentAccounts.length === 0 && (u.bank || u.account)) {
    u.paymentAccounts.push({
      id: uid(),
      label: '預設帳號',
      bank: u.bank || '',
      account: u.account || '',
      note: ''
    });
  }
  if (u.paymentAccounts.length > 0 && !u.selectedPaymentAccountId) {
    u.selectedPaymentAccountId = u.paymentAccounts[0].id;
  }
  // 若選中的 id 不在陣列裡（被刪過）→ 重設為第一筆
  if (u.selectedPaymentAccountId && !u.paymentAccounts.find(a => a.id === u.selectedPaymentAccountId)) {
    u.selectedPaymentAccountId = u.paymentAccounts[0]?.id || '';
  }
  // v3.0.0-alpha.3：每筆 paymentAccount 補 bankbookImageFileId 預設欄位（idempotent）
  // 同時保留舊 bankbookImage（base64 dataURL）作為遷移期間的 fallback；遷移完成後該欄位會被清空
  // v3.2.0：合併個人資訊到 paymentAccount（schema v10）
  // 每筆 paymentAccount 自帶完整身分；首次升級從 top-level userInfo 一次性 backfill
  u.paymentAccounts.forEach(a => {
    if (!('bankbookImageFileId' in a)) a.bankbookImageFileId = '';
    // v10 個人資訊欄位
    if (a.name == null)         a.name = u.name || '';
    if (a.phone == null)        a.phone = u.phone || '';
    if (a.email == null)        a.email = u.email || '';
    if (a.invoiceTitle == null) a.invoiceTitle = u.invoiceTitle || '';
    if (a.taxId == null)        a.taxId = '';
    if (a.address == null)      a.address = '';
    if (a.invoiceNote == null)  a.invoiceNote = '';
    if (a.showPersonalInfo == null) a.showPersonalInfo = true;
    // v3.2.0-fix：新增「也在頂端精簡顯示」flag，預設 false（避免請款單變太長）
    if (a.showPersonalInfoOnTop == null) a.showPersonalInfoOnTop = false;
    // v3.2.0-ui：是否顯示發票資訊，預設 false（個人接案者不開發票，不需要這塊）
    if (a.showInvoiceInfo == null) a.showInvoiceInfo = false;
    // 既有 a.note 是「帳號備註」（請款單顯示在匯款資訊那一塊），維持不變
    // a.holderName 既有，維持不變
  });
}

// v2.10.15: 把上傳圖片縮到指定寬度 + JPEG 壓縮，回傳 data URL
function resizeImageToDataUrl(file, maxW = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('沒有檔案'));
    if (!file.type.startsWith('image/')) return reject(new Error('不是圖片檔'));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) { reject(err); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('讀取圖片失敗')); };
    img.src = url;
  });
}

// 上傳存摺照片：壓縮後寫入該帳號 row 的 hidden input，並更新預覽
// v3.0.0-alpha.3：上傳路徑改寫——優先寫 Drive 個別檔，沒登入或失敗才 fallback 到 base64
async function onBankbookFileChange(input, acctId) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('請選擇圖片檔'); input.value = ''; return; }

  toastProgress('🖼️ 壓縮圖片中…');
  let dataUrl;
  try {
    dataUrl = await resizeImageToDataUrl(file, 800, 0.7);
  } catch (err) {
    toastDismiss();
    toast('圖片處理失敗：' + (err.message || err));
    input.value = '';
    return;
  }

  const row = input.closest('.payment-account-row');
  if (!row) { toastDismiss(); toast('找不到帳號 row'); input.value = ''; return; }
  const oldFileIdField = row.querySelector('[data-acct-field="bankbookImageFileId"]');
  const oldBase64Field = row.querySelector('[data-acct-field="bankbookImage"]');
  const oldFileId = (oldFileIdField && oldFileIdField.value) || '';

  // 立即顯示 preview（不等 Drive 上傳完）
  const preview = document.getElementById(`bankbook-preview-${acctId}`);
  if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="存摺" style="max-width: 200px; max-height: 120px; border-radius: 6px; border: 1px solid var(--border); margin-top: 6px;">`;
  const removeBtn = document.getElementById(`bankbook-remove-${acctId}`);
  if (removeBtn) removeBtn.style.display = '';

  // 走 Drive 上傳：登入 + tracker init 完成才嘗試
  let newFileId = '';
  if (isCloudSignedIn() && cloudGetMeta().trackerFileId) {
    toastProgress('☁️ 上傳到 Drive…');
    try {
      const ext = (file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
      const filename = `bankbook-${acctId}-${Date.now()}.${ext}`;
      const uploaded = await driveUploadImage(dataUrl, filename);
      newFileId = uploaded.id;
      if (typeof logAction === 'function') {
        logAction('cloud-image-upload', { acctId, fileId: newFileId, size: uploaded.size });
      }
    } catch (e) {
      console.warn('[bankbook] Drive 上傳失敗，fallback 寫 base64:', e);
      // 不 throw，fallback 路徑繼續
    }
  }

  if (newFileId) {
    // Drive 上傳成功 → 寫 fileId、清掉 base64、回收舊孤兒
    if (oldFileIdField) oldFileIdField.value = newFileId;
    if (oldBase64Field) oldBase64Field.value = '';
    if (oldFileId && oldFileId !== newFileId) {
      // fire-and-forget：刪舊照片孤兒（失敗只是浪費 Drive 空間）
      driveDeleteFile(oldFileId).catch(e => console.warn('[bankbook] cleanup 舊孤兒失敗:', e));
    }
    toastDismiss();
    toast('✓ 已上傳到 Drive，記得按儲存', 3000);
  } else {
    // Fallback：寫 base64 到舊欄位、清掉 fileId
    if (oldBase64Field) oldBase64Field.value = dataUrl;
    if (oldFileIdField) oldFileIdField.value = '';
    if (oldFileId) {
      // 之前有 Drive 孤兒，但現在改用 base64 → 試刪舊的（fire-and-forget）
      driveDeleteFile(oldFileId).catch(() => {});
    }
    toastDismiss();
    if (!isCloudSignedIn()) {
      toast('⚠️ 未登入 Drive，圖片暫存本機；登入後自動遷移', 4000);
    } else {
      toast('⚠️ Drive 上傳失敗，圖片暫存本機；下次自動重試', 4000);
    }
  }

  input.value = '';
}

function clearBankbookImage(acctId) {
  const row = document.querySelector(`.payment-account-row[data-acct-id="${acctId}"]`);
  if (!row) return;
  const base64Field = row.querySelector('[data-acct-field="bankbookImage"]');
  const fileIdField = row.querySelector('[data-acct-field="bankbookImageFileId"]');
  const oldFileId = (fileIdField && fileIdField.value) || '';

  // 清 UI 跟 hidden fields
  if (base64Field) base64Field.value = '';
  if (fileIdField) fileIdField.value = '';
  const preview = document.getElementById(`bankbook-preview-${acctId}`);
  if (preview) preview.innerHTML = '';
  const removeBtn = document.getElementById(`bankbook-remove-${acctId}`);
  if (removeBtn) removeBtn.style.display = 'none';

  // v3.0.0-alpha.3：若有 Drive fileId → fire-and-forget 刪 Drive 檔避免孤兒
  if (oldFileId) {
    driveDeleteFile(oldFileId).then(() => {
      if (typeof logAction === 'function') {
        logAction('cloud-image-delete', { acctId, fileId: oldFileId });
      }
    }).catch(e => console.warn('[bankbook] 清除 Drive 孤兒失敗:', e));
  }

  toast('✓ 已清除存摺照片，記得按儲存');
}

// 取得目前要顯示在請款單上的收款帳號（依 selectedPaymentAccountId，找不到回第一筆）
function getActivePaymentAccount() {
  const u = config.userInfo || {};
  const list = Array.isArray(u.paymentAccounts) ? u.paymentAccounts : [];
  if (!list.length) {
    // 完全沒有 → 回退舊欄位（向下相容）
    return (u.bank || u.account) ? { bank: u.bank || '', account: u.account || '', note: '' } : null;
  }
  return list.find(a => a.id === u.selectedPaymentAccountId) || list[0];
}

// v3.3.1：v2 settings 頁「我的收款資訊」整套（loadUserInfoUI / renderPaymentAccountsUI / addPaymentAccount / removePaymentAccount / collectPaymentAccountsFromUI / saveUserInfo）已物理移除
// 收款帳號 CRUD 全部走請款單分頁 modal（openPaymentAccountEditor / savePaymentAccountEditor / deleteSelectedPaymentAccount）

function renderBackupStatus() {
  // 順便調整範例按鈕的安全提示
  const demoBtn = document.getElementById('demo-btn');
  if (demoBtn) {
    if (state.clients.length > 0 || state.jobs.length > 0) {
      demoBtn.textContent = '⚠️ 載入範例（會清空現有）';
      demoBtn.classList.remove('btn-outline');
      demoBtn.classList.add('btn-danger');
    } else {
      demoBtn.textContent = '載入範例資料';
      demoBtn.classList.remove('btn-danger');
      demoBtn.classList.add('btn-outline');
    }
  }

  const el = document.getElementById('backup-status');
  if (!el) return;
  const last = config.lastExportAt;
  if (!last) {
    el.textContent = '尚未備份';
    el.style.color = 'var(--danger)';
  } else {
    const days = daysBetween(last, todayStr());
    if (days === 0) {
      el.textContent = '✓ 今日已備份';
      el.style.color = 'var(--success)';
    } else if (days <= 7) {
      el.textContent = `${days} 天前備份過`;
      el.style.color = 'var(--success)';
    } else if (days <= config.backupRemindDays) {
      el.textContent = `${days} 天前備份過`;
      el.style.color = 'var(--warning)';
    } else {
      el.textContent = `${days} 天沒備份`;
      el.style.color = 'var(--danger)';
    }
  }
}

function exportCSV() {
  if (!state.jobs.length) { toast('沒有資料可匯出'); return; }

  const headers = ['日期', '截止日', '業主', '案件名稱', '類型', '細項', '金額', '抽成%', '實收金額', '狀態', '完成日', '收款日'];
  const rows = state.jobs
    .slice()
    .sort((a,b) => (a.date||'').localeCompare(b.date||''))
    .map(j => {
      const c = getClient(j.clientId);
      const clientName = c ? c.name : '未指定';
      const rate = (c?.commissionRate) || 0;
      const net = jobNetAmount(j);
      const status = j.cancelled ? '已取消' : (j.paid ? '已收款' : (j.done ? '完成待收' : '進行中'));
      return [
        j.date || '',
        j.endDate || '',
        clientName,
        j.title || '',
        j.tag || '',
        (j.details || '').replace(/\n/g, ' '),
        j.amount || 0,
        rate,
        net,
        status,
        j.doneAt || '',
        j.paidAt || ''
      ];
    });

  // CSV 字串建構（含 BOM 給 Excel 認得 UTF-8）
  const csv = '﻿' + [
    headers.join(','),
    ...rows.map(r => r.map(cell => {
      const s = String(cell);
      // 含逗號、引號、換行的要包雙引號並轉義
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `freelance-export-${todayStr()}.csv`;
  a.click();
  toast('✓ CSV 已匯出（用 Excel 開啟即可）');
}

function importData(e) {
  const f = e.target.files[0]; if (!f) return;
  e.target.value = '';
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);

      // 驗證
      if (!d.clients && !d.jobs) {
        alert('這似乎不是資料備份檔（缺少 clients/jobs 欄位）。\n\n注意：「跨裝置設定檔」跟「資料備份檔」是不同的東西。');
        return;
      }

      // 偵測來源版本（只是給使用者看的提示）
      const sourceVer = d.schemaVersion ? `schema v${d.schemaVersion}` : '未知 schema';
      const hasConfig = !!(d.config && typeof d.config === 'object');
      const hasPayAccts = !!(d.config?.userInfo?.paymentAccounts?.length);

      // 比對日期
      const importedAt = d._exportedAt || null;
      const localAt = config.lastModifiedAt || null;
      const localCnt = state.clients.length + state.jobs.length;

      let warningMsg = '';
      if (importedAt && localAt) {
        const importedDate = new Date(importedAt);
        const localDate = new Date(localAt);
        const diffMs = importedDate - localDate;
        const diffDays = Math.round(Math.abs(diffMs) / 86400000);
        if (diffMs > 0) {
          warningMsg = `📅 匯入檔比較新（${diffDays} 天）\n• 匯入檔：${importedDate.toLocaleString('zh-TW')}\n• 現有資料：${localDate.toLocaleString('zh-TW')}\n\n建議：直接匯入。`;
        } else if (diffMs < 0) {
          warningMsg = `⚠️ 警告：現有資料比較新（${diffDays} 天）！\n• 匯入檔：${importedDate.toLocaleString('zh-TW')}\n• 現有資料：${localDate.toLocaleString('zh-TW')}\n\n建議：先匯出現有資料備份，確認真的要回到舊版本再匯入。`;
        } else {
          warningMsg = `兩份資料時間相同：${importedDate.toLocaleString('zh-TW')}`;
        }
      } else if (importedAt) {
        warningMsg = `匯入檔：${new Date(importedAt).toLocaleString('zh-TW')}\n現有資料：（沒有時間記錄）`;
      } else {
        warningMsg = '⚠️ 匯入檔沒有時間戳（可能是舊版本檔案），無法判斷新舊';
      }

      // v3.22.1：強化 confirm 訊息，列出會自動處理的東西
      const willImport = [
        `• 業主 ${d.clients?.length||0} 位（現有 ${state.clients.length} 位）`,
        `• 案件 ${d.jobs?.length||0} 筆（現有 ${state.jobs.length} 筆）`,
      ];
      if (hasPayAccts) willImport.push(`• 收款帳號 ${d.config.userInfo.paymentAccounts.length} 個`);
      if (hasConfig) willImport.push('• 通知與提醒、收益目標等所有偏好設定');
      willImport.push(`\n📋 來源：${sourceVer}（將自動升級到 v${CURRENT_SCHEMA_VERSION}）`);
      if (hasPayAccts && d.config.userInfo.paymentAccounts.some(p => p.bankbookImage && !p.bankbookImageFileId)) {
        willImport.push('🖼️ 存摺照片將自動上傳到 Drive App Folder');
      }
      const confirmMsg = `準備匯入（v3.22.1：自動升級 + 偏好設定也一起搬）：\n\n` +
        willImport.join('\n') + `\n\n` + warningMsg + `\n\n` +
        `⚠️ 匯入會覆蓋現有資料。確定？`;

      if (!confirm(confirmMsg)) return;

      if (localAt && importedAt && new Date(localAt) > new Date(importedAt) && localCnt > 0) {
        if (!confirm('再次確認：你的現有資料較新，匯入後會被舊版覆蓋。\n\n真的要繼續？')) return;
      }

      // ===== v3.22.1：完整 import — clients / jobs / config / paymentAccounts =====

      // 1. clients：補 v11 contact / v13 tags 預設值（runMigrations 也會跑一次當保險）
      state.clients = (d.clients || []).map(c => ({
        ...c,
        contact: (c.contact && typeof c.contact === 'object') ? c.contact : { person: '', phone: '', email: '', address: '' },
        tags: Array.isArray(c.tags) ? c.tags : []
      }));

      // 2. jobs：補各種版本的欄位，特別是 v6 → payments[] 的轉換
      state.jobs = (d.jobs || []).map(j => {
        const tags = Array.isArray(j.tags) ? j.tags : (j.tag ? [j.tag] : []);
        // v6 之前舊資料：有 paid:true + paidAt 但沒 payments[] → 自動補一筆 payment
        let payments = Array.isArray(j.payments) ? j.payments : [];
        if (j.paid && j.paidAt && payments.length === 0) {
          payments = [{
            id: uid(),
            date: j.paidAt,
            amount: +j.amount || 0,
            note: '自動轉換（v2 匯入時補）'
          }];
        }
        return {
          ...j,
          paid: j.paid ?? false,
          cancelled: j.cancelled ?? false,
          doneAt: j.doneAt ?? (j.done ? (j.date || todayStr()) : null),
          paidAt: j.paidAt ?? (j.paid ? (j.date || todayStr()) : null),
          quantity: j.quantity != null ? j.quantity : 1,
          tags,
          payments
        };
      });

      // 3. invoiceHistory：v2 沒有，留空陣列；v3 → v3 之間 import 才會有值
      state.invoiceHistory = Array.isArray(d.invoiceHistory) ? d.invoiceHistory : [];

      // 4. config：完整 import（含 userInfo / paymentAccounts / 通知偏好 / 目標）
      let importedConfigCnt = 0;
      if (hasConfig) {
        // 4a. userInfo top-level（個人資訊）
        if (d.config.userInfo && typeof d.config.userInfo === 'object') {
          config.userInfo = config.userInfo || {};
          ['name', 'phone', 'email', 'invoiceTitle', 'note', 'invoiceNote', 'taxId', 'address']
            .forEach(k => {
              if (d.config.userInfo[k] !== undefined) {
                config.userInfo[k] = d.config.userInfo[k];
              }
            });
          // 4b. paymentAccounts（v2 簡單版 → v3 完整版，從 top-level userInfo 補預設）
          if (Array.isArray(d.config.userInfo.paymentAccounts)) {
            config.userInfo.paymentAccounts = d.config.userInfo.paymentAccounts.map(pa => ({
              ...pa,
              // v3 完整身分欄位（v3.2.0 v10 加的），v2 沒有就從 top-level userInfo 補
              name: pa.name || d.config.userInfo.name || '',
              phone: pa.phone || d.config.userInfo.phone || '',
              email: pa.email || d.config.userInfo.email || '',
              invoiceTitle: pa.invoiceTitle || d.config.userInfo.invoiceTitle || '',
              taxId: pa.taxId || d.config.userInfo.taxId || '',
              address: pa.address || d.config.userInfo.address || '',
              invoiceNote: pa.invoiceNote || d.config.userInfo.invoiceNote || '',
              showPersonalInfo: pa.showPersonalInfo !== false,
              showPersonalInfoOnTop: !!pa.showPersonalInfoOnTop,
              showInvoiceInfo: !!pa.showInvoiceInfo,
              // v3 存摺照片新欄位（base64 留著、fileId 等遷移後填）
              bankbookImage: pa.bankbookImage || '',
              bankbookImageFileId: pa.bankbookImageFileId || ''
            }));
          }
          if (d.config.userInfo.selectedPaymentAccountId) {
            config.userInfo.selectedPaymentAccountId = d.config.userInfo.selectedPaymentAccountId;
          }
        }
        // 4c. 通知與提醒（欄位名 v2/v3 一樣，直接複製）
        const reminderKeys = [
          'unpaidRemindDays', 'dueSoonDays', 'monthEndReminderDay', 'backupRemindDays',
          'enableOverdueAlert', 'enableDueSoonAlert', 'enableUnpaidLongAlert',
          'enableMonthEndAlert', 'enableBillingDayAlert', 'enableSlowPayAlert',
          'enableBackupAlert'
        ];
        reminderKeys.forEach(k => {
          if (d.config[k] !== undefined) {
            config[k] = d.config[k];
            importedConfigCnt++;
          }
        });
        // 4d. v3.11 收益目標（v2 沒有，但 v3 → v3 import 會有）
        if (d.config.goals && typeof d.config.goals === 'object') {
          config.goals = { monthly: +d.config.goals.monthly || 0, yearly: +d.config.goals.yearly || 0 };
        }
        // 4e. 行事曆 follow 模式 / reminderDays 等較不常用偏好
        ['calReminderMode'].forEach(k => {
          if (d.config[k] !== undefined) config[k] = d.config[k];
        });
        // 注意：v2 的 sheetConfig / calApiUrl / calApiToken 等 Apps Script 中介設定 → 故意不 import
        //      v3 直接打 Drive / Calendar API，這些 v2 欄位無意義
      }

      // 5. 跑 schema migration（從匯入的舊 schema 升到 v13）
      if (typeof runMigrations === 'function') runMigrations(state);
      // 6. 雙保險：補 paymentAccounts 任何遺漏的欄位
      if (typeof ensurePaymentAccounts === 'function') ensurePaymentAccounts();

      // 7. 寫 localStorage + 推 Drive
      saveConfigOnly();
      save();
      renderAll();

      // 8. 觸發存摺照片 base64 → Drive 遷移（async fire-and-forget）
      //    強制重置 throttle 立刻跑
      if (typeof cloudMigrateBankbookImages === 'function' && typeof isCloudSignedIn === 'function' && isCloudSignedIn()) {
        try { cloudMigrateBankbookImagesCheckedAt = 0; } catch (_) {}
        cloudMigrateBankbookImages().catch(e => console.warn('[bankbook-migrate] failed after import:', e));
      }

      // 9. 操作日誌
      logAction('data-import', {
        sourceVersion: d.schemaVersion || '?',
        clients: state.clients.length,
        jobs: state.jobs.length,
        paymentAccounts: config.userInfo?.paymentAccounts?.length || 0,
        configFields: importedConfigCnt
      });

      // 10. 詳細 toast 摘要
      const summary = [
        `業主 ${state.clients.length} 位`,
        `案件 ${state.jobs.length} 筆`,
        config.userInfo?.paymentAccounts?.length ? `收款帳號 ${config.userInfo.paymentAccounts.length} 個` : '',
        importedConfigCnt > 0 ? `${importedConfigCnt} 項偏好` : ''
      ].filter(Boolean).join(' · ');
      toast(`✓ 已匯入：${summary}`, 5000);
      // v3.23.3：mascot 慶祝匯入成功
      if (typeof mascotSay === 'function') mascotSay('import-success');
    } catch(err) {
      alert('檔案格式錯誤：' + err.message);
      console.error('[importData] failed:', err);
      // v3.23.3：mascot error
      if (typeof mascotSetState === 'function') mascotSetState('error');
    }
  };
  r.readAsText(f);
}

function loadDemo() {
  // 已有資料時：兩次警告
  if (state.clients.length > 0 || state.jobs.length > 0) {
    const msg = `⚠️ 警告：載入範例資料會清空現有資料！\n\n` +
      `現有：${state.clients.length} 位業主、${state.jobs.length} 筆案件\n\n` +
      `如果你不確定，先按取消，到「💾 資料備份」匯出備份。\n\n確定要繼續？`;
    if (!confirm(msg)) return;
    const verify = prompt('最後確認：請輸入「載入範例」四個字才會執行（避免誤觸）');
    if (verify !== '載入範例') {
      toast('已取消（輸入文字不符）');
      return;
    }
  }
  // v3.22.0：豐富版 demo — 6 業主 / 30+ 案件 / 跨 14 個月 / 3 收款帳號
  // ----- helpers -----
  const today = new Date();
  const todayS = todayStr();
  const dayBack = (n) => addDays(new Date(), -n);   // n 天前
  const dayFwd = (n) => addDays(new Date(), n);     // n 天後
  const monthBackDay = (mBack, day) => {
    // mBack 個月前的某天，回傳 YYYY-MM-DD
    const d = new Date(today.getFullYear(), today.getMonth() - mBack, day);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  };

  // ----- 6 業主（不同類型 / 含 contact + tags） -----
  const c1 = uid(), c2 = uid(), c3 = uid(), c4 = uid(), c5 = uid(), c6 = uid();
  state.clients = [
    {
      id: c1, name: 'A 媒體公司', color: COLORS[0],
      note: '長期合作，月結 30 天，發票寄會計室',
      billingDay: 25,
      contact: { person: '王經理', phone: '02-2700-1234', email: 'wang@a-media.example.com', address: '台北市信義區信義路五段 7 號' },
      tags: ['VIP', '長期合作', '月結']
    },
    {
      id: c2, name: 'B 電商品牌', color: COLORS[2],
      note: '結案付款，下單頻繁，常做廣告素材',
      contact: { person: '林總監', phone: '0912-345-678', email: 'design@b-shop.example.com', address: '' },
      tags: ['電商', '頻繁下單']
    },
    {
      id: c3, name: 'C 設計工作室', color: COLORS[3],
      note: '介紹的同行，偶爾外包 overflow 過來',
      contact: { person: '陳設計師', phone: '0922-111-222', email: 'chen@c-studio.example.com', address: '' },
      tags: ['同行', '外包', '潛在']
    },
    {
      id: c4, name: 'D 出版社', color: COLORS[4],
      note: '月刊客戶，每月 25 日固定請款',
      billingDay: 25,
      contact: { person: '張主編', phone: '02-2345-6789', email: 'editor@d-publishing.example.com', address: '台北市中正區重慶南路一段 122 號' },
      tags: ['月刊', '長期合作']
    },
    {
      id: c5, name: 'E 個人客戶（張先生）', color: COLORS[5],
      note: '一次性 logo 案，預算有限',
      contact: { person: '張先生', phone: '0987-654-321', email: 'mr.chang@example.com', address: '' },
      tags: ['一次性', '個人']
    },
    {
      id: c6, name: 'F 政府單位', color: COLORS[7],
      note: '公文流程慢，付款週期 60-90 天，需要正式發票',
      billingDay: 15,
      contact: { person: '李承辦', phone: '02-2311-5555#3210', email: 'lee@gov.example.tw', address: '台北市中正區忠孝東路一段 1 號' },
      tags: ['政府', '拖款', '大金額']
    }
  ];

  // ----- 3 個收款帳號 -----
  const pa1 = uid(), pa2 = uid(), pa3 = uid();
  config.userInfo = config.userInfo || {};
  config.userInfo.paymentAccounts = [
    {
      id: pa1, label: '個人', holderName: '王小明',
      bank: '玉山銀行 (808)', account: '0000-1234-5678',
      note: '請註明案件名稱方便對帳',
      bankbookImage: '', bankbookImageFileId: '',
      name: '王小明', phone: '0912-000-000', email: 'demo@example.com',
      invoiceTitle: '', taxId: '', address: '', invoiceNote: '',
      showPersonalInfo: true, showPersonalInfoOnTop: false, showInvoiceInfo: false
    },
    {
      id: pa2, label: '工作室', holderName: '王小明設計工作室',
      bank: '玉山銀行 (808)', account: '0000-5678-9012',
      note: '工作室專用',
      bankbookImage: '', bankbookImageFileId: '',
      name: '王小明設計工作室', phone: '02-2700-9999', email: 'studio@example.com',
      invoiceTitle: '王小明設計工作室', taxId: '12345678',
      address: '台北市信義區市府路 45 號 8 樓',
      invoiceNote: '統一發票二聯式',
      showPersonalInfo: true, showPersonalInfoOnTop: false, showInvoiceInfo: true
    },
    {
      id: pa3, label: '公司', holderName: '小明創意有限公司',
      bank: '台新銀行 (812)', account: '0000-9876-5432',
      note: '公司戶（給政府 / 大企業客戶）',
      bankbookImage: '', bankbookImageFileId: '',
      name: '小明創意有限公司', phone: '02-2700-8888', email: 'contact@xiaoming-creative.example.com',
      invoiceTitle: '小明創意有限公司', taxId: '87654321',
      address: '台北市信義區市府路 45 號 8 樓',
      invoiceNote: '統一發票三聯式（請填寫公司抬頭與統編）',
      showPersonalInfo: true, showPersonalInfoOnTop: false, showInvoiceInfo: true
    }
  ];
  config.userInfo.selectedPaymentAccountId = pa1;
  saveConfigOnly();

  // ----- 案件（30+ 筆，跨 14 個月）-----
  // 過去資料偏向歷史（已收 / 已完成）；近期偏向 mix；未來偏向待做
  state.jobs = [];
  const J = (obj) => state.jobs.push(Object.assign({
    id: uid(),
    quantity: 1,
    done: false, paid: false, doneAt: null, paidAt: null,
    payments: [],
    tags: []
  }, obj));

  // ===== 14 個月前：歷史已結清 =====
  J({ clientId: c1, date: monthBackDay(14, 5), title: '月度社群圖卡 8 張', details: 'IG/FB 雙平台共 8 張', amount: 6400, quantity: 8, hoursWorked: 6,
      done: true, paid: true, doneAt: monthBackDay(14, 12), paidAt: monthBackDay(13, 5),
      payments: [{ id: uid(), date: monthBackDay(13, 5), amount: 6400, note: '月結' }],
      tags: ['設計', 'social'] });
  J({ clientId: c4, date: monthBackDay(14, 10), title: '月刊封面', details: 'A4 滿版 + 內頁配圖 3 張', amount: 12000, hoursWorked: 10,
      done: true, paid: true, doneAt: monthBackDay(14, 25), paidAt: monthBackDay(13, 25),
      payments: [{ id: uid(), date: monthBackDay(13, 25), amount: 12000 }],
      tags: ['設計', '月刊'] });

  // ===== 12-13 個月前 =====
  J({ clientId: c1, date: monthBackDay(13, 3), title: 'FB 廣告 banner 5 張', amount: 4500, quantity: 5,
      done: true, paid: true, doneAt: monthBackDay(13, 6), paidAt: monthBackDay(12, 5),
      payments: [{ id: uid(), date: monthBackDay(12, 5), amount: 4500 }],
      tags: ['廣告'] });
  J({ clientId: c2, date: monthBackDay(12, 10), title: '雙11 主視覺 + EDM', details: '主視覺 1 + EDM 3 套', amount: 28000, hoursWorked: 24,
      done: true, paid: true, doneAt: monthBackDay(12, 28), paidAt: monthBackDay(11, 10),
      payments: [{ id: uid(), date: monthBackDay(11, 10), amount: 28000 }],
      tags: ['設計', '電商', '大案'] });
  J({ clientId: c4, date: monthBackDay(12, 10), title: '月刊封面 + 編輯', amount: 12000,
      done: true, paid: true, doneAt: monthBackDay(12, 25), paidAt: monthBackDay(11, 25),
      payments: [{ id: uid(), date: monthBackDay(11, 25), amount: 12000 }],
      tags: ['設計', '月刊'] });

  // ===== 9-11 個月前 =====
  J({ clientId: c1, date: monthBackDay(10, 5), title: '年度品牌指南更新', amount: 35000, hoursWorked: 30,
      done: true, paid: true, doneAt: monthBackDay(10, 25), paidAt: monthBackDay(9, 25),
      payments: [{ id: uid(), date: monthBackDay(9, 25), amount: 35000 }],
      tags: ['設計', '品牌', '大案'] });
  J({ clientId: c6, date: monthBackDay(10, 8), title: '政府宣導海報設計 5 款', amount: 75000, quantity: 5, hoursWorked: 40,
      done: true, paid: true, doneAt: monthBackDay(10, 28), paidAt: monthBackDay(8, 15),
      payments: [{ id: uid(), date: monthBackDay(8, 15), amount: 75000, note: '公文後付款' }],
      tags: ['設計', '政府', '大案'] });
  J({ clientId: c3, date: monthBackDay(9, 20), title: '同行 overflow：產品圖修圖', amount: 3500, quantity: 14, hoursWorked: 5,
      done: true, paid: true, doneAt: monthBackDay(9, 25), paidAt: monthBackDay(8, 10),
      payments: [{ id: uid(), date: monthBackDay(8, 10), amount: 3500 }],
      tags: ['修圖', '外包'] });
  J({ clientId: c4, date: monthBackDay(9, 10), title: '月刊封面', amount: 12000,
      done: true, paid: true, doneAt: monthBackDay(9, 25), paidAt: monthBackDay(8, 25),
      payments: [{ id: uid(), date: monthBackDay(8, 25), amount: 12000 }],
      tags: ['設計', '月刊'] });

  // ===== 6-8 個月前 =====
  J({ clientId: c2, date: monthBackDay(7, 5), title: '春季新品攝影後製 30 張', amount: 9000, quantity: 30, hoursWorked: 12,
      done: true, paid: true, doneAt: monthBackDay(7, 18), paidAt: monthBackDay(6, 15),
      payments: [{ id: uid(), date: monthBackDay(6, 15), amount: 9000 }],
      tags: ['攝影', '電商'] });
  J({ clientId: c5, date: monthBackDay(6, 3), title: '個人 logo 設計', details: '3 稿 + 確認後 2 稿修改', amount: 8000, hoursWorked: 10,
      done: true, paid: true, doneAt: monthBackDay(6, 18), paidAt: monthBackDay(6, 20),
      payments: [{ id: uid(), date: monthBackDay(6, 20), amount: 8000 }],
      tags: ['設計', 'logo'] });

  // ===== 4-5 個月前 =====
  J({ clientId: c1, date: monthBackDay(5, 8), title: '官網首頁改版', amount: 18000, hoursWorked: 16,
      done: true, paid: true, doneAt: monthBackDay(5, 22), paidAt: monthBackDay(4, 25),
      payments: [{ id: uid(), date: monthBackDay(4, 25), amount: 18000 }],
      tags: ['設計', '網站'] });
  J({ clientId: c6, date: monthBackDay(5, 12), title: '政府年報設計 + 印製協調', amount: 120000, hoursWorked: 60,
      done: true, paid: true, doneAt: monthBackDay(4, 5), paidAt: monthBackDay(2, 10),
      payments: [{ id: uid(), date: monthBackDay(2, 10), amount: 120000, note: '預算季結算' }],
      tags: ['設計', '政府', '大案'] });
  J({ clientId: c4, date: monthBackDay(4, 10), title: '月刊封面', amount: 12000,
      done: true, paid: true, doneAt: monthBackDay(4, 25), paidAt: monthBackDay(3, 25),
      payments: [{ id: uid(), date: monthBackDay(3, 25), amount: 12000 }],
      tags: ['設計', '月刊'] });

  // ===== 2-3 個月前 =====
  J({ clientId: c2, date: monthBackDay(3, 6), title: '618 廣告素材包', details: '主視覺 + 5 個社群圖', amount: 22000, quantity: 6, hoursWorked: 18,
      done: true, paid: true, doneAt: monthBackDay(3, 18), paidAt: monthBackDay(2, 5),
      payments: [{ id: uid(), date: monthBackDay(2, 5), amount: 22000 }],
      tags: ['廣告', '電商'] });
  J({ clientId: c1, date: monthBackDay(2, 12), title: '形象動畫 30 秒', details: 'After Effects 動態圖形', amount: 25000, hoursWorked: 22,
      done: true, paid: true, doneAt: monthBackDay(2, 28), paidAt: monthBackDay(1, 25),
      payments: [{ id: uid(), date: monthBackDay(1, 25), amount: 25000 }],
      tags: ['動畫'] });
  J({ clientId: c4, date: monthBackDay(2, 10), title: '月刊封面 + 內頁編排', amount: 14000,
      done: true, paid: true, doneAt: monthBackDay(2, 25), paidAt: monthBackDay(1, 25),
      payments: [{ id: uid(), date: monthBackDay(1, 25), amount: 14000 }],
      tags: ['設計', '月刊'] });

  // ===== 上個月 =====
  J({ clientId: c2, date: monthBackDay(1, 5), title: '夏季 EDM 4 款', amount: 8000, quantity: 4,
      done: true, paid: true, doneAt: monthBackDay(1, 12), paidAt: dayBack(20),
      payments: [{ id: uid(), date: dayBack(20), amount: 8000 }],
      tags: ['設計', 'EDM'] });
  J({ clientId: c1, date: monthBackDay(1, 18), title: '官方 LINE 表情貼設計', amount: 16000, quantity: 8, hoursWorked: 14,
      done: true, paid: true, doneAt: monthBackDay(1, 28), paidAt: dayBack(15),
      payments: [{ id: uid(), date: dayBack(15), amount: 16000 }],
      tags: ['插畫', 'LINE'] });
  J({ clientId: c4, date: monthBackDay(1, 10), title: '月刊封面', amount: 12000,
      done: true, paid: false, doneAt: monthBackDay(1, 25), paidAt: null,  // 上月已完成、本月待收
      payments: [],
      tags: ['設計', '月刊'] });
  J({ clientId: c6, date: monthBackDay(1, 8), title: '政府年度報告設計', details: '60 頁圖文編排', amount: 85000, hoursWorked: 50,
      done: true, paid: false, doneAt: dayBack(28), paidAt: null,  // 完成已久未收（典型政府拖款）
      payments: [],
      tags: ['設計', '政府', '大案'] });

  // ===== 本月（多筆混合狀態）=====
  const m = thisMonth();
  J({ clientId: c1, date: m+'-03', title: 'FB 廣告 banner 5 張', details: '1080x1080，含兩次修改', amount: 4500, quantity: 5,
      done: true, paid: true, doneAt: m+'-05', paidAt: m+'-10',
      payments: [{ id: uid(), date: m+'-10', amount: 4500, note: '本月已收' }],
      tags: ['廣告'] });
  J({ clientId: c2, date: m+'-08', title: '產品攝影後製 15 張', details: '商品白底 + 情境 5 張', amount: 4500, quantity: 15, hoursWorked: 6,
      done: true, paid: true, doneAt: dayBack(5), paidAt: dayBack(2),
      payments: [{ id: uid(), date: dayBack(2), amount: 4500 }],
      tags: ['攝影', '電商'] });
  J({ clientId: c1, date: m+'-12', title: '官網首頁第二輪改版', details: '首頁 + 3 內頁', amount: 18000, hoursWorked: 14,
      done: true, paid: false, doneAt: dayBack(10), paidAt: null,
      payments: [],
      tags: ['設計', '網站'] });
  J({ clientId: c2, date: m+'-15', title: '雙12 主視覺 + 5 廣告', details: '預付一半', amount: 30000, hoursWorked: 20,
      done: true, paid: false, doneAt: dayBack(3), paidAt: null,
      // 部分收款示範：總價 30000、已收 15000
      payments: [{ id: uid(), date: dayBack(15), amount: 15000, note: '訂金 50%' }],
      tags: ['設計', '電商', '大案'] });
  J({ clientId: c5, date: m+'-18', title: '個人名片 + 信封設計', amount: 4000, hoursWorked: 5,
      done: true, paid: false, doneAt: dayBack(2), paidAt: null,
      payments: [],
      tags: ['設計'] });
  J({ clientId: c4, date: m+'-20', title: '月刊封面', amount: 12000,
      done: false, paid: false,  // 進行中
      payments: [],
      tags: ['設計', '月刊'] });
  J({ clientId: c3, date: dayBack(3), title: '同行外包：banner 改稿', amount: 1500, hoursWorked: 1.5,
      done: false, paid: false,
      payments: [],
      tags: ['外包'] });
  J({ clientId: c6, date: dayBack(7), title: '政府活動 KV', details: '公文跑流程中', amount: 45000, hoursWorked: 25,
      done: false, paid: false,  // 逾期未完成（提醒）
      payments: [],
      tags: ['設計', '政府'] });
  // 折扣示範
  J({ clientId: c1, date: dayBack(2), title: 'FB 即時廣告（折扣價）', amount: 6000, hoursWorked: 4,
      discountType: 'percent', discountValue: 15,  // 折扣 15%
      done: true, paid: false, doneAt: dayBack(1), paidAt: null,
      payments: [],
      tags: ['廣告', 'VIP折扣'] });
  // 已取消
  J({ clientId: c2, date: dayBack(20), title: '六月廣告（已撤案）', amount: 5000,
      cancelled: true,
      payments: [],
      tags: ['取消'] });
  // 跨天案件（v3.19 拖曳示範）
  J({ clientId: c4, date: m+'-22', endDate: m+'-26', title: '季刊跨頁專題排版', details: '5 天工期', amount: 18000, hoursWorked: 24,
      done: false, paid: false,
      payments: [],
      tags: ['設計', '月刊'] });

  // ===== 未來案件 =====
  J({ clientId: c2, date: dayFwd(3), title: 'EDM 春季促銷', amount: 3000,
      done: false, paid: false,
      payments: [],
      tags: ['設計', 'EDM'] });
  J({ clientId: c3, date: dayFwd(7), title: 'Logo 優化（介紹案）', amount: 8000, hoursWorked: 0,
      done: false, paid: false,
      payments: [],
      tags: ['設計', 'logo'] });
  J({ clientId: c1, date: dayFwd(14), title: '年中檢討 + 下半年規劃會議', amount: 0, hoursWorked: 3,
      done: false, paid: false,
      payments: [],
      tags: ['顧問', '會議'] });
  J({ clientId: c5, date: dayFwd(21), title: '名片改版（追加）', amount: 2500,
      done: false, paid: false,
      payments: [],
      tags: ['設計'] });
  // 估價單示範
  J({ clientId: c2, date: dayFwd(30), title: '【估價中】Q4 廣告整體規劃', details: '主視覺 + 10 套素材', amount: 60000, quantity: 10,
      isEstimate: true,  // 估價單模式
      payments: [],
      tags: ['估價', '電商'] });

  logAction('data-load-demo', { clients: state.clients.length, jobs: state.jobs.length });
  save(); renderAll(); toast(`✓ 已載入範例：${state.clients.length} 業主 · ${state.jobs.length} 案件 · 跨 14 個月`, 4500);
}

// v3.24.19：clearAll 加 skipPrompt 參數 — 從「⚠️ 危險區」card 內 inline 確認後呼叫，跳過原本的 prompt
function clearAll(skipPrompt) {
  const cnt = state.jobs.length;
  if (cnt === 0 && state.clients.length === 0) {
    toast('資料已經是空的');
    return;
  }
  if (!skipPrompt) {
    // 舊路徑（保留以防其他地方呼叫）：confirm + prompt 二段確認
    if (!confirm(`⚠️ 即將清空所有資料！\n\n業主：${state.clients.length} 位\n案件：${cnt} 筆\n\n操作不可復原。確定？`)) return;
    const verify = prompt('最後確認：請輸入「確認清空」四個字才會執行（避免誤觸）');
    if (verify !== '確認清空') {
      toast('已取消（輸入文字不符）');
      return;
    }
  }
  const beforeC = state.clients.length;
  const beforeJ = state.jobs.length;
  state.clients = []; state.jobs = [];
  logAction('data-clear', { clearedClients: beforeC, clearedJobs: beforeJ });
  save(); renderAll(); toast('已清空全部資料');
}

// v3.24.19：危險區「清空所有資料」確認 input 監聽 — 比對輸入完全等於「確定清空所有資料」才解鎖按鈕
function onDangerClearConfirmInput() {
  const input = document.getElementById('danger-clear-confirm');
  const btn = document.getElementById('danger-clear-btn');
  if (!input || !btn) return;
  btn.disabled = input.value.trim() !== '確定清空所有資料';
}

// v3.24.19：使用者輸入確認文字後按下「清空所有資料」按鈕
function onDangerClearConfirm() {
  const input = document.getElementById('danger-clear-confirm');
  if (!input || input.value.trim() !== '確定清空所有資料') return;  // 雙保險：理論上 button 沒解鎖不會走到這
  // 已通過 inline 確認，跳過 clearAll 內的 prompt
  clearAll(true);
  // 清空 input + 重 disable 按鈕
  input.value = '';
  const btn = document.getElementById('danger-clear-btn');
  if (btn) btn.disabled = true;
}

// ============== 事件監聽 ==============
document.getElementById('inv-client').addEventListener('change', drawInvoice);
document.getElementById('inv-month').addEventListener('change', drawInvoice);
document.getElementById('inv-month-end')?.addEventListener('change', drawInvoice);
// 案件金額變動時更新儲值提示
document.getElementById('job-amount')?.addEventListener('input', onJobClientChange);

// v3.3.0：v2 Apps Script stubs 整批刪除（HTML onclick caller 已隨 #card-cloud / #card-portable 一起刪）
// 留切換摺疊卡片的 toggleCard 即可（仍有 caller：#card-calendar / #card-theme / #card-search 等）
function toggleCard(cardId) {
  const card = document.getElementById(cardId);
  if (card) card.classList.toggle('collapsed');
}

// ============== 暗色模式 ==============
const THEME_KEY = 'cloud-ftTheme_v1';  // v3.0.0-alpha.1：cloud- 前綴隔離 v2

function applyTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  let theme = saved;
  if (!saved || saved === 'auto') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
  // 更新 theme-color meta（手機網址列顏色跟著變）
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0f1115' : '#3b82f6');
}

function setTheme(mode) {
  // 'auto' / 'light' / 'dark'
  localStorage.setItem(THEME_KEY, mode);
  applyTheme();
  loadThemeUI();
  updateThemeToggleIcon();
  toast(`✓ 主題：${ {auto: '自動（跟隨系統）', light: '淺色', dark: '深色'}[mode] }`);
}

// v2.7.4: 標題列圖示按一下循環切換 auto → light → dark
function cycleTheme() {
  const cur = localStorage.getItem(THEME_KEY) || 'auto';
  const next = cur === 'auto' ? 'light' : cur === 'light' ? 'dark' : 'auto';
  setTheme(next);
}

function updateThemeToggleIcon() {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;
  const cur = localStorage.getItem(THEME_KEY) || 'auto';
  // v3.4.0：top bar 精簡，按鈕只顯示「主題」+ icon 提示目前狀態
  const icon = cur === 'auto' ? '🪄' : (cur === 'dark' ? '🌙' : '☀️');
  const label = cur === 'auto' ? '系統' : (cur === 'dark' ? '深色' : '淺色');
  btn.textContent = `${icon} 主題`;
  btn.title = `目前主題：${label}（點擊循環切換 系統 → 淺色 → 深色）`;
}

function loadThemeUI() {
  const cur = localStorage.getItem(THEME_KEY) || 'auto';
  document.querySelectorAll('[name="theme-mode"]').forEach(r => {
    r.checked = (r.value === cur);
  });
}

// 啟動時立刻套用（避免閃白）
applyTheme();
// 系統色模式變更時即時切換（auto 模式才有效）+ 同步圖示
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if ((localStorage.getItem(THEME_KEY) || 'auto') === 'auto') {
      applyTheme();
      updateThemeToggleIcon();
    }
  });
}

// ============== 全域搜尋 ==============
// v3.6.0：Dashboard stat 卡點擊 → 跳案件 tab + 套對應 filter
function dashStatJump(kind) {
  const y = String(new Date().getFullYear());
  if (kind === 'paid') {
    state.filters.month = 'current';
    state.filters.status = 'paid';
  } else if (kind === 'unpaid') {
    state.filters.month = 'current';
    state.filters.status = 'done-unpaid';  // 完成待收款（包含部分收款請另外切換）
  } else if (kind === 'pending') {
    state.filters.month = 'current';
    state.filters.status = 'pending';
  } else if (kind === 'year') {
    // 年度已收款 → 自訂範圍：今年 1-12 月
    state.filters.month = 'custom-range';
    state.filters.monthFrom = `${y}-01`;
    state.filters.monthTo = `${y}-12`;
    state.filters.status = 'paid';
  }
  state.filters.clientId = 'all';
  state.filters.tag = 'all';
  state.filters.jobIdsOnly = null;
  state.filters.jobIdsOnlyLabel = '';
  switchTab('jobs');
}

// v3.6.0：全域搜尋列改 collapsible（top bar 🔍 按鈕 toggle、Esc 關閉）
function toggleGlobalSearch(forceState) {
  const bar = document.getElementById('global-search-bar');
  const input = document.getElementById('global-search');
  const results = document.getElementById('global-search-results');
  if (!bar) return;
  const willOpen = (typeof forceState === 'boolean') ? forceState : bar.classList.contains('hidden');
  if (willOpen) {
    bar.classList.remove('hidden');
    setTimeout(() => input?.focus(), 30);  // wait for layout
    // v3.23.3：mascot 搜尋中
    if (typeof mascotSay === 'function') mascotSay('search-open');
  } else {
    bar.classList.add('hidden');
    if (input) input.value = '';
    if (results) results.classList.add('hidden');
    // v3.23.3：搜尋關閉 → 回 idle
    if (typeof mascotSetState === 'function' && mascotState && mascotState.current === 'searching') {
      mascotSetState('idle');
    }
  }
}

function onGlobalSearch() {
  const q = (document.getElementById('global-search')?.value || '').trim().toLowerCase();
  const box = document.getElementById('global-search-results');
  if (!box) return;
  if (!q) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }
  // 業主比對
  const matchClient = (c) => {
    return (c.name || '').toLowerCase().includes(q) ||
           (c.note || '').toLowerCase().includes(q);
  };
  // 案件比對
  const matchJob = (j) => {
    return (j.title || '').toLowerCase().includes(q) ||
           (j.details || '').toLowerCase().includes(q) ||
           (j.tag || '').toLowerCase().includes(q);
  };
  const clients = state.clients.filter(matchClient).slice(0, 10);
  const jobs = state.jobs.filter(matchJob).slice(0, 30);
  let html = '';
  if (clients.length) {
    html += `<div class="gs-section">業主（${clients.length}）</div>`;
    html += clients.map(c => `
      <div class="gs-row" onclick="globalSearchClickClient('${c.id}')">
        <div class="gs-title">${highlightMatch(c.name, q)}</div>
        ${c.note ? `<div class="gs-meta">${highlightMatch((c.note || '').slice(0, 60), q)}</div>` : ''}
      </div>
    `).join('');
  }
  if (jobs.length) {
    html += `<div class="gs-section">案件（${jobs.length}）</div>`;
    html += jobs.map(j => {
      const c = getClient(j.clientId);
      return `
        <div class="gs-row" onclick="globalSearchClickJob('${j.id}')">
          <div class="gs-title">${highlightMatch(j.title || '(無標題)', q)} <span style="color:var(--muted); font-weight:400;">${j.amount ? fmt(j.amount) : ''}</span></div>
          <div class="gs-meta">${escapeHtml(c?.name || '?')} · ${j.date || '無日期'}${j.tag ? ' · ' + highlightMatch(j.tag, q) : ''}</div>
        </div>
      `;
    }).join('');
  }
  if (!clients.length && !jobs.length) {
    html = '<div class="gs-empty">沒有找到符合「' + escapeHtml(q) + '」的結果</div>';
  }
  box.innerHTML = html;
  box.classList.remove('hidden');
}

function highlightMatch(text, q) {
  if (!text) return '';
  const escaped = escapeHtml(text);
  if (!q) return escaped;
  const reg = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
  return escaped.replace(reg, m => `<mark>${m}</mark>`);
}

function globalSearchClickClient(cid) {
  closeGlobalSearch();
  switchTab('clients');
  // 滾到該業主
  setTimeout(() => {
    const el = document.querySelector(`[data-client-card="${cid}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

function globalSearchClickJob(jid) {
  closeGlobalSearch();
  switchTab('jobs');
  setTimeout(() => editJob(jid), 100);
}

function closeGlobalSearch() {
  const box = document.getElementById('global-search-results');
  if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
  const input = document.getElementById('global-search');
  if (input) input.value = '';
}

// 點擊外部關閉搜尋下拉
document.addEventListener('click', (e) => {
  const bar = document.querySelector('.global-search-bar');
  if (bar && !bar.contains(e.target)) {
    document.getElementById('global-search-results')?.classList.add('hidden');
  }
});

// v3.3.1：v2 Lab / 開發模式（isLabMode / toggleLabMode / showLabModeBanner / updateLabModeUI + LAB_MODE_KEY）已物理移除

// ============== 過時客戶端橫幅（schema/version 不匹配時）==============
// v3.0.0：showStaleClientBanner（v2 sheet schema 衝突警告橫幅）已移除

// 裝置標籤：每台 PC 自己存在 localStorage（不上雲）
// 注意：瀏覽器沙盒禁止讀取 OS 的電腦名稱（如 Windows 的 hostname），
// 所以採用「OS 偵測 + 自動產生唯一識別碼」的折衷方案。
// 使用者可在設定頁改成有意義的名字（例如「工作室 Win」）。
const DEVICE_NAME_KEY = 'cloud-ftDeviceName_v1';   // v3.0.0-alpha.1：cloud- 前綴隔離 v2
const DEVICE_AUTO_KEY = 'cloud-ftDeviceAutoId_v1'; // v3.0.0-alpha.1：cloud- 前綴隔離 v2

function getOsLabel() {
  const ua = navigator.userAgent;
  if (/Mobi|Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad/i.test(ua)) return 'iOS';
  if (/Mac/i.test(ua)) return 'Mac';
  if (/Win/i.test(ua)) return 'Windows';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Unknown';
}

function getOrGenerateAutoId() {
  let auto = localStorage.getItem(DEVICE_AUTO_KEY);
  if (!auto) {
    // 短碼：4 個英數字，每台 PC 唯一
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    auto = `${getOsLabel()}-${rand}`;
    localStorage.setItem(DEVICE_AUTO_KEY, auto);
  }
  return auto;
}

function getDeviceLabel() {
  // 1. 使用者自訂的名字優先
  const custom = localStorage.getItem(DEVICE_NAME_KEY);
  if (custom && custom.trim()) return custom.trim();
  // 2. 否則用自動產生的 OS-XXXX
  return getOrGenerateAutoId();
}

// v3.3.1：v2 裝置名稱輸入 UI（setDeviceName / loadDeviceNameUI）已物理移除（含 noop stub）

// ============== IP + 地理位置（24 小時快取）==============
const DEVICE_LOCATION_KEY = 'cloud-ftDeviceLocation_v1';  // v3.0.0-alpha.1：cloud- 前綴隔離 v2
let cachedDeviceLocation = null;

async function fetchDeviceLocation() {
  // 24 小時快取
  try {
    const cached = localStorage.getItem(DEVICE_LOCATION_KEY);
    if (cached) {
      const obj = JSON.parse(cached);
      if (Date.now() - obj.fetchedAt < 24 * 60 * 60 * 1000) {
        cachedDeviceLocation = obj;
        return obj;
      }
    }
  } catch (_) {}
  // 呼叫 ipapi.co（HTTPS 免金鑰）
  try {
    const resp = await fetch('https://ipapi.co/json/');
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.ip) return null;
    const loc = {
      ip: data.ip,
      city: data.city || '',
      region: data.region || '',
      country: data.country_name || '',
      isp: (data.org || '').slice(0, 40),
      fetchedAt: Date.now()
    };
    localStorage.setItem(DEVICE_LOCATION_KEY, JSON.stringify(loc));
    cachedDeviceLocation = loc;
    return loc;
  } catch (err) {
    return null;  // 抓不到就算了，不擋主流程
  }
}

// v3.0.0：getDeviceLabelForUpload（v2 上傳時帶地理位置）已移除；v3 用 getDeviceLabel 即可

// v3.3.1：v2 GPS 精確位置（requestPreciseLocation / clearPreciseLocation）已物理移除

// v3.3.1：v2 device-name-prompt-modal 三函式（maybeShowDeviceNamePrompt / saveDeviceNameFromPrompt / skipDeviceNamePrompt）已物理移除

// v3.3.1：v2 Apps Script 同步開關 stub（enableSheetSync / disableSheetSync）已物理移除

// v3.0.0：updateSheetSyncBadge（更新 #sheet-sync-status 文字）已移除；對應 hidden 卡片不再顯示

// v3.0.0：showSnapshotList（v2 sheet snapshot 列表）已移除；v3 用 cloudListSnapshots（在 ☁️ Drive Sync Layer）

// 預覽特定 snapshot 內容
// ============== 操作日誌 UI（v2.9.5）==============
function openActionLogModal() {
  // 填類型 select
  const typeSel = document.getElementById('log-filter-type');
  if (typeSel) {
    const usedTypes = [...new Set(actionLog.map(l => l.type))].sort();
    typeSel.innerHTML = '<option value="all">全部類型</option>' +
      usedTypes.map(t => `<option value="${t}">${(ACTION_LABELS[t]?.icon || '')} ${ACTION_LABELS[t]?.label || t}</option>`).join('');
  }
  // 填業主 select（只列 log 中出現過的）
  const clientSel = document.getElementById('log-filter-client');
  if (clientSel) {
    const usedClientIds = new Set();
    actionLog.forEach(l => { if (l.details?.clientId) usedClientIds.add(l.details.clientId); });
    const opts = ['<option value="all">全部業主</option>'];
    state.clients.forEach(c => {
      if (usedClientIds.has(c.id)) opts.push(`<option value="${c.id}">${escapeHtml(c.name)}</option>`);
    });
    clientSel.innerHTML = opts.join('');
  }
  document.getElementById('action-log-count').textContent = actionLog.length;
  renderActionLog();
  document.getElementById('action-log-modal').classList.add('open');
}

function clearActionLog() {
  if (!confirm('確定清空所有操作日誌？（無法復原，但不影響業主/案件資料）')) return;
  actionLog = [];
  saveActionLog();
  renderActionLog();
  toast('已清空操作日誌');
}

function fmtLogTime(ts) {
  const d = new Date(ts);
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
}
function fmtLogDateLabel(ts) {
  const d = new Date(ts);
  const today = new Date(); today.setHours(0,0,0,0);
  const that = new Date(d); that.setHours(0,0,0,0);
  const diffDays = Math.round((today - that) / 86400000);
  if (diffDays === 0) return '📅 今天';
  if (diffDays === 1) return '📅 昨天';
  return `📅 ${d.getMonth()+1}/${d.getDate()}`;
}

function renderActionLog() {
  const box = document.getElementById('action-log-list');
  if (!box) return;
  const ft = document.getElementById('log-filter-type')?.value || 'all';
  const fc = document.getElementById('log-filter-client')?.value || 'all';
  const fd = document.getElementById('log-filter-date')?.value || 'all';

  const now = Date.now();
  let cutoff = 0;
  if (fd === 'today') {
    const t = new Date(); t.setHours(0,0,0,0);
    cutoff = t.getTime();
  } else if (fd === 'yesterday') {
    const t = new Date(); t.setDate(t.getDate() - 1); t.setHours(0,0,0,0);
    const e = new Date(t); e.setHours(23,59,59,999);
    cutoff = t.getTime();
    // 篩選時也要排除今天的（特殊處理在 filter）
  } else if (fd === 'week') {
    cutoff = now - 7 * 86400000;
  } else if (fd === 'month') {
    cutoff = now - 30 * 86400000;
  }

  let list = [...actionLog].reverse();  // 最新在前
  if (ft !== 'all') list = list.filter(l => l.type === ft);
  if (fc !== 'all') list = list.filter(l => l.details?.clientId === fc);
  if (fd === 'today') list = list.filter(l => l.ts >= cutoff);
  else if (fd === 'yesterday') {
    const yStart = new Date(); yStart.setDate(yStart.getDate() - 1); yStart.setHours(0,0,0,0);
    const yEnd = new Date(yStart); yEnd.setHours(23,59,59,999);
    list = list.filter(l => l.ts >= yStart.getTime() && l.ts <= yEnd.getTime());
  }
  else if (fd === 'week' || fd === 'month') list = list.filter(l => l.ts >= cutoff);

  if (!list.length) {
    box.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--muted); font-size: 13px;">沒有符合條件的操作紀錄</div>';
    return;
  }

  // 依日期分組
  const groups = {};
  list.forEach(l => {
    const key = fmtLogDateLabel(l.ts);
    if (!groups[key]) groups[key] = [];
    groups[key].push(l);
  });

  box.innerHTML = Object.entries(groups).map(([dateLabel, items]) => {
    const rows = items.map(l => {
      const meta = ACTION_LABELS[l.type] || { icon: '·', label: l.type };
      const d = l.details || {};
      let primary = '';
      let secondary = '';
      let onClick = '';
      // 文字內容
      if (l.type.startsWith('job-')) {
        primary = `「${escapeHtml(d.title || '(無標題)')}」`;
        if (d.amount != null) primary += ` ${fmt(d.amount)}`;
        secondary = d.clientName ? `(${escapeHtml(d.clientName)})` : '';
        if (d.jobId && state.jobs.find(j => j.id === d.jobId)) onClick = `editJob('${d.jobId}'); document.getElementById('action-log-modal').classList.remove('open');`;
      } else if (l.type.startsWith('client-')) {
        primary = `「${escapeHtml(d.name || '?')}」`;
        if (d.clientId && state.clients.find(c => c.id === d.clientId)) onClick = `editClient('${d.clientId}'); document.getElementById('action-log-modal').classList.remove('open');`;
      } else if (l.type.startsWith('bulk-')) {
        primary = `${d.count || 0} 筆`;
        if (d.amount != null) primary += ` (${fmt(d.amount)})`;
      } else if (l.type === 'sync-pull' || l.type === 'sync-push') {
        primary = d.summary ? escapeHtml(d.summary) : '';
      } else if (l.type === 'snapshot-restore') {
        primary = d.snapshotId ? `ID ${d.snapshotId}` : '';
      } else if (l.type === 'data-import') {
        primary = d.summary || '';
      }
      const arrow = onClick ? `<button class="btn btn-ghost btn-sm" onclick="${onClick}" style="padding: 0 8px; color: var(--primary);">→</button>` : '';
      return `<div style="display: flex; gap: 6px; align-items: center; padding: 5px 0; border-bottom: 1px dashed var(--border);">
        <span style="color: var(--muted); min-width: 42px; font-family: monospace; font-size: 12px;">${fmtLogTime(l.ts)}</span>
        <span style="min-width: 18px; text-align: center;">${meta.icon}</span>
        <span style="flex: 1; min-width: 0;">${escapeHtml(meta.label)} ${primary} <span style="color: var(--muted); font-size: 12px;">${secondary}</span></span>
        ${arrow}
      </div>`;
    }).join('');
    return `<div style="margin-bottom: 10px;">
      <div style="font-size: 12px; color: var(--muted); padding: 4px 0; border-bottom: 1px solid var(--border); font-weight: 600;">${dateLabel} (${items.length})</div>
      ${rows}
    </div>`;
  }).join('');
}

// ============== Snapshot Diff（v2.9.5）==============
const SNAPSHOT_FIELD_LABELS = {
  // 業主
  name: '名稱', color: '顏色', note: '備註',
  commissionRate: '抽成%', commissionTo: '介紹人',
  prepaidMode: '儲值制', prepayments: '儲值紀錄',
  billingDay: '請款日', billingRemindDays: '請款日提前提醒',
  unpaidRemindDaysOverride: '未收款提醒天數',
  // 案件
  title: '標題', clientId: '業主', date: '日期', endDate: '截止日',
  details: '說明', amount: '金額', tag: '類型',
  done: '完成', doneAt: '完成日', paid: '已收款', paidAt: '收款日',
  cancelled: '已取消', isEstimate: '估價單',
  hoursWorked: '工時', timeSpentMs: '計時器累計',
  discountType: '折扣類型', discountValue: '折扣值',
  payments: '收款紀錄', writeOff: '呆帳',
  subtasks: '子任務'
};

const CLIENT_FIELDS = ['name','color','note','commissionRate','commissionTo','prepaidMode','prepayments','billingDay','billingRemindDays','unpaidRemindDaysOverride'];
const JOB_FIELDS    = ['title','clientId','date','endDate','details','amount','tag','done','doneAt','paid','paidAt','cancelled','isEstimate','hoursWorked','timeSpentMs','discountType','discountValue','payments','writeOff','subtasks'];

// v3.3.1：v2 sheet snapshot diff modal（formatDiffValue_ / renderFieldDiffHtml / previewSnapshot / showSnapshotDiffModal）整段已物理移除
// v3 用 cloudShowRestorePreviewModal（在 ☁️ Drive Sync Layer）取代

// ============== 網頁版本偵測 ==============
// APP_VERSION 已在檔案頂端宣告（v2.2 新增）；此處不再重複宣告
const APP_VERSION_KEY = 'cloud-freelance-tracker-app-version';  // v3.0.0-alpha.1：cloud- 前綴隔離 v2
let serverAppVersion = null;  // 由 pollAppVersion 更新，給 UI 顯示用

// v2.7.5+: 終極強制刷新 — 清掉所有可能讓網頁卡舊版的東西
// （但保留 localStorage 業主案件設定）
// v2.10.10: 加保險超時（清快取卡住也會 reload）+ skipWaiting message + 最後 fallback 用 reload(true)
async function hardReload() {
  toastProgress('🔄 清除快取中…');
  console.log('[hardReload] start');

  // 全程最多 4 秒，超時就直接強制 reload，避免任何 await 卡死害用戶以為「沒反應」
  const SAFETY_MS = 4000;
  let done = false;
  const safetyTimer = setTimeout(() => {
    if (done) return;
    console.warn('[hardReload] safety timeout — forcing reload');
    forceReload();
  }, SAFETY_MS);

  function forceReload() {
    done = true;
    clearTimeout(safetyTimer);
    // 用 query string 破 HTTP / SW cache，replace 避免 history 殘留
    const url = location.pathname + '?_=' + Date.now() + '&hr=1';
    try {
      location.replace(url);
    } catch (_) {
      // 最後 fallback：reload(true)（有些瀏覽器仍支援 forced reload）
      try { location.reload(true); } catch (_) { location.href = url; }
    }
  }

  // 1. 叫所有 SW skipWaiting + unregister（不 await 太久，超時就放）
  try {
    if ('serviceWorker' in navigator) {
      const regs = await Promise.race([
        navigator.serviceWorker.getRegistrations(),
        new Promise(r => setTimeout(() => r([]), 1500))
      ]);
      regs.forEach(r => {
        try { r.waiting?.postMessage({ type: 'SKIP_WAITING' }); } catch (_) {}
      });
      await Promise.race([
        Promise.all(regs.map(r => r.unregister())),
        new Promise(r => setTimeout(r, 1500))
      ]);
    }
  } catch (err) { console.error('[hardReload] SW step failed:', err); }

  // 2. 刪除所有 Cache API 快取
  try {
    if ('caches' in window) {
      const keys = await Promise.race([
        caches.keys(),
        new Promise(r => setTimeout(() => r([]), 1000))
      ]);
      await Promise.race([
        Promise.all(keys.map(k => caches.delete(k))),
        new Promise(r => setTimeout(r, 1000))
      ]);
    }
  } catch (err) { console.error('[hardReload] cache delete failed:', err); }

  // 3. 清空 sessionStorage（不動 localStorage）
  try { sessionStorage.clear(); } catch (_) {}

  // 4. 清掉 cookies（這個網域下的）
  try {
    document.cookie.split(';').forEach(c => {
      const eq = c.indexOf('=');
      const name = (eq > -1 ? c.slice(0, eq) : c).trim();
      if (!name) return;
      const expire = 'expires=Thu, 01 Jan 1970 00:00:00 GMT';
      document.cookie = `${name}=; ${expire}; path=/`;
      document.cookie = `${name}=; ${expire}; path=${location.pathname}`;
      document.cookie = `${name}=; ${expire}; path=/; domain=${location.hostname}`;
      document.cookie = `${name}=; ${expire}; path=/; domain=.${location.hostname}`;
    });
  } catch (_) {}

  // 5. 嘗試清掉 IndexedDB（部分瀏覽器支援，不卡 reload）
  try {
    if (indexedDB && indexedDB.databases) {
      await Promise.race([
        indexedDB.databases().then(dbs => Promise.all(dbs.map(db => new Promise(resolve => {
          const req = indexedDB.deleteDatabase(db.name);
          req.onsuccess = req.onerror = req.onblocked = resolve;
        })))),
        new Promise(r => setTimeout(r, 1000))
      ]);
    }
  } catch (_) {}

  console.log('[hardReload] cleanup done — reloading');
  forceReload();
}

// 更新 header 的版本標籤
function updateVersionBadge() {
  const el = document.getElementById('app-version-badge');
  if (!el) return;
  const local = APP_VERSION.replace(/^\d{4}-\d{2}-\d{2}-/, '');
  // v2.10.1: 改用 compareAppVersion 做數字版號比較
  if (serverAppVersion && compareAppVersion(serverAppVersion, APP_VERSION) > 0) {
    const remote = serverAppVersion.replace(/^\d{4}-\d{2}-\d{2}-/, '');
    el.innerHTML = `${local} · <span style="color: var(--warning); font-weight: 600;">🆕 ${remote} 點此更新</span>`;
    el.style.cursor = 'pointer';
  } else {
    el.innerHTML = `${local} · <span style="color: var(--muted);">最新</span>`;
    el.style.cursor = 'pointer';
    el.title = '點擊強制刷新（清除快取）';
  }
}

function checkAppVersionUpdate() {
  // 啟動時：如果 localStorage 有舊版本記錄且不同 → 提示
  const lastSeen = localStorage.getItem(APP_VERSION_KEY);
  if (lastSeen && lastSeen !== APP_VERSION) {
    setTimeout(() => {
      toast(`✨ APP 已更新到 ${APP_VERSION}`, 4000);
    }, 1000);
  }
  localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
}

// 每 5 分鐘 fetch 一次自己的 HTML 比對版本
async function pollAppVersion() {
  try {
    // v3.24.15：加 cache buster query param 繞過 service worker 快取
    // 否則 SW 攔截後直接回 cache，永遠看不到新版（v3.24.14 強制備份 modal 也跟著失效）
    const pollUrl = location.origin + location.pathname + '?_pollver=' + Date.now();
    const resp = await fetch(pollUrl, { cache: 'no-store' });
    const html = await resp.text();
    const match = html.match(/<meta name="app-version" content="([^"]+)"/);
    if (!match) return;
    serverAppVersion = match[1];
    updateVersionBadge();
    // v2.10.1: 改用 compareAppVersion 做數字版號比較（修 v2.9 vs v2.10 字串 bug）
    if (compareAppVersion(serverAppVersion, APP_VERSION) > 0) {
      const remind = document.getElementById('version-remind');
      if (!remind) {
        const div = document.createElement('div');
        div.id = 'version-remind';
        div.className = 'version-remind';
        // v3.24.14：點橫幅不再直接 hardReload，改開「強制備份才能更新」modal
        div.innerHTML = `🆕 APP 有新版本（${serverAppVersion}），<a onclick="showUpdateConfirmModal()" style="color:#fff;text-decoration:underline;cursor:pointer;">點此更新（強制先備份）</a>`;
        document.body.appendChild(div);
      }
    } else {
      // 本地 >= 伺服器 → 移除可能殘留的橫幅
      document.getElementById('version-remind')?.remove();
    }
  } catch (err) {
    // 靜默失敗
  }
}

// ============== v3.24.14：強制備份才能更新（保護資料不被新版 bug 弄壞） ==============
// 流程：偵測到新版 → 點橫幅或版號 badge → showUpdateConfirmModal()
//       → 使用者必須選「Drive 快照備份」或「下載 JSON 備份」其中一個
//       → 完成備份才呼叫 hardReload() 更新

function showUpdateConfirmModal() {
  const modal = document.getElementById('update-confirm-modal');
  if (!modal) {
    // modal 還沒載入（極罕見）→ fallback 給原本流程
    if (confirm(`偵測到新版 ${serverAppVersion}。建議先到設定頁手動建立備份再更新。\n\n要立刻強制更新嗎？（不建議）`)) {
      hardReload();
    }
    return;
  }
  // 重置 modal 內容（避免多次開關殘留舊狀態）
  const actions = document.getElementById('update-modal-actions');
  if (actions) {
    actions.innerHTML = `
      <button class="btn btn-primary" onclick="confirmUpdateWithDriveBackup()" id="update-backup-drive-btn">📸 建立 Drive 快照並更新</button>
      <button class="btn btn-outline" onclick="confirmUpdateWithJSONDownload()" id="update-backup-json-btn">📥 下載 JSON 備份</button>
      <button class="btn btn-ghost" onclick="cancelUpdate()">⏸️ 稍後再說</button>
    `;
  }
  // 填狀態文字
  const status = document.getElementById('update-backup-status');
  const signedIn = (typeof isCloudSignedIn === 'function') && isCloudSignedIn();
  const accountLine = signedIn && cloudAuthState.user
    ? `已登入：<b>${cloudAuthState.user.email || ''}</b>`
    : `<span style="color: var(--warning);">⚠️ 未登入 Google，無法建 Drive 快照（請先登入或下載 JSON 備份）</span>`;
  if (status) {
    status.innerHTML = `
      🆕 新版本：<b>${serverAppVersion || '(unknown)'}</b><br>
      目前版本：${APP_VERSION}<br>
      ${accountLine}
    `;
  }
  // 未登入 → 禁用 Drive 備份按鈕
  const driveBtn = document.getElementById('update-backup-drive-btn');
  if (driveBtn) {
    driveBtn.disabled = !signedIn;
    if (!signedIn) driveBtn.title = '請先登入 Google';
  }
  modal.classList.add('open');
}

async function confirmUpdateWithDriveBackup() {
  if (!isCloudSignedIn()) {
    alert('未登入 Google，無法建立 Drive 快照。\n\n請改選「下載 JSON 備份」。');
    return;
  }
  const btn = document.getElementById('update-backup-drive-btn');
  const otherBtn = document.getElementById('update-backup-json-btn');
  if (btn) { btn.disabled = true; btn.textContent = '📸 備份中…請稍候'; }
  if (otherBtn) otherBtn.disabled = true;
  try {
    // 用 cloudCreateSnapshot 直接建 manual snapshot（永久保留），label 帶版本號方便辨識
    const safetyLabel = `更新前備份 → ${serverAppVersion || 'new'}`;
    await cloudCreateSnapshot('manual', safetyLabel);
    if (typeof toast === 'function') toast('✓ 備份完成，1.5 秒後更新…', 2000);
    if (typeof logAction === 'function') {
      logAction('update-backup', { type: 'drive-snapshot', from: APP_VERSION, to: serverAppVersion });
    }
    // 給使用者看到 toast 後再 reload
    setTimeout(() => hardReload(), 1500);
  } catch (e) {
    console.error('[update-backup] Drive snapshot failed:', e);
    alert('Drive 備份失敗：' + (e.message || e) +
          '\n\n為了你的資料安全，請改選「下載 JSON 備份」，或修復網路 / 重新登入後再試。');
    if (btn) { btn.disabled = false; btn.textContent = '📸 建立 Drive 快照並更新'; }
    if (otherBtn) otherBtn.disabled = false;
  }
}

function confirmUpdateWithJSONDownload() {
  // 用 buildTrackerWrapper 組完整 wrapper 結構（schema、版本、所有資料）
  let wrapper;
  try {
    wrapper = (typeof buildTrackerWrapper === 'function')
      ? buildTrackerWrapper(0)
      : {
          schemaVersion: (typeof CURRENT_SCHEMA_VERSION !== 'undefined' ? CURRENT_SCHEMA_VERSION : 1),
          lastModifiedAt: new Date().toISOString(),
          data: {
            clients: state.clients || [],
            jobs: state.jobs || [],
            invoiceHistory: state.invoiceHistory || [],
            config: config || {}
          }
        };
  } catch (e) {
    alert('組備份檔失敗：' + (e.message || e));
    return;
  }
  const json = JSON.stringify(wrapper, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `freelance-tracker-backup-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  if (typeof logAction === 'function') {
    logAction('update-backup', { type: 'json-download', from: APP_VERSION, to: serverAppVersion });
  }
  // 改 modal 的內容：要使用者親自確認檔案存在後才允許 reload
  const status = document.getElementById('update-backup-status');
  if (status) {
    status.innerHTML = `
      ✓ JSON 備份已下載到「下載」資料夾<br>
      檔名：<code>freelance-tracker-backup-${ts}.json</code><br>
      <span style="color: var(--warning);">⚠️ 請先確認檔案存在再點下方更新</span>
    `;
  }
  const actions = document.getElementById('update-modal-actions');
  if (actions) {
    actions.innerHTML = `
      <button class="btn btn-primary" onclick="hardReload()">✓ 確認備份完成，立刻更新</button>
      <button class="btn btn-ghost" onclick="cancelUpdate()">⏸️ 我還沒確認，稍後再說</button>
    `;
  }
}

function cancelUpdate() {
  const modal = document.getElementById('update-confirm-modal');
  if (modal) modal.classList.remove('open');
  // 不擋繼續使用 — 下次 pollAppVersion 觸發或使用者主動點橫幅，modal 會再次開啟
}

// v3.24.14：版號 badge 點擊行為 — 有新版走「強制備份」modal，沒新版走清快取重整
function onVersionBadgeClick() {
  if (serverAppVersion && (typeof compareAppVersion === 'function')
      && compareAppVersion(serverAppVersion, APP_VERSION) > 0) {
    showUpdateConfirmModal();
  } else {
    // 沒新版 → 原本的強制刷新（清 cache）— 但加個確認免得使用者誤點
    if (confirm('目前已是最新版。\n\n要強制清除快取並重新載入嗎？\n（資料不會遺失，只是清瀏覽器快取）')) {
      hardReload();
    }
  }
}

// v3.0.0：以下整批 v2 邏輯已移除：
//   - 雲端優先模式 + 自動 polling（saveCloudFirstMode / saveAutoPollToggle / setupAutoPoll / checkCloudForUpdate / autoPollTimer）
//   - Apps Script 後端設定 UI（loadSheetConfigUI / saveSheetConfig / testSheetConnection）
//   - Google Calendar Apps Script 中介同步（getCalReminderMinutes / describeCalReminder / loadCalendarConfigUI /
//     updateCalendarReminderHint / updateCalendarStatusBadge / renderCalendarSyncStatus）
// v3 同步全部交給 ☁️ Cloud Auth Layer / Drive Sync Layer

// v3.3.0：saveCalendarConfig / testCalendarConnection stub 已刪（v2 #card-calendar 用法、v3 用 cloudRenderCalendarUI 取代）

/**
 * v2.10.2：建立「提醒事件」清單
 * 把 App 提醒設定裡所有 enabled 的提醒類型，產生為要送上 Google Calendar 的事件
 * 各事件帶 type 標記，後端可分類 emoji/顏色
 *
 * 回傳：[{ date: 'YYYY-MM-DD', type, title, desc }]
 *   type: 'overdue' | 'unpaid-long' | 'month-end' | 'billing-day' | 'slow-pay'
 */
function buildReminderEvents() {
  const events = [];
  const today = todayStr();
  const active = activeJobs();
  const clientById = {};
  state.clients.forEach(c => { clientById[c.id] = c; });
  const fmtMoney = (n) => 'NT$' + (+n || 0).toLocaleString();

  // 1. 完成已久未收款 → 在 doneAt + N 天當天建提醒
  if (config.enableUnpaidLongAlert !== false) {
    active.forEach(j => {
      if (!j.done || j.paid || !j.doneAt) return;
      const c = clientById[j.clientId];
      const days = (c?.unpaidRemindDaysOverride != null) ? c.unpaidRemindDaysOverride : (config.unpaidRemindDays || 7);
      const remindDate = addDays(new Date(j.doneAt), days);
      events.push({
        date: remindDate,
        type: 'unpaid-long',
        title: `🟠 ${c?.name || '?'} 已完成 ${days} 天仍未收款：${j.title}`,
        // v3.22.5：顯示待收金額
        desc: `業主：${c?.name || '?'}\n案件：${j.title}\n待收：${fmtMoney(jobUnpaidAmount(j))}\n完成日：${j.doneAt}\n— App 提醒：完成已久未收款 —`
      });
    });
  }

  // 2. 月底提醒：未來 12 個月，每月 day N 建一個事件
  if (config.enableMonthEndAlert !== false) {
    const startDay = config.monthEndReminderDay || 25;
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const dt = new Date(now.getFullYear(), now.getMonth() + i, startDay);
      // 處理月份天數不足
      if (dt.getMonth() !== ((now.getMonth() + i) % 12 + 12) % 12) continue;
      if (dt < new Date(today)) continue;
      events.push({
        date: toDateStr(dt),
        type: 'month-end',
        title: `📅 月底提醒：可開始整理請款`,
        desc: `每月 ${startDay} 號之後可開始整理本月可請款案件\n— App 提醒：月底提醒 —`
      });
    }
  }

  // 3. 業主固定請款日：每個有 billingDay 的業主，未來 12 個月建月度提醒
  if (config.enableBillingDayAlert !== false) {
    const now = new Date();
    state.clients.forEach(c => {
      if (!c.billingDay || c.billingDay < 1 || c.billingDay > 31) return;
      const remindDays = +c.billingRemindDays || 3;
      for (let i = 0; i < 12; i++) {
        let billingDate = new Date(now.getFullYear(), now.getMonth() + i, c.billingDay);
        // 處理月份天數不足（例如 2 月 31 號 → 該月最後一天）
        if (billingDate.getMonth() !== ((now.getMonth() + i) % 12 + 12) % 12) {
          billingDate = new Date(now.getFullYear(), now.getMonth() + i + 1, 0);
        }
        const remindDate = addDays(billingDate, -remindDays);  // 已是 YYYY-MM-DD 字串
        if (remindDate < today) continue;
        events.push({
          date: remindDate,
          type: 'billing-day',
          title: `📋 ${c.name} 請款日提醒（${billingDate.getMonth()+1}/${c.billingDay} 前 ${remindDays} 天）`,
          desc: `業主：${c.name}\n固定請款日：每月 ${c.billingDay} 號\n請於 ${toDateStr(billingDate)} 前送出請款單\n— App 提醒：業主固定請款日 —`
        });
      }
    });
  }

  // 4. 智慧拖款警告：命中今天，建今日提醒
  if (config.enableSlowPayAlert !== false) {
    const slowJobs = computeSlowPayJobs(active);
    slowJobs.forEach(j => {
      const c = clientById[j.clientId];
      events.push({
        date: today,
        type: 'slow-pay',
        title: `🐢 拖款警告：${c?.name || '?'} - ${j.title}`,
        // v3.22.5：顯示待收金額
        desc: `業主：${c?.name || '?'}\n案件：${j.title}\n待收：${fmtMoney(jobUnpaidAmount(j))}\n完成日：${j.doneAt}\n已過 ${j.daysSince} 天（該業主平均 ${j.avgDays} 天）\n— App 提醒：智慧拖款警告 —`
      });
    });
  }

  return events;
}

// 工具：Date → 'YYYY-MM-DD'
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// v3.3.0：syncCalendarNow stub 已刪（v3 用 cloudSyncCalendar 取代）

// ============== 初次使用引導 ==============
function maybeShowOnboarding() {
  // 條件：完全乾淨（無業主、無案件、無 Sheet 設定）+ 沒看過
  const isClean = state.clients.length === 0 && state.jobs.length === 0;
  const noSheet = !config.sheetConfig?.apiUrl;
  const notSeen = !config.onboardingDone;
  if (isClean && noSheet && notSeen) {
    document.getElementById('onboarding-modal').classList.add('open');
  }
}

function onboardingChoose(choice) {
  document.getElementById('onboarding-modal').classList.remove('open');
  config.onboardingDone = true;
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));

  if (choice === 'import-settings') {
    document.getElementById('settings-import-file').click();
    switchTab('settings');
  } else if (choice === 'demo') {
    loadDemo();
  } else if (choice === 'blank') {
    // v3.24.16：原本跳到「我的資料」card，但該 card 已刪 → 改跳請款單分頁讓使用者設定收款帳號
    switchTab('invoice');
    setTimeout(() => {
      toast('💡 建議先到「請款單」分頁設定收款帳號（姓名、匯款資訊）', 4500);
    }, 300);
  }
}

function showOnboardingAgain() {
  document.getElementById('onboarding-modal').classList.add('open');
}

// ============== 自動儲存（設定頁的 input 失焦自動存）==============
function setupAutoSave() {
  // 我的資料：6 個欄位 + 1 個 textarea
  ['me-name', 'me-phone', 'me-email', 'me-title', 'me-bank', 'me-account', 'me-note'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('blur', () => {
      // 自動觸發儲存（不顯示 toast，靜默）
      if (typeof saveUserInfo === 'function') {
        config.userInfo = config.userInfo || {};
        config.userInfo[id.replace('me-', '').replace('title', 'invoiceTitle').replace('account', 'account')] = el.value.trim();
        // 統一用 saveUserInfo 比較簡單
        const tmpToast = window.toast;
        window.toast = () => {};  // 暫時關掉 toast
        saveUserInfo();
        window.toast = tmpToast;
      }
    });
  });

  // 提醒設定
  const unpaidEl = document.getElementById('cfg-unpaid-days-input');
  if (unpaidEl) unpaidEl.addEventListener('blur', () => {
    const tmpToast = window.toast;
    window.toast = () => {};
    saveConfig();
    window.toast = tmpToast;
  });

  // v3.0.0-beta.1：移除 Sheet 設定 / Calendar 設定的 auto-save listener（對應 UI 已 hidden）
}

// ============== Init ==============
load();
loadActionLog();   // v2.9.5
loadReminderConfigUI();   // v2.7.9: 提醒設定（取代舊的單欄）
loadDisplayPrefUI();      // v3.22.8: 顯示偏好（隱藏目標卡片 toggle）
mascotInit();             // v3.23.0: 小幫手 mascot
// v3.3.0：移除 loadUserInfoUI（settings 「我的收款資訊」card 已搬到請款單分頁；renderInvoice 會處理收款帳號 picker）
// v3.0.0-beta.1：移除 loadSheetConfigUI / loadCalendarConfigUI / updateSheetSyncBadge（對應 hidden 卡片，不再需要 init UI）
loadInvoiceStatusUI();   // v2.10.4: 請款單狀態篩選
buildRangeOptions();
setupAutoSave();
checkAppVersionUpdate();
updateVersionBadge();           // v2.7.5: 先把當前版號顯示出來
setTimeout(pollAppVersion, 2000);  // 啟動 2 秒後檢查一次（不擋首次載入）
setInterval(pollAppVersion, 5 * 60 * 1000);  // 每 5 分鐘檢查網頁新版
renderAll();  // 啟動時全部畫一次

// 啟動時抓 IP 地理位置（24h 快取，失敗不擋）
fetchDeviceLocation();

// v3.0.0：maybeGenerateMonthlySnapshot（v2 月報自動 snapshot）已移除；v3 不再依靠 Apps Script 月報

// v3.3.0：啟動時套用主題（updateLabModeUI / maybeShowDeviceNamePrompt 已隨 #card-cloud 一起 dead）
loadThemeUI();
updateThemeToggleIcon();
updateNotifUI();

// v3.21.1：啟動時印著作權 banner
console.log(
  '%c Freelance Tracker (Cloud) ',
  'background:#2563eb;color:#fff;padding:4px 10px;border-radius:4px;font-weight:600;font-size:13px;',
  '\n© 2026 lancelotwang114 · Licensed under PolyForm Noncommercial 1.0.0',
  '\nhttps://github.com/lancelotwang114/freelance-tracker-cloud',
  '\n\nCommercial use is prohibited without prior written permission.',
  '\n任何商業用途均需事先書面授權。商業授權請至 GitHub repo 開 issue 洽詢。'
);

// v3.10.0：啟動時還原全局計時器（瀏覽器關了再開、計時器繼續跑）
loadActiveTimerFromStorage();
renderActiveTimerWidget();

// v3.13.0：套用案件分頁的視圖模式（依 localStorage）
// v3.18.0：分組 select 也還原
// v3.21.0：5 種視圖
setTimeout(() => {
  const btns = document.querySelectorAll('#jobs-view-toggle button');
  btns.forEach(b => b.classList.toggle('active', b.dataset.view === jobsView));
  applyJobsView();
  const groupSel = document.getElementById('jobs-group-by');
  if (groupSel) groupSel.value = jobsGroupBy;
}, 50);
// v2.5: 開頁掃一次推通知（一天一次）
// v3.24.16：桌面通知觸發已停用（「通知與提醒」卡已整段刪除）；保留 maybeFireNotifications 函式 dead code 以備未來恢復
// setTimeout(maybeFireNotifications, 4000);

// v3.0.0-beta.1：移除 v2 Apps Script 啟動同步邏輯（pullFromSheet / setupAutoPoll / maybeGenerateMonthlySnapshot）
// v3 同步由 cloudInitGoogleAuth → cloudInitTrackerFile 觸發；setSyncStatus 全交給 cloudUpdateSyncIndicator
setTimeout(maybeShowOnboarding, 300);

// v3.0.0-beta.1：移除 v2 online listener（網路恢復補推 Apps Script）；v3 由 cloudPushNow 失敗 + 下次 save() 重試處理

// 視窗縮放時重繪收益圖表（SVG 會依父容器寬度調整）
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (!document.getElementById('tab-revenue').classList.contains('hidden')) {
      renderRevenue();
    }
  }, 200);
});

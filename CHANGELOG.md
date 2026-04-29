# 版本更新歷史

## v3.0.0-alpha.1 — 2026-04-29

### 起點
- 從 freelance-tracker v2.10.15 fork 過來當起點
- 移除 backend/（Apps Script 後端）
- 移除 v2 路線圖、舊文件（docs/ROADMAP.md 等）
- 重寫 README、CHANGELOG、ROADMAP 為 v3 系列

### 與 v2 完全隔離（資料安全）
- v2 跟 v3 都部署在同一個 origin `lancelotwang114.github.io`，子路徑無法隔離 localStorage / Cache Storage
- 全部 13 個 localStorage key 加上 `cloud-` 前綴：
  - `freelance-tracker-v1` → `cloud-freelance-tracker-v1`（主資料）
  - `freelance-tracker-config` → `cloud-freelance-tracker-config`（設定）
  - `ftActionLog_v1` → `cloud-ftActionLog_v1`（操作日誌）
  - `ftNotifEnabled_v1`、`ftNotifLastFired_v1`（通知）
  - `ftJobTemplates_v1`（範本）
  - `ftTheme_v1`（暗色模式）
  - `ftLabMode_v1`（實驗模式）
  - `ftDeviceName_v1`、`ftDeviceAutoId_v1`、`ftDeviceLocation_v1`、`ftDeviceNamePromptDismissed_v1`（裝置資訊）
  - `freelance-tracker-app-version`（版本快取）
- Service Worker cache 名稱：`ftracker-v2.10.15` → `ftracker-cloud-v3.0.0-alpha.1`
- 從此 v3 看不到 v2 的資料，v3 也不會覆寫 v2 的資料；想把 v2 資料帶過來，請用 v2 的「資料備份檔」匯出再到 v3 匯入

### 版本號三處同步
- `js/app.js` 的 `APP_VERSION` → `2026-04-29-v3.0.0-alpha.1`
- `index.html` 的 `<meta name="app-version">` → 同上
- `service-worker.js` 的 `CACHE_VERSION` → `ftracker-cloud-v3.0.0-alpha.1`

### Google Identity Services SDK 載入（基礎建設）
- `index.html` `<head>` 加入 `<script src="https://accounts.google.com/gsi/client" async></script>`
- `js/app.js` 新增「☁️ Cloud Auth Layer」區塊
  - `GOOGLE_CLIENT_ID`：GCP OAuth Web 用戶端 ID（lancelotwang114 個人專案）
  - `DRIVE_SCOPE`：`drive.appfolder`（只能存取本 app 建的應用程式資料夾，最小權限）
- 純載入依賴 + 設定常數，還沒任何 UI、沒任何登入邏輯（會在後續 commit 接上）

### 設定頁加雲端登入區塊 UI 骨架
- 在「設定」分頁最上方新增「🔐 Google Drive 同步」卡片，置頂醒目（藍色邊框點綴）
- 名稱刻意跟 v2 沿用的「☁️ 雲端同步」（Apps Script + Sheet）區隔，避免兩張卡同名造成混淆（v2 那張在 beta.1 才會移除）

### 接通 GIS Token Client（登入 / 登出 / token 撤銷）
- `js/app.js` Cloud Auth Layer 加入 7 個函式 + 1 個記憶體 state：
  - `cloudAuthState`：`{ initialized, tokenClient, accessToken, tokenExpiresAt, user }`
  - `cloudShowAuthState(state)`：切換 pending / signed-out / signed-in 三個 div
  - `cloudWaitForGoogleSDK()`：polling 等 GIS SDK ready（async 載入無保證）
  - `cloudInitGoogleAuth()`：app 啟動自動跑、init token client、啟用登入按鈕
  - `cloudSignIn()`：點按鈕 → 呼叫 `tokenClient.requestAccessToken({ prompt: '' })` 跳 Google 登入彈窗
  - `cloudOnTokenResponse(resp)`：拿到 token → fetch userinfo → 渲染已登入 UI
  - `cloudRenderSignedIn()`：把 `cloudAuthState.user` 渲染到 UI（名稱、email、大頭貼）
  - `cloudSignOut()`：清本機 state + UI 切回未登入 + 非同步 `google.accounts.oauth2.revoke(token)` 通知 Google 撤銷
- 自啟動：`app.js` 載入完直接呼叫 `cloudInitGoogleAuth()`（不等 DOMContentLoaded，因為 `app.js` 是 body 尾端動態 append、DOM 已就緒）
- 還沒做：access token 持久化（commit 6）、top-bar sync indicator 接通（commit 5）、操作日誌埋點（commit 7）

### 修：登入後拿不到使用者基本資訊
- 原 bug：scope 只有 `drive.appfolder`，access token 沒有讀 userinfo 的權限，導致 `oauth2/v3/userinfo` fetch 401，UI 顯示「已登入 / （無法取得帳號資訊）」、沒有大頭貼
- 修法：新增 `AUTH_SCOPES` 常數合併 `openid email profile drive.appfolder` 一次請求；`initTokenClient` 的 scope 從 `DRIVE_SCOPE` 改為 `AUTH_SCOPES`
- 影響：使用者授權畫面會多一行「See your name, email and profile picture」（都是非機敏 scope，Google 不需要重新審核）
- 已登入的使用者要登出 → 再登入一次，才會拿到含新 scope 的 token

### 登入狀態持久化（重整不用重登）
- 新增 `CLOUD_AUTH_KEY = 'cloud-freelance-tracker-auth'`（cloud- 前綴與 v2 隔離）
- 新增 3 個 storage helper：
  - `cloudSaveAuthState()`：登入成功後寫入 `{ accessToken, tokenExpiresAt, user }`
  - `cloudLoadAuthState()`：app 啟動時還原；過期或損壞自動清掉並回 false
  - `cloudClearAuthState()`：登出時清掉
- 改 `cloudInitGoogleAuth()`：先試還原 → 成功就立刻渲染為「已登入」（不用等 GIS SDK 載入）→ 同時背景 init token client 給後續登入流程用
- 改 `cloudOnTokenResponse()`：登入成功 + userinfo 拿到後 → 呼叫 `cloudSaveAuthState()`
- 改 `cloudSignOut()`：清掉 localStorage 防止重整又恢復為已登入
- 過期判斷：`Date.now() > tokenExpiresAt - 60_000`（留 60 秒 buffer 避免邊界競爭）
- **不存 refresh token**（GIS 隱式流根本不發 refresh token），1 小時 token 自然過期後使用者要重新點登入按鈕
- 新增 2 個對外 API（alpha.2 寫 Drive 同步會用到）：
  - `getValidAccessToken()`：拿可用 token，過期或未登入回 null
  - `isCloudSignedIn()`：UI 顯示用

### top-bar sync indicator 接通到登入狀態
- 新增 `cloudUpdateSyncIndicator()`：依 `isCloudSignedIn()` 決定 indicator 顯示
  - 已登入：綠燈「✓ 已連 Drive」+ tooltip 顯示帳號 email
  - 未登入：灰燈「○ 未連雲端」+ tooltip「點擊開啟設定頁登入」
- 在 `cloudRenderSignedIn()` / `cloudSignOut()` / `cloudInitGoogleAuth()` 三處呼叫
- 改 v2 既有 `setSyncStatus()` 開頭加 short-circuit：若 v3 已登入則 indicator 由 `cloudUpdateSyncIndicator()` 接管，避免 v2 sync timer 把綠燈覆寫成灰燈造成閃爍（beta.1 整個 v2 sync 邏輯移除時這條 short-circuit 一起拆）

### 操作日誌埋點
- `ACTION_LABELS` 新增兩個 type：
  - `cloud-signin`（🔐）：登入 Google Drive
  - `cloud-signout`（🔓）：登出 Google Drive
- `cloudOnTokenResponse()` 登入成功後 → `logAction('cloud-signin', { email })`
- `cloudSignOut()` 登出後 → `logAction('cloud-signout', { email })`
- 注意：日誌**只記 email、不記 token**

### 文件收尾
- `ROADMAP.md`：v3.0.0-alpha.1 全部 checkbox 打勾、標完成（2026-04-29）
- `README.md`：路線圖表格 alpha.1 狀態 → ✅ 完成；alpha.2 → 進行中
- 三個互斥狀態 div：
  - `#cloud-auth-pending`：GIS SDK 載入中（預設顯示）
  - `#cloud-auth-signed-out`：未登入（含 Google 4 色 G logo SVG 按鈕）
  - `#cloud-auth-signed-in`：已登入（大頭貼 + 名稱 + email + 登出鈕）
- `css/style.css` 加入 `.card-cloud-auth`、`.cloud-signin-btn`、`.cloud-account` 等樣式
- 樣式統一用既有 CSS 變數（`--primary` / `--card` / `--text` / `--muted` / `--border` / `--bg`），暗色模式自動相容
- **按鈕還沒接 handler**：`cloud-signin-btn` 預設 disabled、`onclick="cloudSignIn()"` 函式還沒實作；後續 commit 才會接上

### 待開發
- 設定頁登入 / 登出 UI 區塊
- Token Client 接通、登入流程、撤銷登出
- top-bar sync indicator 接通
- 登入狀態持久化（access token + 過期時間存 localStorage cloud key）
- 操作日誌埋點
- Drive App Folder 讀寫（alpha.2）
- 移除 localStorage 為主的同步邏輯，改 Drive 為 source of truth（beta.1）

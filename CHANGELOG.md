# 版本更新歷史

## v3.2.0 — 請款單重構（2026-04-29）

> 案件加數量、請款單版面重做、收款帳號合併個人資訊、CRUD 從設定頁搬到請款單分頁。

### Schema 升 v8 → v10
- **v9**：每筆 job 加 `quantity`（預設 1），給請款單顯示「單價 × 數量」用；amount 維持是「總金額」（不變）
- **v10**：每筆 paymentAccount 加 7 個欄位 — `name / phone / email / invoiceTitle / taxId / address / invoiceNote / showPersonalInfo`
- 升級時 `ensurePaymentAccounts()` 從 top-level userInfo 一次性 backfill 既有 paymentAccount 的 name / phone / email / invoiceTitle，舊資料無痛升級

### 案件編輯表單
- 新增「單價」「數量」「總金額」三欄並排
- 改任一個自動算另一個（單價 × 數量 = 總金額；改總金額會反算單價）
- 數量預設 1，最少 1（整數）

### 請款單版面重構
- **狀態欄整欄移除**：給業主看的單據不需要顯示「進行中 / 待收款 / 已收款」狀態
- **「原價」改為「單價 × 數量」兩欄**：報帳/抓出錯時可看到細項
- **匯款資訊 + 發票資訊 並排**：左邊匯款（既有），右邊發票（新增），沒填發票就不顯示右欄
- **發票資訊新欄位**：`invoiceTitle` / `taxId` / `address` / `invoiceNote`
- **顯示個人資訊 toggle**：每筆 paymentAccount 各自帶 `showPersonalInfo` flag，關掉就不顯示姓名 / 電話 / Email

### 收款帳號 CRUD 搬到請款單分頁
- 設定頁「我的收款資訊」card 簡化成導引按鈕「📋 前往請款單分頁編輯」
- 請款單分頁的下拉選擇器旁邊加「📝 編輯 / ➕ 新增 / 🗑️ 刪除」三按鈕
- 點 📝 / ➕ 開啟新的編輯 modal `#payment-account-editor`：
  - 標籤、個人資訊（含 showPersonalInfo toggle）、發票資訊、匯款資訊、存摺照片，4 段獨立區塊
  - 存摺照片支援上傳 Drive（同 alpha.3 邏輯）
- 刪除時自動清掉對應的 Drive 存摺照片孤兒檔

### 修正
- `onInvPayAccountChange` 改用 `saveConfigOnly()` 統一推 Drive

### ACTION_LABELS
- 沿用 cloud-image-upload / cloud-image-delete（CRUD modal 內的存摺上傳走相同邏輯）

### 版本 bump 三處
- `js/app.js` `APP_VERSION` → `2026-04-29-v3.2.0`
- `index.html` meta → 同上
- `service-worker.js` `CACHE_VERSION` → `ftracker-cloud-v3.2.0`

---

## v3.1.0 — Google Calendar 整合（2026-04-29）

> v3.0.0 stable 之後第一個功能擴充。重做 v2 的 Google 行事曆同步——這次直接打 Calendar API、不再經過 Apps Script。

### 新增 Scope
- `AUTH_SCOPES` 增加 `calendar.events` + `calendar.readonly`
- 既有登入 user 需要登出 → 重新登入才能授權新 scope（會多顯示 Calendar 權限要求）

### 📅 Calendar API Client（5 個函式）
- `calendarListCalendars()`：列出使用者所有 calendars（給選擇器用）
- `calendarListEvents(calendarId, query)`：列出事件，支援 `privateExtendedProperty` filter
- `calendarCreateEvent(calendarId, event)` / `calendarUpdateEvent` / `calendarDeleteEvent`
- 都共用 driveFetch wrapper（自動帶 Authorization header、401 → DriveAuthError）

### 📅 Calendar Sync Layer
- 新增 `CLOUD_CALENDAR_KEY = 'cloud-freelance-tracker-calendar'` localStorage 儲存配置
- 配置內容：`{ calendarId, calendarName, dailyMorningTime, syncTypes, autoSync, lastSyncedAt, lastSyncResult }`
- 增量同步引擎 `cloudSyncCalendar()`：
  1. 列既有事件（用 `privateExtendedProperty=ftSource=freelance-tracker-cloud` filter，不會列到使用者其他事件）
  2. 用 `ftKey` 比對 → 算出 toCreate / toUpdate / toDelete
  3. 執行 API → toast 進度反饋
  4. 結果記到 lastSyncResult + 操作日誌
- 自動同步：`cloudScheduleCalendarSync()` 在 save() 內 fire（30 秒 debounce）

### 6 種事件類型
1. **案件本身**：依狀態自動變 emoji + Calendar colorId（🔵🟡🔴🟢✅⚫️）；含取消的（標題前綴 "(已取消)"）
2. **完成已久未收款提醒**（🟠 Tangerine）
3. **月底提醒**（📅 Banana）
4. **業主固定請款日提醒**（📋 Lavender）
5. **智慧拖款警告**（🐢 Tomato）
6. **每日早報**：當天有事的日子，使用者選定時段建一筆「📋 [外包] 今日 N 件事」（會跳手機通知）

### 安全保證
- 只動帶 `extendedProperties.private.ftSource === 'freelance-tracker-cloud'` 標記的事件
- 列事件時帶 `privateExtendedProperty` filter，使用者其他事件**完全不會被讀到、修改、刪除**
- 強制讓使用者選定一本 Calendar，未選不能同步

### UI 重做（解 hidden + 重寫 #card-calendar）
- 4 步驟設定流程：① 選擇日曆（含「外包」推薦提示）→ ② 設定每日早報時段（任意 HH:MM）→ ③ 勾選要同步的事件類型 → ④ 自動 vs 手動
- 立即同步按鈕 + 上次同步狀態（時間 + 新增/更新/刪除統計）
- 進度 toast：讀取既有 → 比對差異 → 建立 → 更新 → 清除 → 完成

### ACTION_LABELS
- 加 `calendar-sync` / `calendar-sync-error`

### 版本 bump 三處
- `js/app.js` `APP_VERSION` → `2026-04-29-v3.1.0`
- `index.html` meta → 同上
- `service-worker.js` `CACHE_VERSION` → `ftracker-cloud-v3.1.0`

---

## v3.0.0 ✅ 正式 stable（2026-04-29）

> 從 v2.10.15 fork 出來、改寫成 Drive App Folder 後端、走完 alpha.1/2/3 + beta.1 完整 4 個 phase 後正式 stable。
> 一個人接案的收益與排程管理工具，使用者門檻從 v2 的 30 分鐘部署降到 10 秒登入。

### 砍 dead code（v2 Apps Script 內部 helpers）
從 beta.1 留下的 ~1500 行 dead code 砍掉約 700 行：
- `setSyncStatus` + v2 sync 全域狀態（syncTimer / syncStatus / syncError）
- v2 idle 偵測 + 編輯鎖整套（IDLE_THRESHOLD_MS / lastActivityAt / lockHeartbeatTimer / acquireEditLock / releaseEditLock / forceReleaseEditLock / startLockHeartbeat / stopLockHeartbeat / tryAcquireLockOrWarn / isIdle + page unload listener）
- `manualSnapshot` / `setupDailyForceTrigger`（v2 sheet snapshot Apps Script 觸發）
- `schedulePush`（v2 push timer）
- `showStaleClientBanner`（v2 sheet schema 衝突警告橫幅）
- `getDeviceLabelForUpload`（v2 上傳時帶地理位置）
- `updateSheetSyncBadge`（v2 sync UI badge）
- `showSnapshotList`（v2 sheet snapshot 列表）
- 雲端優先模式 / 自動 polling 全套（saveCloudFirstMode / saveAutoPollToggle / setupAutoPoll / checkCloudForUpdate / autoPollTimer）
- Apps Script 後端設定 UI（loadSheetConfigUI / saveSheetConfig / testSheetConnection）
- Apps Script 中介 Calendar 同步 UI 全套（getCalReminderMinutes / describeCalReminder / loadCalendarConfigUI / updateCalendarReminderHint / updateCalendarStatusBadge / renderCalendarSyncStatus）
- `maybeGenerateMonthlySnapshot`（v2 月報自動 snapshot）

### 版本號歸正
- `js/app.js` `APP_VERSION` → `2026-04-29-v3.0.0`
- `index.html` `<meta name="app-version">` → 同上
- `service-worker.js` `CACHE_VERSION` → `ftracker-cloud-v3.0.0`

### 文件收尾
- `README.md` 移除「實驗版警告」橫幅、改寫成穩定版描述、補 Cloud Layer 結構介紹
- `ROADMAP.md` 全部 phase 打勾 ✅
- `CHANGELOG.md` 加本段 stable 標記

### 暫留
- HTML hidden 卡片（`#card-cloud` / `#card-calendar` / `#card-portable`）整段 HTML 還在但 hidden，使用者看不到、JS handlers 都已 stub 化
- 少量 dead code（`buildReminderEvents` / `toDateStr` / `previewSnapshot`/`computeSnapshotDiff` 等 v2 sheet snapshot 相關），所有 caller 已切斷不會執行
- 之後想徹底乾淨可手動砍，但對運作沒影響

---

## v3.0.0-beta.1 ✅ 結案（2026-04-29）

### 移除 v2 Apps Script 同步進入點（β1-1）
- `save()` 拿掉 `if (config.sheetSyncEnabled) schedulePush()` 觸發
- init script 末段砍掉 v2 sync 啟動邏輯（`pullFromSheet(true)` / `setupAutoPoll()` / `maybeGenerateMonthlySnapshot()`）
- init script 中段砍掉 `loadSheetConfigUI()` / `loadCalendarConfigUI()` / `updateSheetSyncBadge()` 呼叫（對應 hidden 卡片）
- `setupAutoSave()` 拿掉 sheet-api / sheet-url / cal-* 的 listener
- 砍掉 online listener（網路恢復補推 Apps Script）

### Stub 化 HTML onclick 用到的 v2 函式（β1-1）
（HTML hidden 卡片的按鈕雖然點不到，stub 化避免使用者把 hidden 拿掉時 ReferenceError）
- `exportSettings()` / `importSettings()` — 跨裝置設定檔
- `pullFromSheet()` / `pushToSheet()` — Apps Script pull/push
- `enableSheetSync()` / `disableSheetSync()` — Apps Script 同步開關
- `saveCalendarConfig()` / `testCalendarConnection()` / `syncCalendarNow()` — Apps Script 中介行事曆同步
- `restoreSnapshot()` — v2 sheet-based 還原（v3 用 cloudRestoreSnapshot 從 Drive 還原）
- 所有 stub 內部只 `console.warn('[deprecated] ...')`，無 side effect

### 留作 dead code 暫不砍（v3.0.0 stable 再徹底移除）
- `setSyncStatus` / `updateSheetSyncBadge` / `schedulePush` / `setupAutoPoll` / `checkCloudForUpdate`
- 編輯鎖（acquireEditLock / releaseEditLock / startLockHeartbeat / stopLockHeartbeat / forceReleaseEditLock）
- `manualSnapshot` / `setupDailyForceTrigger` / `maybeGenerateMonthlySnapshot`
- `buildReminderEvents`（行事曆用）
- `loadSheetConfigUI` / `loadCalendarConfigUI` / `saveSheetConfig`
- 這些函式在 β1-1 後**已無任何 caller 會觸發**（init / save / runtime 的 entry chain 都被切斷），保留只是文字佔空間，不影響功能

### localStorage 退化純快取（概念變更，無 code change）
- alpha.2 起的同步策略已是「Drive 為 source of truth、localStorage 為 cache」
- alpha.3 起 metadata wrapper 自記 version + lastModifiedAt、衝突走三方合併
- beta.1 砍掉 v2 sync 後，這個架構正式落地——localStorage 唯一的角色就是「離線時還能讀」+「本機修改先寫進去再 debounce push」

## v3.0.0-alpha.3 ✅ 結案（2026-04-29）

### Schema v7 → v8 + Drive 圖片 API（α3-1）
- `CURRENT_SCHEMA_VERSION` 從 7 升到 8
- `SCHEMA_MIGRATIONS[7]` 加 v7 → v8 migration（state-level 沒東西要動，純版本標記；paymentAccounts 在 config 裡，由 `ensurePaymentAccounts` 處理）
- `ensurePaymentAccounts()` 加「補 `bankbookImageFileId: ''` 預設欄位」（idempotent）
- Drive API Client 新增 2 個圖片函式：
  - `driveUploadImage(dataUrl, name)`：multipart/related upload，Content-Transfer-Encoding: base64；回 `{ id, name, size, mimeType }`
  - `driveDownloadImageAsDataUrl(fileId)`：blob → FileReader.readAsDataURL → 直接餵 `<img src>`
- 圖片儲存代價：base64 比原始大 33%，800px 寬 JPEG ≈ 50~70KB；單人多裝置可接受

### 上傳路徑改寫 Drive（α3-2）
- `onBankbookFileChange()` 整個改寫：
  - 壓縮 dataUrl 後立刻顯示 preview（不等 Drive 上傳完，UX 不卡）
  - 已登入 + tracker init 完成 → `driveUploadImage()` 拿 fileId、清掉 base64
  - 上傳成功 → 清掉舊 fileId 對應的 Drive 孤兒檔（fire-and-forget `driveDeleteFile`）
  - 未登入 / 上傳失敗 → fallback 寫 base64，提示「未登入暫存本機，登入後自動遷移」
- `clearBankbookImage()` 同步清 fileId 跟 base64，且 fire-and-forget 刪 Drive 檔
- UI render 加 hidden input `data-acct-field="bankbookImageFileId"` 跟 `bankbookImage` 並存
- 「📷 更換 / 上傳照片」與「移除」按鈕的「有圖片」判斷：兩個欄位有任一個就算有
- `ACTION_LABELS` 加 3 個新類型：`cloud-image-upload`、`cloud-image-delete`、`cloud-image-migrate`

### 顯示路徑改成 fileId 下載（α3-3）
- 三個 render 點都改成「base64 → 直接用 / fileId → placeholder + data-bankbook-loading attribute / 都沒有 → 空白」：
  - 設定頁 paymentAccount edit row（preview）
  - 請款單預覽（請款單頁面）
  - 案件 detail 內的請款資訊
- 新增 4 個 helpers（在 Cloud Sync Layer 上方）：
  - `cloudGetBankbookCachedDataUrl(fileId)` / `cloudSetBankbookCachedDataUrl(fileId, dataUrl)`：sessionStorage cache，key = `cloud-bankbook-${fileId}`
  - `cloudGetBankbookDataUrl(fileId)`：cache 優先、未命中下載並 cache
  - `cloudHydrateBankbookImages()`：掃整個 DOM `[data-bankbook-loading]` placeholder → 換成實際 `<img>`，idempotent
- `renderAll()` 結尾呼叫 `cloudHydrateBankbookImages()`（fire-and-forget），cache 命中秒出
- 沒登入時 placeholder 顯示「⚠️ 請先登入 Google」

### 自動遷移既有 base64 → Drive（α3-4）
- 新增 `cloudMigrateBankbookImages()`：掃 paymentAccounts 找「有 base64 但沒 fileId」的，逐筆 driveUploadImage、寫 fileId、清 base64
- 1 小時節流防止 init 反覆觸發（`cloudMigrateBankbookImagesCheckedAt`）
- 觸發點：`cloudInitTrackerFile()` 結尾 fire-and-forget，跟 `cloudEnsureDailyAutoSnapshot()` 並列
- 遷移成功會：寫回 localStorage（`save()`，連帶 cloudSchedulePush）+ `renderAll()` 重繪 + toast「✓ 已自動把 N 張存摺照片遷移到 Drive」
- 失敗保留原 base64，下次再試

### v3.0.0-alpha.3 ✅ 結案（2026-04-29）

## v3.0.0-alpha.2 ✅ 結案（2026-04-29）

> alpha.2 範圍：Drive 雙寫期 + 三方合併 + snapshot 雲端化
> 共 10 個邏輯單元（α2-1~α2-7b + α2-Hide）+ α2-7c snapshot UX 強化 + α2-4-revisit 砍 prompt

### Drive API client wrapper（α2-1）
- 新增「☁️ Drive API Client」區塊在 Cloud Auth Layer 之後
- 包裝 Google Drive API v3，scope 限定 `drive.appfolder`（只動 App Folder 內檔案）
- 自訂 `DriveAuthError` 類別讓 caller 可區分「需要重新登入」vs「其他錯誤」
- 共 7 個函式：
  - `driveFetch(url, options)`：內部 helper，自動附 Authorization header、統一錯誤訊息
  - `driveListAppFolder(query?)`：列出 App Folder 內檔案，支援 q query syntax
  - `driveGetFileMeta(fileId)`：拿單一檔案 metadata（id / name / modifiedTime / version / size / mimeType）
  - `driveDownloadFile(fileId)`：下載檔內容為字串（呼叫端自己解 JSON）
  - `driveCreateFile(name, content, mimeType?)`：multipart upload 建新檔到 App Folder
  - `driveUpdateFile(fileId, content, mimeType?)`：PATCH media 更新既有檔
  - `driveDeleteFile(fileId)`：刪檔（snapshot prune 會用到）
- **本 commit 純加函式、不改任何行為**；後續 commit 才會呼叫這些函式
- 樂觀鎖策略：不靠 Drive 自身的 etag / If-Match，改在 `tracker.json` metadata wrapper 內自記 `lastModifiedAt + version`，應用層做衝突偵測（更可靠）

### 登入後自動初始化 tracker.json（α2-2）
- 新增「☁️ Drive Sync Layer」區塊在 Drive API Client 之後
- 新增 `CLOUD_META_KEY = 'cloud-freelance-tracker-meta'` 跟 `TRACKER_FILENAME = 'tracker.json'` 兩個常數
- 新增 6 個函式：
  - `cloudGetMeta()` / `cloudSaveMeta(patch)`：讀寫雲端同步 metadata（trackerFileId / lastSyncedAt / lastSyncedVersion 等）
  - `buildTrackerWrapper(prevVersion)`：把 state + config 包成 `{ schemaVersion, version, lastModifiedAt, lastModifiedBy, createdAt, data }`
  - `unwrapTracker(jsonText)`：解雲端內容並驗證；schema 比本機新就拒絕（避免覆寫）
  - `applyTrackerData(data)`：把雲端 data 套用到 state + config + localStorage + 重繪
  - `isLocalDataEmpty()`：判斷本機是否「全新裝置」
  - `cloudInitTrackerFile()`：登入後初始化的主流程
- 初始化邏輯三分支：
  - **A. 雲端沒檔** → 用本機資料建一個 → 寫進 meta（`cloud-init-create`）
  - **B. 雲端有檔 + 本機空白** → 自動下載覆蓋本機（`cloud-init-pull`）
  - **C. 雲端有檔 + 本機有資料** → 跳 `prompt()` 問使用者要 pull 還是 push 還是取消（α2-4 三方合併上線後改成正式 modal）
- 從 `cloudOnTokenResponse()` fire-and-forget 觸發；登入失敗不影響其他流程
- `ACTION_LABELS` 加 3 個新類型：`cloud-init-create`、`cloud-init-pull`、`cloud-init-push`

### 雙寫機制（α2-3）
- 新增 `cloudSchedulePush()`：debounce 2 秒；2 秒內若再呼叫就重置計時
- 新增 `cloudPushNow()`：實際推送，含 `cloudPushInProgress` 旗標防併發
- 改 v2 既有 `save()`：尾端加 `cloudSchedulePush()` 呼叫，跟 v2 既有 `schedulePush()` 並存
  - v2 path：只有 `config.sheetSyncEnabled === true` 才跑（alpha.2 期間 user 不會啟用，所以是 no-op）
  - v3 path：登入且 init 完成才跑
- 推送失敗策略：**不彈 alert**，本機資料還在 localStorage 安全；console + 操作日誌記下，下次 `save()` 會再排
- `ACTION_LABELS` 加 2 個新類型：`cloud-push`、`cloud-push-error`
- 衝突偵測：alpha.2 還沒做（α2-4 才會）；目前推送不檢查遠端有無被另一台裝置改過

### 三方合併引擎（α2-4a）
- 新增 `CLOUD_LAST_SYNCED_KEY = 'cloud-freelance-tracker-last-synced-snapshot'`：存「上次成功同步的快照」當共同祖先（base）
- 新增 helpers：`cloudSaveLastSyncedSnapshot(data)` / `cloudGetLastSyncedSnapshot()` / `_cloudDeepEqual(a, b)`
- 新增 merge engine：
  - `_cloudMergeEntity(type, id, base, local, remote)`：單一 entity 的 field-level 合併
    - 雙邊都沒了 → 已刪
    - 單邊不存在 + 另邊沒動 → 同意刪除
    - 單邊不存在 + 另邊改了 → `delete-vs-edit` conflict
    - 三邊都有 → 逐欄位 diff，只有單邊改的自動套用，雙邊都改且值不同 → `field-conflict`
  - `_cloudMergeEntityList(type, baseList, localList, remoteList)`：用 id 配對逐筆合併
  - `_cloudMergeConfig(base, local, remote)`：config 物件的 field-level 合併
  - `mergeStates(base, local, remote)`：主入口，回傳 `{ merged, conflicts, clean }`
- 在 init Case A / B / C 跟 cloudPushNow 成功後都呼叫 `cloudSaveLastSyncedSnapshot()` 更新 base
- 登出時清掉 `CLOUD_LAST_SYNCED_KEY` 跟 `CLOUD_META_KEY`，避免下次別人登入用到舊 base
- **本 commit 寫好引擎、接好 base 維護；α2-4b 才會把 init Case C 的 prompt 改成用 mergeStates 自動合併 + 衝突 modal**

### init Case C 砍掉英文 prompt 改走 mergeStates（α2-4-revisit）
- 原本「沒 last-synced base + 兩邊都有資料」會跳 `window.prompt` 三選一（pull/push/取消）
- 問題：英文輸入命令對中文使用者不友善、強制「整邊覆蓋」太粗暴、訊息提及的「α2-4 三方合併」其實已經做完
- 改為：**統一走 `cloudResolveAndMerge()`，不再分有無 base**
  - mergeStates 對 `base=null` 行為合理：
    - entity 只在單邊存在 → 視為新增、保留
    - 兩邊都有且資料完全相同 → keep（產生 0 衝突，靜默合併）
    - 兩邊都有但欄位不同 → 跳 cloudShowConflictModal 逐筆處理
- 移除原 prompt fallback 約 50 行 code（pull/push/取消三條分支）
- 在 `cloudResolveAndMerge` 無衝突路徑加 toast「✓ 已跟雲端同步」，避免靜默合併沒反饋

### snapshot UX 強化（α2-7c）
- 建立備份按下去 → 立刻 toast「💾 建立備份中…」→ 完成 toast「✓ 備份已建立」
- 刪除按下去 → 立刻 toast「🗑️ 刪除中…」→ 完成 toast「✓ 已刪除」
- **還原流程整個重寫，加入「目前 vs 還原後」對比 modal**：
  - 點還原 → toast「📥 載入 snapshot 預覽…」
  - 自動下載 + 解析 snapshot → 跳預覽 modal，內含：
    - 備份時間、類型、標籤、建立裝置
    - 對比表格（業主數 / 案件數 / 完成 / 已收款 / 應收金額 / 已收金額 / 未收金額），紅綠標示增減
    - 提示「還原前會自動建『還原前-』備份保險」
  - 確認 → toast「⏳ 還原中…請勿關閉視窗」→ 完成 toast「✓ 還原完成」
- 拆分 `cloudRestoreSnapshot()` 成兩個內部函式：`_cloudDownloadParsedSnapshot()`（下載+解析）+ `_cloudApplyRestore()`（套用）
- 新增 stats 計算 helpers：`_cloudCalcStats()`（業主/案件/應收/已收 6 項統計）、`_cloudFormatNT()`、`_cloudStatsRow()`
- 新增 modal 控制：`cloudShowRestorePreviewModal()` / `cloudClosePreviewModal()` / `cloudConfirmRestore()` + `cloudPendingRestore` state

### snapshot 自動每日 + 分層保留 prune（α2-7b）
- 新增 `cloudEnsureDailyAutoSnapshot()`：檢查今天是否已有 auto snapshot，沒有就建一筆
  - 1 小時節流（避免每次 push 都 list snapshots）
  - 觸發點：`cloudInitTrackerFile()` 結尾、`cloudPushNow()` 成功後
- 新增 `cloudPruneSnapshots()`：分層保留 auto snapshot
  - 最近 7 天：全留
  - 7-30 天：每週留 1 筆（取該週最新）
  - 1-12 個月：每月留 1 筆
  - 12+ 個月：每年留 1 筆
  - **手動 snapshot 完全不動**（永久保留）
- 用 ISO week key 分桶（`_cloudIsoWeekKey()` helper）
- 限制：v3 純前端、沒後端排程，「使用者一週沒開 app」那週就沒 auto snapshot；snapshot 用途是「防搞砸還原」，可接受
- `ACTION_LABELS` 加 1 個新類型：`cloud-snapshot-prune`

### Drive snapshot 建立 + 列表 + 還原（α2-7a）
- App Folder 內每筆 snapshot 是獨立 .json 檔，命名 `snapshot-{ISO ts}-{auto|manual}[-{label}].json`
- 內容：`{ schemaVersion, snapshotMeta: {id, type, label, createdAt, deviceName}, data }`
- 新增 5 個核心函式：
  - `cloudCreateSnapshot(type, label)`：建立新 snapshot 檔
  - `cloudListSnapshots()`：列出所有 snapshot（用 `name contains "snapshot-"` query）
  - `cloudDownloadSnapshot(fileId)`：下載
  - `cloudRestoreSnapshot(fileId)`：**還原前自動建一筆「還原前-」的 manual snapshot 保險**；還原後立刻 push 到 tracker.json
  - `cloudDeleteSnapshot(fileId)`：刪檔（含 confirm）
- 新增 UI helpers：`cloudCreateManualSnapshot()` / `cloudRefreshSnapshotList()` / `cloudRestoreSnapshotConfirm()` / `_renderSnapshotItem()` / `_snapshotFormatBytes()`
- 設定頁新增「📦 備份歷史」卡片（折疊式，展開時自動載入列表）
  - 標籤 input + 「📦 建立備份」按鈕
  - 「🔄 重新整理列表」按鈕
  - 列表每筆：時間、type icon、label、size、還原 / 刪除按鈕
- `ACTION_LABELS` 加 3 個新類型：`cloud-snapshot-create`、`cloud-snapshot-restore`、`cloud-snapshot-delete`
- α2-7b 會接上自動每日觸發 + 分層保留 prune

### 立即同步按鈕 + 操作日誌埋點（α2-6）
- 新增 `cloudPullNow()`：使用者主動觸發「拉雲端最新 → 三方合併 → 衝突 modal（如有）」
- `🔐 Google Drive 同步` 卡片內已登入狀態加「🔄 立即同步」按鈕
- 解決多裝置場景：A 裝置改了東西並 push 後，B 裝置點立即同步就能拿到 A 的改動
- `ACTION_LABELS` 加 2 個新類型：`cloud-pull`、`cloud-pull-error`
- **idle 保護重新評估後跳過**：v3 push 是 event-driven（save() 觸發），沒操作就不會推；polling 多裝置同步是 α2-7+ 才需要的議題，alpha.2 用手動「🔄 立即同步」即足夠

### sync indicator 多態化（α2-5）
- top-bar `#sync-indicator` 從 alpha.1 的二態（已連線 / 未連線）升級為五態：
  - **未登入** → 灰 ○ 未連雲端
  - **已登入 + idle** → 綠 ✓ 已同步
  - **已登入 + pending** → 藍 ⌛ 待同步…（debounce 計時中，使用者連續編輯時）
  - **已登入 + syncing** → 藍 ⏳ 同步中…（API 進行中）
  - **已登入 + error** → 紅 ✗ 同步失敗（hover 看完整錯誤訊息）
- 新增 `cloudSyncStatus` / `cloudLastSyncError` 全域狀態變數
- 新增 `cloudSetSyncStatus(status, errMsg?)` helper（內部呼叫 `cloudUpdateSyncIndicator()` 重繪）
- `cloudSchedulePush()` 排程後 → `pending`
- `cloudPushNow()` 開始 → `syncing`；成功 → `idle`；失敗 → `error`
- hover tooltip 內含帳號 email + 最近錯誤訊息

### 真衝突 modal（α2-4b）
- 新增 `cloudResolveAndMerge({ remoteData, remoteMeta, fileId, trackerCreatedAt })`：拿到遠端資料後跑 `mergeStates()` 決定自動套用還是開 modal
  - 無衝突 → 直接 `applyTrackerData(merged)` + push + 更新 base snapshot
  - 有衝突 → 開 modal 收集使用者選擇
- 新增動態 modal（不動 index.html，純 JS 建 DOM）：
  - overlay + dialog，CSS variables 跟主題（含暗色模式）相容
  - 「全部用本機 / 全部用雲端」一鍵批次選擇
  - 每筆衝突顯示 type / id / 欄位 / 兩邊值，radio 選擇
  - 「套用解決」→ 依選擇覆寫 mergedTentative → applyTrackerData → push → 更新 base
  - 「取消」→ 關 modal，本次不上傳（本機資料維持原樣）
- `cloudInitTrackerFile()` Case C 改寫：
  - 有 last-synced 快照 → 走 `cloudResolveAndMerge()`
  - 沒快照（首次裝置 link）→ fallback 用 `prompt()` 三選一（沒有 base 不能合理合併）
- `ACTION_LABELS` 加 2 個新類型：`cloud-merge-clean`、`cloud-merge-resolved`
- 衝突描述輔助 helpers：`cloudDescribeConflict`、`cloudFormatValue`、`cloudEscapeHtml`

### 隱藏 v2 Apps Script 相關 UI（α2-Hide）
- 設定頁三張卡片加 `hidden` class，不再顯示給使用者：
  - `#card-cloud`：v2 雲端同步（Apps Script URL、Sheet URL、儲存、測試連線、每日凌晨強制 snapshot 設定）
  - `#card-calendar`：Google 行事曆（依賴 Apps Script 中介；ROADMAP 規畫之後用 OAuth 重寫）
  - `#card-portable`：跨裝置設定檔（含 Apps Script URL/token，v3 登入即同步不需要）
- 對應 JS 邏輯**保留不刪**（避免 v2 timer 跑到 undefined 函式報錯）；beta.1 才會徹底拆除
- v2 sync 預設 flag (`config.sheetSyncEnabled`) 為 false，使用者沒 UI 可開啟，所以 v2 timer 全部 no-op
- 如果之後想暫時還原任何一個區塊，把對應 div 的 `hidden` class 拿掉即可

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

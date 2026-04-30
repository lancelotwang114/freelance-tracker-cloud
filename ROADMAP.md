# Roadmap (v3 — Cloud)

> 從 v2.10.15 fork 出來重寫後端為 Google Drive App Folder。

## v3.7.0 ✅ Calendar 同步 UX 改造（2026-05-01）
- [x] Calendar 卡頂端加 master toggle（OFF 時整個設定區隱藏）
- [x] 登入後跳一次 prompt 介紹 Calendar 同步（`#cal-prompt-modal`）
- [x] 移除「自動 vs 手動」Step 4（啟用 = 一律自動）
- [x] config 加 `enabled` 欄位、移除 `autoSync` 欄位
- [x] cloudScheduleCalendarSync 條件改成 `cfg.enabled`
- [x] 操作日誌埋點 4 個（enable / disable / prompt-accept / prompt-dismiss）
- [x] bump 三處版本號 → `2026-05-01-v3.7.0` / `ftracker-cloud-v3.7.0`

## v3.6.4 ✅ 修行事曆 grid + 案件 modal 大改（2026-05-01）
- [x] 修行事曆 grid 排版（flex-wrap 取代 grid auto-fit、checkbox 寬度 override）
- [x] 案件 modal 拆 3 區（基本/金額/進度收款）
- [x] 折扣 / 子任務 / 收款狀況改 collapsible details（按案件資料自動展開）
- [x] 估價單從黃色 checkbox 搬到標題列 chip toggle
- [x] 已取消改低調灰底
- [x] modal 高度減約 30-40%
- [x] bump 三處版本號 → `2026-05-01-v3.6.4` / `ftracker-cloud-v3.6.4`

## v3.6.3 ✅ 行事曆縮小 + 工時計時器合併（2026-05-01）
- [x] 行事曆同步卡 cal-compact CSS（grid 分欄 + 4 step 縮 padding）
- [x] 行事曆建議區改 `<details>` 預設收摺
- [x] 案件 modal：工時 + 計時器合併單一區塊（保留手動輸入 + 計時器自動填）
- [x] 砍掉冗長提示文字
- [x] bump 三處版本號 → `2026-05-01-v3.6.3` / `ftracker-cloud-v3.6.3`

## v3.6.2 ✅ Reminder 改善 + 通知拒絕後引導（2026-04-30）
- [x] 通知與提醒改 grid 2-3 欄自適應、整體高度 -50%
- [x] 備份提醒加 checkbox toggle（cfg-alert-backup / config.enableBackupAlert）
- [x] 通知 denied 狀態自動顯示瀏覽器設定步驟（Chrome / Edge / Firefox / Safari）
- [x] Dashboard 近期案件不動（使用者要求保留）
- [x] bump 三處版本號 → `2026-04-30-v3.6.2` / `ftracker-cloud-v3.6.2`

## v3.6.1 ✅ Demo bug + UI 調整（2026-04-30）
- [x] 修：loadDemo 補 payments[]（已收款 4500 不再被算進待收款）
- [x] loadDemo 同步建一筆業主收款帳號（個人 / 王小明 / 玉山）
- [x] 收益範圍 label 視覺分組（label+select 包成 chip）
- [x] 通知與提醒卡片整體縮小（reminder-compact CSS、密度提高）
- [x] 設定頁拿掉常用/進階分類、雲端備份歷史搬到最下面
- [x] 強制刷新 icon 從 🔄 換成 ↻、右上 icon 統一 18px 放大
- [x] bump 三處版本號 → `2026-04-30-v3.6.1` / `ftracker-cloud-v3.6.1`

## v3.6.0 ✅ UI 簡化第二輪（2026-04-30）
- [x] 砍設定頁「🌗 顯示主題」卡（跟 top bar 重複）
- [x] 全域搜尋列改 collapsible（top bar 加 🔍 按鈕、Esc 關閉）
- [x] Dashboard 4 張 stat 卡可點擊跳轉案件 tab + 套對應 filter
- [x] Dashboard 完全空時顯示 hero empty state + 兩個 CTA
- [x] bump 三處版本號 → `2026-04-30-v3.6.0` / `ftracker-cloud-v3.6.0`

## 暫緩
- Task 6 案件列表緊湊模式
- Task 7 行事曆 legend 圖示化（討論中）
- Task 9 Dashboard 年度收入對比併進 Revenue
- Task 10 Top bar 「⋯」漢堡選單（先觀察 v3.6.0 已釋空間是否夠）

## v3.5.0 ✅ Revenue 子分頁 + 月度趨勢調整（2026-04-30）
- [x] Revenue 拆「總覽 / 趨勢 / 分析」3 子分頁
- [x] 月度業主彙整搬到總覽
- [x] 月度收益趨勢預設 6 個月（從 12 改）
- [x] 月度模式反轉順序（最近月在最左）
- [x] X 軸顯示 YYYY-MM 全文
- [x] 累計線 + 累計總額 label 配合反轉重新計算
- [x] 切子分頁時自動重繪該組圖表
- [x] bump 三處版本號 → `2026-04-30-v3.5.0` / `ftracker-cloud-v3.5.0`

## v3.4.0 ✅ UI 簡化（Top bar / 描述瘦身 / Settings collapsed）（2026-04-30）
- [x] Top bar 三按鈕精簡：刷新頁面 / 日誌 改 icon-only、主題改 「icon + 主題」
- [x] 設定頁全部 collapsed by default（card-myinfo 從 always-open 改成 collapsible）
- [x] Revenue 5 張卡刪除冗長描述
- [x] Drive 同步 / 備份 / 通知 / 行事曆 / 主題卡描述縮成半行
- [x] Revenue 5 張卡標題去裝飾性 emoji
- [x] bump 三處版本號 → `2026-04-30-v3.4.0` / `ftracker-cloud-v3.4.0`

## 暫緩（Task 2/3/5/8）
- Task 3 — Revenue 拆 3 子分頁（總覽 / 趨勢 / 分析）：已 mock 預覽，待決定
- Task 2 — Dashboard 4 stat 改 3 stat：待決定砍哪張
- Task 5 — 請款單 5 個狀態 checkbox 收進「進階篩選」
- Task 8 — 7 tabs 縮成 6（業主 → 案件子篩選）

## v3.3.1 ✅ 物理刪除 DEAD_BLOCK 純清理（2026-04-30）
- [x] 9 個 DEAD_BLOCK 區塊整段從 app.js 物理移除（健檢、Sheet 容量、settings 收款帳號 v2 UI、Lab mode、裝置名稱輸入 UI、GPS、裝置名稱提醒、sheet sync toggle stubs、snapshot diff modal）
- [x] 每塊換成單行 `// v3.3.1：xxx 已物理移除` 說明
- [x] 淨刪 566 行（8673 → 8107 非空行）
- [x] DEAD_BLOCK marker 全部清空、`/*` `*/` 平衡（各 2 個）
- [x] bump 三處版本號 → `2026-04-30-v3.3.1` / `ftracker-cloud-v3.3.1`

## v3.3.0 ✅ Dead code 二輪清 + 單筆 PDF 修圖（2026-04-30）
- [x] 修：`exportSingleJobPDF` 預先 await `cloudGetBankbookDataUrl` 拿 dataUrl，PDF 不再印 placeholder 文字
- [x] 修：`captureInvoiceCanvas` 改為 html2canvas 前 await `cloudHydrateBankbookImages()`
- [x] 單筆 PDF「原價」改成跟整單一致「單價 × 數量」
- [x] 刪 HTML：`#card-cloud` / `#card-portable` / `#health-modal` / `#snapshot-modal` / `#snapshot-diff-modal` / `#device-name-prompt-modal`
- [x] 包 DEAD_BLOCK 註解：資料健檢、Sheet 容量、settings 收款帳號 v2 UI、Lab mode、裝置名稱輸入 UI、GPS、裝置名稱提醒 modal、9 個 v2 deprecated stub
- [x] init 啟動腳本拿掉 `updateLabModeUI` / `maybeShowDeviceNamePrompt`
- [x] applyTrackerData 拿掉 `loadDeviceNameUI`（留 noop stub）
- [x] bump 三處版本號 → `2026-04-30-v3.3.0` / `ftracker-cloud-v3.3.0`

## v3.2.1 ✅ 請款單 UI 調整（2026-04-29）
- [x] 個人資訊從頂端搬到底部 3 欄並排（個人 / 匯款 / 發票）
- [x] 加 `showPersonalInfoOnTop` flag（頂端可選顯示精簡聯絡資訊）
- [x] 顯示 toggle 從 modal 搬到請款單外層快速控制
- [x] 加 `showInvoiceInfo` flag、隨後整批暫時隱藏（feature flag）
- [x] 上方欄位緊湊化（業主 + 範圍 第 1 列、收款帳號 第 2 列）
- [x] 修 select width:100% 跟 flex 衝突的擠出卡框問題
- [x] 請款範圍區間從月份 select 升級成日期 picker
- [x] 顯示狀態 preset 按鈕加 active 底色提示
- [x] 對帳模式才顯示狀態欄

## v3.2.0 ✅ 請款單重構（2026-04-29）
- [x] Schema v8 → v10：jobs 加 quantity；paymentAccount 合併個人 + 發票資訊
- [x] 案件表單：單價 × 數量 × 總金額 三欄聯動
- [x] 請款單版面：狀態欄移除、原價換成單價×數量、匯款+發票並排
- [x] paymentAccount.showPersonalInfo flag：可決定是否顯示個人資訊
- [x] 收款帳號 CRUD 從設定頁搬到請款單分頁（含完整 modal）
- [x] 設定頁「我的收款資訊」card 簡化成導引按鈕

## v3.1.0 ✅ Google Calendar 整合（2026-04-29）
- [x] AUTH_SCOPES 加 `calendar.events` + `calendar.readonly`
- [x] Calendar API Client 5 函式（list calendars / list events / create / update / delete）
- [x] Calendar Sync Layer：增量同步引擎、6 種事件類型建構、安全標記 ftSource
- [x] UI 重做（4 步驟設定，強制讓使用者選日曆，「外包」推薦提示）
- [x] 案件狀態 emoji + Calendar colorId（🔵🟡🔴🟢✅⚫️）
- [x] 取消案件同步、標題前綴「(已取消)」
- [x] 每日早報：自由選 HH:MM 時段、當日有事才建
- [x] 自動同步：save() 後 30 秒 debounce
- [x] 操作日誌：calendar-sync / calendar-sync-error

## v3.0.0-alpha.1 ✅ 完成（2026-04-29）
- [x] GCP Console OAuth Client ID 申請
- [x] Google Identity Services SDK 整合
- [x] 登入 / 登出 UI
- [x] 顯示登入帳號
- [x] 登入狀態持久化（重整不用重登）
- [x] top-bar sync indicator 接通
- [x] 操作日誌埋點（cloud-signin / cloud-signout）
- [x] 全域 localStorage / Service Worker cache 加 cloud- 前綴與 v2 完全隔離

## v3.0.0-alpha.2 ✅ 完成（2026-04-29）
- [x] Drive API client wrapper（α2-1）
- [x] 登入後自動初始化 tracker.json，含 metadata wrapper（α2-2）
- [x] 雙寫機制（debounce 2 秒）（α2-3）
- [x] 隱藏 v2 Apps Script 相關 UI（雲端同步卡 / 跨裝置設定檔 / Google 行事曆）（α2-Hide）
- [x] 三方合併引擎（base = last-synced snapshot；無衝突自動套用）（α2-4a）
- [x] 真衝突 modal（逐筆選擇本機 vs 雲端 + 全選按鈕）（α2-4b）
- [x] top-bar sync indicator 多態化（已同步 / 待同步 / 同步中 / 失敗）（α2-5）
- [x] 立即同步按鈕（多裝置主動拉取）+ 操作日誌埋點（α2-6）
- [x] Drive snapshot 建立 / 列表 / 還原（含「還原前先備份」保險）（α2-7a）
- [x] snapshot 自動每日 + 分層保留 prune（α2-7b）
- [x] 樂觀鎖：用應用層 metadata wrapper 的 version + lastModifiedAt（不依賴 Drive etag）

> **不在 alpha.2 範圍**：圖片遷移（base64 → Drive 個別檔）→ alpha.3；polling 多裝置 sync → 暫無計畫，靠手動「🔄 立即同步」

## v3.0.0-alpha.3 ✅ 完成（2026-04-29）
- [x] schema 升級 v7 → v8（SCHEMA_MIGRATIONS[7]、ensurePaymentAccounts 補 bankbookImageFileId 欄位）
- [x] Drive 圖片 API：driveUploadImage（multipart base64 編碼）+ driveDownloadImageAsDataUrl（blob → FileReader）
- [x] 上傳存摺照片 → 直接寫入 Drive App Folder 個別檔，tracker.json 只存 fileId（α3-2）
- [x] 既有 base64 dataURL 自動遷移：cloudMigrateBankbookImages，1 小時節流，cloudInitTrackerFile 結尾觸發（α3-4）
- [x] 顯示存摺照片：placeholder + data-bankbook-loading + sessionStorage 快取 + cloudHydrateBankbookImages 統一處理（α3-3）
- [x] 換照片 / 刪除帳號時清舊 Drive 孤兒檔（fire-and-forget driveDeleteFile）（α3-2）
- [x] 操作日誌：cloud-image-upload / cloud-image-delete / cloud-image-migrate（α3-2/4）

## v3.0.0-beta.1 ✅ 完成（2026-04-29）
- [x] 移除 v2 Apps Script 同步所有進入點（save() 內 schedulePush call、init 末段 pullFromSheet 啟動、setupAutoSave 內 sheet 段、online listener）
- [x] Stub 化 HTML onclick 用到的 v2 函式（pullFromSheet / pushToSheet / enableSheetSync / disableSheetSync / saveCalendarConfig / testCalendarConnection / syncCalendarNow / restoreSnapshot / exportSettings / importSettings）
- [x] localStorage 正式退化為純快取（概念落地；alpha.2/3 架構已是 Drive 為 source of truth）
- [-] dead code 暫留（setSyncStatus / schedulePush / 編輯鎖 / 行事曆事件建構等），所有 caller 都已切斷不會執行；v3.0.0 stable 再徹底移除

## v3.0.0 ✅ 正式 stable（2026-04-29）
- [x] 砍 ~700 行 v2 Apps Script dead code（setSyncStatus / 編輯鎖整套 / setupAutoPoll / showSnapshotList / 雲端優先模式 UI / Apps Script Calendar 整套 / maybeGenerateMonthlySnapshot 等）
- [x] 版本號 bump 三處（APP_VERSION / index.html meta / SW CACHE_VERSION）→ `2026-04-29-v3.0.0` / `ftracker-cloud-v3.0.0`
- [x] README 移除「實驗版警告」橫幅、改成穩定版描述
- [x] CHANGELOG 標 stable
- [-] HTML hidden 卡片暫留（#card-cloud / #card-calendar / #card-portable），對使用者透明、不影響運作；之後想徹底乾淨可手動砍

## 待保留功能（從 v2 沿用，邏輯不動）
- 案件 / 業主 CRUD
- 雙狀態（完成 / 收款）+ payments[] 多次部分收款
- 業主儲值制
- 請款單（多帳號 + 戶名 + 存摺照片）
- 行事曆檢視（單純前端顯示，不含 Apps Script 同步）
- 收益分頁與所有報表
- PWA + 暗色模式 + 操作日誌（含 alpha.1/2 新增的 14 種雲端 type）

## 之後可能評估
- Google 行事曆同步重寫（用 GIS OAuth 換掉 Apps Script，跟 v3 主同步邏輯共用 token）

## 暫不處理（評估後）
- 二代健保補充保費計算
- 多語系
- 報稅幫手
- polling 多裝置自動 pull（單人多裝置使用情境靠手動「🔄 立即同步」即足夠）

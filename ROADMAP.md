# Roadmap (v3 — Cloud)

> 從 v2.10.15 fork 出來重寫後端為 Google Drive App Folder。

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

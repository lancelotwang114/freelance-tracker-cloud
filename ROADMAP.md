# Roadmap (v3 — Cloud)

> 從 v2.10.15 fork 出來重寫後端為 Google Drive App Folder。

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

## v3.0.0-beta.1 — Drive 為主
- [ ] localStorage 退化為純快取
- [ ] 啟動必拉 Drive，沒網路用 cache
- [ ] 徹底移除 v2 Apps Script JS 邏輯（pollAppVersion / pushToSheet / pullFromSheet 等）
- [ ] 移除「跨裝置設定檔匯出 / 匯入」JS 邏輯（UI 已在 alpha.2 隱藏）
- [ ] 移除 Google 行事曆同步（依賴 Apps Script，UI 已隱藏；之後若要重做要走 OAuth）

## v3.0.0 — 正式 stable
- [ ] 完全移除 backend/ 相關引用
- [ ] CHANGELOG 標記 stable
- [ ] README 移除「實驗版警告」橫幅

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

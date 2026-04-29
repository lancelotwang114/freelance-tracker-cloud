# Freelance Tracker (Cloud)

**線上版（v3 / Cloud）：** https://lancelotwang114.github.io/freelance-tracker-cloud/
**穩定版（v2 / Apps Script）：** https://lancelotwang114.github.io/freelance-tracker/

> WARNING：實驗版 — Google Drive App Folder 後端開發中（alpha.2 為止已可實際使用）
>
> - 穩定版（v2.10.x，Apps Script + Google Sheet）：[freelance-tracker](https://github.com/lancelotwang114/freelance-tracker)
> - 本版本目標：完全去除 Apps Script，純前端 + Drive API 直接同步，使用者門檻從 30 分鐘部署降到 10 秒登入
> - alpha 期間建議：v3 跟 v2 的瀏覽器資料完全隔離（localStorage 加 `cloud-` 前綴、SW cache 獨立命名空間），可同時開兩邊不互相影響；正式資料還是建議放 v2 直到 v3.0.0 stable

## 跟 v2 的差異

| 項目 | v2 (Apps Script) | v3 (Drive) |
|------|------|------|
| 後端 | 自架 Apps Script + Google Sheet | 無，純前端直接打 Drive API |
| 認證 | 自訂 token + URL（要自己貼） | Google Identity Services（一鍵登入） |
| 跨裝置同步 | 需要貼 API URL + token | 同 Google 帳號自動同步 |
| 設定門檻 | 約 30 分鐘部署 Apps Script | 10 秒（點 Google 登入授權） |
| 衝突處理 | ABC 三選一 modal | 三方合併引擎 + 真衝突逐筆挑 |
| 存摺照片 | base64 in Sheet | alpha.3 起：Drive 個別檔，tracker.json 只存 fileId |
| snapshot | Apps Script 排程 + Sheet 行 | App Folder 個別 .json 檔，client-side 觸發 |

## 路線圖

| 階段 | 內容 | 狀態 |
|------|------|------|
| v3.0.0-alpha.1 | Google 登入 / 登出 / 持久化 / sync indicator / 跟 v2 完全隔離 | ✅ 完成（2026-04-29） |
| v3.0.0-alpha.2 | Drive 雙寫（debounce）、三方合併、衝突 modal、indicator 多態化、立即同步、snapshot 雲端化 + 自動每日 + 分層保留、隱藏 v2 Apps Script UI | ✅ 完成（2026-04-29） |
| v3.0.0-alpha.3 | 存摺照片從 base64 遷移成 Drive 個別檔（schema 升 v8）+ 自動遷移 + 快取 + 孤兒清理 | ✅ 完成（2026-04-29） |
| v3.0.0-beta.1 | localStorage 退化純快取、徹底移除 v2 Apps Script JS 邏輯 | 待辦 |
| v3.0.0 | 正式 stable，移除「實驗版」警告 | 待辦 |

完整版本歷史看 [CHANGELOG.md](./CHANGELOG.md)，alpha.3 之後的計畫看 [ROADMAP.md](./ROADMAP.md)。

## 技術概覽

- **檔案結構**：index.html / css/style.css / js/app.js / service-worker.js / manifest.json — 五個檔，不再拆
- **第三方依賴**：html2canvas、jsPDF、Google Identity Services SDK，其他一律不加
- **Drive scope**：`openid email profile drive.appfolder`（drive.appfolder 不含 userinfo 權限）
- **同步策略**：每次 `save()` debounce 2 秒推 Drive；多裝置主動點「🔄 立即同步」拉雲端
- **樂觀鎖**：tracker.json metadata wrapper 自記 `version + lastModifiedAt`（不依賴 Drive etag）
- **衝突解決**：三方合併（base = last-synced snapshot）+ 真衝突逐筆 modal
- **本機隔離**：所有 localStorage key 加 `cloud-` 前綴，SW cache 名 `ftracker-cloud-vX.Y.Z`

## Cloud Layer 結構（alpha.2 為止）

`js/app.js` 從上而下分四個雲端相關區塊：

1. **☁️ Cloud Auth Layer**：GIS 登入流程、token 持久化、sync indicator 控制
2. **☁️ Drive API Client**：純 fetch wrapper，封裝 list / get / download / create / update / delete
3. **☁️ Drive Sync Layer**：tracker.json 雙寫、三方合併、衝突 modal、立即同步、snapshot 全套
4. **v2 setSyncStatus short-circuit**：v3 已登入時讓 v2 timer 退讓，避免 indicator 閃爍

## 開發 / 測試

- 本機：`python -m http.server 8080`（`http://localhost:8080`）或 VS Code Live Server（`http://127.0.0.1:5500`）
- 兩個本機 origin 都已加進 GCP「已授權的 JavaScript 來源」白名單
- 部署：push 到 `main` 自動觸發 GitHub Pages，1~2 分鐘後 https://lancelotwang114.github.io/freelance-tracker-cloud/ 生效

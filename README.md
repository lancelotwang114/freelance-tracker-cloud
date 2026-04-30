# Freelance Tracker (Cloud)

**線上版（v3 / Cloud）：** https://lancelotwang114.github.io/freelance-tracker-cloud/

> 純前端、用 Google 帳號登入 → 資料自動同步到你自己的 Google Drive App Folder。
> 一個人接案的收益與排程管理工具，從 v2.10.x（Apps Script + Sheet）演化而來。

## 跟 v2 (穩定版 Apps Script) 的差異

| 項目 | v2 (Apps Script) | v3 (Drive) |
|------|------|------|
| 後端 | 自架 Apps Script + Google Sheet | 無，純前端直接打 Drive API |
| 認證 | 自訂 token + URL（要自己貼） | Google Identity Services（一鍵登入） |
| 跨裝置同步 | 需要貼 API URL + token | 同 Google 帳號自動同步 |
| 設定門檻 | 約 30 分鐘部署 Apps Script | 10 秒（點 Google 登入授權） |
| 衝突處理 | ABC 三選一 modal | 三方合併引擎 + 真衝突逐筆挑 |
| 存摺照片 | base64 in Sheet（每次同步都傳） | Drive 個別檔，tracker.json 只存 fileId |
| snapshot | Apps Script 排程 + Sheet 行 | App Folder 個別 .json 檔，client-side 觸發 |

> v2 穩定版仍維護中：[freelance-tracker](https://github.com/lancelotwang114/freelance-tracker) ([線上版](https://lancelotwang114.github.io/freelance-tracker/))
> 兩版瀏覽器資料完全隔離（localStorage 加 `cloud-` 前綴、SW cache 獨立命名空間），同 origin 也不會互相影響。

## 路線圖

| 階段 | 內容 | 狀態 |
|------|------|------|
| v3.0.0-alpha.1 | Google 登入 / 登出 / 持久化 / sync indicator / 跟 v2 完全隔離 | ✅ 完成（2026-04-29） |
| v3.0.0-alpha.2 | Drive 雙寫、三方合併、衝突 modal、立即同步、snapshot 雲端化 | ✅ 完成（2026-04-29） |
| v3.0.0-alpha.3 | 存摺照片從 base64 遷移成 Drive 個別檔（schema 升 v8） | ✅ 完成（2026-04-29） |
| v3.0.0-beta.1 | 移除 v2 Apps Script 同步進入點、stub HTML onclick 函式 | ✅ 完成（2026-04-29） |
| **v3.0.0** | **正式 stable，砍 dead code、版本號歸正** | ✅ **完成（2026-04-29）** |
| **v3.1.0** | **Google Calendar 整合（直接打 Calendar API、6 種事件、增量同步）** | ✅ **完成（2026-04-29）** |
| **v3.2.0** | **請款單重構（單價 × 數量、狀態欄隱藏、發票資訊並排、收款帳號合併個人資訊 + CRUD 搬到請款單）** | ✅ **完成（2026-04-29）** |
| **v3.2.1** | **請款單 UI 調整（個人資訊 3 欄底部、區間日期 picker、preset active 視覺、發票功能暫時隱藏）** | ✅ **完成（2026-04-29）** |
| **v3.3.0** | **Dead code 二輪清（刪 6 個 HTML 卡片/Modal + 約 350 行 JS）+ 單筆請款 PDF 存摺照片修復** | ✅ **完成（2026-04-30）** |
| **v3.3.1** | **物理刪除 9 個 DEAD_BLOCK 區塊（淨刪 566 行 JS，純清理 commit）** | ✅ **完成（2026-04-30）** |
| **v3.4.0** | **UI 簡化（Top bar 精簡、設定頁全 collapsed、卡片描述瘦身、Revenue emoji 去裝飾）** | ✅ **完成（2026-04-30）** |
| **v3.5.0** | **Revenue 拆 3 子分頁（總覽/趨勢/分析）+ 月度趨勢預設 6 個月、最近月在左、X 軸 YYYY-MM** | ✅ **完成（2026-04-30）** |
| **v3.6.0** | **UI 第二輪（砍主題卡、搜尋列收 collapsible、Dashboard stat 可點跳轉、empty state 引導）** | ✅ **完成（2026-04-30）** |
| **v3.6.1** | **修 Demo 計算 bug、Demo 加收款帳號、Reminder 縮小、設定頁拉平、刷新 icon 換 ↻** | ✅ **完成（2026-04-30）** |
| **v3.6.2** | **Reminder 改 grid 自適應分欄、備份提醒加 toggle、通知 denied 引導改善** | ✅ **完成（2026-04-30）** |
| **v3.6.3** | **行事曆同步卡 grid 分欄縮小、案件 modal 工時+計時器合併成一行** | ✅ **完成（2026-05-01）** |
| **v3.6.4** | **修行事曆 grid 排版 + 案件 modal 分區重排、折扣/子任務/收款 collapsible、估價單搬到標題** | ✅ **完成（2026-05-01）** |
| **v3.7.0** | **Calendar 同步 UX：master toggle + 登入後跳 prompt + 拿掉自動 vs 手動** | ✅ **完成（2026-05-01）** |
| **v3.8.0** | **提醒類型矩陣（9×2 channel）：通知/Calendar 整合一張卡、immediate save、Calendar 卡精簡** | ✅ **完成（2026-05-01）** |
| **v3.8.1** | **UI 字眼統一「Google 行事曆」+ master OFF 時 reminder 卡的行事曆欄 disable** | ✅ **完成（2026-05-01）** |

完整版本歷史看 [CHANGELOG.md](./CHANGELOG.md)。

## 技術概覽

- **檔案結構**：index.html / css/style.css / js/app.js / service-worker.js / manifest.json — 五個檔，不再拆
- **第三方依賴**：html2canvas、jsPDF、Google Identity Services SDK，其他一律不加
- **Drive scope**：`openid email profile drive.appfolder`（drive.appfolder 不含 userinfo 權限）
- **同步策略**：每次 `save()` debounce 2 秒推 Drive；多裝置主動點「🔄 立即同步」拉雲端
- **樂觀鎖**：tracker.json metadata wrapper 自記 `version + lastModifiedAt`（不依賴 Drive etag）
- **衝突解決**：三方合併（base = last-synced snapshot）+ 真衝突逐筆 modal
- **本機隔離**：所有 localStorage key 加 `cloud-` 前綴，SW cache 名 `ftracker-cloud-vX.Y.Z`

## Cloud Layer 結構（js/app.js 內）

從上而下分四個雲端相關區塊：

1. **☁️ Cloud Auth Layer**：GIS 登入流程、token 持久化、sync indicator 控制
2. **☁️ Drive API Client**：純 fetch wrapper，封裝 list / get / download / create / update / delete + 圖片上下傳
3. **☁️ Drive Sync Layer**：tracker.json 雙寫、三方合併、衝突 modal、立即同步、snapshot 全套、存摺圖片遷移
4. **既有 v2 業務邏輯**：案件 / 業主 CRUD、請款單、行事曆檢視、收益分頁、操作日誌等（從 v2.10.15 沿用）

## 開發 / 測試

- 本機：`python -m http.server 8080`（`http://localhost:8080`）或 VS Code Live Server（`http://127.0.0.1:5500`）
- 兩個本機 origin 都已加進 GCP「已授權的 JavaScript 來源」白名單
- 部署：push 到 `main` 自動觸發 GitHub Pages，1~2 分鐘後 https://lancelotwang114.github.io/freelance-tracker-cloud/ 生效

## License

個人專案，不含營利性使用授權。

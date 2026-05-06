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
| **v3.9.0** | **業主 detail 頁（CRM-lite）：4 stat + 通訊錄 + 12 月趨勢 + 智慧分析 + 案件時間軸** | ✅ **完成（2026-05-01）** |
| **v3.10.0** | **全局計時器：top bar 常駐 + 跨會期 persist + 跨案件自動切換 + 結束加到工時** | ✅ **完成（2026-05-01）** |
| **v3.11.0** | **達成率 + 預測 + 智慧分析（月/年目標進度條、線性預測、5 種 actionable 提示）** | ✅ **完成（2026-05-01）** |
| **v3.12.0** | **請款單歷史 + status 追蹤：每次匯出留紀錄、5 種狀態、一鍵重發、Drive 同步** | ✅ **完成（2026-05-01）** |
| **v3.13.0** | **看板模式 + 拖曳改狀態：4 column drag-drop、視圖切換 toggle、響應式** | ✅ **完成（2026-05-01）** |
| **v3.14.0** | **標籤系統升級：業主+案件 multi-tag chip 介面、共用標籤池、向下相容單字串 tag** | ✅ **完成（2026-05-01）** |
| **v3.15.0** | **Undo 撤銷系統：8 秒內可一鍵復原刪除/批次操作（toast 含進度條）** | ✅ **完成（2026-05-01）** |
| **v3.16.0** | **Undo v2：multi-step stack（30 步）+ Ctrl+Z/Cmd+Z + Redo + 操作日誌** | ✅ **完成（2026-05-01）** |
| **v3.17.0** | **暗色主題微調 + Quick Add 工具列（FAB 改圓形 ＋ + popup menu）** | ✅ **完成（2026-05-01）** |
| **v3.18.0** | **案件分組視圖：依日期 / 業主 / 狀態 / 標籤 group header（僅列表模式）** | ✅ **完成（2026-05-01）** |
| **v3.19.0** | **行事曆拖曳改日期（單天案件 + 跨天案件 endDate 同步保持期間長度）** | ✅ **完成（2026-05-01）** |
| **v3.20.0** | **手機案件 row 滑動快速 action（左滑標完成、右滑標收款，純 native touch）** | ✅ **完成（2026-05-01）** |
| **v3.21.0** | **5 種視圖（完整/緊湊/報表/卡片/看板），預設報表，hover quick action，點業主色塊跳業主** | ✅ **完成（2026-05-01）** |
| **v3.21.1** | **加 PolyForm Noncommercial 1.0.0 授權保護（LICENSE / 4 檔 copyright / console banner / PDF metadata）** | ✅ **完成（2026-05-01）** |
| **v3.22.0** | **範例資料大改：6 業主 / 35 案件 / 3 收款帳號 / 跨 14 個月，新使用者一載入就看到所有功能** | ✅ **完成（2026-05-01）** |
| **v3.22.1** | **自動化 v2→v3 匯入：自動帶收款帳號 + 通知偏好 + schema migration + 存摺照片遷移** | ✅ **完成（2026-05-01）** |
| **v3.22.2** | **Google token silent refresh：過期前 5 分鐘自動續約，使用者無感（不再每 1 小時要重登）** | ✅ **完成（2026-05-01）** |
| **v3.22.3** | **同步指示燈升級：顯示版本號 v#N + 相對時間（30 秒前 / 5 分前），每 30s 自動 tick** | ✅ **完成（2026-05-01）** |
| **v3.22.4** | **Bug fix：月度趨勢漏當月（slice(-n) → 以當月為終點往前 N 個月）+ 實收 / 分潤沒先扣折扣 + 拿掉業主分享連結按鈕** | ✅ **完成（2026-05-01）** |
| **v3.22.5** | **折扣全面巡修：8 大類算錯點全對齊（儲值餘額、月度堆疊圖、批次合計、5 個提醒卡、5 個通知 / Calendar 描述、單價趨勢、時薪統計）** | ✅ **完成（2026-05-01）** |
| **v3.22.6** | **收益頁兩個 widget 統一改 job-centric：選 4 月就只看 4 月案子，partial paid 也正確算進已收** | ✅ **完成（2026-05-02）** |
| **v3.22.7** | **🚨 Hotfix：案件 modal「儲存」按了沒反應（getCurrentTimerMs 不存在 → ReferenceError）** | ✅ **完成（2026-05-02）** |
| **v3.22.8** | **月度趨勢回時間順序（最右是當月）+ 達成目標卡改 toggle（設定頁→顯示偏好，預設 OFF）** | ✅ **完成（2026-05-02）** |
| **v3.22.9** | **Top bar 加 Google 帳號 pill（頭像 + 名字 + 光暈狀態）+ sync 文字簡化（拿掉 v#N，只留時間）** | ✅ **完成（2026-05-05）** |
| **v3.22.10** | **Token refresh 5 道防護（解決分頁休眠導致 1-2 hr 被登出）：啟動主動 refresh + 三事件觸發 + 失敗 retry + 不清 state + Pill 智慧重連** | ✅ **完成（2026-05-05）** |
| **v3.23.0** | **🤖 Mascot 小幫手：右下浮動 + 12 種事件觸發鼓勵文字 + 個人化命名 + 30s 防擾 cooldown（純 inline SVG，零依賴）** | ✅ **完成（2026-05-05）** |

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

本專案採用 **[PolyForm Noncommercial License 1.0.0](./LICENSE)** 授權。

- ✅ **允許**：個人使用、學習、研究、修改、Pull Request 貢獻
- ✅ **允許**：非營利組織、教育機構、政府機構使用
- ❌ **禁止**：任何商業用途，包括但不限於：
  - 販售本專案或衍生作品
  - 公司 / 工作室內部使用本專案管理業務
  - 嵌入收費產品 / SaaS hosting
  - 任何意圖獲利的使用情境

**商業授權**請至 [GitHub repo](https://github.com/lancelotwang114/freelance-tracker-cloud) 開 issue 洽詢書面授權。

著作權所有 © 2026 lancelotwang114
完整授權條款見 [LICENSE](./LICENSE)。

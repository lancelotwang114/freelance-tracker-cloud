# v3 Cloud 版緣起與決策摘要

> 這份文件記錄 freelance-tracker 從 v2.10.x（Apps Script 後端）演化成 v3 Cloud（Google Drive 後端）的對話脈絡與決策理由。上傳到 Claude Project 當知識檔，未來協作時 Claude 會有完整背景。
>
> **建立日期：2026-04-27**

## 一、v3 起點

從 freelance-tracker v2.10.15 fork 出來。完整 v0.1 → v2.10.15 的演進歷程記錄在原 repo（freelance-tracker）的 `claude-project/02_conversation_summary.md`，本檔僅記錄「為什麼要做 v3、要怎麼做」。

## 二、v2 的痛點

v2 雖然功能完整，但「跨裝置同步」要求使用者：

1. 自己開 Google Sheet
2. 跟著 `backend/SETUP.md` 部署 Apps Script
3. 改 `API_TOKEN` 變數、跑 `initSheets`、`testWrite`、`testRead`
4. 設定為 Web App、抓 URL
5. 把 URL + token 貼回 APP

整套流程約 30 分鐘，流程任何一步出錯就卡死。對使用者，門檻太高；對作者（james），每次 Apps Script 改動都要請使用者重貼程式碼。

## 三、v3 方向選擇

評估過三個方案：

| 方案 | 後端 | 結論 |
|------|------|------|
| A | Google Drive App Folder（純前端） | ✅ 採用 |
| B | Apps Script + Google OAuth（你架後端） | 仍要維護 Apps Script，且 Google 帳號 SPOF + 配額連坐 |
| C | Firebase / Supabase | 違反「不上 BaaS」紅線，跳過 |

**選擇 A 的理由：**

- 0 後端維護
- 資料 100% 在使用者自己 Drive，作者完全看不到
- 升級 schema 只改前端 `runMigrations()` 即可
- 設定門檻從 30 分鐘 → 10 秒（點 Sign in with Google）

## 四、技術決策

| 面向 | 決策 |
|------|------|
| 前端 | Vanilla HTML / CSS / JS（沿用 v2，保持單純） |
| 認證 | Google Identity Services（GSI），scope = `drive.appfolder` |
| 後端 | 無，直接呼叫 Google Drive API v3 |
| 資料儲存 | App Folder 內一份 `tracker.json` |
| 圖片 | 存摺照片獨立成 Drive 個別檔案，`tracker.json` 只存 fileId |
| 同步策略 | Drive 為 source of truth，localStorage 退化為快取 |
| 部署 | GitHub Pages（lancelotwang114.github.io/freelance-tracker-cloud/） |

## 五、從 v2 沿用的東西（不重新發明）

- `runMigrations(state)` schema 升級框架
- `lastModifiedAt` 比對 + 衝突保護 ABC 機制
- Snapshot 分層保留邏輯（改成在 App Folder 建多個歷史檔）
- idle 保護 / `pollAppVersion` / 編輯鎖（鎖改用 Drive ETag 樂觀鎖）
- 所有業務邏輯（案件 / 業主 / 請款單 / 行事曆 / 報表 / 操作日誌）

## 六、v3 要新寫的東西

- Google Identity Services 接通（`https://accounts.google.com/gsi/client`）
- Drive API v3 client wrapper（取代 v2 的 `pushToSheet` / `pullFromSheet`）
- App Folder 自動初始化（首次登入無 `tracker.json` → 建空白）
- 圖片獨立檔案策略（base64 → Drive fileId）

## 七、v3 要移除的東西

- `backend/` 整個資料夾（Apps Script 相關全砍）
- `backend/SETUP.md`、`backend/CALENDAR-SETUP.md`
- 「跨裝置設定檔匯出 / 匯入」整個功能（登入即同步，不需要）
- 「自訂 token + Apps Script URL」設定 UI
- iCal 訂閱（v2 已隱藏；v3 直接砍）

## 八、開發路線

| 階段 | 目標 |
|------|------|
| v3.0.0-alpha.1 | GCP OAuth Client ID + GIS 登入 / 登出 UI |
| v3.0.0-alpha.2 | Drive 雙寫期（local + Drive） |
| v3.0.0-beta.1 | Drive 為主，local 退化為快取 |
| v3.0.0 | 完全移除 backend，正式取代 v2 |

## 九、跟 v2 的明確切割

| 項目 | v2 | v3 |
|------|------|------|
| repo | lancelotwang114/freelance-tracker | lancelotwang114/freelance-tracker-cloud |
| 本機路徑 | D:\lab\GITHUB\TASK\freelance-tracker | D:\lab\GITHUB\TASK\freelance-tracker-cloud |
| 部署 | lancelotwang114.github.io/freelance-tracker/ | lancelotwang114.github.io/freelance-tracker-cloud/ |
| Claude Project | freelance-tracker（舊） | freelance-tracker-cloud（這個） |

兩 repo 完全獨立，commit history 不互通。v2 修的小 bug 若也想進 v3，需手動 cherry-pick。

## 十、給 Claude（你）的提醒

- 回答、UI、註解一律繁體中文
- 改完檔案後給一行短 commit message：`vX.Y.Z: 中文短語1, 中文短語2`
- 版本 bump 三處：`js/app.js` APP_VERSION + `index.html` meta + `service-worker.js` CACHE_VERSION
- public repo，禁止把個資 / 帳號 / token / 真實業主資料寫進檔案或 commit
- 重大變動先問再做，用 AskUserQuestion 給 2~4 個選項
- 不要在 v3 動到 v2 那個 repo
- 不要重新引入 Apps Script
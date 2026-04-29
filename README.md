# Freelance Tracker (Cloud)

> WARNING: 實驗版 — A 方案 Google Drive 後端開發中。
>
> - 穩定版（v2.10.x，Apps Script 後端）：[freelance-tracker](https://github.com/lancelotwang114/freelance-tracker) ([線上版](https://lancelotwang114.github.io/freelance-tracker/))
> - 本版本目標：完全去除 Apps Script，改用 Google Drive App Folder 當後端
> - 開發中切勿用於正式資料；請先到穩定版匯出 JSON 備份後再來測試

## 路線圖

| 階段 | 內容 | 狀態 |
|------|------|------|
| v3.0.0-alpha.1 | Google Identity Services 登入流程接通 | 進行中 |
| v3.0.0-alpha.2 | Drive App Folder 雙寫期（local + Drive 同步） | 待辦 |
| v3.0.0-beta.1 | Drive 為主，local 退化為快取 | 待辦 |
| v3.0.0 | 移除所有 Apps Script 相關程式碼，正式取代 v2 | 待辦 |

## 跟 v2 的差異

| 項目 | v2 (Apps Script) | v3 (Drive) |
|------|------|------|
| 後端 | 自架 Apps Script + Google Sheet | 無，純前端 + Drive API |
| 認證 | 自訂 token | Google Identity Services |
| 跨裝置同步 | 需貼 URL + token | 同 Google 帳號自動同步 |
| 設定門檻 | 約 30 分鐘 | 10 秒（點 Google 登入） |

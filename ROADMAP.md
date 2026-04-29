# Roadmap (v3 — Cloud)

> 從 v2.10.15 fork 出來重寫後端為 Google Drive App Folder。

## v3.0.0-alpha.1（進行中）
- [ ] GCP Console OAuth Client ID 申請
- [ ] Google Identity Services SDK 整合
- [ ] 登入 / 登出 UI
- [ ] 顯示登入帳號

## v3.0.0-alpha.2 — Drive 雙寫期
- [ ] Drive App Folder 自動建立 tracker.json
- [ ] 同步邏輯：localStorage + Drive 雙寫
- [ ] lastModifiedAt 比對 + 衝突處理
- [ ] 從現有 Apps Script 同步邏輯搬：snapshot 分層保留、idle 保護、操作日誌

## v3.0.0-beta.1 — Drive 為主
- [ ] localStorage 退化為純快取
- [ ] 啟動必拉 Drive，沒網路用 cache
- [ ] 移除「跨裝置設定檔匯出 / 匯入」（登入即同步）
- [ ] 移除「自訂 token + URL」設定 UI

## v3.0.0 — 正式取代 v2
- [ ] 完全移除 backend/ 相關引用
- [ ] CHANGELOG 標記 stable

## 待保留功能（從 v2 沿用，邏輯不動）
- 案件 / 業主 CRUD
- 雙狀態（完成 / 收款）+ payments[] 多次部分收款
- 業主儲值制
- 請款單（多帳號 + 戶名 + 存摺照片）
- 行事曆
- 收益分頁與所有報表
- PWA + 暗色模式 + 操作日誌
- Google Calendar 同步（用 OAuth 換掉 Apps Script 中介）

## 暫不處理（評估後）
- 二代健保補充保費計算
- 多語系
- 報稅幫手

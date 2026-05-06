# 版本更新歷史

## v3.23.2 — Mascot 5 狀態 + 嘴巴表情切換（純 CSS，零依賴）（2026-05-05）

> 採納 user 提案的 5 狀態系統（idle/loading/thinking/success/error），但**不引入 Lottie**（違反專案無依賴規則），改用純 CSS animation + SVG path swap 達到 80% 視覺效果。

### 5 狀態 × 4 嘴巴

| 狀態 | CSS 動畫 | 嘴巴 | 光暈 | 觸發時機 |
|---|---|---|---|---|
| `idle` | 上下浮動（mascotIdleBob，3s） | 😊 笑 | 預設陰影 | 預設 / 暫態結束後 |
| `loading` | 左右搖擺（mascotSwing，1.2s） | 😐 一條線 | 預設 | 同步中 (sync syncing/pending) |
| `thinking` | 歪頭（mascotTilt，2s） | 😐 一條線 | 預設 | 啟動時有逾期未收款 |
| `success` | 跳起 + 縮放（mascotJumpGlow，0.8s） | 😄 大笑 | 綠色光暈 | 完成案件 / 收款 / 達標 |
| `error` | 左右震動（mascotShakeError，0.5s） | 😟 反向弧 | 紅色光暈 | 同步失敗 / 取消案件 |

### API
```js
mascotSetState('success');   // 切狀態，success/error 自動 2.5 秒回 idle
mascotSetMouth('big');       // 單獨換嘴巴（極少用，state 會自動帶）
```

### 自動連動
- **mascotSay(eventType)** → 對應事件自動 `mascotSetState`：
  - `job-done / job-paid / job-fully-paid / goal-reached-monthly` → success
  - `app-startup-overdue` → thinking
  - `job-cancel` → error
  - 其他 → idle（不動）
- **cloudSetSyncStatus** → 同步狀態自動聯動：
  - syncing/pending → loading
  - error → error
  - error 恢復 idle → success（短暫慶祝）

### 設定頁
🤖 小幫手 card 加「預覽狀態」5 個按鈕，點任一個立刻看 mascot 反應，方便調整 / 自訂時測試。

### 為什麼不用 Lottie
專案規則「依賴允許清單：html2canvas / jsPDF / GIS SDK，其他一律不加」。Lottie 是 ~150KB lib + 5 個 JSON 檔，違反規則。改用純 CSS + SVG path swap 達 80% 視覺效果，0 KB 額外依賴。

---

## v3.23.1 — Mascot 移到左下避開 FAB + 換新版 SVG（2026-05-05）

### 修 bug
- Mascot 從右下 (bottom:20 right:20) 改成**左下** (bottom:20 left:20)
- FAB 新增鈕在右下 → 不再被擋住
- 對話框箭頭從右側改成左側（指向左下角的 mascot）
- 手機 media query 也對齊改成 `left`

### 換 SVG 素材
- 用 user 提供的新版 `Mascot/0949.svg`（多了「手臂」造型，更立體可愛）
- viewBox 從 220×220 改 240×240
- 各部位加 id（body/face/eyes/mouth/arms/legs/buttons），未來方便用 CSS class 切換表情 / 狀態

---

## v3.23.0 — 🤖 小幫手 Mascot（2026-05-05）

> 右下角浮動小機器人，事件發生時跳鼓勵文字。可愛 + 鼓勵風格，強化使用者連結。

### 功能
- **位置**：右下角固定 64×64 px（手機 52×52 px），`position: fixed`，z-index 9990
- **動畫**：CSS-only，啟動緩慢上下浮動（`mascotIdleBob`），觸發時抖動（`mascotShake`）
- **對話框**：圓角白底 + 主色邊框 + 三角箭頭，`mascotBubbleIn` 彈跳進入動畫
- **5 秒自動消失**，點 ✕ 也可手動關
- **點 mascot 本身** → 隨機說一句招呼

### 12 種觸發事件
| Event | 例句 |
|---|---|
| `job-create` | 「又有案件囉～」「新挑戰，加油！」 |
| `job-done` | 「完成一筆，做得好！」「Done！下一個」 |
| `job-paid` | 「收到錢錢囉 開心」「叮，入帳！」 |
| `job-fully-paid` | 「結清了！這筆完美收尾」 |
| `client-create` | 「新業主加入，加油！」 |
| `job-delete` | 「不要了？掰掰～」 |
| `goal-reached-monthly` | 「🎯 月目標達標了，你是神！」 |
| `app-startup-overdue` | 「有人欠你錢喔，記得催一下」 |
| `app-startup-quiet` | 「好久不見，最近還好嗎？」（30% 機率隨機打招呼） |
| `timer-start/stop` | 「開始計時，專注！」「辛苦了，喝口水」 |
| `streak-3` | 「3 連發，狀態爆棚！」（保留給未來連擊偵測） |
| `idle-greeting` | 「我在這 ~」「叫我做什麼？」（點 mascot 本身觸發） |

### 防擾人
- **同類事件 30 秒 cooldown**：避免短時間連續 spam
- 對話框 5 秒消失
- 設定頁可一鍵關閉

### 個人化
- 設定頁 → 🤖 小幫手 card：
  - **啟用 toggle**（預設 ON）
  - **取個名字**（最多 8 字）→ 訊息會自動加前綴「小機：完成一筆…」
  - **試試看 ▶** 按鈕：隨機隨機 demo 一句

### 技術
- **零外部依賴**：純 inline SVG（user 提供素材）+ CSS animations
- **沒用 Lottie**：避免引入額外 ~150KB lib
- **觸發點**：在 saveJob / saveClient / deleteJob / mascotInit 共加 ~10 行 trigger code

### Schema 沒變動
- 新增 `config.mascotEnabled`（預設 true）
- 新增 `config.mascotName`（預設 ''）
- 不影響舊資料 / 不需 migration

---

## v3.22.10 — Token silent refresh 5 道防護（解決分頁休眠導致 1-2 hr 被登出）（2026-05-05）

> User 反映「Google 帳號每 1-2 小時被登出」。根因：Chrome Tab Discarding / Edge Sleeping Tabs / 電腦睡眠會讓 setTimeout 停擺，silent refresh 沒準時跑，token 過期後 silent refresh 又因 Google session 也失效而 fail。加 5 道防護。

### 5 道防護

**1. App 啟動時主動 refresh**
- 過去：cloudInitGoogleAuth → restored → 排 setTimeout 等 5 分鐘前 refresh
- 現在：若 token 剩不到 30 分鐘 → 立刻 refresh，不等 setTimeout

**2. 三事件並用觸發 refresh check**
- `visibilitychange` → 切回前景
- `focus` → 視窗從別 app/tab 切回（比 visibility 更早觸發）
- `pageshow` (event.persisted) → BFCache 恢復、休眠喚醒
- 任一事件觸發都檢查 token 並必要時 refresh

**3. 失敗 retry 1 次**
- silent refresh fail → 5 秒後 retry 1 次
- 仍 fail → 進入「需 user 重登」狀態

**4. 失敗時不清 cloudAuthState**
- 過去：silent refresh fail → toast → user 等於被登出（accessToken 過期 → API call 失敗）
- 現在：state 維持「已登入」UI，但 sync indicator 變紅光暈
- User 體驗：頭像光暈紅 = 連線出問題，但帳號資訊還在；點頭像直接觸發重登（不用走設定頁）

**5. Pill click 智慧路由**
- 已登入 + sync error → 點頭像直接呼叫 cloudSignIn() 重新拿 token
- 其他情況 → 跳設定頁

### 強化的 console log（F12 可看）
```
[cloud-auth] schedule next refresh in 55 min
[cloud-auth] focus → token expiring (3min left), refresh now
[cloud-auth] silent refresh starting…
[cloud-auth] silent refresh ok, next refresh in ~ 55 min
[cloud-auth] silent refresh retry #1 in 5s
[cloud-auth] silent refresh failed after retries: ...
```
若再次發生被登出，F12 看 console 可查到實際 fail 原因。

### 不做的事（沒辦法做）
- ❌ 把 access token 延長到 7/30 天 — Google 強制 1 hr
- ❌ 換 refresh token 機制 — 純前端做不到（需後端 + Client Secret）

---

## v3.22.9 — Top bar 加 Google 帳號 pill + 同步狀態簡化（2026-05-05）

### 1. Top bar 新增 Google 帳號 pill
- 已登入 → 顯示「頭像 + 名字（first name）」pill
- 未登入 → 顯示「＋ 登入」灰色 placeholder
- 點擊 → 跳設定頁的「Google 登入」card
- 名字取空白前段（"James Wang" → "James"），沒名字用 email 前綴
- 沒大頭照 → 顯示首字母（"J"）

### 2. 頭像光暈反映同步狀態
- 綠色光暈 → 已同步（synced）
- 藍色光暈 → 同步中 / 推送中（syncing / pending）
- 紅色光暈 → 同步失敗（error）
- 灰色框 → 未連雲端 / 未登入（idle）
- 粗光暈：`box-shadow: 0 0 0 2px [color], 0 0 8px [color@55%]`

### 3. Sync indicator 文字簡化
- **拿掉版本號 v#N**（user 反映「v#2」沒意義）
- 主顯示只剩時間 / 狀態：
  - 改前：`✓ v#7 · 30 秒前`
  - 改後：`✓ 30 秒前同步`
  - pending 改前：`⌛ v#7 → 推送…` → 改後：`⌛ 推送中…`
  - error 改前：`✗ v#7（同步失敗）` → 改後：`✗ 同步失敗`
- 版本號 `#N` 搬到 hover title（debug 仍可看到）
- 時間從未同步過 → 顯示「✓ 已連線」

### 4. 響應式
- 手機（< 480px）→ pill 只剩頭像光暈，名字隱藏
- 桌面 → 頭像 + 名字並列

### 工程量
- HTML: 加一個 div
- CSS: 加 ~50 行（pill 樣式 + 4 種狀態光暈 + media query）
- JS: 改 cloudUpdateSyncIndicator + 新增 cloudRenderAccountPill 共 ~50 行

---

## v3.22.8 — 月度趨勢回時間順序 + 達成目標卡 toggle（2026-05-02）

### 1. 月度收益趨勢順序統一
- 改前（v3.5.0）：月度模式反轉成「最近月在最左」，年度模式維持「舊→新」
- 改後：兩種模式都統一**時間順序**（最舊在左、**最新在右 = 當月**）
- drawRevChart 拿掉 `isMonthReversed` flag，displayData 直接用 data

### 2. 「達成目標 + 智慧分析」改 toggle 控制
- 設定頁加新卡片「🎨 顯示偏好」
- 內含 toggle：「📊 顯示收益目標達成率卡片」（預設 OFF）
- ON：在收益總覽顯示原本的達成目標 + 智慧分析卡
- OFF（預設）：整張卡隱藏，使用者要設目標時再來開
- 即時生效：toggle 一切換 → 立刻 hide/show，不用刷新

### 影響
- 新使用者登入：看不到還沒設定的目標卡，畫面更乾淨
- 老使用者已設過目標 → toggle 預設 false，會看到卡片消失，需要去設定→顯示偏好打開

---

## v3.22.7 — 🚨 Hotfix：案件 modal「儲存」按了沒反應（2026-05-02）

### 症狀
案件編輯 modal 按「儲存」沒有任何反應，modal 不關、不存資料、沒 toast。

### 根因
`saveJob()` line 9668 呼叫 `getCurrentTimerMs()`，但這個函式不存在 — 正確名字是 `getActiveTimerMs()`（v3.10.0 全局計時器引入時改的）。執行到這行就 ReferenceError，後面所有程式碼（save、closeJobModal、render、toast）全部不執行 → 表現為「沒反應」。

bug 推測在 v3.10.0 引入全局計時器時函式被改名，但 saveJob 內的呼叫沒同步更新，潛伏到現在。

### 修法
- 修正函式名：`getCurrentTimerMs()` → `getActiveTimerMs()`
- 補語意：只在「該案件正是 active timer」時取最新累計值（含進行中 session）；其他情況維持既有 `j.timeSpentMs`（避免把舊計時數據意外清成 0）

---

## v3.22.6 — 收益頁兩個 widget 統一改 job-centric（2026-05-02）

> 「選 4 月就只看 4 月案子」— 期間總收入 / 已收 / 待收 / 月度業主彙整全部按**案件所屬月** (`jobBelongMonth`) 歸類，不再用 payment 日期歸月。

### 修了什麼

**1. renderRevenue 的 buckets 邏輯**（line 6078-6093）
- 改前：payment 用 `payment.date` 歸月、unpaid/pending 用 `j.date` 歸月（混合邏輯）
- 改後：通通用 `jobBelongMonth(j)` (`endDate || date`)
- 已收：該案件所有 payment 加總（不論 payment.date）
- 待收 / 進行中：未收餘額（已扣折扣 + 已收 + 呆帳）

**2. renderMonthlyReport 月度業主彙整**（line 6857-6862）
- 改前：用 `j.paid` boolean 一刀切，partial paid 整筆被丟進「待收」
- 改後：partial 也算進「已收」(`jobPaidTotal × ratio`)，剩餘按 `j.done` 分到 待收 / 進行中

### 影響
- 4 月案件如果還沒收 partial → 月度彙整「已收 NT$0」+ 期間總收入「已收 NT$0」（一致）
- 4 月案件已收訂金 9000，待收 9000 → 兩邊都顯示「已收 NT$9,000、待收 NT$9,000」（一致）
- 3 月案件 4 月才收尾款 → 不會出現在 4 月「已收」（屬於 3 月案件）

### 兩 widget 對齊驗證
- 期間總收入 = 月度業主彙整 (paidNet + unpaidNet + pendingNet)
- 已收款 = 月度業主彙整「已收」合計
- 待收款 = 月度業主彙整「待收」合計
- 進行中（沒在期間總收入顯示，但內部一致）

---

## v3.22.5 — 折扣全面巡修：8 大類算錯點全部對齊（2026-05-01）

> 全面審視 `+j.amount` 的所有 callsite，把「該扣折扣的全部用 `jobFinalAmount(j)` / 該算待收的用 `jobUnpaidAmount(j)`」一次清乾淨。

### 修正清單（8 類 / 約 14 個 callsite）

| # | 位置 | 改動 |
|---|---|---|
| 1 | `clientBalance()` 業主儲值已用 | `+j.amount` → `jobFinalAmount(j)` |
| 2 | Dashboard 月度堆疊圖 | paid: `jobFinalAmount` / pending: `jobUnpaidAmount`（partial paid 也精確） |
| 3 | Dashboard 批次模式合計 | `+j.amount` → `jobFinalAmount(j)` |
| 4 | 批次標收款 modal「合計」 | `+j.amount` → `jobFinalAmount(j)` |
| 5 | 提醒卡 5 處（逾期 / 完成已久 / 月底 / 請款日 / 拖款） | 逾期用 `jobFinalAmount`，其餘 4 個用 `jobUnpaidAmount`（待收） |
| 6 | Calendar event + 通知描述 5 處 | 早報用 `jobFinalAmount`，拖款 / unpaid-long 用 `jobUnpaidAmount`（待收） |
| 7 | 業主健康度單價趨勢 | 近 6 個月 vs 前 6 個月用 `jobFinalAmount` 才是實際單價 |
| 8 | 月度時薪統計 + 整體時薪 | `+j.amount / hours` → `jobFinalAmount / hours` 才是實領時薪 |

### 沒動的（語意上 j.amount = 原價，本來就對）
- 月度報表的 `r.gross` 欄位（標明「原始金額」）
- 請款單 `grossTotal`（原價合計欄）
- 請款單「單價 = amount / quantity」（折扣有獨立欄）
- 案件編輯 modal 的「金額」input（本來就是原價）
- 操作日誌 / snapshot 紀錄（凍結當下原價）

### 灰色地帶（先不動，看設計意圖）
- 行事曆 chip / 案件搜尋結果 row 顯示金額
- 通知 / 早報的「金額：」欄（user 確認後可再調）

---

## v3.22.4 — Bug fix：月度趨勢漏當月、實收沒套折扣、拿掉業主分享連結按鈕（2026-05-01）

### 🐛 修 bug 1：月度收益趨勢沒從當月開始
- **症狀**：今天是 2026-05，但「最近 6 個月」顯示 2025-11 ~ 2026-04，不含 5 月
- **原因**：`displayKeys = filled.slice(-n)` 是「**有資料**的最近 N 個月」。當月若沒任何 payment / 案件，filled 不含當月就被漏掉
- **修法**：改成「以**當月**為終點往前推 N 個月」，無論該月是否有資料都顯示（沒資料就顯示 NT$0 的 bar）
- **影響範圍**：年度模式不受影響（原本邏輯就正確）

### 🐛 修 bug 2：實收 / 分潤計算沒先扣折扣
- **症狀**：月度報表底部「實收」總計、業主貢獻排行、Tag 派圖、熱圖等地方的金額偏高，沒考慮折扣
- **原因**：`jobNetAmount(j)` 是 `j.amount * (1 - rate)`，**用了原始金額而非折扣後金額**
- **修法**：
  - `jobNetAmount` 改用 `jobFinalAmount(j) * (1 - rate / 100)`（先扣折扣再算分潤）
  - `jobCommission` 同步調整成 `jobFinalAmount - jobNetAmount`（基準對齊）
- **連動修正**：所有用到 net / commission 的地方自動正確（總共約 12 個 callsite）

### 🗑️ 業主頁「複製分享連結」按鈕拿掉
- **理由**：v3 用 Drive App Folder（私有），URL 帶 `?client=xx` 給其他人開只會看到空 app
- **動作**：刪掉按鈕 + 清掉 `copyShareLink` 函式（dead code）
- **保留**：`enterClientMode` + URL `?client=xx` 路由仍在（自己當快速 bookmark 還能用，只是不再有 UI 入口）
- 真的要做業主端分享請看 BACKLOG「業主入口升級」設計（涉及 Drive public link + token，工程量較大）

---

## v3.22.3 — 同步指示燈加版本號 + 相對時間（2026-05-01）

> 右上角同步指示燈從「✓ 已同步」升級成「✓ v#7 · 30 秒前」，可一眼看出目前 Drive 上是哪個版本、多久前同步的。

### 改動
- **idle 狀態**：「✓ 已同步」→「✓ v#7 · 30 秒前」（已同步過的話）
- **pending 狀態**：「⌛ 待同步…」→「⌛ v#7 → 推送…」（從目前版本準備推下一版）
- **error 狀態**：「✗ 同步失敗」→「✗ v#7（同步失敗）」（清楚顯示卡在哪版）
- **hover title**：多 2 行 — 「版本：v#7」+「最後同步：2026-05-01 14:23:45（30 秒前）」
- **每 30 秒自動 tick**：相對時間「30 秒前」會自動跳成「1 分前」、「5 分前」…
- **visibilitychange 補刀**：分頁從背景切回前景立刻刷新 indicator（瀏覽器壓制 setInterval 時的補救）

### 資料來源
- 版本號：`cloudGetMeta().lastSyncedVersion`（每次成功推 Drive 自增的 wrapper.version）
- 時間：`cloudGetMeta().lastSyncedAt`（每次成功推 Drive 同步寫入的 ISO timestamp）
- 兩個欄位早就在 alpha.2 階段就寫好，只是之前沒拿出來顯示

### 相對時間規則
| 距離 | 顯示 |
|---|---|
| < 10 秒 | 剛剛 |
| 10 秒 ~ 1 分 | N 秒前 |
| 1 分 ~ 1 小時 | N 分前 |
| 1 小時 ~ 1 天 | N 小時前 |
| 1 天 ~ 7 天 | N 天前 |
| 超過 7 天 | M/D（直接日期） |

---

## v3.22.2 — Google token silent refresh（2026-05-01）

> 解決使用者每 1 小時要重新登入的痛點。token 過期前 5 分鐘自動背景續約，使用者無感。

### 問題背景
GIS（Google Identity Services）隱式流發出的 access token 一律 1 小時過期，且**不發 refresh token**。原本的處理：過期就要使用者點「使用 Google 登入」重來。長時間使用體驗不好。

### 解決方案
利用 GIS `tokenClient.requestAccessToken({ prompt: '' })` 機制：只要 Google session（瀏覽器有登入 Google）還在，這個呼叫就能拿到新 token、不會跳同意畫面。我們在 token 過期前 5 分鐘自動跑一次。

### 實作要點
- **`_scheduleSilentRefresh()`**：用 setTimeout 在 `tokenExpiresAt - 5 分鐘` 排程下一次 refresh
- **`_silentRefresh()`**：呼叫 tokenClient 拿新 token，設 `_isSilentRefreshing = true` 區分手動 vs 背景
- **`cloudOnTokenResponse` 雙模式**：
  - 手動登入：完整流程（userinfo + tracker.json init + calendar prompt）
  - 背景 refresh：只更新 token + 持久化 + 排下一次（不重抓 userinfo / 不彈 calendar prompt）
- **錯誤處理分流**：手動失敗 → alert（會打斷）；背景失敗 → toast（不打擾，提示需要重登）
- **visibilitychange listener**：分頁從背景切回前景時，檢查 token 剩餘時間。背景太久 setTimeout 可能被瀏覽器壓制，靠這個補刀
- **登入後 + 從 localStorage 還原後**都自動排程 refresh

### 操作日誌
- `cloud-token-refresh`（背景續約成功）— 跟 `cloud-signin`（手動登入）區分

### 使用者體驗變化
- **改善前**：每 1 小時 sync 失敗 → 點「使用 Google 登入」 → 重新跳授權確認 → 繼續用
- **改善後**：完全無感，只要瀏覽器還有 Google session 就一直能用；session 過期時跳 toast 提示

### 邊界情境
- Google session 過期（使用者登出 Google / 切帳號）→ silent refresh 失敗 → toast 提示重登（資料不會丟，本機 cache 還在，下次手動登入即恢復）
- 撤銷 app 授權 → 同上
- 完全離線 → silent refresh 會失敗，但本機資料還能讀 / 編輯（cache 模式）

---

## v3.22.1 — 自動化 v2 → v3 匯入（2026-05-01）

> 改 importData 函式，從 v2 匯出的 JSON 中**自動帶入收款帳號 + 通知偏好 + 跑 schema migration + 觸發存摺照片遷移**。使用者搬遷時間從 10-15 分縮成 3-5 分。

### 自動處理的 7 件事
1. **state.clients**：補 v11 contact{} + v13 tags[] 預設值
2. **state.jobs**：補 v9 quantity / v13 tags[] / v6 payments[]（從舊 paid:true + paidAt 自動轉換）
3. **state.invoiceHistory**：v2 沒有時補空陣列
4. **config.userInfo**：top-level 個人資訊（name/phone/email/invoiceTitle 等）
5. **config.userInfo.paymentAccounts**：v2 簡單版自動 mapping 到 v3 完整版
   - v3 完整身分欄位（name/phone/email/invoiceTitle/taxId/address/invoiceNote）從 top-level userInfo 補
   - showPersonalInfo / showPersonalInfoOnTop / showInvoiceInfo 套預設值
   - bankbookImage（base64）保留、bankbookImageFileId 等遷移後填
6. **通知與提醒**：11 個欄位（4 個天數 + 7 個 enable*Alert）自動複製
7. **schema migration**：自動跑 runMigrations + ensurePaymentAccounts

### 自動觸發的事
- **存摺照片 base64 → Drive App Folder 個別檔**：cloudMigrateBankbookImagesCheckedAt 重置 + 立刻跑（已登入 Google 才會執行）
- **Drive 同步 push**：save() 後 debounce 推上去

### 故意不 import 的東西
- v2 的 sheetConfig / calApiUrl / calApiToken / autoPollEnabled 等 Apps Script 中介設定 — v3 直接打 Drive / Calendar API，這些欄位無意義
- Google 行事曆設定（calId 等）— 兩套機制完全不同，無法 mapping，仍要使用者手動

### confirm 對話框升級
- 列出將自動處理的 4-5 樣東西
- 顯示來源 schema 版本 + 將升級到的目標版本
- 顯示是否含存摺照片要遷移
- 比對日期警告（保留現有邏輯）

### Toast 升級
- 顯示完整摘要：「✓ 已匯入：業主 N 位 · 案件 N 筆 · 收款帳號 N 個 · N 項偏好」

### 文件更新
- `IMPORT_FROM_V2.md` 改：Phase 5 從「5 大手動補設定」縮成「2 個無法自動的」（Calendar + 業主標籤）
- 提示時間從「10-15 分」改成「3-5 分」
- Phase 4「刷新讓 migration 跑」標註已不需要

### 操作日誌
- 改 `data-import-from-v2` 為通用的 `data-import`，含 sourceVersion + 各種 count

### Bump
- APP_VERSION → `v3.22.1`
- SW CACHE_VERSION → `v3.22.1`

---

## v3.22.0 — 範例資料大改（豐富 + 跨年度 + 多收款帳號）（2026-05-01）

> 從 6 筆案件 / 1 收款帳號擴充到 35 筆 / 6 業主 / 3 收款帳號 / 跨 14 個月，新使用者「載入範例」就能看到所有功能的實際呈現。

### 6 個業主（不同類型 + contact + tags 完整）
- **A 媒體公司**（VIP / 長期 / 月結 25 日）— 每月固定大案
- **B 電商品牌**（電商 / 頻繁下單）— 廣告 / EDM 為主
- **C 設計工作室**（同行 / 外包 / 潛在）— overflow 案
- **D 出版社**（月刊 / 長期）— 每月固定
- **E 個人客戶**（一次性 / 個人）— logo / 名片
- **F 政府單位**（政府 / 拖款 / 大金額）— 公文週期 60-90 天
- 每位業主含 contact{ person, phone, email, address } + tags[]
- billingDay 設定（A: 25, D: 25, F: 15）

### 3 個收款帳號
- **個人**：王小明（無發票）— 預設選定
- **工作室**：王小明設計工作室（含統編 12345678 + 二聯式發票）
- **公司**：小明創意有限公司（含統編 87654321 + 三聯式發票）
- 不同銀行（玉山 / 玉山 / 台新）展示多帳號切換

### 35 筆案件（跨 14 個月）
- **過去 14、12、9、6、3 個月** — 已收清的歷史紀錄（讓報表 / 業主 detail 分析有資料）
- **上月** — 完成已收 / 完成未收 / 完成已久未收（觸發拖款警告）
- **本月** — 各種狀態混合（已收、待收、進行中、部分收款、折扣、跨天、取消）
- **未來** — 進行中 / 待開始 / **估價單模式** 案件

### 涵蓋的所有功能展示
| 功能 | 範例案件 |
|------|---------|
| 部分收款 | 雙12 主視覺（已收訂金 50%） |
| 折扣 | FB 即時廣告 -15% |
| 已取消 | 六月廣告（撤案） |
| 跨天案件 | 季刊跨頁專題排版（5 天工期） |
| 估價單 | Q4 廣告整體規劃 |
| 工時填寫 | 多筆含 hoursWorked，讓時薪報告有資料 |
| 大金額 | 政府年度報告 NT$120,000 / 政府活動 KV NT$45,000 |
| 小額 | 同行外包 NT$1,500 |
| 業主集中度 | A + B 客戶占大宗，觸發智慧分析警告 |

### 載入後立即可見的功能展示
- **業主 detail 頁**：每位業主有累計收入 / 平均收款週期 / 12 月趨勢 mini chart / 智慧分析提示
- **收益分頁**：月度收益趨勢有過去 14 個月真實資料、達成率有可預測曲線、智慧分析有觸發提示
- **看板模式**：4 column 各有案件
- **緊湊 / 報表 / 卡片**：30+ 筆資料密度感
- **請款單**：3 個收款帳號可切換、單筆有完整內容
- **行事曆**：本月密集、可拖曳改日期

### Bump
- APP_VERSION → `v3.22.0`
- SW CACHE_VERSION → `v3.22.0`

---

## v3.21.1 — 加 PolyForm Noncommercial 授權保護（2026-05-01）

> 從「個人專案，不含營利性使用授權」（含糊聲明）升級成正式法律授權。明確禁止任何商業用途。

### 法律層
- 加 `LICENSE` 檔（PolyForm Noncommercial 1.0.0 全文 + Required Notice）
- README 「License」段重寫，列出明確的允許 / 禁止用途清單
- 商業授權聯繫管道：GitHub repo issue

### 程式碼層著作權聲明
- `js/app.js`、`css/style.css`、`service-worker.js`、`index.html` 全部頂端加 `/*!  ... */` copyright header
- `index.html` `<head>` 加 `meta[name=author]` / `copyright` / `license` 三個 meta tag
- 所有檔頭含 LICENSE 連結 + 中英雙語警示

### 啟動 console banner
- 每次開頁 console 印藍色 banner：「© 2026 lancelotwang114 · Licensed under PolyForm Noncommercial 1.0.0」
- 包含 GitHub repo 連結 + 中英雙語商用禁止警示

### PDF metadata 嵌入著作權
- `exportInvoicePDF` / `exportSingleJobPDF` 兩個函式加 `pdf.setProperties({ author, creator, keywords, ... })`
- 任何匯出的 PDF 在 PDF reader 「文件屬性」內可看到作者跟著作權聲明
- keywords 欄含「PolyForm Noncommercial 1.0.0; Commercial use prohibited」

### 嚇阻效果
- GitHub repo 頁面會自動偵測 LICENSE 並顯示「PolyForm Noncommercial」徽章
- 任何想 fork 商用的人會看到清楚警告
- 違規時可透過 GitHub DMCA 流程下架對方 repo
- 法律訴訟時有明確授權合約可依憑

### Bump
- APP_VERSION → `v3.21.1`
- SW CACHE_VERSION → `v3.21.1`

---

## v3.21.0 — 5 種視圖切換（緊湊 / 報表 / 卡片 / 看板 / 完整）（2026-05-01）

> 案件分頁從 2 種視圖（列表/看板）升級成 5 種，預設改報表模式。每種視圖都共享：點業主色塊跳業主 detail、hover 出現快速 action（✓/$/編輯）、手機滑動標完成/收款。

### 5 種視圖
- 📋 **完整**（comfort，舊 'list'）：每筆 ~80px，含完整 metadata
- 📑 **緊湊**（compact，新）：每筆 ~30px 一行解決，密度提升 3 倍
- 📊 **報表**（table，新，**v3.21.0 新預設**）：spreadsheet 表格，含 sticky header
- 🎴 **卡片**（card，新）：grid 排列，響應式
- 🗂️ **看板**（board）：4 column drag-drop（不變）

### 視圖切換 UI
- 從文字 toggle button 改成 5 個 icon button（📋📑📊🎴🗂️）
- 每個 button 有 title tooltip 說明
- localStorage `cloud-ftJobsView_v1` 持久化（舊 'list' 自動轉成 'comfort'）

### 各視圖共享的互動
- **點 row** → 開啟編輯 modal
- **點業主色塊** → 跳業主 detail（v3.9.0 整合）
- **hover** → 右側出現 quick action ✓ 完成 / $ 收款 / ✏️ 編輯
- **手機滑動**（v3.20.0 整合）：左滑完成、右滑收款
- **state 顏色** → row 邊框 / 背景依狀態（綠/黃/灰）

### 報表模式特色
- `<table>` 結構，欄位真對齊
- thead sticky top（滾動時表頭固定）
- 7 欄：日期 / 業主 / 標題 / 標籤 / 金額 / 狀態 / 動作
- 響應式：≤700px 藏標籤欄、≤540px 藏動作欄
- status badge 風格（成 / 黃 / 灰 pill）

### 緊湊模式特色
- grid 結構：`12px dot | 50px date | flex title | client | amount | status`
- 每筆只 6-8px padding，月底對帳超流暢
- 配合 v3.18 分組視圖：依日期/業主/狀態/標籤 group header + sticky

### 卡片視圖特色
- `repeat(auto-fill, minmax(220px, 1fr))` grid
- 寬螢幕 4-5 個一排、手機 1-2 個
- 卡片含：業主色塊 + 日期 + 標題 + 業主名 + tags + 金額 + quick action

### 分組支援
- 完整 / 緊湊：兩種視圖支援分組（依日期/業主/狀態/標籤）
- 報表 / 卡片：暫不支援（避免 spreadsheet 拆開來變奇怪）
- 看板：本身就是分組（依狀態 column），不需另外分組
- 切到不支援分組的視圖時自動隱藏分組選單

### Bump
- APP_VERSION → `v3.21.0`
- 預設 view → 'table'（新使用者 / localStorage 沒值）

---

## v3.20.0 — 手機滑動快速 action（2026-05-01）
- 案件 row 左滑 → 標完成；右滑 → 標收款（自動補餘額 payment）
- 純 native touch event，沒加任何依賴
- 桌面點擊不受影響（只在 touch 裝置觸發）
- 滑動視覺：row 跟手位移最多 ±100px、背景漸層提示「✓ 完成」/「$ 收款」
- 動作觸發前先 pushUndoSnapshot，誤觸 Ctrl+Z 即可復原
- `touch-action: pan-y` 允許縱向 scroll 不被攔截
- APP_VERSION → `v3.20.0`

## v3.19.0 — 行事曆拖曳改日期（2026-05-01）
- cal-chip 加 draggable + cal-cell 加 ondragover/drop
- 拖曳單天案件到別格 → 自動更新 j.date
- 跨天案件同步移 endDate（保持期間長度）
- 跨天案件本身的 spans cell 不允許拖（避免歧義，要拖請拖第一個 cell）
- 操作日誌 `job-cal-drag`、含 from/to 日期
- 自動 pushUndoSnapshot，誤拖 Ctrl+Z 即可復原
- APP_VERSION → `v3.19.0`

## v3.18.0 — 案件分組視圖（2026-05-01）
- 案件列表加分組選單：不分組 / 依日期（年月）/ 依業主 / 依狀態 / 依主標籤
- 每組顯示 group header（標題 + 筆數 + 金額小計）+ sticky top
- 分組偏好 persist 在 localStorage
- 看板模式不適用分組（僅列表模式生效）
- APP_VERSION → `v3.18.0`

## v3.17.0 — 暗色微調 + Quick Add 工具列（2026-05-01）
- **暗色主題微調**：純黑 `#0f1115` 改深灰 `#1a1d23`，跟 macOS / iOS 一致
  - bg / card / muted / border / *-light 全部微調
  - 避免 OLED 對比過強，看久眼睛不累
- **Quick Add 工具列**：FAB 從「文字按鈕」改成「圓形 ＋ + popup menu」
  - 點 ＋ → 浮現 4 個選項：新增案件 / 新增業主 / 開始計時 / 編輯最近一筆
  - 旋轉 ✕ icon 動畫 + slide-up 動畫
  - 點外面自動 close
  - 設定/收益/請款分頁仍隱藏（這些頁通常不會新增）
- APP_VERSION → `v3.17.0`

## v3.16.0 — Undo v2（multi-step + Ctrl+Z + redo）（2026-05-01）
- 從 v3.15 的單一 snapshot 升級成 stack（最多 30 步）
- 加 redoStack：Ctrl+Shift+Z 可重做之前的 undo
- 加 Ctrl+Z / Cmd+Z 鍵盤快捷鍵
  - input/textarea/select/contenteditable 內讓瀏覽器原生 undo 處理
  - modal 開時不攔截
- snapshot 永久保留（不再 8 秒過期）
- 新動作會清空 redoStack（避免奇怪狀態）
- 操作日誌：每次 push / undo / redo 都記，可追蹤誰做了什麼
- toast 顯示「✓ XXX  [↶ 復原] 1/30」帶 stack depth 提示
- APP_VERSION → `v3.16.0`

---

## v3.15.0 — Undo 撤銷系統（2026-05-01）

> 任何破壞性動作（刪除案件 / 業主 / 批次操作）後 8 秒內可一鍵復原。State snapshot-based 實作，簡單可靠。

### 核心機制
- 全域 `undoState = { snapshot, label, timer }`
- 動作前 `pushUndoSnapshot('label')` → 把 `state.clients` + `state.jobs` 整個 deep clone（不含 invoiceHistory，避免拖慢）
- 動作後 toast 出現「✓ XXX [↶ 復原]」+ 8 秒倒數進度條
- 點復原 → restore state、save、render
- 後續任何別的破壞性動作會覆蓋舊 snapshot
- 8 秒到期自動 clearUndo

### Toast UI 升級
- 加 `.toast--undo` 修飾類：寬 280px、含 ↶ 復原按鈕、底部 3px 進度條
- 進度條從 100% → 0% width transition 8 秒，視覺倒數
- 復原按鈕半透明白底、hover 變實
- 點復原按鈕 → call `performUndo()` → 還原 state + 寫回 + render + 顯示「✓ 已復原」toast

### 6 個動作接 undo
- `deleteJob`（刪單筆案件）
- `deleteClient`（刪業主 + 該業主所有案件）
- `bulkDelete`（批次刪案件）
- `bulkMarkDone`（批次標完成）
- `dashBulkMarkDone`（dashboard 批次標完成）
- `dashBulkMarkCancelled`（dashboard 批次取消）

### bulkDelete 簡化二次確認
- 5 筆以下：只要 1 個 confirm（有 undo 接住，不需 prompt 輸入確認）
- 6 筆以上：保留原有的「輸入確認刪除」嚴格驗證
- toast 提示「8 秒內可復原」

### 沒在這版做（留之後）
- toggleDone / togglePaid 加 undo（這些頻繁操作，加 undo 會 toast 滿天飛）
- 編輯欄位的 undo（要 deep diff state 才有意義）
- Ctrl+Z 鍵盤快捷鍵（要先有命令面板架構）
- Multi-step undo stack（目前是單層，最近一個動作）

### 操作日誌
- 加 `undo` type（成功復原時記錄）

### 版本 bump
- APP_VERSION → `2026-05-01-v3.15.0`
- SW CACHE_VERSION → `ftracker-cloud-v3.15.0`

---

## v3.14.0 — 標籤系統升級（業主 + 案件 multi-tag）（2026-05-01）

> 業主可打多標籤、案件 tag 從單字串升級成 multi-tag、共用標籤池 + 自動建議。

### Schema migration v12 → v13
- 業主加 `tags: string[]`（預設空）
- 案件加 `tags: string[]`（migration 把舊 `tag` 字串自動補到 `tags[0]`）
- **保留舊 `j.tag` 欄位**，所有 caller 仍可讀（向下相容）
- 新 caller（jobRow / filter / suggestions）優先讀 `tags`、fallback `tag`

### 業主 detail 頁加標籤編輯區
- 新增「🏷️ 標籤」card 在通訊錄上方
- chip 介面：每個 tag 是 pill + ✕ 移除按鈕
- 輸入框 + ＋ 按鈕新增（Enter 也可）
- datalist 自動建議全部用過的標籤（業主 + 案件共用標籤池）
- 立即 save、無需按儲存

### 業主列表 row 顯示 tags
- 業主名右邊接迷你 tag chip badges（藍色背景、11px）

### 案件 modal tags 改 multi
- 原本單一 `<input id="job-tag">` 改成「chip 顯示區 + 輸入框 + ＋ 按鈕」
- modalJobTags 全域 state 管理當前 modal 內 tag list
- saveJob 寫入 `j.tags = [...modalJobTags]`，同時把 `j.tag = modalJobTags[0] || ''` 維持相容
- editJob / openJobModal 載入時還原 modalJobTags

### 案件列表 / 看板顯示多 tag badges
- jobRow 的 tagBadge 從單一 chip 改成多 chip（依 tags[] 全列）
- 看板卡片同樣支援（透過 jobRow 重用）

### filter chip 列共享標籤池
- `getUsedTags()` 升級：包含案件 multi-tag + 舊單字串 tag + 業主 tag（待後續加進業主分頁 filter）
- filter 比對升級：`j.tags.includes(filter)` OR `j.tag === filter` 都算 hit

### 工程量取捨（沒在這版做）
- **業主分頁 tag filter chip 列**：留待 v3.14.1
- **標籤統計分頁**：留待 v3.14.1
- **業主 client modal 內加 tags 編輯**：detail view 已可編輯，modal 內暫不重複（避免 UI 衝突）
- **標籤顏色 / 預定義列表**：留待之後（自由輸入已堪用）

### 版本 bump
- APP_VERSION → `2026-05-01-v3.14.0`
- SW CACHE_VERSION → `ftracker-cloud-v3.14.0`
- CURRENT_SCHEMA_VERSION → 13

---

## v3.13.0 — 看板模式 + 拖曳改狀態（2026-05-01）

> 案件分頁加「列表 / 看板」視圖切換。看板模式可以直接拖卡片改狀態（完成 / 收款 / 取消），改變 4 個 column 之間的歸屬即時更新。

### 視圖切換 toggle
- 案件分頁頂端加 pill toggle「📋 列表 / 🗂️ 看板」
- 選擇 persist 在 localStorage `cloud-ftJobsView_v1`
- 切到看板時暫時隱藏批次按鈕（看板用拖曳取代批次）

### 看板模式 4 column
- **🔄 進行中**（pending）
- **$ 待收款**（done-unpaid + partial）
- **✓ 已收款**（paid + prepaid）
- **🚫 已取消**（cancelled）
- 每 column 顯示卡片數 + 該 column 金額小計
- 寬螢幕 4 column 並排、≤900px 2 column、≤540px 單 column 直疊

### 看板卡片
- 業主色塊 + 案件標題（單行省略）
- 日期 + 金額 + 業主名
- 左邊框依 status 上色（綠/黃/灰/取消）
- 點卡片 → 開啟編輯 modal
- 拖卡片 → 用 HTML5 native drag and drop API

### 拖曳改狀態行為
- 從某 column 拖到另一個 column → 自動套對應狀態變化
- **拖到「進行中」**：清 done / cancelled
- **拖到「待收款」**：勾 done、自動填 doneAt = 今日
- **拖到「已收款」**：勾 done、補一筆 payment 把餘額收齊（note: 「從看板拖曳標已收」）
- **拖到「已取消」**：勾 cancelled
- 已在該分類就不動
- 拖曳中卡片 opacity 0.4 + 略 rotate；目標 column drop 時 primary 邊框高亮
- toast 確認「✓ 已移到 XXX」+ 操作日誌 `job-board-move`

### 不在這版範圍
- Inline edit（點欄位直接改金額/日期/標題）— 留 v3.13.1 或之後做（避免一次改太多沒測就疊上）
- 手機滑動快速 action — 留之後做（要 hammer.js 之類）

### 版本 bump
- APP_VERSION → `2026-05-01-v3.13.0`
- SW CACHE_VERSION → `ftracker-cloud-v3.13.0`

---

## v3.12.0 — 請款單歷史 + status 追蹤（2026-05-01）

> 每次匯出 PDF / PNG / 複製圖 / 複製字 / 列印 都會自動留一筆紀錄。可標 5 種 status、一鍵重發、刪除舊紀錄。

### Schema migration v11 → v12
- 加 `state.invoiceHistory: []` 預設空陣列（migration 自動補）
- save / applyTrackerData / cloudResolveAndMerge / buildTrackerWrapper / cloudCreateSnapshot / exportData 全部都要 push/pull invoiceHistory
- Drive payload + 本機 backup JSON 都跟著走

### invoiceHistory entry 結構
```json
{
  "id": "inv_xxxxxxxx",
  "createdAt": "2026-05-01T15:30:00.000Z",
  "clientId": "ab12cd",
  "clientName": "A 公司",       // snapshot，業主後改名不影響歷史
  "paymentAccountId": "pa1",
  "paymentAccountLabel": "個人",
  "mode": "single",                // 'single' | 'range'
  "rangeStart": "2026-04-01",
  "rangeEnd": "2026-04-30",
  "periodLabel": "2026-04",
  "jobIds": ["xy34ef", "..."],   // 含哪幾筆案件 ID
  "jobCount": 3,
  "totalAmount": 87200,            // snapshot 金額
  "status": "pending",             // pending | sent | partial | paid | cancelled
  "statusUpdatedAt": "2026-05-01T15:30:00.000Z",
  "exportFormat": "pdf"            // pdf | png | image-copy | text-copy | print
}
```

### 5 個 export 函式 wrap 後加 recordInvoiceHistory
- exportInvoicePDF / exportInvoicePNG → 成功後 record
- copyInvoiceImage → 成功 await clipboard.write 後 record
- copyInvoiceText → 成功 writeText 後 record
- 列印按鈕從 `onclick="window.print()"` wrap 成 `onclick="printInvoice()"` → record + window.print()

### 新 UI：請款單歷史卡（在請款單分頁底部）
- collapsible card 預設收摺（避免占空間）
- 展開時自動 render（renderInvoiceHistory）
- 每筆紀錄顯示：日期時間 / 業主名 / 金額 / 案件數 / 期間 / 收款帳號 / 匯出格式
- 右側 3 個操作：
  - **status 下拉**（5 種）→ 切換立即存
  - **📋 重發** → 套用該紀錄條件到上方控制（業主+期間+收款帳號），使用者再按匯出按鈕
  - **🗑️ 刪除** → confirm 後刪這筆
- 上限 200 筆（自動裁掉最舊的，避免無限累積）

### 5 種 status + 視覺
- `pending` 灰色 ⚪ 待寄出（預設新建狀態）
- `sent` 藍色 ✉️ 已寄出
- `partial` 黃色 💰 部分收款（背景 warning-light + 左邊條）
- `paid` 綠色 ✅ 已收齊（背景 success-light + 左邊條）
- `cancelled` 灰化 ❌ 已取消（opacity 0.5）

### 操作日誌新增
- `invoice-export`（每次匯出）
- `invoice-status-change`（手動改 status）

### 版本 bump
- APP_VERSION → `2026-05-01-v3.12.0`
- SW CACHE_VERSION → `ftracker-cloud-v3.12.0`
- CURRENT_SCHEMA_VERSION → 12

---

## v3.11.0 — 達成率 + 預測 + 智慧分析（2026-05-01）

> 收益分頁總覽多一張「🎯 達成目標」卡片：自設月/年目標、進度條、線性預測期末值、5 種智慧分析提示。

### 收益目標 + 進度條 + 預測
- config 加 `goals: { monthly, yearly }` 預設 `0`（向下相容）
- 收益總覽新增「🎯 達成目標」卡，含月度 + 年度 2 個 block
- 每個 block：可編輯目標金額 input + 已收金額顯示 + 進度條 + 預測文字
- 進度條顏色：< 70% 黃 / 70-99% 藍 / >= 100% 綠
- **線性預測**：依「目前已過天數 / 期間總天數」推估期末值
  - 月度：取本月當天 / 本月總天數
  - 年度：取年初到今天天數 / 365
  - 預估超出目標 → 「📈 預估期末可達 NT$X（超出 NT$Y）」綠色
  - 預估不足目標 → 「📈 預估期末可達 NT$X（差 NT$Y）」黃色
- 編輯目標 onchange 立即存 + toast 確認、無需按儲存

### 5 種智慧分析提示（依條件動態顯示）
1. **本月業主集中度警告**：單一業主佔本月收入 ≥50% warn / ≥35% info
2. **拖款指數**：本月平均收款週期 vs 過去 3 個月平均，差 ≥7 天 warn 慢、≤-5 天 good 快
3. **Churn 警告**：列出 60-180 天沒下單的業主（>180 天視為已流失不算）
4. **總待收餘額警告**：所有未收 ≥ 100,000 警示「集中請款」
5. **年度業主集中度**：單一業主佔年度 ≥50% warn

### CSS 樣式
- `.goals-grid` 自適應 2 欄 / 1 欄
- `.goal-block` 灰底圓角卡 + 標籤 + input + 進度條
- `.goal-progress-bar` / `.goal-progress-fill` 動畫 transition
- 重用 v3.9.0 業主 detail 頁的 `.client-insight` 樣式（warn/good/info）

### 版本 bump
- APP_VERSION → `2026-05-01-v3.11.0`
- SW CACHE_VERSION → `ftracker-cloud-v3.11.0`

---

## v3.10.0 — 全局計時器（top bar 常駐 + 跨會期 persist）（2026-05-01）

> 從 modal 內計時器升級成「全局計時器」：top bar 常駐顯示、切到任何分頁 / modal 都繼續跑、瀏覽器關了再開計時還在。

### 全局計時器 state（記憶體 + localStorage 同步）
- 新增 `activeTimer = { jobId, startedAt, accumulatedMs }`
- localStorage key `cloud-ftActiveTimer_v1`
- 隨時 persist：開始 / 暫停 / 重設 / 結束都立刻寫
- 啟動時 `loadActiveTimerFromStorage()` 還原（即使瀏覽器關了再開計時繼續跑）

### Top bar 常駐 widget
- 沒在計時時 hidden、有 jobId 時常駐顯示
- 內容：⏱️ icon + `00:00:00` 時間 + 案件標題 + ⏸/▶ 暫停繼續按鈕 + ✓ 結束按鈕
- 計時中：success 綠色背景 + icon 脈動動畫
- 暫停中：白底邊框、純顯示
- 點 widget 主體 → 跳到該案件 modal 編輯
- 手機版自動藏掉案件標題、保留時間 + 按鈕

### Modal 內計時器接全局狀態
- 開啟「正在計時的案件」modal → 自動顯示當前累積時間 + 按鈕變「⏸ 暫停 / ▶ 繼續」
- 開啟「不是計時中的案件」modal → 顯示該案件已存的 timeSpentMs（不會干擾全局計時）
- 按「▶ 開始」如果全局正在計時別的案件 → confirm「要切換嗎？前一個會自動暫停並寫回工時」
- 按「✓ 結束」→ 把累積時間轉成小時加到 `j.hoursWorked`、清空 timeSpentMs、清空全局 activeTimer
- 按「重設」→ 清空累積但保留 jobId（按繼續從 0 開始）

### 行為細節
- **跨案件切換**：自動 pause 舊的、save() timeSpentMs、切到新案件
- **跨會期持久**：startedAt 是 epoch ms，瀏覽器關了再開仍能算對時間
- **案件被刪除**：deleteJob 偵測到 activeTimer.jobId === deletedId 自動 clearActiveTimer
- **Modal 關閉**：計時器繼續跑（top bar widget 持續顯示）— 不再 stopJobTimerOnClose

### 不在這版範圍
- 「今日總工時」儀表板（依日 / 業主 / 類型分類）— 留 v3.10.1 或之後
- 自動 idle 偵測（5 分鐘沒活動暫停）— 留之後

### 版本 bump
- APP_VERSION → `2026-05-01-v3.10.0`
- SW CACHE_VERSION → `ftracker-cloud-v3.10.0`

---

## v3.9.0 — 業主 detail 頁（CRM-lite）（2026-05-01）

> 業主分頁從單純列表升級成「點業主進詳細頁」，每個業主自帶 4 stat / 通訊錄 / 12 個月趨勢 / actionable 智慧分析 / 案件時間軸。

### Schema migration v10 → v11
- 業主加結構化 `contact: { person, phone, email, address }` 欄位（migration 自動補空值，舊資料無痛升級）
- 既有 `client.note` 欄位繼續用，作為「內部備註（業主看不到）」

### 業主分頁拆兩種視圖
- `#client-list-view`：原本的列表（不動）
- `#client-detail-view`：新的 detail 頁（預設 hidden）
- 切到別的 tab 自動回列表
- 業主名變可點 + 列表每筆右側加「詳細 →」按鈕

### Detail 頁內容
- **Header**：返回按鈕 + 業主色塊 + 業主名 + 編輯 + 「+ 新增案件」
- **4 個 stat card**：
  - 累計收入（含已收 + 待收）
  - 案件數（活躍 / 含取消）
  - 待收餘額
  - 平均收款週期（依該業主 doneAt → 第一筆 payment.date 計算）
- **💡 智慧分析 insights**（依條件動態出現）：
  - 「已 N 天沒有新案件」（≥90 天 warn / ≥60 天 info）
  - 「平均拖款 N 天，比整體多 X 天」（多 7 天以上 warn）
  - 「平均收款比整體快 X 天 → 優質客戶」（少 5 天以上 good）
  - 「年度貢獻佔 N%」（≥50% warn 集中度過高 / ≥30% info 主要客戶）
  - 「待收金額 NT$X，建議集中請款」（≥50000 warn）
- **過去 12 個月貢獻 mini chart**：堆疊條形圖（綠 = 已收 / 黃 = 待收）
- **通訊錄**：4 欄 grid（聯絡人 / 電話 / Email / 地址）+ 內部備註，inline editable + auto-save（顯示「✓ 已儲存」淡入淡出）
- **案件歷史時間軸**：依日期倒序、用既有 jobRow 渲染（含取消的）

### 互動優化
- 點 detail 頁的「+ 新增案件」會自動預選該業主
- 點「編輯」會打開既有的 client modal
- 通訊錄欄位 oninput 立即存（debounce 透過 save() 機制）

### 版本 bump
- APP_VERSION → `2026-05-01-v3.9.0`
- SW CACHE_VERSION → `ftracker-cloud-v3.9.0`
- CURRENT_SCHEMA_VERSION → 11

---

## v3.8.1 — UI 字眼統一 + Google 行事曆條件勾選（2026-05-01）

### UI 字眼「Calendar」全部改成「Google 行事曆」
- alert-matrix 欄表頭：`📅 Calendar` → `📅 Google 行事曆`
- 分隔列：「— 以下只在 Calendar 同步 —」 → 「— 以下只在 Google 行事曆 —」
- 行事曆同步卡按鈕：「立即同步到 Calendar」 → 「立即同步到 Google 行事曆」
- master toggle 文字：「啟用行事曆同步」 → 「啟用 Google 行事曆同步」
- toast 訊息：「行事曆同步」 → 「Google 行事曆同步」
- 所有 hint / title 提示文字統一為「Google 行事曆」

### 提醒矩陣 Google 行事曆欄條件勾選
- master toggle OFF 時，alert-matrix 內所有 `[id$="-calendar"]` checkbox 設為 `disabled`
- 加 CSS class `.alert-matrix.cal-disabled` 給整欄灰化（opacity 0.35 + cursor not-allowed）
- master toggle ON 時自動恢復可勾
- **保留勾選狀態**（不清空），停用後再啟用，先前的勾選會回來
- cloudUpdateCalendarSectionVisibility / loadReminderConfigUI 兩處都套用 disabled 邏輯，確保以下情境都正確：
  - 切 master toggle 即時生效
  - 進入設定頁第一次展開 reminder card 時就是正確狀態
  - 從其他裝置同步進來、master 狀態變了也跟著刷

### 版本 bump
- APP_VERSION → `2026-05-01-v3.8.1`
- SW CACHE_VERSION → `ftracker-cloud-v3.8.1`

---

## v3.8.0 — 提醒類型矩陣（每類自帶 2 channel）（2026-05-01）

> 採方案 3：通知與提醒卡重做成「提醒類型矩陣」，每個類型獨立決定走哪些通道（桌面通知 / Google 行事曆）。Calendar 卡精簡為純技術設定（master toggle / 選日曆 / 早報時段）。

### 通知與提醒卡 — 新矩陣 UI
- 砍掉舊的 1-column reminder-grid + 「儲存」按鈕
- 改成 grid 三欄：類型名稱（含天數參數） / 🖥️ 桌面 / 📅 Calendar
- 9 個提醒類型 + 1 條分隔線：
  - 1-7 桌面 + Calendar 雙通道（unpaidLong / monthEnd / billingDay / slowPay）或單通道（overdue / dueSoon / backup 只桌面）
  - 8-9 Calendar-only（jobs 案件本身 / dailyMorning 每日早報摘要）
- 每個 cell 用 ☑ checkbox 表示啟用、— 表示該通道不適用
- 寬螢幕 1-line per 類型、窄螢幕 (<480px) 自動縮 cell 寬度

### 全部 toggle / 數字輸入改 immediate save
- 拿掉「儲存」按鈕（過去要按才生效，不直覺）
- onAlertChannelToggle(key, channel) — 立即寫對應 config 欄
- onAlertNumberChange(field, value) — 立即寫對應 config 數字欄、自動 clamp 到合法範圍
- desktop channel 寫 `config.enable*Alert`、calendar channel 寫 `cloudCalendarConfig.syncTypes.*`（資料層保留 v2 結構，UI 層整合）

### 行事曆同步卡精簡
- 移除 Step 3「要同步哪些事件」整段（已搬到通知與提醒卡）
- 在原位置加 hint：「💡 要同步哪些事件 → 在『🔔 通知與提醒』卡的『📅 Calendar』欄勾選」
- cloudOnCalendarConfigChange 不再讀 syncTypes（只剩早報時段）
- cloudRenderCalendarUI 不再 restore syncTypes，改 call loadReminderConfigUI 一併刷新
- master toggle 切換時同步刷新 reminder card 的「📅 Calendar 欄需先啟用 master toggle」hint

### 順手砍掉
- 通知與提醒卡的 `cfg-alert-X` checkbox + `cfg-X-days` number 全套舊 ID（改 `alert-{key}-{channel}` 命名）
- saveConfig 主邏輯（變成 stub，留給萬一漏網之魚）
- toast「✓ 已儲存設定」不再彈出（immediate save 不需要）

### 版本 bump
- APP_VERSION → `2026-05-01-v3.8.0`
- SW CACHE_VERSION → `ftracker-cloud-v3.8.0`

---

## v3.7.0 — Calendar 同步 UX 改造（2026-05-01）

> 採方案 B + 兩件配套：保留兩張卡的清晰分工（Drive = 基礎、Calendar = 延伸），但 Calendar 卡頂端加 master toggle、登入後跳一次 prompt、移除自動 vs 手動。

### Calendar 卡 master toggle（B 主軸）
- 卡頂端加 `<input id="cloud-cal-enabled">` master switch（藍色 primary-light 背景強調）
- toggle 關 → 整個設定區（Step 1-3 + 同步狀態 + 立即同步按鈕）整段 hidden
- toggle 開 → 自動展開所有設定欄、提示「記得選擇要同步的日曆」
- toggle 關時 toast 提醒既有事件保留在 Google Calendar，要清要手動
- config 加 `enabled: false` 預設值（向下相容、舊使用者升級後預設關閉）

### 登入後跳一次 prompt
- 加 `#cal-prompt-modal` 介紹 Calendar 同步功能
- `cloudMaybeShowCalendarPrompt()` 在登入完成 1.5 秒後檢查並跳出
- localStorage key `cloud-ftCalendarPromptShown_v1` 記錄已看過
- 兩個按鈕：
  - **立刻設定** → 自動把 master toggle 切 ON、跳到設定頁、展開行事曆卡 + scrollIntoView
  - **先不要** → 標記已看過、不再跳；toast 告知之後可以從設定啟用
- 已啟用 Calendar 的使用者不會跳（直接標記已看過）

### 拿掉「自動 vs 手動」Step 4
- 移除 HTML Step 4 區塊 + `#cloud-cal-autosync` checkbox
- `cloudGetCalendarConfig` 移除 `autoSync` 欄位（既存值會被 spread 蓋掉但無害）
- `cloudOnCalendarConfigChange` 不再讀寫 autoSync
- `cloudScheduleCalendarSync` 條件從 `cfg.autoSync` 改成 `cfg.enabled`
- 啟用 = 一律自動同步（save() 後 30 秒 debounce），「立即同步到 Calendar」按鈕保留給手動觸發

### 操作日誌新增
- `cloud-calendar-enable` / `cloud-calendar-disable`（master toggle 切換）
- `cloud-calendar-prompt-accept` / `cloud-calendar-prompt-dismiss`（首次 prompt）

### 版本 bump
- APP_VERSION → `2026-05-01-v3.7.0`
- SW CACHE_VERSION → `ftracker-cloud-v3.7.0`

---

## v3.6.4 — 修行事曆 grid + 案件 modal 大改（2026-05-01）

### Bug 修：行事曆同步卡 grid 排版（v3.6.3 引入）
- v3.6.3 用 `grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))` 在寬螢幕會把每格拉到 200px 寬，但 label 內容只占 ~50px，導致 checkbox 跟文字之間出現巨大空隙
- 改用 `display: flex; flex-wrap: wrap` + `inline-flex` 的 label，每個 label 只占自己的內容寬度，自然換行
- 順手補 `input[type="checkbox"] { width: auto }` override 全域 `input { width: 100% }` 規則（reminder card 也補）
- 「啟用自動同步」checkbox 同樣的問題也一併修

### 案件 modal 全面分區重排（C）
- 拆成 3 個邏輯區塊（虛線分隔）：
  - 區 1 **基本資訊**：業主、開始日+截止日、案件名稱、類型/標籤
  - 區 2 **內容 與 金額**：細項說明+範本、單價×數量×總金額、工時+計時器、折扣（收摺）、金額計算結果
  - 區 3 **進度 與 收款**：完成+完成日、子任務（收摺）、收款狀況（收摺）、已取消
- 區塊標題用 11px 灰色 letter-spacing 0.5px 的 hint label，視覺輕、不打擾
- 區塊間用 dashed border-bottom 1px 分隔

### 折扣 / 子任務 / 收款狀況改 collapsible（B）
- 三個區塊都改成 `<details>` 樣式（自訂 ▶ 箭頭、hover 高亮）
- **折扣**：新增模式收摺；編輯模式有折扣才展開
- **子任務**：新增模式收摺；編輯模式有子任務才展開
- **收款狀況**：新增模式收摺（看到 status badge 跟「+ 新增收款」按鈕）；編輯模式有 payment 或 writeOff 才展開
- 新增 helper `setJobDetailsOpenState(j)` 在 openJobModal / editJob / duplicateJob 結尾統一呼叫

### 估價單模式從黃色 checkbox 搬到標題列（B）
- 原本是 modal 底部黃色背景大 checkbox，視覺很搶眼但使用率最低
- 改成標題列右側 chip 樣式 toggle：「📄 估價單」
- 勾起來時 chip 變黃色背景 + 加粗
- 加 `onJobEstimateToggle()` 自動更新 modal title：「新增案件」⇆「新增估價單」、「編輯案件」⇆「編輯估價單」
- 用 `:has(input:checked)` CSS pseudo-class 做純 CSS 樣式切換（無需 JS 加 class）

### 已取消 從紅色強調改成灰底
- 原本用 `.danger-checkbox` 紅色背景，跟 v3.6.0 簡潔風格不一致
- 改用 `.job-cancelled-row` 低調灰底 + 圖示 emoji 自帶語意

### 整體效果
- modal 高度約減 30-40%（折扣 / 子任務 / 收款都摺起來時）
- 第一次新增案件的人只看到 3 個必填區塊（基本/金額/狀態），不會被收款/折扣大 box 嚇到
- 編輯既有案件時自動展開有資料的區塊

### 順便砍掉的冗餘
- 「💡 單價 × 數量 會自動算總金額」提示文字（v3.6.3 已砍但 PR 沒分清楚）
- 範本按鈕的 📋💾 emoji
- 標籤 input 旁邊的「　例：廣告、設計、動畫」hint span（已併進 placeholder）
- 估價單按鈕的 📄 emoji
- 「✓ 一次收齊餘額」前面的 ✓
- 收款狀況「不計入收益統計但保留紀錄」→「保留紀錄但不計入統計」（更短）

### 版本 bump
- APP_VERSION → `2026-05-01-v3.6.4`
- SW CACHE_VERSION → `ftracker-cloud-v3.6.4`

---

## v3.6.3 — 行事曆縮小 + 工時計時器合併（2026-05-01）

### 行事曆同步卡縮小
- 加 `.cal-compact` 系列 CSS（cal-step / cal-step-label / cal-hint / cal-sync-grid）
- 4 個 step 區塊 padding 12px → 8px、margin-bottom 12px → 6px
- Step 1「建議建外包專用日曆」原本一直顯示 → 改 `<details>` 預設收摺，需要看做法才展開
- Step 3「要同步哪些事件」改 grid `repeat(auto-fit, minmax(180px, 1fr))` 自適應分欄，6 個 checkbox 寬螢幕 2-3 欄、窄螢幕 1 欄
- 各 checkbox 文字精簡：「案件本身（含取消的，標題前綴 "(已取消)"）」→「案件本身」，「業主固定請款日提醒」→「業主請款日提醒」
- Step 4 自動同步說明：「save() 後 30 秒 debounce 自動推到 Calendar」→「每次改動 30 秒後推送」
- 整體高度減約 35%

### 案件 modal：工時 + 計時器合併
- 原本工時 input 跟計時器是兩個獨立區塊（中間夾著折扣 + 金額 summary + 時薪提示）
- 合併成單一 `.job-hours-section` 區塊：
  - 一行：工時 input + 「小時」 + 計時器顯示 + ▶開始/⏸暫停 + ✓結束 + 重設
  - 下方緊跟著時薪提示（移到這裡，不再夾在折扣跟 summary 之間）
- 工時保留可手動輸入，計時器結束時依舊把累計時間加到工時欄位（沿用 finishJobTimer 邏輯，未動）
- 順手砍掉「💡 單價 × 數量 會自動算總金額」提示文字（重複噪音）
- 計時器顯示器改用 monospace 16px、白底邊框，視覺感更像獨立「碼錶」
- 整體 modal 上半部高度減約 80-100px

### 版本 bump
- APP_VERSION → `2026-05-01-v3.6.3`
- SW CACHE_VERSION → `ftracker-cloud-v3.6.3`

---

## v3.6.2 — Reminder 改善 + 通知拒絕後引導（2026-04-30）

### 通知與提醒卡片 grid 自適應分欄
- 從 list（每列佔滿）改 `grid-template-columns: repeat(auto-fit, minmax(220px, 1fr))`
- 寬螢幕自動 2-3 欄、窄螢幕 1 欄，視覺密度大幅提高
- 整體高度減少約 50%
- 文字再縮短：「天提醒」→「天」、「（業主頁可覆寫）」拿掉
- input[type=number] max-width 64px → 56px

### 備份提醒加 checkbox toggle
- 新增 `cfg-alert-backup` checkbox + `config.enableBackupAlert` 設定欄
- 預設 ON（向下相容，舊使用者不變）
- alert 觸發加上 `config.enableBackupAlert !== false` 條件
- saveConfig / loadReminderConfigUI 都同步加上欄位

### 通知 denied 狀態引導改善
- 加 `#notif-denied-help` 警告框，被瀏覽器拒絕時自動顯示
- 警告框內列 Chrome / Edge / Firefox / Safari 三家瀏覽器各自的重新開啟步驟
- 解釋：JS 沒辦法強制再叫對話框跳出來（瀏覽器安全限制），唯一解法是手動到瀏覽器設定改
- 拒絕時把「啟用通知 / 停用通知」按鈕都隱藏（按了沒用）

### Dashboard 近期案件批次保留 + 不動
- 使用者表示需要從首頁直接快速結案，整個機制保留
- 現況其實已支援單筆快速操作：點「完成」勾標完成、點「收款」勾標已收、點 row 編輯
- 不另加 hover quick action（避免冗餘）

### 版本 bump
- APP_VERSION → `2026-04-30-v3.6.2`
- SW CACHE_VERSION → `ftracker-cloud-v3.6.2`

---

## v3.6.1 — Demo bug + UI 調整（2026-04-30）

### Bug：載入範例後本月待收款被多算 4500
- 範例資料設了 `paid: true` 但沒寫 `payments[]` 陣列
- 自 v2.8.0 起所有「已收款」相關計算改吃 payments[]，沒陣列等於沒收過
- 結果：第一筆 4500 範例被算進「待收款」、本月已收款顯示 0
- 修：loadDemo() 為已收款案件補上對應 payments 條目，所有未收的也補空陣列、quantity=1
- 已驗證 jobUnpaidAmount / jobPaidTotal / jobIsFullyPaid / jobFinalAmount / Dashboard / Revenue 計算邏輯本身正確，bug 純粹是 demo 資料層

### Demo 加業主收款帳號
- loadDemo() 同步寫一筆 `config.userInfo.paymentAccounts`（個人 / 王小明 / 玉山銀行範例）
- selectedPaymentAccountId 也設定好
- 載入範例後直接到請款單分頁就能產出範例請款單，不必先去設定收款帳號

### 收益分頁「範圍」label 視覺分組
- 原本「月度|年度 toggle」+「範圍」label +「業主」label 全部 flex 平鋪，看起來「範圍」黏在 toggle 上
- 改用 `<label class="rev-control-group">` 把 label + select 包成一組
- 加 `.rev-control-group` CSS：淡背景 + 圓角，視覺成獨立 chip

### 通知與提醒卡片整體縮小
- 加 `.reminder-compact` 系列 CSS（reminder-row / reminder-list / reminder-inline / reminder-hint）
- padding 12px → 6-8px、gap 10px → 4px、字 13-14px → 12-13px
- input[type=number] 縮小：max-width 80px → 64px、font 12px
- 文字縮短：「逾期未完成（過了案件日期還沒勾完成）」→「逾期未完成」（多餘解釋砍）
- 按鈕「💾 儲存」→「儲存」、「🧪 試發一則」→「試發一則」
- 整體卡高度大概減 30-35%

### 設定頁順序重整
- 移除「🌟 常用設定」「🔧 進階設定」section title — 對個人使用情境意義不大
- 「📦 雲端備份歷史」從 Drive 同步底下搬到設定頁最下面
- 新順序：Drive 同步 → 我的收款資訊 → 通知與提醒 → 資料備份 → Google 行事曆同步 → 雲端備份歷史

### Top bar icon 改進
- 強制刷新 icon 從 🔄 換成 ↻（U+21BB，看起來更像「重新整理」而非「同步循環」）
- title 從「強制刷新」改成「重新整理（清除所有快取、Service Worker、Cookie）」
- 加 `.topbar-icon-btn` CSS：font-size 14 → 18、padding 6/10 → 6/11
- hover 加邊框變主色 + 背景變淡的視覺回饋

### 版本 bump
- APP_VERSION → `2026-04-30-v3.6.1`
- SW CACHE_VERSION → `ftracker-cloud-v3.6.1`

---

## v3.6.0 — UI 簡化第二輪（2026-04-30）

> 4 個改動：砍設定頁主題卡、全域搜尋列收 collapsible、Dashboard stat 卡可點跳轉、第一次使用顯示引導 empty state。Task 6/7（緊湊模式 / 行事曆 legend）暫緩。

### 砍設定頁「🌗 顯示主題」卡
- 跟 top bar 主題按鈕功能 100% 重疊
- `loadThemeUI()` 用 querySelectorAll 找不到不會錯，安全刪除
- 設定頁進階設定區從 2 張 card（行事曆 + 主題）變 1 張

### 全域搜尋列改 collapsible
- Top bar 加 `🔍` 按鈕（icon-only 風格、與刷新/日誌一致）
- 預設搜尋列 hidden，點 🔍 才展開、自動 focus
- input 加 Esc 快捷鍵關閉
- 釋出 sticky header 約 60px 垂直空間

### Dashboard stat 卡可點擊跳轉
- 4 張 stat 加 `.clickable` class（hover 浮起 + 邊框變主色）
- 「本月已收款」→ 案件 tab + 本月 + 已完成已收款
- 「本月待收款」→ 案件 tab + 本月 + 完成待收款
- 「本月待完成」→ 案件 tab + 本月 + 未完成
- 「年度已收款」→ 案件 tab + 自訂範圍 YYYY-01~YYYY-12 + 已完成已收款
- 切過去會自動清掉 clientId / tag filter，避免之前 filter 殘留

### Dashboard empty state 引導卡
- `state.clients` 跟 `state.jobs` 都空時顯示 hero card：「歡迎，先來建第一筆吧」
- 兩個 CTA：「＋ 新增第一筆案件」（呼叫 openJobModal）/「查看範例資料」（呼叫 loadDemo）
- 主色背景 + 邊框，視覺更暖、不會讓新手看到 4 張 NT$0 stat 覺得冷
- 一旦有任何業主或案件即自動隱藏

### 暫緩
- Task 6 緊湊模式（案件列表）— 需要的話之後再做
- Task 7 行事曆 legend — 跟使用者討論中（保留文字 + 加色塊樣本）
- Task 9 Dashboard「年度收入對比」併進 Revenue — 待決定

### 版本 bump
- APP_VERSION → `2026-04-30-v3.6.0`
- SW CACHE_VERSION → `ftracker-cloud-v3.6.0`

---

## v3.5.0 — Revenue 子分頁 + 月度趨勢調整（2026-04-30）

> 把收益分頁的 9 張卡片拆成「總覽 / 趨勢 / 分析」三組子分頁；月度收益趨勢預設 6 個月、最近月在最左、X 軸顯示 YYYY-MM。

### Revenue 拆 3 子分頁
- **總覽**：控制（mode/range/業主）+ summary 4 張 + 月度收益趨勢 + 業主貢獻排行 + 月度業主彙整
- **趨勢**：收款時間軸 + 工作熱圖 + 忙閒週期分析
- **分析**：案件類型分佈 + 時薪趨勢
- 「月度業主彙整」依使用者要求從末尾搬到「總覽」
- 切到 趨勢/分析 子分頁時自動重繪該組圖表（避免在 hidden 狀態時 SVG 寬度為 0）
- 加 `.rev-subtabs` CSS（沿用 `.revenue-toggle` 風格的 pill switcher）

### 月度收益趨勢圖
- **預設範圍從「最近 12 個月」改成「最近 6 個月」**（年度模式維持 5 年）
- **反轉順序：最近月在最左**（年度模式維持舊→新，因為跨年資料量通常少）
- **X 軸標籤改顯示 YYYY-MM 全文**（之前只顯示 MM 部分）
- 累計線改算法：先以時間順序計算 chronoCum，再按顯示位置 mapping，反轉後語意正確
- 累計總額 label 改釘在「累計值最大」的點（也就是最新月），位置左/右自動避開 chart 邊界

### 順手移除的裝飾性 emoji
- 月度/年度 toggle 按鈕的 📅 / 📊
- 月度業主彙整標題的 📋
- CSV 匯出按鈕的 📊
- 自訂月份範圍 select 內的 📌

### 版本 bump
- APP_VERSION → `2026-04-30-v3.5.0`
- SW CACHE_VERSION → `ftracker-cloud-v3.5.0`

---

## v3.4.0 — UI 簡化（Top bar / 卡片描述 / Settings collapsed）（2026-04-30）

> 純 UI 瘦身，無業務邏輯改動。Revenue 子分頁拆分（Task 3）暫不做、先預覽。

### Top bar 精簡
- 「🔄 刷新頁面」→ icon-only `🔄`（含 title tooltip 保留語意）
- 「📜 日誌」→ icon-only `📜`
- 「主題:系統」→「🪄 主題」（auto）/「☀️ 主題」（light）/「🌙 主題」（dark），icon 透露目前模式
- 同步 indicator 維持原樣
- 在窄螢幕上釋出更多空間給標題

### 設定頁卡片預設全部收起
- `#card-myinfo`（我的收款資訊）改成 `collapsible collapsed` + 簡化成導引按鈕
- 其他 6 張 card（Drive 同步以外）原本就 collapsed，本版確認一致
- 入口卡 `#card-cloud-auth` 維持展開

### 卡片描述文字砍一半
- Revenue 5 張卡：刪除每張底下的 12px 描述文字（chart 標題已足夠）
- Drive 同步未登入提示：「登入後資料同步到你自己的 Google Drive 應用程式資料夾」（從 1.5 行變半行）
- Drive 同步已登入提示：「自動同步，1 小時後 token 過期需重新登入」（從 2 行變半行）
- 備份歷史描述：「手動備份永久保留；自動每日備份會分層保留」（從 2 行變 1 行）
- 桌面通知描述：縮成「每天首次開頁時若有逾期/即將到期/拖款，會跳系統通知」
- 行事曆描述：縮成「同步案件 + 提醒到 Google 行事曆，只動帶 ftSource 標記的事件」
- 主題描述：「『自動』會跟著系統切換，右上角按鈕可快速切換」

### Revenue 5 張卡標題去裝飾性 emoji
- 「🥧 案件類型分佈」→「案件類型分佈」
- 「🔥 工作熱圖」→「工作熱圖」
- 「💵 收款時間軸」→「收款時間軸」
- 「📅 忙閒週期分析」→「忙閒週期分析」
- 「💰 個人時薪趨勢」→「時薪趨勢」

### 版本 bump
- APP_VERSION → `2026-04-30-v3.4.0`
- SW CACHE_VERSION → `ftracker-cloud-v3.4.0`

### 不在這版範圍
- Revenue 拆 3 子分頁（Task 3）— 已 mock 預覽，待決定是否動工
- Dashboard 4 stat 改 3 stat（Task 2）— 待決定砍哪張
- 請款單控制區進階篩選收摺（Task 5）
- 7 tabs 縮成 6（Task 8）

---

## v3.3.1 — 物理刪除 DEAD_BLOCK 純清理（2026-04-30）

> v3.3.0 把 9 個 v2 dead code 區塊用 `/* DEAD_BLOCK_BEGIN ... DEAD_BLOCK_END */` 包起來不執行；本版直接從 app.js 物理刪除這些區塊，每個換成單行說明註解。

### 刪除統計
- v3.3.0 後：8673 行（非空行）
- v3.3.1 後：8107 行（非空行）
- **淨刪 566 行**

### 物理移除的 9 個區塊
- `v2_sheet_capacity`：v2 Sheet 容量計算
- `v2_health_check`：資料健檢整套（runDataHealthCheck / showHealthCheckModal / runHealthAction，約 110 行）
- `v2_settings_payment_ui`：settings 頁「我的收款資訊」整套 6 函式（約 130 行）
- `v2_lab_mode`：開發模式 banner + toggle（含 LAB_MODE_KEY、isLabMode stub）
- `v2_device_name_ui`：裝置名稱輸入 UI（含 loadDeviceNameUI noop stub）
- `v2_precise_location`：HTML5 Geolocation + BigDataCloud 反向地理編碼
- `v2_device_name_prompt`：裝置名稱提醒 modal 三函式
- `v2_sheet_sync_toggle_stubs`：enableSheetSync / disableSheetSync stub
- `v2_snapshot_diff_modal`：v2 sheet snapshot diff 預覽 modal（約 175 行，最大塊）

### 每塊換成的單行說明範例
```js
// v3.3.1：v2 資料健檢整套（runDataHealthCheck / showHealthCheckModal / runHealthAction）已物理移除
```

### 沒動到的東西
- `getDeviceLabel` / `getOrGenerateAutoId` / `getOsLabel` / `fetchDeviceLocation` / `cachedDeviceLocation` / 三個 `DEVICE_*_KEY`：仍給 snapshot metadata 用
- `toggleCard`：#card-calendar / #card-theme 等仍在用
- 所有 v3 cloud layer 程式碼（auth / Drive client / sync / snapshot / image）

### 驗證
- DEAD_BLOCK marker 0 殘留
- `/*` 與 `*/` 各 2 個（檔案頭註解 + JSDoc），完全平衡
- 沒有 deleted DOM ID 殘留 caller
- HTML onclick 0 死函式

### 版本 bump
- APP_VERSION → `2026-04-30-v3.3.1`
- SW CACHE_VERSION → `ftracker-cloud-v3.3.1`

---

## v3.3.0 — Dead code cleanup + 單筆請款 PDF 修圖片（2026-04-30）

> v3.0.0 stable 之後留下的 v2 Apps Script dead code 第二輪清理；同時修單筆請款 PDF 出存摺照片變 placeholder 文字的 bug。

### Bug 修：單筆請款 PDF 存摺照片
- v3.0.0-alpha.3 把存摺從 base64 → Drive fileId 後，`exportSingleJobPDF` 直接讀 `account.bankbookImageFileId` 但沒先 hydrate
- 結果 PDF 裡只看到「⏳ 載入存摺照片中…」placeholder 文字
- 改：PDF build 前 await `cloudGetBankbookDataUrl(fileId)` 取得 dataUrl 再塞 `<img>`
- 整單請款圖片版的 `captureInvoiceCanvas` 也補 await `cloudHydrateBankbookImages()`
- 順便把單筆 PDF 的「原價」改成跟整單一致的「單價 × 數量」顯示

### HTML 死卡片 / Modal 整批刪
- `#card-cloud`（v2 ☁️ 雲端同步整塊：sheet URL / token / pull-push / snapshot / 容量 / 裝置名稱 / GPS / lab mode）→ 約 100 行
- `#card-portable`（v2 跨裝置設定檔：exportSettings / importSettings 純 stub）→ 約 18 行
- `#health-modal`（v2 資料健檢 modal）
- `#snapshot-modal`（v2 sheet snapshot 列表 modal）
- `#snapshot-diff-modal`（v2 sheet snapshot diff modal，v3 用 cloudShowRestorePreviewModal 取代）
- `#device-name-prompt-modal`（gate 在 `config.sheetSyncEnabled` 永遠 false，永不觸發）

### JS 整批包進 DEAD_BLOCK 註解
- `runDataHealthCheck` / `showHealthCheckModal` / `runHealthAction`（資料健檢整套）
- `showCloudCapacity`（Sheet 容量計算）
- 收款帳號 v2 settings UI 6 個函式（`loadUserInfoUI` / `renderPaymentAccountsUI` / `addPaymentAccount` / `removePaymentAccount` / `collectPaymentAccountsFromUI` / `saveUserInfo`）
- Lab mode 整套（`isLabMode` / `toggleLabMode` / `showLabModeBanner` / `updateLabModeUI` + `LAB_MODE_KEY`）
- 裝置名稱輸入 UI（`setDeviceName` / `loadDeviceNameUI`）
- GPS 精確位置（`requestPreciseLocation` / `clearPreciseLocation`）
- 裝置名稱提醒 modal（`maybeShowDeviceNamePrompt` / `saveDeviceNameFromPrompt` / `skipDeviceNamePrompt` + `DEVICE_PROMPT_DISMISSED_KEY`）
- 各種 deprecated stub：`enableSheetSync` / `disableSheetSync` / `pullFromSheet` / `pushToSheet` / `exportSettings` / `importSettings` / `restoreSnapshot` / `saveCalendarConfig` / `testCalendarConnection` / `syncCalendarNow`

### init 啟動腳本清理
- 拿掉 `updateLabModeUI()`（cfg-lab-mode UI 已刪）
- 拿掉 `setTimeout(maybeShowDeviceNamePrompt, 1500)`（modal 已刪）
- 保留 `fetchDeviceLocation()`（getDeviceLabel / snapshot metadata 仍會用到）

### applyTrackerData 清理
- 移除 `loadDeviceNameUI()` 呼叫（UI 已刪）
- 留 `loadDeviceNameUI` noop stub（避免有遺漏 caller 出錯）

### 保留
- `getDeviceLabel` / `getOrGenerateAutoId` / `getOsLabel` / `fetchDeviceLocation` / `cachedDeviceLocation` / `DEVICE_NAME_KEY` / `DEVICE_AUTO_KEY` / `DEVICE_LOCATION_KEY`
  - 仍被 snapshot metadata（line 702、1375）使用，未來想恢復裝置名稱顯示也用得上
- `toggleCard`（卡片摺疊；#card-calendar / #card-theme 等仍在用）

### 統計
- 刪除約 5 段 HTML（card + modal）合計 200+ 行
- JS 註解化約 350 行 dead code
- 升 APP_VERSION 至 `2026-04-30-v3.3.0`、SW CACHE_VERSION 至 `ftracker-cloud-v3.3.0`

---

## v3.2.1 — 請款單 UI 調整（2026-04-29）

> v3.2.0 主結構發出後依使用者實測逐步調整：版面緊湊化、區間改日期 picker、新增多個 toggle、preset 視覺提示、發票功能暫時隱藏。

### 個人資訊版面重排（v3.2.0-fix）
- 個人資訊從**請款單頂端**搬到**底部 3 欄**（個人 / 匯款 / 發票）
- 任一欄無資料 → 該欄自動隱藏；窄螢幕自動換行
- 加 `showPersonalInfoOnTop`（預設 false）：頂端額外顯示一行精簡聯絡資訊
- 兩個 toggle 組合：底部 / 頂端 / 都關 / 都開

### 個人資訊 toggle 搬出 modal 到請款單外層
- 「☑底部個人資訊 / ☐頂端精簡個人資訊」直接出現在請款單分頁上方
- 切換收款帳號 → toggle 自動跟著該帳號的設定
- 改 toggle → 立刻寫進該帳號 + 推 Drive

### 發票功能加 toggle、然後整批暫時隱藏
- 加 `showInvoiceInfo` flag（預設 false，個人接案者不開發票）
- toggle 加在外層：「🧾 發票資訊（公司 / 行號才需要）」
- **隨後依使用者要求整批隱藏**：HTML toggle + modal 區塊加 `hidden`、drawInvoice 加 `FEATURE_INVOICE_INFO = false` feature flag
- 資料 / Schema / Migration 全保留，未來解 hidden 即可恢復

### 上方欄位緊湊化
- 業主 + 請款範圍 → 第 1 列並排（grid 兩欄）
- 收款帳號 → 第 2 列獨立（含 📝 編輯 / ➕ 新增 / 🗑️ 刪除按鈕）
- label 從獨立行改成 11px 小字內嵌、整體少約 3~4 行高度

### 修：select 全域 width:100% 跟 flex 衝突
- 區間 picker 切換時 mode + 月份 + ~ + 結束 4 個元素擠到溢出卡框
- 改 `flex: 0 0 80px` + `width: 80px` 雙保險覆寫
- 內層 flex 改 `flex-wrap: wrap`，窄螢幕自動換行不擠

### 請款範圍：區間改日期 picker
- 從月份 select 升級成 `<input type="date">` 起始 ~ 結束
- 第一次切到區間自動填「本月初 ~ 今天」
- drawInvoice 過濾邏輯統一改成 per-day 比對（單月模式自動算「該月 1 號~最後一天」）
- end < start 自動 swap

### 顯示狀態 preset 加 active 視覺提示
- 4 顆按鈕加 `data-preset` 屬性
- 目前模式 → 變實心 `btn-primary`、其他維持 `btn-outline`
- 自訂組合（不符合任何 preset）→ 4 顆都 outline
- 切換 / init / 載入完成都自動同步

### 對帳模式才顯示狀態欄
- 請款 / 進度 / 全部 / 自訂 → 隱藏狀態欄（業主拿到的請款單不需要看狀態）
- 對帳 → 顯示狀態欄（自己對帳要看：✓ 已收款 / $ 待收款 / 部分收款 / 進行中 / ⚫ 已取消）

---

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
- **個人資訊從頂端搬到底部 3 欄並排**：個人 / 匯款 / 發票（沒料的欄位自動隱藏；窄螢幕自動換行）
- **發票資訊新欄位**：`invoiceTitle` / `taxId` / `address` / `invoiceNote`
- **個人資訊兩個 toggle**：
  - `showPersonalInfo`（預設 ON）：底部 3 欄左邊顯示個人資訊欄
  - `showPersonalInfoOnTop`（預設 OFF）：頂端額外顯示一行精簡聯絡資訊「請款方：王小明 · 0912... · xxx@...」
  - 兩個都關 → 請款單只剩匯款 + 發票，最簡短
  - 只開底部 → 推薦預設，業主拿到時看到完整資訊但不冗長

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

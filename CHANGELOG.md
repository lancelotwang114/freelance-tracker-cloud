# 版本更新歷史

## v3.28.3 — #10 長按進批次 + #12 標籤系統升級（2026-07-12）

### #10 手機滑動快速 action 收尾
- 左右滑（標完成/標收款）v3.20.0 早已完成 — BACKLOG stale，本次只補最後一塊
- **長按案件 row 500ms → 進批次模式並選取該筆**（震動回饋 navigator.vibrate 30ms）
- 防呆：手指有移動（方向鎖定）即取消長按；長按觸發後 preventDefault 吃掉合成 click（避免又 toggle 掉選取）；批次模式中不重複觸發

### #12 標籤系統升級（4 子項）
- **標籤統計**：收益→分析「案件類型分佈」既有（金額+佔比），legend 補「N 筆」筆數
- **業主分頁標籤篩選**：業主列表上方 tag chips（全部 + 各標籤），純 session UI 篩選不進 state；標籤消失自動重置
- **標籤顏色**：`config.tagColors { tag: '#hex' }`，設定→🎨 顯示偏好→「🏷️ 標籤顏色」原生 color picker 設色/清除。
  套用左緣色條（沿用業主 chip 視覺語言）：案件列 tag-badge / 報表視圖 t-tag / 看板 tile / 類型篩選 chips / 業主列表與篩選 chips。
  緊湊列不套（一行密度設計本來就不顯示 tags）
- **預設標籤模板**：業主標籤 datalist 帶 VIP / 大客戶 / 長期 / 潛在 / 拖款戶（建議不強制；案件 datalist 不帶）

### 資料鐵則核實（tagColors 是業務資料）
- 進 `config` → `buildTrackerWrapper().data.config` 自動裝載雲端 ✅（斷言驗證）
- setTagColor / clearTagColor 都走 `saveConfigOnly()`（含 cloudSchedulePush）✅
- 舊版相容：pull 是 config 整份取代（app.js `config = data.config`）、save 整份 stringify → 未知 key 舊版原樣帶回不丟失；mergeStates 對 config 是 per-key 三方合併，tagColors 衝突語意與 goals/userInfo 一致
- 無 schema version 變更（config key 預設讀取，非 state migration）

### 驗證
瀏覽器斷言 19 條全過：tagColors 預設/寫入/localStorage/wrapper 裝載/設定頁列表/清除、4 個套色點（tag-badge/t-tag/篩選 chips/業主 chips）、業主篩選 chips+過濾+重置、datalist 模板（業主有/案件無）、pie 筆數、長按進批次+選取+bulk bar、移動取消長按。fresh reload console 零錯誤。
（合成 TouchEvent 模擬長按；實機觸控建議部署後手機補一次目視確認）

---

## v3.28.2 — UI/UX 批次4：R1 篩選牆收合 / R5 跨天 pill / R13 top10 / R20 a11y / #7 砍重複卡（2026-07-12）

> 全 UI 層改動，無 schema 變更（停 v19）、不碰同步機制。

### R1 手機篩選牆收合（P1）
- 案件分頁 業主/類型 chips > 6 顆 → 只顯示前 6 + `更多 ▾ (N)`，點擊展開/收合
- **active 中的 chip 必入前 6**（目前篩選狀態不會藏進摺疊區 — 摺疊時把 active 換到第 6 位）
- 展開狀態只存 session 模組變數（每次進來預設收合）；月份/狀態/勞報列不動
- 實測 375px：篩選牆 317px，第一筆案件 y=717 首屏可見

### R5 行事曆跨天案件 pill 只顯示起訖日
- `cellHtml` 篩選改為：起日（`j.date === ds`）+ 迄日（`ds === j.endDate`），中間日不再每天重複出 pill
- 迄日沿用既有 `spans` class（不可拖），起日照常可拖曳改日期

### R13 usage counter top 10 顯示 UI
- 操作日誌 modal 加「📊 常用功能 top 10（累計）」collapsed details（緊鄰既有 📊 匯出統計）
- 讀既有 `cloud-ftUsageCount_v1` counter，key 轉譯（分頁/操作/快捷鍵）+ 次數遞減排序，純顯示無新存儲

### R20 無障礙補強
- `#toast` 加 `aria-live="polite"`（讀屏可聽到操作回饋）
- 32 個裸 `<label>` 補 `for` 關聯緊鄰的 input/select/textarea（job/client modal、請款、設定全域掃過；剩 3 個非緊鄰複合列不動）

### #7 Dashboard 年度卡瘦身
- 「📊 年度收入對比」各年度橫條砍掉（與收益分頁年度模式重複）
- **保留**「今年 vs 去年同期」摘要（Revenue 沒有這個資訊），卡改名「📊 今年 vs 去年同期」，cta 照舊導收益分頁

### 盤點家務（BACKLOG 核實標記）
- R9（頂列 tooltip）/ R11（switchTab active 查證無 bug）/ #17（多步 undo）/ #19（分組視圖）/ #5·R10（緊湊模式）— 早已完成，補標

### 驗證
瀏覽器 17 條斷言全過（收合 8 顆/更多計數/active 入前6/展開收合循環/類型列/跨天 2 顆@起訖/拖曳屬性/年度卡無橫條有同期/top10 內容+排序+轉譯/aria-live/label 34 顆/job-title 關聯）。
（附註：其中 1 條首輪紅是 rAF render 時序的測試假陰性，等 frame 後重驗 ✅）

---

## v3.28.1 — R12 勞報標記（schema v19）（2026-07-11）

### 使用者定案
> 「對方會自動報，我只要標記就好」— 不做試算，只要報稅季分得開。

### 內容
- **job.laborReported**（boolean，預設 false）：案件 modal 加「🧾 勞報案件」checkbox
  （在扣稅 toggle 下方，對方申報、此欄純分類）
- **案件分頁三態篩選 chip**：`🧾 勞報` 點擊循環 全部 → 只看勞報 → 非勞報
- **row 標記**：緊湊列/報表列標題尾 🧾、完整列 tag-badge「🧾 勞報」
- 收益分組先不做（標記 + 篩選已可分得開；要統計時再加）

### Schema（照鐵則 5 點）
- `CURRENT_SCHEMA_VERSION` 18 → **19**；migration 18 補 `laborReported: false`
- 欄位在 `state.jobs[]` → `buildTrackerWrapper` 自動裝載雲端；saveJob payload 收集；
  modal 開啟帶值 / 新增重設；無本機獨佔 key
- 雲端拉下自動跑 migration — 兩台其中一台先升級也安全

### 驗證
10 條斷言全過（migration 補值、modal 帶值×2、saveJob 收集、wrapper 裝載、
三態篩選各自命中、row 標記、新增預設不勾）。

---

## v3.28.0 — 鍵盤快捷鍵系統 + R19 focus-visible（2026-07-11）

### 快捷鍵（BACKLOG #2，使用者 2026-07-09 核准）
| 鍵 | 動作 |
|---|---|
| `1`–`7` | 切分頁（總覽/案件/行事曆/收益/業主/請款單/設定） |
| `N` / `Shift+N` | 新增案件 / 新增業主 |
| `/` | 全域搜尋 |
| `J` / `K` | 案件分頁上下移動選取（`.kb-focus` 高亮） |
| `Enter` / `Space` / `$` / `C` | 開啟 / 標完成 / 標收款 / 複製選取案件 |
| `Ctrl+Z` | 復原（接既有 performUndo） |
| `Esc` | 關搜尋 → 關 modal（job modal 走 dirty-check） |
| `?` | 速查表 modal |

### 防呆規則
- 焦點在**可見的**輸入元件 → 不攔（Esc 例外）；modal 開著只有 Esc 作用
- 不搶瀏覽器 Ctrl/Cmd 組合鍵（Ctrl+Z 例外）
- 修過程發現的 bug：Esc 關 modal 後 focus 殘留在隱藏 input → 快捷鍵全滅。
  `_kbTyping()` 加 `offsetParent !== null`（不可見輸入元件不算打字中）
- Space/$ 操作後 50ms 重掛游標高亮（updateJobRow 重繪會掉 class）
- kb:new-job / kb:search / kb:done / kb:paid 進 usage counter — 之後統計看得到採用率

### R19 鍵盤可視焦點
- 全站 `:focus-visible` outline（primary 2px）+ `.kb-focus` 列表選取樣式（outline + primary-light 底）

### 驗證
瀏覽器 14 條斷言全過（切頁/導航/Enter/typing 不攔/Esc 鏈/help/搜尋/Space 標完成/CSS）。

---

## v3.27.3 — 批次3 版面收尾：R7 請款控制收摺 / R2 FAB / R21 tab 提示（2026-07-11）

### R7 請款單控制區 6 行 → 3 行
- 「請款單顯示」個資 toggle + 狀態細項 checkbox 收進 `<details>` **⚙ 顯示設定**（預設收摺）
- **狀態 preset（📋請款 / ✅對帳 / 🔄進度 / 📦全部）留在主行** — 月底請款↔對帳是高頻切換
- 所有 input id / onchange 不動，純結構搬移

### R2 FAB 不再蓋內容
- `main` padding-bottom 16 → 96px（FAB 56px + 邊距），列表最後一筆 / 分組下拉不再被 ＋ 蓋住

### R21 手機 tab 列捲動提示
- ≤640px `nav.tabs` 右緣 mask 漸隱 — 暗示「右邊還有分頁可捲」

### R4 附記
- 「備份提醒卡對比不足」經 v3.26.0 警示聚合（C）已無此卡 — 備份提醒現為聚合卡內 chip，對比達標，R4 關閉

### 驗證
瀏覽器 7 條斷言全過（details 收摺/展開、id 完整、preset 在主行且可用、padding、寬螢幕無 mask）。

---

## v3.27.2 — R29 匯入建新基準：整份取代不再被 merge 救回（2026-07-11）

### 背景（7/10 事故根治）
A 匯入四月設定檔（整份取代意圖）推上雲；B 帶著示範資料 merge — mergeStates 的 union
行為把示範案件「救」回來 → 雲端變混合體。修法：讓「整份取代」有自己的語意。

### 機制
- wrapper 加 `baselineId`（同步基準 id）；meta 加 `lastSyncedBaselineId` + `baselineFresh`
- **匯入 / 清空** → `_newBaselineId()` 換新基準 + 標 `baselineFresh`
- merge 前先檢查（cloudResolveAndMerge + cloudPushNow inline 兩處）：
  1. **本機 fresh**（剛匯入/清空還沒推）→ 跳過合併，本機整份覆蓋雲端（`cloud-baseline-push`）
  2. **雲端 baseline 變了**（另一台整份取代過）→ **先備份本機快照** → 整份採用雲端，
     不 union（`cloud-baseline-adopt` + toast 說明）
  3. baseline 相同或雙方皆無 → 照舊三方合併
- 所有「採用 remote」站點（init pull / pullNow no-base / 兩處 skipPush / fallback）記錄 remote baselineId
- push 成功清 `baselineFresh`；flag 存 meta — 匯入後斷網重開仍記得「本機為準」

### 相容性
- 舊版 app 收到含 baselineId 的 wrapper → 忽略欄位照舊 union（不會壞，退化為現狀）
- 雲端檔沒有 baselineId（舊版推的）→ 走正常合併
- **不動 CURRENT_SCHEMA_VERSION**（baselineId 是 wrapper metadata，不是 data schema）

### 驗證
- 瀏覽器 9 條斷言全過：adopt 整份採用非 union、fresh 整份覆蓋、wrapper 帶 id、
  flag 清除、同 baseline noop、null baseline 相容
- 同步鐵則 8 項 self-review 全過（fresh push 搶鎖+pendingAfter、finally 清理、兩台場景）

---

## v3.27.1 — 批次1 體驗小修：R15/R17/R18/R22 + R3（2026-07-11）

### R17 Modal dirty-check + focus 管理
- `_jobFormSig()` 表單簽章：開 modal（新增/編輯）記快照，「取消」時有未儲存變更 → confirm「放棄編輯？」
- 儲存成功路徑 `closeJobModal(true)` 跳過檢查；`duplicateJob` 切換後重設基準（複製完直接關不吵）
- 開 modal focus 第一欄（案件名稱）
- **更新流程 A 案**：`showUpdateConfirmModal` 偵測編輯中有未儲存變更 → 擋下並提示先儲存
  （備份備的是 state，表單輸入只在 DOM — 不擋的話 reload 直接蒸發）

### R18 驗證錯誤 inline
- `_markFieldError()`：欄位標紅（.input-error）+ focus + 輸入即解除；標題/金額/外包金額三處驗證套用

### R15 首次體驗不再撞牆
- `showSyncErrorOverlay` 加最前置檢查：從未連過雲端（無 trackerFileId）→ **永不鎖屏**
- 理由：鎖屏防的是兩地衝突，沒有雲端檔就沒有另一台；試用者載範例資料不再被「編輯已暫停」擋臉

### R3「未登入」banner 降級
- 紅 → 黃（`.banner-local`，紅色留給真同步失敗）
- 加 ✕ 可關（`ftLocalBannerDismissed_v1`，UI 偏好獨立 key 合規）；登入成功自動清除記憶（登出後提示會回來）

### R22 雙歡迎 UI 擇一
- onboarding modal 開著時隱藏 dashboard 歡迎卡；關閉後（仍空資料）歡迎卡接手

### 驗證
瀏覽器 14 條斷言全過（dirty 確認/拒絕不關/更新入口擋 dirty/inline 錯誤+自動解除/無雲端不鎖/banner 黃+可關+登入重置/雙歡迎互斥）。

---

## v3.27.0 — 設計 E1 帳本色盤 + F 圖表升級（2026-07-10）

### 使用者選擇
> Before/After 對照頁看過 E 兩案後選「E1 其他依你提案」（= E1 + F）。

### E1 帳本色盤（light + dark 全套）
- Light：暖紙底 `#f4f2ec`、卡 `#fdfcf9`、墨綠 primary `#0f766e`、金額金 `--warning: #b45309`、
  暖灰 muted/border、danger/orange/success 全數調暖
- Dark：暖黑 `#1c1a15`（不是冷灰）、茶青 primary `#35b5a8`、金 `#e0a458`，同一個「帳本」世界
- dark input bg、theme-color meta（靜態 + setTheme 動態）同步換
- 業主色盤（COLORS）與圖表 series 色不動 — 那是資料色

### F 圖表升級
- **收益圖（drawRevChart）**：
  - 顏色改讀 CSS 變數（primary/success/warning），跟主題含 dark 一致，不再 hardcode Tailwind 色
  - 趨勢線下加漸層面積（primary 20%→0）
  - hover 十字線 + tooltip：該期間 已收/待收 + **業主構成 top 4 + 其他**（業主色方塊），
    新 `_periodClientBreakdown()` + `_revChartBindHover()`，右側自動翻邊
- **Dashboard 月度趨勢**：雙色（已收/待收）長條 → **業主色堆疊**（誰餵飽這個月一眼看出），
  segment title tooltip + 6 個月 top 5 業主 legend；已收/待收數字保留在文字行

### 驗證
12 條斷言全過（E1 tokens 亮暗、堆疊 segs、漸層/十字線/tooltip 顯示與隱藏、trend=primary）+ 雙主題截圖目視。

### 影響範圍
- `css/style.css`：:root + dark 兩個 token 區塊、.rev-tip
- `js/app.js`：drawRevChart、_periodClientBreakdown、_revChartBindHover、renderDashboard 月度圖、setTheme meta
- **不碰** 同步 / schema / 業主色資料

---

## v3.26.0 — 設計改版 A-D：錢是主角、警示聚合、業主色 signature（2026-07-10）

### 使用者核准
> Before/After 對照（artifact）看過後「全做」。色盤/字型/emoji 不動（E 案另行預覽）。

### A. 金額排版系統
- `body { font-variant-numeric: tabular-nums }` — 全站數字等寬，對帳位數垂直對齊
- 新 `fmtM()`：NT$ 前綴 `<span class="cur">`（0.68em、灰、細）— 數字才是資訊
- 套用：stat 卡（countUpStat 改 innerHTML）、年度累積、jobRow、報表模式 t-amount、rev-summary
- 金額字重統一 650 + letter-spacing -0.01em

### B. 型階
- `.stat .value` 22 → 30px、年度累積 15 → 18px — 三秒讀完本月狀態

### C. 警示聚合 + Dashboard 重排
- 順序改：本月 hero 三卡 → 年度 → 今天的重點 → 警示 → 近期案件（錢在最上）
- `renderAlerts()` 重寫：五條彩色 banner → 一張聚合卡（chips 一行 + 單一展開明細）
- 嚴重度分級 `_alertSev`：red（逾期/異常拖款）> yl（到期/請款日）> or（待收/尾款/月底）> pu（備份等）
- 互動：點 chip 展開明細、再點展開中的 chip 或「查看 →」= 前往原 onClick
- dark mode chip 配色另調

### D. 業主色 signature
- 9px 小圓點 → 20px avatar chip（業主色底 + 名字首字），案件列表/報表/dashboard 近期案件全套用
- row-compact 左緣 3px 業主色條
- chip 可點跳業主（原 dot 行為保留）

### 驗證
- 瀏覽器 12 條斷言全過（DOM 順序 / 聚合卡 5 chips / .cur / 30px / tabular / chip / border / quick actions 完整 / rev-summary）
- 深淺兩主題截圖目視 OK、console 零錯誤

### 影響範圍
- `index.html`：dashboard 區塊重排；`css/style.css`：token/型階/聚合卡/chip
- `js/app.js`：fmtM、countUpStat、renderAlerts、jobRow、jobRowCompact、renderJobsTable、rev-summary
- **不碰** 同步 / schema / 色盤 / 字型

---

## v3.25.5 — sync chip 改顯示雲端版本絕對時間，兩台逐字相同（2026-07-10）

### 使用者反饋
> 「版號應該要依照雲端檔案的版本號？#後面是不是直接寫日期時間？我要兩邊電腦看到一模一樣」

### 查證結果（沒改壞的部分）
- `#N` **本來就是雲端檔案版本號**（meta.lastSyncedVersion = 雲端 wrapper.version），
  之前兩台不同是 v3.25.4 修掉的 ping-pong bug，不是顯示來源錯
- 「N 分前」也不是本機檢查時間 — 從 lastSyncedAt（雲端這版資料時間）算，但相對時間會流動、不好口頭核對

### 改動
- chip 從 `☁️ #16 · 3 分前` → **`☁️ #16 · 07/10 14:32`**（雲端版本的絕對時間 MM/DD HH:mm）
- 兩台同步到同版本 → chip 逐字相同，一眼核對
- tooltip 補「兩台電腦 #號相同 = 資料同一份」+ 保留完整時間與相對時間
- 新 `cloudFormatChipTime()`；亞秒級的 lastSyncedAt 來源差異（pusher 存 Drive modifiedTime、
  puller 存 wrapper.lastModifiedAt）在分鐘級顯示下一致

### 已知極端 case
分鐘交界（xx:59.2 vs xx:59.8）兩台可能差 1 分鐘顯示 — **#N 相同才是「同一份資料」的判準**，時間是輔助。

---

## v3.25.4 — 修「檢查雲端每按一次版本 +1」：sig 改 canonical 比對（2026-07-10）

### 使用者反饋
> 「公司 #17 家裡 #16，家裡按檢查雲端自動變 #18，永遠不會兩邊同步的感覺？版號跟資料應該只會有一份」

### 根因
7/10 匯入事故後兩台的 `jobs` 陣列**順序**分岔（A=匯入檔順序、B=merge union 順序），
`_cloudDataSig` 用 `JSON.stringify` 對陣列順序敏感 → 內容相同仍判「有變動」→
skipPush 永不成立 → 每次 pull+merge 都白推一版 → 版本 ping-pong（#16→#17→#18…）。

### 修法
- 新增 `_cloudStableStringify`：物件 key 排序 + undefined 欄位忽略的 deterministic 序列化
- `_cloudDataSig`：clients / jobs / invoiceHistory **先按 id 排序**再 canonical 序列化
- 語意：「兩台陣列順序不同但內容相同」= 無變動 → noop 對齊，不推
- 仍然敏感的：任何欄位值變動、entity 增刪、**有序陣列**（tags、payments 順序）

### 驗證
瀏覽器 8 條斷言全過：順序無關判等、真變動/增刪仍偵測、巢狀有序陣列仍敏感、
undefined 忽略、null 保留、mergeStates 端到端 noop、500 筆 sig 1.4ms。

### 影響範圍
- `js/app.js`：`_cloudDataSig` + 新 `_cloudStableStringify`（cloudPushNow 頂層 skip、
  cloudResolveAndMerge / inline merge 的 skipPush 三處自動受惠）
- 預期行為：家 #16 按檢查雲端 → 拉 #17 → 內容相同 → 對齊成 #17 **不推 #18**；
  兩台版本從此收斂，只有真編輯才 +1

---

## v3.25.3 — R25 log 三件套 + R24 calendar 診斷 + 熱路徑小修（2026-07-10）

### R25 log 分流 / 降噪 / 使用統計
- `logAction` 加 `cat: user|sys`（依 type prefix 自動分類），日誌 viewer 類型篩選加「👤 只看操作 / ⚙️ 只看系統」
- **降噪**：`cloud-push` / `cloud-pull` 成功不再逐筆佔 500 額度 → 進 `cloud-ftSysCounters_v1` 每日聚合（留 30 天）；error / conflict / signin / snapshot 照舊逐筆
- **via 欄位**：`job-done` / `job-paid`（quick action 路徑）標 `via:'quick'`；`job-create` 標 `via:'fab'|'duplicate'` — 以後 log 自己會回答「複製功能有沒有人用」
- **usage counter**（`cloud-ftUsageCount_v1`，lifetime、獨立 key、屬分析數據非業務資料）：
  - `tab:{name}` — switchTab 計數，補「唯讀行為不在 log」的熱區盲點
  - `act:{type}` — 每個 user 事件 lifetime 計數，突破 500 筆上限
- 日誌 modal 加「📊 匯出統計」→ `{usage, sysCounters, recentEvents}` JSON，丟 AI 做 usage-driven 分析

### R24 calendar-sync 全量 PATCH 診斷儀表
- `_calendarEventDiffers` 改回傳「第一個不同的欄位名」；`cloudSyncCalendar` 統計 `diffFields` 掛進 calendar-sync log
- 背景：操作 log 顯示每輪 updated ~530（全量），下次真實同步的 log 會直接指出兇手欄位

### 熱路徑小修（使用者自述熱區：總覽/新增案件/請款單/月收益）
- **R8**：總覽「月底快到」卡點擊死碼修復（原 onclick 三元式兩分支都空）→ 點了跳請款單分頁
- **R6**：收益 summary 卡 5+1 孤兒排版 → 固定 3 欄（6 卡 = 3×2），≤560px 2 欄

### 影響範圍
- `js/app.js`：logAction 區塊、openActionLogModal / renderActionLog、switchTab、toggleDone / togglePaid / saveJob 的 log 呼叫、_jobCreateVia、exportUsageStats、_calendarEventDiffers、cloudSyncCalendar、renderTodayTodo
- `index.html`：日誌 modal 加匯出鈕；`css/style.css`：summary-grid
- **不碰** mergeStates / push / pull 核心、不碰 schema（counter 是分析數據，走獨立 key 合規）

---

## v3.25.2 — 不打斷使用者：離線不鎖編輯、401 自動續約、row 一鍵複製（2026-07-10）

### 使用者反饋
> 「不要一直要求使用者重新登入 以及編輯中 或是各種操作」＋ 複製功能要簡易直覺

### 同步打斷點三連修（R26/R27/R28）
1. **R26 離線不鎖編輯**：`offline` 事件原本直接進 error → 20 秒後全屏「編輯已暫停」鎖。
   改：`showSyncErrorOverlay()` 開頭 `!navigator.onLine` → 不鎖（單機離線改動存 localStorage，
   上線自動推 + mergeStates 兜底）；`online` listener 補「上線後 20 秒仍 error 才重新評估鎖定」。
2. **R27 編輯中不彈全屏鎖**：guard 觸發時若 `_isAnyModalOpen()` → 延後 15 秒再評估（`_syncGuardDeferTimer`，
   cloudSignOut 一併清理），紅 banner 仍在。打字打到一半不再被蓋臉。
3. **R28 假重登要求**：
   - `driveFetch` 401 → 強制過期本機 token → `ensureValidToken()`（silent refresh）→ 自動重試一次，
     救不回才丟 DriveAuthError。「請重新登入」變成最後手段。
   - `_handleSilentRefreshFailure` 文案分流：斷網/timeout → 「📶 網路不穩，改動已存本機」；
     只有真 auth 問題才顯示「請重新登入」。
   - `ensureValidToken` / 積極 retry 的資格判斷加 `refreshToken`（code flow 下 tokenClient 未 ready 也能續約）。

### R16+R23 案件列 quick action
- 熱區 24px（實測被擠到 8-11px）→ min 28×28；觸控裝置 hover 不存在 → 常駐顯示 + 44px 熱區
- row / 報表模式加「⧉ 複製為新案件」：`duplicateJobFromRow()` = 開 modal 複製模式 + 標題全選，
  流水案件（案例修圖-人名）3 動作完成：改名 → 改金額 → Enter

### CLAUDE.md 鐵則
- 新增「🚨 不打斷使用者鐵則（v3.25.x refresh token 時代起）」：重登 = 最後手段、
  網路問題不偽裝 auth 問題、離線不鎖編輯、modal 開啟不彈全屏鎖、更新提示永遠被動

### 影響範圍
- `js/app.js`：driveFetch、_handleSilentRefreshFailure、showSyncErrorOverlay、online listener、
  ensureValidToken、aggressive retry、row 模板 ×2、duplicateJobFromRow
- `css/style.css`：.row-quick-actions 尺寸 + touch 常駐
- **不碰** mergeStates / push / pull 核心、不碰 schema

---

## v3.25.1 — 修 mergeStates 漏 invoiceHistory + 無變動跳過 push（2026-07-09）

### 背景
分析 5/11 操作日誌（版本 29→55 兩分鐘燒 26 版的自撞迴圈，v3.24.21/23 已滅火）時，發現現行 code 四個殘留問題。

### 修法（js/app.js 四項）
1. **mergeStates 漏 invoiceHistory（資料遺失路徑）**
   - 舊：`merged = { clients, jobs, config }` — 請款歷史不進三方合併
   - 後果：B 電腦走 merge 路徑後 push，用 B 本機 invoiceHistory 蓋掉雲端 → A 電腦的請款紀錄遺失
   - 修：`_cloudMergeEntityList('invoice', ...)` 進 mergeStates，merged 帶 invoiceHistory（新到舊排序，配合 unshift+200 上限）
   - 兩處衝突改寫（cloudResolveAndMerge / cloudPushNow inline）加 invoice type 映射
   - 舊 snapshot 沒 invoiceHistory key → 兩邊 entry 都當新增保留（方向是復活不是遺失），下次同步 snapshot 補全
2. **skipPush 是死碼**
   - 舊比對 `JSON.stringify(merged) === JSON.stringify(remote)` 永不成立：(a) merged 少 invoiceHistory key (b) `config.lastModifiedAt` 每次 save() 都 bump
   - 修：新增 `_cloudDataSig()`（排除 config.lastModifiedAt），兩處 skipPush 改用
3. **cloudPushNow 無條件推送**
   - 頂層加「state === 上次同步快照 → 跳過 push」（sig 比對），純 UI 動作觸發的 save() 不再白推一版
   - 快照不存在（新裝置）→ 不跳過，照常 push
4. **inline merge 路徑漏清 cloudPushTimer**
   - v3.24.36 的 inline merge `applyTrackerData` 後沒清 timer（clean 分支 v3.24.21 就有清）→ 每次衝突解完 2 秒後多推一版
   - 修：對齊 clean 分支，清 timer

### 驗證
- `node --check` 過
- 瀏覽器實跑 9 條斷言全過：invoiceHistory 三邊合併保留 A+B+C、remote 改 status 生效、sig 忽略 lastModifiedAt 但抓得到真 config 變動、no-op merge sig 相等、delete-vs-edit 正確標 invoice conflict
- 同步鐵則 8 項 self-review 全過（無新觸發點、跳過檢查在搶鎖前且無 await、跳過路徑不動 lastSyncedAt、新碼全包 try/catch fallback 照常 push）

### 影響範圍
- `js/app.js`：`mergeStates`、新增 `_cloudDataSig`、`cloudResolveAndMerge` skipPush/衝突改寫、`cloudPushNow` 頂層跳過 + inline merge 清 timer
- 三處版號 → v3.25.1
- **不碰** schema（無新欄位、CURRENT_SCHEMA_VERSION 不動）、不碰 auth 層

---

## v3.25.0 — 登入改 authorization code flow，silent refresh 免 popup（2026-07-09）

### 使用者反饋
> 「幾乎每天都要求重登」

### 根因
GIS implicit flow 不發 refresh token，續約靠 `requestAccessToken({prompt:''})` 開 Google popup。
分頁常駐跨夜 → token 過期 → 早上喚醒觸發 silent refresh → **無使用者手勢的 popup 被瀏覽器擋** → 3 次 retry 全敗 → 紅 banner 要求重登。兩台電腦每天發生。

### 修法：Cloudflare Worker token broker + code flow
- 新增 `cloudflare-worker/worker.js`（部署在 `tracker-token-broker.james40114.workers.dev`）：
  - `POST /exchange`：authorization code → access + refresh token
  - `POST /refresh`：refresh token → 新 access token
  - client_secret 只在 Worker 加密環境變數；CORS 鎖 github.io + localhost；不存資料不留 log
- `app.js` auth 層：
  - `initCodeClient`（ux_mode popup）與既有 `initTokenClient` 並存
  - `cloudSignIn()` 優先走 code flow → `cloudOnCodeResponse` → Worker `/exchange` → 餵既有 `cloudOnTokenResponse` 全套流程
  - `_silentRefresh()` 有 refresh token 時走 `_refreshViaWorker()`（背景 fetch，20s timeout，**不開 popup**）
  - `invalid_grant`（token 被撤銷/半年未用）→ 清 refresh token → fallback 舊 popup 路徑
  - 暫時性失敗（斷網/Worker 掛）→ 走既有 3 次指數退避 + 5 分長 retry，refresh token 保留
  - auth 持久化 payload 加 `refreshToken`（僅 localStorage，不進雲端 tracker 檔）
  - 登出：多撤銷 refresh token（`oauth2.googleapis.com/revoke`）
- 前置作業（GCP）：OAuth consent screen 發布 production（refresh token 不受 testing 7 天限制）

### 效果
- 登入一次後續約全程無感；重登頻率：每天 → 幾乎永不（手動撤銷授權或半年不用才需要）
- 無 refresh token（舊登入狀態）或 Worker 掛掉 → 自動 fallback 回 v3.24.x popup 行為，不會更糟

### 影響範圍
- `js/app.js`：auth 常數/state/save/load、`cloudInitGoogleAuth`、`cloudSignIn`、新增 `cloudOnCodeResponse` + `_refreshViaWorker`、`_silentRefresh`、`_scheduleSilentRefresh` guard、`cloudSignOut`
- 新檔 `cloudflare-worker/worker.js`
- 三處版號 → v3.25.0
- **不碰** schema / mergeStates / push / pull 邏輯

---

## v3.24.40 — 今天的重點卡只留「月底」+「拖款」兩類，砍跟 alerts 重複的 3 類（2026-05-16）

### 使用者反饋
> 「幫我保留 4 跟 5 就好 其他都先不要」

### 砍掉的 3 類（renderTodayTodo line 11487-11537）
1. 🔴 **今天截止** — alerts 「逾期未完成」+「即將到期」涵蓋
2. 🟡 **即將到期**（1-3 天內）— alerts 「即將到期」涵蓋（含今天）
3. 🟠 **完成已久未收款** — alerts 「完成已久未收款」涵蓋

### 保留的 2 類
4. 📅 **月底快到提醒**（從 `monthEndReminderDay` 起，點擊跳請款分頁）
5. 🐢 **拖款警告**（沿用 `computeSlowPayJobs`，最多 3 筆）

### 順便調整
- 空 state 文字從「今天沒有截止 / 拖款警告 / 月底提醒…」改成「今天沒有月底 / 拖款提醒，其他待辦看上方紅黃橘提醒區」— 引導使用者注意 alerts

### 取捨
- today-todo 變得很精簡，只當「行動觸發」（月底該整理請款 / 拖款該追討）
- 所有「截止 / 即將到期 / 未收款」資訊由 alerts 區塊負責，避免兩處重複顯示

### 影響範圍
- `js/app.js`：`renderTodayTodo`（line ~11476）砍 3 段邏輯
- 三處版號 → v3.24.40

---

## v3.24.39 — 修「dropdown 看不到登出」bug + ↻📜 拉回常駐（2026-05-16）

### 使用者反饋
> 「右上角沒出現登出？你看一下是不是哪裡有問題 然後幫我把重新整理跟操作日誌按鈕放出來 不要縮起來」

### 根因：v3.24.38 dropdown 被 `.top-bar` stacking context 截斷
`.top-bar { position: sticky; z-index: 20; }` 建立 stacking context。
dropdown menu `position: absolute; z-index: 1000;` 在 `.top-bar` 內 — 它的 z-index 1000 只在 `.top-bar` 內生效，對 `.top-bar` 外面的元素仍受限於 `.top-bar` 的 z-index 20。任何 main 內 z-index ≥ 30 的元素都會遮 dropdown，導致使用者點 pill 後看不到內容。

### Fix 1：dropdown 改 position:fixed 跳脫 stacking context
- CSS：`.account-dropdown-menu` 從 `position: absolute; top: calc(100% + 6px); right: 0; z-index: 1000;` 改為 `position: fixed; z-index: 99990;`
- HTML：拿掉 `.account-dropdown` wrapper，dropdown menu 跟 pill 平行（仍在 .top-bar 內，但 fixed 不受影響）
- JS：`toggleAccountDropdown(forceState, pillEl)` 接收 pill 元素，動態計算 `top` / `right`：
  ```js
  const rect = pill.getBoundingClientRect();
  menu.style.top = (rect.bottom + 6) + 'px';
  menu.style.right = (window.innerWidth - rect.right) + 'px';
  ```
- closeHandler 判斷改為 `!e.target.closest('#account-dropdown-menu') && !e.target.closest('#cloud-account-pill')`（menu 不再是 pill 的子元素）

### Fix 2：↻ 📜 拉回常駐（不再藏在 ⋮ overflow menu）
- 移除 `<div class="topbar-overflow">` 包裝
- ↻ 重新整理 + 📜 操作日誌 直接放在 🔍 跟 🌓 之間，跟 v3.24.36 之前一致

### 影響範圍
- `index.html`：top-bar 拿掉 `.account-dropdown` wrapper + 移除 ⋮ overflow menu + 加回 ↻📜 button
- `css/style.css`：`.account-dropdown-menu` 改 fixed
- `js/app.js`：`toggleAccountDropdown` 加 `pillEl` 參數 + 動態定位邏輯 + 修 closeHandler

### 沒清掉的 dead code
- `toggleTopbarOverflow` 函式 + `.topbar-overflow-menu` CSS 仍保留（無 UI 入口呼叫，但留著無害；之後想再用 overflow 可重啟）

### self-review 8 項
1-8 全過：position:fixed 不影響任何同步邏輯，純 UI 修補。

---

## v3.24.38 — 加 sync-info chip + account pill 改 dropdown menu（2026-05-16）

### 背景
使用者要求「右上角多一顆顯示『已取得雲端最新資料 版本:****』」+「點 Google 圖示不要跳設定，要登出/其他功能」。

### Fix 1：sync-info chip（新元件）
位置：`#cloud-account-pill` 左邊新增 `#sync-info-chip`

顯示邏輯：
- **未登入** → 隱藏
- **idle + 有 lastSyncedAt** → 藍底「☁️ #N · X 分前」
- **idle + 尚未同步** → 「☁️ 等候同步…」
- **syncing / pending** → 黃底「⏳ 同步中…(N)」
- **error** → 紅底「⚠️ 同步失敗 · 點此重試」

點擊行為：
- error → 觸發 `cloudRetryPush()`
- 其他 → 觸發 `cloudPullNow()` + toast「☁️ 重新檢查雲端中…」

hover title 顯示完整時間 + 版本資訊。

### Fix 2：cloud-account-pill 改 dropdown menu
位置：HTML 包進 `<div class="account-dropdown">`，onclick 從 `cloudOnPillClick` 改 `toggleAccountDropdown`

Pill 顯示改成：「頭像 + James ▾」（移除 sync 後綴文字，那部分由 chip 接管）。

點擊行為：
- **未登入** → 直接觸發 `cloudSignIn()`
- **已登入** → 展開 dropdown menu，再點外面關閉

dropdown 內容（5 個區塊）：
1. **帳號資訊**（不可點）：姓名 + email
2. **狀態資訊**（不可點）：☁️ 雲端版本 #N / 🕐 N 分前同步
3. **🔍 重新檢查雲端**（點擊 → 同 chip 行為）
4. **⚙️ 雲端同步設定**（點擊 → 跳設定頁）
5. **🚪 登出 Google**（紅字 + `confirm()` 確認後 `cloudSignOut()`）

### 順便清掉
v3.24.37 在設定頁雲端區加的「進階：手動觸發」摺疊區 — chip + dropdown 都接管了，那個冗餘，移除。

### 邏輯整合
- `cloudRenderAccountPill`：拿掉 sync 後綴文字（chip 接管）
- `cloudUpdateSyncIndicator`：內部呼叫 `renderSyncInfoChip` 確保 chip 跟著 status 變化
- 30 秒 indicator ticker 也會跑 chip 渲染（相對時間「5 分前 → 6 分前」自動跳）

### 影響範圍
- `index.html`：top-bar 加 `#sync-info-chip` + 包 `#cloud-account-pill` 進 `.account-dropdown`；設定頁刪「進階：手動觸發」摺疊
- `css/style.css`：新增 `.sync-info-chip` / `.account-dropdown-menu` / `.ad-header` / `.ad-status` / `.ad-item` / `.ad-divider` 樣式
- `js/app.js`：新增 `renderSyncInfoChip` / `onSyncInfoChipClick` / `toggleAccountDropdown` / `renderAccountDropdownMenu` / `confirmCloudSignOut`；`cloudRenderAccountPill` 改為純帳號顯示；`cloudUpdateSyncIndicator` 接通 chip

### self-review 8 項
1. **新觸發點撞車？** ✓ chip 點擊呼叫既有 cloudPullNow / cloudRetryPush，無新同步入口
2. **mutable 入口併發保護？** ✓ 沿用既有 flag
3. **時間戳一致？** ✓ 不動，僅顯示
4. **失敗 alert？** ✓ confirm() 給登出（避免誤點），其他無 alert
5. **finally 清理？** ✓ dropdown 點外面關閉走 closeHandler
6. **無變動還 push？** ✓ chip 點擊走既有 pull，內部 skipPush 邏輯保留
7. **睡眠 throttle？** ✓ 30 秒 ticker 處理相對時間更新
8. **異地兩台場景？** ✓ chip 隨 cloudResolveAndMerge 完成自動更新版本號

---

## v3.24.37 — UX/UI 直覺化 ABDEF 大改裝 + revert badge（2026-05-16）

### 背景
使用者要求「左上版本號保留原樣 + 其他 UX/UI 看有沒有改善空間 直覺一點」。spawn Plan agent 找到 15 條建議，使用者選做 A+B+D+E+F（跳過 C 請款分頁雙軌制）。額外驗證「立即同步」按鈕必要性 → 選保留但去主視覺化。

### revert v3.24.34
- `updateVersionBadge` 回顯示「v3.24.37 · 最新 / 🆕 點此更新」，資料時間已在 cloud-account-pill 顯示，不再 badge 重複

### A. 右上工具列瘦身
- **A1**：砍 `#sync-indicator` pill，狀態合進 `#cloud-account-pill`（光暈顏色 + 後綴文字「· ⏳ 3」「· ✗ 同步失敗」）。一個元件講一件事
- **A2**：↻ 重新整理 + 📜 操作日誌 收進 `⋮` overflow menu（新增 `toggleTopbarOverflow` + CSS `.topbar-overflow-menu`）
- **A3**：主題按鈕從 `<button>主題</button>` 改 emoji `🌓` + 統一 `topbar-icon-btn` class，視覺一致

### B. Dashboard 行動優先
- **B1**：`#today-todo-card` 永遠顯示在 stat-grid 上面（空 state 顯示「☕ 今天沒有截止 / 拖款警告 / 月底提醒，享受空檔吧」）— 取代原本 hidden 設計
- **B2**：stat 4 卡 → 3 卡（已收 / 待收 / 待完成），年度收益降為次行 caption `.stat-year-caption`（單行小字）

### D. 案件視覺
- **D1**：5 視圖 → 3 視圖（comfort + card 砍掉，跟 compact 重疊）。保留：📋 列表（compact，預設）/ 📊 報表 / 🗂️ 看板。按鈕加文字 label
  - 既有使用者 localStorage 'comfort' / 'card' 自動 mapping 到 'compact'
- **D2**：進行中案件加左色條 `border-left: 3px solid var(--primary)` indicator（`.row.state-pending` / `.row-compact.state-pending`），一眼分辨「還在做」
- **D3**：案件 modal 已完成 + amount > 0 + 未付清 → 收款狀況預設展開（標收款是最高頻動作）

### E. 設定頁瘦身
- **E1**：「💾 離線資料備份」`<details>` 從 collapsed 改 `open`（匯出 JSON 是常用操作）
- **E2**：mascot 預設 OFF（`mascotState.enabled = false`、`mascotInit` 改 `=== true` 嚴格判斷）。既有使用者 `config.mascotEnabled === true` 仍維持
- **E3**：9 個 mascot 狀態預覽 dev tool 整段移除（idle/loading/thinking/success/error/searching/celebrating/sleeping/wink），完全不該在 user UI
- **E4**：「🔄 立即同步」改純文字連結樣式 `🔍 重新檢查雲端`，搬進「▸ 進階：手動觸發」摺疊區，附說明「平常會自動同步，這裡是給想手動驗證用的」

### F. 其他
- **F1**：行事曆 legend 從純文字「方框內顏色=業主色 · 黃框=完成未收款 ...」改 chip-style 視覺示意（`.cal-legend-chip` 三個彩色 chip + 一句 hint）
- **F2**：stat 卡左框 3px → 4px（4 種角色 warning/danger/success/info/year 更明顯）
- **F3**：案件 modal sticky 儲存列 — 一查 `.modal-actions` 在 v3.6.x 就是 sticky 了，跳過

### 影響範圍
- `index.html`：top-bar 結構（A1+A2+A3）、dashboard（B1+B2）、案件 tab 視圖切換（D1）、行事曆 legend（F1）、設定頁雲端區（E4）、mascot 區（E2+E3）、離線備份 details（E1）
- `css/style.css`：`.topbar-overflow-menu` 樣式、stat 卡 4px 邊框、`.stat-year-caption`、`.row.state-pending` 進行中色條、`.cal-legend-chip` 行事曆 legend
- `js/app.js`：`cloudRenderAccountPill` 後綴文字、`toggleTopbarOverflow`、`renderTodayTodo` 空 state、`jobsView` 預設改 compact + 舊值 mapping、`setJobDetailsOpenState` 已完成展開收款、`onMascotEnabledChange` 顯示 extra-settings、`mascotState.enabled` 預設 false、`updateVersionBadge` revert
- `service-worker.js`：CACHE_VERSION → v3.24.37

### 取捨 / 沒做的
- 跳過 C 請款分頁雙軌制（5 preset + 5 checkbox + 5 匯出按鈕統一改造）— 使用者明確不選
- 砍 mascot 整段：使用者明確說「對孤獨工作者是情緒燃料，留 toggle」→ 預設關 + 砍 dev tool 即可

### 反建議（不做的事）
- 不加「立即同步」主按鈕到 top bar — 同步應該隱形，使用者只看狀態就好
- 不把「子任務」「折扣」details 改成預設展開 — 案件 modal 已經夠長

---

## v3.24.36 — 第二輪深挖：修 push 死循環 / 「永不重登」UX 8 個 bug（2026-05-16）

### 背景
使用者要求「繼續尋找 然後確保我各地電腦編輯都不會出現同步跟登入登出問題等等」。並行 spawn 2 個獨立 agent 從不同角度深挖（同步 race / 登入登出 UX），各找到 6+9 個新問題。本次修最致命的 8 個。

### Fix N16（🔴 critical push 死循環）：cloudPushNow version check inline merge
**問題**：cloudPushNow 在 version check 偵測到雲端較新時 `await cloudResolveAndMerge(...)`。但 cloudPushNow 已搶 cloudPushInProgress 鎖 → cloudResolveAndMerge 內部偵測 in progress → 設 pendingAfter return → 沒實際 push → finally setTimeout 觸發 pendingAfter cloudPushNow → 又進 version check → 又走 cloudResolveAndMerge → 又走 pendingAfter → **死循環 fetch/merge 但永遠 push 不上去**（直到網路抖動或對齊 modifiedTime）。

**修法**：把 cloudPushNow version-check 路徑改為 inline 處理 mergeStates + conflict + skipPush，不再呼叫會自己搶鎖的 cloudResolveAndMerge：
- 純函式 mergeStates
- 衝突自動 remote-wins + fire-and-forget 備份
- skipPush 路徑提早 return
- 需要 push：state 已是 merged → 繼續走外層 cloudPushNow 後面的 buildTrackerWrapper + driveUpdateFile（caller 已搶鎖）

### Fix N1（🔴 critical init flag 卡死）：cloudInitTrackerFile 包 try/finally
**問題**：cloudResolveAndMerge throw → cloudInitInProgress 永遠 true → 後續所有 cloudInitTrackerFile 被擋 → 整個 app 拿不到雲端資料。

**修法**：把主體包 try/finally，finally 內 `cloudInitInProgress = false` + `hideInitOverlay()`（雙保險）。

### Fix B5（🔴 critical 假登入卡死）：access_denied / invalid_grant 直接登出
**問題**：Google 端撤銷 token → `resp.error === 'access_denied'` → 走 `_handleSilentRefreshFailure` 3 次 retry 全失敗 → 卡 error，但 `cloudAuthState.user` 還在、pill 仍顯示登入 → 使用者困惑地「✗ 同步失敗 + 已登入」。

**修法**：cloudOnTokenResponse 內偵測 error code = `access_denied` / `invalid_grant` / `unauthorized_client` → 直接 `cloudSignOut()` 清狀態 + toast「Google 端已撤銷授權，請重新登入」。

### Fix B6（🔴 critical 編輯被覆蓋）：modal 開啟時延後 auto pull
**問題**：使用者編輯案件 modal 中，silent refresh 成功 → cloudAutoPullThrottled → cloudPullNow → applyTrackerData → state 被改寫 → 使用者按存檔可能蓋掉 remote 改動 / 找不到原本 job。

**修法**：cloudAutoPullThrottled 內加 `_isAnyModalOpen()` 檢查，modal 開啟時延後 30 秒再試。

### Fix B7（🟡 鐵則被繞過）：暫時關閉期間每 30 秒積極 retry
**問題**：使用者按「暫時關閉 5 分鐘」後 overlay 移除，但 status 仍 error。5 分鐘內可不停編輯，背景沒主動修復。

**修法**：`dismissSyncErrorOverlayTemp` 內排 `_syncErrorAggressiveRetryTimer` 每 30 秒主動 silent refresh + push retry，5 分鐘到才 stop 並 reshow overlay。

### Fix B1（🔴 永不重登核心）：silent refresh 3 次失敗後 5 分鐘長間隔 retry
**問題**：`_handleSilentRefreshFailure` 達 MAX 後不主動 retry，靠 visibility / focus / heartbeat / periodic 外部 trigger。使用者不切視窗 + 不編輯 + 電腦不睡眠 → silent refresh 永遠不會再試 → 即使 Google session 恢復可用，使用者仍要手動重登。

**修法**：3 次失敗後排 `_silentRefreshLongRetryTimer` 5 分鐘後再試（計數歸零，下次仍走 3 次指數退避）。

### Fix B3（🟡 ensureValidToken 誤判）：retry pending 期間視為仍在 refresh
**問題**：silent refresh 第 1 次失敗 → 排 5 秒後 retry → 5 秒內使用者編輯 → `cloudPushNow` → `ensureValidToken` 看 `_isSilentRefreshing=false` → return false → push 失敗紅 banner。但其實 5 秒後 retry 就會恢復。

**修法**：ensureValidToken 內檢查 `_silentRefreshRetryTimer` / `_silentRefreshLongRetryTimer` 是否還排著，是 → 視為「仍在 refresh 中」繼續等。

### Fix B4（🟡 手動登入被當 silent）：cloudSignIn 設 `_isManualSignIn` flag
**問題**：使用者卡在 silent refresh 中按重新登入 → callback `wasSilentRefresh = _isSilentRefreshing = true` → 走 silent refresh 分支 → 不更新 user info、不跳 calendar prompt → UI 沒反應。

**修法**：新增 `_isManualSignIn` flag，cloudSignIn 入口 set true + 清 silent refresh 進行中 state。cloudOnTokenResponse 內優先 `_isManualSignIn`，true 時不走 silent 分支。

### Fix N4（🟡 no-base 路徑沒備份）：cloudPullNow 沒 snapshot 時也備份本機
**問題**：cloudPullNow line 4070 fallback「沒 base 但有 fileId → 直接 apply」會覆蓋本機。

**修法**：偵測本機有資料 + 跟雲端不同 → fire-and-forget cloudCreateSnapshot 備份本機。

### 順便加的小改進
- **Y6 修**：cloudSignIn 加 2 秒 debounce 防連點開兩個 popup
- **G1 修**：getValidAccessToken 的 token expire buffer 從 60s 拉長到 5 分鐘（Drive API 大檔上傳期間 token 剛好過期 401 風險）
- 衝突備份失敗時加醒目 toast 10 秒提示（cloudResolveAndMerge + cloudPushNow inline 都加）
- cloudSignOut 加清 `_silentRefreshLongRetryTimer` / `_syncErrorGuardReshowTimer` / `_isManualSignIn`

### 還沒處理（agent 報告中的 high，可分批處理）
- **N2**：driveListAppFolder 不分頁，衝突備份累積後 list snapshots 變慢
- **N3**：衝突備份 fire-and-forget 失敗仍 push（已改 toast 提示，但仍非強制）
- **N5 / B9**：BroadcastChannel 沒同步 token / state（multi-tab race）
- **B2 / B8**：GIS callback race window（safety timer 30s 後遲到 callback 走錯分支）
- **Y1 / Y2 / Y4**：restored path init 沒 showInitOverlay 時間差、登出 race、SDK 載入失敗 + restored=true
- **G2 / G4**：periodic refresh check 在 error 時也試、BroadcastChannel 廣播 sign-out
- **L1-L7**：dead code 清理等低優先

### self-review 8 項
1. **新觸發點撞車？** ✓ inline merge 接管 push 路徑，cloudResolveAndMerge 三個 caller 鎖邏輯明確
2. **mutable 入口併發保護？** ✓ cloudPushInProgress 仍是唯一 push 入口鎖
3. **時間戳一致？** ✓ inline 用 result.meta.lastModifiedAt（雲端權威）
4. **失敗 alert？** ✓ silent refresh 失敗用 toast，access_denied 用 toast
5. **finally 清理？** ✓ cloudInitTrackerFile 包 try/finally 雙保險
6. **無變動還 push？** ✓ inline merge skipPush check 跟原 cloudResolveAndMerge 一致
7. **睡眠 throttle？** ✓ B1 用 setTimeout 5 分鐘，睡眠時 throttle 但喚醒 catchUp + heartbeat 雙保險
8. **異地兩台場景？** ✓ N16 inline merge 直接修「version check 偵測雲端新版」場景

### 影響範圍
- `js/app.js`：cloudPushNow（inline merge）、cloudInitTrackerFile（try/finally）、_handleSilentRefreshFailure（B1 + B5）、cloudOnTokenResponse（B5 + B4）、cloudSignIn（B4 + Y6 + debounce）、cloudSignOut（清新 timer）、cloudAutoPullThrottled（B6 + _isAnyModalOpen）、dismissSyncErrorOverlayTemp（B7）、ensureValidToken（B3）、getValidAccessToken（G1 buffer）、cloudPullNow no-base 路徑（N4 備份）、cloudResolveAndMerge + cloudPushNow 衝突備份失敗 toast
- `index.html`：meta version → v3.24.36
- `service-worker.js`：CACHE_VERSION → v3.24.36

---

## v3.24.35 — 獨立 code review 找到 7 個 critical/high bug 全修（2026-05-16）

### 背景
使用者要求「仔細巡一遍利用現有 SKILL 看一下有什麼問題 久一點沒關係」。spawn 獨立 Agent 用 `engineering:code-review` skill 從外部視角審視 v3.24.29 → v3.24.34 全部改動。Agent 在沒看過對話的前提下發現 7 個 critical + 11 個 high。本次優先修 critical + 影響核心鐵則的 high。

### Fix C2（🔴 critical 資料丟失）：revert v3.24.29 的 `base=local`
**問題**：v3.24.29 為避免 base=null 跳衝突 modal，把 `base = local`。但這造成 `_cloudMergeEntity` 對「本機獨有 entity」誤判：
- baseMap = localMap（同一份）
- entity 只在 local 沒在 remote → 走 `if (_cloudDeepEqual(base, local))` → 永遠 true → `return { deleted: true }` → **本機獨有案件全部消失**
- 場景：新裝置 / 清 cache + 雲端有資料 → 登入後本機剛建的案件全部不見

**修法**：恢復原本 `const baseData = base || {}`。
- v3.24.31 後衝突已自動 remote-wins（不會跳 modal 干擾），所以 base=null 走 baseObj={} 邏輯安全
- list-level 行為正確：`!local && !base → remote 新增`、`!remote && !base → local 新增`
- field-level 行為：每個欄位被判 conflict → remote-wins 改寫（衝突前還有 cloudCreateSnapshot 備份）

### Fix C7（🔴 critical 跨帳號污染）：cloudSignOut 清所有 timer
**問題**：watchdog `setTimeout` 沒 ref → 登出後仍會 fire → 若使用者已換帳號 → watchdog 用新帳號 token 推舊資料到新帳號 tracker.json。

**修法**：
- `_cloudPushWatchdogTimer` 改 module-level ref
- `cloudSignOut` 內 `clearTimeout` 全部 timer：watchdog / pushTimer / silentRefresh* / syncErrorGuard*
- 順便 reset：`cloudPushFailRetries`、`cloudPendingChangesCount`、`cloudPushPendingAfter`、`_silentRefreshRetries`、`_isSilentRefreshing`
- 清 sync error overlay（如果在顯示）

### Fix H6（🟡 indicator 騙人）：saveConfigOnly 補 cloudPendingChangesCount++
**問題**：只動 config 的儲存（userInfo / paymentAccounts / 各種 toggle）走 `saveConfigOnly`，**沒 `cloudPendingChangesCount++`**。indicator 上「N 筆待推」顯示 0，使用者看「⌛ 推送中…(0)」可能誤以為沒在 push。違反 v3.24.30 修的「沒同步卻顯示已同步」精神。

**修法**：`saveConfigOnly` 內加 `cloudPendingChangesCount++`。

### Fix H2+H3（🟡 鐵則被繞過）：「暫時關閉」overlay 後 5 分鐘自動重新顯示
**問題**：使用者按「暫時關閉」呼叫 `hideSyncErrorOverlay()` 只 remove DOM。狀態仍是 error，`_syncErrorGuardTimer` 在第一次 setTimeout fire 後是 null，**不會再有新的 grace timer**。若 status 一直卡 error 不變化 → overlay 永遠不會再跳 → 違反鐵則「沒同步擋編輯」。

**修法**：
- 新增 `dismissSyncErrorOverlayTemp()` 取代「暫時關閉」按鈕的 onclick
- 排 5 分鐘 `_syncErrorGuardReshowTimer`，到時若仍 error → 重新顯示 overlay
- toast 提示「⚠️ 已暫時關閉提示，5 分鐘後若仍未同步會再次提醒」
- 按鈕文字改成「暫時關閉 5 分鐘」明確化

### Fix C1（🟢 邊角資料丟失）：isLocalDataEmpty 也檢查 invoiceHistory
**問題**：v3.12.0 加了 `invoiceHistory` 但 `isLocalDataEmpty` 只看 clients / jobs。若本機 clients/jobs 是空但 invoiceHistory 有東西 → 走 Case B `applyTrackerData` 蓋掉本機 invoiceHistory。

**修法**：加上 `noInvoiceHistory` 判斷。

### Fix H5（🟡 base=null 循環）：cloudResolveAndMerge pendingAfter 路徑也寫 snapshot
**問題**：cloudResolveAndMerge 走 clean 分支但搶不到 cloudPushInProgress 鎖時直接 return，**沒寫 snapshot**。下次 mergeStates 又看到 base=null → cloudInitTrackerFile 結尾走補救 pull → 冗餘流程。

**修法**：pendingAfter return 之前 `cloudSaveLastSyncedSnapshot(result.merged)`。pendingAfter 真正 push 成功後 cloudPushNow 會再覆寫 snapshot。

### Fix H11（🟡 登出後 overlay 誤跳）：cloudPushNow 在 isCloudSignedIn=false 時設 idle
**問題**：cloudPushNow 在登出後（watchdog / pendingAfter 跨登出觸發）走 `setSyncStatus('error', '未登入')` → 紅 banner + 20 秒後 overlay 跳出，但其實是登出狀態，error overlay 不合理。

**修法**：改設 `idle`（登出不是同步失敗）。

### 還沒處理（agent 報告 high 的剩餘項目，可分批處理）
- H1：`delete-vs-edit` 的 `local-deleted` 分支只走 remote 復活，UX 提示不夠（使用者本機刪了又出現會困惑）
- H4：`cloudConflictApply` 是 dead code 但內部仍直接 `driveUpdateFile` 繞過 cloudPushInProgress 鎖
- H7：衝突備份（`衝突備份_*` snapshot）累積無限 prune
- H8：toast「已同步另一台電腦」在 snapshot 沒寫成功時誤觸發
- H9：focus push 復活只在 token 還新時 branch 跑
- H10：ensureValidToken 30s vs safety timer 30s 對齊
- C3+C4：cloudResolveAndMerge + cloudPushNow 互相搶 cloudPushInProgress 鎖（pendingAfter 機制收斂但脆弱）
- C5：cloudCreateSnapshot fire-and-forget 拷貝時機 — agent 確認實際 OK，CHANGELOG v3.24.32 解釋錯誤但行為正確
- C6：cloudInitTrackerFile fire-and-forget vs cloudPullNow init 競賽

低優先（L1-L7）：版本註解過多、dead code、命名一致性等。

### self-review 8 項
1. **新觸發點撞車？** ✓ 改動都是「行為修正」沒新增同步入口
2. **mutable 入口併發保護？** ✓ cloudSignOut 全部清乾淨 + cloudPushNow 新走 idle 路徑不會誤觸發 overlay
3. **時間戳一致？** ✓ 不動
4. **失敗會 alert？** ✓ 不 alert
5. **finally 清理？** ✓ snapshot 補寫 + timer 集中清
6. **無變動還 push？** ✓ pendingAfter snapshot 不影響既有 skipPush
7. **睡眠 throttle？** ✓ 不依賴新 timer
8. **異地兩台場景？** ✓ revert base=local 修「本機獨有消失」災難場景

### 影響範圍
- `js/app.js`：`mergeStates`（revert base=local）、`isLocalDataEmpty`、`saveConfigOnly`、`cloudSignOut`、`cloudPushNow`（catch block + isCloudSignedIn）、`cloudResolveAndMerge`（pendingAfter）、`_syncErrorGuardOnStatusChange` + 新增 `dismissSyncErrorOverlayTemp`、sync overlay 按鈕 onclick、新增 `_cloudPushWatchdogTimer` / `_syncErrorGuardReshowTimer` module-level vars
- `index.html`：meta version → v3.24.35
- `service-worker.js`：CACHE_VERSION → v3.24.35

---

## v3.24.34 — app-version-badge 改顯示資料時間 + B 機自動偵測 A 機改動 toast（2026-05-16）

### 背景 / 使用者回饋
1. 右上角 app-version-badge 直接寫 app code 版本（v3.24.33）對使用者不直覺，使用者日常更在意「我這份資料新不新鮮」
2. A 改 → B 開機後雖然自動 pull 雲端 + applyTrackerData 重繪 UI，但使用者沒有清楚提示「資料剛從另一台電腦同步下來」

### Fix 1：app-version-badge 改成資料時間為主
位置：`updateVersionBadge`（line ~13620）

新顯示優先級：
- **有新 app 版本** → 「🆕 vXXX 點此更新」（醒目樣式，保留 v3.24.14 強制備份入口）
- **未登入** → 「📊 未連雲端」
- **已登入** → 「📊 資料：N 分前同步」（從 `cloudGetMeta().lastSyncedAt` 抓相對時間）

hover title 含完整 app 版本號（debug 用）+ 完整同步時間。

接 hook：`cloudUpdateSyncIndicator` 內呼叫 `updateVersionBadge`，badge 隨 sync indicator 一起更新（每 30 秒 ticker 跑時相對時間自動跳）。

### Fix 2：cloudResolveAndMerge 偵測遠端有新改動 → toast
位置：`cloudResolveAndMerge`（line ~1602）

```js
// 比對 remote vs base（上次同步快照）— 不同表示「遠端有人改過」
let remoteHasNewChanges = false;
if (base) {
  const baseSig = JSON.stringify({ clients: base.clients, jobs: base.jobs, invoiceHistory: base.invoiceHistory });
  const remoteSig = JSON.stringify({ ... remote 同樣結構 });
  remoteHasNewChanges = (baseSig !== remoteSig);
}

// 在 result.clean 分支 applyTrackerData 之後：
if (remoteHasNewChanges && !hadConflicts && typeof toast === 'function') {
  toast('☁️ 已同步另一台電腦的最新改動', 4000);
}
```

跟既有「N 筆衝突採雲端」toast 分開：
- 純 remote 更新（無衝突）→ toast「☁️ 已同步另一台電腦的最新改動」
- 有衝突 → toast「☁️ N 筆衝突採雲端（本機已備份到 Drive 快照）」

### 影響範圍
- `js/app.js`：`updateVersionBadge`（line ~13620 大幅改寫）、`cloudUpdateSyncIndicator`（line ~785 加 updateVersionBadge 呼叫）、`cloudResolveAndMerge`（line ~1602 加 remoteHasNewChanges 偵測 + toast）
- `index.html`：meta version → v3.24.34
- `service-worker.js`：CACHE_VERSION → v3.24.34

### self-review 8 項
1. **新觸發點撞車？** ✓ 純 UI 改動 + toast，不動同步機制
2. **mutable 入口併發保護？** ✓ 無新同步入口
3. **時間戳一致？** ✓ 不動
4. **失敗會 alert？** ✓ JSON 失敗 fallback 不 toast
5. **finally 清理？** ✓ 純 string 比對
6. **無變動還 push？** ✓ 既有 skipPush 邏輯保留
7. **睡眠 throttle？** ✓ 不依賴 timer
8. **異地兩台場景？** ✓ B 機 pull 雲端 → 偵測差異 → toast「已同步另一台電腦」→ UI 自動 re-render

### 跟「A→B 隔天」場景的關係
使用者問：「A 電腦改後隔天到 B 電腦會直接跳偵測到新資料嗎？還是 token 過期不會跳？」

答案（v3.24.34 後行為）：
| B 機 token 狀態 | 行為 |
|----------------|------|
| 還有效 | 重整 → cloudInitTrackerFile → pull → toast「☁️ 已同步另一台電腦的最新改動」 |
| 過期 + silent refresh 成功 | 自動拿新 token → pull → 同上 toast |
| 過期 + silent refresh 失敗 | 紅 banner「Google 連線過期，請重新登入」→ 重登後自動 pull + toast |

**不會跳「點此重整頁面」modal**（那是 app code 更新才會的），資料同步是無感的，只有一個 4 秒 toast 提示。

---

## v3.24.33 — 修「重整後右上角登入但編輯資料 indicator 卡 N 小時前」bug（2026-05-16）

### 問題現象
使用者重整頁面：
- 右上角 pill 顯示已登入 Google ✓
- 編輯資料（改案件 / 業主等）
- **但 sync indicator 一直卡「✓ N 小時前同步」**，沒變「⌛ 推送中…」或「⏳ 同步中…」
- 也沒顯示同步失敗紅 banner
- 實際資料只在 localStorage、沒上雲端

### 根本原因（兩個獨立 bug）

#### Bug #A：cloudInitGoogleAuth 的 restored path 沒呼叫 cloudInitTrackerFile
新登入流程（`cloudOnTokenResponse` line ~542）：
```js
cloudInitTrackerFile().catch(e => console.error('[cloud-init] async failed:', e));
```

重整頁面從 localStorage 還原時（`cloudInitGoogleAuth` line 158-213）：
```js
const restored = cloudLoadAuthState();
if (restored) {
  cloudRenderSignedIn();
  // ... silent refresh schedule，沒呼叫 cloudInitTrackerFile ❌
}
```

如果使用者切過帳號 / 清過 cache / 之前 init 失敗，`meta.trackerFileId` 不在 localStorage 裡，restored path 又不會跑 init → tracker file 永遠拿不到 id。

#### Bug #B：cloudSchedulePush 在 trackerFileId 缺失時 silent return
```js
function cloudSchedulePush() {
  ...
  const meta = cloudGetMeta();
  if (!meta.trackerFileId) return;  // ← silent return，indicator 不變
  ...
  cloudSetSyncStatus('pending');
}
```

`!meta.trackerFileId` 時直接 return，**indicator 維持原本 idle 狀態**，顯示「✓ N 小時前同步」（從舊 `lastSyncedAt` 抓的）→ 使用者誤以為已同步，但實際資料根本沒被排程推送。

### Fix

#### Fix A：restored path 補 cloudInitTrackerFile（line ~213）
```js
if (restored && typeof cloudInitTrackerFile === 'function') {
  cloudInitTrackerFile().catch(e => console.error('[cloud-init] restored path async failed:', e));
}
```
靠既有 `cloudInitInProgress` flag 擋併發。

#### Fix B：cloudSchedulePush 主動補救（line ~2080）
```js
if (!meta.trackerFileId) {
  console.warn('[cloud-push] trackerFileId 不存在 → 主動跑 cloudInitTrackerFile 補救');
  cloudSetSyncStatus('pending');  // 至少讓使用者看到「⌛」知道在處理
  if (typeof cloudInitTrackerFile === 'function' && !cloudInitInProgress) {
    cloudInitTrackerFile().then(() => {
      if (cloudPendingChangesCount > 0) cloudSchedulePush();  // init 完重排
    }).catch(e => console.error('[cloud-push] init 補救 failed:', e));
  }
  return;
}
```

### 影響範圍
- `js/app.js`：`cloudInitGoogleAuth`（line ~213）、`cloudSchedulePush`（line ~2080）
- `index.html`：meta version → v3.24.33
- `service-worker.js`：CACHE_VERSION → v3.24.33

### self-review 8 項
1. **新觸發點撞車？** ✓ 兩個入口都靠既有 `cloudInitInProgress` flag 擋
2. **mutable 入口併發保護？** ✓ 同上
3. **時間戳一致？** ✓ 不動
4. **失敗會 alert？** ✓ 只 console，不 alert
5. **finally 清理？** ✓ 既有 hideInitOverlay 已 reset flag（line 708）
6. **無變動還 push？** ✓ init 完成後再呼叫 cloudSchedulePush，會走既有 debounce + skipPush
7. **睡眠 throttle？** ✓ 重整時跑一次性，不依賴 timer
8. **異地兩台場景？** ✓ 兩邊重整都會跑 init → pull 雲端 → merge → 推回 → 一致

### 跟 v3.24.31 / v3.24.32 的關係
- v3.24.31 加 sync-error overlay + 衝突自動 remote-wins
- v3.24.32 加衝突前自動備份本機
- v3.24.33 修「重整後沒 init → 編輯沒 push → 假裝已同步」這個獨立 bug — **這個 bug 在 v3.24.30 以前就一直存在**，v3.24.31/32 沒處理它

---

## v3.24.32 — 衝突採雲端前自動備份本機到 Drive 快照（2026-05-16）

### 背景
v3.24.31 把衝突自動 remote-wins 後，使用者問「會不會本機改動被蓋掉？」。誠實答：**會**，主要兩個情境：

1. **跨機器同欄位都改過**：家裡離線改 X 金額 22000 → 公司線上改 X 金額 20000 → 家裡上線後 → 採雲端 20000，家裡的 22000 被蓋
2. **使用者點 overlay 的「暫時關閉」繼續改**：後續同步如撞雲端 → 本機被蓋

使用者選擇 **方案 A：衝突前先自動備份本機到 Drive 快照**。

### Fix
位置：`cloudResolveAndMerge`（line ~1606，conflicts 處理區塊開頭）

```js
if (result.conflicts.length > 0) {
  // 先 fire-and-forget 備份本機到 Drive snapshot
  const tsLabel = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '');
  const conflictLabel = `衝突備份_${result.conflicts.length}筆_${tsLabel}`;
  cloudCreateSnapshot('manual', conflictLabel)
    .then(created => console.log('[cloud-merge] ✓ 衝突前本機備份已建立:', created.id))
    .catch(e => console.error('[cloud-merge] 衝突前備份失敗（仍繼續 merge）:', e));

  // 接著走 remote-wins 改寫 + applyTrackerData + push
  ...
}
```

**關鍵實作細節：**
- 重用既有 `cloudCreateSnapshot('manual', label)`（snapshot 機制成熟，UI 已支援還原 / 刪除）
- **fire-and-forget**：`cloudCreateSnapshot` 內部第一步是同步抓 `state` 拷貝 + `JSON.stringify`，driveCreateFile 才是 async。所以後面 `applyTrackerData(result.merged)` 修改 state 不會影響備份內容
- **失敗不擋 merge**：備份 fetch 失敗 → 只 console.error，merge 流程繼續（避免備份問題讓 sync 卡住）
- **手動類型 = 永久保留**：不會被 `cloudPruneSnapshots` 砍掉
- **toast 訊息**：「☁️ N 筆衝突採雲端（本機已備份到 Drive 快照）」讓使用者知道可還原

### 還原方法
1. 開設定頁
2. 找「☁️ Drive 備份」卡片 → 快照列表
3. 找 `🏷️ 衝突備份_X筆_時間` 那筆 → 點「還原」

### 還沒解決的邊角
- **真的 Drive 連完全斷線**：備份也會失敗（會 log error 但不擋 merge）。建議：使用者看到 `cloud-conflict-backup-failed` 日誌可手動處理
- **備份時 Drive 配額爆滿**：同上，會失敗但不擋 merge
- **使用者誤刪衝突備份**：那就沒救了。建議：之後可以加「衝突備份標籤特殊保護」（刪除前 confirm）

### self-review 8 項
1. **新觸發點撞車？** ✓ cloudCreateSnapshot 內部用 driveCreateFile 是新檔，跟既有 push（driveUpdateFile）不衝突
2. **mutable 入口併發保護？** ✓ snapshot 是新檔不會撞 cloudPushInProgress
3. **時間戳一致？** ✓ 不動 lastSyncedAt
4. **失敗會 alert？** ✓ catch 內只 console.error，不 alert
5. **finally 清理？** ✓ fire-and-forget 不需要 finally
6. **無變動還 push？** ✓ snapshot 是獨立檔不影響 tracker.json push 邏輯
7. **睡眠 throttle？** ✓ 純 async fetch，與 timer 無關
8. **異地兩台場景？** ✓ 兩邊都改 → 衝突 → 雙邊都會留下自己版本的備份（在 Drive 都看得到）

### 影響範圍
- `js/app.js`：`cloudResolveAndMerge` conflicts 處理區塊加 fire-and-forget 備份
- `index.html`：meta version → v3.24.32
- `service-worker.js`：CACHE_VERSION → v3.24.32

---

## v3.24.31 — 沒同步就不准編輯 + 衝突一律採雲端（2026-05-16）

### 背景
使用者再次強調核心使用情境：
> 「我的使用地方會有公司電腦和家裡電腦，且家裡電腦可能會關機。
> 不要再發生沒同步又可以編輯。
> 盡量避免出現要選雲端/本地的選項，全部都要雲端。」

對應到程式的兩個硬需求：
1. **同步失敗時必須擋編輯**：避免使用者離線改了資料、之後上雲端撞衝突
2. **衝突一律採雲端**：不再跳「選本機 / 選雲端」modal

### Fix 1：cloudResolveAndMerge 衝突自動 remote-wins（不再開 modal）
位置：`cloudResolveAndMerge`（line ~1602）

把「有衝突 → 開 cloudShowConflictModal」這條路徑改成：
```js
if (result.conflicts.length > 0) {
  result.conflicts.forEach(c => {
    if (c.kind === 'field-conflict') {
      // 把 merged 內該欄位用 remote 值改寫
    } else if (c.kind === 'delete-vs-edit' && c.side === 'remote-deleted') {
      // 雲端刪、本機改 → 採雲端「刪」決定
    }
  });
  toast(`☁️ ${count} 筆衝突已自動採雲端版本`, 4000);
  result.clean = true;  // 改寫完當成 clean 走自動 push 分支
}
```

`cloudShowConflictModal` 函式留著但永不再被呼叫（dead code，方便將來需要時恢復）。

取捨：本機未推送的衝突欄位會被覆蓋。可接受性靠 Fix 2 保證（沒同步擋編輯，極少機會兩邊都離線改同一筆）。

### Fix 2：sync error overlay 擋編輯
位置：新增 `_syncErrorGuardOnStatusChange` / `showSyncErrorOverlay` / `hideSyncErrorOverlay`（line ~715）

機制：
- `cloudSetSyncStatus('error', ...)` 觸發 → 排 20 秒 grace timer（避免短暫網路抖動誤觸發）
- 20 秒後若仍 error → 半透明 overlay 蓋住整個 app
- overlay 內三個按鈕：「立刻重試同步」「重新登入 Google」「暫時關閉（不建議）」
- `cloudSetSyncStatus('idle' | 'syncing' | 'pending')` 觸發 → 立刻清 timer + 撤 overlay

```js
const SYNC_ERROR_GUARD_GRACE_MS = 20 * 1000;
function _syncErrorGuardOnStatusChange(status, prev) {
  if (status === 'error' && prev !== 'error') {
    _syncErrorGuardTimer = setTimeout(showSyncErrorOverlay, SYNC_ERROR_GUARD_GRACE_MS);
    return;
  }
  if (status !== 'error') {
    clearTimeout(_syncErrorGuardTimer);
    hideSyncErrorOverlay();
  }
}
```

「暫時關閉」按鈕保留是因為極端情境（例如 Google 全球當機）使用者可能還是想看資料，但下次 status 又變 error 還是會跳。**沒有「直接編輯不顧同步」選項**。

### 影響範圍
- `js/app.js`：
  - `cloudSetSyncStatus`（line ~691）→ 接通 sync error guard hook
  - 新增 `_syncErrorGuardOnStatusChange` / `showSyncErrorOverlay` / `hideSyncErrorOverlay`（line ~712）
  - `cloudResolveAndMerge`（line ~1602）→ 衝突自動 remote-wins
  - `cloudShowConflictModal` → 不再被呼叫（dead code 保留）
- `index.html`：meta version → v3.24.31
- `service-worker.js`：CACHE_VERSION → v3.24.31

### self-review 8 項
1. **新觸發點撞車？** ✓ overlay 純 UI，不動同步邏輯
2. **mutable 入口併發保護？** ✓ 不新增同步入口
3. **時間戳一致？** ✓ 不動
4. **失敗會 alert 打斷？** ✓ overlay 取代 alert，使用者主動操作
5. **finally 清理？** ✓ grace timer 在 status 變化時 clearTimeout
6. **無變動還 push？** ✓ remote-wins resolve 後仍走既有 skipPush 邏輯
7. **睡眠 throttle？** ✓ overlay 不依賴 timer 持續跑
8. **異地兩台場景？** ✓ 家裡關機後公司開 → pull 拿到家裡最後版本，無衝突直接套；若公司也離線改了 → 上線時衝突 → 自動採雲端（家裡版本）

### 已寫入記憶
本次決策已存到 `freelance-tracker-cloud 同步鐵則` memory 第 10 條，未來不需要再問。

---

## v3.24.30 — 修「同步卡 N 天前、沒登出但顯示不同步」bug（push 復活機制）（2026-05-16）

### 問題現象
使用者打開電腦看到：
- 同步指示器卡「3 天前同步」（lastSyncedAt 是 5/13）
- 紅 banner「⚠️ 資料未同步到雲端」
- 右上 pill 仍是登入狀態（沒被踢出）
- 但實際上中間幾天的改動沒上雲端

### 根本原因（3 個 bug 疊加，主因 #1）

#### Bug #1（主因）：silent refresh 成功後沒復活卡死的 push retry chain
`cloudPushNow` 失敗時走 `CLOUD_PUSH_RETRY_DELAYS_MS = [3000, 8000, 20000, 60000, 180000]`，5 次 retry 共 ~4.5 分鐘。如果這段時間 token 一直無效（睡眠喚醒中 / 網路抖動 / silent refresh 也在 retry）→ 5 次全失敗 → `console.error('已達最大重試次數')` 後**永久停止**：
- `cloudPushFailRetries = 5` 卡住，沒任何 timer / event 自動再試
- 後來 silent refresh 終於成功（line 488-510）只做了 setSyncStatus('idle') + cloudAutoPullThrottled
- **沒歸零 cloudPushFailRetries**、**沒重啟那個被丟掉的 push**
- 本機 pending 改動永遠留在 localStorage 沒推上去 → lastSyncedAt 卡 5/13

#### Bug #2：focus / visibilitychange 沒檢查卡住的 push
`_checkAndRefreshIfNeeded`（line 219）只做 silent refresh + auto pull，不會重試卡死的 push。切視窗回來也救不回來。

#### Bug #3：達 MAX 後完全死掉
原本 `else { console.error('...') }` 完全不動，只有 `online` event 或手動點 banner 才復活。Wi-Fi 暫斷不重連時 `online` event 不會 fire → 永遠卡住。

### 修正

#### Fix 1：silent refresh 成功 → 復活卡死的 push（主修）
位置：`cloudOnTokenResponse` 內 silent refresh ok 分支（line ~494）

```js
const hadStuckPush = (cloudPendingChangesCount > 0) || (cloudPushFailRetries > 0);
if (hadStuckPush) {
  cloudPushFailRetries = 0;  // 歸零，給新生機會
  if (cloudPendingChangesCount > 0) {
    setTimeout(() => cloudPushNow(), 1000);  // 1 秒後重啟（給 SDK 穩定）
  }
}
```

#### Fix 2：cloudPushNow 達 MAX → 改長間隔 watchdog（5 分鐘一次）
位置：`cloudPushNow` catch block（line ~2210）

```js
} else {
  const WATCHDOG_DELAY = 5 * 60 * 1000;
  setTimeout(() => cloudPushNow(), WATCHDOG_DELAY);  // 不再完全放棄
}
```

效果：即使所有事件都沒觸發、token 一直無效，每 5 分鐘還是會嘗試一次直到成功。

#### Fix 3：focus / visibilitychange / pageshow → 復活卡死的 push
位置：`_checkAndRefreshIfNeeded`（line ~219）

```js
if (cloudSyncStatus === 'error' && cloudPendingChangesCount > 0) {
  cloudPushFailRetries = 0;
  setTimeout(() => cloudPushNow(), 500);
}
```

效果：切視窗 / 喚醒電腦時自動補救。

### self-review 8 項
1. **新觸發點撞車？** ✓ 三個 fix 都走 `cloudPushNow`，內部 `cloudPushInProgress` flag 擋併發
2. **mutable 入口併發保護？** ✓ 全靠 cloudPushInProgress
3. **時間戳 / 版本號一致？** ✓ 不動時間戳邏輯
4. **失敗會打斷？** ✓ 全 console，不 alert
5. **finally 清理？** ✓ 沿用既有 try/finally
6. **無變動還 push？** ✓ cloudPushNow 內 version check + skipPush 已處理
7. **睡眠 / throttle？** ✓ watchdog 用 setInterval-like 邏輯 + visibilitychange 雙保險
8. **異地兩台場景？** ✓ 復活時 cloudPushNow 內部 version check 會 detect 雲端是否較新 → 走 cloudResolveAndMerge

### 影響範圍
- `js/app.js`：`cloudOnTokenResponse`（fix 1）、`cloudPushNow`（fix 2）、`_checkAndRefreshIfNeeded`（fix 3）
- `index.html`：meta version → v3.24.30
- `service-worker.js`：CACHE_VERSION → v3.24.30

### 相關歷史
- v3.24.22：silent refresh 成功後 auto pull（為了「重登後不用手動同步」）
- v3.24.25：silent refresh retry 3 次 + 指數退避
- v3.24.27：safety timer 防 GIS SDK 卡死
- v3.24.28：periodic refresh check
- **v3.24.30**：補上「push 那一端」的恢復機制（之前都只修 token 那端）

---

## v3.24.29 — 修每天跳衝突 modal 的 bug（base=null 自動視為 local，雲端優先）（2026-05-13）

### 問題現象
使用者每天開電腦（家裡↔公司切換）都會跳「資料衝突」modal，例如顯示「5 筆衝突，案件 ta5cvel8 有 3 個欄位差異（日期 / 詳情 / 金額）」。但其實前一天明明在另一台電腦改完，本機這台從未動過——根本沒有真正的衝突。

### 根本原因
診斷指令確認：`localStorage['cloud-last-synced-snapshot'] === null`

也就是說 `cloudGetLastSyncedSnapshot()` 拿不到「上次同步時的快照」（base）。原因可能是：
1. 歷史 v3.24.x 同步事故期間，snapshot 沒寫入或被清掉
2. localStorage 被瀏覽器清理
3. 早期版本不存 snapshot

當 `base = null` 進到 `mergeStates` 後：
```
baseObj = base || {} = {}
bV = baseObj[field] = undefined
lChanged = (lV !== bV) → true  // 因 bV undefined，差異一定成立
rChanged = (rV !== bV) → true  // 同上
→ 雙方都改 → 誤判為衝突 → 開 modal
```

每個本機 vs 雲端不同的欄位都會被當成衝突，就算其實只是另一台改完還沒同步下來而已。

### 修正

#### Fix 1：mergeStates 加 base=null 自動降級為 base=local
```js
function mergeStates(base, local, remote) {
  if (!base) {
    console.warn('[mergeStates] base=null → 自動視為 base=local（雲端優先）');
    base = local;
  }
  // ...
}
```

效果：
- 本機沒改的欄位：`lV === bV` → lChanged=false；如果雲端有改 → 採雲端值（rChanged=true）
- 本機獨有的案件 / 欄位：保留（不會被砍）
- 雲端獨有的案件 / 欄位：補進來（一樣會 merge）
- 結果：**雲端版本權威**，本機只獨有的東西不丟失

對應使用者原話：「**基本上只要有上傳到雲端 就抓雲端版本**」

#### Fix 2：cloudInitTrackerFile 結尾偵測 base=null 主動 cloudPullNow
即使 Fix 1 擋住誤判，base=null 的根本狀態仍需要修復。在 init 跑完所有路徑後（hideInitOverlay 之後）加：
```js
if (isCloudSignedIn() && !cloudGetLastSyncedSnapshot()) {
  console.warn('[cloud-init] 偵測到 base=null，主動 cloudPullNow 重建同步基準');
  if (typeof toast === 'function') toast('💡 同步基準重建中，對齊雲端…', 3000);
  cloudPullNow(true).catch(e => console.error('[cloud-init] base 重建 pull failed:', e));
}
```

效果：主動補一次 pull，把雲端版本當成新的 base 存進 localStorage。下一個操作週期就有正確基準了。

### 不做的選項
- ❌ Fix 3：手動「重置同步基準」按鈕——使用者明確拒絕「先做 1、2 就好」

### 對使用者體驗的影響
- 每天開電腦不再跳衝突 modal（除非真的兩邊都改了不同欄位）
- 跨裝置切換流暢度顯著提升
- 不再被「衝突解決」打斷工作流

### 影響範圍
- `js/app.js`：`mergeStates`（line ~2028）加 base=null guard；`cloudInitTrackerFile`（line ~1581）結尾加 base=null detect + pull
- `index.html`：meta version → v3.24.29
- `service-worker.js`：CACHE_VERSION → v3.24.29

### 沿用先前的鐵則
- 改動同步機制 → 必跑「同步機制改完 self-review 8 項」（CLAUDE.md）
- 不引入新的本機獨佔 localStorage 業務資料
- 不繞過 buildTrackerWrapper / save() 路徑

---

## v3.24.28 — 純前端極致 silent refresh（最大化降低重登機率）（2026-05-13）

### 背景
使用者明確表態「我希望盡量避免被登出要重新登入」（已寫進 memory）。純前端 Implicit Flow **不可能 100% 避免**（Google session 過期就是要重登），但可以把機率降到最低。

### 三個更積極的策略

#### 1. silent refresh 時機提前：過期前 5 分鐘 → 過期前 15 分鐘
**之前**：token 剩 5 分鐘才 refresh。如果 refresh 失敗 + 3 次指數退避 retry（總 35 秒），運氣不好 token 在 retry 期間就過期。

**現在**：剩 15 分鐘就 refresh，給整整 15 分鐘的 retry 窗口。即使連續多次失敗也有充分時間補回來。

#### 2. 啟動主動 refresh 門檻放寬：30 分鐘 → 45 分鐘
**之前**：啟動時 token 剩 < 30 分鐘才立刻 refresh。
**現在**：剩 < 45 分鐘就立刻 refresh，更積極預防。

#### 3. 新增 periodic refresh check（每 20 分鐘背景跑一次）
**之前**：silent refresh 只在這些時機觸發：
- 過期前 setTimeout
- visibilitychange / focus / pageshow
- heartbeat 偵測睡眠喚醒

**現在**：再加一個獨立的 setInterval，每 20 分鐘**主動**檢查 token 還剩多少。如果剩 < 30 分鐘 → 立刻 refresh。即使使用者一直沒切 tab、沒切視窗、電腦沒睡眠，也會定期主動更新。

```js
const PERIODIC_REFRESH_CHECK_MS = 20 * 60 * 1000;
const PERIODIC_REFRESH_THRESHOLD = 30 * 60 * 1000;
function _periodicRefreshCheck() {
  if (!isCloudSignedIn()) return;
  const remaining = cloudAuthState.tokenExpiresAt - Date.now();
  if (remaining < PERIODIC_REFRESH_THRESHOLD) _silentRefresh();
}
setInterval(_periodicRefreshCheck, PERIODIC_REFRESH_CHECK_MS);
```

### 對使用者體驗的影響

#### 不影響操作
silent refresh 是純背景 `requestAccessToken({prompt: ''})` 呼叫：
- 沒有彈窗
- 沒有頁面跳轉
- 沒有 UI 變化（最多 sync indicator pill 短暫顯示「⌛」< 1 秒）
- 使用者打字、編輯 modal、拖曳、按按鈕都不會被打斷

#### 預期效果
- 「重登」事件從「每 1-3 天一次」降到「**只在 Google session 真的過期才會發生**」（純前端的極致）
- 一般情境下 silent refresh 永遠在後台無感運作

### 仍然會重登的情境（純前端 Implicit Flow 硬性限制）
- Chrome 完全重啟（不只 tab）
- Google session 真過期（公司 IT 政策強制登出 / 隔超過 Google 安全策略時間）
- 公司網路擋 Google OAuth 端點
- 使用者主動在 myaccount.google.com 登出

**真正 100% 避免重登**只能：(a) 加 Cloudflare Worker backend + Code Model（拿 refresh_token） (b) Capacitor wrap 成 Android app（用 Google Sign-In SDK）

### 影響範圍
- `js/app.js`：
  - REFRESH_BEFORE_EXPIRY_MS：5 分鐘 → 15 分鐘
  - PROACTIVE_REFRESH_THRESHOLD（啟動）：30 分鐘 → 45 分鐘
  - 新增 PERIODIC_REFRESH_CHECK_MS（20 分鐘）+ `_periodicRefreshCheck` + `setInterval`
  - APP_VERSION
- `service-worker.js` / `index.html`：bump 版本

### 同步鐵則 self-review 8 項 ✅
1. 新觸發點會跟既有路徑撞車嗎？— `_periodicRefreshCheck` 內呼叫 `_silentRefresh`，已有 `_isSilentRefreshing` 防併發
2. 每個 mutable 入口都有併發保護嗎？— silent refresh flag + safety timer 雙重保險
3. 時間戳更新邏輯一致嗎？— 沒動
4. 失敗路徑會打斷使用者嗎？— periodic check 失敗只 log，不打斷
5. finally 區塊清理乾淨嗎？— 沒新 finally
6. 無變動還會 push 嗎？— 沒動 push
7. 新加的 setTimeout 在睡眠 throttle 下會失靈嗎？— **這是 setInterval**，throttle 但會 catch up；醒來時 heartbeat 也會補做
8. 異地兩台電腦同時操作場景跑得過嗎？— 沒動同步邏輯

## v3.24.27 — silent refresh 卡死保護 + 訊息友善化（2026-05-13）

### 背景
使用者澄清「電腦沒睡眠、分頁沒睡眠」也看到紅 banner「未登入 Google 或 access token 已過期，請先登入」。

→ 表示 v3.24.26 的「睡眠喚醒 race」假設不適用。重新診斷，這版針對另外三個可能根因。

### 修法

#### 1. `_silentRefresh` 加 safety timer（修 GIS SDK 卡住）
**情境**：silent refresh 觸發 `requestAccessToken({prompt: ''})` 後 GIS SDK 因網路 / 內部 bug 永遠不 callback → `_isSilentRefreshing` 永遠卡 true → 後續所有 silent refresh 被擋掉 → token 永遠不會更新。

**修法**：
- 新增 `_silentRefreshSafetyTimer` + `SILENT_REFRESH_SAFETY_TIMEOUT_MS = 30 * 1000`
- 觸發 silent refresh 時排 30 秒 safety timer
- 30 秒沒收到 callback → 強制 `_isSilentRefreshing = false` + 走 `_handleSilentRefreshFailure` 重試流程
- `cloudOnTokenResponse` 內 callback 來了就清掉 safety timer

#### 2. DriveAuthError 訊息友善化（修 banner 嚇人）
**之前**：技術訊息「未登入 Google 或 access token 已過期，請先登入」、「access token 已失效或缺少新 scope，請登出再登入」
**現在**：行動指示「**Google 連線需要重新整理，請點右上角『重新登入』**」

統一一致，使用者看到就知道要做什麼，不會被「access token」「scope」這種技術詞嚇到。

#### 3. `ensureValidToken` timeout 從 15s → 30s
之前 15 秒太短，silent refresh 失敗 + 3 次指數退避 retry 總共要 35 秒，timeout 不夠用。延長到 30 秒，給 retry 充分時間。

### 影響範圍
- `js/app.js`：
  - `_silentRefresh` 加 safety timer 邏輯
  - `cloudOnTokenResponse` 內清 safety timer
  - `ensureValidToken` timeout 預設值 15000 → 30000
  - `driveFetch` 兩處 DriveAuthError 訊息改友善化
  - APP_VERSION
- `service-worker.js` / `index.html`：bump 版本

### 不動的部分
- 沒動 schema / push 邏輯 / pull 邏輯 / mergeStates
- 沒動 silent refresh 觸發機制（visibilitychange / focus / heartbeat 等）
- 沒新增 localStorage key

### 你會看到的差別
1. **如果 silent refresh 真的失敗**（Google session 過期、Web 純前端 Implicit Flow 硬性限制） → banner 變成友善訊息「Google 連線需要重新整理，請點右上角『重新登入』」，**而不是嚇人的「access token 已過期」**
2. **如果 GIS SDK 卡住**（極罕見） → 30 秒後自動 force reset，不會永遠卡死
3. silent refresh 失敗 retry 3 次有充分時間（35 秒）跑完，ensureValidToken 也等夠久

### 仍然要重登的情境（Web 純前端硬性限制）
即使這版加了多重保護，下面這些情境**還是要重登一次**：
- Chrome 完全重啟（不只 tab）
- Google session 真過期（公司 IT 政策 / 隔超過特定時間）
- 公司網路擋 Google OAuth 端點

這些是 GIS Token Client (Implicit Flow) 的本質限制，繞不過（除非加 backend + Code Model）。

### 同步鐵則 self-review 8 項 ✅
1. 新觸發點會跟既有路徑撞車嗎？— 沒新加觸發點
2. 每個 mutable 入口都有併發保護嗎？— `_isSilentRefreshing` + `_silentRefreshSafetyTimer` 雙重保險
3. 時間戳更新邏輯一致嗎？— 沒動
4. 失敗路徑會打斷使用者嗎？— 訊息友善化反而提升 UX
5. finally 區塊清理乾淨嗎？— safety timer 在 callback / catch 都會清
6. 無變動還會 push 嗎？— 沒動 push
7. 新加的 setTimeout 在睡眠 throttle 下會失靈嗎？— safety timer 在睡眠下會延遲，但 heartbeat 會 catch up
8. 異地兩台電腦同時操作場景跑得過嗎？— 沒動同步邏輯

## v3.24.26 — 🚨 修「睡眠喚醒後紅 banner 誤觸發」bug（2026-05-13）

### 症狀
使用者昨晚在公司電腦登入並同步成功，今早到公司電腦看到紅色 banner：
> ⚠️ 資料未同步到雲端（**未登入 Google 或 access token 已過期，請先登入**）　本機資料安全，但兩地電腦不會即時一致

### 根因（前幾版都沒修到）
v3.24.13~v3.24.25 修了 silent refresh 機制（重試、心跳偵測、清 timer 等等），但漏掉一個關鍵：**`driveFetch` 不會等 silent refresh 完成**。

具體 race：
1. 早上喚醒電腦 → visibilitychange / focus / heartbeat 三個事件都觸發
2. `_checkAndRefreshIfNeeded` 看 token 過期 → 觸發 `_silentRefresh()`（**async**，需 1-2 秒）
3. **同時間**某個 cloud API（cloudPushNow / cloudPullNow / cloudInitTrackerFile）也跑了
4. → 進入 `driveFetch` → `getValidAccessToken()` 看 token 還沒被 refresh → 回 null
5. → `driveFetch` 立刻 throw `DriveAuthError('未登入 Google 或 access token 已過期，請先登入')`
6. → 被 catch 後設成 `cloudSetSyncStatus('error', e.message)`
7. → 紅 banner 顯示這個訊息

silent refresh 即使最後成功，紅 banner 也已經跳出來嚇到使用者。

### 修法
新增 `ensureValidToken(timeoutMs)` async 函式：
- 若已有 valid token → 立刻回 true
- 若無 valid token + 已登入 + tokenClient ready → 主動觸發 `_silentRefresh()`（如果還沒在跑）
- 用 200ms polling 等到 `_isSilentRefreshing = false`（refresh 結束）或 timeout（15 秒）
- 結束後再檢查 token 是否 valid，回對應結果

`driveFetch` 入口從「token 無效立刻 throw」改成「token 無效 → await ensureValidToken → 拿到新 token 再繼續」。

→ 所有用 driveFetch 的地方（push / pull / init / calendar）**都自動受惠**，不需要逐個改。

### 影響範圍
- `js/app.js`：
  - 新增 `ensureValidToken(timeoutMs)` async helper
  - `driveFetch` 入口改成 await 等 silent refresh 完成才 throw
  - APP_VERSION
- `service-worker.js` / `index.html`：bump 版本

### 不動的部分
- 沒動 schema / push 邏輯 / pull 邏輯 / mergeStates
- 沒動 silent refresh 本身（v3.24.25 強化的指數退避 / clear retry timer 仍生效）
- 沒新增 localStorage key

### 你會看到的差別
- 公司電腦早上喚醒 → 自動 silent refresh 完成 → driveFetch 拿到新 token → 同步成功 → **不會看到紅 banner**
- 真的 silent refresh 失敗（Google session 真過期）才會看到紅 banner，這時是合理的提示
- 體感：早上開公司電腦 → 一切自動完成，看不到錯誤

### 同步鐵則 self-review 8 項
1. ✅ 新觸發點會跟既有路徑撞車嗎？— ensureValidToken 內呼叫 _silentRefresh，但 _isSilentRefreshing flag 已防併發
2. ✅ 每個 mutable 入口都有併發保護嗎？— 沒改變
3. ✅ 時間戳更新邏輯一致嗎？— 沒動
4. ✅ 失敗路徑會打斷使用者嗎？— 失敗的 driveFetch 是 caller 決定要不要 alert，多半是 silent 模式不打斷
5. ✅ finally 區塊清理乾淨嗎？— ensureValidToken 是 polling，沒 timer 要清
6. ✅ 無變動還會 push 嗎？— 沒動 push
7. ✅ 新加的 setTimeout 在睡眠 throttle 下會失靈嗎？— polling 是 await，喚醒後會 catch up
8. ✅ 異地兩台電腦同時操作場景跑得過嗎？— 沒動同步邏輯

## v3.24.25 — silent refresh 強化（容忍網路抖動 + 清乾淨 timer）（2026-05-13）

### 主動 audit 發現的問題

#### 1. 🔴 silent refresh 成功時沒清 `_silentRefreshRetryTimer`
**情境**：
1. token 接近過期 → silent refresh 跑 → 失敗（網路抖動）
2. `_handleSilentRefreshFailure` 排 retry timer
3. 5 秒過去前，使用者切回分頁 → visibilitychange → `_silentRefresh` → 這次成功
4. 成功路徑只清了計數器、**沒清 retry timer**
5. 5 秒後 retry timer fire → 又跑一次多餘的 silent refresh

**修法**：`cloudOnTokenResponse` 拿到 token 成功路徑也 `clearTimeout(_silentRefreshRetryTimer)`。

#### 2. 🟡 `MAX_REFRESH_RETRIES = 1` 太保守
**問題**：連續失敗 1 次就跳紅 banner。但網路抖動、Google API 短暫 503、DNS 慢都會誤觸發。

**修法**：改成 3 次。

#### 3. 🟡 retry 間隔固定 5 秒 → 改指數退避
**問題**：5 秒不夠覆蓋 10 秒級網路斷線；固定間隔也容易跟對方暫時故障的恢復節奏不同步。

**修法**：改成陣列 `[5000, 10000, 20000]`：
- 第 1 次 retry 在 5 秒後
- 第 2 次 retry 在 10 秒後
- 第 3 次 retry 在 20 秒後
- 總共 35 秒重試窗口，能挺過多數網路抖動

3 次都失敗才跳「請重新登入」紅 banner。

### 影響範圍
- `js/app.js`：
  - 移除 `REFRESH_RETRY_DELAY_MS` 常數
  - 新增 `REFRESH_RETRY_DELAYS_MS` 陣列（指數退避）
  - `MAX_REFRESH_RETRIES = REFRESH_RETRY_DELAYS_MS.length`（3）
  - `_handleSilentRefreshFailure` 從陣列取對應延遲
  - `cloudOnTokenResponse` 成功路徑加 `clearTimeout(_silentRefreshRetryTimer)`
  - APP_VERSION
- `service-worker.js` / `index.html`：bump 版本

### 不動的部分
- 沒動觸發機制（visibilitychange / focus / pageshow / heartbeat 都保留）
- 沒動 hint:email 邏輯
- 沒動 auto pull 邏輯
- 沒動 token 過期前 5 分鐘預先 refresh
- 沒動 schema / push / pull / merge

### 你會看到的差別
- **網路偶爾抖動不再立刻跳紅 banner**：3 次 retry 在 35 秒內全失敗才提示
- console log 從「silent refresh retry #1」變「retry #1/3」「retry #2/3」「retry #3/3」，更清楚
- 不會看到「成功後 5 秒又跑一次」的多餘 log

### 同步鐵則 self-review（v3.24.23 起強制 8 項）
1. ✅ 新觸發點會跟既有路徑撞車嗎？ — 沒新加觸發點
2. ✅ 每個 mutable 入口都有併發保護嗎？ — `_isSilentRefreshing` 已有
3. ✅ 時間戳 / 版本號更新邏輯一致嗎？ — 沒動
4. ✅ 失敗路徑會打斷使用者嗎？ — 提升容忍度後反而更少誤觸發
5. ✅ finally 區塊清理乾淨嗎？ — **本版主要修這個（retry timer 清乾淨）**
6. ✅ 無變動還會 push 嗎？ — 沒動 push
7. ✅ 新加的 setTimeout 在睡眠 throttle 下會失靈嗎？ — heartbeat 已 catch up
8. ✅ 異地兩台電腦同時操作場景跑得過嗎？ — 沒動同步邏輯

## v3.24.24 — 修「sync indicator 殘留 ○ 未啟用」bug（2026-05-13）

### 症狀
使用者已登入（帳號 pill 顯示 James、設定頁顯示「已登入」），但 **top bar 的 sync indicator 還是顯示 HTML 預設值「○ 未啟用」**，沒被覆蓋成「✓ N 分前同步」或「○ 未連雲端」。

### 根因（推測）
`cloudInitGoogleAuth` 內，restored=true 路徑只依賴 `cloudRenderSignedIn` 內部呼叫 `cloudUpdateSyncIndicator()`。整個流程有：
- Step 1：cloudLoadAuthState → 還原 user → cloudRenderSignedIn → cloudUpdateSyncIndicator（這時 GIS SDK 還沒 ready）
- Step 2：await cloudWaitForGoogleSDK（async timing）
- Step 3：init tokenClient + 排 silent refresh

中間如果 await 期間 DOM race / 別的 timer 改了 sync-indicator innerHTML（或某個 exception 中斷），「○ 未啟用」HTML 預設值會殘留。

### 修法（防禦性，兩層保險）
1. **`cloudInitGoogleAuth` 結尾無條件呼叫 `cloudUpdateSyncIndicator()`**
   - 不論 restored / 未 restored 都跑
   - 即使中間 async 出狀況，最後保證覆蓋一次

2. **啟動 1 秒後 setTimeout 內也補一次**
   - 已有的 setTimeout（cloudUpdateSyncBanner / cloudUpdateCalSigninGate）加 cloudUpdateSyncIndicator
   - 對 race condition / DOM ready 延遲再做一道保險

### 影響範圍
- `js/app.js`：
  - cloudInitGoogleAuth 結尾加 `cloudUpdateSyncIndicator()`
  - 啟動 setTimeout 內加 `cloudUpdateSyncIndicator()`
  - APP_VERSION
- `service-worker.js` / `index.html`：bump 版本

### 不動的部分
- 沒動 schema / 同步邏輯 / push 邏輯
- 不影響資料正確性（這純粹是 UI 顯示問題）

### 你會看到的差別
- 重整頁面後 sync indicator **一定會在 1 秒內**從「○ 未啟用」變成正確的狀態（「✓ 剛剛同步」或「○ 未連雲端」）
- 不再殘留 HTML 預設值

## v3.24.23 — 同步併發保護 + 無變動跳過 push（2026-05-13）

v3.24.22 加了多個 auto pull 觸發點（visibilitychange / heartbeat / silent refresh recover），暴露了既有架構的併發 race。本版補上完整保護 + 順手做幾個 polish。

### 1. 🔴 cloudPullNow 加併發保護 + silent 參數
**問題**：v3.24.22 三個 auto pull 觸發點可能同時觸發 cloudPullNow（毫秒內），都通過 5 分鐘節流檢查 → 三個 cloudResolveAndMerge 並發跑 → driveUpdateFile 撞車。

**修法**：
- 新增 `cloudPullInProgress` flag，入口檢查
- 新增 `cloudPullNow(silent)` 參數 — auto 觸發 (silent=true) 時不跳 alert（避免 race 時 token 失效跳出來打斷使用者）

### 2. 🔴 cloudResolveAndMerge 內 push 搶 cloudPushInProgress 鎖
**問題**：cloudPushNow 有 `cloudPushInProgress` 保護，但 cloudResolveAndMerge 內的 `driveUpdateFile` 不認這個 flag，可能跟 cloudPushNow 並發。

**修法**：cloudResolveAndMerge 內 driveUpdateFile 前後也搶 `cloudPushInProgress` 鎖：
- 如果已被 cloudPushNow 鎖住 → 標記 `cloudPushPendingAfter` 後 return（讓 push 結束後再推一次）
- 拿到鎖 → 跑完 driveUpdateFile → finally 釋放鎖 + 處理 pendingAfter

### 3. 🟢 mergeStates 無變動跳過 push
**問題**：mergeStates 對「兩邊資料完全一致」也回 result.clean=true，cloudResolveAndMerge 還是會 push 一次 → 版本號 +1，但沒實際變化。

**修法**：cloudResolveAndMerge 用 `JSON.stringify(merged) === JSON.stringify(remoteData)` 判斷無變動 → 跳過 driveUpdateFile，只更新本機 meta + lastSyncedSnapshot 對齊到 remote。

新增 logAction event：`cloud-merge-noop`

### 4. 🟡 cloudInitTrackerFile 加併發保護
**問題**：cloudOnTokenResponse 跟 cloudPullNow (trackerFileId 不存在時 fallback) 都會呼叫 init，可能並發。

**修法**：新增 `cloudInitInProgress` flag。在 `hideInitOverlay()` 內順手 reset（所有 return 路徑都走這個函式，不用每個 return 都改）。

### 5. 🟡 cloudPullNow 完成後也更新 `_lastAutoPullAt`
**問題**：使用者按完「立即同步」後 1 分鐘切回分頁，visibilitychange 還是會再 throttle 後 auto pull 一次（多餘）。

**修法**：cloudPullNow finally 區塊更新 `_lastAutoPullAt = Date.now()`。

### 影響範圍
- `js/app.js`：
  - 新增 `cloudPullInProgress` / `cloudInitInProgress` 兩個 flag
  - `cloudPullNow(silent)` 加參數 + try/finally 包裹 + alert 全部加 `if (!silent)` 防護
  - `cloudResolveAndMerge` 內 clean merge 路徑：先比對 merged vs remote 跳過 noop push、再搶 cloudPushInProgress 鎖、finally 釋放
  - `cloudInitTrackerFile` 入口檢查 + cloudInitInProgress=true
  - `hideInitOverlay` 內 reset cloudInitInProgress
  - `cloudAutoPullThrottled` 改用 `cloudPullNow(true)` silent 模式
  - APP_VERSION
- `service-worker.js` / `index.html`：bump 版本

### 你會看到的差別
1. 雲端版本號不再每次 visibilitychange / focus 都 +1 — **只有真有變動才 push**
2. silent refresh + visibilitychange + heartbeat 三方同時觸發也不會撞車
3. token 失效 race 時自動 pull 安靜失敗（log 而非 alert），不打斷使用者
4. 操作日誌新增 `cloud-merge-noop` event，可以從那邊看到「對齊但沒實際變動」的次數

### 不動的部分
- 沒動 schema / buildTrackerWrapper / mergeStates / push 觸發機制
- 沒新增 localStorage key
- 沒違反 v3 純前端原則

## v3.24.22 — 兩地電腦無感切換（純前端最佳化）（2026-05-11）

### 你會看到的差別
- 家裡電腦改完 → 公司電腦（沒關機、分頁沒關）切回分頁 → **自動拉新版本**，不用按「立即同步」
- silent refresh 成功 → 自動拉雲端最新，不用手動同步
- 電腦睡眠喚醒後 → 30 秒內自動補做 refresh + pull
- 「重新登入」按鈕直接用上次帳號（不跳帳號選擇器）

### 修法 4 點

**1. silent refresh 成功後自動 pull**
這是 bug fix：`cloudOnTokenResponse` 內 silent refresh 路徑只更新 token，**沒呼叫 init / pull**，所以家裡剛推的東西公司不會自動拉。
修法：silent refresh 成功 → 呼叫 `cloudAutoPullThrottled()`。從 error 恢復時重設節流（立刻 pull）；正常 refresh 走 5 分鐘節流（避免狂打 API）。

**2. visibilitychange / focus / pageshow 也觸發 auto pull**
之前這三個事件只觸發 `_silentRefresh`（且只在「token 快過期」時跑）。修法：即使 token 還新，切回分頁也 throttle 後 `cloudAutoPullThrottled()` 一次。

**3. 心跳偵測（catch-up 機制）**
`setTimeout` 在電腦睡眠 / 分頁背景時會被暫停或延遲，導致 silent refresh 沒準時跑。新增 `_heartbeatTick` 每 30 秒檢查「距上次心跳的時間差」，若 > 5 分鐘 = 電腦剛醒 / tab throttle 結束 → 立刻補 refresh + pull。`setInterval` 在 throttle 下仍會跑（只是頻率降低），比 `setTimeout` 可靠。

**4. requestAccessToken 帶 `hint: email`**
`_silentRefresh` 跟 `cloudSignIn` 都帶 hint。Google OAuth 看到 hint 會直接用該帳號 refresh，**不跳帳號選擇器**。對多 Google 帳號使用者特別有感。

### 預期效果（你的核心情境）

```
家裡電腦改了案件 X → push 到 Drive ✓
                          ↓
   隔天進公司，公司電腦沒關、瀏覽器分頁沒關
                          ↓
   切回分頁 / 喚醒電腦
                          ↓
   ① visibilitychange / focus 觸發 _checkAndRefreshIfNeeded
   ② 若 token 過期 → _silentRefresh → 成功 → 自動 pull
   ③ 若 token 還新 → cloudAutoPullThrottled → 自動 pull
   ④ 心跳偵測到「距上次 > 5 分鐘」也補一次
                          ↓
   看到案件 X 出現在公司電腦的清單 ✓（無感）
```

### 還是會要重登的少見情境
- Chrome 完全重啟（不只是 tab 沒關，是整個 browser process 重開）
- Google session 真的過期（隔超過一週、Chrome 設定極嚴 / 公司 IT 強制登出）
- 公司網路擋 Google OAuth 端點

這些是 Web 純前端 Implicit Flow 的硬性限制，繞不過（除非加 backend Code Model）。

### 影響範圍
- `js/app.js`：
  - 新增 `cloudAutoPullThrottled()` + `_lastAutoPullAt`（5 分鐘節流）
  - 新增 `_heartbeatTick` + `setInterval`（30 秒檢查、5 分鐘睡眠閾值）
  - 改 `_silentRefresh`：帶 hint
  - 改 `cloudOnTokenResponse` silent refresh 路徑：成功後 auto pull
  - 改 `_checkAndRefreshIfNeeded`：token 還新時也 auto pull
  - 改 `cloudSignIn`：帶 hint
  - APP_VERSION
- `service-worker.js` / `index.html`：bump 版本

### 不動的部分
- 沒動 schema、沒動 buildTrackerWrapper、沒動 mergeStates、沒動 push 邏輯
- 沒新增 localStorage key（純記憶體節流計數器）
- 沒違反 v3 路線圖（純前端、無後端）
- 異地電腦同步行為更穩定

## v3.24.21 — 🚨 修無限推送迴圈 bug（2026-05-11）

### 症狀
使用者在「重新登入並更新後」遇到 sync indicator **持續顯示「⌛ 推送中… (1)」、雲端版本號一直增加**（已到 #79+）。

### 根因
v3.24.15 加的「樂觀鎖 / version check」邏輯有時間戳不對等的 bug：

```js
const wrapper = buildTrackerWrapper(...);   // lastModifiedAt = new Date()  ← 本機 build 時間（早）
await driveUpdateFile(fileId, wrapper);     // Drive 寫入 → modifiedTime ← 雲端寫入時間（晚 200-500ms）
cloudSaveMeta({ lastSyncedAt: wrapper.lastModifiedAt });  // ← 用本機時間（早的那個）
```

下次 cloudPushNow 內 version check：
```js
const remoteModifiedTime = (await driveGetFileMeta(...)).modifiedTime;  // 雲端寫入時間（晚）
if (remoteModifiedTime > meta.lastSyncedAt) {                          // 永遠 true！
  await cloudResolveAndMerge(...);  // 重 pull merge
  // applyTrackerData → save() → cloudSchedulePush() → 2 秒後又跑一次 cloudPushNow
  // → 又觸發 version check → 又重 merge → 無限迴圈
}
```

每次循環都會：
- 推一次 Drive（版本 +1）
- 浪費 Drive API quota
- sync indicator 永遠顯示「推送中」

**資料安全性**：✅ 沒有遺失（每次推的內容相同）；只是版本號累積跟資源浪費。

### 修法（4 點）

**1. cloudPushNow 內 push 成功後，用 Drive 回傳的 modifiedTime 更新 lastSyncedAt**
```js
const updated = await driveUpdateFile(meta.trackerFileId, wrapper);
cloudSaveMeta({
  lastSyncedAt: (updated && updated.modifiedTime) || wrapper.lastModifiedAt,
  ...
});
```

**2. cloudResolveAndMerge 內也用 Drive 回傳的 modifiedTime**
同樣修法。

**3. cloudInitTrackerFile Case A / B 也用 Drive 回傳的 modifiedTime**
- Case A（建檔）：用 `created.modifiedTime` / `created.createdTime`
- Case B（pull）：用 `trackerFile.modifiedTime`（從 driveListAppFolder 取得）

**4. version check 加 5 秒緩衝**
```js
const VERSION_CHECK_BUFFER_MS = 5000;
if (remoteT > localT + VERSION_CHECK_BUFFER_MS) {
  // 真的有別人推過才觸發
}
```
即使極端 race 也不誤判。

**5. 防 race：cloudResolveAndMerge / Case B 內 applyTrackerData 後立刻清 push timer**
```js
applyTrackerData(result.merged);
if (cloudPushTimer) {
  clearTimeout(cloudPushTimer);
  cloudPushTimer = null;
}
cloudPendingChangesCount = 0;
```

避免 applyTrackerData → save() → cloudSchedulePush() 觸發的 2 秒後重推（因為下面立刻自己推）。

### 影響範圍
- `js/app.js`：`cloudPushNow` / `cloudResolveAndMerge` / `cloudInitTrackerFile` Case A&B 邏輯修正；APP_VERSION
- `service-worker.js` / `index.html`：bump 版本

### 不動的部分
- 沒動 schema / 沒動 buildTrackerWrapper / 沒動 mergeStates / 沒動 push 觸發機制
- cfg、cloud-meta、cloud-last-synced-snapshot 結構都沒動

### 你會看到的差別
1. 推送一次後 sync indicator 應該變綠勾「✓ 剛剛同步」，**不再持續推送**
2. 雲端版本號（meta.lastSyncedVersion）穩定不再爆衝
3. 即使切 tab / 重新登入也不再觸發假迴圈

### 之前累積到的版本號（#79）會怎樣？
- ✅ 都是有效的 snapshot（資料一樣）
- ✅ Drive snapshot 列表會顯示這些
- ✅ 可以從任一版本還原（內容都正確）
- ✅ 不影響資料正確性

## v3.24.20 — 設定頁雲端同步 / 行事曆同步 排版優化（2026-05-09）

### 1. 行事曆同步「啟用」要先登入才能勾
**之前**：未登入也能勾「啟用 Google 行事曆同步」checkbox，但呼叫 Drive API 會失敗 → 使用者不知道為什麼沒同步。

**現在**：
- 新增 `cloudUpdateCalSigninGate()` 函式：根據登入狀態切換 checkbox `disabled` 屬性 + 顯示 `#cloud-cal-need-signin` 提示
- 未登入時：checkbox 灰色不可點 + 顯示「⚠️ 請先到上方『☁️ 雲端同步』登入 Google」（黃色 warning）
- 登入後：checkbox 解鎖、提示自動 hide
- `cloudUpdateSyncIndicator` 內呼叫一次（登入 / 登出狀態變化時連動）
- 啟動 1 秒後也呼叫一次（給 cloudInitGoogleAuth 拉完狀態的時間）
- 雙保險：`cloudOnCalendarEnabledToggle` 內也擋未登入勾選（即使 disabled 沒生效也擋）

### 2. 行事曆同步排版重構
**之前（垂直 7 個區塊）**：
```
master toggle + status / 推送說明 /
Step ① 同步到哪一本日曆 / 
Step ② 通知時間 /
推送內容說明 / 同步狀態 / 立即同步按鈕
```

**現在（垂直 5 個區塊）**：
- 取消 「Step ①②」風格 → 改 inline label「日曆」「通知時間」
- 「日曆」+「通知時間」**兩欄 grid 並排**（桌面省垂直空間，手機自動換行）
- 「重新整理日曆列表」改成 🔄 icon-only（節省空間）
- 「上次同步」狀態 + 「立即同步」按鈕同一列
- 「💡 建議建外包專用日曆」改成獨立 details 折疊（移到最下面）
- 推送內容精簡成一行：「推送：案件本身、未收款、月底、業主請款日、拖款警告、每日早報」

### 3. 雲端同步排版重構（兩個 sub-section 改 details 折疊）
**之前**：「📦 雲端版本歷史」+「💾 離線資料備份」兩個 sub-section 永遠展開，垂直堆疊很長

**現在**：
- 兩個 sub-section 都改成 `<details>` 預設折疊
- 進設定頁第一眼只看到登入狀態 + 立即同步按鈕（最常用）
- 要備份才點開
- 配合新 CSS class（`.cloud-sub-section` / `.cloud-sub-body` / `.cloud-sub-status` 等）
- summary 內顯示狀態（例如「登入後可用」「JSON / CSV」）

### 影響範圍
- `index.html`：
  - `card-cloud-auth` body 內 sub-section 改 `<details>` 結構
  - `card-calendar` body 重構：移除 cal-step / cal-step-label，改用 cal-settings-grid + cal-field
  - 加 `#cloud-cal-need-signin` 警告提示
- `css/style.css`：新增 `.cloud-sub-section` / `.cloud-sub-status` / `.cal-settings-grid` / `.cal-field` / `.cal-sync-row` 等 ~10 條 rule
- `js/app.js`：新增 `cloudUpdateCalSigninGate()`；`cloudRenderCalendarUI` / `cloudUpdateSyncIndicator` / `cloudOnCalendarEnabledToggle` 內呼叫；啟動 setTimeout 加同步；APP_VERSION
- `service-worker.js`：CACHE_VERSION

### 不動的部分
- 序列化 / 同步 / merge / push 邏輯：完全沒動
- schema 沒動
- cloudCalendarConfig 結構沒動

### 你會看到的差別
1. 進設定頁 → 「☁️ 雲端同步」卡內預設只看到登入區 + 立即同步，雲端歷史 / 離線備份要點才開
2. 「📅 Google 行事曆同步」卡點開後，未登入時 checkbox 灰色不能勾，上方顯示黃色提示
3. 啟用後，「日曆」「通知時間」兩個欄位並排顯示（桌面），不再垂直疊
4. 「立即同步」按鈕跟「上次同步」狀態同一列
5. 「建議建外包專用日曆」收進折疊區（最下面）

## v3.24.19 — 危險區獨立 + 雲端同步文字校正（2026-05-09）

### 1. 「危險區」獨立成設定頁最下面的 card
**之前**：「載入範例資料」+「清空所有資料」混在「☁️ 雲端同步 → 💾 離線資料備份」sub-section 底下，標題「⚠️ 危險操作」，視覺上跟「匯出 / 匯入」並排，容易誤點。

**現在**：獨立 card `#card-danger`，放設定頁最下面（CSS order 90，「關於」之前）：
- 紅色左 border 視覺警示
- 卡 head 紅色「⚠️ 危險區」+ 紅色「不可逆操作」狀態
- 預設摺疊（要點才展開），減少誤觸機會
- 內含兩個區塊：「載入範例資料」+「清空所有資料」

### 2. 「清空所有資料」改成 inline 確認 input
**之前**：點按鈕 → confirm dialog → prompt 輸入「確認清空」
- 流程：兩個彈窗，輸入文字在 prompt 裡（無視覺提示）

**現在**：
- 「清空」按鈕預設 disabled（灰色不可點）
- 上方顯眼紅字提示「**確定清空所有資料**」
- 旁邊 input 框，照打就解鎖按鈕
- 按下後直接清空（不再需要 confirm dialog）
- 清空後 input 自動清空、按鈕重新 disabled
- `clearAll(skipPrompt)` 加參數，從 inline 確認進來時跳過原本 confirm + prompt

### 3. 雲端同步卡內文字校正（簡單明瞭）

| 原文字 | 改成 |
|---|---|
| 登入後資料同步到你自己的 Google Drive 應用程式資料夾。 | 登入後自動同步到你的 Google Drive。 |
| （Google 登入元件初始化中，請稍候…） | 登入元件載入中… |
| 自動同步，1 小時後 token 過期需重新登入。 | （整段刪除 — silent refresh 已自動續，不必再提） |
| 手動備份永久保留；自動每日備份會分層保留。 | 手動備份永久保留。 |
| 標籤（例：月底結算前） | 備份標籤（選填） |
| 🔄 重新整理列表 | 🔄 重新整理 |
| 點「重新整理列表」載入 | 點「重新整理」載入 |
| 匯出 / 匯入到本機檔案，跟 Drive 雲端同步無關。建議偶爾手動備份一份到電腦，當作雙保險。 | 匯出 / 匯入到本機檔案，當作雙保險。 |
| 📤 匯出 JSON 備份 | 📤 匯出 JSON |
| 📥 匯入備份 | 📥 匯入 |
| 📊 匯出 CSV（做帳用） | 📊 匯出 CSV |
| 從 Drive 拉取最新版本（含三方合併、衝突 modal） | 從 Drive 拉取最新版本 |
| 正在載入 Google 登入元件… | 載入中… |

### 影響範圍
- `index.html`：刪「危險操作」區塊（雲端同步卡內）；新增 `#card-danger` 卡（設定頁最下面）；雲端同步卡 9 處文字校正
- `css/style.css`：`#tab-settings > #card-danger { order: 90; }`、`.card-danger` 紅色左 border
- `js/app.js`：`clearAll(skipPrompt)` 加跳過參數；新增 `onDangerClearConfirmInput` / `onDangerClearConfirm`；APP_VERSION
- `service-worker.js`：CACHE_VERSION

### 不動的部分
- 同步 / 序列化 / merge / push 邏輯：完全沒動
- schema 沒動
- `loadDemo()` 函式沒動（只是按鈕位置改）

### 你會看到的差別
1. 設定頁最下面多一張紅色「⚠️ 危險區」摺疊卡
2. 點開後看到「載入範例資料」+「清空所有資料」兩個區塊
3. 「清空」按鈕預設灰色不可點 → 在 input 照打「確定清空所有資料」7 個字 → 按鈕變紅可點
4. 點下去直接清空（不再跳兩個 dialog）
5. 「☁️ 雲端同步」卡的所有說明文字變短、變直接

## v3.24.18 — UX 視覺優化八項（2026-05-09）

### 1. Dashboard stat 卡初始 flash 一致
- HTML 預設值「`$0`」改成「`NT$0`」，跟渲染後格式一致（避免短暫 flash）

### 2. stat 卡顏色語意統一
新增 3 個 stat 樣式變體：
- `.stat.success` 綠色左 border（已收款）
- `.stat.info` 藍色左 border（待完成 / 進行中）
- `.stat.year` 紫色左 border（年度，跟收益分頁累計收入 legend 同色）

Dashboard 4 張 stat 卡套用語意：本月已收款=綠 / 本月待收款=黃 / 本月待完成=藍 / 年度=紫

### 3. 「達成目標」card 動態 hide（修小 bug）
- `loadDisplayPrefUI()` 啟動時也立刻同步 `rev-goals-card` 的 hidden 狀態
- 之前若 `config.showGoalsCard=false` 但 app 啟動到第一次 renderRevenueGoals 跑完之間，card 還會短暫顯示

### 4. 打勾完成 / 標收款 微動效
- 新增 `.pulse-success`（綠光暈擴散 0.5s）、`.pulse-paid`（金色光暈 0.5s）兩個 keyframe
- 新增 `flashRowPulse(jobId, pulseClass)` 工具函式，找所有 `[data-job-id="..."]` 加上 class
- `toggleDone` 標完成時觸發綠光暈
- `confirmPaidDate` 單筆收款時觸發金色光暈
- 涵蓋 5 種視圖（comfort / compact / table / card / dashboard 近期案件）
- 支援 `prefers-reduced-motion` — 系統偏好減動效時自動停用

### 5. Dashboard 數字 CountUp 動畫
- 新增 `countUpStat(elementId, target)` 工具函式
- 用 `requestAnimationFrame` + ease-out cubic 緩動，280ms 滾動到目標
- 4 張 stat 卡的 value 都套用
- 從「上次顯示的數字」滾到新值（避免每次都從 0 開始重滾）
- 差距 < NT$ 100 直接 set（避免無謂動畫）
- 支援 `prefers-reduced-motion`

### 6. 案件 modal 金額千分位即時 hint
- 「總金額」input 下方加 `#job-amount-formatted` 提示
- onInput 時 `updateJobAmountSummary()` 內順手更新顯示「≈ NT$ 18,000」
- 不影響 input 本身（保留 type=number 上下箭頭等原生 UX）

### 7. 案件 modal 日期欄位快速選擇按鈕
- 「開始日期」下方：`今天 / 明天 / 下週一 / 清空`
- 「截止日」下方：`今天 / +3天 / +7天 / 清空`
- 新增 `setJobDateQuick(type, preset)` 函式
- 新增 `.date-quick-picks` / `.date-quick-btn` 樣式

### 8. Dashboard 加「⚡ 今天的重點」清單
- 新卡片 `#today-todo-card`（在 stat-grid 上方），預設 hidden
- 渲染條件：5 種重點任一觸發才顯示
  - 🔴 截止當日（今天 endDate / date 命中）
  - 🟡 即將到期 1-3 天內
  - 🟠 完成已久未收款（沿用 `config.unpaidRemindDays` 預設 7 天，業主層級覆寫優先）
  - 📅 月底快到（今天 ≥ `config.monthEndReminderDay` 預設 25）
  - 🐢 拖款警告（沿用 `computeSlowPayJobs`，最多顯示 3 筆）
- 點擊條目：跳該案件編輯 modal（如有 jobId）/ 跳請款單分頁（月底提醒）
- 沒任何重點時整張卡 hide，不佔空間
- `renderDashboard()` 開頭呼叫一次

### 影響範圍
- `js/app.js`：APP_VERSION、新增 `renderTodayTodo` / `setJobDateQuick` / `countUpStat` / `flashRowPulse` 共 4 個工具函式；`toggleDone` / `confirmPaidDate` / `updateJobAmountSummary` / `loadDisplayPrefUI` / `renderDashboard` 5 個既有函式改動
- `index.html`：dashboard 加 `#today-todo-card`；stat-grid 4 張卡加 success/warning/info/year class + 預設值改 NT$0；案件 modal 加 `#job-amount-formatted` hint + 兩組日期快速選擇按鈕
- `css/style.css`：新增 7 個 rule block（stat 顏色 / today-todo / date-quick-btn / pulse keyframes）
- `service-worker.js`：CACHE_VERSION

### 不動的部分
- 序列化 / 同步 / merge / push / schema 邏輯：完全沒動
- 雲端設定 / Calendar 設定：沒動
- 沒新增 localStorage key（業務資料）
- 異地電腦同步行為一致

### 你會看到的差別
1. dashboard 一進來看到「⚡ 今天的重點」（如果有事），點任一條跳對應 modal
2. 4 張 stat 卡各有顏色 border：綠（已收）/ 黃（待收）/ 藍（待完成）/ 紫（年度）
3. 數字會平滑滾動到位（不再瞬間切換）
4. 點 ✓ 完成 → row 一閃綠光；標收款 → 一閃金色光
5. 案件 modal 輸入金額時，下方有「≈ NT$ 18,000」千分位 hint
6. 案件 modal 日期欄位下面有「今天 / 明天 / 下週一」快速按鈕
7. 設定「不顯示收益目標卡片」時，整張 card 真的不見（不再留空白框）

## v3.24.17 — 設定頁巡查修補（2026-05-09）

巡查 v3.24.16 改動後遺留的問題，一次補齊。

### 1. 修 onboarding bug（dead reference）
- `app.js` line 13208 的 onboarding 'blank' 分支引用已刪除的 `card-myinfo` element
- if (myinfo) 防護住不會 crash，但 toast 還是顯示「💡 建議先到『我的資料』填寫姓名與匯款資訊」（誤導 — 該卡已不存在）
- **修法**：改成跳請款單分頁 + toast 文字更新「💡 建議先到『請款單』分頁設定收款帳號（姓名、匯款資訊）」

### 2. 設定頁卡片視覺順序調整
**之前**：雲端同步 → 顯示偏好 → Google 行事曆同步
**現在**：雲端同步 → Google 行事曆同步 → 顯示偏好

理由：「同步」相關功能放一起（雲端同步 + 行事曆同步），個人化偏好（顯示偏好）放後面。

實作：用 CSS `order` 屬性，HTML 順序保持原樣（避免大塊 swap 風險）。`#tab-settings` 改為 flex column，三張卡分別給 order 1/2/3，「關於」div 加 class `settings-about` 給 order 99。

### 3. 小幫手 9 個狀態預覽收進 details
「🎨 顯示偏好」card 展開後一進去就看到 9 個狀態預覽按鈕（待機 / 處理中 / 思考 / 完成 / 錯誤 / 搜尋中 / 慶祝 / 睡覺 / 眨眼），視覺很吵。
**修法**：把這 9 個按鈕用 `<details><summary>▸ 預覽其他狀態</summary>...</details>` 包起來，預設折疊。

### 4. CSS dead code 標 deprecated
v3.24.16 刪了「🔔 通知與提醒」card 後，CSS 有 ~15 條 rule 沒地方用：
- `.alert-matrix` / `.alert-matrix-header` / `.alert-row` / `.alert-cell` / `.alert-name` / `.alert-config` / `.alert-na` / `.alert-row--separator` / `.cal-disabled` 等

**修法**：在 `.alert-matrix` 段落上方加 `@deprecated v3.24.16` 註解，保留以備將來想恢復「提醒類型矩陣」UI 可一鍵回復。

### 5. JS dead reference 標註
兩處 getElementById 找已刪除的 element（已用 `if (el)` 防護不會 crash）：
- `cloudUpdateMasterToggle` 內找 `alert-cal-disabled-hint` / `.alert-matrix` 等（line ~3210）
- `updateNotifUI()` 整個函式找 `notif-status` / `notif-enable-btn` / `notif-disable-btn` / `notif-denied-help`（line ~9000）

**修法**：在這兩處加 `@deprecated v3.24.16` / `v3.24.17 dead refs` 註解，標明 dead 但保留以備恢復。

### 影響範圍
- `index.html`：「關於」div 加 class `settings-about`；mascot 預覽按鈕包進 `<details>`
- `css/style.css`：新增 5 條 `#tab-settings` flex order rules；`.alert-matrix` 段落加 deprecated 註解
- `js/app.js`：onboarding 'blank' 分支邏輯修正；兩處 dead refs 加註解；APP_VERSION
- `service-worker.js`：CACHE_VERSION

### 不動的部分
- 序列化 / 同步 / merge / push 邏輯：完全沒動
- schema：沒動
- 雲端 / Calendar / 通知時間設定：沒動

## v3.24.16 — 設定頁大整理（8 卡 → 4 卡）（2026-05-09）

### 背景
設定頁累積了 8 張卡，多數內容對個人接案者沒必要，且彼此功能重疊（資料備份 vs 雲端歷史 vs Drive 同步全是「資料怎麼存」）。整理成 4 張，視覺更清爽。

### 改動

| 原卡片 | 處理 |
|---|---|
| 🔐 Google Drive 同步 | **改名「☁️ 雲端同步」** + 內含 sub-section（雲端歷史 + 離線備份） |
| 我的收款資訊 | **整張刪除**（內容已搬到請款單分頁，這邊只剩跳轉按鈕沒實際用途） |
| 🎨 顯示偏好 | **保留**，併入「🤖 小幫手」當 sub-section |
| 🤖 小幫手 | **刪除獨立卡**，內容搬進「🎨 顯示偏好」 |
| 🔔 通知與提醒 | **整張刪除**（桌面通知功能停用 + 提醒類型矩陣全部隱藏） |
| 💾 資料備份 | **改名「💾 離線資料備份」** + 搬進「☁️ 雲端同步」當 sub-section |
| 📅 Google 行事曆同步 | **保留獨立**（不合併到雲端同步，因概念不同） |
| 📦 雲端備份歷史 | **改名「📦 雲端版本歷史」** + 搬進「☁️ 雲端同步」當 sub-section |

### 新結構（4 張卡）

```
1. ☁️ 雲端同步
   ├─ Google 帳號登入 / 登出 / 同步狀態 / 立即同步按鈕
   ├─ 📦 雲端版本歷史（建備份 / 重新整理列表 / list）
   └─ 💾 離線資料備份（匯出 JSON / 匯入 JSON / 匯出 CSV / 危險操作）

2. 🎨 顯示偏好
   ├─ 收益目標達成率 toggle
   └─ 🤖 小幫手（啟用 / 名字 / 試試看 / 預覽 9 種狀態）

3. 📅 Google 行事曆同步
   ├─ 啟用 / 日曆選擇
   ├─ 通知時間 09:30
   └─ 立即同步按鈕

4. （ABOUT 區塊保留）
```

### 桌面通知功能停用
- `setTimeout(maybeFireNotifications, 4000)` 註解掉（停所有桌面通知觸發）
- 函式（`requestNotifPermission` / `disableNotif` / `sendTestNotification` / `sendNotification` / `maybeFireNotifications` / `isNotifEnabled` / `notifSupported`）保留為 dead code，未來想恢復把那行 setTimeout 復原即可
- 對應 config 欄位（`enableOverdueAlert` / `enableDueSoonAlert` / `enableUnpaidLongAlert` / `enableMonthEndAlert` / `enableBillingDayAlert` / `enableSlowPayAlert` / `enableBackupAlert`）保留在 schema 內（避免 migration 風險）

### 提醒類型矩陣 UI 全隱藏
- `alert-overdue-desktop` / `alert-dueSoon-days` / `alert-unpaidLong-calendar` 等 21 個 input 整段刪除
- `loadReminderConfigUI()` 因內部都用 `if (g('id')) ...` 防護，UI 不存在不會報錯
- `cfg.syncTypes` 預設值仍是 `{ jobs: true, unpaidLong: true, monthEnd: true, billingDay: true, slowPay: true, dailyMorning: true }` → 行事曆同步繼續按這些預設值推

### Google 行事曆同步卡內提示更新
原指向「通知與提醒」卡的「💡 要同步哪些事件 → 在『🔔 通知與提醒』卡的『📅 Google 行事曆』欄勾選」訊息更新為說明預設行為。

### 影響範圍
- `index.html`：刪除 3 張獨立 card（mascot / reminder / backup / cloud-snapshots）；改名 1 張 card（cloud-auth h3 「🔐 Google Drive 同步」→「☁️ 雲端同步」）；展開 cloud-auth body 加 2 個 sub-section
- `js/app.js`：APP_VERSION + 註解掉 `setTimeout(maybeFireNotifications, 4000)`
- `service-worker.js`：CACHE_VERSION
- 不動 schema、不動 cloudCalendarConfig、不動雲端同步邏輯

### 你會看到的差別
1. 設定頁總共只有 4 張卡（少 4 張）
2. 「我的收款資訊」、「🤖 小幫手」、「🔔 通知與提醒」、「💾 資料備份」、「📦 雲端備份歷史」這 5 張卡都不見
3. 「🔐 Google Drive 同步」改成「☁️ 雲端同步」，展開後可以看到雲端版本歷史 + 離線資料備份
4. 「🎨 顯示偏好」展開後可以設小幫手
5. 「📅 Google 行事曆同步」獨立保留，通知時間照常設定

## v3.24.15 — 同步防呆六項（Phase 1 + Phase 2 全做）（2026-05-09）

### 背景
v3.24.13 強化 push 失敗處理、v3.24.14 強制備份才能更新；但仍有 race condition、阻斷器、多裝置衝突等真實風險。本版一次補齊六項，覆蓋阻斷器到樂觀鎖。

### 1. pollAppVersion 加 cache buster（修阻斷器）
**問題**：service worker 是 cache-first，`fetch(location.href, { cache: 'no-store' })` 標頭沒用 — SW 攔截後直接回 cache，**v3.24.14 強制備份 modal 永遠不會被觸發**。

**修法**：fetch URL 加 `?_pollver=${Date.now()}` query param，SW 的 `caches.match` 因 URL 不匹配而 miss → 走 network 拉到真新版 HTML。

### 2. 啟動 init overlay 擋編輯（修 race condition）
**問題**：app 啟動 → cloudInitTrackerFile 在跑（拉 Drive 1–3 秒）→ **使用者已經可以操作 UI** → 改完案件後 init 跑完 mergeStates 可能把剛改的當衝突或被結果蓋掉。

**修法**：新增 `showInitOverlay()` / `hideInitOverlay()`：
- cloudInitTrackerFile 開頭 → 蓋黑色半透明 overlay + spinner
- 文字：「☁️ 從 Google Drive 載入資料中… 為避免資料衝突，請稍候 1–3 秒」
- 所有 return 路徑（A/B/C 三種 case + error）都會 hide
- z-index 99999、backdrop-filter blur

### 3. navigator.onLine 監聽（離線提示 + 上線重推）
**問題**：離線時 push 失敗 → 紅 banner 寫「同步失敗」但不夠精準。使用者不知道是「網路斷了」還是「token 過期」。

**修法**：
- `online` 事件 → toast「🌐 網路恢復，自動重新同步…」+ `cloudPushFailRetries=0` + 立刻 `cloudPushNow()`
- `offline` 事件 → `cloudSetSyncStatus('error', '📵 離線中，網路恢復後自動同步')`
- banner 訊息更精準

### 4. 未同步筆數 `cloudPendingChangesCount`
**問題**：使用者改 5 筆，看不到「目前有 5 筆等待推送」。萬一中途出狀況（瀏覽器 crash），不知道有沒有上去。

**修法**：
- `save()` 內 `cloudPendingChangesCount++`
- `cloudPushNow` 成功時歸零
- sync indicator 顯示「⌛ 推送中… (3)」、「⏳ 同步中… (5)」
- title 也補「本機有 N 筆未上傳改動」

### 5. 樂觀鎖 / version check on push（修兩地電腦衝突）
**問題**：電腦 A 改了 case X → 推到 Drive (modifiedTime=T1)。電腦 B 改了 case Y → 它的 lastSyncedAt=T0 → 直接 PUT → 整份 wrapper 蓋掉雲端 → **case X 消失**。

**修法**：`cloudPushNow` 進入推送前，先 `driveGetFileMeta(fileId)` 比對 modifiedTime：
- 雲端 modifiedTime > 本機 lastSyncedAt → 表示有別的裝置剛改過
- 不直接覆蓋 → 改成下載雲端 → `cloudResolveAndMerge` 跑三方合併（會自動處理衝突 modal 或 clean push）
- 合併完成後標記 success，本次 push 視為已完成
- 若 version check 本身失敗（網路、token）→ 不阻塞，繼續走原本流程（避免 push 永遠卡住）

新增 logAction `cloud-push-conflict-detected`，可從操作日誌追蹤。

### 6. 多 tab 偵測（BroadcastChannel）
**問題**：同一台電腦開兩個 tab 編輯，兩 tab 的 push 互蓋（race condition）。

**修法**：每個 tab 啟動時 `new BroadcastChannel('freelance-tracker-cloud-tabs')`：
- 每 5 秒廣播 heartbeat（含 tabId、timestamp）
- 收到別人的 heartbeat → 加入 `_otherTabsActive` Map
- 超過 12 秒沒新 heartbeat → 視為已關閉
- 偵測到 ≥ 1 個其他 tab → 底部顯示**黃色警告 banner**「⚠️ 偵測到此 app 在 N 個分頁同時開啟，請只在一個分頁編輯」
- iOS Safari 14+ 支援 BroadcastChannel；不支援的瀏覽器靜默跳過（不報錯）
- beforeunload 廣播 leaving 訊號

### 影響範圍
- `js/app.js`：
  - `pollAppVersion()` 加 cache buster URL
  - 新增 `showInitOverlay` / `hideInitOverlay`
  - `cloudInitTrackerFile` 各 return 路徑加 hideInitOverlay
  - `cloudPushNow` 加 version check 前置邏輯
  - 新增 `online` / `offline` listener
  - 新增 `cloudPendingChangesCount` 計數
  - sync indicator 顯示筆數
  - 新增 `_initTabDetection` / `_renderMultiTabWarning` / `BroadcastChannel`
- `css/style.css`：新增 `.init-overlay` / `.init-overlay-spinner` / `.init-overlay-msg` / `.init-overlay-hint` / `.multi-tab-warning` 樣式
- `index.html`：不動

### 你會看到的差別
1. 一開 app 看到半透明 overlay + spinner 「載入中」→ 1–3 秒後消失才能編輯
2. 改完案件 → sync indicator 顯示「⌛ 推送中… (1)」直到雲端確認
3. 拔網路線 → 紅 banner 變成「📵 離線中…」→ 接回網線 → toast「🌐 網路恢復…」自動重推
4. 兩台電腦先後改同一份 → 第二台 push 前會偵測到雲端較新 → 自動觸發合併 → toast「✓ 偵測到雲端有新版，已自動合併」
5. 同一電腦開 2 tab → 底部黃 banner 提示「請只在一個分頁編輯」
6. 真有新版本上 GitHub Pages → polling 真的會偵測到 → 跳出 v3.24.14 強制備份 modal

## v3.24.14 — 強制備份才能更新（保護資料免於新版 bug 影響）（2026-05-09）

### 背景
v3.24.x 期間發生過資料回溯 / 欄位遺失事故。即使 v3.24.13 強化了同步機制，**新版本本身仍有可能引入 bug 影響資料**。所以增加一道「更新前必須先備份」的閘門。

### 1. 點「點此更新」不再直接 reload
**之前**：`pollAppVersion()` 偵測到新版 → 顯示橫幅「點此強制更新」→ `onclick="hardReload()"` 直接清快取重整 → 萬一新版有 bug → 資料風險暴露。

**現在**：
- 橫幅文字改成「**點此更新（強制先備份）**」
- onclick → `showUpdateConfirmModal()` 開「強制備份才能更新」modal

### 2. 「強制備份才能更新」modal
新增 `#update-confirm-modal`（在 index.html）：
- 標題：「🆕 偵測到新版本」
- 顯示新版本號 / 目前版本 / Google 登入狀態
- **三個按鈕**：
  - `📸 建立 Drive 快照並更新` — 用 `cloudCreateSnapshot('manual', ...)` 建快照，標籤帶版本號方便辨識
  - `📥 下載 JSON 備份` — 用 `buildTrackerWrapper()` 組完整資料、瀏覽器下載 `.json` 檔到本機；下載後 modal 換成「✓ 確認備份完成，立刻更新」
  - `⏸️ 稍後再說` — 關 modal，但下次 poll 偵測到新版會再次提示
- **沒有「直接更新不備份」選項**

### 3. 未登入情境保護
未登入 Google 時：
- 顯示警告「⚠️ 未登入 Google，無法建 Drive 快照」
- Drive 快照按鈕 disabled
- 仍可選「下載 JSON 備份」當保險

### 4. Drive 備份失敗的後備方案
建立 Drive 快照若失敗（網路錯誤、token 過期等）→ 跳 alert 明確告知，建議改用「下載 JSON 備份」或修復後再試 → 按鈕復原讓使用者選別條路。

### 5. 版號 badge（header）也走 modal
- index.html `app-version-badge` 的 onclick 從 `hardReload()` 改成 `onVersionBadgeClick()`
- 邏輯：偵測到有新版 → 開 modal；沒新版 → 跳 confirm 問「要強制清快取嗎？」（避免誤點）

### 6. logAction 追蹤備份動作
- `update-backup` 事件（type: 'drive-snapshot' / 'json-download'，含 from / to 版本）
- 之後若使用者再回報資料事故，可從操作日誌看是否更新前有備份

### 影響範圍
- `js/app.js`：新增 `showUpdateConfirmModal()` / `confirmUpdateWithDriveBackup()` / `confirmUpdateWithJSONDownload()` / `cancelUpdate()` / `onVersionBadgeClick()`；改 `pollAppVersion()` 內橫幅 onclick
- `index.html`：新增 `#update-confirm-modal`；`app-version-badge` onclick 換成新函式
- `service-worker.js` / `index.html` meta / `js/app.js` APP_VERSION：bump 三處 v3.24.14

### 你會看到的差別
- 偵測到新版 → 橫幅或版號 badge 點下去 → **不會直接更新**
- 跳 modal 強制你選一個備份方式
- 備份成功後才會 reload
- 如果離線 / 未登入 / Drive 失敗 → 至少還有「下載 JSON 」這條保險

## v3.24.13 — 雲端同步穩定性大補強：絕不丟資料（2026-05-09）

### 背景
使用者反映「前兩三天的修改被回溯」「外包欄位、稅務勾選沒儲存到雲端」。即使根因不易完全重現，先把同步機制全面強化，**保證未來不會再丟資料**。

### 1. cloudPushNow 併發防護升級
**之前**：`cloudPushInProgress = true` 時，後續呼叫 `cloudPushNow()` 直接 `return` → **靜默丟棄**。
- 情境：使用者連改兩筆，第一筆推送中，第二筆被丟掉
- 結果：localStorage 有第二筆，雲端只有第一筆 → 表面正常但實際失同步

**修法**：加 `cloudPushPendingAfter` flag → 進行中的話標記，當前推送結束後立刻再推一次（不 debounce）。

### 2. 失敗自動指數退避重試
**之前**：push 失敗只 console.error → user 不知道、不會重試（要等下次 save 才再試）。

**修法**：失敗後自動排程重試 — 3s → 8s → 20s → 1m → 3m，最多 5 次。失敗計數器在成功後歸零。

### 3. 關 tab / 切背景前強制 flush
**之前**：debounce 2 秒。使用者改完馬上關 tab → push 沒被觸發 → 改動只在 localStorage。

**修法**：
- `visibilitychange` 切到 hidden → 立刻 `cloudFlushPush()`（跳過 debounce）
- `beforeunload` 關 tab 前最後一次嘗試 flush
- 新增 `cloudFlushPush()` 公用函式（清 timer + 立刻 push）

### 4. 紅色固定 banner（強提示）
**之前**：同步失敗只有右上角小 indicator + toast 飄一下 10 秒就消失。使用者不會注意到。

**修法**：新增 `cloudUpdateSyncBanner()` — 觸發條件：
- 已登入但 sync error → 「⚠️ 資料未同步到雲端」+「立刻重試」+「重新登入」按鈕
- 未登入但本機有資料 → 「⚠️ 未登入 Google，資料只存在本機」+「立刻登入」按鈕

banner 紅底白字，position: fixed 釘在頂部，z-index 9999，body 加 `padding-top` 不擋內容。狀態恢復後自動消失。

### 5. silent refresh 失敗也跳 banner
**之前**：silent refresh 連續失敗 → 只 toast「⚠️ Google 連線過期」10 秒消失。

**修法**：除了 toast，同時觸發 `cloudSetSyncStatus('error', ...)` → banner 固定在頂部，user 不點「重新登入」就不消失。

### 6. 新 API：cloudRetryPush + cloudFlushPush
- `cloudRetryPush()`：給 banner 的「立刻重試」按鈕用，重試計數歸零後立刻推
- `cloudFlushPush()`：清 debounce timer + 立刻 push，給 visibilitychange / beforeunload 用

### 7. app 啟動 1 秒後檢查 banner
給 `cloudInitGoogleAuth` 拉完登入狀態的時間，避免「上次 token 已過期 → 重開時 banner 沒及時顯示」。

### 影響範圍
- `js/app.js`：cloudPushNow / cloudSchedulePush / cloudFlushPush / cloudRetryPush / cloudUpdateSyncBanner / cloudSetSyncStatus / _handleSilentRefreshFailure / visibilitychange + beforeunload listener / 啟動初始化
- `css/style.css`：新增 `.sync-error-banner` 樣式（紅底白字、固定頂部）+ `body.has-sync-banner` 補 padding
- `index.html`：不動（banner 用 JS 動態 prepend 到 body）

### 序列化檢查（不需修改）
確認 `buildTrackerWrapper()` 把整個 `state.jobs` JSON.stringify → 所有欄位（含 `taxApplied`、`outsourceCost`、`outsourceTo`）都會被帶進去。Schema 沒問題，問題在 push 觸發 / 失敗提示，已修。

### 你會看到的差別
1. 同步失敗 → 頂部固定紅 banner，**不消失直到你按重試或重新登入**
2. token 過期 → 同樣紅 banner，user 不會在「以為登入但其實沒登入」狀態下繼續操作
3. 改完案件馬上關 tab → 大概率還是會 flush 完才關（visibilitychange 比 beforeunload 早觸發）
4. 兩個改動同時發生（例如改 A 案件→改 B 案件）→ 不會吃掉，B 會在 A push 完後立刻補推

## v3.24.12 — 批次模式在 5 視圖中失效修復（2026-05-09）

### 🚨 Bug 修復：批次模式 + 全選 / 反選失效
**症狀**：使用者進入批次模式後：
- 案件清單**完全沒有 checkbox** 顯示
- 點「全選」沒反應，「已選 0 筆」不變

**根因**：v3.21.0 加了 5 種視圖（comfort / compact / table / card / board），但只有 **comfort 視圖（`jobRow`）正確處理 bulkMode 的 checkbox**。其他 4 個視圖的渲染函式完全沒判斷 `bulkMode`：
- `renderJobsTable()`（報表視圖）→ 沒 checkbox 欄、row click 仍然開編輯 modal
- `jobRowCompact()`（緊湊視圖）→ 同上
- `jobRowCard()`（卡片視圖）→ 同上

且 `bulkSelectAll()` 跟 `bulkInvert()` 的 selector 寫死 `.row[data-job-id]`，**抓不到 table 視圖的 `<tr data-job-id>`**。

**修法**：
1. **`bulkSelectAll()` / `bulkInvert()`**：selector 從 `.row[data-job-id]` 改成 `[data-job-id]`，涵蓋所有視圖
2. **`renderJobsTable()`**：批次模式下表頭多一格 checkbox 欄、tr 第一格放 checkbox、row onclick 改 `toggleBulkSelect`、不顯示快速 action
3. **`jobRowCompact()`**：批次模式下渲染 checkbox + row click 切選取
4. **`jobRowCard()`**：批次模式下右上角放 checkbox（absolute 定位）+ selected 加 outline + 不顯示快速 action
5. **CSS**：補 `.jobs-table.bulk-mode tr`、`.jobs-table tr.bulk-selected`、`.job-card-tile.selected`、`.row-compact.selected` 視覺樣式

> 看板（board）視圖暫不處理批次（拖曳跟批次互斥，先讓 board 退回拖曳專屬）

### 附帶修復：「最近 last-month 個月」label
v3.24.10 加的 `'this-month'` / `'last-month'` 收益範圍快捷選項，沒在 `clickClientRank()` 處理 → 從業主貢獻排行點業主後，案件分頁的釘選 banner 會顯示「最近 last-month 個月」這種怪字串。

**修法**：`clickClientRank()` 新增兩個分支：
- `r === 'this-month'` → label = '當月'
- `r === 'last-month'` → label = '上個月'

### 附帶修復：外包對帳 UX
**症狀**：使用者反映「月份下拉只能看 5 月、點全部月份沒反應」。

**根因**：兩個 UX 問題（不是程式邏輯壞）：
1. 預設選 `months[0]`（最新月份）→ 進來只看到當月、切「全部」筆數沒變→ 誤以為下拉壞了
2. 沒任何提示說「下拉只列有派外包的月份」→ 資料量少時下拉只有 1–2 個選項，看起來像 bug

**修法**（`renderOutsourceReport()` line ~6361）：
1. 預設改選 `'all'`（全部月份），讓使用者一進來看到所有外包紀錄
2. 加 banner 顯示「📦 目前顯示：XX · 共 N 筆外包紀錄」
3. 只有 1 個月有外包時補一行：「💡 下拉只列出有派外包的月份，目前只有 1 個月有紀錄」

## v3.24.11 — Google 行事曆通知 iOS 修復 + 通知時間統一（2026-05-08）

### 🚨 Bug 修復：iOS 行事曆收不到通知
**問題**：v3 推到 Google Calendar 的事件**完全沒帶 `reminders` 欄位**，導致：
- Google 自家 client（網頁／Android）：吃使用者層級「預設提醒」，會跳通知 ✅
- **iOS 內建行事曆（CalDAV 同步）**：不吃 Google 那邊的預設，只認事件本身的 `VALARM`（即 `reminders.overrides`）→ **完全不跳通知** ❌

**修法**：所有 Google Calendar 事件強制帶 `reminders.overrides`：
- 時間事件：`{method: 'popup', minutes: 0}` → 準時跳通知（含 iOS）
- 全天事件（案件本身）：空 overrides → 不單獨提醒（靠每日早報帶）

### 全天事件改成時間事件
Google Calendar API 限制：全天事件的 `minutes` 必須 ≥ 0（事件**開始前** N 分鐘），無法在「當天 09:30」響。

把以下 4 種提醒從全天事件改成從「通知時間」起 15 分鐘的**時間事件**：
- 完成已久未收款（unpaidLong）
- 月底提醒（monthEnd）
- 業主固定請款日（billingDay）
- 拖款警告（slowPay）

→ 這 4 種事件現在會在 09:30 準時跳通知（手機含 iOS 都會響）

「案件本身（jobs）」**保留全天事件**，不單獨提醒（要在月檢視看到案件區間），靠每日早報於 09:30 帶過。

### UI 合併：「每日早報時段」改名「通知時間」
- `index.html` Google 行事曆同步卡的 ② 欄位 label 從「每日早報時段」改成「**通知時間**」
- 提示文字：「適用於所有 Google 行事曆提醒（早報、未收款、月底、請款日、拖款）」
- 「通知與提醒」卡頂部加說明：📅 Google 行事曆通知統一在「② 通知時間」設定（預設 09:30）

### 影響範圍
- 修改：`_calendarBuildEventResource`（line ~2638）→ 加 `reminders.overrides`
- 修改：`buildTargetCalendarEvents`（line ~2496）→ 4 種事件改時間事件 + 抽 `reminderTime` / `reminderEndTime` 變數
- 修改：`index.html` Step 2 label + 「通知與提醒」卡說明文字
- 不動 schema（`cfg.dailyMorningTime` 名稱保留，意義擴展）

### 測試步驟（更新後請做）
1. 重新整理頁面 → 設定頁 → 「Google 行事曆同步」卡 → 確認「② 通知時間」是 09:30
2. 點「立即同步到 Google 行事曆」→ 等同步完成
3. iPhone 上：設定 > 通知 > 行事曆 → 通知開啟（這個原本就要開，跟此版無關）
4. 等下一個 09:30 → iOS 應該會跳通知

## v3.24.10 — 收益總覽月度加「當月／上個月」快捷（2026-05-08）

### 收益總覽月度範圍選單新增 2 個快捷選項
- 在月度範圍下拉的最上方新增：
  - 📅 當月（this-month）
  - 📅 上個月（last-month）
- 視覺上用一條分隔線 `──────────` 跟原本的「最近 N 個月」選項分開
- 點擊後：
  - 當月 → 只顯示本月（YYYY-MM）一筆 bucket
  - 上個月 → 只顯示上月（自動處理跨年，例如 1 月選上個月會回到去年 12 月）
- 年度模式 fallback：
  - 當月 → 顯示本年
  - 上個月 → 顯示去年

### 實作細節
- `buildRangeOptions()`（line ~6396）：在月度模式的選單最前面 push 兩個新 option
- `renderRevenue()`（line ~6504）：新增 `r === 'this-month'` / `r === 'last-month'` 兩個分支，跑在 `r === 'all'` 之前
- 確保 buckets 有對應的 key（沒有就建空的 `{paid:0, unpaid:0, pending:0, gross:0, netAmount:0}`），避免空月顯示成「無資料」
- displayKeys 強制設為 `[ym]` 一個元素，stat 卡跟柱狀圖會只顯示這一格

### 為什麼加這個
- 自由接案常見場景：月底對帳（看當月）、跨月請款（看上個月）
- 之前只能選「最近 3/6/12 個月」，每次都要視覺找哪根柱子是當月，麻煩
- 預設選項 `selected` 維持「最近 6 個月」不變，不影響舊習慣

## v3.24.9 — 計時器隱藏 + Modal sticky footer + Google 登出 hotfix（2026-05-08）

### 1. 案件編輯 modal 計時器隱藏
- 工時那一排的 4 個計時器 element 加 `style="display:none"`：
  - `#job-timer-display`（00:00:00）
  - `#job-timer-toggle`（▶ 開始 按鈕）
  - `#job-timer-finish`（✓ 結束 按鈕）
  - 重設按鈕
- 工時 input 保留可手動輸入
- 計時器 JS 函式（toggleJobTimer / finishJobTimer / resetJobTimer / loadJobTimer）全部保留
- 未來想用：把 `style="display:none"` 拿掉即可

### 2. Modal 取消/儲存按鈕 sticky 凍結底部
- `.modal-actions` CSS 改 `position: sticky; bottom: -20px;` + 負 margin 抵銷 .modal padding
- 加 `border-top: 1px solid var(--border)` 視覺分隔
- 加 `background: var(--card)` 蓋住下方內容
- **7 個 modal 都自動受影響**（共用 .modal-actions class）：
  - 案件編輯
  - 業主編輯
  - 收款帳號編輯
  - 批次標收款日期
  - 設折扣
  - 確認動作
  - Onboarding
- 使用體驗：modal 內容捲動時，「取消」「儲存」按鈕永遠在底部

### 3. 🚨 Google 登出 hotfix
**Bug**：v3.22.10 的「啟動時主動 refresh」防護沒覆蓋「**關掉 app 過 1 hr 重開**」的情境。

**根因**：`cloudLoadAuthState()` 在 token 過期時直接清掉 localStorage 並 return false → `cloudInitGoogleAuth` 看到 `restored = false` → silent refresh 不會被觸發 → user 看到「未登入」。

**修法**：cloudLoadAuthState 改成「**token 過期不立刻清**」：
- 只要 user info 還在 → 還原所有狀態（含過期 token）→ return true
- cloudInitGoogleAuth 看到 restored = true → boot refresh 邏輯生效（remainingOnBoot < 0 → 立刻 _silentRefresh）
- silent refresh 成功 → 補新 token → user 完全無感
- silent refresh 失敗 → pill 變紅光暈 + toast 提示重登（user info 仍在，點頭像直接重登）

**user 看到的變化**：
- 改前：關掉 app 過 1 hr 重開 → pill 變回「+ 登入」灰色（被登出）
- 改後：關掉 app 過 N hr 重開 → pill 立刻顯示頭像 + email → 短暫 silent refresh 後一切正常（除非 Google session 也過期）

**localStorage 何時會清掉**：
- 損壞（JSON parse fail）
- 沒有 user info（user 主動點登出按鈕後）
- 不會因為「token 過期」清掉

---

## v3.24.8 — 帳面總收入用 jobFinalAmount + 分潤改基於未稅金額（2026-05-08）

### 1. 帳面總收入修正
- **改前**：sum(`j.amount`) — 原始金額（沒扣折扣）
- **改後**：sum(`jobFinalAmount`) — 折扣後（給業主請款的金額）
- 範例：4 筆原始 6,000、折扣 300 → 帳面總收入從 6,000 變 **5,700**
- 副標文字改成「給業主請款總額（折扣後）」

跟「月度業主彙整 → 請款金額」對齊。

### 2. 分潤算法改基於未稅金額
- **改前**：分潤 = `jobFinalAmount × rate%`（含稅算）
  - 範例：5,700 含稅、分潤 10% → 570
- **改後**：分潤 = `(jobFinalAmount − jobInvoiceTax) × rate%`（未稅算）
  - 範例：5,700 含稅、稅 271、分潤 10% → (5,700 − 271) × 10% = 543
- 對應 user 描述的「先扣稅 → 再扣外包 → 最後扣分潤」順序語意

**沒有設業主分潤的 user 不會看到變化**（最常見情境）。
有設業主分潤 + 有勾稅的案件，分潤金額會少一點點（更精準）。

### `_verifyJobNet` expected 更新
| # | 情境 | 舊 expected | 新 expected |
|---|---|---|---|
| 4 | 含稅 + 分潤 | 8,524 | 8,572 |
| 5 | 完整 | 3,524 | 3,572 |
| 7 | 折扣 + 完整 | 2,671 | 2,714 |

### 連動修正
- 月度業主彙整 / 業主排行 / 達成目標 / Tag 派圖 等用 jobNetAmount 的位置自動跟著對

---

## v3.24.7 — 回退 v3.24.6 的「全部都扣」決策，恢復 per-case taxApplied toggle（2026-05-08）

> User 澄清：v3.24.6 選的「算法 C」其實是想要「**有勾稅的案件用 /1.05 算**」，沒勾的不扣。所以回到 v3.24.5 的設計（per-case toggle），只是稅算法用 /1.05。

### 設計回到 v3.24.5 + /1.05 算法
- ✅ 案件 modal 重新有「📨 此案件含 5% 稅」toggle
- ✅ jobInvoiceTax 看 `j.taxApplied`：勾了才扣，沒勾不扣
- ✅ 稅算法：`final − round(final / 1.05)`（業主給的視為含稅，反推未稅）

### Schema v17 → v18
- 重新加 `case.taxApplied: false` 預設值
- ⚠️ **資料破壞警告**：v3.24.6 migration 已把 user 之前勾過的 `taxApplied` 全部清掉，現在重新加只是補欄位（值都是 false）
- user 需要重新勾選「之前有開發票的案件」

### 「實際入帳」hover ⓘ 文字更新
```
算法（per-case taxApplied）：
1. 有勾「📨 此案件含 5% 稅」的案件 → 視為含稅，未稅 = final / 1.05
2. 沒勾的案件 → 不扣稅（業主直接付）
3. 實際入帳 = (有勾的未稅 + 沒勾的請款) − 外包 − 分潤

範例（4 筆中 1 筆勾稅 4,275、其他 3 筆共 1,425；外包 1,150）：
勾稅部分稅金 = 4,275 − round(4275/1.05) = 204
實際入帳 = 5,700 − 204 − 1,150 = 4,346
```

### Bug 修復同 v3.24.5
- 沒勾稅的案件不會被扣 5%（修 v3.24.6 的問題）
- 月度業主彙整 / 收益總覽 / 業主排行 / Tag 派圖 等所有用 jobNetAmount 的位置自動正確

---

## v3.24.6 — 算法 C：所有請款都當含稅 + 移除 case.taxApplied + 加 hover 算法說明（2026-05-08）

> User 確認選擇「算法 C」：所有請款都視為含稅金額，全部 / 1.05 反推未稅 + 稅。

### 算法定案
```
公式：實際入帳 = (請款金額 / 1.05) − 外包成本 − 分潤
       即      = 請款金額 − 5%稅 − 外包 − 分潤
       
範例：請款 5,700、外包 1,150、無分潤
  未稅 = 5,700 / 1.05 = 5,429
  稅金 = 5,700 − 5,429 = 271
  實際入帳 = 5,429 − 1,150 = 4,279
```

### Schema v16 → v17
- 移除 `case.taxApplied`（migration 清掉欄位）
- 案件 modal 拿掉「📨 此案件含 5% 稅」toggle
- 既有勾過稅的案件 → 全部變成都扣（因為現在預設全部都扣）
- 既有沒勾稅的案件 → 從不扣變成扣（注意：這些案件的「實際入帳」會變少 5%）

### UI 變動
- **「實際入帳」欄旁加 ⓘ hover 提示**：滑鼠移過去顯示算法說明 + 範例計算
- **月度業主彙整 hint 文字**：清楚標明「算法 C」+ 公式
- **案件 modal「實收試算」**：永遠顯示稅項（不再條件顯示）

### `_verifyJobNet` 6 種情境
| # | 情境 | expected |
|---|---|---|
| 1 | 基本 10000（無折扣 / 分潤 / 外包） | 9,524 |
| 2 | 分潤 10% | 8,524 |
| 3 | 分潤 + 外包 5000 | 3,524 |
| 4 | 倒貼（外包 12000） | −2,476 |
| 5 | 折扣 10% + 分潤 + 外包 | 2,671 |
| 6 | amount = 0 | 0 |

### ⚠️ 重要警告
**如果你有業主不開發票（直接付 / 個人接案沒走會計流程）**：
- 算法 C 會把這些業主的金額也扣 5%
- 顯示的「實際入帳」會少 5%（不準確）
- 解決：跟我說「回到 per-case toggle」，會回退到 v3.24.5 的 j.taxApplied 設計

---

## v3.24.5 — 計算順序明確化：請款 → 稅 → 外包 → 分潤（2026-05-08）

> 算數結果跟 v3.24.4 一樣（加減法交換律），但**順序語意**對使用者更清楚。

### 修改範圍

**1. `jobNetAmount` 程式碼順序**
```js
// 改前：final - tax - commission - outsourceCost
// 改後：final - tax - outsourceCost - commission
```
順序：請款 → **先扣稅** → **再扣外包** → **最後扣分潤**。

**2. 案件 modal「實收試算」顯示順序**
```
業主應付 NT$5,700
− 5% 自吸收稅 −NT$204    ← 1. 先扣
− 外包 −NT$1,150          ← 2. 再扣
− 分潤 0                   ← 3. 最後（如果有）
─────────
我實收 NT$4,346
```

**3. 月度業主彙整 hint 文字**
```
💡 計算順序：請款金額 → 先扣稅務 → 再扣外包 → 最後扣分潤 = 實際入帳。
   發票稅務 = 5% 稅金本身（業主給的視為含稅，用 /1.05 反推）。
```

### 計算結果不變
加減法交換律 → 順序調整不影響數字。`_verifyJobNet()` 7 種情境 expected 全部維持 v3.24.4 的值。

---

## v3.24.4 — 發票稅務改顯示稅金本身 + /1.05 算法 + 實際入帳改 jobNetAmount（2026-05-08）

> 修 v3.24.3 月度業主彙整三個欄位語意：
> - 「發票稅務」之前顯示走發票部分的金額 → 改成顯示**稅金本身**
> - 「實際入帳」之前顯示不走發票部分的金額 → 改成顯示**真實口袋金額**（扣完稅 + 分潤 + 外包）
> - 算法 ×0.05 → /1.05（業主給的是含稅金額，反推未稅 + 稅）

### 算法修正：×0.05 → /1.05

**改前**（v3.24.3 之前）：
```
稅 = jobFinalAmount × 0.05
未稅 = jobFinalAmount × 0.95
範例：1,425 × 0.05 = 71（稅）；1,425 × 0.95 = 1,354（未稅）
```

**改後**（v3.24.4）：
```
未稅 = round(jobFinalAmount / 1.05)
稅 = jobFinalAmount − 未稅
範例：1,425 / 1.05 = 1,357（未稅）；1,425 − 1,357 = 68（稅）
```

業主給的金額是**含稅**，反推未稅 + 稅。誤差差幾元（×0.05 71 vs /1.05 68），但更精確符合會計慣例。

### 月度業主彙整三欄重新定義

| 欄 | 改前（v3.24.3） | 改後（v3.24.4） |
|---|---|---|
| 請款金額 | sum(jobFinalAmount) | 不變（業主應付） |
| 發票稅務 | sum(jobFinalAmount where taxApplied) — 走發票部分總額 | **sum(jobInvoiceTax) — 稅金本身**，用 /1.05 反推 |
| 實際入帳 | sum(jobFinalAmount where !taxApplied) — 不走發票部分總額 | **sum(jobNetAmount) — 真實口袋**（扣稅+分潤+外包） |

### 範例對照（user 圖第二張：欣莘 5 月）

```
原始    NT$6,000
外包   −NT$1,150（4 筆中部分有派外包）
請款    NT$5,700（折扣後）
發票稅務 −NT$ ???（走發票部分的稅金）
實際入帳 NT$ ???（5,700 − 稅 − 分潤 − 外包）
```

具體數字依實際 case.taxApplied 設定而定。

### CSV export 同步改

### 案件 modal 「實收試算」也用 /1.05

打開案件編輯 → 勾「📨 含 5% 稅」→ 即時試算用新算法（之前 71 → 現在 68）

### `_verifyJobNet()` 測試案例更新
7 種情境的 expected 重算：
| # | 情境 | 改前 | 改後 |
|---|---|---|---|
| 2 | 含稅 (10000) | 9500 | 9524 |
| 4 | 含稅+分潤 | 8500 | 8524 |
| 5 | 完整 | 3500 | 3524 |
| 7 | 折扣10%+完整 | 2650 | 2671 |

### 不變
- 給業主看的請款單預覽（仍 jobFinalAmount，業主看不到稅）
- 收益總覽 6 個 stat 卡（v3.24.3 加的）
- 「外包對帳」子分頁

---

## v3.24.3 — 月度業主彙整重整 + 收益總覽加「帳面/實際」雙視角（2026-05-08）

### 月度業主彙整表格大改
拿掉舊欄位（5%稅 / 實收 / 已收 / 待收 / 進行中），改成 user 想要的對帳視角：

| 業主 | 案件 | 原始金額 | (分潤?) | 外包 | 請款金額 | 發票稅務 | 實際入帳 |
|---|---|---|---|---|---|---|---|

新欄位定義：
- **請款金額** = sum(`jobFinalAmount`) — 折扣後業主應付總額
- **發票稅務** = sum(`jobFinalAmount` where `taxApplied`) — 走發票流程那部分總額
- **實際入帳** = sum(`jobFinalAmount` where `!taxApplied`) — 不走發票直接付那部分總額
- **核對**：請款金額 = 發票稅務 + 實際入帳

CSV export 同步改欄位。

### 收益總覽 stat 卡（從 5 → 6 個獨立卡）
新增「帳面總收入」+ 既有「期間總收入」改名「實際總收入」：

| 卡 | 算法 | 意義 |
|---|---|---|
| 🆕 **帳面總收入** | sum(`j.amount`) | 原始金額（未扣折扣 / 稅 / 分潤 / 外包） |
| ✏️ **實際總收入**（原期間總收入） | sum(`jobNetAmount`) | 真實口袋（扣折扣 + 稅 + 分潤 + 外包） |
| 已收款 | 不變 | |
| 待收款 | 不變 | |
| 每月平均 | 改用 `netAmount` | 實際 |
| 最佳月份 | 改用 `netAmount` | 實際 |

### 連動修正
- `buckets`（renderRevenue 月度堆疊）加 `gross` + `netAmount` 欄
- `renderRevSummary` 6 個卡片
- 「實際總收入」卡片下方副標：「vs 帳面 NT$XX,XXX」（看落差）
- 負數金額用紅色 `−NT$XX` 顯示（倒貼情境）

### 不變
- 給業主看的請款單預覽（仍用 `jobFinalAmount`）
- 收益的趨勢圖、業主排行、Tag 派圖等子模組（仍用既有資料）

---

## v3.24.2 — 扣稅改 case 層級（schema v16）— 每筆案件自己決定，月度 / 收益自動連動（2026-05-08）

> v3.24.1 把 toggle 放在請款單頁面只影響預覽，月度報表 / 收益分頁不會跟著變 → 不直觀。改成最乾淨的設計：每筆案件自己有 `taxApplied` 屬性。

### Schema v15 → v16
- `case.taxApplied`（boolean）：此案件含 5% 稅（自吸收）
- migration 補預設 false 給所有舊案件

### 計算公式（最終版）
```
實收 = 折扣後 − 5% 稅（如有）− 分潤 − 外包成本
       (final)  (taxApplied 才扣)  (commission)  (outsourceCost)
```
- 7 種情境驗證通過（`_verifyJobNet()` console helper）

### UI 變動

#### 1. 案件編輯 / 新增 modal 加 toggle
位置：金額 / 折扣 / 收款狀況之後、派外包之前
```
☐ 📨 此案件含 5% 稅（自吸收，請款單給業主看的金額不變，只在對帳時扣）
```
- 每筆案件自己決定（最直覺）
- saveJob 寫入 `case.taxApplied`
- editJob / openJobModal 還原值
- 「實收試算」即時連動（業主應付 → 5% 稅 → 分潤 → 外包 → 我實收）

#### 2. 請款單頁面拿掉 toggle（v3.24.1 加的清掉）
- 沒有頁面級 toggle 了
- 對帳區「💰 我的對帳」**保留**，但稅讀 `case.taxApplied` 累計（顯示「− 5% 自吸收稅 (N 筆)」）

#### 3. 月度業主彙整表格 + CSV 加回「5% 稅」欄
- 任一筆 taxApplied → 顯示「5% 稅」欄
- 「實收」名稱回來（之前 v3.24.1 改「名義實收」）
- 連動所有用 jobNetAmount 的位置（業主排行、Tag 派圖、達成目標、智慧分析…）

#### 4. 業主層級
- 沒有 `requiresInvoice` 屬性了（schema v15 已清掉）
- 業主 modal 沒 toggle
- 業主 detail 頁沒 badge

#### 5. 給業主看的請款單
**完全沒動**。仍然只顯示 `jobFinalAmount`。扣稅是內部對帳資訊。

### 連動的計算位置（自動正確）
- 收益總覽（期間總收入 / 已收 / 待收）
- 月度業主彙整（含 5% 稅欄）
- 業主貢獻排行
- Tag 派圖
- 工作熱圖
- 達成目標進度
- 智慧分析
- 業主 detail 頁累計
- 業主健康度
- 月度報表 CSV
- 「📦 外包對帳」子分頁

### 工作流（典型）
1. 新增案件時順手勾「📨 此案件含 5% 稅」
2. 不用做別的事 — 月度報表 / 收益 / 請款單對帳 自動全部正確

---

## v3.24.1 — 扣稅 toggle 改請款單級別（schema v15）（2026-05-08）

> 修正 v3.24.0 的設計問題：扣稅應該是「**每次請款的決定**」，不是業主固定屬性。同一個業主不一定每次都要開發票。

### 重大設計變更
- **拿掉**業主層級 `requiresInvoice` 屬性（schema v14 → v15 migration 清掉這個欄位）
- **拿掉**業主編輯 modal 的「📨 含稅請款」toggle
- **拿掉**業主 detail 頁的「📨 含稅」badge
- **新增**請款單頁面 toggle：「📨 本次請款扣 5% 稅（自吸收，匯出時不顯示給業主）」
  - 純 UI 狀態，不寫入任何資料
  - 切到請款單分頁預設**關閉**，user 每次自己決定
  - 切換時即時更新對帳區

### 新增「💰 我的對帳」區（請款單分頁）
- 請款單預覽**下方**獨立 card
- 顯示：業主應付 / 5% 稅（toggle ON 時）/ 分潤 / 外包 / 我實收 / 已收 / 待收
- 條件顯示：toggle ON OR 有分潤 OR 有外包 → 顯示完整拆解；否則簡版（只顯示業主應付 + 已收 / 待收）
- **`no-print` class** + 在 `#invoice-print` 容器外 → 匯出 PDF / PNG 不會包含

### 連動修正
- `jobNetAmount`：拿掉 5% 稅項，改成 `final − 分潤 − 外包`（稅是請款單級別，case 層級不算）
- `jobInvoiceTax` 函式刪除
- 月度業主彙整表格 + CSV：拿掉「5% 稅」欄，「實收」改稱「**名義實收**」（標明不含稅）
  - 加註說明：「要看本次扣稅後實收，請到請款單對帳區」
- 案件 modal 的「實收試算」也對應修改（不再顯示稅）

### Schema migration v14 → v15
- 把已存在 client 的 `requiresInvoice` 欄位刪除（cleanup）
- 沒有任何資料風險（這欄位只用過 1 天 — v3.24.0 → v3.24.1 同日）

### 兩個視角分工
- **月度業主彙整 / 收益分頁**：「**名義實收**」（不考慮稅，分潤 + 外包扣完）
  - 因為月度層級無法判斷哪些案件當時請款時有扣稅
- **請款單對帳區**：「**實際實收**」（含本次 toggle 扣稅）
  - 反映本次具體請款的真實口袋

---

## v3.24.0 — 含稅請款 + 派外包成本 + 外包對帳分頁（schema v14）（2026-05-08）

> 兩個會計痛點：「業主要開發票，5% 稅自吸收」「我接案派給別人做，要看真實實收」。一次解決。

### Schema v13 → v14
- `client.requiresInvoice`（boolean）：此業主含稅請款（自吸收 5% 稅）
- `case.outsourceTo`（字串）：外包對象名稱
- `case.outsourceCost`（數字）：給外包的金額（定額）

### 計算公式（核心）
```
實收 = 折扣後 − 5% 稅 − 分潤 − 外包成本
       (final)  (tax)   (commission) (outsourceCost)
```
- **允許負數**：派外包超支時 user 倒貼，紅色顯示「⚠️ −NT$2,000（倒貼）」
- 帳對齊：`final = net + tax + commission + outsourceCost`（會計恆等式）
- 7 種情境驗證跑過（見 `_verifyJobNet()` console helper）

### UI 變動

#### 1. 業主編輯 modal
新增 toggle：「📨 此業主含稅請款（NT$ 5% 我自己吸收）」

#### 2. 業主 detail 頁
業主名旁加 badge「📨 含稅」（user 自己看的，業主看不到）

#### 3. 案件編輯 modal
- 新增 collapsible「🤝 派發給外包（選填）」內含 2 欄位：外包對象 + 金額
- 新增「💰 實收試算」唯讀區（業主含稅 OR 有外包時才顯示）
- 即時計算 + 拆解顯示「業主應付 → 扣稅 → 扣分潤 → 扣外包 = 我實收」
- 負金額擋住：`amount < 0` 不存（0 仍允許，估價 / 諮詢用）

#### 4. 月度業主彙整表格
- 條件加欄：「5% 稅」「外包」（任一筆有就顯示）
- 「實收」欄改用升級後的 `jobNetAmount`
- partial 比例分配重寫：`paidNet + unpaidNet + pendingNet = net`（會計對齊）
- 負數紅色顯示

#### 5. 收益分頁加「📦 外包對帳」子分頁
- 月份選單（自動列出有外包的月份）+「全部」選項
- 表格欄位：日期 / 案件 / 業主 / 外包對象 / 業主應付 / 外包成本 / 我實收
- 合計列 + 依外包對象彙整（給誰付了多少 / 幾筆）
- 匯出 CSV

#### 6. 請款單**完全不變**
業主看到的金額仍是 `jobFinalAmount`，看不到稅 / 外包資訊。

### 計算位置自動連動（用 jobNetAmount 的地方都受影響）
- 月度業主彙整 ✓（已升級顯示拆解）
- 業主貢獻排行 ✓
- Tag 派圖 ✓
- 熱圖 ✓
- 達成目標進度 ✓
- 智慧分析 ✓
- 業主 detail 頁累計 ✓
- 業主健康度 ✓

### Dev 工具
- `_verifyJobNet()` console 函式：跑 7 種情境驗證計算正確性

---

## v3.23.3 — Mascot 三批整合：8 狀態 + 4 嘴巴 + 4 眼睛 + 11 連動點（2026-05-05）

> 一次把計畫的三批（緊接做 / 看反應再做 / 趣味性）全部做完。

### 新增 3 個狀態（從 5 → 8）
| state | 動畫 | 表情 | 觸發時機 |
|---|---|---|---|
| `searching` | 大幅左右搖（0.9s） | 😐 一條線 | 全域搜尋打開 |
| `celebrating` | 兩跳 + 旋轉（1.4s）| 😄 大笑 | 月目標達標 / streak-3 / 慶祝事件 |
| `sleeping` | 緩慢呼吸（4.5s） + 💤 飄字 | 😐 + 閉眼（r=2 點）| Idle 5 分鐘 |

### 新增表情變化（4 種眼睛 × 4 種嘴巴）
- `mascotSetEyes('open' | 'shocked' | 'closed')` — 圓眼 / 大眼（r=14）/ 點點（r=2）
- `mascotWink()` — 左眼短暫變點 220ms
- 嘴巴 4 種：`happy / flat / worried / big`（已有）+ `open` 小 O 形（shocked 用）

### 11 個新連動點

| # | 觸發 | 反應 |
|---|---|---|
| 1 | 計時器啟動 | mascot loading + 「開始計時，加油」 |
| 2 | 計時器結束（finishActiveTimer） | mascot success + 「辛苦了，喝口水」 |
| 3 | 收款單筆 ≥ 10000 | 大眼 shocked 1 秒 + 「哇！大筆入帳」 |
| 4 | 全域搜尋打開 | mascot searching + 「找什麼？我幫你」 |
| 5 | 全域搜尋關閉 | 自動回 idle |
| 6 | 匯出請款單 PDF | mascot loading → 完成 success / 失敗 error |
| 7 | 匯入備份成功 | mascot success + 「資料來了！歡迎回來」 |
| 8 | 匯入備份失敗 | mascot error |
| 9 | 月目標達標（每月一次） | mascot celebrating + 「月目標達標了，你是神！」 |
| 10 | 連續完成 3+ 筆案件（1 分鐘內）| mascot celebrating + 「3 連發！」 |
| 11 | Ctrl+Z undo | mascot thinking + 「上一步…撤回中」 |

### 額外趣味
- **隨機眨眼**：25-45 秒一次，只在 idle 時觸發
- **idle 5 分鐘自動 sleeping**：閉眼 + 呼吸 + 💤 飄字
- **任何活動立刻甦醒**：mousemove / click / keydown / scroll / touchstart
- **甦醒打招呼**：「啊？我剛打瞌睡」「你回來啦～」

### 訊息池新增
- `big-payment` 4 句、`search-open` 3 句、`export-pdf` 3 句、`import-success` 3 句、`undo-action` 3 句、`sleeping` 3 句、`wake-up` 3 句

### 設定頁
🤖 小幫手 card 預覽按鈕從 5 個擴充到 9 個：
`😊 待機 / ⌛ 處理中 / 🤔 思考 / ✅ 完成 / ❌ 錯誤 / 🔍 搜尋中 / 🎉 慶祝 / 😴 睡覺 / 😉 眨眼`

### Localstorage 新增 key
- `cloud-mascot-last-monthly-goal`：記錄最後一次達標的月份（YYYY-MM），避免每次 render 都重複慶祝

---

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

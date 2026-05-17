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
| **v3.23.1** | **Mascot 移到左下避開 FAB + 換新版 SVG（多手臂造型，加 id 方便狀態切換）** | ✅ **完成（2026-05-05）** |
| **v3.23.2** | **Mascot 5 狀態（idle/loading/thinking/success/error）+ 4 種嘴巴表情切換 + 自動連動 mascotSay / cloudSetSyncStatus（純 CSS，零依賴）** | ✅ **完成（2026-05-05）** |
| **v3.23.3** | **Mascot 三批整合：8 狀態（+ searching/celebrating/sleeping）+ 4 嘴巴 + 4 眼睛（含 wink/shocked）+ 11 連動點 + idle 5 分鐘睡覺 + 隨機眨眼** | ✅ **完成（2026-05-05）** |
| **v3.24.0** | **含稅請款 + 派外包成本：schema v14（client.requiresInvoice + case.outsourceTo/outsourceCost）+ 案件 modal 實收試算 + 月度業主彙整加稅/外包欄 + 「📦 外包對帳」子分頁 + 業主 badge** | ✅ **完成（2026-05-08）** |
| **v3.24.1** | **扣稅 toggle 改請款單級別：schema v15（移除 client.requiresInvoice）+ 請款單頁面新增 toggle + 預覽下方加「💰 我的對帳」區（業主看不到，不會匯出）** | ✅ **完成（2026-05-08）** |
| **v3.24.2** | **扣稅改 case 層級（schema v16）：每筆案件自己決定 taxApplied，月度 / 收益自動連動，請款單對帳區讀案件累計** | ✅ **完成（2026-05-08）** |
| **v3.24.3** | **月度業主彙整改欄（請款金額 / 發票稅務 / 實際入帳）+ 收益總覽加「帳面總收入」卡（6 個 stat 卡並列）** | ✅ **完成（2026-05-08）** |
| **v3.24.4** | **發票稅務改顯示稅金本身（/1.05 反推）+ 實際入帳改顯示 jobNetAmount（扣稅+分潤+外包後）** | ✅ **完成（2026-05-08）** |
| **v3.24.5** | **計算順序明確化：請款 → 先扣稅 → 再扣外包 → 最後扣分潤（程式碼順序、案件試算顯示、hint 文字統一）** | ✅ **完成（2026-05-08）** |
| **v3.24.6** | **算法 C：所有請款一律視為含稅 / 1.05 反推（移除 case.taxApplied + schema v17）+「實際入帳」加 ⓘ hover 算法說明** | ✅ **完成（2026-05-08）** |
| **v3.24.7** | **回退 v3.24.6：恢復 per-case taxApplied toggle（schema v18）+ 稅算法保留 /1.05 + ⓘ hover 文字更新** | ✅ **完成（2026-05-08）** |
| **v3.24.8** | **帳面總收入改用 jobFinalAmount（折扣後）+ 分潤改基於未稅金額算（先扣稅再算分潤）** | ✅ **完成（2026-05-08）** |
| **v3.24.9** | **計時器 UI 隱藏（功能保留）+ Modal 取消/儲存 sticky footer + 🚨 Google 登出 hotfix（cloudLoadAuthState 過期不清，啟動時 silent refresh 補 token）** | ✅ **完成（2026-05-08）** |
| **v3.24.10** | **收益總覽月度範圍選單新增「📅 當月」「📅 上個月」快捷選項（自動處理跨年）** | ✅ **完成（2026-05-08）** |
| **v3.24.11** | **🚨 Google 行事曆 iOS 通知修復：事件強制帶 reminders.overrides；4 種全天事件改時間事件；UI label「每日早報時段」→「通知時間」** | ✅ **完成（2026-05-08）** |
| **v3.24.12** | **🚨 批次模式 5 視圖修復 + 外包對帳 UX：table/compact/card 加 bulkMode checkbox；selector 改寬涵蓋 `<tr>`；外包對帳預設選「全部月份」+ 加 banner 提示** | ✅ **完成（2026-05-09）** |
| **v3.24.13** | **🚨 雲端同步穩定性大補強：cloudPushNow 加併發重排（不丟 save）+ 失敗指數退避重試（3s→8s→20s→1m→3m）+ visibilitychange/beforeunload flush + 同步失敗 / 未登入時頂部紅 banner（立刻重試 / 重新登入按鈕）+ silent refresh 失敗連動 banner** | ✅ **完成（2026-05-09）** |
| **v3.24.14** | **🛡️ 強制備份才能更新：偵測到新版 → 跳 modal 強制使用者選「Drive 快照」或「下載 JSON 」備份才能 reload；未登入只能下載 JSON；Drive 失敗回退讓使用者改下載；版號 badge / 更新橫幅都走新 modal** | ✅ **完成（2026-05-09）** |
| **v3.24.15** | **🛡️ 同步防呆六項：(1) pollAppVersion 加 cache buster 修阻斷器 (2) 啟動 init overlay 擋編輯防 race condition (3) navigator.onLine 監聽 + 上線立刻重推 (4) 未同步筆數顯示在 sync indicator (5) push 前 version check 防多裝置衝突 (6) BroadcastChannel 多 tab 偵測警告** | ✅ **完成（2026-05-09）** |
| **v3.24.16** | **🧹 設定頁大整理（8 卡 → 4 卡）：刪「我的收款資訊」「🤖 小幫手」「🔔 通知與提醒」「💾 資料備份」「📦 雲端備份歷史」獨立卡；改名「🔐 Google Drive 同步」→「☁️ 雲端同步」；雲端歷史 + 離線備份併進去當 sub-section；小幫手併進「🎨 顯示偏好」；桌面通知功能停用（dead code 保留）；提醒類型矩陣全隱藏（cfg.syncTypes 預設仍 work）** | ✅ **完成（2026-05-09）** |
| **v3.24.17** | **🧹 設定頁巡查修補：(1) 修 onboarding 'blank' 分支引用已刪 card-myinfo bug 改跳請款單分頁；(2) 設定頁卡片視覺順序用 CSS `order` 調成「雲端同步 → 行事曆同步 → 顯示偏好」（同步相關放一起）；(3) 小幫手 9 個狀態預覽收進 `<details>` 預設折疊；(4) CSS .alert-matrix 等 ~15 條 dead rule 標 @deprecated；(5) updateNotifUI / cloudUpdateMasterToggle 內 dead refs 標 @deprecated（不刪、保留以備恢復）** | ✅ **完成（2026-05-09）** |
| **v3.24.18** | **✨ UX 視覺優化八項：stat 卡顏色語意統一（綠/黃/藍/紫）+ 數字 CountUp 滾動 + 打勾微動效（綠/金光暈）+ 「⚡ 今天的重點」dashboard 卡（截止/到期/拖款/月底/拖款警告聚合）+ 案件 modal 金額千分位 hint + 日期欄位快速選擇按鈕（今天/明天/下週一/+3/+7）+ 達成目標 card 啟動同步 hide + HTML 預設 NT$0** | ✅ **完成（2026-05-09）** |
| **v3.24.19** | **🚨 危險區獨立 + 雲端同步文字校正：「載入範例 / 清空資料」搬到設定頁最下面獨立紅色 card；「清空所有資料」改成 inline input 確認（打「確定清空所有資料」才解鎖按鈕）；雲端同步卡 9 處文字精簡** | ✅ **完成（2026-05-09）** |
| **v3.24.20** | **🎨 設定頁同步區排版優化：(1) 行事曆同步未登入時 master toggle disabled + 黃色警告 (2) 行事曆設定改 inline + 日曆/通知時間並排 grid + 立即同步同列 + 建議外包日曆折疊 (3) 雲端同步「雲端版本歷史 / 離線資料備份」改 details 折疊（progressive disclosure）** | ✅ **完成（2026-05-09）** |
| **v3.24.21** | **🚨 修無限推送迴圈：v3.24.15 樂觀鎖時間戳不對等 bug（本機 wrapper.lastModifiedAt vs Drive modifiedTime 差 200-500ms 永遠誤判雲端較新）→ 改用 Drive 回傳 modifiedTime + 加 5 秒緩衝；cloudResolveAndMerge / Case B 內 applyTrackerData 後清 push timer 防 race** | ✅ **完成（2026-05-11）** |
| **v3.24.22** | **兩地電腦無感切換：(1) silent refresh 成功後自動 pull（修「重登後要手動同步」bug）(2) visibilitychange/focus 也 throttle 後 auto pull（家裡推 → 公司切回分頁自動拿）(3) 心跳偵測（30 秒一次，> 5 分鐘 gap = 睡眠喚醒 → 補 refresh+pull）(4) requestAccessToken 帶 hint:email 跳過帳號選擇器** | ✅ **完成（2026-05-11）** |
| **v3.24.23** | **同步併發保護 + 無變動跳過 push：(1) cloudPullNow 加 cloudPullInProgress flag + silent 參數 (2) cloudResolveAndMerge 內 push 搶 cloudPushInProgress 鎖 + 處理 pendingAfter (3) merged === remote 跳過 driveUpdateFile 避免無謂版本 +1（新 logAction event cloud-merge-noop）(4) cloudInitTrackerFile 加 cloudInitInProgress（hideInitOverlay 內順手 reset）(5) cloudPullNow 完成更新 _lastAutoPullAt** | ✅ **完成（2026-05-13）** |
| **v3.24.24** | **修「sync indicator 殘留 ○ 未啟用」bug：cloudInitGoogleAuth 結尾無條件再呼叫 cloudUpdateSyncIndicator（修 async race timing 造成 HTML 預設值沒被覆蓋）+ 啟動 1 秒後 setTimeout 內也補一次（雙層保險）** | ✅ **完成（2026-05-13）** |
| **v3.24.25** | **silent refresh 強化：(1) 修「成功後 retry timer 沒清」造成多餘 silent refresh (2) MAX_REFRESH_RETRIES 1→3 容忍網路抖動 (3) 改指數退避 5s→10s→20s 總共 35 秒重試窗口** | ✅ **完成（2026-05-13）** |
| **v3.24.26** | **🚨 修「睡眠喚醒後紅 banner 誤觸發」bug：driveFetch 進入時 token 無效 → 立刻 throw 比 silent refresh 完成早 → 跳紅 banner 嚇人。修法：新增 ensureValidToken async helper，driveFetch 入口先 await 等 silent refresh 完成（最多 15 秒）才 throw。所有 driveFetch 呼叫者（push/pull/init/calendar）都自動受惠** | ✅ **完成（2026-05-13）** |
| **v3.24.27** | **silent refresh 卡死保護 + 訊息友善化：(1) `_silentRefresh` 加 30 秒 safety timer 防 GIS SDK 不 callback 卡死 (2) DriveAuthError 訊息從技術術語「access token 已過期」改成行動指示「Google 連線需要重新整理，請點右上角『重新登入』」 (3) ensureValidToken timeout 15s→30s 給 silent refresh 失敗+3 次 retry 充分時間** | ✅ **完成（2026-05-13）** |
| **v3.24.28** | **純前端極致 silent refresh（最大化降低重登機率）：(1) silent refresh 時機提前 5min→15min 給充分 retry 窗口 (2) 啟動主動 refresh 門檻 30min→45min (3) 新增 periodic refresh check 每 20 分鐘背景主動檢查（即使使用者一直停留同一分頁、電腦沒睡眠也會跑）** | ✅ **完成（2026-05-13）** |
| **v3.24.29** | **🚨 修「每天跳衝突 modal」bug：診斷確認 base（cloud-last-synced-snapshot）= null 導致 mergeStates 把所有差異欄位誤判為「兩邊都改」，每天家裡↔公司切換就跳 modal。修法：(1) mergeStates 自動把 base=null 當成 base=local（雲端優先，本機獨有保留）(2) cloudInitTrackerFile 結尾偵測 base=null 主動 cloudPullNow 重建基準（雙層保險）** | ✅ **完成（2026-05-13）** |
| **v3.24.30** | **🚨 修「同步卡 N 天前、沒登出但顯示不同步」bug：診斷確認 cloudPushNow 達 MAX retries 後永久停止 + silent refresh 成功後沒復活卡死的 push。修法：(1) silent refresh ok 時偵測卡住的 push（pending > 0 或 retries > 0）→ 歸零計數 + 1 秒後主動重試 (2) cloudPushNow 達 MAX 後改 5 分鐘 watchdog 不再完全放棄 (3) focus / visibilitychange 偵測卡住的 push → 復活** | ✅ **完成（2026-05-16）** |
| **v3.24.31** | **🚨 沒同步就不准編輯 + 衝突一律採雲端（使用者明確要求）：(1) sync error 持續 20 秒 → 半透明 overlay 蓋住整個 app，只能「立刻重試 / 重新登入 / 暫時關閉」(2) cloudResolveAndMerge 衝突自動 remote-wins 改寫 merged，不再開「選本機 / 雲端」modal (3) cloudShowConflictModal 變 dead code 保留** | ✅ **完成（2026-05-16）** |
| **v3.24.32** | **🛡️ 衝突採雲端前自動備份本機到 Drive：v3.24.31 後使用者擔心「本機改動被蓋」風險，加 cloudResolveAndMerge 偵測 conflicts > 0 → fire-and-forget 呼叫 cloudCreateSnapshot('manual', '衝突備份_N筆_時間') 備份本機後再 remote-wins。可從設定頁「Drive 備份」卡片找該標籤還原** | ✅ **完成（2026-05-16）** |
| **v3.24.33** | **🚨 修「重整後右上角登入但編輯資料 indicator 卡 N 小時前」bug：兩個獨立 bug — (A) cloudInitGoogleAuth restored path 沒呼叫 cloudInitTrackerFile（只有新登入呼叫）→ 切帳號 / 清 cache 後 trackerFileId 缺失 (B) cloudSchedulePush 在 !trackerFileId 時 silent return，indicator 維持 idle 假裝已同步。修法：restored path 補 cloudInitTrackerFile + schedulePush trackerFileId 缺失時主動 init 補救** | ✅ **完成（2026-05-16）** |
| **v3.24.34** | **UX 改進 — app-version-badge 改顯示資料時間為主 + B 機偵測 A 機改動主動 toast：(1) updateVersionBadge 預設「📊 資料：N 分前同步」，有新 app 版本時切「🆕 vXXX 點此更新」醒目樣式 (2) cloudResolveAndMerge 比對 base vs remote 偵測遠端有新改動 → toast「☁️ 已同步另一台電腦的最新改動」(3) cloudUpdateSyncIndicator 內呼叫 updateVersionBadge，相對時間隨 30 秒 ticker 自動跳** | ✅ **完成（2026-05-16）** |
| **v3.24.35** | **🚨 獨立 code review 找到 7 個 critical/high bug 全修：(C2 revert) v3.24.29 base=local 修法造成本機獨有 entity 被 _cloudMergeEntity 誤判「同意刪」消失 → revert 回 baseObj={} (C7) cloudSignOut 新增清所有 timer 防 watchdog 跨帳號污染 (H6) saveConfigOnly 補 cloudPendingChangesCount++ (H2+H3) overlay「暫時關閉」改為 5 分鐘後若仍 error 自動重新顯示 (C1) isLocalDataEmpty 補檢查 invoiceHistory (H5) pendingAfter 路徑補寫 snapshot 避免循環 (H11) cloudPushNow 在登出後設 idle 而非 error 避免 overlay 誤跳** | ✅ **完成（2026-05-16）** |
| **v3.24.36** | **🚨 第二輪深挖修 8 個 bug：(N16) cloudPushNow version check 改 inline merge 不再呼叫 cloudResolveAndMerge → 修「push 死循環 fetch/merge 但永遠推不上去」(N1) cloudInitTrackerFile 包 try/finally 修「init throw → flag 卡死整個 app」(B5) access_denied/invalid_grant 直接 cloudSignOut 修「Google 端撤銷後假登入卡死」(B6) modal 開啟時延後 auto pull 30 秒避免覆蓋編輯中內容 (B7) 暫時關閉期間每 30 秒積極 retry silent refresh + push (B1) silent refresh 3 次失敗後 5 分鐘長間隔 retry「永不重登」(B3) ensureValidToken 在 retry pending 時繼續等 (B4) cloudSignIn 設 _isManualSignIn 修「卡在 silent refresh 中按重登 callback 走錯分支」(N4) cloudPullNow no-base 路徑也備份本機 (Y6) cloudSignIn 加 2s debounce (G1) token expire buffer 60s→5min** | ✅ **完成（2026-05-16）** |
| **v3.24.37** | **🎨 UX/UI 直覺化大改裝（Plan agent 14 條建議的 ABDEF）：(A) 右上瘦身 — sync-indicator 合進 cloud-account-pill 後綴文字 + ↻ 📜 收進 ⋮ overflow menu + 主題按鈕統一 🌓 emoji (B) Dashboard today-todo card 永遠上方顯示（空 state ☕）+ stat 4→3 卡，年度降次行 caption (D) 案件 5 視圖→3（列表 / 報表 / 看板，按鈕加文字 label）+ 進行中案件加左色條 indicator + 已完成案件預設展開收款 (E) 離線備份預設展開 + mascot 預設關 + 砍 9 個 dev tool 預覽 + 立即同步去主視覺化（搬進「進階」摺疊，文字改「🔍 重新檢查雲端」）(F) 行事曆 legend 改 chip-style 視覺示意 + stat 邊框 3px→4px。revert v3.24.34 badge** | ✅ **完成（2026-05-16）** |
| **v3.24.38** | **右上加 sync-info chip + account pill 改 dropdown menu：(1) 新 chip「☁️ #N · X 分前」常駐顯示雲端版本 + 同步時間，點擊重新檢查雲端；error 時改紅底「⚠️ 同步失敗·點此重試」(2) cloud-account-pill 改 dropdown menu，內含帳號 / 狀態 / 重新檢查 / 雲端設定 / 登出（confirm 後執行）(3) cloudRenderAccountPill 拿掉 sync 後綴（chip 接管）(4) 清掉設定頁「進階：手動觸發」冗餘摺疊** | ✅ **完成（2026-05-16）** |

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

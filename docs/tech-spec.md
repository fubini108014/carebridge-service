# 🛠️ 陪診媒合平台：技術規格文件 (Tech Spec)

## 1. 專案技術架構
* [cite_start]**前端介面**：單一 React SPA，掛載 1 個 LIFF ID，全螢幕模式 (Full)，內部以 React Router 處理各角色路由 [cite: 51, 171]。
* **後台管理介面**：獨立 Web 應用（非 LIFF），供平台管理員使用。
* [cite_start]**後端語言**：Node.js (Express) 或 Python (FastAPI) [cite: 52, 171]。
* [cite_start]**資料庫**：PostgreSQL (處理帳務與日曆關聯) [cite: 53, 171]。
* [cite_start]**第三方串接**：Line Messaging API、藍新金流 API (NewebPay，含付款、退款、自動撥款) [cite: 54, 171]。
* **CI/CD**：GitHub Actions，部署至雲端平台（待定）。
* **環境**：初期僅維護 Production 環境。

## 1.1 LIFF 路由規劃

**民眾端**
| 路由 | 頁面 |
| :--- | :--- |
| `/civilian` | 業務列表 |
| `/civilian/agent/:id` | 業務介紹 + 行事曆 |
| `/civilian/booking/confirm` | 預約確認 + 付款 |
| `/civilian/booking/result` | 預約結果 |
| `/civilian/my-bookings` | 我的預約紀錄 |
| `/civilian/subscribe` | 訂閱付款 |

**業務端**
| 路由 | 頁面 |
| :--- | :--- |
| `/agent` | 行事曆管理 |
| `/agent/kyc` | KYC 上傳 |
| `/agent/qrcode/:bookingId` | QR Code 出示 |
| `/agent/commission` | 佣金看板（含浮水印） |
| `/agent/wallet` | 錢包明細 |

**診所端**
| 路由 | 頁面 |
| :--- | :--- |
| `/clinic/scan` | 掃碼入口 |
| `/clinic/verify/:bookingId` | 成交金額輸入 |
| `/clinic/verify/result` | 核銷結果確認 |
| `/clinic/report` | 對帳報表 |

**後台 Web（非 LIFF）**
| 路由 | 頁面 |
| :--- | :--- |
| `/admin/kyc` | KYC 審核列表 |
| `/admin/agents` | 業務管理（扣點／停權） |
| `/admin/wallet` | 手動調帳 |
| `/admin/broadcast` | 推播審核 |
| `/admin/settings` | 費率與規則設定 |

## 2. 第一階段：核心商模驗證 (P0)
### 2.1 身分與權限模組
* [cite_start]**Rich Menu 切換**：串接 Line richmenu_id 綁定 API，依角色、KYC 狀態或訂閱狀態動態切換選單 [cite: 59, 172]。
* [cite_start]**KYC 處理**：上傳身分證/存摺照片至 S3，並同步更新至後台審核清單 [cite: 60, 172]。

### 2.2 預約與日曆調度
* [cite_start]**日曆實作**：使用 `FullCalendar.js`，僅顯示業務開放且未被佔用之時段 [cite: 62]。
* [cite_start]**時段鎖定**：民眾預約後進入 Locked 狀態 10 分鐘，待金流成功通知後轉為 Confirmed [cite: 65, 172]。
* [cite_start]**1 小時緩衝**：自動鎖定成交行程前後各 1 小時之時段 [cite: 64, 172]。

## 3. 第二階段：線下核銷與分潤 (P1)
### 3.1 成交核銷邏輯
* [cite_start]**QR Code 產生**：業務 LIFF 生成內含 `booking_id` 與 `token` 的唯一碼 [cite: 70, 174]。
* [cite_start]**診所掃碼**：喚起 `liff.scanCode()` 讀取後跳轉至成交金額輸入頁 [cite: 71, 174]。

### 3.2 佣金看板安全
* [cite_start]**動態浮水印**：利用 Canvas 實作 `user_id` + `current_timestamp` 以 45 度角密集分佈之浮水印 [cite: 80, 174]。

## 4. 第三階段：帳務透明化 (P2)
### 4.1 自動結算引擎
* [cite_start]**比例鎖定**：依據「預約成交當下」記錄的比例計算分潤，避免事後變更糾紛 [cite: 86, 175]。
* [cite_start]**錢包狀態**：Pending（待核銷）→ Available（可撥款）→ Paid（已撥款）[cite: 84, 175]。撥款由系統每月定期透過藍新 API 自動執行，無需業務手動申請。

## 5. 開發檢查清單 (DoD)
- [ ] [cite_start][ ] 各角色能依身分看到正確的 Line Rich Menu [cite: 92, 176]。
- [ ] [cite_start][ ] 預約衝突檢查（含 1 小時緩衝）運作正常 [cite: 93, 176]。
- [ ] [cite_start][ ] 業務錢包能即時顯示診所掃碼後的「待核銷」紀錄 [cite: 94, 176]。
- [ ] [cite_start][ ] 佣金看板正確顯示防截圖動態浮水印 [cite: 95, 176]。
- [ ] [cite_start][ ] 業務取消已接單時，民眾自動全額退款且業務扣點紀錄正確寫入 [cite: 96, 176]。
- [ ] [cite_start][ ] 藍新金流退款 API 能在業務拒絕接單時正常運作 [cite: 96, 176]。
- [ ] [ ] 每月自動撥款透過藍新 API 正確觸發並更新錢包狀態為 Paid。
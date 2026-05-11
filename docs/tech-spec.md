# 🛠️ 陪診媒合平台：技術規格文件 (Tech Spec)

## 1. 專案技術架構
* **前端介面**：單一 React SPA，掛載 1 個 LIFF ID，全螢幕模式 (Full)，內部以 React Router 處理各角色路由。
* **後台管理介面**：獨立 Web 應用（非 LIFF），供平台管理員使用。
* **後端語言**：Node.js (Express) 或 Python (FastAPI)。
* **資料庫**：PostgreSQL (處理帳務與日曆關聯)。
* **第三方串接**：Line Messaging API、藍新金流 API (NewebPay，含付款、退款、自動撥款)。
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
* **Rich Menu 切換**：串接 Line richmenu_id 綁定 API，依角色、KYC 狀態或訂閱狀態動態切換選單。
* **KYC 處理**：上傳身分證/存摺照片至 S3，並同步更新至後台審核清單。

### 2.2 預約與日曆調度
* **日曆實作**：使用 `FullCalendar.js`，僅顯示業務開放且未被佔用之時段。
* **排班模式**：業務可單次設定個別時段，或設定每週重複規律排班。
* **時段鎖定**：業務點擊 Flex Message「接受」按鈕後，時段進入 Locked 狀態（等待民眾付款，上限 30 分鐘），藍新 Webhook 回調付款成功後轉為 Confirmed；逾時未付自動釋放並通知業務。
* **1 小時緩衝**：自動鎖定成交行程前後各 1 小時之時段。

## 3. 第二階段：線下核銷與分潤 (P1)
### 3.1 成交核銷邏輯
* **QR Code 產生**：業務 LIFF 生成內含 `booking_id` 與 `token` 的唯一碼。
* **診所掃碼**：喚起 `liff.scanCode()` 讀取後跳轉至成交金額輸入頁。
* **二次確認**：診所送出金額後，系統推播通知業務於 LIFF 確認；業務 30 分鐘內未確認則系統自動核銷，爭議由管理員事後處理。

### 3.2 佣金看板安全
* **動態浮水印**：利用 Canvas 實作 `user_id` + `current_timestamp` 以 45 度角密集分佈之浮水印。

## 4. 第三階段：帳務透明化 (P2)
### 4.1 自動結算引擎
* **比例鎖定**：依據「預約成交當下」記錄的比例計算分潤，避免事後變更糾紛。
* **錢包狀態**：Pending（待核銷）→ Available（可撥款）→ Paid（已撥款）。撥款由系統每月定期透過藍新 API 自動執行，無需業務手動申請。

## 5. 開發檢查清單 (DoD)
- [ ] 各角色能依身分看到正確的 Line Rich Menu。
- [ ] 預約衝突檢查（含 1 小時緩衝）運作正常。
- [ ] 業務錢包能即時顯示診所掃碼後的「待核銷」紀錄。
- [ ] 佣金看板正確顯示防截圖動態浮水印。
- [ ] 業務取消已接單時，民眾自動全額退款，且取消理由通知推送至後台管理員。
- [ ] 民眾逾時未付（30 分鐘），預約自動取消且時段正確釋放。
- [ ] 每月自動撥款透過藍新 API 正確觸發並更新錢包狀態為 Paid。
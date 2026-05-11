# 開發待辦清單

> 上次更新：2026-05-11

## 已完成

- [x] 專案規格書 (`docs/functional-spec.md`)
- [x] 技術規格書 (`docs/tech-spec.md`)
- [x] 後端專案架構（Node.js + TypeScript + Express + Prisma）
- [x] PostgreSQL Schema（13 個 model，含狀態機、佣金快照、錢包）
- [x] Prisma migration 初始化（`20260511152319_init`）
- [x] Docker PostgreSQL 容器（`carebridge-db`，port 5432）
- [x] 各角色 API 路由骨架（civilian / agent / clinic / admin / webhook）
- [x] Auth middleware（requireAuth / requireSubscription / requireAgent / requireClinic / requireAdmin）
- [x] Prisma seed：5 個測試帳號 + 預設 AdminSetting
- [x] 前端專案架構（Vite + React + TypeScript）
- [x] React Router 路由（民眾 × 6、業務 × 5、診所 × 4）
- [x] LIFF dev mode bypass（`VITE_LIFF_ID` 空白時跳過 LIFF，用 `VITE_DEV_LINE_USER_ID` 模擬登入）
- [x] 所有 page 存根建立完成

---

## Sprint 1 — 預約核心（P0）

**後端**
- [ ] `POST /civilian/bookings` 完整實作：衝突檢查（含 1 小時緩衝）、建立 `Booking`、設定 30 分鐘業務回應 deadline
- [ ] LINE Flex Message：發送給業務的接單通知（含「接受」/「拒絕」postback 按鈕）
- [ ] Webhook postback `booking:accept`：鎖定時段（`LOCKED`）、設定 30 分鐘付款 deadline、用藍新 API 產生付款連結、推播給民眾
- [ ] Webhook postback `booking:reject`：取消預約、通知民眾
- [ ] 排程任務：業務 30 分鐘未回應 → 自動取消（狀態 `EXPIRED_AGENT`）、通知民眾
- [ ] 藍新 Webhook `/webhook/newebpay`：AES-256 解密 + SHA256 驗簽、付款成功 → `CONFIRMED`、建立 `CommissionSnapshot`（鎖定當下費率）、封鎖前後 1 小時緩衝時段
- [ ] 排程任務：民眾 30 分鐘未付款 → 自動取消（狀態 `EXPIRED_PAYMENT`）、釋放時段、通知業務
- [ ] `DELETE /civilian/bookings/:id`：民眾取消，依「24 小時」政策決定退款、呼叫藍新退款 API
- [ ] `DELETE /agent/bookings/:id`：業務取消，全額退款 + 記錄取消理由 + 推播後台管理員

---

## Sprint 2 — 排班 & LINE 通知（P0）

**後端**
- [ ] `GET/POST/DELETE /agent/slots`：時段 CRUD，含衝突檢查（`LOCKED`/`BOOKED` 不可刪）
- [ ] `GET/POST/DELETE /agent/rules`：週期排班規則 CRUD
- [ ] 週期排班展開：依 `AvailabilityRule` 自動產生未來 N 週的 `AvailabilitySlot`
- [ ] LINE 通知矩陣：依 `tech-spec.md` 第 5 節實作所有推播（業務接單、預約成立、逾時取消、服務當天提醒…）
- [ ] LINE Rich Menu 切換：依角色（一般民眾 / 訂閱民眾 / KYC 待審 / KYC 通過業務）綁定不同 menu

**前端**
- [ ] `AgentDetail.tsx`：串接 API、整合 FullCalendar.js 顯示業務可預約時段
- [ ] `BookingConfirm.tsx`：確認頁面 → 送出預約申請
- [ ] `BookingResult.tsx`：顯示預約結果（等待業務 / 付款連結 / 成功 / 失敗）
- [ ] `MyBookings.tsx`：串接 API 顯示預約紀錄，含取消按鈕

---

## Sprint 3 — KYC & 業務端（P0）

**後端**
- [ ] S3 presigned URL 端點：前端直傳圖片至 S3，後端僅存 object key
- [ ] `POST /agent/kyc`：儲存 `KycSubmission`、通知後台待審
- [ ] `PATCH /admin/kyc/:id`：審核通過/拒絕 → 更新 `agentProfile.kycStatus`、切換 Rich Menu、LINE 通知業務

**前端**
- [ ] `AgentList.tsx`：串接 API 顯示業務列表、訂閱門檻提示
- [ ] `Subscribe.tsx`：產生藍新訂閱付款連結
- [ ] `agent/Kyc.tsx`：上傳身分證 + 存摺圖片（直傳 S3）
- [ ] `agent/Calendar.tsx`：FullCalendar.js 管理自己的排班（新增 / 刪除時段、週期規則）

---

## Sprint 4 — 線下核銷 & 分潤（P1）

**後端**
- [ ] `GET /agent/bookings/:id/qrcode-token`：產生含 HMAC 簽名的短效 token
- [ ] `GET /clinic/verify/:bookingId`：驗證 token 合法性、回傳預約資訊
- [ ] `POST /clinic/verify/:bookingId/amount`：建立 `TransactionVerification`、LINE 通知業務確認、設 30 分鐘 deadline
- [ ] Webhook postback `transaction:confirm`：業務確認金額、更新 `WalletTransaction` 為 `PENDING`
- [ ] 排程任務：30 分鐘未確認 → `AUTO_CONFIRMED`、建立 `WalletTransaction`

**前端**
- [ ] `agent/QrCode.tsx`：顯示 QR Code（含 booking token）
- [ ] `agent/Commission.tsx`：Canvas 動態浮水印（userId + timestamp，45 度密集分布）
- [ ] `agent/Wallet.tsx`：顯示 Pending / Available / Paid 明細
- [ ] `clinic/Scan.tsx`：呼叫 `liff.scanCode()` 掃描業務 QR Code
- [ ] `clinic/Verify.tsx`：輸入成交金額並送出
- [ ] `clinic/VerifyResult.tsx`：核銷結果頁

---

## Sprint 5 — 帳務 & 後台（P2）

**後端**
- [ ] 每月 5 號排程：計算 Available 錢包餘額、透過藍新 API 自動撥款、更新狀態為 `Paid`
- [ ] PDF 結算單產出（`市場推廣費結算單`）並透過 LINE 推播連結給業務 & 診所
- [ ] `GET /clinic/report`：對帳報表 API（成交紀錄 × 佣金 × 結算狀態）

**後台管理 Web（獨立非 LIFF）**
- [ ] 初始化獨立前端專案（`admin-web/`）
- [ ] KYC 審核列表頁面
- [ ] 業務管理頁（扣點 / 停權）
- [ ] 手動調帳頁面
- [ ] 推播訊息審核佇列
- [ ] 費率與規則設定頁（對應 `AdminSetting` KV table）

---

## 橫切關注點（隨時可做）

- [ ] Zod schema：為所有 API request body 加上輸入驗證
- [ ] 錯誤處理：統一 error response 格式
- [ ] GitHub Actions CI：`tsc --noEmit` + Prisma schema lint
- [ ] Docker Compose：把 `carebridge-db` 和後端放進 `docker-compose.yml`，一鍵啟動

---

## 開發環境啟動指令

```bash
# 啟動資料庫
docker start carebridge-db

# 後端
cd backend && npm run dev

# 前端（另一個 terminal）
cd frontend && npm run dev
```

## 測試帳號（Seed）

| 角色 | `x-line-user-id` header | `VITE_DEV_LINE_USER_ID` |
|---|---|---|
| 一般民眾 | `dev-civilian-001` | `dev-civilian-001` |
| 訂閱民眾 | `dev-civilian-sub-001` | `dev-civilian-sub-001` |
| 業務（KYC通過） | `dev-agent-001` | `dev-agent-001` |
| 診所 | `dev-clinic-001` | `dev-clinic-001` |
| 管理員 | `dev-admin-001` | `dev-admin-001` |

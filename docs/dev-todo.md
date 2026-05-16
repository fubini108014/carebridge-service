# 開發待辦清單

> 上次更新：2026-05-16（Sprint 5 完成）

## 已完成

**基礎建設**
- [x] 專案規格書 / 技術規格書
- [x] 後端：Node.js + TypeScript + Express + Prisma 架構
- [x] PostgreSQL Schema（13 model）+ migration + seed
- [x] Docker 容器 `carebridge-db`（port 5432）
- [x] 各角色路由骨架 + Auth middleware（5 種）
- [x] 前端：Vite + React + TypeScript + React Router
- [x] LIFF dev mode bypass

**Sprint 1 — 預約核心**
- [x] `POST /civilian/bookings`：衝突檢查（含 1h 緩衝）、建立 Booking、30 分鐘業務回應 deadline
- [x] LINE Flex Message 接單通知（含 postback 按鈕）
- [x] `booking:accept`：鎖定時段、產生藍新付款連結、推播民眾
- [x] `booking:reject`：取消預約、通知民眾
- [x] 排程：業務/民眾逾時自動取消（`EXPIRED_AGENT` / `EXPIRED_PAYMENT`）
- [x] 藍新 Webhook：AES解密 + SHA驗簽、`CONFIRMED`、`CommissionSnapshot`、1h 緩衝封鎖
- [x] `DELETE /civilian/bookings/:id`：24h 退款政策
- [x] `DELETE /agent/bookings/:id`：全額退款通知
- [x] `GET /api/payment/:bookingId`：藍新付款轉址頁

**Sprint 2 — 排班 & LINE 通知**
- [x] `GET/POST/DELETE /agent/slots`：時段 CRUD，含衝突檢查（LOCKED/BOOKED 保護）
- [x] `GET/POST/DELETE /agent/rules`：週期排班 CRUD；建立時立即展開未來 4 週
- [x] `lib/scheduling.ts`：`expandRule()` / `expandAllActiveRules()`；scheduler 每日補充展開
- [x] 排程：服務當天台灣時間 8 AM 推播民眾 & 業務提醒
- [x] LINE Rich Menu：follow 事件 upsert + 依角色/KYC/訂閱狀態綁定（4 種）
- [x] `AgentDetail.tsx`：FullCalendar.js 顯示可預約時段
- [x] `BookingConfirm.tsx` / `BookingResult.tsx`（5s 輪詢）/ `MyBookings.tsx`（含取消）

**Sprint 3 — KYC & 訂閱**
- [x] `lib/s3.ts`：`getPresignedPutUrl()`，AWS S3 v3 SDK
- [x] `GET /agent/me`：回傳業務 kycStatus
- [x] `GET /civilian/me`：回傳民眾訂閱狀態
- [x] `GET /agent/presigned-url`：前端直傳 S3（category: id_card | bank_book）
- [x] `POST /agent/kyc`：儲存 KycSubmission、kycStatus→PENDING、通知 ADMIN
- [x] `GET /admin/kyc`：列出 PENDING KYC 申請（含業務資訊）
- [x] `PATCH /admin/kyc/:id`：審核通過/拒絕 → kycStatus 更新、Rich Menu 切換、LINE 通知業務
- [x] `POST /civilian/subscribe`：藍新訂閱付款（merchantOrderNo 暫存 AdminSetting `sub_order_*`）
- [x] 藍新 Webhook：訂閱付款分支，確認後更新 isSubscribed / subscriptionExpiresAt / Rich Menu
- [x] `AgentList.tsx`：業務卡片列表、訂閱門檻提示
- [x] `Subscribe.tsx`：訂閱付款轉址頁
- [x] `agent/Kyc.tsx`：直傳 S3 + 提交 KYC 審核
- [x] `agent/Calendar.tsx`：FullCalendar.js 管理排班（時段 / 週期規則）

---

## Sprint 4 — 線下核銷 & 分潤（P1）

**後端**
- [x] `GET /agent/bookings/:id/qrcode-token`：產生含 HMAC 簽名的短效 token（5 分鐘有效期）
- [x] `GET /clinic/verify/:bookingId`：驗證 token 合法性、回傳預約資訊
- [x] `POST /clinic/verify/:bookingId/amount`：建立 `TransactionVerification`、LINE 通知業務確認、設 30 分鐘 deadline
- [x] Webhook postback `transaction:confirm` / `transaction:dispute`：業務確認或爭議、建立 `WalletTransaction`
- [x] 排程任務：30 分鐘未確認 → `AUTO_CONFIRMED`、建立 `WalletTransaction`

**前端**
- [x] `agent/QrCode.tsx`：顯示 QR Code（5 分鐘倒計時 + 自動刷新）
- [x] `agent/Commission.tsx`：Canvas 動態浮水印（userId + timestamp，45 度密集分布）
- [x] `agent/Wallet.tsx`：顯示 Pending / Available / Paid 明細（含加總卡片）
- [x] `clinic/Scan.tsx`：呼叫 `liff.scanCodeV2()` 掃描業務 QR Code（Dev 模式貼 token）
- [x] `clinic/Verify.tsx`：顯示預約資訊 + 輸入成交金額送出
- [x] `clinic/VerifyResult.tsx`：核銷結果頁（含核銷單號）

---

## Sprint 5 — 帳務 & 後台（P2）

**後端**
- [x] 每月 5 號排程：計算 Available 錢包餘額、透過藍新 API 自動撥款、更新狀態為 `Paid`
- [x] PDF 結算單產出（`市場推廣費結算單`）並透過 LINE 推播連結給業務（`lib/pdf.ts` + S3）
- [x] `GET /clinic/report`：對帳報表 API（成交紀錄 × 佣金 × 結算狀態）

**後台管理 Web（獨立非 LIFF）**
- [x] 初始化獨立前端專案（`admin-web/`）— Vite + React + TypeScript，port 4173
- [x] KYC 審核列表頁面（通過 / 拒絕 + 備註 Modal）
- [x] 業務管理頁（扣點 Modal + 停權 / 解除停權）
- [x] 手動調帳頁面（正負金額 + 備註）
- [x] 推播訊息審核佇列（批准 / 拒絕 + 備註）
- [x] 費率與規則設定頁（AdminSetting KV + 新增自訂 key）

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

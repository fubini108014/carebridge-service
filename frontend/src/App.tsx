import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Civilian
const AgentList      = lazy(() => import('./pages/civilian/AgentList'));
const AgentDetail    = lazy(() => import('./pages/civilian/AgentDetail'));
const BookingConfirm = lazy(() => import('./pages/civilian/BookingConfirm'));
const BookingResult  = lazy(() => import('./pages/civilian/BookingResult'));
const MyBookings     = lazy(() => import('./pages/civilian/MyBookings'));
const Subscribe      = lazy(() => import('./pages/civilian/Subscribe'));

// Agent
const AgentCalendar  = lazy(() => import('./pages/agent/Calendar'));
const AgentKyc       = lazy(() => import('./pages/agent/Kyc'));
const AgentQrCode    = lazy(() => import('./pages/agent/QrCode'));
const AgentCommission = lazy(() => import('./pages/agent/Commission'));
const AgentWallet    = lazy(() => import('./pages/agent/Wallet'));

// Clinic
const ClinicScan         = lazy(() => import('./pages/clinic/Scan'));
const ClinicVerify       = lazy(() => import('./pages/clinic/Verify'));
const ClinicVerifyResult = lazy(() => import('./pages/clinic/VerifyResult'));
const ClinicReport       = lazy(() => import('./pages/clinic/Report'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div>載入中…</div>}>
        <Routes>
          <Route path="/" element={<Navigate to="/civilian" replace />} />

          {/* 民眾端 */}
          <Route path="/civilian" element={<AgentList />} />
          <Route path="/civilian/agent/:id" element={<AgentDetail />} />
          <Route path="/civilian/booking/confirm" element={<BookingConfirm />} />
          <Route path="/civilian/booking/result" element={<BookingResult />} />
          <Route path="/civilian/my-bookings" element={<MyBookings />} />
          <Route path="/civilian/subscribe" element={<Subscribe />} />

          {/* 業務端 */}
          <Route path="/agent" element={<AgentCalendar />} />
          <Route path="/agent/kyc" element={<AgentKyc />} />
          <Route path="/agent/qrcode/:bookingId" element={<AgentQrCode />} />
          <Route path="/agent/commission" element={<AgentCommission />} />
          <Route path="/agent/wallet" element={<AgentWallet />} />

          {/* 診所端 */}
          <Route path="/clinic/scan" element={<ClinicScan />} />
          <Route path="/clinic/verify/:bookingId" element={<ClinicVerify />} />
          <Route path="/clinic/verify/result" element={<ClinicVerifyResult />} />
          <Route path="/clinic/report" element={<ClinicReport />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

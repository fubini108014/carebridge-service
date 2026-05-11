import { PrismaClient, UserRole, KycStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 一般民眾
  const civilian = await prisma.user.upsert({
    where: { lineUserId: 'dev-civilian-001' },
    update: {},
    create: {
      lineUserId: 'dev-civilian-001',
      displayName: '測試民眾',
      role: UserRole.CIVILIAN,
      isSubscribed: false,
    },
  });

  // 訂閱民眾
  const subscribedCivilian = await prisma.user.upsert({
    where: { lineUserId: 'dev-civilian-sub-001' },
    update: {},
    create: {
      lineUserId: 'dev-civilian-sub-001',
      displayName: '訂閱民眾',
      role: UserRole.CIVILIAN,
      isSubscribed: true,
      subscriptionExpiresAt: new Date('2027-12-31'),
    },
  });

  // 業務（KYC 已通過）
  const agentUser = await prisma.user.upsert({
    where: { lineUserId: 'dev-agent-001' },
    update: {},
    create: {
      lineUserId: 'dev-agent-001',
      displayName: '測試業務 王小明',
      role: UserRole.AGENT,
      isSubscribed: true,
      subscriptionExpiresAt: new Date('2027-12-31'),
    },
  });

  await prisma.agentProfile.upsert({
    where: { userId: agentUser.id },
    update: {},
    create: {
      userId: agentUser.id,
      kycStatus: KycStatus.APPROVED,
      demeritPoints: 0,
      isSuspended: false,
      bio: '資深陪診業務，服務台北市各大醫院',
      bankAccountName: '王小明',
      bankCode: '004',
      bankAccount: '123456789',
    },
  });

  // 診所
  const clinicUser = await prisma.user.upsert({
    where: { lineUserId: 'dev-clinic-001' },
    update: {},
    create: {
      lineUserId: 'dev-clinic-001',
      displayName: '台北仁愛診所',
      role: UserRole.CLINIC,
    },
  });

  await prisma.clinicProfile.upsert({
    where: { userId: clinicUser.id },
    update: {},
    create: {
      userId: clinicUser.id,
      name: '台北仁愛診所',
      address: '台北市大安區仁愛路四段',
      phone: '02-2700-0000',
      commissionRate: 0.1, // 10%
      contractSignedAt: new Date(),
    },
  });

  // 管理員
  await prisma.user.upsert({
    where: { lineUserId: 'dev-admin-001' },
    update: {},
    create: {
      lineUserId: 'dev-admin-001',
      displayName: '平台管理員',
      role: UserRole.ADMIN,
    },
  });

  // 預設平台設定
  const defaultSettings = [
    { key: 'cancel_window_hours', value: '24', description: '距服務幾小時內不可取消（民眾）' },
    { key: 'max_demerit_points', value: '5', description: '業務停權審核門檻' },
    { key: 'platform_fee_rate', value: '0.15', description: '平台從媒合費抽成比例' },
    { key: 'agent_commission_rate', value: '0.7', description: '業務從診所佣金分潤比例' },
    { key: 'payout_day_of_month', value: '5', description: '每月自動撥款日' },
    { key: 'agent_response_minutes', value: '30', description: '業務接單決策期（分鐘）' },
    { key: 'payment_window_minutes', value: '30', description: '民眾付款期限（分鐘）' },
    { key: 'transaction_confirm_minutes', value: '30', description: '業務確認成交期限（分鐘）' },
    { key: 'buffer_hours', value: '1', description: '成交行程前後緩衝時數' },
  ];

  for (const setting of defaultSettings) {
    await prisma.adminSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log('✅ Seed 完成');
  console.log('─────────────────────────────────────────');
  console.log('測試用 x-line-user-id header：');
  console.log(`  一般民眾：       dev-civilian-001`);
  console.log(`  訂閱民眾：       dev-civilian-sub-001`);
  console.log(`  業務（KYC通過）：dev-agent-001`);
  console.log(`  診所：           dev-clinic-001`);
  console.log(`  管理員：         dev-admin-001`);
  console.log('─────────────────────────────────────────');

  void [civilian, subscribedCivilian];
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

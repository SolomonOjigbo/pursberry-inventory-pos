/**
 * Development seed. Creates the three subscription tiers from plan §4.9 and one
 * demo tenant so the API has something to serve on a fresh checkout.
 *
 * Run: pnpm --filter @pursberry/db seed
 *
 * Uses DIRECT_DATABASE_URL (owner role) because provisioning a tenant happens
 * before any tenant context exists.
 */
import { PrismaClient } from '../generated/client/index.js';

const directUrl = process.env['DIRECT_DATABASE_URL'];
if (!directUrl) {
  throw new Error('DIRECT_DATABASE_URL is required to seed (the owner role, not the app role)');
}

const prisma = new PrismaClient({ datasources: { db: { url: directUrl } } });

const NGN = (major: number) => Math.round(major * 100);
// Placeholder FX for the plan's USD figures — replace with the real NGN price list.
const USD_TO_NGN = 1600;
const usd = (amount: number) => NGN(amount * USD_TO_NGN);

async function main() {
  const plans = [
    {
      tier: 'STARTER' as const,
      name: 'Starter',
      baseFeeMinor: usd(20),
      maxRegisters: 1,
      maxSkus: 2_500,
      maxTxnsPerCycle: 1_000,
      maxBranches: 1,
      addOnFeeMinor: null,
    },
    {
      tier: 'GROWTH' as const,
      name: 'Growth',
      baseFeeMinor: usd(50),
      maxRegisters: 3,
      maxSkus: 10_000,
      maxTxnsPerCycle: 5_000,
      maxBranches: 3,
      addOnFeeMinor: null,
    },
    {
      tier: 'ENTERPRISE' as const,
      name: 'Enterprise',
      baseFeeMinor: usd(150),
      // null === unlimited (soft caps do not apply)
      maxRegisters: null,
      maxSkus: null,
      maxTxnsPerCycle: null,
      maxBranches: null,
      addOnFeeMinor: usd(30),
    },
  ];

  for (const plan of plans) {
    const existing = await prisma.subscriptionPlan.findFirst({ where: { tier: plan.tier } });
    if (existing) {
      await prisma.subscriptionPlan.update({ where: { id: existing.id }, data: plan });
    } else {
      await prisma.subscriptionPlan.create({ data: plan });
    }
  }
  console.log(`seeded ${plans.length} subscription plans`);

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-supermarket' },
    update: {},
    create: {
      name: 'Demo Supermarket Ltd',
      slug: 'demo-supermarket',
      // firstUseDate deliberately left null — BILL-104 sets it on first REAL
      // usage, not at provisioning. Seeding it here would start the 30-day clock.
      branches: {
        create: [{ name: 'Ikeja Branch', code: 'IKJ' }],
      },
    },
    include: { branches: true },
  });
  console.log(`seeded tenant ${tenant.slug} (${tenant.id}) with ${tenant.branches.length} branch`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

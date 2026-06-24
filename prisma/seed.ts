import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { faker } from "@faker-js/faker";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const ACCOUNT_TYPES = ["checking", "savings", "credit", "business"];
const TX_TYPES = ["deposit", "withdrawal", "transfer", "card_payment"];

async function main() {
  faker.seed(42);
  console.log("Resetting data...");
  await prisma.auditLog.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  console.log("Seeding users...");
  const [viewerHash, adminHash] = await Promise.all([
    bcrypt.hash("viewer123", 10),
    bcrypt.hash("admin123", 10),
  ]);
  await prisma.user.createMany({
    data: [
      {
        email: "viewer@example.com",
        name: "Vera Viewer",
        passwordHash: viewerHash,
        role: "viewer",
      },
      {
        email: "admin@example.com",
        name: "Adam Admin",
        passwordHash: adminHash,
        role: "admin",
      },
    ],
  });

  console.log("Seeding customers, accounts, transactions...");
  const customerCount = 40;
  for (let i = 0; i < customerCount; i++) {
    const riskLevel = faker.helpers.weightedArrayElement([
      { value: "low" as const, weight: 5 },
      { value: "medium" as const, weight: 3 },
      { value: "high" as const, weight: 2 },
    ]);
    const customer = await prisma.customer.create({
      data: {
        name: faker.person.fullName(),
        email: faker.internet.email().toLowerCase(),
        riskLevel,
        status: "active",
        note: "",
      },
    });

    const numAccounts = faker.number.int({ min: 1, max: 3 });
    for (let a = 0; a < numAccounts; a++) {
      const account = await prisma.account.create({
        data: {
          customerId: customer.id,
          type: faker.helpers.arrayElement(ACCOUNT_TYPES),
          balance: faker.number.float({ min: 0, max: 50000, fractionDigits: 2 }),
          status: "active",
        },
      });

      const numTx = faker.number.int({ min: 2, max: 6 });
      for (let t = 0; t < numTx; t++) {
        const big = riskLevel === "high" && faker.datatype.boolean(0.4);
        await prisma.transaction.create({
          data: {
            accountId: account.id,
            amount: big
              ? faker.number.float({ min: 8000, max: 25000, fractionDigits: 2 })
              : faker.number.float({ min: 5, max: 4000, fractionDigits: 2 }),
            type: faker.helpers.arrayElement(TX_TYPES),
            description: faker.finance.transactionDescription().slice(0, 80),
            status: "normal",
          },
        });
      }
    }
  }

  const counts = {
    users: await prisma.user.count(),
    customers: await prisma.customer.count(),
    accounts: await prisma.account.count(),
    transactions: await prisma.transaction.count(),
  };
  console.log("Seed complete:", counts);
  console.log("Logins -> viewer@example.com / viewer123 , admin@example.com / admin123");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

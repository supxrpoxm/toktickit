import { getPrisma } from "../src/prisma.js";

async function main() {
  const prisma = getPrisma();

  const categoryNames = [
    "Account and Access",
    "Hardware",
    "Software",
    "Network",
  ];

  for (const name of categoryNames) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const relatedSystemNames = [
    "HR Portal",
    "Identity Provider",
    "VPN",
    "Finance System",
    "Asset Management",
    "Email Platform",
  ];

  for (const name of relatedSystemNames) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const requesterSeeds = [
    { name: "Alice Johnson", email: "alice@company.com", isActive: true },
    { name: "Brandon Lee", email: "brandon@company.com", isActive: true },
    { name: "Carmen Diaz", email: "carmen@company.com", isActive: true },
    { name: "Darius Patel", email: "darius@company.com", isActive: true },
    { name: "Evelyn Gray", email: "evelyn@company.com", isActive: false },
  ];

  for (const requester of requesterSeeds) {
    await prisma.requester.upsert({
      where: { email: requester.email },
      update: {
        name: requester.name,
        isActive: requester.isActive,
      },
      create: {
        name: requester.name,
        email: requester.email,
        isActive: requester.isActive,
      },
    });
  }

  console.log(
    `Seeded ${categoryNames.length} categories, ${relatedSystemNames.length} related systems, and ${requesterSeeds.length} requesters (upsert).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });

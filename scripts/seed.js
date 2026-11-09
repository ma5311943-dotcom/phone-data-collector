const prisma = require("../src/config/prisma");
const { ensureAdmin } = require("../src/utils/seed");

async function main() {
  const result = await ensureAdmin();
  console.log(
    result.created
      ? `Admin account ready: ${result.email}`
      : `Admin account already exists: ${result.email}`,
  );
}

main()
  .catch((error) => {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@gmail.com")
  .trim()
  .toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin";
const ADMIN_NAME = process.env.ADMIN_NAME || "System Administrator";

async function ensureAdmin() {
  const existing = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true, role: true },
  });

  if (existing) {
    if (existing.role !== "ADMIN") {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: "ADMIN", isActive: true },
      });
      console.log(`[seed] Upgraded ${ADMIN_EMAIL} to ADMIN.`);
    }

    return { created: false, email: ADMIN_EMAIL };
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      passwordHash,
      fullName: ADMIN_NAME,
      role: "ADMIN",
    },
  });

  console.log(`[seed] Created admin account ${ADMIN_EMAIL}.`);

  return { created: true, email: ADMIN_EMAIL };
}

module.exports = { ensureAdmin };

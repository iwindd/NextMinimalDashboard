import { type PrismaClient, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";
import admin from "../data/admin.json";

export type SeedUser = { id: string; email: string; role: UserRole };

const ADMIN_SEED_USER = {
  email: admin.email,
  name: admin.name,
  role: UserRole.ADMIN,
  password: admin.password,
} as const;

/**
 * Editor accounts exist only so the mockup content has an author that is not
 * the reviewer and the ownership rules can be exercised from the UI. The default
 * seed does not create them; they appear the first time the mockup seed runs.
 */
const EDITOR_SEED_USERS = [
  {
    email: "editor@example.com",
    name: "Editor Example",
    role: UserRole.EDITOR,
    password: "password",
  },
  {
    email: "editor2@example.com",
    name: "Editor Two Example",
    role: UserRole.EDITOR,
    password: "password",
  },
] as const;

async function upsertSeedUser(
  prisma: PrismaClient,
  user: { email: string; name: string; role: UserRole; password: string },
): Promise<SeedUser> {
  const passwordHash = await hash(user.password, 12);
  return prisma.user.upsert({
    where: { email: user.email },
    update: {
      name: user.name,
      role: user.role,
      isActive: true,
      passwordHash,
    },
    create: {
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: true,
      passwordHash,
    },
    select: { id: true, email: true, role: true },
  });
}

/**
 * Creates or updates the Admin account. The only account the default seed owns;
 * its password is reset to the development value on every run.
 */
export async function ensureSeedAdmin(prisma: PrismaClient): Promise<SeedUser> {
  return upsertSeedUser(prisma, ADMIN_SEED_USER);
}

/**
 * Reads the Admin account back without creating it. Used by anything that runs
 * after the default seed and must not create an account of its own — failing
 * here means the default seed has not run yet.
 */
export async function requireSeedAdmin(prisma: PrismaClient): Promise<SeedUser> {
  const user = await prisma.user.findUnique({
    where: { email: ADMIN_SEED_USER.email },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    throw new Error(
      `ไม่พบผู้ดูแลระบบ ${ADMIN_SEED_USER.email} กรุณารัน "npm run db:seed" ก่อน`,
    );
  }
  return user;
}

/**
 * Creates or updates the Editor accounts. The mockup seed owns them: they are
 * created the first time it runs and their passwords are reset on every run
 * after that, same as the Admin account in the default seed.
 */
async function ensureSeedEditors(prisma: PrismaClient): Promise<SeedUser[]> {
  const editors: SeedUser[] = [];
  for (const editor of EDITOR_SEED_USERS) {
    editors.push(await upsertSeedUser(prisma, editor));
  }
  return editors;
}

/**
 * The accounts the mockup seed writes as: the Admin from the default seed, plus
 * the Editor accounts the mockup seed creates itself. Throws with a clear message
 * if the default seed has not run.
 */
export async function ensureMockupUsers(prisma: PrismaClient) {
  const admin = await requireSeedAdmin(prisma);
  const editors = await ensureSeedEditors(prisma);
  return { admin, editors };
}

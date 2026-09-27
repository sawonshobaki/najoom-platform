import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import * as argon2 from "argon2";

import {
  PrismaClient,
  UserRole,
} from "../src/generated/prisma/client";

const MAX_USERNAME_LENGTH = 100;
const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 128;

const VERY_COMMON_PASSWORDS = new Set([
  "1234567890",
  "password",
  "password123",
  "qwerty123",
  "1111111111",
  "0000000000",
]);

function requireEnvironmentVariable(
  name: string,
): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

const databaseUrl =
  requireEnvironmentVariable("DATABASE_URL");

const username =
  requireEnvironmentVariable(
    "ADMIN_USERNAME",
  ).trim();

const password =
  requireEnvironmentVariable("ADMIN_PASSWORD");

if (!username) {
  throw new Error(
    "ADMIN_USERNAME is required.",
  );
}

if (username.length > MAX_USERNAME_LENGTH) {
  throw new Error(
    "Admin username is too long.",
  );
}

if (password.length < MIN_PASSWORD_LENGTH) {
  throw new Error(
    `Admin password must contain at least ${MIN_PASSWORD_LENGTH} characters.`,
  );
}

if (password.length > MAX_PASSWORD_LENGTH) {
  throw new Error(
    "Admin password is too long.",
  );
}

if (
  VERY_COMMON_PASSWORDS.has(
    password.toLowerCase(),
  )
) {
  throw new Error(
    "Admin password is too common.",
  );
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const existingUser =
    await prisma.user.findUnique({
      where: {
        username,
      },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
      },
    });

  if (existingUser) {
    console.log("");
    console.log(
      `User "${existingUser.username}" already exists.`,
    );

    console.log({
      id: existingUser.id,
      username: existingUser.username,
      role: existingUser.role,
      isActive: existingUser.isActive,
    });

    return;
  }

  const passwordHash = await argon2.hash(
    password,
    {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    },
  );

  const admin = await prisma.user.create({
    data: {
      username,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    },
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
    },
  });

  console.log("");
  console.log(
    "Admin account created successfully:",
  );

  console.log({
    id: admin.id,
    username: admin.username,
    role: admin.role,
    isActive: admin.isActive,
  });
}

main()
  .catch((error: unknown) => {
    console.error("");
    console.error(
      "Failed to create admin:",
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
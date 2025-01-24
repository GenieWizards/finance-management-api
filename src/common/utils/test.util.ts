import crypto from "node:crypto";

import { db } from "@/db/adapter";
import { accountModel, sessionModel, userModel } from "@/db/schemas";

import { type AuthRole, AuthRoles } from "../enums";
import { hashPassword } from "./crypto.lib";
import { generateSessionToken } from "./sessions.util";

export async function createTestUser({
  email,
  password,
  fullName,
  role = AuthRoles.USER,
}: {
  email: string;
  password: string;
  fullName: string;
  role?: AuthRole;
}) {
  // Create user transaction
  const result = await db.transaction(async (tx) => {
    // 1. Create user
    const [user] = await tx
      .insert(userModel)
      .values({
        email: email.toLowerCase(),
        fullName,
        role,
      })
      .returning();

    // 2. Create account with credentials
    const [_account] = await tx
      .insert(accountModel)
      .values({
        userId: user.id,
        providerId: "credentials",
        providerAccountId: user.id, // for credentials, use userId
        password: await hashPassword(password),
      })
      .returning();

    const sessionToken = generateSessionToken();

    // 3. Create session
    const [session] = await tx
      .insert(sessionModel)
      .values({
        id: sessionToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      })
      .returning();

    return { user, session };
  });

  return { ...result.user, session: result.session.id };
}

export function createRandomEmail() {
  const domain = "gmail.com";
  const randomBytes = crypto.randomBytes(4); // Generate 4 random bytes
  const randomNumber = Number.parseInt(randomBytes.toString("hex"), 16) % 10000;
  return `user${randomNumber}@${domain}`;
}

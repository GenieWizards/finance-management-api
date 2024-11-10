import { deleteCookie, setCookie } from "hono/cookie";

import type { AppRouteHandler } from "@/common/lib/types";

import { AuthRoles } from "@/common/enums";
import { hashPassword, verifyPasswordHash } from "@/common/utils/crypto.lib";
import * as HTTPStatusCodes from "@/common/utils/http-status-codes.util";
import { generateSessionToken } from "@/common/utils/sessions.util";
import { db } from "@/db/adapter";
import { accountModel, sessionModel, userModel } from "@/db/schemas";
import env from "@/env";

import type { TLoginRoute, TLogoutRoute, TRegisterRoute } from "./auth.routes";

import { getAccountRepository } from "../accounts/account.repository";
import {
  createSessionReposiroty,
  deleteSessionRepository,
} from "../sessions/session.repository";
import { getUserRepository } from "../users/user.repository";

export const register: AppRouteHandler<TRegisterRoute> = async (c) => {
  const payload = c.req.valid("json");

  // NOTE: Checks for password strength
  // const strongPassword = await verifyPasswordStrength(payload.password);
  // if (!strongPassword) {
  //   return c.json(
  //     {
  //       success: false,
  //       message: "Password is not strong enough",
  //     },
  //     HTTPStatusCodes.BAD_REQUEST,
  //   );
  // }

  // Check if user exists
  const existingUser = await getUserRepository(payload.email);
  if (existingUser) {
    return c.json(
      {
        success: false,
        message: "Email already registered",
      },
      HTTPStatusCodes.CONFLICT,
    );
  }

  // Create user transaction
  const result = await db.transaction(async (tx) => {
    // 1. Create user
    const [user] = await tx
      .insert(userModel)
      .values({
        email: payload.email.toLowerCase(),
        fullName: payload.fullName,
        role: AuthRoles.USER,
      })
      .returning();

    // 2. Create account with credentials
    const [_account] = await tx
      .insert(accountModel)
      .values({
        userId: user.id,
        providerId: "credentials",
        providerAccountId: user.id, // for credentials, use userId
        password: await hashPassword(payload.password),
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

  // Set session cookie
  setCookie(c, "session", result.session.id, {
    path: "/",
    secure: env.NODE_ENV === "production",
    httpOnly: true,
    expires: result.session.expiresAt,
    sameSite: "lax",
  });

  return c.json(
    {
      success: true,
      message: "Registration successful",
      data: { ...result.user, session: result.session.id },
    },
    HTTPStatusCodes.CREATED,
  );
};

export const login: AppRouteHandler<TLoginRoute> = async (c) => {
  const payload = c.req.valid("json");

  const user = await getUserRepository(payload.email);

  if (!user) {
    return c.json(
      {
        success: false,
        message: "Invalid email or password",
      },
      HTTPStatusCodes.BAD_REQUEST,
    );
  }

  const account = await getAccountRepository(user.id, "credentials");

  if (!account || !account.password) {
    return c.json(
      {
        success: false,
        message: "Invalid email or password",
      },
      HTTPStatusCodes.BAD_REQUEST,
    );
  }

  const isPasswordCorrect = await verifyPasswordHash(
    account.password,
    payload.password,
  );

  if (!isPasswordCorrect) {
    return c.json(
      {
        success: false,
        message: "Invalid email or password",
      },
      HTTPStatusCodes.BAD_REQUEST,
    );
  }

  const sessionToken = generateSessionToken();
  const sessionData = {
    id: sessionToken,
    userId: user.id,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  };
  const session = await createSessionReposiroty(sessionData);

  if (!session) {
    return c.json(
      {
        success: false,
        message: "Failed to create session",
      },
      HTTPStatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  // Set session cookie
  setCookie(c, "session", session.id, {
    path: "/",
    secure: env.NODE_ENV === "production",
    httpOnly: true,
    expires: session.expiresAt,
    sameSite: "lax",
  });

  return c.json(
    {
      success: true,
      message: "Login successful",
      data: { ...user, session: session.id },
    },
    HTTPStatusCodes.OK,
  );
};

export const logout: AppRouteHandler<TLogoutRoute> = async (c) => {
  const session = c.get("session");

  if (!session) {
    return c.json(
      {
        success: false,
        message: "You are not authorized, please login",
      },
      HTTPStatusCodes.UNAUTHORIZED,
    );
  }

  await deleteSessionRepository(session.id);

  deleteCookie(c, "session", {
    path: "/",
    secure: env.NODE_ENV === "production",
    httpOnly: true,
    expires: session.expiresAt,
    sameSite: "lax",
  });

  return c.json(
    {
      success: true,
      message: "Logout successful",
    },
    HTTPStatusCodes.NO_CONTENT,
  );
};

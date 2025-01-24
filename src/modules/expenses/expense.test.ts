import { beforeAll, describe, expect, it } from "bun:test";
import { testClient } from "hono/testing";

import { AuthRoles, SplitType } from "@/common/enums";
import { createApp } from "@/common/lib/create-app.lib";
import { AUTHORIZATION_ERROR_MESSAGE } from "@/common/utils/constants";
import * as HTTPStatusCodes from "@/common/utils/http-status-codes.util";
import { createRandomEmail, createTestUser } from "@/common/utils/test.util";
import type { TSelectCategorySchema } from "@/db/schemas/category.model";
import type { TSelectGroupSchema } from "@/db/schemas/group.model";
import env from "@/env";

import { createCategoryRepository } from "../categories/category.repository";
import { groupRouters } from "../group/group.index";
import { getUserSettlementsForGroupRepository } from "../settlements/settlement.repository";
import { getSplitsByExpenseIdRepository } from "../splits/split.repository";
import { expenseRouter } from "./expense.index";

if (env.NODE_ENV !== "test") {
  throw new Error("NODE_ENV must be 'test'");
}

const expenseClient = testClient(createApp().route("/", expenseRouter));
const groupClient = testClient(createApp().route("/", groupRouters));

interface TUserWithSession { session: string; id: string; fullName: string }
interface TSplit { userId: string; amount: number }

describe("expenses", () => {
  let primaryUser: TUserWithSession;
  let secondaryUser: TUserWithSession;
  let adminUser: TUserWithSession;
  let primaryCategory: TSelectCategorySchema;
  let secondaryCategory: TSelectCategorySchema;

  const expenseTestCommonFields = {
    amount: 90,
    currency: "USD",
    description: "expense description",
  };

  beforeAll(async () => {
    primaryUser = await createTestUser({
      email: "primaryUser@sample.com",
      password: "12345678",
      role: AuthRoles.USER,
      fullName: "Primary User",
    }) as TUserWithSession;

    secondaryUser = await createTestUser({
      email: "secondaryUser@sample.com",
      password: "12345678",
      role: AuthRoles.USER,
      fullName: "Payer User",
    }) as TUserWithSession;

    adminUser = await createTestUser({
      email: "adminUser@sample.com",
      password: "12345678",
      role: AuthRoles.ADMIN,
      fullName: "Admin User",
    }) as TUserWithSession;

    primaryCategory = await createCategoryRepository({ name: "Primary user category" });
    secondaryCategory = await createCategoryRepository({ name: "Secondary user category" }, secondaryUser.id);
  });

  describe("POST /expense", () => {
    it("POST /expense should return 401 when user is not logged in", async () => {
      const response = await expenseClient.expenses.$post({
        json: {
          ...expenseTestCommonFields,
        },
      });

      if (response.status === HTTPStatusCodes.UNAUTHORIZED) {
        const json = await response.json();

        expect(json.success).toBe(false);
        expect(json.message).toBe(AUTHORIZATION_ERROR_MESSAGE);
      }
    });
  });

  describe("POST /expenses via user", () => {
    let testGroup: Omit<TSelectGroupSchema, "createdAt" | "updatedAt">;
    let groupUsers: TUserWithSession[];

    beforeAll(async () => {
      const groupUser1 = await createTestUser({
        email: createRandomEmail(),
        password: "password123",
        fullName: "groupUser1",
      }) as TUserWithSession;

      const groupUser2 = await createTestUser({
        email: createRandomEmail(),
        password: "password123",
        fullName: "groupUser2",
      }) as TUserWithSession;

      groupUsers = [groupUser1, groupUser2];
      const response = await groupClient.groups.$post(
        {
          json: {
            name: "Test Group",
          },
        },
        {
          headers: {
            session: primaryUser.session,
          },
        },
      );

      if (response.ok) {
        const json = await response.json();
        testGroup = json.data;
      }

      await groupClient.groups[":groupId"].users.$post(
        {
          json: groupUsers.map(user => ({
            userId: user.id,
            username: user.fullName,
          })),
          param: { groupId: testGroup.id },
        },
        {
          headers: {
            session: primaryUser.session,
          },
        },
      );
    });

    it("should create a standalone expense (no group, no split)", async () => {
      const response = await expenseClient.expenses.$post(
        {
          json: {
            ...expenseTestCommonFields,
            categoryId: primaryCategory.id,
          },
        },
        {
          headers: {
            session: primaryUser.session,
          },
        },
      );

      expect(response.status).toBe(HTTPStatusCodes.CREATED);
      if (response.status === HTTPStatusCodes.CREATED) {
        const json = await response.json();

        expect(json.success).toBe(true);
        expect(json.message).toBe("Expense created successfully");
        expect(json.data).toHaveProperty("amount", expenseTestCommonFields.amount);
        expect(json.data).toHaveProperty("currency", expenseTestCommonFields.currency);
        expect(json.data).toHaveProperty("categoryId", primaryCategory.id);
        expect(json.data).toHaveProperty("payerId", primaryUser.id);
      }
    });

    it("should create a standalone expense provided payerId", async () => {
      const response = await expenseClient.expenses.$post(
        {
          json: {
            ...expenseTestCommonFields,
            payerId: secondaryUser.id,
          },
        },
        {
          headers: {
            session: primaryUser.session,
          },
        },
      );

      expect(response.status).toBe(HTTPStatusCodes.CREATED);
      if (response.status === HTTPStatusCodes.CREATED) {
        const json = await response.json();

        expect(json.success).toBe(true);
        expect(json.message).toBe("Expense created successfully");
        expect(json.data).toHaveProperty("amount", expenseTestCommonFields.amount);
        expect(json.data).toHaveProperty("currency", expenseTestCommonFields.currency);
        expect(json.data).toHaveProperty("payerId", secondaryUser.id);
      }
    });

    it("should create another expense provided groupId and equal splits", async () => {
      const splits: [TSplit, ...TSplit[]] = [
        { userId: groupUsers[0].id, amount: 30 },
        { userId: groupUsers[1].id, amount: 30 },
      ];

      const response = await expenseClient.expenses.$post(
        {
          json: {
            ...expenseTestCommonFields,
            splits,
            splitType: SplitType.EVEN,
            groupId: testGroup.id,
          },
        },
        {
          headers: {
            session: primaryUser.session,
          },
        },
      );

      expect(response.status).toBe(HTTPStatusCodes.CREATED);
      if (response.status === HTTPStatusCodes.CREATED) {
        const json = await response.json();

        // check basic details
        expect(json.success).toBe(true);
        expect(json.message).toBe("Expense created successfully");
        expect(json.data).toHaveProperty("amount", expenseTestCommonFields.amount);
        expect(json.data).toHaveProperty("currency", expenseTestCommonFields.currency);
        expect(json.data).toHaveProperty("groupId", testGroup.id);
        expect(json.data).toHaveProperty("splitType", SplitType.EVEN);

        // check splits
        const expenseSplits = await getSplitsByExpenseIdRepository(json.data.id);
        const expectedSplits = splits as TSplit[];
        const actualSplits = expenseSplits.map((u) => {
          return {
            userId: u.userId,
            amount: u.amount,
          };
        });
        expect(actualSplits).toEqual(expectedSplits);

        // check settlements
        const userSettlements = await getUserSettlementsForGroupRepository(primaryUser.id, testGroup.id);
        const expectedSettlements = splits.map((split) => {
          return {
            senderId: primaryUser.id,
            receiverId: split.userId,
            amount: split.amount,
            groupId: testGroup.id,
          };
        });

        const actualSettlements = userSettlements.map((settlement) => {
          return {
            senderId: settlement.senderId,
            receiverId: settlement.receiverId,
            amount: settlement.amount,
            groupId: settlement.groupId,
          };
        });

        expect(actualSettlements).toEqual(expectedSettlements);
      }
    });

    it("should create another expense provided groupId and unequal splits", async () => {
      const splits: [TSplit, ...TSplit[]] = [
        { userId: groupUsers[0].id, amount: 20 },
        { userId: groupUsers[1].id, amount: 50 },
      ];

      const response = await expenseClient.expenses.$post(
        {
          json: {
            ...expenseTestCommonFields,
            splits,
            splitType: SplitType.UNEVEN,
            groupId: testGroup.id,
          },
        },
        {
          headers: {
            session: primaryUser.session,
          },
        },
      );

      expect(response.status).toBe(HTTPStatusCodes.CREATED);
      if (response.status === HTTPStatusCodes.CREATED) {
        const json = await response.json();

        // check basic details
        expect(json.success).toBe(true);
        expect(json.message).toBe("Expense created successfully");
        expect(json.data).toHaveProperty("amount", expenseTestCommonFields.amount);
        expect(json.data).toHaveProperty("currency", expenseTestCommonFields.currency);
        expect(json.data).toHaveProperty("groupId", testGroup.id);
        expect(json.data).toHaveProperty("splitType", SplitType.UNEVEN);

        // check splits
        const expenseSplits = await getSplitsByExpenseIdRepository(json.data.id);
        const expectedSplits = splits as TSplit[];
        const actualSplits = expenseSplits.map((u) => {
          return {
            userId: u.userId,
            amount: u.amount,
          };
        });
        expect(actualSplits).toEqual(expectedSplits);

        // check settlements
        const userSettlements = await getUserSettlementsForGroupRepository(primaryUser.id, testGroup.id);
        const expectedSettlements = splits.map((split) => {
          return {
            senderId: primaryUser.id,
            receiverId: split.userId,
            amount: 30 + split.amount,
            groupId: testGroup.id,
          };
        });

        const actualSettlements = userSettlements.map((settlement) => {
          return {
            senderId: settlement.senderId,
            receiverId: settlement.receiverId,
            amount: settlement.amount,
            groupId: settlement.groupId,
          };
        });

        expect(actualSettlements).toEqual(expectedSettlements);
      }
    });

    it("should return 404 when payer not found", async () => {
      const response = await expenseClient.expenses.$post(
        {
          json: {
            ...expenseTestCommonFields,
            payerId: "invalid payer id",
          },
        },
        {
          headers: {
            session: primaryUser.session,
          },
        },
      );

      expect(response.status).toBe(HTTPStatusCodes.NOT_FOUND);
      if (response.status === HTTPStatusCodes.NOT_FOUND) {
        const json = await response.json();

        expect(json.success).toBe(false);
        expect(json.message).toBe("Payer not found");
      }
    });

    it("should return 404 when category not found", async () => {
      const response = await expenseClient.expenses.$post(
        {
          json: {
            ...expenseTestCommonFields,
            categoryId: "invalid category id",
          },
        },
        {
          headers: {
            session: primaryUser.session,
          },
        },
      );

      expect(response.status).toBe(HTTPStatusCodes.NOT_FOUND);
      if (response.status === HTTPStatusCodes.NOT_FOUND) {
        const json = await response.json();

        expect(json.success).toBe(false);
        expect(json.message).toBe("Category not found");
      }
    });

    it("should return 400 when category does not belongs to user", async () => {
      const response = await expenseClient.expenses.$post(
        {
          json: {
            ...expenseTestCommonFields,
            categoryId: secondaryCategory.id,
          },
        },
        {
          headers: {
            session: primaryUser.session,
          },
        },
      );

      expect(response.status).toBe(HTTPStatusCodes.BAD_REQUEST);
      if (response.status === HTTPStatusCodes.BAD_REQUEST) {
        const json = await response.json();

        expect(json.success).toBe(false);
        expect(json.message).toBe("Category does not belong to the user or the specified payer");
      }
    });

    it("should return 400 when category does not belongs to payer", async () => {
      const response = await expenseClient.expenses.$post(
        {
          json: {
            ...expenseTestCommonFields,
            payerId: primaryUser.id,
            categoryId: secondaryCategory.id,
          },
        },
        {
          headers: {
            session: adminUser.session,
          },
        },
      );

      expect(response.status).toBe(HTTPStatusCodes.BAD_REQUEST);
      if (response.status === HTTPStatusCodes.BAD_REQUEST) {
        const json = await response.json();

        expect(json.success).toBe(false);
        expect(json.message).toBe("Category does not belong to the user or the specified payer");
      }
    });

    it("should return 400 when group not found", async () => {
      const splits: [TSplit, ...TSplit[]] = [
        { userId: groupUsers[0].id, amount: 30 },
        { userId: groupUsers[1].id, amount: 30 },
      ];

      const response = await expenseClient.expenses.$post(
        {
          json: {
            ...expenseTestCommonFields,
            splits,
            splitType: SplitType.EVEN,
            groupId: "invalid group id",
          },
        },
        {
          headers: {
            session: primaryUser.session,
          },
        },
      );

      expect(response.status).toBe(HTTPStatusCodes.NOT_FOUND);
      if (response.status === HTTPStatusCodes.NOT_FOUND) {
        const json = await response.json();

        expect(json.success).toBe(false);
        expect(json.message).toBe("Group not found");
      }
    });

    it("should return 404 when split user is not part of group", async () => {
      const splits: [TSplit, ...TSplit[]] = [
        { userId: groupUsers[0].id, amount: 30 },
        { userId: "invalid user id", amount: 30 },
      ];

      const response = await expenseClient.expenses.$post(
        {
          json: {
            ...expenseTestCommonFields,
            splits,
            splitType: SplitType.EVEN,
            groupId: testGroup.id,
          },
        },
        {
          headers: {
            session: primaryUser.session,
          },
        },
      );

      expect(response.status).toBe(HTTPStatusCodes.BAD_REQUEST);
      if (response.status === HTTPStatusCodes.BAD_REQUEST) {
        const json = await response.json();

        expect(json.success).toBe(false);
        expect(json.message).toBe(`User ${splits[1].userId} does not belong to the specified group`);
      }
    });

    it("should return 400 when split amount is unequal provided split type as EVEN", async () => {
      const splits: [TSplit, ...TSplit[]] = [
        { userId: groupUsers[0].id, amount: 30 },
        { userId: groupUsers[1].id, amount: 10 },
      ];

      const response = await expenseClient.expenses.$post(
        {
          json: {
            ...expenseTestCommonFields,
            splits,
            splitType: SplitType.EVEN,
            groupId: testGroup.id,
          },
        },
        {
          headers: {
            session: primaryUser.session,
          },
        },
      );

      expect(response.status).toBe(HTTPStatusCodes.BAD_REQUEST);
      if (response.status === HTTPStatusCodes.BAD_REQUEST) {
        const json = await response.json();

        expect(json.success).toBe(false);
        expect(json.message).toBe(`Split amount is unequal provided split type is ${SplitType.EVEN}`);
      }
    });

    it("should return 400 when split total is greater than amount paid", async () => {
      const splits: [TSplit, ...TSplit[]] = [
        { userId: groupUsers[0].id, amount: 100 },
        { userId: groupUsers[1].id, amount: 100 },
      ];

      const response = await expenseClient.expenses.$post(
        {
          json: {
            ...expenseTestCommonFields,
            splits,
            splitType: SplitType.UNEVEN,
            groupId: testGroup.id,
          },
        },
        {
          headers: {
            session: primaryUser.session,
          },
        },
      );

      expect(response.status).toBe(HTTPStatusCodes.BAD_REQUEST);
      if (response.status === HTTPStatusCodes.BAD_REQUEST) {
        const json = await response.json();

        expect(json.success).toBe(false);
        expect(json.message).toBe(`Split total is greater then amount paid`);
      }
    });
  });

  describe("POST /expenses via admin", () => {
    let testGroup: Omit<TSelectGroupSchema, "createdAt" | "updatedAt">;
    let groupUsers: TUserWithSession[];

    beforeAll(async () => {
      const groupUser1 = await createTestUser({
        email: createRandomEmail(),
        password: "password123",
        fullName: "groupUser1",
      }) as TUserWithSession;

      const groupUser2 = await createTestUser({
        email: createRandomEmail(),
        password: "password123",
        fullName: "groupUser2",
      }) as TUserWithSession;

      groupUsers = [groupUser1, groupUser2];
      const response = await groupClient.groups.$post(
        {
          json: {
            name: "Test Group",
          },
        },
        {
          headers: {
            session: primaryUser.session,
          },
        },
      );

      if (response.ok) {
        const json = await response.json();
        testGroup = json.data;
      }

      await groupClient.groups[":groupId"].users.$post(
        {
          json: groupUsers.map(user => ({
            userId: user.id,
            username: user.fullName,
          })),
          param: { groupId: testGroup.id },
        },
        {
          headers: {
            session: primaryUser.session,
          },
        },
      );
    });

    it("should create a standalone expense (no group, no split)", async () => {
      const response = await expenseClient.expenses.$post(
        {
          json: {
            ...expenseTestCommonFields,
            payerId: primaryUser.id,
            categoryId: primaryCategory.id,
          },
        },
        {
          headers: {
            session: adminUser.session,
          },
        },
      );

      expect(response.status).toBe(HTTPStatusCodes.CREATED);
      if (response.status === HTTPStatusCodes.CREATED) {
        const json = await response.json();

        expect(json.success).toBe(true);
        expect(json.message).toBe("Expense created successfully");
        expect(json.data).toHaveProperty("amount", expenseTestCommonFields.amount);
        expect(json.data).toHaveProperty("currency", expenseTestCommonFields.currency);
        expect(json.data).toHaveProperty("creatorId", adminUser.id);
        expect(json.data).toHaveProperty("categoryId", primaryCategory.id);
        expect(json.data).toHaveProperty("payerId", primaryUser.id);
      }
    });

    it("should create a expense provided groupId and splits", async () => {
      const splits: [TSplit, ...TSplit[]] = [
        { userId: groupUsers[0].id, amount: 30 },
        { userId: groupUsers[1].id, amount: 30 },
      ];

      const response = await expenseClient.expenses.$post(
        {
          json: {
            ...expenseTestCommonFields,
            splits,
            splitType: SplitType.EVEN,
            groupId: testGroup.id,
          },
        },
        {
          headers: {
            session: primaryUser.session,
          },
        },
      );

      expect(response.status).toBe(HTTPStatusCodes.CREATED);
      if (response.status === HTTPStatusCodes.CREATED) {
        const json = await response.json();

        // check basic details
        expect(json.success).toBe(true);
        expect(json.message).toBe("Expense created successfully");
        expect(json.data).toHaveProperty("amount", expenseTestCommonFields.amount);
        expect(json.data).toHaveProperty("currency", expenseTestCommonFields.currency);
        expect(json.data).toHaveProperty("groupId", testGroup.id);
        expect(json.data).toHaveProperty("splitType", SplitType.EVEN);

        // check splits
        const expenseSplits = await getSplitsByExpenseIdRepository(json.data.id);
        const expectedSplits = splits as TSplit[];
        const actualSplits = expenseSplits.map((u) => {
          return {
            userId: u.userId,
            amount: u.amount,
          };
        });
        expect(actualSplits).toEqual(expectedSplits);

        // check settlements
        const userSettlements = await getUserSettlementsForGroupRepository(primaryUser.id, testGroup.id);
        const expectedSettlements = splits.map((split) => {
          return {
            senderId: primaryUser.id,
            receiverId: split.userId,
            amount: split.amount,
            groupId: testGroup.id,
          };
        });

        const actualSettlements = userSettlements.map((settlement) => {
          return {
            senderId: settlement.senderId,
            receiverId: settlement.receiverId,
            amount: settlement.amount,
            groupId: settlement.groupId,
          };
        });

        expect(actualSettlements).toEqual(expectedSettlements);
      }
    });

    it("should return 400 when admin creates expense without providing payer id", async () => {
      const response = await expenseClient.expenses.$post(
        {
          json: {
            ...expenseTestCommonFields,
          },
        },
        {
          headers: {
            session: adminUser.session,
          },
        },
      );

      expect(response.status).toBe(HTTPStatusCodes.BAD_REQUEST);
      if (response.status === HTTPStatusCodes.BAD_REQUEST) {
        const json = await response.json();

        expect(json.success).toBe(false);
        expect(json.message).toBe("Missing payerId");
      }
    });
  });
});

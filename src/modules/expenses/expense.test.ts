import { beforeAll, describe, expect, it } from "bun:test";
import { testClient } from "hono/testing";

import { AuthRoles, SplitType } from "@/common/enums";
import { createApp } from "@/common/lib/create-app.lib";
import { AUTHORIZATION_ERROR_MESSAGE } from "@/common/utils/constants";
import * as HTTPStatusCodes from "@/common/utils/http-status-codes.util";
import { createTestUser } from "@/common/utils/test.util";
import env from "@/env";

import { createCategoryRepository } from "../categories/category.repository";
// import { groupRouters } from "../group/group.index";
import { expenseRouter } from "./expense.index";

if (env.NODE_ENV !== "test") {
  throw new Error("NODE_ENV must be 'test'");
}

const expenseClient = testClient(createApp().route("/", expenseRouter));
// const groupClient = testClient(createApp().route("/", groupRouters));

describe("expenses", () => {
  let testUser = {
    id: "",
    session: "",
  };

  let testUser2 = {
    id: "",
    session: "",
  };

  let adminUser = {
    id: "",
    session: "",
  };

  let testCategory = {
    id: "",
  };

  let testCategory2 = {
    id: "",
  };

  const expenseTestCommonFields = {
    amount: 90,
    currency: "USD",
    splitType: SplitType.EVEN,
    description: "expense description",
  };

  beforeAll(async () => {
    testUser = await createTestUser({
      email: "testUser@sample.com",
      password: "12345678",
      role: AuthRoles.USER,
      fullName: "Test User",
    });

    testUser2 = await createTestUser({
      email: "testUser2@sample.com",
      password: "12345678",
      role: AuthRoles.USER,
      fullName: "Test User2",
    });

    adminUser = await createTestUser({
      email: "adminUser@sample.com",
      password: "12345678",
      role: AuthRoles.ADMIN,
      fullName: "Test Admin",
    });

    testCategory = await createCategoryRepository({ name: "Test category" });
    testCategory2 = await createCategoryRepository({ name: "Test category2" }, testUser2.id);
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

  describe("POST /expenses as user", () => {
    it("should create a standalone expense", async () => {
      const response = await expenseClient.expenses.$post(
        {
          json: {
            ...expenseTestCommonFields,
            categoryId: testCategory.id,
          },
        },
        {
          headers: {
            session: testUser.session,
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
        expect(json.data).toHaveProperty("splitType", expenseTestCommonFields.splitType);
        expect(json.data).toHaveProperty("categoryId", testCategory.id);
        expect(json.data).toHaveProperty("payerId", testUser.id);
      }
    });

    it("should create a standalone expense with payerId", async () => {
      const response = await expenseClient.expenses.$post(
        {
          json: {
            ...expenseTestCommonFields,
            categoryId: testCategory.id,
            payerId: testUser2.id,
          },
        },
        {
          headers: {
            session: testUser.session,
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
        expect(json.data).toHaveProperty("splitType", expenseTestCommonFields.splitType);
        expect(json.data).toHaveProperty("categoryId", testCategory.id);
        expect(json.data).toHaveProperty("payerId", testUser2.id);
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
            session: testUser.session,
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
            session: testUser.session,
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
            categoryId: testCategory2.id,
          },
        },
        {
          headers: {
            session: testUser.session,
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
            payerId: testUser.id,
            categoryId: testCategory2.id,
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
  });

  describe("POST /expenses as admin", () => {
    it("should create standalone expense", async () => {
      const response = await expenseClient.expenses.$post(
        {
          json: {
            ...expenseTestCommonFields,
            payerId: testUser.id,
            categoryId: testCategory.id,
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
        expect(json.data).toHaveProperty("splitType", expenseTestCommonFields.splitType);
        expect(json.data).toHaveProperty("creatorId", adminUser.id);
        expect(json.data).toHaveProperty("categoryId", testCategory.id);
        expect(json.data).toHaveProperty("payerId", testUser.id);
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
            session: adminUser.session,
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
            payerId: testUser.id,
            categoryId: "invalid category id",
          },
        },
        {
          headers: {
            session: adminUser.session,
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

    it("should return 400 when category does not belongs to payer", async () => {
      const response = await expenseClient.expenses.$post(
        {
          json: {
            ...expenseTestCommonFields,
            payerId: testUser.id,
            categoryId: testCategory2.id,
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
  });

  // describe("POST /expenses as user with splits", () => {
  //   let groupUsers: any[];
  //   let testGroup: any;

  //   beforeAll(async () => {
  //     const user1 = await createTestUser({
  //       email: "user5@example.com",
  //       password: "password123",
  //       fullName: "User One",
  //     });

  //     const user2 = await createTestUser({
  //       email: "user6@example.com",
  //       password: "password123",
  //       fullName: "User Two",
  //     });

  //     groupUsers = [
  //       { id: user1.id, username: user1.fullName || "" },
  //       { id: user2.id, username: user2.fullName || "" },
  //     ];

  //     const response = await groupClient.groups.$post(
  //       {
  //         json: {
  //           name: "Test Group",
  //         },
  //       },
  //       {
  //         headers: {
  //           session: testUser.session,
  //         },
  //       },
  //     );

  //     if (response.ok) {
  //       const json = await response.json();
  //       testGroup = json.data;
  //     }

  //     await groupClient.groups[":groupId"].users.$post(
  //       {
  //         json: groupUsers.map(user => ({
  //           userId: user.id,
  //           username: user.username,
  //         })),
  //         param: { groupId: testGroup.id },
  //       },
  //       {
  //         headers: {
  //           session: testUser.session,
  //         },
  //       },
  //     );
  //   });

  //   it("should create a expense with splits", async () => {
  //     const splitUsers = [
  //       { userId: groupUsers[0].id, amount: 30 },
  //       { userId: groupUsers[1].id, amount: 30 },
  //     ];
  //     const response = await expenseClient.expenses.$post(
  //       {
  //         json: {
  //           ...expenseTestCommonFields,
  //           categoryId: testCategory.id,
  //           splitUsers,
  //           groupId: testGroup.id,
  //         },
  //       },
  //       {
  //         headers: {
  //           session: testUser.session,
  //         },
  //       },
  //     );

  //     console.log("test", await response.json());

  //     expect(response.status).toBe(HTTPStatusCodes.CREATED);
  //     if (response.status === HTTPStatusCodes.CREATED) {
  //       const json = await response.json();

  //       // TOOD: Add tests for splits and settlements
  //       expect(json.success).toBe(true);
  //       expect(json.message).toBe("Expense created successfully");
  //       expect(json.data).toHaveProperty("amount", expenseTestCommonFields.amount);
  //       expect(json.data).toHaveProperty("currency", expenseTestCommonFields.currency);
  //       expect(json.data).toHaveProperty("splitType", expenseTestCommonFields.splitType);
  //       expect(json.data).toHaveProperty("categoryId", testCategory.id);
  //       expect(json.data).toHaveProperty("payerId", testUser.id);
  //     }
  //   });
  // });
});

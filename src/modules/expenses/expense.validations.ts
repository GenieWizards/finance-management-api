import { z } from "zod";

import { insertExpenseSchema } from "@/db/schemas/expense.model";

export const createExpenseBodySchema = insertExpenseSchema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    creatorId: true,
  })
  .partial({
    payerId: true,
  })
  .extend({
    splitUsers: z.object({
      userId: z.string(),
      amount: z.number(),
    })
      .array()
      .optional(),
    groupId: z.string().optional(),
  });

export type TCreateExpenseBody = z.infer<typeof createExpenseBodySchema>;

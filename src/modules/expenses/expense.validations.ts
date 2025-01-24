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
    groupId: true,
    splitType: true,
  })
  .extend({
    splits: z.object({
      userId: z.string(),
      amount: z.number(),
    })
      .array()
      .nonempty()
      .optional(),
  })
  .refine(
    data =>
      (data.splits && data.groupId && data.splitType)
      || (!data.splits && !data.groupId && !data.splitType),
    {
      message: "Missing either of fields 'splits', 'splitType', 'groupId'",
    },
  ); ;

export type TCreateExpenseBody = z.infer<typeof createExpenseBodySchema>;

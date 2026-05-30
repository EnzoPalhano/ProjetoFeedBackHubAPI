import { z } from 'zod';

export const voteSchema = z.object({
  value: z.boolean()
});

export type VoteSchemaInput = z.infer<typeof voteSchema>;

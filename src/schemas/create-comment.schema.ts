import { z } from 'zod';

export const createCommentSchema = z.object({
  content: z.string().trim().min(3, 'O comentário deve ter no mínimo 3 caracteres')
});

export type CreateCommentSchemaInput = z.infer<typeof createCommentSchema>;

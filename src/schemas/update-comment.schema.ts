import { z } from 'zod';

export const updateCommentSchema = z.object({
  content: z.string().trim().min(3, 'O comentário deve ter no mínimo 3 caracteres')
});

export type UpdateCommentSchemaInput = z.infer<typeof updateCommentSchema>;

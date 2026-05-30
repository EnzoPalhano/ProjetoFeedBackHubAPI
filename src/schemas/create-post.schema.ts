import { z } from 'zod';

export const createPostSchema = z.object({
  title: z.string().trim().min(3, 'O título deve ter no mínimo 3 caracteres'),
  content: z.string().trim().min(10, 'O conteúdo deve ter no mínimo 10 caracteres')
});

export type CreatePostSchemaInput = z.infer<typeof createPostSchema>;

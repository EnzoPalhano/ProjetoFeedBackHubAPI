import { z } from 'zod';

export const createFeedbackSchema = z.object({
  title: z.string().trim().min(5, 'O título deve ter no mínimo 5 caracteres'),
  description: z.string().trim().min(10, 'A descrição deve ter no mínimo 10 caracteres')
});

export type CreateFeedbackSchemaInput = z.infer<typeof createFeedbackSchema>;

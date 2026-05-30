import { z } from 'zod';

export const updateFeedbackSchema = z
  .object({
    title: z.string().trim().min(5, 'O título deve ter no mínimo 5 caracteres').optional(),
    description: z.string().trim().min(10, 'A descrição deve ter no mínimo 10 caracteres').optional(),
    status: z.enum(['OPEN', 'IN_PROGRESS', 'DONE']).optional()
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Informe ao menos um campo para atualizar'
  });

export type UpdateFeedbackSchemaInput = z.infer<typeof updateFeedbackSchema>;

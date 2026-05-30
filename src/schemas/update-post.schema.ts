import { z } from 'zod';

export const updatePostSchema = z
  .object({
    title: z.string().trim().min(3, 'O título deve ter no mínimo 3 caracteres').optional(),
    content: z.string().trim().min(10, 'O conteúdo deve ter no mínimo 10 caracteres').optional()
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Informe ao menos um campo para atualizar'
  });

export type UpdatePostSchemaInput = z.infer<typeof updatePostSchema>;

import { z } from 'zod';

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(3, 'O nome deve ter no mínimo 3 caracteres').optional(),
    email: z.string().trim().email('Informe um e-mail válido').toLowerCase().optional(),
    password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres').optional()
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'Informe ao menos um campo para atualizar'
  });

export type UpdateUserSchemaInput = z.infer<typeof updateUserSchema>;

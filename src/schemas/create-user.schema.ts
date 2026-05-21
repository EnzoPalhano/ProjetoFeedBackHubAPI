import { z } from 'zod';

export const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'O nome deve ter no mínimo 3 caracteres'),
  email: z
    .string()
    .trim()
    .email('Informe um e-mail válido')
    .toLowerCase(),
  password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres')
});

export type CreateUserSchemaInput = z.infer<typeof createUserSchema>;

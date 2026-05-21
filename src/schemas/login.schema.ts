import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Informe um e-mail valido')
    .toLowerCase(),
  password: z.string().min(6, 'A senha deve ter no minimo 6 caracteres')
});

export type LoginSchemaInput = z.infer<typeof loginSchema>;

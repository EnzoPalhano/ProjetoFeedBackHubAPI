import { z } from 'zod';

export const updateRoleSchema = z.object({
  role: z.enum(['USER', 'ADMIN'], { message: 'Role deve ser USER ou ADMIN' })
});

export type UpdateRoleSchemaInput = z.infer<typeof updateRoleSchema>;

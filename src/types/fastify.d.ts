import type { PrismaClient, UserRole } from '@prisma/client';
import '@fastify/jwt';
import 'fastify';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      sub: string;
      role: UserRole;
    };
    user: {
      sub: string;
      role: UserRole;
    };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

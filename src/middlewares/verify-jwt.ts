import type { FastifyRequest } from 'fastify';

export async function verifyJwt(request: FastifyRequest) {
  await request.jwtVerify();
}

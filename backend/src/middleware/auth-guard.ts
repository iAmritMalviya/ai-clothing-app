import type { FastifyRequest, FastifyReply } from 'fastify';

export async function authGuard(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    return reply.unauthorized('Invalid or missing authentication token');
  }
}

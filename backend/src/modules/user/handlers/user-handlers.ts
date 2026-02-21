import type { FastifyRequest, FastifyReply } from 'fastify';
import { getUserById, updateUser } from '../services/user-service.js';

export async function handleGetMe(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const user = await getUserById(request.server.knex, request.user.userId);
  if (!user) {
    return reply.notFound('User not found');
  }
  return reply.send(user);
}

export async function handleUpdateMe(
  request: FastifyRequest<{ Body: { name?: string; shop_name?: string } }>,
  reply: FastifyReply,
) {
  const updates = request.body;
  const user = await updateUser(request.server.knex, request.user.userId, updates);
  if (!user) {
    return reply.notFound('User not found');
  }
  return reply.send(user);
}

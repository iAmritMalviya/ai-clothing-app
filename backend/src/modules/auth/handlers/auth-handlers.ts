import type { FastifyRequest, FastifyReply } from 'fastify';
import { sendOtp, verifyOtpAndGetUser } from '../services/auth-service.js';

export async function handleSendOtp(
  request: FastifyRequest<{ Body: { phone: string } }>,
  reply: FastifyReply,
) {
  const { phone } = request.body;
  await sendOtp(phone);
  return reply.send({ success: true, message: 'OTP sent successfully' });
}

export async function handleVerifyOtp(
  request: FastifyRequest<{ Body: { phone: string; code: string } }>,
  reply: FastifyReply,
) {
  const { phone, code } = request.body;
  const result = await verifyOtpAndGetUser(request.server.knex, phone, code);

  if (!result.valid) {
    return reply.unauthorized('Invalid OTP');
  }

  const token = request.server.jwt.sign({ userId: result.user['id'] as string });

  return reply.send({
    token,
    user: {
      id: result.user['id'],
      phone: result.user['phone'],
      name: result.user['name'],
      shop_name: result.user['shop_name'],
      free_credits_remaining: result.user['free_credits_remaining'],
    },
  });
}

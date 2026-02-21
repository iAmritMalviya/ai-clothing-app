import type { FastifyInstance } from 'fastify';
import { handleSendOtp, handleVerifyOtp } from '../handlers/auth-handlers.js';
import { sendOtpSchema, verifyOtpSchema } from '../schemas/auth-schemas.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/send-otp', { schema: sendOtpSchema }, handleSendOtp);
  app.post('/verify-otp', { schema: verifyOtpSchema }, handleVerifyOtp);
}

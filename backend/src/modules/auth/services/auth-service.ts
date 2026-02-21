import type { Knex } from 'knex';
import { createOtpProvider } from './otp-service.js';

const otpProvider = createOtpProvider();

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (phone.startsWith('+') && digits.length > 10) {
    return `+${digits}`;
  }
  return `+91${digits}`;
}

export async function sendOtp(phone: string): Promise<void> {
  const normalized = normalizePhone(phone);
  await otpProvider.send(normalized);
}

export async function verifyOtpAndGetUser(
  db: Knex,
  phone: string,
  code: string,
): Promise<{ token: null; user: null; valid: false } | { valid: true; user: Record<string, unknown>; normalized: string }> {
  const normalized = normalizePhone(phone);

  if (!otpProvider.verify(normalized, code)) {
    return { token: null, user: null, valid: false };
  }

  let user = await db('users').where({ phone: normalized }).first();

  if (!user) {
    const [newUser] = await db('users')
      .insert({ phone: normalized, free_credits_remaining: 5 })
      .returning('*');
    user = newUser;
  }

  return { valid: true, user, normalized };
}

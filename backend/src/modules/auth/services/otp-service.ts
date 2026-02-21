import { randomInt } from 'node:crypto';

const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export interface OtpProvider {
  send(phone: string): Promise<void>;
  verify(phone: string, code: string): boolean;
}

interface StoredOtp {
  code: string;
  expiresAt: number;
}

function createDevOtpProvider(): OtpProvider {
  const store = new Map<string, StoredOtp>();

  return {
    async send(phone) {
      const code = String(randomInt(100000, 999999));
      store.set(phone, { code, expiresAt: Date.now() + OTP_EXPIRY_MS });
      console.log(`[DEV OTP] Code ${code} sent to ${phone} (expires in 5 min)`);
    },

    verify(phone, code) {
      const entry = store.get(phone);
      if (!entry) return false;

      // Always clean up after attempt
      store.delete(phone);

      if (Date.now() > entry.expiresAt) return false;
      return entry.code === code;
    },
  };
}

export function createOtpProvider(): OtpProvider {
  return createDevOtpProvider();
  // Future: return createMsg91Provider() or createTwilioProvider()
}

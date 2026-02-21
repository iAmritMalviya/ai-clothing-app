export const sendOtpSchema = {
  body: {
    type: 'object' as const,
    required: ['phone'],
    properties: {
      phone: { type: 'string' as const, minLength: 10, maxLength: 15 },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        success: { type: 'boolean' as const },
        message: { type: 'string' as const },
      },
    },
  },
};

export const verifyOtpSchema = {
  body: {
    type: 'object' as const,
    required: ['phone', 'code'],
    properties: {
      phone: { type: 'string' as const, minLength: 10, maxLength: 15 },
      code: { type: 'string' as const, minLength: 4, maxLength: 6 },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        token: { type: 'string' as const },
        user: {
          type: 'object' as const,
          properties: {
            id: { type: 'string' as const },
            phone: { type: 'string' as const },
            name: { type: 'string' as const, nullable: true },
            shop_name: { type: 'string' as const, nullable: true },
            free_credits_remaining: { type: 'number' as const },
          },
        },
      },
    },
  },
};

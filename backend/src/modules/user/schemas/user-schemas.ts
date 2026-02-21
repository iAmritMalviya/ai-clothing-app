const userProperties = {
  id: { type: 'string' as const },
  phone: { type: 'string' as const },
  name: { type: 'string' as const, nullable: true },
  shop_name: { type: 'string' as const, nullable: true },
  free_credits_remaining: { type: 'number' as const },
  created_at: { type: 'string' as const },
  updated_at: { type: 'string' as const },
};

export const getMeSchema = {
  response: {
    200: {
      type: 'object' as const,
      properties: userProperties,
    },
  },
};

export const updateMeSchema = {
  body: {
    type: 'object' as const,
    properties: {
      name: { type: 'string' as const, maxLength: 100 },
      shop_name: { type: 'string' as const, maxLength: 200 },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: userProperties,
    },
  },
};

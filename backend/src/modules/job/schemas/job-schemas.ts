const jobProperties = {
  id: { type: 'string' as const },
  user_id: { type: 'string' as const },
  type: { type: 'string' as const },
  status: { type: 'string' as const },
  input_image_url: { type: 'string' as const },
  transparent_image_url: { type: 'string' as const, nullable: true },
  output_image_url: { type: 'string' as const, nullable: true },
  source_job_id: { type: 'string' as const, nullable: true },
  background_type: { type: 'string' as const, nullable: true },
  background_value: { type: 'string' as const, nullable: true },
  processing_time_ms: { type: 'number' as const, nullable: true },
  created_at: { type: 'string' as const },
  completed_at: { type: 'string' as const, nullable: true },
};

export const removeBgSchema = {
  response: {
    200: {
      type: 'object' as const,
      properties: jobProperties,
    },
  },
};

export const getJobSchema = {
  params: {
    type: 'object' as const,
    required: ['id'],
    properties: {
      id: { type: 'string' as const },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: jobProperties,
    },
  },
};

export const listJobsSchema = {
  querystring: {
    type: 'object' as const,
    properties: {
      page: { type: 'number' as const, minimum: 1, default: 1 },
      limit: { type: 'number' as const, minimum: 1, maximum: 100, default: 20 },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        jobs: {
          type: 'array' as const,
          items: { type: 'object' as const, properties: jobProperties },
        },
        total: { type: 'number' as const },
      },
    },
  },
};

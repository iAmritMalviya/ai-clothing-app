const modelPresetProperties = {
  id: { type: 'string' as const },
  name: { type: 'string' as const },
  gender: { type: 'string' as const },
  image_url: { type: 'string' as const },
  sort_order: { type: 'number' as const },
};

const userModelProperties = {
  id: { type: 'string' as const },
  user_id: { type: 'string' as const },
  image_url: { type: 'string' as const },
  original_filename: { type: 'string' as const, nullable: true },
  created_at: { type: 'string' as const },
};

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
  model_image_url: { type: 'string' as const, nullable: true },
  processing_time_ms: { type: 'number' as const, nullable: true },
  created_at: { type: 'string' as const },
  completed_at: { type: 'string' as const, nullable: true },
};

export const generateCatalogSchema = {
  querystring: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string' as const,
        enum: ['tops', 'bottoms', 'one-pieces', 'auto'],
        default: 'auto',
      },
    },
  },
};

export const getBatchSchema = {
  params: {
    type: 'object' as const,
    required: ['batchId'],
    properties: {
      batchId: { type: 'string' as const, format: 'uuid' },
    },
  },
};

export const listModelPresetsSchema = {
  response: {
    200: {
      type: 'object' as const,
      properties: {
        models: {
          type: 'array' as const,
          items: { type: 'object' as const, properties: modelPresetProperties },
        },
      },
    },
  },
};

export const uploadUserModelSchema = {
  response: {
    200: {
      type: 'object' as const,
      properties: userModelProperties,
    },
  },
};

export const listUserModelsSchema = {
  response: {
    200: {
      type: 'object' as const,
      properties: {
        models: {
          type: 'array' as const,
          items: { type: 'object' as const, properties: userModelProperties },
        },
      },
    },
  },
};

export const deleteUserModelSchema = {
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
      properties: {
        success: { type: 'boolean' as const },
      },
    },
  },
};

export const generateTryOnSchema = {
  body: {
    type: 'object' as const,
    required: ['job_id', 'model_type', 'model_value'],
    properties: {
      job_id: { type: 'string' as const },
      model_type: {
        type: 'string' as const,
        enum: ['preset', 'custom'],
      },
      model_value: { type: 'string' as const, minLength: 1 },
      category: {
        type: 'string' as const,
        enum: ['tops', 'bottoms', 'one-pieces', 'auto'],
        default: 'auto',
      },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: jobProperties,
    },
  },
};

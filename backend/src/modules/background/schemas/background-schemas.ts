const presetProperties = {
  id: { type: 'string' as const },
  name: { type: 'string' as const },
  type: { type: 'string' as const },
  value: { type: 'string' as const },
  preview_image_url: { type: 'string' as const, nullable: true },
  category: { type: 'string' as const },
  sort_order: { type: 'number' as const },
};

const userBackgroundProperties = {
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
  source_job_id: { type: 'string' as const, nullable: true },
  background_type: { type: 'string' as const, nullable: true },
  background_value: { type: 'string' as const, nullable: true },
  input_image_url: { type: 'string' as const },
  transparent_image_url: { type: 'string' as const, nullable: true },
  output_image_url: { type: 'string' as const, nullable: true },
  processing_time_ms: { type: 'number' as const, nullable: true },
  created_at: { type: 'string' as const },
  completed_at: { type: 'string' as const, nullable: true },
};

export const listPresetsSchema = {
  querystring: {
    type: 'object' as const,
    properties: {
      category: { type: 'string' as const },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: {
        presets: {
          type: 'array' as const,
          items: { type: 'object' as const, properties: presetProperties },
        },
      },
    },
  },
};

export const uploadBackgroundSchema = {
  response: {
    200: {
      type: 'object' as const,
      properties: userBackgroundProperties,
    },
  },
};

export const listMyBackgroundsSchema = {
  response: {
    200: {
      type: 'object' as const,
      properties: {
        backgrounds: {
          type: 'array' as const,
          items: { type: 'object' as const, properties: userBackgroundProperties },
        },
      },
    },
  },
};

export const deleteMyBackgroundSchema = {
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

export const applyBackgroundSchema = {
  body: {
    type: 'object' as const,
    required: ['job_id', 'background_type', 'background_value'],
    properties: {
      job_id: { type: 'string' as const },
      background_type: {
        type: 'string' as const,
        enum: ['solid_color', 'preset_scene', 'custom_upload'],
      },
      background_value: { type: 'string' as const, minLength: 1 },
    },
  },
  response: {
    200: {
      type: 'object' as const,
      properties: jobProperties,
    },
  },
};

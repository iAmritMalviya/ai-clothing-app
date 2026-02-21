const ALLOWED_MIMETYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp',
]);

export function validateImageFile(
  mimetype: string,
  filename: string,
): { valid: boolean; error?: string } {
  if (!ALLOWED_MIMETYPES.has(mimetype)) {
    return { valid: false, error: `Unsupported file type: ${mimetype}. Allowed: JPG, PNG, WebP` };
  }

  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Unsupported file extension: ${ext}. Allowed: .jpg, .jpeg, .png, .webp` };
  }

  return { valid: true };
}

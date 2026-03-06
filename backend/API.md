# API Documentation

**Base URL:** `http://localhost:3001`
**Last updated:** 2026-02-20

---

## Authentication

All protected endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Tokens are obtained via the OTP verification flow. JWT payload contains `{ userId: string }`.

**Dev mode:** OTP code is hardcoded to `123456` (logged to console).

---

## Error Responses

All errors follow this shape:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Description of what went wrong"
}
```

| Status Code | Meaning |
|---|---|
| `400` | Validation error or bad input |
| `401` | Missing or invalid JWT token |
| `403` | Forbidden (e.g., no credits remaining) |
| `404` | Resource not found |
| `500` | Internal server error |

---

## Credits System

- Each user starts with **5 free credits**
- **Background removal** (`POST /api/jobs/remove-bg`): costs **1 credit**
- **Apply background** (`POST /api/backgrounds/apply`): costs **1 credit**
- **Upload custom background** (`POST /api/backgrounds/upload`): **free**
- **Virtual try-on** (`POST /api/tryon/generate`): **free**
- **Upload model photo** (`POST /api/tryon/models/upload`): **free**
- Credits are only deducted on successful completion

---

## Endpoints

### Health Check

#### `GET /health`

No auth required.

**Response `200`:**
```json
{
  "status": "ok"
}
```

---

### Auth Module (`/api/auth`)

No auth required for these endpoints.

---

#### `POST /api/auth/send-otp`

Send an OTP code to the given phone number.

**Request Body:**
```json
{
  "phone": "9876543210"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `phone` | `string` | Yes | 10-15 characters |

**Phone normalization:** The backend normalizes phone numbers automatically:
- `9876543210` → `+919876543210`
- `919876543210` → `+919876543210`
- `+919876543210` → `+919876543210`

**Response `200`:**
```json
{
  "success": true,
  "message": "OTP sent successfully"
}
```

---

#### `POST /api/auth/verify-otp`

Verify OTP and get a JWT token. If the phone number is new, a user account is auto-created with 5 free credits.

**Request Body:**
```json
{
  "phone": "9876543210",
  "code": "123456"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `phone` | `string` | Yes | 10-15 characters |
| `code` | `string` | Yes | 4-6 characters |

**Response `200`:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "f6ba546a-91f2-4b33-b413-3b7e45b18e67",
    "phone": "+919876543210",
    "name": null,
    "shop_name": null,
    "free_credits_remaining": 5
  }
}
```

**Error `401`:**
```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Invalid OTP"
}
```

**Frontend notes:**
- Store the `token` in localStorage or secure cookie
- Store the `user` object for immediate UI display
- The `token` expires in 7 days (configurable via `JWT_EXPIRES_IN`)

---

### User Module (`/api/user`)

All endpoints require authentication.

---

#### `GET /api/user/me`

Get the current user's profile.

**Headers:**
```
Authorization: Bearer <token>
```

**Response `200`:**
```json
{
  "id": "f6ba546a-91f2-4b33-b413-3b7e45b18e67",
  "phone": "+919876543210",
  "name": null,
  "shop_name": null,
  "free_credits_remaining": 5,
  "created_at": "2026-02-20T05:18:16.697Z",
  "updated_at": "2026-02-20T05:18:16.697Z"
}
```

| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | `string` (UUID) | No | User ID |
| `phone` | `string` | No | Normalized phone with country code |
| `name` | `string` | Yes | User's display name |
| `shop_name` | `string` | Yes | Shop/business name |
| `free_credits_remaining` | `number` | No | Credits left (starts at 5) |
| `created_at` | `string` (ISO 8601) | No | Account creation timestamp |
| `updated_at` | `string` (ISO 8601) | No | Last profile update timestamp |

---

#### `PATCH /api/user/me`

Update the current user's profile. Send only the fields you want to change.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Rahul",
  "shop_name": "Rahul Fashion Store"
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `name` | `string` | No | Max 100 characters |
| `shop_name` | `string` | No | Max 200 characters |

**Response `200`:** Same shape as `GET /api/user/me` with updated values.

---

### Jobs Module (`/api/jobs`)

All endpoints require authentication.

---

#### `POST /api/jobs/remove-bg`

Upload an image to remove its background. This is a **synchronous** request — the response returns only after processing is complete. **Costs 1 credit.**

The backend saves both a **transparent PNG** (for later background selection) and a **white-background composite** as the default output.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body:** `multipart/form-data` with a single file field.

| Field | Type | Required | Constraints |
|---|---|---|---|
| `file` | `File` | Yes | JPG, PNG, or WebP. Max 10MB. |

**Frontend example:**
```typescript
const formData = new FormData();
formData.append('file', selectedFile);

const response = await fetch('http://localhost:3001/api/jobs/remove-bg', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData,
});
// Do NOT set Content-Type header — the browser sets it with the boundary
```

**Response `200`:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "user_id": "f6ba546a-91f2-4b33-b413-3b7e45b18e67",
  "type": "bg_removal",
  "status": "completed",
  "input_image_url": "http://localhost:3001/uploads/inputs/uuid.jpg",
  "transparent_image_url": "http://localhost:3001/uploads/transparent/uuid.png",
  "output_image_url": "http://localhost:3001/uploads/outputs/uuid.png",
  "source_job_id": null,
  "background_type": null,
  "background_value": null,
  "processing_time_ms": 3200,
  "created_at": "2026-02-20T06:00:00.000Z",
  "completed_at": "2026-02-20T06:00:03.200Z"
}
```

**Error `400`:**
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Unsupported file type: application/pdf. Allowed: JPG, PNG, WebP"
}
```

**Error `403`:**
```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "No credits remaining"
}
```

**Frontend notes:**
- Show a loading spinner while this request is in flight (typically 3-8 seconds)
- `output_image_url` = white background composite (default preview)
- `transparent_image_url` = raw transparent PNG (used as input for background selection)
- Use the job `id` to apply different backgrounds via `POST /api/backgrounds/apply`
- Refresh the user profile (`GET /api/user/me`) to get updated credit count

---

#### `GET /api/jobs/:id`

Get a single job by ID. Only returns jobs belonging to the authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**URL Params:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` (UUID) | Job ID |

**Response `200`:**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "user_id": "f6ba546a-91f2-4b33-b413-3b7e45b18e67",
  "type": "bg_removal",
  "status": "completed",
  "input_image_url": "http://localhost:3001/uploads/inputs/uuid.jpg",
  "transparent_image_url": "http://localhost:3001/uploads/transparent/uuid.png",
  "output_image_url": "http://localhost:3001/uploads/outputs/uuid.png",
  "source_job_id": null,
  "background_type": null,
  "background_value": null,
  "processing_time_ms": 3200,
  "created_at": "2026-02-20T06:00:00.000Z",
  "completed_at": "2026-02-20T06:00:03.200Z"
}
```

**Error `404`:**
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Job not found"
}
```

---

#### `GET /api/jobs`

List all jobs for the authenticated user, paginated, newest first. Includes `bg_removal`, `apply_bg`, and `tryon` jobs.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Params:**

| Param | Type | Default | Constraints |
|---|---|---|---|
| `page` | `number` | `1` | Min 1 |
| `limit` | `number` | `20` | Min 1, Max 100 |

**Example:** `GET /api/jobs?page=1&limit=10`

**Response `200`:**
```json
{
  "jobs": [
    {
      "id": "...",
      "type": "apply_bg",
      "status": "completed",
      "source_job_id": "original-bg-removal-job-uuid",
      "background_type": "solid_color",
      "background_value": "#000000",
      "input_image_url": "http://localhost:3001/uploads/transparent/uuid.png",
      "transparent_image_url": null,
      "output_image_url": "http://localhost:3001/uploads/outputs/uuid.png",
      "processing_time_ms": 45,
      "created_at": "...",
      "completed_at": "..."
    },
    {
      "id": "...",
      "type": "bg_removal",
      "status": "completed",
      "source_job_id": null,
      "background_type": null,
      "background_value": null,
      "input_image_url": "http://localhost:3001/uploads/inputs/uuid.jpg",
      "transparent_image_url": "http://localhost:3001/uploads/transparent/uuid.png",
      "output_image_url": "http://localhost:3001/uploads/outputs/uuid.png",
      "processing_time_ms": 3200,
      "created_at": "...",
      "completed_at": "..."
    }
  ],
  "total": 2
}
```

**Frontend notes:**
- Use `total` for pagination UI (total pages = `Math.ceil(total / limit)`)
- Jobs are sorted by `created_at` descending (newest first)
- Possible `type` values: `"bg_removal"`, `"apply_bg"`, `"tryon"`
- Possible `status` values: `"pending"`, `"processing"`, `"completed"`, `"failed"`

---

### Backgrounds Module (`/api/backgrounds`)

All endpoints require authentication.

---

#### `GET /api/backgrounds/presets`

List all available background presets (solid colors + AI scenes).

**Headers:**
```
Authorization: Bearer <token>
```

**Query Params:**

| Param | Type | Required | Description |
|---|---|---|---|
| `category` | `string` | No | Filter by: `color`, `studio`, `lifestyle`, `outdoor` |

**Response `200`:**
```json
{
  "presets": [
    {
      "id": "uuid",
      "name": "White",
      "type": "solid_color",
      "value": "#FFFFFF",
      "preview_image_url": null,
      "category": "color",
      "sort_order": 1
    },
    {
      "id": "uuid",
      "name": "Photo Studio",
      "type": "ai_scene",
      "value": "professional photography studio background...",
      "preview_image_url": null,
      "category": "studio",
      "sort_order": 11
    }
  ]
}
```

**Preset types:**
- `solid_color`: `value` is a hex color (e.g., `#FFFFFF`). No preview image needed — render a color swatch in the frontend.
- `ai_scene`: `value` is the AI prompt. `preview_image_url` is `null` until the scene is first generated (gets cached after first use).

**Available presets (18 total):**

| # | Name | Type | Category | Value |
|---|---|---|---|---|
| 1 | White | solid_color | color | `#FFFFFF` |
| 2 | Black | solid_color | color | `#000000` |
| 3 | Light Grey | solid_color | color | `#E5E5E5` |
| 4 | Dark Grey | solid_color | color | `#4A4A4A` |
| 5 | Beige | solid_color | color | `#F5F0E8` |
| 6 | Cream | solid_color | color | `#FFFDD0` |
| 7 | Soft Pink | solid_color | color | `#F8E8E8` |
| 8 | Light Blue | solid_color | color | `#E8F0F8` |
| 9 | Sage Green | solid_color | color | `#E8F0E8` |
| 10 | Lavender | solid_color | color | `#E8E0F0` |
| 11 | Photo Studio | ai_scene | studio | _(prompt)_ |
| 12 | White Marble | ai_scene | studio | _(prompt)_ |
| 13 | Wooden Table | ai_scene | lifestyle | _(prompt)_ |
| 14 | Concrete Wall | ai_scene | studio | _(prompt)_ |
| 15 | Garden Outdoor | ai_scene | outdoor | _(prompt)_ |
| 16 | Beach Sunset | ai_scene | outdoor | _(prompt)_ |
| 17 | City Street | ai_scene | outdoor | _(prompt)_ |
| 18 | Fabric Drape | ai_scene | lifestyle | _(prompt)_ |

---

#### `POST /api/backgrounds/upload`

Upload a custom background image. **Free — no credit cost.**

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body:** `multipart/form-data` with a single file field.

| Field | Type | Required | Constraints |
|---|---|---|---|
| `file` | `File` | Yes | JPG, PNG, or WebP. Max 10MB. |

**Response `200`:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "image_url": "http://localhost:3001/uploads/user-backgrounds/uuid.jpg",
  "original_filename": "my-shop-background.jpg",
  "created_at": "2026-02-20T07:00:00.000Z"
}
```

---

#### `GET /api/backgrounds/mine`

List the current user's uploaded custom backgrounds.

**Headers:**
```
Authorization: Bearer <token>
```

**Response `200`:**
```json
{
  "backgrounds": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "image_url": "http://localhost:3001/uploads/user-backgrounds/uuid.jpg",
      "original_filename": "my-shop-background.jpg",
      "created_at": "2026-02-20T07:00:00.000Z"
    }
  ]
}
```

---

#### `DELETE /api/backgrounds/mine/:id`

Delete one of the user's custom backgrounds.

**Headers:**
```
Authorization: Bearer <token>
```

**URL Params:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` (UUID) | User background ID |

**Response `200`:**
```json
{
  "success": true
}
```

**Error `404`:**
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Background not found"
}
```

---

#### `POST /api/backgrounds/apply`

Apply a background to a completed background-removal job. Creates a new `apply_bg` job. **Costs 1 credit.**

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "job_id": "uuid-of-bg-removal-job",
  "background_type": "solid_color",
  "background_value": "#000000"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `job_id` | `string` (UUID) | Yes | The `bg_removal` job whose transparent image to use |
| `background_type` | `string` | Yes | `"solid_color"`, `"preset_scene"`, or `"custom_upload"` |
| `background_value` | `string` | Yes | See below |

**`background_value` by type:**

| `background_type` | `background_value` | Example |
|---|---|---|
| `solid_color` | Hex color code | `"#FF0000"` |
| `preset_scene` | Preset UUID from `/api/backgrounds/presets` | `"uuid-of-photo-studio-preset"` |
| `custom_upload` | User background UUID from `/api/backgrounds/mine` | `"uuid-of-uploaded-bg"` |

**Response `200`:**
```json
{
  "id": "new-apply-bg-job-uuid",
  "user_id": "uuid",
  "type": "apply_bg",
  "status": "completed",
  "source_job_id": "original-bg-removal-job-uuid",
  "background_type": "solid_color",
  "background_value": "#000000",
  "input_image_url": "http://localhost:3001/uploads/transparent/uuid.png",
  "transparent_image_url": null,
  "output_image_url": "http://localhost:3001/uploads/outputs/uuid.png",
  "processing_time_ms": 45,
  "created_at": "2026-02-20T07:00:00.000Z",
  "completed_at": "2026-02-20T07:00:00.045Z"
}
```

**Error `403`:** No credits remaining.
**Error `404`:** Source job not found, not completed, or doesn't belong to user.

**Processing times:**
- Solid color: ~50ms (server-side compositing only)
- AI scene (first use): ~3-8 seconds (generates scene via fal.ai, then caches)
- AI scene (cached): ~100ms
- Custom upload: ~100ms

**Frontend notes:**
- For solid colors, the response is nearly instant — no spinner needed
- For AI scenes on first use, show a spinner (scene generation takes a few seconds)
- The `output_image_url` on the response is the final composited image — display it directly
- Users can apply multiple backgrounds to the same `bg_removal` job (each costs 1 credit)

---

### Try-On Module (`/api/tryon`)

All endpoints require authentication. Virtual try-on places the user's clothing onto a model body photo using FASHN AI.

---

#### `GET /api/tryon/models`

List available pre-built model presets (diverse male/female models).

**Headers:**
```
Authorization: Bearer <token>
```

**Response `200`:**
```json
{
  "models": [
    {
      "id": "uuid",
      "name": "Female Model 1",
      "gender": "female",
      "image_url": "/uploads/model-presets/female-1.jpg",
      "sort_order": 1
    },
    {
      "id": "uuid",
      "name": "Male Model 1",
      "gender": "male",
      "image_url": "/uploads/model-presets/male-1.jpg",
      "sort_order": 3
    }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `id` | `string` (UUID) | Model preset ID |
| `name` | `string` | Display name |
| `gender` | `string` | `"female"` or `"male"` |
| `image_url` | `string` | Model photo URL |
| `sort_order` | `number` | Display order |

---

#### `POST /api/tryon/models/upload`

Upload a custom model photo. **Free — no credit cost.**

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Request Body:** `multipart/form-data` with a single file field.

| Field | Type | Required | Constraints |
|---|---|---|---|
| `file` | `File` | Yes | JPG, PNG, or WebP. Max 10MB. |

**Response `200`:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "image_url": "http://localhost:3001/uploads/user-models/uuid.jpg",
  "original_filename": "my-model.jpg",
  "created_at": "2026-02-22T07:00:00.000Z"
}
```

---

#### `GET /api/tryon/models/mine`

List the current user's uploaded custom model photos.

**Headers:**
```
Authorization: Bearer <token>
```

**Response `200`:**
```json
{
  "models": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "image_url": "http://localhost:3001/uploads/user-models/uuid.jpg",
      "original_filename": "my-model.jpg",
      "created_at": "2026-02-22T07:00:00.000Z"
    }
  ]
}
```

---

#### `DELETE /api/tryon/models/mine/:id`

Delete one of the user's uploaded model photos.

**Headers:**
```
Authorization: Bearer <token>
```

**URL Params:**

| Param | Type | Description |
|---|---|---|
| `id` | `string` (UUID) | User model ID |

**Response `200`:**
```json
{
  "success": true
}
```

**Error `404`:**
```json
{
  "statusCode": 404,
  "error": "Not Found",
  "message": "Model not found"
}
```

---

#### `POST /api/tryon/generate`

Generate a virtual try-on image — places the clothing from a bg_removal job onto a model. **Free — no credit cost.** This is a synchronous request.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "job_id": "uuid-of-bg-removal-job",
  "model_type": "preset",
  "model_value": "uuid-of-model-preset",
  "category": "tops"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `job_id` | `string` (UUID) | Yes | The `bg_removal` job whose clothing image to use |
| `model_type` | `string` | Yes | `"preset"` or `"custom"` |
| `model_value` | `string` | Yes | Model preset UUID or user model UUID |
| `category` | `string` | No | `"tops"`, `"bottoms"`, `"one-pieces"`, or `"auto"` (default: `"auto"`) |

**`model_value` by type:**

| `model_type` | `model_value` | Example |
|---|---|---|
| `preset` | Preset UUID from `GET /api/tryon/models` | `"uuid-of-female-model-1"` |
| `custom` | User model UUID from `GET /api/tryon/models/mine` | `"uuid-of-uploaded-model"` |

**Response `200`:**
```json
{
  "id": "new-tryon-job-uuid",
  "user_id": "uuid",
  "type": "tryon",
  "status": "completed",
  "source_job_id": "original-bg-removal-job-uuid",
  "input_image_url": "http://localhost:3001/uploads/inputs/uuid.jpg",
  "transparent_image_url": null,
  "output_image_url": "http://localhost:3001/uploads/outputs/uuid.png",
  "background_type": null,
  "background_value": null,
  "model_image_url": "/uploads/model-presets/female-1.jpg",
  "processing_time_ms": 5200,
  "created_at": "2026-02-22T07:00:00.000Z",
  "completed_at": "2026-02-22T07:00:05.200Z"
}
```

**Error `404`:** Source job not found, not completed, model preset not found, or user model not found.

**Processing time:** Typically 5-15 seconds (FASHN AI via fal.ai).

**Frontend notes:**
- Show a loading spinner while this request is in flight
- `output_image_url` is the final try-on result — display it directly
- Users can try multiple models on the same clothing (each is free)
- The `category` field helps the AI understand what type of clothing is being tried on

---

## Static Files

Uploaded and processed images are served from:

```
GET /uploads/inputs/<filename>          — original uploaded images
GET /uploads/transparent/<filename>     — transparent PNGs (background removed, alpha channel)
GET /uploads/outputs/<filename>         — final composited images
GET /uploads/user-backgrounds/<filename> — user-uploaded custom backgrounds
GET /uploads/bg-previews/<filename>     — cached AI-generated scene backgrounds
GET /uploads/user-models/<filename>     — user-uploaded model photos
GET /uploads/model-presets/<filename>   — pre-built model preset photos
```

No authentication required. Image URLs are returned in API responses.

---

## Data Types Reference

### User

```typescript
interface User {
  id: string;            // UUID
  phone: string;         // "+919876543210"
  name: string | null;
  shop_name: string | null;
  free_credits_remaining: number;
  created_at: string;    // ISO 8601
  updated_at: string;    // ISO 8601
}
```

### Job

```typescript
type JobType = "bg_removal" | "apply_bg" | "tryon";
type JobStatus = "pending" | "processing" | "completed" | "failed";
type BackgroundType = "solid_color" | "preset_scene" | "custom_upload";

interface Job {
  id: string;                              // UUID
  user_id: string;                         // UUID
  type: JobType;
  status: JobStatus;
  input_image_url: string;
  transparent_image_url: string | null;    // set on bg_removal jobs
  output_image_url: string | null;         // null until completed
  source_job_id: string | null;            // set on apply_bg/tryon jobs (points to bg_removal job)
  background_type: BackgroundType | null;  // set on apply_bg jobs
  background_value: string | null;         // set on apply_bg jobs
  model_image_url: string | null;          // set on tryon jobs
  processing_time_ms: number | null;       // null until completed
  created_at: string;                      // ISO 8601
  completed_at: string | null;             // null until completed
}
```

### Background Preset

```typescript
interface BackgroundPreset {
  id: string;                        // UUID
  name: string;
  type: "solid_color" | "ai_scene";
  value: string;                     // hex color or AI prompt
  preview_image_url: string | null;  // cached generated image (ai_scene only)
  category: string;                  // "color" | "studio" | "lifestyle" | "outdoor"
  sort_order: number;
}
```

### User Background

```typescript
interface UserBackground {
  id: string;                        // UUID
  user_id: string;                   // UUID
  image_url: string;
  original_filename: string | null;
  created_at: string;                // ISO 8601
}
```

### Model Preset

```typescript
interface ModelPreset {
  id: string;           // UUID
  name: string;
  gender: "female" | "male";
  image_url: string;
  sort_order: number;
}
```

### User Model

```typescript
interface UserModel {
  id: string;                        // UUID
  user_id: string;                   // UUID
  image_url: string;
  original_filename: string | null;
  created_at: string;                // ISO 8601
}
```

### Auth Response

```typescript
interface AuthResponse {
  token: string;   // JWT (expires in 7 days)
  user: {
    id: string;
    phone: string;
    name: string | null;
    shop_name: string | null;
    free_credits_remaining: number;
  };
}
```

---

## Route Summary

| Method | Path | Auth | Credits | Description |
|---|---|---|---|---|
| `GET` | `/health` | No | — | Health check |
| `POST` | `/api/auth/send-otp` | No | — | Send OTP to phone |
| `POST` | `/api/auth/verify-otp` | No | — | Verify OTP, get JWT |
| `GET` | `/api/user/me` | Yes | — | Get current user profile |
| `PATCH` | `/api/user/me` | Yes | — | Update current user profile |
| `POST` | `/api/jobs/remove-bg` | Yes | 1 | Upload image, remove background |
| `GET` | `/api/jobs/:id` | Yes | — | Get job by ID |
| `GET` | `/api/jobs` | Yes | — | List jobs (paginated) |
| `GET` | `/api/backgrounds/presets` | Yes | — | List background presets |
| `POST` | `/api/backgrounds/upload` | Yes | Free | Upload custom background |
| `GET` | `/api/backgrounds/mine` | Yes | — | List user's custom backgrounds |
| `DELETE` | `/api/backgrounds/mine/:id` | Yes | — | Delete custom background |
| `POST` | `/api/backgrounds/apply` | Yes | 1 | Apply background to image |
| `GET` | `/api/tryon/models` | Yes | — | List model presets |
| `POST` | `/api/tryon/models/upload` | Yes | Free | Upload custom model photo |
| `GET` | `/api/tryon/models/mine` | Yes | — | List user's model photos |
| `DELETE` | `/api/tryon/models/mine/:id` | Yes | — | Delete model photo |
| `POST` | `/api/tryon/generate` | Yes | Free | Generate virtual try-on |

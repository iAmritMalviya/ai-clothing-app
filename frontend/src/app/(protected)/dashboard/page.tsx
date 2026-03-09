"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Shirt } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { generateCatalog } from "@/lib/tryon-api";
import { UploadZone } from "@/components/upload/upload-zone";
import { Skeleton } from "@/components/ui/skeleton";
import { config } from "@/config/env";
import type { Job, JobsListResponse, GarmentCategory } from "@/types";

const CATEGORIES: { value: GarmentCategory; label: string }[] = [
  { value: "auto", label: "Auto Detect" },
  { value: "tops", label: "Tops" },
  { value: "bottoms", label: "Bottoms" },
  { value: "one-pieces", label: "One-Pieces" },
];

function resolveImageUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return `${config.apiBaseUrl}${url}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [category, setCategory] = useState<GarmentCategory>("auto");
  const [uploading, setUploading] = useState(false);
  const [recentBatches, setRecentBatches] = useState<
    { batchId: string; jobs: Job[] }[]
  >([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    apiFetch<JobsListResponse>("/api/jobs?limit=20")
      .then((data) => {
        // Group tryon jobs by batch_id
        const batches = new Map<string, Job[]>();
        for (const job of data.jobs) {
          if (job.type === "tryon" && job.batch_id) {
            const existing = batches.get(job.batch_id) ?? [];
            existing.push(job);
            batches.set(job.batch_id, existing);
          }
        }
        setRecentBatches(
          Array.from(batches.entries()).map(([batchId, jobs]) => ({
            batchId,
            jobs,
          })),
        );
      })
      .catch(() => toast.error("Failed to load history"))
      .finally(() => setLoadingHistory(false));
  }, []);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const result = await generateCatalog(file, category);
        router.push(`/catalog/${result.batch_id}`);
      } catch {
        toast.error("Catalog generation failed. Please try again.");
        setUploading(false);
      }
    },
    [category, router],
  );

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Shirt className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Generate Catalog</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Upload a garment photo and get professional e-commerce catalog images
          with multiple model poses.
        </p>

        {/* Category selector */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                category === cat.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {uploading ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Generating catalog photos (~20s)...
            </p>
          </div>
        ) : (
          <UploadZone
            onUpload={handleUpload}
            label="Upload a garment photo"
            sublabel="T-shirt, shirt, jeans, or full outfit"
          />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent Catalogs</h2>
        {loadingHistory ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }, (_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        ) : recentBatches.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No catalogs generated yet. Upload a garment above to get started!
          </p>
        ) : (
          <div className="space-y-4">
            {recentBatches.map(({ batchId, jobs }) => (
              <button
                key={batchId}
                type="button"
                onClick={() => router.push(`/catalog/${batchId}`)}
                className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="grid grid-cols-4 gap-2">
                  {jobs.slice(0, 4).map((job) => (
                    <div
                      key={job.id}
                      className="aspect-[3/4] overflow-hidden rounded-md bg-muted"
                    >
                      {job.output_image_url && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={resolveImageUrl(job.output_image_url)}
                          alt="Catalog result"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {jobs.length} photos &middot;{" "}
                  {new Date(jobs[0].created_at).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

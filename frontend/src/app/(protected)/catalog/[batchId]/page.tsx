"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { fetchBatch } from "@/lib/tryon-api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { config } from "@/config/env";
import type { Job } from "@/types";

function resolveImageUrl(url: string): string {
  if (url.startsWith("http")) return url;
  return `${config.apiBaseUrl}${url}`;
}

export default function CatalogPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchBatch(batchId)
      .then((data) => setJobs(data.jobs))
      .catch(() => {
        setNotFound(true);
        toast.error("Catalog not found");
      })
      .finally(() => setLoading(false));
  }, [batchId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="aspect-[3/4] w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (notFound || jobs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-lg font-medium">Catalog not found</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const completedJobs = jobs.filter((j) => j.status === "completed");
  const failedCount = jobs.filter((j) => j.status === "failed").length;
  const garmentUrl = jobs[0].input_image_url;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">Catalog Results</h1>
        <span className="text-sm text-muted-foreground">
          {completedJobs.length} photos
        </span>
      </div>

      {/* Source garment */}
      <div className="flex items-center gap-3 rounded-lg border p-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={resolveImageUrl(garmentUrl)}
            alt="Uploaded garment"
            className="h-full w-full object-cover"
          />
        </div>
        <div>
          <p className="text-sm font-medium">Source Garment</p>
          <p className="text-xs text-muted-foreground">
            {jobs.length} model variations generated
          </p>
        </div>
      </div>

      {failedCount > 0 && (
        <p className="text-sm text-destructive">
          {failedCount} of {jobs.length} generations failed.
        </p>
      )}

      {/* Results grid */}
      <div className="grid grid-cols-2 gap-4">
        {completedJobs.map((job) => (
          <div key={job.id} className="space-y-2">
            <div className="overflow-hidden rounded-lg border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolveImageUrl(job.output_image_url!)}
                alt="Catalog photo"
                className="h-auto w-full object-contain"
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {job.processing_time_ms
                  ? `${(job.processing_time_ms / 1000).toFixed(1)}s`
                  : ""}
              </p>
              <Button asChild variant="ghost" size="sm">
                <a href={resolveImageUrl(job.output_image_url!)} download>
                  <Download className="mr-1 h-3 w-3" />
                  Download
                </a>
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Download all */}
      {completedJobs.length > 1 && (
        <div className="flex justify-center">
          <p className="text-xs text-muted-foreground">
            Tap individual download buttons to save each photo
          </p>
        </div>
      )}
    </div>
  );
}

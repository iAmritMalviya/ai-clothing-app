"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { apiFetch } from "@/lib/api-client";
import { UploadZone } from "@/components/upload/upload-zone";
import { JobCard } from "@/components/jobs/job-card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Job, JobsListResponse } from "@/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    apiFetch<JobsListResponse>("/api/jobs?limit=20")
      .then((data) => setJobs(data.jobs))
      .catch(() => toast.error("Failed to load job history"))
      .finally(() => setLoadingJobs(false));
  }, []);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("image", file);
        const job = await apiFetch<Job>("/api/jobs/remove-bg", {
          method: "POST",
          body: formData,
        });
        router.push(`/job/${job.id}`);
      } catch {
        toast.error("Upload failed. Please try again.");
        setUploading(false);
      }
    },
    [router],
  );

  const noCredits = user?.free_credits_remaining === 0;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Remove Background</h2>
        {uploading ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Uploading and processing...
            </p>
          </div>
        ) : (
          <UploadZone onUpload={handleUpload} disabled={noCredits} />
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent Jobs</h2>
        {loadingJobs ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">
            No images processed yet. Upload one above to get started!
          </p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

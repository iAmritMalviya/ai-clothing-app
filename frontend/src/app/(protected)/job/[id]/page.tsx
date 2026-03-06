"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { ApiRequestError } from "@/lib/api-client";
import { BeforeAfter } from "@/components/jobs/before-after";
import { BackgroundPicker } from "@/components/backgrounds/background-picker";
import { TryOnPicker } from "@/components/tryon/tryon-picker";
import { WhatsAppShareButton } from "@/components/shared/whatsapp-share-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import type { Job, JobType } from "@/types";

const TYPE_LABEL: Record<JobType, string> = {
  bg_removal: "Background Removal",
  apply_bg: "Apply Background",
  tryon: "Virtual Try-On",
};

function resolveBeforeAfterUrls(job: Job) {
  if (job.type === "apply_bg") {
    return {
      inputUrl: job.transparent_image_url ?? job.input_image_url,
      outputUrl: job.output_image_url!,
      inputLabel: "Transparent",
      outputLabel: "With Background",
    };
  }
  if (job.type === "tryon") {
    return {
      inputUrl: job.input_image_url,
      outputUrl: job.output_image_url!,
      inputLabel: "Garment",
      outputLabel: "Try-On Result",
    };
  }
  return {
    inputUrl: job.input_image_url,
    outputUrl: job.output_image_url!,
    inputLabel: "Original",
    outputLabel: "Processed",
  };
}

export default function JobPage() {
  const { id } = useParams<{ id: string }>();
  const { user, refreshUser } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchJob = useCallback(async () => {
    try {
      const data = await apiFetch<Job>(`/api/jobs/${id}`);
      setJob(data);
      return data;
    } catch (err) {
      if (err instanceof ApiRequestError && err.statusCode === 404) {
        setNotFound(true);
      } else {
        toast.error("Failed to load job");
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;

    fetchJob().then((data) => {
      if (data && (data.status === "pending" || data.status === "processing")) {
        interval = setInterval(async () => {
          const updated = await fetchJob();
          if (
            updated &&
            updated.status !== "pending" &&
            updated.status !== "processing"
          ) {
            clearInterval(interval);
          }
        }, 3000);
      }
    });

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchJob]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="aspect-square w-full rounded-lg" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center gap-4 py-16">
        <p className="text-lg font-medium">Job not found</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  if (!job) return null;

  const isProcessing = job.status === "pending" || job.status === "processing";
  const isCompleted = job.status === "completed";
  const isFailed = job.status === "failed";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold">
          {TYPE_LABEL[job.type]}
        </h1>
        <Badge
          variant={
            isCompleted
              ? "default"
              : isFailed
                ? "destructive"
                : "secondary"
          }
        >
          {job.status}
        </Badge>
      </div>

      {isProcessing && (
        <div className="flex flex-col items-center gap-3 rounded-lg border p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Processing your image...
          </p>
        </div>
      )}

      {isCompleted && job.output_image_url && (
        <>
          {(() => {
            const urls = resolveBeforeAfterUrls(job);
            return (
              <BeforeAfter
                inputUrl={urls.inputUrl}
                outputUrl={urls.outputUrl}
                inputLabel={urls.inputLabel}
                outputLabel={urls.outputLabel}
              />
            );
          })()}
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <a href={job.output_image_url} download>
                <Download className="mr-2 h-4 w-4" />
                Download
              </a>
            </Button>
            <WhatsAppShareButton imageUrl={job.output_image_url} />
          </div>

          {/* Background picker — only for completed bg_removal jobs */}
          {job.type === "bg_removal" && (
            <>
              <BackgroundPicker
                jobId={job.id}
                credits={user?.free_credits_remaining ?? 0}
                onApplied={() => void refreshUser()}
              />
              <TryOnPicker jobId={job.id} />
            </>
          )}
        </>
      )}

      {isFailed && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-destructive/50 p-8">
          <p className="text-sm text-destructive">
            Processing failed. Please try again with a different image.
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard">Try Again</Link>
          </Button>
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Job, JobStatus, JobType } from "@/types";

interface JobCardProps {
  job: Job;
}

const STATUS_VARIANT: Record<JobStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  processing: "secondary",
  completed: "default",
  failed: "destructive",
};

const TYPE_LABEL: Record<JobType, string> = {
  bg_removal: "Remove Background",
  apply_bg: "Apply Background",
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function JobCard({ job }: JobCardProps) {
  return (
    <Link href={`/job/${job.id}`}>
      <Card className="transition-colors hover:bg-muted/50">
        <CardContent className="flex items-center gap-4 p-4">
          <div
            className={`h-16 w-16 shrink-0 overflow-hidden rounded-md ${
              job.type === "apply_bg" && !job.output_image_url
                ? "bg-[repeating-conic-gradient(#e5e5e5_0%_25%,white_0%_50%)] bg-[length:8px_8px]"
                : "bg-muted"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={job.output_image_url ?? job.input_image_url}
              alt="Job thumbnail"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">
              {TYPE_LABEL[job.type]}
            </p>
            <p className="text-xs text-muted-foreground">
              {timeAgo(job.created_at)}
            </p>
          </div>
          <Badge variant={STATUS_VARIANT[job.status]}>{job.status}</Badge>
        </CardContent>
      </Card>
    </Link>
  );
}

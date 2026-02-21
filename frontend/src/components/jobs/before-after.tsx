interface BeforeAfterProps {
  inputUrl: string;
  outputUrl: string;
  inputLabel?: string;
  outputLabel?: string;
}

export function BeforeAfter({ inputUrl, outputUrl, inputLabel, outputLabel }: BeforeAfterProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{inputLabel ?? "Original"}</p>
        <div className="overflow-hidden rounded-lg border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={inputUrl}
            alt="Original image"
            className="h-auto w-full object-contain"
          />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{outputLabel ?? "Processed"}</p>
        <div className="overflow-hidden rounded-lg border bg-[repeating-conic-gradient(#e5e5e5_0%_25%,white_0%_50%)] bg-[length:16px_16px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={outputUrl}
            alt="Processed image"
            className="h-auto w-full object-contain"
          />
        </div>
      </div>
    </div>
  );
}

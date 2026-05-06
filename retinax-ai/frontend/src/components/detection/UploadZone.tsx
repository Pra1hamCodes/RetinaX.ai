import { useCallback, useEffect, useRef, useState } from "react";

import Button from "@/components/ui/Button";
import { predictApi } from "@/api/endpoints";
import { ApiError } from "@/api/client";
import { usePredictionStore } from "@/store/predictionStore";
import { cx } from "@/utils";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png", "image/tiff"];

export default function UploadZone() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const { stage, previewUrl, setPreview, setStage, setTaskId, setError, reset } =
    usePredictionStore();

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const accept = useCallback(
    (chosen: File | undefined | null) => {
      if (!chosen) return;
      if (!ACCEPT.includes(chosen.type)) {
        setLocalError("Unsupported file type. Use JPG, PNG, or TIFF.");
        return;
      }
      if (chosen.size > MAX_BYTES) {
        setLocalError("File exceeds the 10 MB limit.");
        return;
      }
      setLocalError(null);
      setFile(chosen);
      const url = URL.createObjectURL(chosen);
      setPreview(url);
    },
    [setPreview],
  );

  const onAnalyze = async () => {
    if (!file) return;
    setStage("uploading");
    setError(null);
    try {
      const { task_id } = await predictApi.submit(file);
      setTaskId(task_id);
      setStage("analyzing");
    } catch (err) {
      const msg = err instanceof ApiError ? err.detail : "Upload failed";
      setError(msg);
      setStage("error");
    }
  };

  const isBusy = stage === "uploading" || stage === "analyzing";
  const showPreview = previewUrl && (stage === "idle" || isBusy || stage === "complete" || stage === "error");

  return (
    <div className="flex h-full flex-col gap-4">
      <div
        className={cx(
          "relative flex flex-1 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-[#0F0F0F] p-8 transition-colors",
          dragOver
            ? "border-[var(--color-primary)] clinical-glow"
            : "border-[#1F1F1F] hover:border-[var(--color-primary)]",
        )}
        onClick={() => !isBusy && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isBusy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (isBusy) return;
          accept(e.dataTransfer.files?.[0]);
        }}
        role="button"
        tabIndex={0}
        aria-disabled={isBusy}
      >
        {showPreview ? (
          <img
            src={previewUrl}
            alt="Uploaded retinal scan preview"
            className="max-h-[420px] w-auto rounded-lg object-contain"
          />
        ) : (
          <>
            <span
              className="material-symbols-outlined text-[56px] text-[var(--color-primary)]"
              aria-hidden
            >
              cloud_upload
            </span>
            <h3 className="mt-4 text-lg font-semibold">Drop a retinal fundus image</h3>
            <p className="mt-1 text-sm text-[var(--color-muted)]">
              JPG · PNG · TIFF · max 10 MB
            </p>
            <p className="mt-3 text-xs uppercase tracking-wider text-[var(--color-muted)]">
              or click to browse
            </p>
          </>
        )}

        {isBusy && (
          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-black/70 backdrop-blur-sm">
            <div className="relative h-16 w-16">
              <span className="absolute inset-0 animate-ping rounded-full bg-[var(--color-primary)] opacity-50" />
              <span className="absolute inset-2 rounded-full bg-[var(--color-primary)]" />
            </div>
            <p className="mt-6 text-sm font-medium uppercase tracking-wider">
              {stage === "uploading" ? "Uploading…" : "Analyzing retinal image…"}
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(",")}
          className="hidden"
          onChange={(e) => accept(e.target.files?.[0])}
        />
      </div>

      {localError && (
        <div className="rounded border border-[var(--color-primary)] bg-[#1a0a0a] px-3 py-2 text-xs text-[var(--color-primary)]">
          {localError}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button
          onClick={onAnalyze}
          disabled={!file || isBusy}
          size="lg"
          className="flex-1"
          leadingIcon={
            <span className="material-symbols-outlined text-[20px]" aria-hidden>
              {isBusy ? "hourglass_top" : "biotech"}
            </span>
          }
        >
          {isBusy ? "Processing" : "Analyze"}
        </Button>
        <Button
          onClick={() => {
            reset();
            setFile(null);
          }}
          variant="secondary"
          size="lg"
          disabled={isBusy && stage === "uploading"}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

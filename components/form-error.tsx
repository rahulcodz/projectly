"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export function FieldError({
  message,
  id,
  className,
  reserve = false,
}: {
  message?: string;
  id?: string;
  className?: string;
  reserve?: boolean;
}) {
  if (!message) {
    if (!reserve) return null;
    return <span aria-hidden className="block min-h-4" />;
  }
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        "mt-1 flex min-h-4 items-start gap-1 text-xs text-destructive",
        className
      )}
    >
      <AlertCircle className="mt-0.5 size-3 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

export function RequiredMark() {
  return (
    <span aria-hidden className="ml-0.5 text-destructive">
      *
    </span>
  );
}

export function FormAlert({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive"
    >
      <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

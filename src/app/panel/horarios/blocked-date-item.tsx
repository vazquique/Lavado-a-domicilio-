"use client";

import { DeleteButton } from "@/components/panel/delete-button";
import { removeBlockedDate } from "./actions";

export function BlockedDateItem({ date, label, reason }: { date: string; label: string; reason: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <span>
        {label}
        {reason && <span className="text-muted-foreground"> · {reason}</span>}
      </span>
      <DeleteButton action={removeBlockedDate.bind(null, date)} confirmText={`¿Desbloquear el ${label}?`} />
    </li>
  );
}

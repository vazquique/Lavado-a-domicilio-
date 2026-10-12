"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/panel/action-state";

// Asks for confirmation, then runs the delete action and shows its error if any.
export function DeleteButton({
  action,
  confirmText,
  label = "Borrar",
}: {
  action: () => Promise<ActionState>;
  confirmText: string;
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className="text-destructive"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(confirmText)) return;
          startTransition(async () => {
            const result = await action();
            setError(result.status === "error" ? result.message : "");
          });
        }}
      >
        {pending ? "Un momento…" : label}
      </Button>
      {error && <p className="w-full text-sm text-destructive">{error}</p>}
    </>
  );
}

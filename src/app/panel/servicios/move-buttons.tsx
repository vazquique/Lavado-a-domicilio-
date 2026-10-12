"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { moveService } from "./actions";

// Up/down arrows to put a service where customers should see it.
export function MoveButtons({ id, name, canUp, canDown }: { id: string; name: string; canUp: boolean; canDown: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function move(direction: "up" | "down") {
    setError("");
    startTransition(async () => {
      const result = await moveService(id, direction);
      if (result.status === "error") setError(result.message);
    });
  }

  return (
    <div className="flex shrink-0 flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={!canUp || pending}
        onClick={() => move("up")}
        aria-label={`Subir ${name}`}
      >
        <ChevronUp aria-hidden />
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={!canDown || pending}
        onClick={() => move("down")}
        aria-label={`Bajar ${name}`}
      >
        <ChevronDown aria-hidden />
      </Button>
      {error && <p className="w-24 text-xs text-destructive">{error}</p>}
    </div>
  );
}

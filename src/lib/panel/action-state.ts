import { z } from "zod";

// Result of a panel Server Action, shown next to the form that sent it.
export type ActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const idleState: ActionState = { status: "idle", message: "" };

export const success = (message = "Guardado."): ActionState => ({ status: "success", message });

export const failure = (message: string): ActionState => ({ status: "error", message });

// Turns a Postgres/PostgREST error into something the owner can act on.
export function dbFailure(error: { code?: string } | null): ActionState {
  switch (error?.code) {
    case "23503":
      return failure("No se puede borrar porque ya tiene reservas. Mejor desactívalo.");
    case "23505":
      return failure("Eso ya existe.");
    case "42501":
      return failure("No tienes permiso para hacer este cambio.");
    default:
      return failure("No se pudo guardar. Intenta de nuevo.");
  }
}

export function isUuid(value: unknown): value is string {
  return z.uuid().safeParse(value).success;
}

"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";
import { idleState, type ActionState } from "@/lib/panel/action-state";

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

// Runs a Server Action from a form without React's automatic form reset, so the
// owner doesn't lose what they typed when there's a validation error.
// `resetOnSuccess` clears "add new" forms after a successful save.
export function useFormAction(action: FormAction, { resetOnSuccess = false } = {}) {
  const [state, dispatch, pending] = useActionState(action, idleState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.status === "success") formRef.current?.reset();
  }, [state, resetOnSuccess]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  return { state, pending, formRef, onSubmit, dispatch };
}

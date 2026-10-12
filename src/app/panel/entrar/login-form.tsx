"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestCode, verifyCode, type LoginState } from "./actions";

const initialState: LoginState = { step: "email", email: "", message: "", isError: false };

export function LoginForm({ linkError }: { linkError: boolean }) {
  const [emailState, emailAction, emailPending] = useActionState(requestCode, initialState);
  const [codeState, codeAction, codePending] = useActionState(verifyCode, initialState);

  // Show the code step's result once the code form has been used for this email.
  const state = codeState.email !== "" && codeState.email === emailState.email ? codeState : emailState;

  if (state.step === "code") {
    return (
      <form action={codeAction} className="space-y-4">
        <input type="hidden" name="email" value={state.email} />
        <p className={state.isError ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {state.message}
        </p>
        <div className="space-y-2">
          <Label htmlFor="code">Código de 6 dígitos</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            required
            autoFocus
            className="h-12 text-center text-2xl tracking-[0.5em]"
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={codePending}>
          {codePending ? "Revisando…" : "Entrar"}
        </Button>
        <p className="text-sm text-muted-foreground">
          También puedes tocar el botón &quot;Entrar&quot; del correo. Se envió a {state.email}.
        </p>
        <Button type="button" variant="link" className="px-0" onClick={() => window.location.reload()}>
          Usar otro correo
        </Button>
      </form>
    );
  }

  return (
    <form action={emailAction} className="space-y-4">
      {linkError && !state.message && (
        <p className="text-sm text-destructive">
          Ese enlace ya no sirve (vence en 1 hora y solo se usa una vez). Pide un código nuevo.
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Tu correo</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          defaultValue={state.email}
          required
          autoFocus
          className="h-11"
        />
      </div>
      {state.message && (
        <p className={state.isError ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {state.message}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={emailPending}>
        {emailPending ? "Enviando…" : "Enviarme un código"}
      </Button>
    </form>
  );
}

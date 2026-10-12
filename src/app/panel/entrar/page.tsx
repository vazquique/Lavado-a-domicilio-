import { Suspense } from "react";
import { PRODUCT_NAME } from "@/config/product";
import { LoginForm } from "./login-form";

export default function LoginPage({ searchParams }: PageProps<"/panel/entrar">) {
  return (
    <div className="space-y-6 pt-8">
      <div>
        <h1 className="text-2xl font-bold">Entrar a tu panel</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {PRODUCT_NAME}. Te mandamos un código a tu correo; no necesitas contraseña.
        </p>
      </div>
      <Suspense>
        {searchParams.then((params) => (
          <LoginForm linkError={params.error === "enlace"} />
        ))}
      </Suspense>
    </div>
  );
}

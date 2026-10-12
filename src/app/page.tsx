import { PRODUCT_NAME } from "@/config/product";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-bold">{PRODUCT_NAME}</h1>
      <p className="mt-2 text-gray-600">
        Cotiza y reserva tu lavado de auto a domicilio. Estamos en construcción.
      </p>
    </main>
  );
}

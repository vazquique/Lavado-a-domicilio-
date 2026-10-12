"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-bold">Algo salió mal</h1>
      <p className="mt-2 text-gray-600">No pudimos cargar esta página. Intenta de nuevo en un momento.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="mt-6 w-fit rounded-lg bg-gray-900 px-4 py-2 text-white"
      >
        Intentar de nuevo
      </button>
    </main>
  );
}

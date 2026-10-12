import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10">
      <h1 className="text-2xl font-bold">No encontramos esta página</h1>
      <p className="mt-2 text-gray-600">Revisa que el link esté bien escrito.</p>
      <Link href="/" className="mt-6 text-blue-700 underline">
        Ir al inicio
      </Link>
    </main>
  );
}

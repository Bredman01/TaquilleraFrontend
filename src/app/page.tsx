import { Suspense } from "react";
import Cartelera from "@/components/Cartelera";
import CarteleraSkeleton from "@/components/CarteleraSkeleton";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
        Cartelera
      </h1>
      <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400">
        Elige tu película y compra tus boletas.
      </p>

      <section aria-labelledby="en-cartelera" className="mt-10">
        <h2
          id="en-cartelera"
          className="mb-6 text-xl font-semibold text-zinc-950 dark:text-zinc-50"
        >
          En cartelera
        </h2>
        <Suspense fallback={<CarteleraSkeleton />}>
          <Cartelera />
        </Suspense>
      </section>
    </main>
  );
}

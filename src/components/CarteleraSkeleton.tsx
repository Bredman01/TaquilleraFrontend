const TARJETAS = Array.from({ length: 8 }, (_, i) => i);

const esqueleto = (
  <div aria-busy="true">
    <span className="sr-only">Cargando cartelera…</span>
    <ul
      aria-hidden="true"
      className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {TARJETAS.map((i) => (
        <li
          key={i}
          className="animate-pulse overflow-hidden rounded-xl border border-black/[.08] dark:border-white/[.145]"
        >
          <div className="aspect-[2/3] w-full bg-zinc-200 dark:bg-zinc-800" />
          <div className="space-y-2 p-4">
            <div className="h-5 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </li>
      ))}
    </ul>
  </div>
);

export default function CarteleraSkeleton() {
  return esqueleto;
}

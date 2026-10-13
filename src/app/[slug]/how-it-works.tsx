import { CalendarCheck, Smartphone, Sparkles, Truck } from "lucide-react";
import { readableTextColor, tintColor } from "@/lib/colors";

const STEPS = [
  { icon: Smartphone, title: "Cotiza aquí", text: "Elige tus servicios y ve el precio al momento." },
  { icon: CalendarCheck, title: "Aparta tu lugar", text: "Escoge el día y la hora que te quede." },
  { icon: Truck, title: "Vamos a tu casa", text: "Llegamos a tu domicilio con todo lo necesario." },
  { icon: Sparkles, title: "Auto como nuevo", text: "Sin filas y sin moverte de tu casa." },
];

// The whole process in four pictures, before the customer starts choosing.
export function HowItWorks({ color }: { color: string }) {
  const iconStyle = { backgroundColor: color, color: readableTextColor(color) };
  return (
    <section aria-labelledby="como-funciona" className="rounded-2xl border bg-card p-4 shadow-sm">
      <h2 id="como-funciona" className="font-semibold">
        ¿Cómo funciona?
      </h2>
      <ol className="mt-3 grid grid-cols-2 gap-2">
        {STEPS.map(({ icon: Icon, title, text }, index) => (
          <li key={title} className="rounded-xl p-3" style={{ backgroundColor: tintColor(color, 10) }}>
            <span className="flex items-center gap-2">
              <span className="flex size-9 items-center justify-center rounded-full shadow-sm" style={iconStyle}>
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="text-xs font-bold tracking-wide" style={{ color }}>
                PASO {index + 1}
              </span>
            </span>
            <span className="mt-2 block font-medium">{title}</span>
            <span className="block text-xs text-muted-foreground">{text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

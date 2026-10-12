import Image from "next/image";
import { readableTextColor } from "@/lib/colors";

// The business's name, logo and color at the top of its public pages.
export function BusinessHeader({
  business,
  tagline,
}: {
  business: { name: string; brandColor: string; logoUrl: string | null };
  tagline?: string;
}) {
  return (
    <header
      className="flex items-center gap-4 rounded-xl p-5"
      style={{ backgroundColor: business.brandColor, color: readableTextColor(business.brandColor) }}
    >
      {business.logoUrl && (
        <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-white">
          <Image src={business.logoUrl} alt={`Logo de ${business.name}`} fill unoptimized className="object-contain p-1" />
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold">{business.name}</h1>
        {tagline && <p className="mt-1 text-sm opacity-90">{tagline}</p>}
      </div>
    </header>
  );
}

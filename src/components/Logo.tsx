import logoUrl from "@/assets/beachpark-logo.png";

export function Logo({ size = "md", inverted = false }: { size?: "sm" | "md" | "lg"; inverted?: boolean }) {
  const sizes = {
    sm: { img: "h-8", text: "text-sm", sub: "text-[10px]" },
    md: { img: "h-10", text: "text-base", sub: "text-[11px]" },
    lg: { img: "h-16", text: "text-2xl", sub: "text-xs" },
  }[size];
  return (
    <div className="flex items-center gap-3">
      <img src={logoUrl} alt="Beach Park" className={`${sizes.img} w-auto object-contain`} />
      <div className="flex flex-col leading-tight">
        <span className={`${sizes.sub} uppercase tracking-[0.18em] ${inverted ? "text-foreground/70" : "text-muted-foreground"}`}>
          CAPEX
        </span>
        <span className={`${sizes.text} font-semibold tracking-tight ${inverted ? "text-foreground" : "text-foreground"}`}>
          Hub de Investimentos
        </span>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STORAGE_KEY = "capex-font-size";
const SIZES = { pequeno: "87.5%", medio: "100%", grande: "115%" } as const;
type Size = keyof typeof SIZES;

function apply(size: Size) {
  document.documentElement.style.fontSize = SIZES[size];
}

export function FontSizeToggle() {
  const [size, setSize] = useState<Size>("medio");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Size | null;
    const s = saved && saved in SIZES ? saved : "medio";
    setSize(s);
    apply(s);
  }, []);

  const change = (v: string) => {
    const s = v as Size;
    setSize(s);
    apply(s);
    localStorage.setItem(STORAGE_KEY, s);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Tamanho do texto" title="Tamanho do texto">
          <Type className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Tamanho do texto</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={size} onValueChange={change}>
          <DropdownMenuRadioItem value="grande">Grande</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="medio">Médio (padrão)</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="pequeno">Pequeno</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

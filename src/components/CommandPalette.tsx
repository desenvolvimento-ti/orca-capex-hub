import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { LayoutDashboard, FolderKanban, BarChart3, Settings, Users, FilePlus, Building2 } from "lucide-react";

type ProjectHit = { id: string; code: string | null; name: string };
type CycleHit = { id: string; name: string; year: number };
type AreaHit = { id: string; name: string };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { isRealFpa, effectiveRole } = useAuth();
  const [search, setSearch] = useState("");

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const { data: projects = [] } = useQuery({
    queryKey: ["palette-projects", search],
    enabled: open,
    queryFn: async () => {
      let q = supabase.from("projects").select("id, code, name").order("updated_at", { ascending: false }).limit(20);
      if (search.trim()) {
        const s = `%${search.trim()}%`;
        q = q.or(`name.ilike.${s},code.ilike.${s}`);
      }
      const { data } = await q;
      return (data ?? []) as ProjectHit[];
    },
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ["palette-cycles"],
    enabled: open && isRealFpa,
    queryFn: async () => {
      const { data } = await supabase.from("cycles").select("id, name, year").order("year", { ascending: false }).limit(10);
      return (data ?? []) as CycleHit[];
    },
  });

  const { data: areas = [] } = useQuery({
    queryKey: ["palette-areas"],
    enabled: open && isRealFpa,
    queryFn: async () => {
      const { data } = await supabase.from("areas").select("id, name").order("name").limit(20);
      return (data ?? []) as AreaHit[];
    },
  });

  const navItems = useMemo(() => {
    const isDirectoria = ["ceo", "cfo", "cco", "cmo"].includes(effectiveRole ?? "");
    const items: Array<{ label: string; to: string; icon: any; show: boolean }> = [
      { label: "Acompanhamento", to: "/app", icon: LayoutDashboard, show: !!effectiveRole && effectiveRole !== "manager" },
      { label: "Painel", to: "/app", icon: LayoutDashboard, show: effectiveRole === "manager" },
      { label: "Projetos", to: "/app/projects", icon: FolderKanban, show: !!effectiveRole },
      { label: "Novo Projeto", to: "/app/projects/new", icon: FilePlus, show: effectiveRole === "manager" || isRealFpa },
      { label: "Financeiro", to: "/app/financeiro", icon: BarChart3, show: isRealFpa },
      { label: "Meu Painel (Diretoria)", to: "/app/diretoria", icon: LayoutDashboard, show: isDirectoria },
      { label: "Administração", to: "/app/admin", icon: Settings, show: isRealFpa },
    ];
    return items.filter((i) => i.show);
  }, [effectiveRole, isRealFpa]);

  function go(to: string) {
    setOpen(false);
    setSearch("");
    navigate({ to: to as any });
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar projetos, ciclos, áreas… (Ctrl+K)" value={search} onValueChange={setSearch} />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Navegação">
          {navItems.map((i) => (
            <CommandItem key={i.label} value={`nav ${i.label}`} onSelect={() => go(i.to)}>
              <i.icon className="mr-2 h-4 w-4" />
              {i.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {projects.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Projetos">
              {projects.map((p) => (
                <CommandItem key={p.id} value={`proj ${p.code ?? ""} ${p.name}`} onSelect={() => go(`/app/projects/${p.id}`)}>
                  <FolderKanban className="mr-2 h-4 w-4" />
                  <span className="text-muted-foreground mr-2">{p.code ?? "—"}</span>
                  <span className="truncate">{p.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {isRealFpa && cycles.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Ciclos">
              {cycles.map((c) => (
                <CommandItem key={c.id} value={`cycle ${c.name} ${c.year}`} onSelect={() => go("/app")}>
                  <Users className="mr-2 h-4 w-4" />
                  {c.name} <span className="ml-2 text-muted-foreground">({c.year})</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {isRealFpa && areas.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Áreas">
              {areas.map((a) => (
                <CommandItem key={a.id} value={`area ${a.name}`} onSelect={() => go("/app/admin")}>
                  <Building2 className="mr-2 h-4 w-4" />
                  {a.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

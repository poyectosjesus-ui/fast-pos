"use client";

import { useState, useEffect, useCallback } from "react";
import { AuditService, AuditLogItem } from "@/lib/services/audit";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Loader2, ShieldAlert, Tag, PackageX, Trash2, ArrowRightLeft, Database, CircleX, CalendarDays, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/layout/sidebar";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { parseAuditDetails } from "@/lib/utils/audit-formatter";
import { cn } from "@/lib/utils";

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterDate, setFilterDate] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'>('ALL');
  const [customDate, setCustomDate] = useState<Date | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      let startDate: number | undefined;
      let endDate: number | undefined;

      const now = new Date();
      
      if (filterDate === 'TODAY') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        startDate = start.getTime();
        endDate = end.getTime();
      } else if (filterDate === 'WEEK') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0);
        startDate = start.getTime();
        endDate = now.getTime();
      } else if (filterDate === 'MONTH') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        startDate = start.getTime();
        endDate = now.getTime();
      } else if (filterDate === 'CUSTOM' && customDate) {
        const start = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate(), 0, 0, 0);
        const end = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate(), 23, 59, 59, 999);
        startDate = start.getTime();
        endDate = end.getTime();
      }

      const resp = await AuditService.getHistory({ 
        page, 
        limit: 50, 
        searchTerm,
        startDate,
        endDate
      });
      if (resp.success) {
        setLogs(resp.items);
        setTotalPages(resp.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, filterDate, customDate]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadLogs();
  }

  // Traducción y formateo visual de las acciones clave
  function getActionBadge(action: string) {
    if (action.includes("VOID_ORDER")) return <Badge variant="outline" className="gap-1 bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20 shadow-sm"><Trash2 className="w-3 h-3" /> Anulación Venta</Badge>;
    if (action.includes("UPDATE_PRODUCT")) return <Badge variant="outline" className="gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20 shadow-sm"><Tag className="w-3 h-3" /> Edición Producto</Badge>;
    if (action.includes("DELETE_PRODUCT")) return <Badge variant="outline" className="gap-1 bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20 shadow-sm"><PackageX className="w-3 h-3" /> Borrado Catálogo</Badge>;
    if (action.includes("CASH_MOVE_OPENING")) return <Badge variant="outline" className="gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-sm"><Wallet className="w-3 h-3" /> Apertura Caja</Badge>;
    if (action.includes("CASH_MOVE_IN") || action.includes("CASH_MOVE_OUT")) return <Badge variant="outline" className="gap-1 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-sm"><ArrowRightLeft className="w-3 h-3" /> Movimiento Caja</Badge>;
    if (action.includes("FACTORY_RESET")) return <Badge variant="outline" className="gap-1 bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/20 shadow-sm"><Database className="w-3 h-3" /> Reset de Fábrica</Badge>;
    return <Badge variant="secondary">{action}</Badge>;
  }

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <div className="flex h-screen bg-muted/40">
        <Sidebar />
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-20 flex-1 overflow-hidden">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold tracking-tight">Auditoría Forense</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Rastro inmutable de actividades financieras y administrativas del sistema.</p>
            </div>
          </header>

          <main className="grid flex-1 items-start gap-4 p-4 sm:px-6 sm:py-0 md:gap-8 overflow-y-auto pb-20">
            <div className="flex-1 space-y-6">

      <div className="flex flex-col gap-4 bg-background/50 backdrop-blur-md border px-4 py-4 rounded-3xl shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
              <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-medium text-sm">Protección Activa</h3>
              <p className="text-xs text-muted-foreground hidden sm:block">Esta tabla no puede ser borrada ni alterada por el equipo.</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-end gap-3 w-full lg:w-auto border-t lg:border-t-0 pt-3 lg:pt-0">
            <div className="flex bg-card border p-1 rounded-2xl shadow-sm overflow-x-auto mx-auto md:mx-0 shrink-0 w-full sm:w-auto mt-1 lg:mt-0">
              <Button 
                variant={filterDate === 'ALL' ? 'secondary' : 'ghost'} 
                size="sm" className="h-8 text-[11px] uppercase font-bold rounded-xl px-4 transition-all"
                onClick={() => { setFilterDate('ALL'); setCustomDate(null); setPage(1); }}
              >Siempre</Button>
              <Button 
                variant={filterDate === 'TODAY' ? 'secondary' : 'ghost'} 
                size="sm" className={cn("h-8 text-[11px] uppercase font-bold rounded-xl px-4 transition-all", filterDate === 'TODAY' && "bg-primary/20 text-primary")}
                onClick={() => { setFilterDate('TODAY'); setCustomDate(null); setPage(1); }}
              >Hoy</Button>
              <Button 
                variant={filterDate === 'WEEK' ? 'secondary' : 'ghost'} 
                size="sm" className="h-8 text-[11px] uppercase font-bold rounded-xl px-4 transition-all"
                onClick={() => { setFilterDate('WEEK'); setCustomDate(null); setPage(1); }}
              >7 Días</Button>
              <Button 
                variant={filterDate === 'MONTH' ? 'secondary' : 'ghost'} 
                size="sm" className="h-8 text-[11px] uppercase font-bold rounded-xl px-4 transition-all"
                onClick={() => { setFilterDate('MONTH'); setCustomDate(null); setPage(1); }}
              >Mes</Button>

              <div className="w-px h-5 bg-border mx-1 self-center" />

              {filterDate === 'CUSTOM' ? (
                <div className="flex items-center px-2 animate-in fade-in zoom-in-95 duration-200">
                  <CalendarDays className="h-4 w-4 text-primary mr-1" />
                  <input 
                    type="date"
                    className="h-8 text-[11px] bg-transparent text-primary border-none rounded-md font-black uppercase outline-none focus:ring-0 w-28 pl-1 pr-0"
                    value={customDate ? customDate.toISOString().substring(0, 10) : ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        const dateObj = new Date(e.target.value);
                        const dt = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000);
                        setCustomDate(dt);
                        setFilterDate('CUSTOM');
                        setPage(1);
                      } else {
                        setFilterDate('ALL');
                        setCustomDate(null);
                      }
                    }}
                  />
                  <Button variant="ghost" size="icon" className="h-6 w-6 ml-1 rounded-full hover:bg-primary/20" onClick={() => {setFilterDate('ALL'); setCustomDate(null);}}>
                      <CircleX className="h-3 w-3 text-primary"/>
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="h-8 rounded-xl px-3 text-[11px] font-bold uppercase transition-all"
                  onClick={() => {setFilterDate('CUSTOM'); setCustomDate(new Date());}}
                >
                  <CalendarDays className="h-4 w-4 sm:mr-2 text-muted-foreground hidden sm:block" /> Específico
                </Button>
              )}
            </div>

            <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto shrink-0">
              <div className="relative w-full md:w-56 shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por empleado..."
                  className="pl-9 h-10 rounded-2xl bg-card border shadow-sm w-full"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button type="submit" variant="secondary" className="h-10 rounded-2xl font-bold uppercase text-[11px]">Filtrar</Button>
            </form>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[140px] font-black tracking-widest text-[10px] uppercase">Fecha y Hora</TableHead>
              <TableHead className="font-black tracking-widest text-[10px] uppercase">Usuario</TableHead>
              <TableHead className="w-[180px] font-black tracking-widest text-[10px] uppercase">Acción Crítica</TableHead>
              <TableHead className="font-black tracking-widest text-[10px] uppercase">Contexto Interno</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Loader2 className="w-6 h-6 animate-spin mb-2" />
                    Cargando historial inmutable...
                  </div>
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-48 text-center bg-muted/20">
                  <p className="text-muted-foreground">No hay registros de auditoría que coincidan con la búsqueda.</p>
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <TableRow key={log.id} className="group hover:bg-muted/50 transition-colors">
                  <TableCell className="text-[12px] font-bold text-muted-foreground group-hover:text-foreground">
                    <div className="flex flex-col">
                      <span>{format(log.createdAt, "dd MMM yyyy", { locale: es })}</span>
                      <span className="text-[10px] uppercase opacity-70">{format(log.createdAt, "HH:mm:ss")}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-sm">
                    {log.userName}
                  </TableCell>
                  <TableCell>
                    {getActionBadge(log.action)}
                  </TableCell>
                  <TableCell className="text-sm font-medium leading-relaxed max-w-[400px]">
                    {parseAuditDetails(log.action, log.details)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-between bg-muted/20">
            <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

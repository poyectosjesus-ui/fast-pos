"use client";

import { useState, useEffect } from "react";
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
import { Search, Loader2, ShieldAlert, Tag, PackageX, Trash2, ArrowRightLeft, Database } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Sidebar } from "@/components/layout/sidebar";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { parseAuditDetails } from "@/lib/utils/audit-formatter";

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadLogs();
  }, [page]);

  async function loadLogs() {
    setLoading(true);
    try {
      const resp = await AuditService.getHistory({ page, limit: 50, searchTerm });
      if (resp.success) {
        setLogs(resp.items);
        setTotalPages(resp.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadLogs();
  }

  // Traducción y formateo visual de las acciones clave
  function getActionBadge(action: string) {
    if (action.includes("VOID_ORDER")) return <Badge variant="destructive" className="gap-1 bg-red-600"><Trash2 className="w-3 h-3" /> Anulación Venta</Badge>;
    if (action.includes("UPDATE_PRODUCT")) return <Badge variant="default" className="gap-1 bg-blue-600"><Tag className="w-3 h-3" /> Edición Producto</Badge>;
    if (action.includes("DELETE_PRODUCT")) return <Badge variant="destructive" className="gap-1 bg-purple-600"><PackageX className="w-3 h-3" /> Borrado Catálogo</Badge>;
    if (action.includes("CASH_MOVE_IN") || action.includes("CASH_MOVE_OUT")) return <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-600"><ArrowRightLeft className="w-3 h-3" /> Movimiento Caja</Badge>;
    if (action.includes("FACTORY_RESET")) return <Badge variant="destructive" className="gap-1 bg-black text-rose-500"><Database className="w-3 h-3" /> Reset de Fábrica</Badge>;
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

      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-card p-4 rounded-xl shadow-sm border">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
            <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="font-medium text-sm">Protección Activa</h3>
            <p className="text-xs text-muted-foreground">Esta tabla no puede ser borrada ni alterada por el equipo.</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar acción, usuario..."
              className="pl-9 h-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button type="submit" variant="secondary" className="h-10">Filtrar</Button>
        </form>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[180px]">Fecha y Hora</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Acción Crítica</TableHead>
              <TableHead>Contexto Interno</TableHead>
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
                  <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground group-hover:text-foreground">
                    {format(log.createdAt, "dd MMM yyyy - HH:mm:ss", { locale: es })}
                  </TableCell>
                  <TableCell className="font-medium">
                    {log.userName}
                  </TableCell>
                  <TableCell>
                    {getActionBadge(log.action)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate" title={log.details || ""}>
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

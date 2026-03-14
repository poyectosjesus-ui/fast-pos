"use client";

import React, { useState, useEffect } from "react";
import { User, UserRole } from "@/store/useSessionStore";
import { Plus, Edit2, Trash2, KeyRound, User as UserIcon, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSessionStore } from "@/store/useSessionStore";

import { Sidebar } from "@/components/layout/sidebar";

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const { user: currentUser } = useSessionStore();
  
  // Estado del Formulario
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    pin: string;
    role: UserRole;
    isActive: number;
  }>({
    name: "",
    pin: "",
    role: "CASHIER",
    isActive: 1,
  });

  const loadUsers = async () => {
    const api = (window as any).electronAPI;
    if (!api || !api.getAllUsers) return;
    try {
      const res = await api.getAllUsers();
      if (res.success && res.users) {
        setUsers(res.users);
      }
    } catch {
      toast.error("No se pudo cargar la lista de usuarios");
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setFormData({
        id: user.id,
        name: user.name,
        pin: "", // No se muestra el PIN anterior, se envía en blanco a SQLite a menos que se quiera cambiar
        role: user.role,
        isActive: user.isActive,
      });
    } else {
      setFormData({ name: "", pin: "", role: "CASHIER", isActive: 1 });
    }
    setIsDialogOpen(true);
  };

  const handleSaveUser = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;

    if (!formData.name) return toast.error("El nombre es requerido");
    if (!formData.id && formData.pin.length !== 4) return toast.error("El PIN debe tener 4 dígitos al crear usuario");

    try {
      const isUpdate = !!formData.id;
      let result;

      if (isUpdate) {
        result = await api.updateUser(formData);
      } else {
        result = await api.createUser(formData);
      }

      if (result.success) {
        toast.success(`Usuario ${isUpdate ? 'actualizado' : 'creado'} exitosamente`);
        setIsDialogOpen(false);
        loadUsers();
      } else {
        toast.error(result.error || "Algo salió mal");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    const api = (window as any).electronAPI;
    if (!api) return;

    try {
      const result = await api.deleteUser(userToDelete);
      if (result.success) {
        toast.success("Usuario eliminado");
        loadUsers();
      } else {
        toast.error(result.error || "No se pudo eliminar al usuario");
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUserToDelete(null);
    }
  };

  return (
    <div className="flex h-screen bg-muted/20">
      <Sidebar />
      <main className="flex-1 flex flex-col sm:pl-20 overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-20 bg-background/50 backdrop-blur-xl border-b px-6 py-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
            <div>
              <h1 className="text-2xl font-black tracking-tight uppercase">
                Equipo
              </h1>
              <p className="text-sm text-muted-foreground italic">
                Gestión de Personal y Cajas
              </p>
            </div>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
              NATIVE CORE v2
            </Badge>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-4xl mx-auto w-full space-y-6 pb-24">
          <Card className="border-primary/10 shadow-xl overflow-hidden animate-in fade-in zoom-in-95">
            <CardHeader className="flex flex-row items-center justify-between bg-primary/5 py-4 border-b border-primary/10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <UserIcon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl font-black">Equipo de Trabajo</CardTitle>
            <CardDescription className="text-xs font-bold uppercase tracking-widest text-primary/60">
              Gestión de Permisos
            </CardDescription>
          </div>
        </div>
        <Button onClick={() => handleOpenDialog()} className="rounded-xl shadow-lg shadow-primary/20 uppercase text-xs font-bold h-10 px-6">
          <Plus className="w-4 h-4 mr-2" /> Añadir Usuario
        </Button>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="divide-y divide-border/50">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center border-2 ${u.role === 'ADMIN' ? 'border-primary/50 bg-primary/10' : 'border-neutral-500/50 bg-neutral-500/10'}`}>
                  {u.role === 'ADMIN' ? <ShieldAlert className="w-5 h-5 text-primary" /> : <UserIcon className="w-5 h-5 text-neutral-500" />}
                </div>
                <div>
                  <h3 className="font-bold text-base flex items-center gap-2">
                    {u.name}
                    {currentUser?.id === u.id && <Badge variant="outline" className="text-[9px] h-4">TÚ</Badge>}
                  </h3>
                  <div className="flex gap-2 mt-1">
                    <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'} className="text-[10px] uppercase font-bold tracking-widest">
                      {u.role}
                    </Badge>
                    {!u.isActive && <Badge variant="destructive" className="text-[10px] uppercase font-bold">Bloqueado</Badge>}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(u)} className="rounded-xl hover:bg-muted">
                  <Edit2 className="w-4 h-4 text-muted-foreground" />
                </Button>
                {currentUser?.id !== u.id && (
                  <Button variant="ghost" size="icon" onClick={() => setUserToDelete(u.id)} className="rounded-xl hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      {/* DIÁLOGO EDICIÓN / CREACIÓN */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{formData.id ? "Editar TPV de Equipo" : "Nuevo Rol TPV"}</DialogTitle>
            <DialogDescription>
              Configura el acceso al Punto de Venta usando un código PIN temporal.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nombre del Empleado</Label>
              <Input
                placeholder="Ej. María Pérez"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>PIN de Acceso (4 Dígitos numéricos)</Label>
              <Input
                type="password"
                maxLength={4}
                onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/[^0-9]/g, '') })}
                className="rounded-xl h-11 font-mono tracking-[0.5em] text-center text-lg"
                placeholder={formData.id ? "**** (Dejar vacío para no cambiar)" : "1234"}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nivel de Permisos</Label>
                <Select value={formData.role} onValueChange={(val: any) => setFormData({ ...formData, role: val })}>
                  <SelectTrigger className="rounded-xl h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASHIER">Cajero</SelectItem>
                    <SelectItem value="ADMIN">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.isActive.toString()} onValueChange={(val) => setFormData({ ...formData, isActive: parseInt(val || "1") })}>
                  <SelectTrigger className="rounded-xl h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Activo</SelectItem>
                    <SelectItem value="0">Bloqueado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

          </div>
          <DialogFooter>
            <Button onClick={handleSaveUser} className="w-full rounded-xl h-11 font-bold uppercase tracking-widest text-xs">
              <KeyRound className="w-4 h-4 mr-2" /> Guardar Equipo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO BORRAR */}
      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Revocar acceso al TPV?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará al cajero del sistema. No se le permitirá al usuario acceder bajo esta credencial otra vez.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold uppercase text-[10px] tracking-widest h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold uppercase text-[10px] tracking-widest h-11">
              Sí, Borrar Usuario
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

          </Card>
        </div>
      </main>
    </div>
  );
}

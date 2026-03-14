"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/store/useSessionStore";
import { toast } from "sonner";
import { Lock, Delete, ArrowRight, UserCircle2, ArrowLeft, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserInfo {
  id: string;
  name: string;
  role: string;
  isActive: number;
}

export default function LoginPage() {
  const router = useRouter();
  const login = useSessionStore((state) => state.login);
  const isAuthenticated = useSessionStore((state) => state.isAuthenticated);
  
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserInfo | null>(null);
  
  const [pin, setPin] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prevenir acceso si ya hay sesión activa
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  // Cargar lista de usuarios al arrancar
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const api = (window as any).electronAPI;
        if (!api) return;
        const res = await api.getAllUsers();
        if (res.success && res.users) {
          // Filtramos solo usuarios activos
          setUsers(res.users.filter((u: UserInfo) => u.isActive === 1));
        }
      } catch (err) {
        console.error("No se pudieron cargar usuarios:", err);
      }
    };
    fetchUsers();
  }, []);

  // Manejador de teclado físico (solo si ya se eligió user)
  useEffect(() => {
    if (!selectedUser) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT") return;
      if (isSubmitting) return;

      if (e.key >= "0" && e.key <= "9") {
        handlePress(e.key);
      } else if (e.key === "Backspace") {
        handleDelete();
      } else if (e.key === "Enter") {
        handleSubmit();
      } else if (e.key === "Escape") {
        handleBack();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pin, isSubmitting, selectedUser]);

  const handlePress = (digit: string) => {
    if (isError) setIsError(false);
    if (pin.length < 4) {
      setPin((prev) => prev + digit);
    }
  };

  const handleDelete = () => {
    if (isError) setIsError(false);
    setPin((prev) => prev.slice(0, -1));
  };

  const handleBack = () => {
    setSelectedUser(null);
    setPin("");
    setIsError(false);
  };

  const handleSubmit = async () => {
    if (!selectedUser) return;
    if (pin.length < 4 || isSubmitting) return;
    
    setIsSubmitting(true);

    const res = await login(selectedUser.id, pin);
    if (res.success) {
      toast.success(`¡Hola, ${selectedUser.name}!`);
      router.push("/");
    } else {
      setIsError(true);
      toast.error(res.error || "PIN incorrecto");
      setPin("");
    }
    setIsSubmitting(false);
  };

  const padNumbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black relative overflow-hidden">
      {/* Background Decorativo Premium */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-primary/30 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-blue-500/30 blur-[100px]" />
      </div>

      <div className="z-10 w-full max-w-sm flex flex-col items-center">
        
        {/* PANTALLA 1: SELECCIONAR USUARIO */}
        {!selectedUser ? (
          <div className="w-full flex flex-col items-center animate-in fade-in zoom-in-95 duration-300">
            <div className="w-16 h-16 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-6 shadow-xl p-3">
              <img src="/pos.svg" alt="Fast POS" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Punto de Venta</h1>
            <p className="text-sm text-neutral-500 text-center mb-10">Selecciona tu cuenta para operar</p>

            <div className="w-full space-y-3">
              {users.length === 0 ? (
                <div className="text-center text-neutral-500 p-4 border border-neutral-800 rounded-xl bg-neutral-900/50">
                  Cargando usuarios...
                </div>
              ) : (
                users.map(user => (
                  <button
                    key={user.id}
                    onClick={() => {
                      setSelectedUser(user);
                      setPin("");
                      setIsError(false);
                    }}
                    className="w-full flex items-center p-4 bg-neutral-900/50 border border-neutral-800 rounded-2xl hover:bg-neutral-800 hover:border-neutral-700 transition-all group active:scale-[0.98]"
                  >
                    <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mr-4 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                      <UserCircle2 className="w-6 h-6 text-neutral-400 group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-lg font-bold text-white leading-none mb-1">{user.name}</h3>
                      <p className="text-xs text-neutral-500 font-medium tracking-wider uppercase">{user.role}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-neutral-600 group-hover:text-white transition-colors" />
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          
          /* PANTALLA 2: INGRESAR PIN */
          <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-right-8 duration-300">
            
            {/* Header del PIN */}
            <div className="flex flex-col items-center mb-8 relative w-full">
              <button 
                onClick={handleBack}
                className="absolute left-0 top-0 p-2 text-neutral-500 hover:text-white transition-colors rounded-full hover:bg-neutral-800"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              
              <div className="w-20 h-20 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center shadow-xl mb-4">
                <UserCircle2 className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
                Hola, {selectedUser.name}
              </h1>
              <p className="text-sm text-neutral-500 text-center">Ingresa tu código PIN</p>
            </div>

            {/* Display de PIN (Bolitas) */}
            <div className={cn(
              "flex justify-center gap-4 mb-10 transition-transform duration-300",
              isError ? "animate-shake" : ""
            )}>
              {[0, 1, 2, 3].map((index) => {
                const hasValue = index < pin.length;
                return (
                  <div
                    key={index}
                    className={cn(
                      "w-4 h-4 rounded-full transition-all duration-200 border-2",
                      hasValue 
                        ? "bg-primary border-primary scale-110 shadow-[0_0_10px_rgba(255,255,255,0.3)]" 
                        : "bg-transparent border-neutral-700",
                      isError && "bg-destructive border-destructive shadow-none"
                    )}
                  />
                );
              })}
            </div>

            {/* Teclado Numérico */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
              {padNumbers.map((num) => (
                <button
                  key={num}
                  onClick={() => handlePress(num)}
                  className="h-16 rounded-2xl bg-neutral-900/50 border border-neutral-800 text-xl font-medium text-white hover:bg-neutral-800 hover:border-neutral-700 active:scale-95 transition-all flex items-center justify-center"
                >
                  {num}
                </button>
              ))}
              
              <button
                onClick={handleDelete}
                className="h-16 rounded-2xl bg-neutral-900/50 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 active:scale-95 transition-all flex items-center justify-center"
              >
                <Delete className="w-6 h-6" />
              </button>
              
              <button
                onClick={() => handlePress("0")}
                className="h-16 rounded-2xl bg-neutral-900/50 border border-neutral-800 text-xl font-medium text-white hover:bg-neutral-800 hover:border-neutral-700 active:scale-95 transition-all flex items-center justify-center"
              >
                0
              </button>
              
              <button
                onClick={handleSubmit}
                disabled={pin.length < 4 || isSubmitting}
                className={cn(
                  "h-16 rounded-2xl flex items-center justify-center transition-all active:scale-95",
                  pin.length === 4 
                    ? "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:bg-primary/90" 
                    : "bg-neutral-900/30 border border-neutral-800 text-neutral-600 cursor-not-allowed"
                )}
              >
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>

          </div>
        )}

        <div className="mt-12 flex items-center justify-center gap-2 text-xs text-neutral-600">
          <Lock className="w-3 h-3" />
          <span>Acceso cifrado localmente</span>
        </div>
      </div>
    </div>
  );
}

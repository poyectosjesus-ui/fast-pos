import { useEffect, useRef } from 'react';

interface BarcodeHandlerProps {
  /** Callback al detectar un código válido */
  onScan: (code: string) => void;
  /** 
   * Perfil de comportamiento:
   * - 'pos': Estricto. Ignora si hay inputs enfocados. Anti-rebote 1s.
   * - 'catalog': Inteligente. Captura siempre. Útil para búsquedas rápidas.
   * - 'diagnostic': Libre. Captura todo para pruebas. Sin blindaje.
   */
  profile?: 'pos' | 'catalog' | 'diagnostic';
  /** Activa o desactiva la escucha global */
  enabled?: boolean;
  /** Tiempo máximo entre teclas (ms) para considerarlo scanner */
  minDelay?: number;
}

/**
 * Componente SIN UI que gestiona la escucha global del lector de códigos de barras.
 * Permite aislar la lógica y aplicar diferentes niveles de seguridad por página.
 */
export function BarcodeHandler({
  onScan,
  profile = 'pos',
  enabled = true,
  minDelay = 50,
}: BarcodeHandlerProps) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar teclas funcionales (excepto Enter que es el terminador común de scanners)
      if (e.key.length > 1 && e.key !== 'Enter') return;

      const now = Date.now();
      const diff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // --- CAPA DE SEGURIDAD BASADA EN PERFIL ---
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (profile === 'pos') {
        // En POS, si el usuario está escribiendo manualmente, el escáner NO debe interferir 
        // (Previene que un disparo ensucie el campo de precio o cantidad)
        if (isInput && e.key !== 'Enter') return;
      }
      
      // El perfil 'catalog' y 'diagnostic' permiten el escaneo incluso con foco 
      // para facilitar la captura de SKUs en buscadores o formularios.

      if (e.key === 'Enter') {
        const code = bufferRef.current.trim();
        
        // Anti-rebote (Cooldown): Evitar dobles lecturas accidentales del mismo código en < 1s
        const isDoubleScan = lastScanRef.current.code === code && (now - lastScanRef.current.time) < 1000;

        if (code.length >= 3 && !isDoubleScan) {
          lastScanRef.current = { code, time: now };
          onScan(code);
        }
        
        bufferRef.current = '';
        return;
      }

      // Si el tiempo entre teclas es muy alto, probablemente sea un humano.
      // Resetear buffer si el humano se tomó un descanso (evita acumular basura).
      if (diff > minDelay && bufferRef.current.length > 0) {
        bufferRef.current = ''; 
      }

      bufferRef.current += e.key;

      // Timeout de limpieza agresiva (300ms de inactividad limpian el buffer)
      const timeout = setTimeout(() => {
        if (Date.now() - lastKeyTimeRef.current >= 300) {
          bufferRef.current = '';
        }
      }, 350);

      return () => clearTimeout(timeout);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onScan, enabled, profile, minDelay]);

  return null; // Componente lógico, no renderiza nada
}

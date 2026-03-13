# 🎨 Sistema de Diseño — Fast-POS

**Versión:** 2.0 | **Stack:** Shadcn UI + Tailwind CSS v4  
**Última actualización:** 12-Mar-2026

---

## 1. Principios

- **Desktop-First:** Pantallas 13"+. Botones táctiles mínimo 44×44px.
- **Legibilidad de caja:** Precio en `font-black`, mínimo 16px. Semáforo 🟢/🟡/🔴 para estados.
- **Feedback inmediato:** Respuesta visual < 200ms. Acciones destructivas con `AlertDialog`.
- **Lenguaje local:** Tú/tu informal. Sin tecnicismos. El símbolo de moneda siempre visible.

---

## 2. Tokens de Diseño

### Colores
| Token | Uso |
|---|---|
| `--primary` | CTA, checkout, acciones principales |
| `--destructive` | Borrar, alertas críticas |
| `emerald-500/600` | Stock ok, ventas completadas, salud del sistema |
| `amber-500` | Advertencias, stock bajo (< 5 unidades) |
| `blue-500` | Hardware, información neutral |

### Tipografía
```css
/* Clases de uso frecuente */
label:   text-[10px] font-black uppercase tracking-widest text-muted-foreground
title:   text-2xl font-black tracking-tight uppercase
price:   text-3xl font-black font-mono text-primary
badge:   text-[10px] font-bold uppercase tracking-tight
```

---

## 3. Patrones Canónicos

### Layout de Página
```tsx
<div className="flex h-screen bg-muted/20">
  <Sidebar />
  <main className="flex-1 flex flex-col sm:pl-20 overflow-hidden">
    <header className="sticky top-0 z-20 bg-background/50 backdrop-blur-xl border-b px-6 py-4">
      <h1 className="text-2xl font-black tracking-tight uppercase">[Título]</h1>
    </header>
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 pb-24">
      {/* contenido */}
    </div>
  </main>
</div>
```

### Card Estándar
```tsx
<Card className="border-primary/10 bg-card/40 shadow-lg">
  <CardHeader className="flex flex-row items-center gap-4">
    <div className="p-2 bg-primary/10 rounded-lg">
      <Icon className="h-5 w-5 text-primary" />
    </div>
    <div>
      <CardTitle>[Título]</CardTitle>
      <CardDescription>[Descripción]</CardDescription>
    </div>
  </CardHeader>
  <CardContent>{/* ... */}</CardContent>
</Card>
```

### Botones
```tsx
{/* Principal */}
<Button className="h-11 uppercase text-[10px] font-black tracking-widest">Guardar</Button>

{/* Secundario */}
<Button variant="secondary" className="h-11 uppercase text-[10px] font-black tracking-widest">Cancelar</Button>

{/* Peligro */}
<Button variant="destructive" size="sm" className="uppercase text-[10px] font-black tracking-widest">
  <Trash2 className="h-4 w-4 mr-2" /> Borrar
</Button>
```

### Confirmación Destructiva (NUNCA `window.confirm`)
```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Borrar Producto</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>¿Borrar "{product.name}"?</AlertDialogTitle>
      <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
        Sí, borrar
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Toasts
```tsx
import { toast } from 'sonner';

toast.success('¡Producto guardado!', { description: 'Ya aparece en tu catálogo.' });
toast.error('Algo salió mal', { description: err.message });

const id = toast.loading('Guardando...');
// ...luego:
toast.success('¡Listo!', { id });
```

### Empty State
```tsx
{items.length === 0 && (
  <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
    <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
      <Package className="h-8 w-8 text-muted-foreground" />
    </div>
    <div>
      <p className="font-bold text-lg">Todavía no hay productos</p>
      <p className="text-sm text-muted-foreground mt-1">Añade tu primer producto y empieza a vender.</p>
    </div>
    <Button size="sm" onClick={onAdd}>+ Agregar</Button>
  </div>
)}
```

### Loading State (Skeleton)
```tsx
{isLoading ? (
  <div className="space-y-4">
    <Skeleton className="h-24 w-full rounded-xl" />
    <Skeleton className="h-24 w-full rounded-xl" />
  </div>
) : <ProductList products={products} />}
```

---

## 4. Pantallas Especiales

### POS (Punto de Venta)
- **Layout:** 2 columnas: catálogo (scrollable) + sidebar del carrito (320px fijo).
- `ProductCard`: min 120×120px. Muestra imagen, nombre, precio, stock.
- Botón de checkout: grande y prominente al fondo del sidebar.

### Login por PIN
- Fondo oscuro con glassmorphism.
- PINpad: grid 3×4, botones min 64×64px.
- Dígitos como puntos `● ● ● ●`. Shake animation si PIN incorrecto.

### Setup Wizard
- Pantalla centrada sin sidebar. Indicador de pasos numerados arriba.
- "Siguiente" deshabilitado hasta que el paso es válido.

### Ticket de Impresión
- `font-mono`. Máx 48 chars de ancho (rollo 80mm).
- Logo centrado > datos del negocio > tabla de ítems > totales > método de pago.

---

## 5. Micro-Animaciones

```tsx
// Entrada de elementos
className="animate-in fade-in slide-in-from-bottom-2 duration-300"

// Hover en tarjetas clickeables
className="transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
```

**Regla:** Duración entre 150ms y 400ms. Nada más largo.

---

## 6. Accesibilidad Mínima

- Todos los inputs con `<Label htmlFor>`.
- Botones con texto (no solo iconos).
- Iconos decorativos con `aria-hidden="true"`.
- Contraste texto: mínimo WCAG AA (4.5:1).

"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { formatCurrency } from "@/lib/constants";

// Colores Premium
const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6"];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/95 backdrop-blur-md border border-border p-3 rounded-xl shadow-xl">
        <p className="font-bold text-sm">{payload[0].name || payload[0].payload.name}</p>
        <p className="font-black text-lg text-primary">{formatCurrency(payload[0].value)}</p>
        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">
          {payload[0].payload.tickets} Ventas
        </p>
      </div>
    );
  }
  return null;
};

// 1. Gráfica por Cajero (Top Performers - Barras Horizontales)
export function CashierChart({ data }: { data: Array<{ cashierName: string; totalAmount: number; tickets: number }> }) {
  const chartData = data.map(d => ({
    name: d.cashierName || "Desconocido",
    value: d.totalAmount,
    tickets: d.tickets
  }));

  if (chartData.length === 0) {
    return <div className="h-[250px] flex items-center justify-center text-muted-foreground border border-dashed rounded-xl text-xs italic bg-muted/20">Sin datos de cajeros</div>;
  }

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.5} />
          <XAxis type="number" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
          <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10, fontWeight: "bold" }} stroke="var(--muted-foreground)" />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
          <Bar dataKey="value" fill="url(#colorPrimary)" radius={[0, 4, 4, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
           <defs>
             <linearGradient id="colorPrimary" x1="0" y1="0" x2="1" y2="0">
               <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
               <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.8}/>
             </linearGradient>
           </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// 2. Gráfica por Canal de Venta (Lista de Montos Simplificada)
export function SourceList({ data }: { data: Array<{ channel: string; totalAmount: number; tickets: number }> }) {
  if (!data || data.length === 0) {
    return <div className="h-[250px] flex items-center justify-center text-muted-foreground border border-dashed rounded-xl text-xs italic bg-muted/20">Sin datos de canales</div>;
  }

  const grandTotal = data.reduce((acc, curr) => acc + curr.totalAmount, 0);

  return (
    <div className="h-[250px] w-full flex flex-col justify-center gap-4 px-2">
      {data.map((item, i) => {
        const pct = grandTotal > 0 ? Math.round((item.totalAmount / grandTotal) * 100) : 0;
        const name = item.channel === 'COUNTER' ? 'Mostrador' : item.channel;
        
        return (
          <div key={item.channel} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-sm font-bold uppercase tracking-tight">{name}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-sm font-black">{formatCurrency(item.totalAmount)}</span>
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{item.tickets} Ventas ({pct}%)</span>
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div className="h-full rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length], width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 3. Gráfica por Método de Pago (Lista de Montos Simplificada)
export function PaymentList({ data }: { data: Array<{ method: string; totalAmount: number; tickets: number }> }) {
  if (!data || data.length === 0) {
    return <div className="h-[250px] flex items-center justify-center text-muted-foreground border border-dashed rounded-xl text-xs italic bg-muted/20">Sin datos de cobro</div>;
  }

  const grandTotal = data.reduce((acc, curr) => acc + curr.totalAmount, 0);

  return (
    <div className="h-[250px] w-full flex flex-col justify-center gap-4 px-2">
      {data.map((item, i) => {
        const pct = grandTotal > 0 ? Math.round((item.totalAmount / grandTotal) * 100) : 0;
        const name = item.method === 'CASH' ? 'Efectivo' : item.method === 'CARD' ? 'Tarjeta' : item.method === 'TRANSFER' ? 'Transferencia' : item.method;
        
        return (
          <div key={item.method} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[(i + 2) % COLORS.length] }} />
                <span className="text-sm font-bold uppercase tracking-tight">{name}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-sm font-black">{formatCurrency(item.totalAmount)}</span>
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{item.tickets} Pagos ({pct}%)</span>
              </div>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div className="h-full rounded-full" style={{ backgroundColor: COLORS[(i + 2) % COLORS.length], width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 4. Gráfica de Progreso Histórico (Lápiz y Papel)
import { AreaChart, Area } from "recharts";

export function ProgressChart({ data }: { data: Array<{ date: string; revenue: number; cost: number }> }) {
  if (!data || data.length === 0) {
    return <div className="h-[250px] flex items-center justify-center text-muted-foreground border border-dashed rounded-xl text-xs italic bg-muted/20">Sin datos de este periodo</div>;
  }

  // Precalculamos utilidades y humanizamos las fechas
  const parsedData = data.map(d => {
    let displayDate = d.date;
    
    if (d.date.includes("-W")) {
      displayDate = `Semana ${d.date.split("-W")[1]}`;
    } else if (d.date.length === 7) {
      // Mes. ej: 2026-03 -> "Marzo"
      const dateObj = new Date(d.date + "-02T00:00:00");
      const monthName = dateObj.toLocaleDateString('es-MX', { month: 'long' });
      displayDate = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    } else if (d.date.length === 10) {
      // Día. ej: "2026-03-17" -> "Lunes 17"
      const dateObj = new Date(d.date + "T00:00:00");
      const weekday = dateObj.toLocaleDateString('es-MX', { weekday: 'long' });
      const day = dateObj.getDate();
      displayDate = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${day}`;
    }

    return {
      ...d,
      displayDate
    };
  });

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={parsedData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />
          <XAxis 
            dataKey="displayDate" 
            tick={{ fontSize: 10, fontWeight: "bold" }} 
            stroke="var(--muted-foreground)" 
            tickMargin={10}
            minTickGap={20}
          />
          <YAxis 
            tickFormatter={(v) => `$${v}`} 
            tick={{ fontSize: 10 }} 
            stroke="var(--muted-foreground)" 
            width={60}
          />
          <Tooltip 
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
            content={({ active, payload, label }: any) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-background/95 backdrop-blur-md border border-border p-3 rounded-xl shadow-xl">
                    <p className="font-bold text-[10px] text-muted-foreground uppercase">{label}</p>
                    <p className="font-black text-emerald-500 text-lg">Entró: {formatCurrency(payload[0].value)}</p>
                  </div>
                );
              }
              return null;
            }} 
          />
          <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

# 📚 Documentación Técnica — Fast-POS

Esta carpeta contiene la **fuente de verdad** del proyecto. Todo código nuevo debe consultar estos documentos antes de ser escrito.

> **Regla de oro:** Si hay conflicto entre el código y estos documentos, **los documentos ganan**. Actualiza el código, no los docs (a menos que sea una decisión consciente documentada en la Bitácora).

---

## Índice de Documentos

| Documento | Cuándo Consultarlo |
|---|---|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Al diseñar un nuevo módulo, entender el flujo de datos, o decidir qué capa hace qué |
| [ACCEPTANCE_CRITERIA.md](./ACCEPTANCE_CRITERIA.md) | Antes de cerrar cualquier tarea. Checklist de "¿esto está listo para producción?" |
| [CODING_STANDARDS.md](./CODING_STANDARDS.md) | Al escribir cualquier línea de código. Contiene reglas absolutas y plantillas |
| [UI_DESIGN_SYSTEM.md](./UI_DESIGN_SYSTEM.md) | Al crear o modificar cualquier componente UI o pantalla |
| [TESTING_GUIDE.md](./TESTING_GUIDE.md) | Al escribir tests o al hacer QA manual de una funcionalidad |
| [BITACORA.md](./BITACORA.md) | Al cerrar una sesión de desarrollo (agregar entrada al final) |

---

## Flujo de Trabajo con estos Docs

```
Nueva tarea
    │
    ▼
1. Consultar ARCHITECTURE.md  →  ¿Dónde va este código?
    │
    ▼
2. Consultar ACCEPTANCE_CRITERIA.md  →  ¿Qué debe hacer exactamente?
    │
    ▼
3. Escribir código con CODING_STANDARDS.md abierto
    │
    ▼
4. Diseñar UI con UI_DESIGN_SYSTEM.md como referencia
    │
    ▼
5. Hacer QA con TESTING_GUIDE.md (manual + automatizado)
    │
    ▼
6. Cerrar con entrada en BITACORA.md
```

---

## Actualizando estos Docs

- **BITACORA.md:** Se actualiza **en cada sesión** (agregar fila a la tabla).
- **ARCHITECTURE.md / CODING_STANDARDS.md:** Se actualizan solo cuando hay un cambio de arquitectura o una nueva convención adoptada.
- **ACCEPTANCE_CRITERIA.md:** Se actualiza al agregar nuevas features (añadir sección de criterios).
- **UI_DESIGN_SYSTEM.md:** Se actualiza al crear nuevos patrones o componentes de uso general.
- **TESTING_GUIDE.md:** Se actualiza al agregar casos de prueba para nuevos módulos críticos.

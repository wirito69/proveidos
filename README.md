# Sistema de Gestión de Proveídos y Elevaciones
### Escuela de Posgrado - Universidad Nacional Hermilio Valdizán (UNHEVAL)

Sistema informático desarrollado para reemplazar y optimizar el flujo de trabajo del archivo Excel de macros, garantizando:
- **Cero bloqueos de archivo**: Múltiples asistentes pueden ingresar documentos al mismo tiempo desde distintas PCs en la red de la oficina.
- **Correlación automática e infalible**: El sistema calcula el siguiente número de Proveído (`1054`, `1055`, ...) y Elevación (`0095`, `0096`, ...) sin duplicados ni saltos.
- **Destinatarios múltiples intuitivos**: Añade fácilmente 1, 2, 3 o más destinatarios con nombres y cargos independientes con 1 clic.
- **Autocompletado inteligente**: Sugiere nombres de docentes y cargos oficiales automáticamente.
- **Impresión idéntica al formato oficial UNHEVAL**:
  - Encabezado institucional con el Escudo oficial.
  - Tabla de verificación (Checklist con casillas marcables: Su conocimiento, Evaluar, Informar, etc.).
  - Caja de disposición con texto en cursiva y negrita.
  - Espacio de firma y sello de Dirección.
  - Soporte de impresión directa o guardado en PDF con formato exacto A4.
  - **Impresión por lotes**: Selecciona varios proveídos y mándalos a la impresora en bloque.
- **Búsqueda inmediata**: Encuentra al instante cualquier documento por número, nombre, expediente (REG), asunto o rango de fechas.
- **Exportación a Excel**: Puedes descargar en cualquier momento un archivo `.xlsx` actualizado con todos los registros.

---

## 🚀 Cómo Iniciar el Sistema

### Opción 1: Un solo clic (Recomendado)
Haz doble clic en el archivo:
```
iniciar_sistema.bat
```
Se iniciará el servidor y se abrirá automáticamente en tu navegador web en:
`http://localhost:5000`

---

## 🌐 Cómo usarlo desde otras computadoras de la oficina (Red Local)

Si otra persona en la misma oficina necesita registrar o imprimir proveídos:
1. En la computadora principal donde corre el sistema, abre un terminal y escribe `ipconfig` para ver tu dirección IP (por ejemplo: `192.168.1.45`).
2. En las otras computadoras de la oficina, solo deben abrir su navegador (Chrome, Edge, etc.) e ingresar:
   `http://192.168.1.45:5000`
3. ¡Listo! Todos trabajarán sobre la misma base de datos en tiempo real.

---

## 📂 Estructura del Proyecto

- `app.py`: Servidor web Flask y API REST.
- `database.py`: Motor de base de datos SQLite y exportación a Excel.
- `proveidos.db`: Base de datos local SQLite con todos los registros del año 2026.
- `migrate_from_excel.py`: Script de migración inicial desde el Excel original.
- `iniciar_sistema.bat`: Lanzador de acceso directo para Windows.
- `templates/`:
  - `index.html`: Panel de control principal (Proveídos, Elevaciones, Métricas).
  - `print_proveido.html`: Plantilla de impresión oficial del Proveído UNHEVAL.
  - `print_elevacion.html`: Plantilla de impresión oficial de Elevación UNHEVAL.
  - `print_batch.html`: Plantilla de impresión por lotes (múltiples páginas).
- `static/`:
  - `img/logo_unheval.png`: Escudo institucional oficial de la UNHEVAL.
  - `js/main.js`: Lógica interactiva del cliente, autocompletado y validaciones.

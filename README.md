# Kanview (Node)

Sistema de gestión para taller de tapicería con Node.js, Express, MongoDB y EJS.

## Requisitos

- Node.js 20+
- MongoDB accesible mediante `MONGODB_URI`
- `mongodump` instalado para los respaldos

## Configuración

```bash
npm install
cp .env.example .env
```

Completa `MONGODB_URI`, `MONGODB_DB`, `JWT_SECRET`, `API_KEY` y las variables SMTP del respaldo.
Si el URI no incluye base de datos, `MONGODB_DB` indica cuál usar (por ejemplo `kanview`).

### Primer administrador

No hay registro público. Crea la primera cuenta con:

```bash
ADMIN_EMAIL=admin@tu-dominio.com \
ADMIN_PASSWORD='una-contraseña-segura' \
ADMIN_NOMBRE='Administrador' \
npm run admin:crear
```

El script es idempotente: si el correo existe, actualiza la contraseña y el rol.

## Ejecutar

```bash
npm run dev     # desarrollo con nodemon
npm start       # producción
npm test        # pruebas
npm run db:indices  # crear/verificar índices de MongoDB
```

## Módulos implementados

- Autenticación JWT de usuarios y clientes, access + refresh tokens, sesiones revocables, API key y rate limit.
- Paginación estándar (`pagina`, `limite`, metadatos) e índices compuestos para pedidos, tareas, productos, usuarios, sesiones y mensajería.
- Cabeceras de seguridad, escape de datos dinámicos en las vistas y CSP con nonce por petición.
- Roles `admin`, `secretaria`, `trabajador` y portal de cliente.
- Panel con totales reales, últimas órdenes y alertas de inventario.
- Pedidos con código secuencial `PED-0001`, control de stock, aprobación/rechazo, historial y Kanban restringido a Administración. Un pedido no se puede completar mientras tenga tareas pendientes.
- Tareas y actividades con fechas validadas contra el pedido, progreso, confirmación y conteo de tareas por trabajador. Una tarea no se puede completar con actividades pendientes; si se agrega una actividad pendiente a una tarea completada, la tarea y el pedido se reabren.
- Productos con categorías de tapicería, búsqueda, disponibilidad para clientes y desactivación lógica.
- Catálogo de solo lectura para clientes y personal (`/catalogo`), con búsqueda, filtros, ficha y disponibilidad sin exponer stock al cliente.
- Inventario (`/inventario`) con unidades, productos agotados, stock bajo, valor del inventario y filtros; solo personal del taller.
- Calendario de entregas y eventos con recordatorios.
- Finanzas con ingresos, gastos, balance, margen y fuentes de ingreso.
- Usuarios del personal con roles, vínculo a trabajador y restablecimiento de contraseña.
- Auditoría paginada de accesos y acciones.
- Mensajería directa persistente con WebSocket, contactos filtrados por rol, contador de no leídos, marcación automática de leídos y fallback HTTP.
- Respaldo diario de MongoDB por correo (medianoche, zona horaria configurable).

## Seguridad y rendimiento

- Access token corto + refresh token; ambos quedan invalidados al revocar la sesión.
- Rate limit por IP para login/API y por usuario para mensajería. Configurable con `RATE_LIMIT_*`.
- CSP con nonce por petición; los scripts inline de las vistas usan ese nonce.
- Las listas aceptan `?pagina=1&limite=50` (máximo 200) y devuelven `paginacion`.
- `npm run db:indices` crea/verifica los índices compuestos de MongoDB.
- `TRUST_PROXY` debe configurarse solo si hay un proxy inverso real; de lo contrario se puede falsificar la IP.

## Notas de operación

- La mensajería WebSocket y los rate limits viven en memoria del proceso. Para varias instancias se necesita un bus compartido (Redis) o sesiones sticky.
- El WebSocket usa el JWT en el query string (`/ws/mensajeria?token=...`). En producción debe usarse siempre HTTPS/WSS.
- Los respaldos adjuntos por correo dependen del límite del proveedor SMTP; con Gmail el máximo ronda 25 MB.

## Pendiente para las siguientes fases

- Evidencias multimedia con enlaces firmados.
- Facturas PDF y envío por correo.
- Notificaciones persistentes y correo para eventos.
- Recuperación de contraseña, 2FA y términos y condiciones.
- Gestión de respaldos (listar/restaurar) y pantalla de configuración.
- Pruebas de integración automatizadas y endurecimiento CSP/CSRF.

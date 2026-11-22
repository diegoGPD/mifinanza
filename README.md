# MiFinanza

App de finanzas personales (MXN): tarjetas, MSI, pagos recurrentes, calendario de cortes/pagos, metas, presupuestos y simulador de compras. Multiusuario con login; los datos viven en Postgres.

## Stack

- **Frontend:** React 19 + Vite + Recharts (SPA, mobile-first, modo oscuro por defecto)
- **Backend:** Node 20+ / Express 5, sesiones JWT en cookie httpOnly, contraseñas con bcrypt
- **DB:** PostgreSQL (el esquema se crea solo al arrancar)

## Deploy en Railway

1. Sube este repo a GitHub y en Railway crea un proyecto **Deploy from GitHub repo**.
2. En el mismo proyecto agrega **+ New → Database → PostgreSQL**.
3. En el servicio de la app → **Variables**:
   - `DATABASE_URL` → referencia a la del Postgres: `${{Postgres.DATABASE_URL}}`
   - `JWT_SECRET` → una cadena larga aleatoria (`openssl rand -hex 32`)
   - `NODE_ENV` → `production`
4. Railway detecta Node y corre `npm install`, `npm run build` y `npm start` (ya configurado en `railway.json`).
5. **Settings → Networking → Generate Domain** para obtener la URL pública.

Cada push a la rama principal redeploya.

## Desarrollo local

```bash
npm install
cp .env.example .env   # edita DATABASE_URL
export $(cat .env | xargs)
npm run dev            # API en :3000, Vite en :5173 (con proxy a /api)
```

Para probar el build de producción: `npm run build && npm start` → http://localhost:3000

## Estructura

```
server/   index.js (Express + estáticos), db.js (pool + esquema), auth.js, routes.js (API REST)
client/   src/screens/*  Dashboard, Cards, Calendar, Goals, QuickAdd, Simulator, Settings, Setup, Auth
          src/lib.js     cálculos (saldos, MSI, presupuesto diario, horas de trabajo), formato MXN
          src/store.jsx  estado global + llamadas a la API
```

## API (todas bajo `/api`, requieren cookie de sesión salvo auth)

- `POST /auth/register | /auth/login | /auth/logout`, `GET /auth/me`
- `GET /state` — todo el estado del usuario en una llamada (y registra recurrentes vencidos)
- CRUD: `/cards`, `/transactions`, `/msi_plans`, `/recurring`, `/goals` (`GET`, `POST`, `PUT /:id`, `DELETE /:id`)
- `GET|PUT /settings`
- `GET /export` / `POST /import` — respaldo JSON completo (import reemplaza los datos del usuario)

## Enlace rápido (registrar sin abrir la app)

Ajustes → **Enlace rápido** → Generar. Obtienes `https://<tu-dominio>/api/quick/<token>`:

```
GET  /api/quick/<token>?monto=250&desc=Oxxo&tarjeta=4417&categoria=comida
POST /api/quick/<token>   {"monto": 250, "desc": "Oxxo", "tarjeta": "Oro", "tipo": "compra"}
```

- `monto` obligatorio; `tarjeta` = últimos 4 o nombre (opcional si solo tienes una); `tipo` = compra | pago/deposito | ingreso; `categoria`; `fecha` AAAA-MM-DD.
- Responde JSON (o una página de confirmación si se abre en navegador). Regenerar o Desactivar invalida el anterior.
- `https://<tu-dominio>/#registrar` abre directo el formulario de registro (útil como ícono en la pantalla de inicio).

## Notas de modelo

- **Saldo de tarjeta** = saldo inicial + compras − pagos + mensualidades MSI ya cobradas y no pagadas.
- **MSI**: se guarda total, meses y fecha de la primera mensualidad; el calendario de cargos se calcula.
- **Recurrentes**: al cargar la app, cualquier recurrente cuyo día ya pasó este mes se registra como compra una sola vez.
- **Presupuesto diario**: (presupuesto − gastado antes de hoy) / días restantes del mes.

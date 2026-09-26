# Fácil · MVP fase 1

Plataforma de fidelización para restaurantes, bares, cafés y panaderías. El cliente se identifica por la puerta que prefiera (chip NFC, QR, WhatsApp, pase de billetera, celular en caja o código de domicilio), cada sello y cada punto corresponden a una compra validada, y el restaurante ve en su panel quién vuelve, quién no y cuánto vende el Club.

## Qué incluye esta fase

| Vista | Ruta | Para quién |
| --- | --- | --- |
| Entrada por la pieza de mesa | `/r/:slug?t=MESA-7&via=nfc` | Cliente (la misma URL va en el chip NFC con `via=nfc` y en el QR con `via=qr`) |
| Tarjeta del Club | `/c/:token` | Cliente: puntos, sellos, premios, escanear factura, código de domicilio, calificación |
| Caja | `/caja` | Cajero o mesero: buscar por celular, leer el pase, confirmar monto, canjear premios, generar códigos de domicilio |
| Panel | `/panel` | Administrador: indicadores, compras por puerta, clientes en riesgo, mensajes automáticos, opiniones, piezas de mesa y reglas del Club |

Reglas de negocio implementadas:

- Un toque o escaneo identifica al cliente, pero **solo una compra validada suma**: por el QR de la factura electrónica o documento POS electrónico, por confirmación en caja o por código de domicilio de un solo uso.
- La factura debe ser del NIT del restaurante, tener menos de 48 horas (configurable) y no haberse usado antes (CUFE/CUDE único).
- Máximo 2 compras validadas por cliente al día (configurable).
- Puntos: 1 por cada $1.000 (configurable). Sellos: 1 por compra; al completar la tarjeta se crea el premio (vence en 60 días) y la tarjeta vuelve a cero.
- Reseñas: todos reciben el enlace de Google; la calificación de 1 a 3 estrellas además alerta al administrador por WhatsApp. No se filtra quién llega a Google, por política de Google.
- Datos personales: el registro exige la autorización de la Ley 1581 de 2012. Los clientes inscritos desde caja reciben su tarjeta por WhatsApp y aceptan la autorización al abrirla; hasta entonces no reciben mensajes promocionales. Responder "BAJA" por WhatsApp o usar el enlace de la tarjeta desactiva las promociones.

## Stack

- Node 22, Express 5, Zod, JWT para el personal.
- Prisma 7 con PostgreSQL mediante `@prisma/adapter-pg` (sin motor binario en tiempo de ejecución).
- Frontend React 19 + Vite 7 en `web/`, servido por el mismo Express desde `web/dist`.
- WhatsApp Cloud API (Meta) para mensajes; Google Wallet para el pase (opcional).
- Un solo servicio web en Render + un Cron Job diario + PostgreSQL, definidos en `render.yaml`.

```
prisma/            schema.prisma, migraciones, datos de demostración (seed.js)
prisma.config.ts   configuración de Prisma 7 (lee DATABASE_URL)
server/
  index.js         app Express, seguridad, errores, archivos estáticos
  routes/          public.js (cliente), staff.js (caja), panel.js (administrador), whatsapp.js (webhook)
  lib/             dian.js (lectura del QR de factura), rewards.js (reglas del Club), insights.js (riesgo, cumpleaños, sugerencias),
                   customers.js, whatsapp.js, wallet.js, util.js
  jobs/automations.js   cumpleaños, "te extrañamos", premio casi listo, vencimiento de premios
scripts/nuevo-restaurante.js   alta de un restaurante real con su administrador y sus mesas
web/               app React (páginas en web/src/pages)
test/              pruebas del lector de facturas, teléfonos y reglas de riesgo
```

## Correr en local

Requisitos: Node 22 y PostgreSQL 14 o superior.

```bash
cp .env.example .env            # ajustar DATABASE_URL
npm install
npm --prefix web install
npx prisma migrate deploy       # crea las tablas
npx prisma generate
npm run seed                    # restaurante de demostración "Arepa & Brasa"
npm run dev                     # API en http://localhost:3000
npm run dev:web                 # app en http://localhost:5173 (usa la API por proxy)
npm test
```

Usuarios de demostración: `admin@facil.demo` / `facil-demo-2026` (panel) y `caja@facil.demo` / `caja-demo-2026` (caja). Entrada de cliente: `http://localhost:5173/r/arepa-y-brasa?t=MESA-7&via=nfc`.

Sin credenciales de WhatsApp, todos los mensajes se imprimen en la consola del servidor con el prefijo `[whatsapp:dev]` y quedan registrados en la tabla `MessageLog`, así que los flujos se pueden probar completos.

Para probar una factura sin escanear, se puede enviar el texto del QR directamente:

```bash
curl -X POST http://localhost:3000/api/c/<token>/invoice -H 'Content-Type: application/json' \
  -d '{"qr":"NumFac: FE-1 FecFac: 2026-09-25 HorFac: 20:41:00-05:00 NitFac: 901234567 ValTolFac: 86400.00 CUFE: 941cf36af62dbbc06f105d2a80e9bfe683a90e84"}'
```

## Despliegue en Render

1. Subir este repositorio a GitHub.
2. En Render: **New → Blueprint**, elegir el repositorio. Render crea el servicio web `facil`, el cron `facil-automatizaciones`, la base `facil-db` y el grupo de variables `facil-config`.
3. En el grupo `facil-config`, completar `PUBLIC_URL` con la URL pública (`https://facil.onrender.com` o el dominio propio). `JWT_SECRET` se genera solo.
4. El primer despliegue ejecuta `npm run build` y, al arrancar, `prisma migrate deploy` crea las tablas.
5. Crear el primer restaurante desde el **Shell** del servicio web:

   ```bash
   node scripts/nuevo-restaurante.js --slug=arepa-y-brasa --nombre="Arepa & Brasa" --nit=901234567 \
     --ciudad=Barranquilla --admin=dueno@correo.co --clave="clave-de-al-menos-10" --mesas=12 --premio="Parrillada para 2"
   ```

   Para cuentas de caja, el administrador usa `POST /api/panel/staff` (en esta fase no tiene pantalla propia).
6. Probar `/healthz`, luego `/panel` con el administrador y `/r/<slug>?t=MESA-1&via=qr` desde un celular.

No ejecutar `npm run seed` en producción: crea usuarios con contraseñas conocidas.

### Planes y región

El blueprint usa la región `virginia` (la más cercana a Colombia entre las de Render) y planes `starter` para web y cron, `basic-256mb` para PostgreSQL. Se pueden cambiar en `render.yaml` antes de crear el blueprint.

## WhatsApp Cloud API

1. En Meta Business: crear la app, agregar WhatsApp, registrar el número del restaurante y generar un token permanente de usuario del sistema.
2. Variables: `WA_TOKEN`, `WA_PHONE_NUMBER_ID`, `WA_APP_SECRET` (secreto de la app, para validar la firma del webhook) y `WA_VERIFY_TOKEN` (cualquier texto).
3. Webhook: URL `https://<PUBLIC_URL>/api/whatsapp/webhook`, token de verificación = `WA_VERIFY_TOKEN`, suscribir el campo `messages`.
4. `WA_DEFAULT_RESTAURANT_SLUG`: restaurante que atiende ese número. En esta fase hay un número por restaurante y por despliegue; el enrutamiento por número queda para la fase 2.
5. Crear y aprobar estas plantillas en español (`es`). El orden de las variables importa:

| Plantilla | Categoría | Variables del cuerpo |
| --- | --- | --- |
| `facil_tarjeta` | Utilidad | {{1}} restaurante, {{2}} enlace de la tarjeta |
| `facil_bienvenida` | Utilidad | {{1}} nombre, {{2}} restaurante, {{3}} enlace |
| `facil_compra` | Utilidad | {{1}} nombre, {{2}} puntos sumados, {{3}} sellos "x/8", {{4}} enlace |
| `facil_te_extranamos` | Marketing | {{1}} nombre, {{2}} restaurante, {{3}} enlace |
| `facil_cumpleanos` | Marketing | {{1}} nombre, {{2}} restaurante, {{3}} regalo, {{4}} enlace |
| `facil_premio_cerca` | Marketing | {{1}} nombre, {{2}} premio, {{3}} restaurante, {{4}} enlace |
| `facil_alerta_calificacion` | Utilidad | {{1}} estrellas, {{2}} cliente, {{3}} comentario |

Si Meta aprueba otros nombres, se configuran con `WA_TPL_WELCOME`, `WA_TPL_WINBACK`, etc. (ver `server/config.js`).

Puerta por WhatsApp: el QR de la pieza puede apuntar a `https://wa.me/57<número>?text=Club%20MESA-7`. El webhook responde con el enlace a la tarjeta (cliente existente) o al registro con el celular prellenado (cliente nuevo).

## Google Wallet (opcional)

1. Crear una cuenta de emisor en la consola de Google Pay & Wallet y un service account con acceso a la API de Google Wallet.
2. Crear una clase de tipo *Loyalty* por restaurante con el ID `<GW_ISSUER_ID>.facil_<slug con guiones bajos>` (ej. `3388000000012345678.facil_arepa_y_brasa`).
3. Variables: `GW_ISSUER_ID`, `GW_SERVICE_ACCOUNT_EMAIL` y `GW_PRIVATE_KEY` (la clave privada del JSON; en Render pegarla con los saltos de línea como `\n`).

Con esto aparece el botón "Guardar en Google Wallet" en la tarjeta. El pase lleva un QR con el token de la tarjeta, que la caja lee en la pestaña "Escanear pase".

## Piezas de mesa (NFC + QR)

- En el panel, pestaña **Piezas de mesa**, cada pieza muestra su QR para imprimir y el botón para copiar la URL que se graba en el chip.
- Chips recomendados para esta fase: NTAG213 o NTAG215, grabados con la URL NFC (app NFC Tools o similar) y bloqueados contra escritura.
- El toque no suma puntos por sí solo, así que un chip clonado no permite fraude. La verificación criptográfica NTAG 424 DNA (SUN) queda para cuando el toque dé beneficios directos.

## Pendientes conocidos de esta fase

- **QR de facturas reales:** el lector (`server/lib/dian.js`) sigue el formato de pares `Clave: valor` del anexo técnico DIAN (`NitFac`, `ValTolFac`, `CUFE`…). Hay que validarlo con facturas y documentos POS de los proveedores de facturación de los locales piloto antes de lanzar; si un proveedor imprime solo la URL de consulta, la compra se confirma en caja.
- **Migración inicial escrita a mano:** `prisma/migrations/20260925000000_init` se escribió siguiendo las convenciones de Prisma porque el entorno donde se construyó no podía descargar el motor de migraciones. Verificación recomendada: en una base local vacía, correr `npx prisma migrate deploy` y luego `npx prisma migrate dev`; si `migrate dev` propone una migración nueva, hay una diferencia con `schema.prisma` que conviene revisar antes de producción.
- **Pruebas en navegador:** la API se probó de punta a punta contra PostgreSQL (registro, factura válida, repetida, de otro NIT, vencida, sin monto, tope diario, caja, premios, códigos de domicilio, panel, webhook y automatizaciones) y el frontend compila, pero no se hicieron pruebas automatizadas en navegador. La lectura con cámara (`html5-qrcode`) requiere HTTPS, que Render ya provee.
- **Verificación del celular:** el registro no confirma el número con un código; un número ya inscrito solo recibe su tarjeta por WhatsApp, así que no se exponen datos de otra persona. El código por SMS o WhatsApp queda para la fase 2.
- **Fase 2 según el documento de producto:** agente de WhatsApp para reservas y pedidos, copiloto de IA en el panel, niveles y retos, Apple Wallet, pantalla de usuarios de caja, varios números de WhatsApp por despliegue.
- **Fase 3:** acumulación automática con pago Bre-B e integraciones con POS.

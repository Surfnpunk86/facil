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

## Red de beneficios y juegos (fase 1.5)

Sobre cada compra validada, Fácil suma además de puntos y sello:

| Mecánica | Cómo funciona | Quién la configura |
| --- | --- | --- |
| Racha semanal | Semanas seguidas con al menos una compra en cualquier restaurante de la red (el cliente se reconoce por su celular). | Automática |
| Retos | Visitas, gasto acumulado o semanas seguidas dentro de un periodo; al cumplirse suman puntos extra una sola vez por cliente. | El restaurante en el panel (pestaña **Juegos y red**) o la red para una zona, con patrocinador opcional (`scripts/red.js reto`) |
| Álbum por zona | Cada restaurante de la zona es una lámina que se gana con una compra validada en la temporada. Al completar la página se crea el premio en el restaurante donde se completó y se canjea en caja. La lámina es fija por restaurante: es un logro, no azar. | La red (`scripts/red.js zona` y `asignar`) |
| Factura premiada | Cada compra validada durante un sorteo activo genera una boleta numerada. Un sorteo **solo se puede activar con el número de autorización de Coljuegos**; sin él no emite boletas. | La red (`scripts/red.js sorteo`, `activar`, `cerrar`, `exportar`, `sortear`) |
| Ranking de meseros | Cada mesero tiene un código y un QR propio (`/r/<slug>?via=qr&m=CODIGO`); los clientes que inscribe quedan a su nombre y el ranking mide inscritos y cuántos vuelven. | El restaurante en el panel |

Comandos de la red (en local o en tu computador con DATABASE_URL apuntando a la base; el detalle está en el encabezado de `scripts/red.js`):

```bash
node scripts/red.js zona --slug=ruta-del-prado --nombre="Ruta del Prado" --ciudad=Barranquilla --premio="Cena para 2" --desde=2026-10-15 --hasta=2027-01-31
node scripts/red.js asignar --zona=ruta-del-prado --restaurantes=arepa-y-brasa,cafe-del-prado
node scripts/red.js reto --zona=ruta-del-prado --titulo="Recorre la ruta" --tipo=VISITS --meta=4 --puntos=300 --patrocinador="Marca" --desde=2026-10-15 --hasta=2026-10-31
node scripts/red.js sorteo --nombre="Factura premiada de noviembre" --premio="Moto eléctrica" --desde=2026-11-01 --hasta=2026-11-30 --fecha-sorteo=2026-12-05
node scripts/red.js activar --sorteo=<id> --autorizacion="Coljuegos No. ____ de 2026" --terminos=https://…
node scripts/red.js cerrar --sorteo=<id>
node scripts/red.js exportar --sorteo=<id> > boletas.csv
node scripts/red.js sortear --sorteo=<id>     # imprime la huella SHA-256 de la lista y la boleta ganadora
node scripts/red.js estado
```

Marco legal: en Colombia todo sorteo, raspa y gana o ruleta en el que el azar elige al ganador es un juego promocional y requiere autorización previa de Coljuegos y pago de derechos de explotación, aunque la participación sea gratuita. Rachas, retos, álbum y ranking no dependen del azar. El sorteo debe hacerse con el delegado de Coljuegos o ante notario según lo que indique la autorización; `sortear` deja la selección aleatoria (`crypto.randomInt`) y la huella de la lista para el acta.

Diseño: la interfaz usa rojo `#E93423` (el del logo), negro `#0A0A0A` y blanco, con el logo de Fácil en la barra superior de todas las vistas (`web/public/logo-facil-wide.jpg`) y en grande en el inicio y el ingreso. En modo oscuro del celular el fondo pasa a negro y el logo se mantiene.

## Stack

- Node 22, Express 5, Zod, JWT para el personal.
- Prisma 7 con PostgreSQL mediante `@prisma/adapter-pg` (sin motor binario en tiempo de ejecución).
- Frontend React 19 + Vite 7 en `web/`, servido por el mismo Express desde `web/dist`.
- WhatsApp Cloud API (Meta) para mensajes; Google Wallet para el pase (opcional).
- Despliegue en Vercel: frontend estático (`web/dist`) + una función serverless (`api/index.js`) que corre el mismo Express, más un Cron Job diario definidos en `vercel.json`. PostgreSQL va aparte (Neon, Vercel Postgres u otro proveedor).

```
prisma/            schema.prisma, migraciones, datos de demostración (seed.js)
prisma.config.ts   configuración de Prisma 7 (lee DATABASE_URL)
server/
  app.js           app Express: seguridad, rutas, errores (y estáticos solo fuera de Vercel)
  index.js         arranque con app.listen() para local u hosting tradicional (no se usa en Vercel)
  routes/          public.js (cliente), staff.js (caja), panel.js (administrador), whatsapp.js (webhook),
                   cron.js (dispara las automatizaciones vía HTTP, para el Cron Job de Vercel)
  lib/             dian.js (lectura del QR de factura), rewards.js (reglas del Club), insights.js (riesgo, cumpleaños, sugerencias),
                   customers.js, whatsapp.js, wallet.js, util.js
  jobs/automations.js   cumpleaños, "te extrañamos", premio casi listo, vencimiento de premios
api/index.js       función serverless de Vercel: expone server/app.js como handler de /api/*
vercel.json        build, rewrites (SPA + /api) y el Cron Job diario
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

## Despliegue en Vercel

Vercel no corre un servidor Node permanente ni PostgreSQL: sirve `web/dist` como sitio estático,
`api/index.js` como función serverless para todo `/api/*`, y dispara el cron por HTTP. La base de
datos vive en un proveedor aparte (recomendado: [Neon](https://neon.tech) o Vercel Postgres, ambos
con "connection pooling", necesario porque cada invocación de la función puede abrir su propia
conexión).

1. Crear la base de datos (Neon, Vercel Postgres, Supabase, etc.) y copiar su **URL con pooling**
   (en Neon suele tener `-pooler` en el host; en Vercel Postgres es la que trae por defecto).
2. Subir este repositorio a GitHub y en Vercel: **Add New → Project**, elegir el repositorio.
   Vercel detecta `vercel.json` (usa `npm run vercel-build` como build y `web/dist` como salida) y
   la función `api/index.js` sin configuración extra.
3. En **Project Settings → Environment Variables** definir, para Production (y Preview si se usa):
   - `DATABASE_URL`: la URL con pooling del paso 1.
   - `DIRECT_URL` (solo Neon, opcional en Vercel): la URL directa, la que usa Prisma para migrar.
   - `PUBLIC_URL`: el dominio que asigna Vercel (`https://<proyecto>.vercel.app`) o el dominio propio.
   - `JWT_SECRET`: un valor largo y aleatorio (por ejemplo `openssl rand -hex 32`).
   - `CRON_SECRET`: otro valor aleatorio, para que solo el Cron Job de Vercel pueda llamar a
     `/api/cron/automations` (Vercel lo manda solo como `Authorization: Bearer $CRON_SECRET`).
   - Las de WhatsApp y Google Wallet, si aplican (ver secciones siguientes).
4. Crear las tablas antes o justo después del primer despliegue. `vercel-build` **no** corre
   migraciones (correrlas en cada build, incluidos los previews, es riesgoso para una base
   compartida), así que se hacen a mano contra la misma `DATABASE_URL`, por ejemplo desde local:

   ```bash
   DIRECT_URL="<la url directa de Neon>" npx prisma migrate deploy
   ```

5. Desplegar (`git push` a la rama conectada, o `vercel --prod` con la CLI de Vercel).
6. Crear el primer restaurante corriendo el script en local apuntando a la base de producción:

   ```bash
   DATABASE_URL="<la url con pooling>" node scripts/nuevo-restaurante.js --slug=arepa-y-brasa \
     --nombre="Arepa & Brasa" --nit=901234567 --ciudad=Barranquilla --admin=dueno@correo.co \
     --clave="clave-de-al-menos-10" --mesas=12 --premio="Parrillada para 2"
   ```

   Para cuentas de caja (o administradores adicionales):

   ```bash
   DATABASE_URL="<la url con pooling>" node scripts/nuevo-usuario.js --restaurante=arepa-y-brasa \
     --nombre="Caja principal" --correo=caja@restaurante.co --clave="clave-de-al-menos-10" --rol=caja
   ```

   También existe `POST /api/panel/staff` para hacerlo desde la API con la sesión del administrador.
   Cualquier restaurante puede además crear su cuenta desde `/registro` (se cierra con `ALLOW_SIGNUP=false`).
7. Probar `/healthz`, luego `/panel` con el administrador y `/r/<slug>?t=MESA-1&via=qr` desde un celular.
8. El Cron Job diario (`0 14 * * *` UTC = 9:00 a. m. en Bogotá) ya queda programado por
   `vercel.json` en cuanto se despliega; se puede ver su historial en la pestaña **Cron Jobs** del
   proyecto en Vercel, y probarlo a mano con:

   ```bash
   curl -X POST https://<tu-dominio>/api/cron/automations -H "Authorization: Bearer $CRON_SECRET"
   ```

No ejecutar `npm run seed` en producción: crea usuarios con contraseñas conocidas.

### Notas de la migración desde Render

- El código de Express no cambió de lógica: se movió a `server/app.js` (sin `app.listen`) para que
  tanto `server/index.js` (local) como `api/index.js` (Vercel) lo reutilicen.
- En Vercel, el archivo estático lo sirve la CDN de Vercel directamente desde `web/dist`; la
  función serverless solo atiende `/api/*` (por eso `server/app.js` no monta los estáticos cuando
  detecta la variable de entorno `VERCEL`).
- El Cron Job de Render (`node server/jobs/automations.js`) se reemplazó por el endpoint
  `POST/GET /api/cron/automations` (`server/routes/cron.js`), que Vercel llama según el `schedule`
  en `vercel.json`; la lógica de `server/jobs/automations.js` no cambió.
- Se quitó `render.yaml`. Si en algún momento se vuelve a necesitar Render (por ejemplo, para un
  proceso de fondo permanente que Vercel no soporta bien), se puede recrear con
  `buildCommand: npm run build`, `startCommand: npm start` y un Cron Job separado con
  `node server/jobs/automations.js`, tal como estaba antes.

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
3. Variables: `GW_ISSUER_ID`, `GW_SERVICE_ACCOUNT_EMAIL` y `GW_PRIVATE_KEY` (la clave privada del JSON; en Vercel pegarla con los saltos de línea como `\n`, igual que antes en Render).

Con esto aparece el botón "Guardar en Google Wallet" en la tarjeta. El pase lleva un QR con el token de la tarjeta, que la caja lee en la pestaña "Escanear pase".

## Piezas de mesa (NFC + QR)

- En el panel, pestaña **Piezas de mesa**, cada pieza muestra su QR para imprimir y el botón para copiar la URL que se graba en el chip.
- Chips recomendados para esta fase: NTAG213 o NTAG215, grabados con la URL NFC (app NFC Tools o similar) y bloqueados contra escritura.
- El toque no suma puntos por sí solo, así que un chip clonado no permite fraude. La verificación criptográfica NTAG 424 DNA (SUN) queda para cuando el toque dé beneficios directos.

## Pendientes conocidos de esta fase

- **QR de facturas reales:** el lector (`server/lib/dian.js`) sigue el formato de pares `Clave: valor` del anexo técnico DIAN (`NitFac`, `ValTolFac`, `CUFE`…). Hay que validarlo con facturas y documentos POS de los proveedores de facturación de los locales piloto antes de lanzar; si un proveedor imprime solo la URL de consulta, la compra se confirma en caja.
- **Migraciones escritas a mano:** `prisma/migrations/20260925000000_init` y `20261006000000_red_y_juegos` se escribieron siguiendo las convenciones de Prisma porque el entorno donde se construyeron no podía descargar el motor de migraciones. Ambas se aplicaron sin errores sobre PostgreSQL 16 vacío. Verificación recomendada: en una base local vacía, correr `npx prisma migrate deploy` y luego `npx prisma migrate dev`; si `migrate dev` propone una migración nueva, hay una diferencia con `schema.prisma` que conviene revisar antes de producción.
- **Retos de marca por producto:** el QR de la factura no trae el detalle de productos, así que los retos patrocinados se miden por visitas, gasto o racha. Retos del tipo "pide la bebida X" requieren integración con el POS (fase 3).
- **Pruebas:** la API se probó de punta a punta contra PostgreSQL (registro, factura válida, repetida, de otro NIT, vencida, sin monto, tope diario, caja, premios, códigos de domicilio, panel, webhook, automatizaciones, racha, retos de restaurante y de zona, álbum completo, boletas solo con sorteo autorizado, sorteo y exportación) y las vistas principales se revisaron en Chromium a ancho de celular y de escritorio. La lectura con cámara (`html5-qrcode`) requiere HTTPS, que Vercel ya provee y que falta probar en celulares reales.
- **Verificación del celular:** el registro no confirma el número con un código; un número ya inscrito solo recibe su tarjeta por WhatsApp, así que no se exponen datos de otra persona. El código por SMS o WhatsApp queda para la fase 2.
- **Fase 2 según el documento de producto:** agente de WhatsApp para reservas y pedidos, copiloto de IA en el panel, niveles y retos, Apple Wallet, pantalla de usuarios de caja, varios números de WhatsApp por despliegue.
- **Fase 3:** acumulación automática con pago Bre-B e integraciones con POS.

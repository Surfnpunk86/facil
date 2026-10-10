// Punto de entrada para Node "tradicional" (local con `npm run dev`, o cualquier host que no sea
// Vercel). En Vercel, api/index.js importa server/app.js directamente y no pasa por aquí.
import app from './app.js';
import { config } from './config.js';

app.listen(config.port, () => console.log(`Fácil escuchando en ${config.publicUrl} (puerto ${config.port})`));

export default app;

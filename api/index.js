// Función serverless de Vercel: todo /api/* (ver rewrites en vercel.json) llega aquí y lo maneja
// el mismo Express app que se usa en local/Render (server/app.js). No llamamos a app.listen(): en
// Vercel cada invocación entrega (req, res) directamente, y Express funciona como handler.
import app from '../server/app.js';

// Vercel parsea el body por defecto antes de que Express lo vea. Lo desactivamos para que
// express.json() y, sobre todo, express.raw() del webhook de WhatsApp (que necesita el cuerpo sin
// procesar para validar la firma de Meta) sigan funcionando igual que en local/Render.
export const config = {
  api: {
    bodyParser: false
  }
};

export default app;

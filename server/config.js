// Configuración leída de variables de entorno. Ver .env.example.
const env = process.env;

export const config = {
  port: Number(env.PORT || 3000),
  isProd: env.NODE_ENV === 'production',
  publicUrl: (env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, ''),
  jwtSecret: env.JWT_SECRET || 'dev-only-secret-change-me',
  tz: 'America/Bogota',
  consentVersion: env.CONSENT_VERSION || '2026-09',

  whatsapp: {
    token: env.WA_TOKEN || '',
    phoneNumberId: env.WA_PHONE_NUMBER_ID || '',
    verifyToken: env.WA_VERIFY_TOKEN || '',
    appSecret: env.WA_APP_SECRET || '',
    apiVersion: env.WA_API_VERSION || 'v21.0',
    lang: env.WA_TEMPLATE_LANG || 'es',
    // Nombres de plantillas aprobadas en Meta. Cada una recibe los parámetros indicados en el README.
    templates: {
      CARD_LINK: env.WA_TPL_CARD_LINK || 'facil_tarjeta',
      WELCOME: env.WA_TPL_WELCOME || 'facil_bienvenida',
      PURCHASE: env.WA_TPL_PURCHASE || 'facil_compra',
      WINBACK: env.WA_TPL_WINBACK || 'facil_te_extranamos',
      BIRTHDAY: env.WA_TPL_BIRTHDAY || 'facil_cumpleanos',
      NEAR_REWARD: env.WA_TPL_NEAR_REWARD || 'facil_premio_cerca',
      LOW_RATING_ALERT: env.WA_TPL_LOW_RATING || 'facil_alerta_calificacion'
    },
    // Restaurante que atiende este número de WhatsApp (MVP: un número por despliegue o por restaurante).
    defaultRestaurantSlug: env.WA_DEFAULT_RESTAURANT_SLUG || ''
  },

  googleWallet: {
    issuerId: env.GW_ISSUER_ID || '',
    serviceAccountEmail: env.GW_SERVICE_ACCOUNT_EMAIL || '',
    // Clave privada del service account; en Render se pega con los saltos de línea como \n.
    privateKey: (env.GW_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  }
};

export const whatsappEnabled = () => Boolean(config.whatsapp.token && config.whatsapp.phoneNumberId);
export const googleWalletEnabled = () =>
  Boolean(config.googleWallet.issuerId && config.googleWallet.serviceAccountEmail && config.googleWallet.privateKey);

if (config.isProd && config.jwtSecret === 'dev-only-secret-change-me') {
  throw new Error('JWT_SECRET es obligatorio en producción');
}

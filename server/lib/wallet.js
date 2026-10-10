// Pase de Google Wallet (tipo "loyalty"). El enlace "Guardar en Google Wallet" es un JWT firmado
// con la cuenta de servicio del emisor; la clase del programa se crea en la consola de Google Pay & Wallet
// con el ID <issuerId>.facil_<slug>. Apple Wallet queda para una fase posterior (requiere certificado de Apple).
import jwt from 'jsonwebtoken';
import { config, googleWalletEnabled } from '../config.js';

export function googleWalletSaveUrl({ restaurant, customer }) {
  if (!googleWalletEnabled()) return null;
  const { issuerId, serviceAccountEmail, privateKey } = config.googleWallet;
  const classId = `${issuerId}.facil_${restaurant.slug.replace(/[^a-z0-9_]/gi, '_')}`;
  const objectId = `${issuerId}.${customer.id}`;

  const loyaltyObject = {
    id: objectId,
    classId,
    state: 'ACTIVE',
    accountId: customer.phone,
    accountName: customer.name || 'Cliente',
    loyaltyPoints: { label: 'Puntos', balance: { int: customer.points } },
    secondaryLoyaltyPoints: { label: 'Sellos', balance: { string: `${customer.stamps}/${restaurant.stampsGoal}` } },
    barcode: { type: 'QR_CODE', value: customer.cardToken, alternateText: 'Muéstralo en caja' },
    linksModuleData: { uris: [{ uri: `${config.publicUrl}/c/${customer.cardToken}`, description: 'Ver mi tarjeta' }] }
  };

  const token = jwt.sign(
    {
      iss: serviceAccountEmail,
      aud: 'google',
      typ: 'savetowallet',
      origins: [config.publicUrl],
      payload: { loyaltyObjects: [loyaltyObject] }
    },
    privateKey,
    { algorithm: 'RS256' }
  );
  return `https://pay.google.com/gp/v/save/${token}`;
}

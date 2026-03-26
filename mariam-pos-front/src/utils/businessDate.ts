/** Alineado con mariam-pos-web-api (día civil en México). */
export const BUSINESS_TZ = 'America/Mexico_City';

/** Hoy como YYYY-MM-DD en la zona de negocio. */
export function getBusinessTodayYYYYMMDD(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: BUSINESS_TZ });
}

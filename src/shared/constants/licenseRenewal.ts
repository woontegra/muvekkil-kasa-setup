/** Woontegra Website masaüstü lisans yenileme link API (sunucu tarafı token). */
export const DESKTOP_LICENSE_RENEWAL_LINK_URL =
  process.env.WOONTEGRA_RENEWAL_LINK_URL?.trim() ||
  "https://www.woontegra.com/api/public/desktop-license/renewal-link";

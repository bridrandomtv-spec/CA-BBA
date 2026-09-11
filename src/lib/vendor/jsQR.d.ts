// Types du décodeur QR vendorisé (src/lib/vendor/jsQR.js, licence MIT).
// TypeScript résout l'import '../lib/vendor/jsQR.js' vers ce fichier :
// les exports doivent donc être au niveau racine du module.
export interface JsQrResult {
  data: string;
  location: unknown;
}

declare function jsQR(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): JsQrResult | null;

export default jsQR;

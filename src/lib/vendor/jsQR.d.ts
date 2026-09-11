// Typage du décodeur QR vendorisé (src/lib/vendor/jsQR.js, licence MIT).
// Déclaration ambiante par motif : l'import '../lib/vendor/jsQR.js' la
// satisfait sans toucher au tsconfig (allowJs reste désactivé).
declare module '*vendor/jsQR.js' {
  interface JsQrResult {
    data: string;
    location: unknown;
  }
  function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
  ): JsQrResult | null;
  export default jsQR;
}

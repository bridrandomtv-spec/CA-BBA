// Types du décodeur QR vendorisé (src/lib/vendor/jsQR.esm.js, MIT).
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

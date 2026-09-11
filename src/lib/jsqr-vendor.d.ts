// Types du jsQR vendored (UMD) pour TypeScript.
export interface JsQrResult {
  code: string | null;
}
declare function jsQR(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: string },
): JsQrResult | null;
export default jsQR;

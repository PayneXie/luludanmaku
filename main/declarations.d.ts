declare module 'brotli' {
  export function decompress(buffer: Buffer | Uint8Array, fileSize?: number): Uint8Array;
  export function compress(buffer: Buffer | Uint8Array, options?: any): Uint8Array;
}

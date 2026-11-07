/** Mutable so tests can temporarily tighten caps without DI. */
export const APKG_LIMITS = {
  maxCompressedBytes: 100 * 1024 * 1024,
  maxZipEntries: 20_000,
  maxUncompressedBytes: 500 * 1024 * 1024
}

export function assertApkgCompressedSize(byteLength: number): void {
  if (byteLength > APKG_LIMITS.maxCompressedBytes) {
    throw new Error(
      `This .apkg is too large (max ${Math.floor(APKG_LIMITS.maxCompressedBytes / (1024 * 1024))} MB).`
    )
  }
}

export function assertApkgEntryCount(entryCount: number): void {
  if (entryCount > APKG_LIMITS.maxZipEntries) {
    throw new Error(
      `This .apkg has too many files (max ${APKG_LIMITS.maxZipEntries}).`
    )
  }
}

export function trackUncompressed(total: { bytes: number }, add: number): void {
  total.bytes += add
  if (total.bytes > APKG_LIMITS.maxUncompressedBytes) {
    throw new Error(
      `This .apkg expands to more than ${Math.floor(APKG_LIMITS.maxUncompressedBytes / (1024 * 1024))} MB uncompressed.`
    )
  }
}

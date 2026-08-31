const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

const readAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onerror = () => reject(new Error('The browser could not read this image.'))
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('The selected file is not an image.'))
  reader.readAsDataURL(blob)
})

/** Validate, downscale to ≤2048px, and re-encode a camera capture as a JPEG data URL. */
export const prepareImage = async (file: File): Promise<string> => {
  if (!acceptedImageTypes.has(file.type)) throw new Error('Use a JPEG, PNG, or WebP image.')
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image must be 5 MB or smaller.')
  if (typeof createImageBitmap !== 'function') return readAsDataUrl(file)

  let bitmap: ImageBitmap | undefined
  try {
    bitmap = await createImageBitmap(file)
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) return readAsDataUrl(file)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const encoded = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    return encoded ? readAsDataUrl(encoded) : readAsDataUrl(file)
  } catch {
    return readAsDataUrl(file)
  } finally {
    bitmap?.close()
  }
}

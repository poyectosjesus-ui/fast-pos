/**
 * Utilidades para el procesamiento de imágenes en el cliente.
 * 
 * Objetivo (Fase 13.1): Reducir el impacto de almacenamiento en IndexedDB
 * comprimiendo y redimensionando fotos de productos antes de guardarlas.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Recibe un archivo de imagen y devuelve una cadena Base64 optimizada.
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = { maxWidth: 512, maxHeight: 512, quality: 0.7 }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calcular nuevas dimensiones manteniendo el aspect ratio
        if (width > height) {
          if (width > (options.maxWidth || 512)) {
            height *= (options.maxWidth || 512) / width;
            width = options.maxWidth || 512;
          }
        } else {
          if (height > (options.maxHeight || 512)) {
            width *= (options.maxHeight || 512) / height;
            height = options.maxHeight || 512;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("No se pudo obtener el contexto del canvas"));
          return;
        }

        // Dibujar y comprimir
        ctx.drawImage(img, 0, 0, width, height);
        
        // Intentar WebP si el navegador lo soporta, si no JPEG
        const dataUrl = canvas.toDataURL('image/webp', options.quality || 0.7);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

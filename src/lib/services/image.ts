/**
 * IMAGE SERVICE — Fast-POS 2.0
 *
 * Responsabilidad: Gestionar imágenes de productos en el bucket local del filesystem.
 *   Las imágenes viven en {userData}/images/{uuid}.webp — NO en la base de datos.
 *   La DB solo guarda el nombre del archivo (ej: "abc123.webp").
 *
 * Fuente de Verdad: ARCHITECTURE.md §4, CODING_STANDARDS.md §4
 *
 * FLUJO:
 *   1. El componente obtiene el base64 de Canvas API (ya comprimido <40KB)
 *   2. ImageService.save(base64) → genera UUID → llama electronAPI.saveImage()
 *   3. Main Process escribe el archivo en disco y retorna el filename
 *   4. El componente guarda ese filename en ProductSchema.image
 *   5. Para mostrar: ImageService.getUrl(filename) → file:// URL
 */

import { v4 as uuidv4 } from "uuid";

// Helper tipado — igual que en los otros servicios
function getAPI() {
  if (typeof window === "undefined") return null;
  return (
    window as Window & {
      electronAPI?: {
        saveImage: (base64: string, filename: string) => Promise<{ success: boolean; filename?: string; error?: string }>;
        getImageUrl: (filename: string) => Promise<{ success: boolean; url?: string; error?: string }>;
        deleteImage: (filename: string) => Promise<{ success: boolean; error?: string }>;
      };
    }
  ).electronAPI ?? null;
}

export const ImageService = {
  /**
   * Guarda una imagen en el bucket local.
   * Recibe el base64 del canvas (con o sin prefijo dataURL).
   * Genera un UUID para el nombre de archivo.
   *
   * @returns El nombre del archivo guardado (ej: "abc123.webp") para guardar en la DB.
   * @throws Error si el Main Process no pudo escribir el archivo.
   */
  async save(base64: string): Promise<string> {
    const api = getAPI();
    if (!api) throw new Error("Fuera del entorno Electron – no se pueden guardar imágenes.");

    const filename = `${uuidv4()}.webp`;
    const result = await api.saveImage(base64, filename);

    if (!result.success) {
      throw new Error(result.error ?? "No se pudo guardar la imagen en disco.");
    }
    return filename;
  },

  /**
   * Retorna la URL file:// absoluta de una imagen por su nombre de archivo.
   * Necesario porque el Renderer no conoce la ruta de userData.
   *
   * @param filename - Nombre del archivo (ej: "abc123.webp") o undefined/null
   * @returns URL file:// o null si el archivo no existe o filename es falsy
   */
  async getUrl(filename: string | undefined | null): Promise<string | null> {
    if (!filename) return null;
    const api = getAPI();
    if (!api) return null;
    const res = await api.getImageUrl(filename);
    if (!res.success || !res.url) return null;
    return res.url;
  },

  /**
   * Elimina la imagen del disco al borrar un producto.
   * Si filename es undefined/null o el archivo no existe, retorna sin error.
   */
  async delete(filename: string | undefined | null): Promise<void> {
    if (!filename) return;
    const api = getAPI();
    if (!api) return;
    const result = await api.deleteImage(filename);
    if (!result.success && result.error) {
      // Log pero no relanzar — una imagen huérfana no es crítica
      console.warn("[ImageService] No se pudo borrar la imagen:", result.error);
    }
  },
};

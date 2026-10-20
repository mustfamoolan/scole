/**
 * Client-side Image Optimization Utility for Institute Logos & Assets.
 * Resizes, centers, and compresses images using HTML5 Canvas to produce crisp, lightweight WebP/JPEG files.
 */

export interface OptimizedImageResult {
  file: File;
  dataUrl: string;
  originalSize: number;
  optimizedSize: number;
  width: number;
  height: number;
}

export const optimizeImageFile = async (
  file: File,
  maxWidth = 512,
  maxHeight = 512,
  quality = 0.88
): Promise<OptimizedImageResult> => {
  return new Promise((resolve, reject) => {
    // If it's an SVG, SVG is already vector and optimal, no canvas compression needed
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          file,
          dataUrl: reader.result as string,
          originalSize: file.size,
          optimizedSize: file.size,
          width: 512,
          height: 512,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;

        // Scale down keeping aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get 2D canvas context'));
          return;
        }

        // Crisp image smoothing settings
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Prefer modern WebP format with PNG fallback for transparency
        const hasTransparency = file.type === 'image/png';
        const targetMime = hasTransparency ? 'image/png' : 'image/webp';

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas image compression failed'));
              return;
            }

            const cleanFileName = file.name.replace(/\.[^/.]+$/, '') + (hasTransparency ? '.png' : '.webp');
            const optimizedFile = new File([blob], cleanFileName, {
              type: targetMime,
              lastModified: Date.now(),
            });

            const dataUrl = canvas.toDataURL(targetMime, quality);

            resolve({
              file: optimizedFile,
              dataUrl,
              originalSize: file.size,
              optimizedSize: blob.size,
              width,
              height,
            });
          },
          targetMime,
          quality
        );
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
};

export async function fileToWebpDataUrlUnderLimit(
  file: File,
  options: { maxBytes: number; maxLongEdge?: number } = { maxBytes: 100 * 1024 },
): Promise<string> {
  const maxBytes = options.maxBytes;
  const maxLongEdge = options.maxLongEdge ?? 1600;
  const image = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas not supported');

  let width = image.width;
  let height = image.height;
  const longestSide = Math.max(width, height);
  if (longestSide > maxLongEdge) {
    const scale = maxLongEdge / longestSide;
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));
  }

  const qualityLevels = [0.9, 0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.34, 0.26];
  let best: Blob | null = null;

  for (let pass = 0; pass < 4; pass += 1) {
    canvas.width = width;
    canvas.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of qualityLevels) {
      // eslint-disable-next-line no-await-in-loop
      const blob = await canvasToWebpBlob(canvas, quality);
      if (blob.size <= maxBytes) return blobToDataUrl(blob);
      if (!best || blob.size < best.size) best = blob;
    }

    width = Math.max(280, Math.round(width * 0.85));
    height = Math.max(280, Math.round(height * 0.85));
  }

  if (!best) throw new Error('Image conversion failed');
  if (best.size > maxBytes) throw new Error(`Could not compress this image under ${Math.round(maxBytes / 1024)}KB.`);
  return blobToDataUrl(best);
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read selected image.'));
    };
    image.src = objectUrl;
  });
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not encode image as WebP.'));
        return;
      }
      resolve(blob);
    }, 'image/webp', quality);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not finalize image encoding.'));
    reader.readAsDataURL(blob);
  });
}

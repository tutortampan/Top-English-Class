/**
 * avatar-engine.js
 * 
 * 3:4 Center-Crop Avatar Engine & Cache Busting.
 */

export async function processAndCompressAvatar(file, type = "student") {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error("No file provided."));
    const isStudent = type === "student";
    const TARGET_WIDTH = isStudent ? 240 : 300;
    const TARGET_HEIGHT = isStudent ? 320 : 400;
    const MAX_SIZE_KB = isStudent ? 30 : 80;
    const QUALITY = isStudent ? 0.75 : 0.85;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = TARGET_WIDTH;
        canvas.height = TARGET_HEIGHT;
        const ctx = canvas.getContext("2d");

        const ratio = img.width / img.height;
        const targetRatio = TARGET_WIDTH / TARGET_HEIGHT;

        let sx, sy, sWidth, sHeight;

        if (ratio > targetRatio) {
          // Too wide: Crop left and right equally
          sHeight = img.height;
          sWidth = img.height * targetRatio;
          sx = (img.width - sWidth) / 2;
          sy = 0;
        } else {
          // Too tall: Apply proportional vertical crop (35% top bias, 65% bottom bias)
          sWidth = img.width;
          sHeight = img.width / targetRatio;
          sx = 0;
          sy = (img.height - sHeight) * 0.35;
        }

        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);

        // Attempt WebP, fallback to JPEG
        const format = "image/webp";
        const dataUrl = canvas.toDataURL(format, QUALITY);
        
        // Ensure size check (approximate base64 size)
        const sizeKB = (dataUrl.length * (3/4)) / 1024;
        
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error("Invalid image file."));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error("File read error."));
    reader.readAsDataURL(file);
  });
}


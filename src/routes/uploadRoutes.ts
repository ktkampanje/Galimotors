import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { inquiryRateLimit } from '../middleware/security';

const router = Router();

// Check if Cloudinary is configured
const isCloudinaryConfigured = () => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

// Image upload endpoint. Authenticated: an open upload route would let
// anyone on the internet fill the Cloudinary account (the only image store,
// free tier) until the quota died.
router.post('/images', authenticate, async (req, res) => {
  try {
    const { images, folderPath } = req.body; // Array of base64 data URIs, optional folder

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'Images array required' });
    }

    if (images.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 images allowed' });
    }

    // Only inline image data. Cloudinary's uploader also accepts URLs —
    // without this check the endpoint could be told to fetch arbitrary
    // remote content into the account.
    if (!images.every((img: unknown) => typeof img === 'string' && img.startsWith('data:image/'))) {
      return res.status(400).json({ error: 'Each image must be a base64-encoded image (data:image/...)' });
    }

    if (!isCloudinaryConfigured()) {
      // Fail loudly. The old placeholder fallback silently attached random
      // stock photos to real listings when env vars were missing.
      console.error('❌ Upload rejected: CLOUDINARY_* env vars are not set.');
      return res.status(503).json({ error: 'Image storage is not configured on the server. Add the Cloudinary environment variables.' });
    }

    const cloudinary = require('cloudinary').v2;

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    const folder = folderPath || 'galimotors/cars';

    // Upload each image to Cloudinary with compression
    const uploadPromises = images.map((base64Image: string, index: number) => {
      return cloudinary.uploader.upload(base64Image, {
        folder: folder,
        // 1600px stored ceiling: nothing on the site renders wider than
        // ~1366, and the free Cloudinary tier is the only image store.
        transformation: [
          { width: 1600, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ]
      }).then((result: any) => ({
        url: result.secure_url,
        isPrimary: index === 0
      }));
    });

    const uploadedImages = await Promise.all(uploadPromises);
    return res.json({ images: uploadedImages, source: 'cloudinary' });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

// Proof-of-payment receipt upload — the ONE public upload in the system.
// Guests book viewings by design, so this cannot require a login; instead it
// is boxed in tightly: a single data-URI image per request, ~3MB decoded cap,
// the same per-IP rate limit as inquiries, and a fixed receipts folder with
// a smaller stored size. The general /images endpoint stays admin-only.
router.post('/receipt', inquiryRateLimit, async (req, res) => {
  try {
    const { image } = req.body;

    const isPdf = typeof image === 'string' && image.startsWith('data:application/pdf');
    if (typeof image !== 'string' || (!image.startsWith('data:image/') && !isPdf)) {
      return res.status(400).json({ error: 'Receipt must be an image or a PDF (data URI)' });
    }
    // base64 inflates ~4/3: 4.2M chars ≈ 3.1MB decoded.
    if (image.length > 4_200_000) {
      return res.status(413).json({ error: 'Receipt image is too large. Please use a photo under 3MB.' });
    }

    if (!isCloudinaryConfigured()) {
      console.error('❌ Receipt upload rejected: CLOUDINARY_* env vars are not set.');
      return res.status(503).json({ error: 'Image storage is not configured on the server. Add the Cloudinary environment variables.' });
    }

    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const result = await cloudinary.uploader.upload(image, {
      folder: 'galimotors/receipts',
      ...(isPdf
        ? { resource_type: 'image' as const, format: 'pdf' }
        // Image receipts are read by a human once — 1200px q_auto keeps
        // them legible and small on the free tier.
        : { transformation: [{ width: 1200, crop: 'limit' }, { quality: 'auto:good' }, { fetch_format: 'auto' }] }),
    });

    return res.json({ url: result.secure_url });
  } catch (error) {
    console.error('Receipt upload error:', error);
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});

export default router;

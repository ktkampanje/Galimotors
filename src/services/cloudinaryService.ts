import cloudinary from 'cloudinary';

// Configure Cloudinary
cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Extract public_id from Cloudinary URL
 * Example: https://res.cloudinary.com/galimotors/image/upload/v1234/galimotors/cars/abc.jpg
 * Returns: galimotors/cars/abc
 */
function extractPublicId(url: string): string | null {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('Error extracting public_id from URL:', url, error);
    return null;
  }
}

/**
 * Delete a single image from Cloudinary
 */
export async function deleteCloudinaryImage(url: string): Promise<boolean> {
  try {
    // Skip if Cloudinary not configured
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      console.log('⚠️  Cloudinary not configured - skipping image deletion');
      return true;
    }

    // Skip if URL is not from Cloudinary
    if (!url.includes('cloudinary.com')) {
      console.log('⚠️  Image not from Cloudinary - skipping deletion:', url);
      return true;
    }

    const publicId = extractPublicId(url);
    if (!publicId) {
      console.error('❌ Failed to extract public_id from URL:', url);
      return false;
    }

    const result = await cloudinary.v2.uploader.destroy(publicId);
    
    if (result.result === 'ok' || result.result === 'not found') {
      console.log(`✅ Deleted Cloudinary image: ${publicId}`);
      return true;
    } else {
      console.error(`❌ Failed to delete Cloudinary image: ${publicId}`, result);
      return false;
    }
  } catch (error) {
    console.error('❌ Error deleting Cloudinary image:', url, error);
    return false;
  }
}

/**
 * Delete multiple images from Cloudinary
 */
export async function deleteCloudinaryImages(urls: string[]): Promise<number> {
  let successCount = 0;

  for (const url of urls) {
    const success = await deleteCloudinaryImage(url);
    if (success) successCount++;
  }

  console.log(`✅ Deleted ${successCount}/${urls.length} Cloudinary images`);
  return successCount;
}

export default {
  deleteImage: deleteCloudinaryImage,
  deleteImages: deleteCloudinaryImages
};

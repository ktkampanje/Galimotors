import type { SyntheticEvent } from 'react';

/**
 * Image optimization helpers.
 *
 * Cloudinary URLs get transformation parameters injected so list/detail pages
 * load smaller images. Non-Cloudinary URLs are returned unchanged. Missing or
 * broken URLs fall back to an inline SVG so image cards never render blank.
 */

export interface CarImage {
  url?: string | null;
  isPrimary?: boolean;
}

const CLOUDINARY_REGEX = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)/;

export const FALLBACK_CAR_IMAGE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">
      <rect width="800" height="500" fill="#f3f4f6"/>
      <g fill="none" stroke="#9ca3af" stroke-width="18" stroke-linecap="round" stroke-linejoin="round">
        <path d="M180 315h440l-38-92c-13-31-43-51-77-51H295c-34 0-64 20-77 51l-38 92Z"/>
        <path d="M226 315v42h348v-42"/>
        <circle cx="285" cy="357" r="38"/>
        <circle cx="515" cy="357" r="38"/>
        <path d="M280 218h240"/>
      </g>
      <text x="400" y="430" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#6b7280">GaliMotors</text>
    </svg>
  `);

export function getCloudinaryThumbnail(
  url: string | null | undefined,
  width: number = 400,
  quality: string = 'auto:good'
): string {
  if (!url) return FALLBACK_CAR_IMAGE;

  const trimmedUrl = url.trim();
  if (!trimmedUrl) return FALLBACK_CAR_IMAGE;

  const match = trimmedUrl.match(CLOUDINARY_REGEX);
  if (!match) return trimmedUrl;

  const [, base, rest] = match;
  const transforms = `c_fill,w_${width},q_${quality},f_auto`;
  return `${base}${transforms}/${rest}`;
}

export function getCloudinaryMedium(url: string | null | undefined): string {
  return getCloudinaryThumbnail(url, 800, 'auto:good');
}

export function getCloudinaryFull(url: string | null | undefined): string {
  // 1600 matches the stored ceiling (uploadRoutes) — requesting 1920 would
  // make Cloudinary upscale.
  return getCloudinaryThumbnail(url, 1600, 'auto:best');
}

export function getPrimaryImage(images?: CarImage[] | null): CarImage | null {
  if (!images?.length) return null;
  return images.find((img) => img.isPrimary && img.url) || images.find((img) => img.url) || null;
}

export function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
  const img = event.currentTarget;
  if (img.src !== FALLBACK_CAR_IMAGE) {
    img.src = FALLBACK_CAR_IMAGE;
  }
  img.classList.remove('opacity-0');
  img.classList.add('opacity-100');
}

export function revealImage(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.classList.remove('opacity-0');
  event.currentTarget.classList.add('opacity-100');
}

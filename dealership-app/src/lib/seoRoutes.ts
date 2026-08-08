// SEO-friendly URL generation and parsing

export interface CarUrlData {
  id: string;
  maker?: { name: string };
  model?: { name: string };
  district?: string;
  locationCity?: string;
}

// Generate SEO-friendly slug from text
export const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
};

// Generate SEO-friendly URL for a car
export const generateCarUrl = (car: CarUrlData): string => {
  const makerSlug = car.maker?.name ? generateSlug(car.maker.name) : 'unknown';
  const modelSlug = car.model?.name ? generateSlug(car.model.name) : 'unknown';
  const uuidShort = car.id.split('-')[0]; // First part of UUID for uniqueness

  return `/cars/${makerSlug}/${modelSlug}/${uuidShort}`;
};

// Parse SEO URL to extract car ID
export const parseCarUrl = (_makerSlug: string, _modelSlug: string, uuidShort: string): string => {
  // In a real implementation, you'd query the database to find the full UUID
  // For now, we'll assume the uuidShort is enough to identify the car
  return uuidShort;
};

// Generate canonical URL for a car (full domain)
export const generateCanonicalUrl = (car: CarUrlData, baseUrl: string = 'https://galimotor.com'): string => {
  const path = generateCarUrl(car);
  return `${baseUrl}${path}`;
};

// Generate breadcrumb data for a car
export const generateBreadcrumbs = (car: CarUrlData) => {
  return [
    { name: 'Home', url: '/' },
    { name: 'Cars', url: '/cars' },
    { name: car.maker?.name || 'Cars', url: `/cars?maker=${car.maker?.name || ''}` },
    { name: `${car.maker?.name || ''} ${car.model?.name || ''}`.trim(), url: generateCarUrl(car) }
  ];
};

// Generate meta description for a car
interface SeoCarData extends CarUrlData {
  title?: string;
  year?: number | string;
  basePrice?: number | string;
  platformInspectedBadge?: boolean;
  images?: Array<{ url?: string; isPrimary?: boolean }>;
  status?: string;
  bodyType?: { name?: string };
  mileage?: number;
  fuelType?: string;
  transmission?: string;
}

export const generateMetaDescription = (car: SeoCarData): string => {
  const maker = car.maker?.name || 'Unknown';
  const model = car.model?.name || 'Model';
  const year = car.year || 'Used';
  const price = car.basePrice ? `MK ${Number(car.basePrice).toLocaleString()}` : 'Contact for price';
  const location = car.district || car.locationCity || 'Malawi';

  return `${year} ${maker} ${model} for sale in ${location}. Price: ${price}. ${car.platformInspectedBadge ? 'Platform inspected.' : ''} Contact GaliMotors for viewing.`.substring(0, 155);
};

// Generate OpenGraph data for social sharing
export const generateOpenGraphData = (car: SeoCarData, baseUrl: string = 'https://galimotor.com') => {
  const canonicalUrl = generateCanonicalUrl(car, baseUrl);
  const description = generateMetaDescription(car);
  const primaryImage = car.images?.find((img) => img.isPrimary)?.url ||
                      car.images?.[0]?.url ||
                      `${baseUrl}/default-car-image.jpg`;

  return {
    title: car.title,
    description,
    url: canonicalUrl,
    type: 'product',
    image: primaryImage,
    siteName: 'GaliMotors - Malawi Car Marketplace'
  };
};

// Generate JSON-LD structured data for a car
export const generateCarJsonLD = (car: SeoCarData, baseUrl: string = 'https://galimotor.com') => {
  const canonicalUrl = generateCanonicalUrl(car, baseUrl);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': canonicalUrl,
    name: car.title,
    description: generateMetaDescription(car),
    url: canonicalUrl,
    image: car.images?.map((img) => img.url).filter(Boolean) || [],
    brand: {
      '@type': 'Brand',
      name: car.maker?.name || 'Unknown'
    },
    model: car.model?.name,
    vehicleModelDate: car.year?.toString(),
    mileageFromOdometer: car.mileage ? {
      '@type': 'QuantitativeValue',
      value: car.mileage,
      unitCode: 'KMT'
    } : undefined,
    fuelType: car.fuelType,
    vehicleTransmission: car.transmission,
    offers: {
      '@type': 'Offer',
      price: car.basePrice?.toString() || '0',
      priceCurrency: 'MWK',
      availability: car.status === 'AVAILABLE' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'GaliMotors',
        url: baseUrl
      }
    },
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Body Type',
        value: car.bodyType?.name
      },
      {
        '@type': 'PropertyValue',
        name: 'Location',
        value: car.district || car.locationCity
      }
    ].filter(prop => prop.value) // Remove undefined values
  };
};

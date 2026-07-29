import prisma from '../lib/prisma';
import { getAdminWhatsApp } from '../lib/businessContact';
import { getSiteUrl } from '../lib/siteUrl';

interface SitemapUrl {
  url: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

export class SEOService {
  // Always the DEPLOYED host. The old constructor default hardcoded
  // https://galimotors.com — a domain the live site does not use, so every
  // sitemap/canonical/OG URL pointed somewhere else entirely.
  private get baseUrl(): string {
    return getSiteUrl();
  }

  /**
   * Social-preview version of a car photo: WhatsApp/Facebook want ~1200×630.
   * Cloudinary does the crop on the fly; non-Cloudinary URLs pass through.
   */
  toOgImage(url: string | undefined | null): string {
    if (!url) return `${this.baseUrl}/og-image.png`;
    if (url.includes('/upload/') && !url.includes('/upload/w_')) {
      return url.replace('/upload/', '/upload/w_1200,h_630,c_fill,q_auto/');
    }
    return url;
  }

  // Generate SEO-friendly slug from car data
  generateCarSlug(car: any): string {
    const makerSlug = car.maker?.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'unknown';
    const modelSlug = car.model?.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'unknown';
    const uuidShort = car.id.split('-')[0]; // First part of UUID
    return `${makerSlug}/${modelSlug}/${uuidShort}`;
  }

  // Generate canonical URL for a car
  generateCarCanonicalUrl(car: any): string {
    const slug = this.generateCarSlug(car);
    return `${this.baseUrl}/cars/${slug}`;
  }

  // Generate dynamic meta description for car
  generateCarMetaDescription(car: any): string {
    const maker = car.maker?.name || 'Unknown';
    const model = car.model?.name || 'Model';
    const year = car.year || 'Used';
    const price = car.basePrice ? `MK ${Number(car.basePrice).toLocaleString()}` : 'Contact for price';
    const location = car.district || 'Malawi';
    
    return `${year} ${maker} ${model} for sale in ${location}. Price: ${price}. ${car.platformInspectedBadge ? 'Platform inspected.' : ''} Contact GaliMotors for viewing.`.substring(0, 155);
  }

  // Generate OpenGraph data for WhatsApp sharing
  generateCarOpenGraph(car: any) {
    const canonicalUrl = this.generateCarCanonicalUrl(car);
    const description = this.generateCarMetaDescription(car);
    const primaryImage = this.toOgImage(
      car.images?.find((img: any) => img.isPrimary)?.url || car.images?.[0]?.url
    );

    return {
      'og:title': car.title,
      'og:description': description,
      'og:url': canonicalUrl,
      'og:type': 'product',
      'og:image': primaryImage,
      'og:image:width': '1200',
      'og:image:height': '630',
      'og:site_name': 'GaliMotors - Malawi Car Marketplace',
      'product:price:amount': car.basePrice?.toString() || '0',
      'product:price:currency': 'MWK',
      'twitter:card': 'summary_large_image',
      'twitter:title': car.title,
      'twitter:description': description,
      'twitter:image': primaryImage
    };
  }

  // Generate JSON-LD structured data for car
  generateCarJsonLD(car: any) {
    const canonicalUrl = this.generateCarCanonicalUrl(car);
    const primaryImage = car.images?.find((img: any) => img.isPrimary)?.url || 
                        car.images?.[0]?.url;

    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': canonicalUrl,
      'name': car.title,
      'description': this.generateCarMetaDescription(car),
      'url': canonicalUrl,
      'image': car.images?.map((img: any) => img.url) || [],
      'brand': {
        '@type': 'Brand',
        'name': car.maker?.name || 'Unknown'
      },
      'model': car.model?.name,
      'vehicleModelDate': car.year?.toString(),
      'mileageFromOdometer': {
        '@type': 'QuantitativeValue',
        'value': car.mileage,
        'unitCode': 'KMT'
      },
      'fuelType': car.fuelType,
      'vehicleTransmission': car.transmission,
      'offers': {
        '@type': 'Offer',
        'price': car.basePrice?.toString() || '0',
        'priceCurrency': 'MWK',
        'availability': car.status === 'AVAILABLE' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        'seller': {
          '@type': 'Organization',
          'name': 'GaliMotors',
          'url': this.baseUrl
        }
      },
      'additionalProperty': [
        {
          '@type': 'PropertyValue',
          'name': 'Body Type',
          'value': car.bodyType?.name
        },
        {
          '@type': 'PropertyValue',
          'name': 'Location',
          'value': car.district
        }
      ]
    };
  }

  // Generate XML sitemap
  async generateSitemap(): Promise<string> {
    const urls: SitemapUrl[] = [];

    // Static pages
    urls.push({
      url: this.baseUrl,
      lastmod: new Date().toISOString(),
      changefreq: 'daily',
      priority: 1.0
    });

    urls.push({
      url: `${this.baseUrl}/cars`,
      lastmod: new Date().toISOString(),
      changefreq: 'hourly',
      priority: 0.9
    });

    // Dynamic car pages
    const cars = await prisma.car.findMany({
      where: {
        status: 'AVAILABLE',
        deletedAt: null
      },
      include: {
        maker: true,
        model: true,
        bodyType: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    for (const car of cars) {
      const slug = this.generateCarSlug(car);
      urls.push({
        url: `${this.baseUrl}/cars/${slug}`,
        lastmod: car.updatedAt.toISOString(),
        changefreq: 'weekly',
        priority: 0.8
      });
    }

    // Generate XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${url.url}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    return xml;
  }

  // Generate robots.txt
  generateRobotsTxt(): string {
    return `User-agent: *
Allow: /
Allow: /cars
Allow: /cars/*

Disallow: /admin
Disallow: /admin/*
Disallow: /api
Disallow: /api/*

Sitemap: ${this.baseUrl}/sitemap.xml

# Crawl-delay for respectful crawling
Crawl-delay: 1`;
  }

  // Generate breadcrumb JSON-LD
  generateBreadcrumbJsonLD(car: any) {
    const carUrl = this.generateCarCanonicalUrl(car);
    
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': [
        {
          '@type': 'ListItem',
          'position': 1,
          'name': 'Home',
          'item': this.baseUrl
        },
        {
          '@type': 'ListItem',
          'position': 2,
          'name': 'Cars',
          'item': `${this.baseUrl}/cars`
        },
        {
          '@type': 'ListItem',
          'position': 3,
          'name': car.maker?.name || 'Cars',
          'item': `${this.baseUrl}/cars?makerId=${car.makerId}`
        },
        {
          '@type': 'ListItem',
          'position': 4,
          'name': car.title,
          'item': carUrl
        }
      ]
    };
  }

  // Generate organization JSON-LD. Async because the contact number is read
  // from settings, so structured data tracks the admin panel rather than
  // publishing a number frozen at deploy time.
  async generateOrganizationJsonLD() {
    const businessNumber = await getAdminWhatsApp();

    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      'name': 'GaliMotors',
      'url': this.baseUrl,
      'logo': `${this.baseUrl}/logo.png`,
      'description': 'Malawi\'s trusted car marketplace. Buy and sell cars with confidence.',
      'address': {
        '@type': 'PostalAddress',
        'addressCountry': 'MW',
        'addressLocality': 'Lilongwe'
      },
      // Sourced from settings rather than hardcoded. These were the dummy
      // 265990000000 placeholder, which meant the Organization schema
      // published to search engines a WhatsApp number reaching nobody.
      // Omitted entirely when unconfigured — publishing no contact point is
      // better than publishing a wrong one.
      ...(businessNumber && {
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: `+${businessNumber}`,
          contactType: 'Customer Service'
        }
      }),
      'sameAs': [
        'https://www.facebook.com/galimotors',
        ...(businessNumber ? [`https://wa.me/${businessNumber}`] : [])
      ]
    };
  }
}

export default new SEOService();
import { Request, Response } from 'express';
import prisma from '../lib/prisma';

// Get conversion funnel metrics
export const getConversionFunnel = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = startDate && endDate ? {
      createdAt: {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      }
    } : {};

    // Get counts for each stage
    const [
      totalInquiries,
      viewingRequests,
      reservations,
      soldCars,
      totalCars,
      activeCars
    ] = await Promise.all([
      prisma.lead.count({ where: { type: 'INQUIRY', ...dateFilter } }),
      prisma.lead.count({ where: { type: 'PAID_VIEWING_REQUEST', ...dateFilter } }),
      prisma.lead.count({ where: { type: 'PAID_RESERVATION', ...dateFilter } }),
      prisma.car.count({ where: { status: 'SOLD', ...dateFilter } }),
      prisma.car.count(),
      prisma.car.count({ where: { status: 'AVAILABLE', deletedAt: null } })
    ]);

    // Calculate conversion rates
    const inquiryToViewing = totalInquiries > 0 ? (viewingRequests / totalInquiries) * 100 : 0;
    const viewingToReservation = viewingRequests > 0 ? (reservations / viewingRequests) * 100 : 0;
    const reservationToSale = reservations > 0 ? (soldCars / reservations) * 100 : 0;
    const overallConversion = totalInquiries > 0 ? (soldCars / totalInquiries) * 100 : 0;

    res.json({
      funnel: {
        inquiries: totalInquiries,
        viewingRequests,
        reservations,
        sales: soldCars
      },
      conversionRates: {
        inquiryToViewing: inquiryToViewing.toFixed(2),
        viewingToReservation: viewingToReservation.toFixed(2),
        reservationToSale: reservationToSale.toFixed(2),
        overall: overallConversion.toFixed(2)
      },
      inventory: {
        total: totalCars,
        active: activeCars,
        sold: soldCars
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch conversion funnel' });
  }
};

// Get listing performance metrics
export const getListingPerformance = async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;

    // Top performing listings by inquiries
    const topByInquiries = await prisma.car.findMany({
      where: { deletedAt: null },
      orderBy: { inquiriesCount: 'desc' },
      take: Number(limit),
      select: {
        id: true,
        title: true,
        basePrice: true,
        inquiriesCount: true,
        viewsCount: true,
        status: true,
        maker: { select: { name: true } },
        model: { select: { name: true } },
        images: { where: { isPrimary: true }, take: 1 }
      }
    });

    // Top performing listings by views
    const topByViews = await prisma.car.findMany({
      where: { deletedAt: null },
      orderBy: { viewsCount: 'desc' },
      take: Number(limit),
      select: {
        id: true,
        title: true,
        basePrice: true,
        inquiriesCount: true,
        viewsCount: true,
        status: true,
        maker: { select: { name: true } },
        model: { select: { name: true } }
      }
    });

    // Calculate average metrics
    const avgMetrics = await prisma.car.aggregate({
      where: { deletedAt: null },
      _avg: {
        inquiriesCount: true,
        viewsCount: true
      }
    });

    // Most popular makers
    const popularMakers = await prisma.car.groupBy({
      by: ['makerId'],
      where: { deletedAt: null },
      _count: { id: true },
      _sum: { inquiriesCount: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    });

    const makersWithNames = await Promise.all(
      popularMakers.map(async (item) => {
        const maker = await prisma.maker.findUnique({
          where: { id: item.makerId || '' },
          select: { name: true }
        });
        return {
          maker: maker?.name || 'Unknown',
          listings: item._count.id,
          totalInquiries: item._sum.inquiriesCount || 0
        };
      })
    );

    // Most popular body types
    const popularBodyTypes = await prisma.car.groupBy({
      by: ['bodyTypeId'],
      where: { deletedAt: null },
      _count: { id: true },
      _sum: { inquiriesCount: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    });

    const bodyTypesWithNames = await Promise.all(
      popularBodyTypes.map(async (item) => {
        const bodyType = await prisma.bodyType.findUnique({
          where: { id: item.bodyTypeId || '' },
          select: { name: true }
        });
        return {
          bodyType: bodyType?.name || 'Unknown',
          listings: item._count.id,
          totalInquiries: item._sum.inquiriesCount || 0
        };
      })
    );

    res.json({
      topPerformers: {
        byInquiries: topByInquiries,
        byViews: topByViews
      },
      averages: {
        inquiriesPerListing: avgMetrics._avg.inquiriesCount?.toFixed(2) || 0,
        viewsPerListing: avgMetrics._avg.viewsCount?.toFixed(2) || 0
      },
      popular: {
        makers: makersWithNames,
        bodyTypes: bodyTypesWithNames
      }
    });
  } catch (error) {
    console.error('Listing performance error:', error);
    res.status(500).json({ error: 'Failed to fetch listing performance' });
  }
};

// Get revenue and commission metrics
export const getRevenueMetrics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = startDate && endDate ? {
      updatedAt: {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      }
    } : {};

    // Total commissions
    const commissionData = await prisma.car.aggregate({
      where: {
        status: 'SOLD',
        ...dateFilter
      },
      _sum: { commissionAmount: true },
      _count: { id: true }
    });

    // Pending commissions
    const pendingCommissions = await prisma.car.aggregate({
      where: {
        status: 'SOLD',
        commissionStatus: 'PENDING',
        ...dateFilter
      },
      _sum: { commissionAmount: true },
      _count: { id: true }
    });

    // Paid commissions
    const paidCommissions = await prisma.car.aggregate({
      where: {
        status: 'SOLD',
        commissionStatus: 'PAID',
        ...dateFilter
      },
      _sum: { commissionAmount: true },
      _count: { id: true }
    });

    // Commission by seller
    const soldCars = await prisma.car.findMany({
      where: {
        status: 'SOLD',
        ...dateFilter
      },
      select: {
        commissionAmount: true,
        commissionStatus: true,
        seller: { select: { id: true, name: true } }
      }
    });

    const commissionBySeller = soldCars.reduce((acc: any, car) => {
      const sellerId = car.seller.id;
      if (!acc[sellerId]) {
        acc[sellerId] = {
          sellerName: car.seller.name,
          totalCommission: 0,
          pendingCommission: 0,
          paidCommission: 0,
          salesCount: 0
        };
      }
      acc[sellerId].salesCount++;
      const amount = Number(car.commissionAmount || 0);
      acc[sellerId].totalCommission += amount;
      if (car.commissionStatus === 'PENDING') {
        acc[sellerId].pendingCommission += amount;
      } else {
        acc[sellerId].paidCommission += amount;
      }
      return acc;
    }, {});

    res.json({
      total: {
        commission: Number(commissionData._sum.commissionAmount || 0),
        sales: commissionData._count.id
      },
      pending: {
        commission: Number(pendingCommissions._sum.commissionAmount || 0),
        sales: pendingCommissions._count.id
      },
      paid: {
        commission: Number(paidCommissions._sum.commissionAmount || 0),
        sales: paidCommissions._count.id
      },
      bySeller: Object.values(commissionBySeller)
    });
  } catch (error) {
    console.error('Revenue metrics error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue metrics' });
  }
};

// Get lead source analytics
export const getLeadSourceAnalytics = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = startDate && endDate ? {
      createdAt: {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      }
    } : {};

    // Group leads by source
    const leadsBySource = await prisma.lead.groupBy({
      by: ['leadSource'],
      where: dateFilter,
      _count: { id: true }
    });

    // Group by type
    const leadsByType = await prisma.lead.groupBy({
      by: ['type'],
      where: dateFilter,
      _count: { id: true }
    });

    // Group by status
    const leadsByStatus = await prisma.lead.groupBy({
      by: ['status'],
      where: dateFilter,
      _count: { id: true }
    });

    res.json({
      bySource: leadsBySource.map(item => ({
        source: item.leadSource || 'direct',
        count: item._count.id
      })),
      byType: leadsByType.map(item => ({
        type: item.type,
        count: item._count.id
      })),
      byStatus: leadsByStatus.map(item => ({
        status: item.status,
        count: item._count.id
      }))
    });
  } catch (error) {
    console.error('Lead source analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch lead source analytics' });
  }
};

// Statuses that mean "someone is still working this lead". Everything the
// Overview reports about leads is scoped to these — closed history is not
// a number an admin acts on each morning.
const OPEN_LEAD_STATUSES = [
  'NEW',
  'IN_PROGRESS',
  'QUOTE_SENT',
  'NEGOTIATION',
  'QUOTE_ACCEPTED',
  'VIEWING_SCHEDULED',
];

// Get dashboard overview — every figure here must stay true under the
// system's own lifecycles. Sold counts use soldAt (a SOLD car is archived
// to HIDDEN after 2 days and soft-deleted after 30, so counting
// status='SOLD' shrinks over time); revenue is deliberately absent because
// nothing in the current sale flow records a commission amount.
export const getDashboardOverview = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      availableCars,
      totalCars,
      soldAllTime,
      soldThisMonth,
      openInquiries,
      newInquiries,
      openViewings,
      openByStatus,
      pendingPayments,
      pendingApprovalCars,
      newSellRequests,
      expiringReservations,
      recentInventory,
      recentLeads
    ] = await Promise.all([
      prisma.car.count({ where: { status: 'AVAILABLE', deletedAt: null } }),
      prisma.car.count({ where: { deletedAt: null } }),
      // Includes archived and soft-deleted cars: the sale still happened.
      prisma.car.count({ where: { soldAt: { not: null } } }),
      prisma.car.count({ where: { soldAt: { gte: monthStart } } }),
      prisma.lead.count({ where: { type: 'INQUIRY', status: { in: OPEN_LEAD_STATUSES } } }),
      prisma.lead.count({ where: { type: 'INQUIRY', status: 'NEW' } }),
      prisma.lead.count({
        where: {
          type: { in: ['PAID_VIEWING_REQUEST', 'PAID_RESERVATION'] },
          status: { in: OPEN_LEAD_STATUSES }
        }
      }),
      prisma.lead.groupBy({
        by: ['status'],
        where: { status: { in: OPEN_LEAD_STATUSES } },
        _count: { id: true }
      }),
      prisma.lead.count({ where: { paymentStatus: 'PENDING_VERIFICATION' } }),
      prisma.car.count({ where: { status: 'PENDING_APPROVAL', deletedAt: null } }),
      prisma.sellRequest.count({ where: { status: 'NEW' } }),
      prisma.car.findMany({
        where: {
          status: 'RESERVED',
          reservationExpiry: { gt: now, lt: in24h }
        },
        select: { id: true, title: true, reservationExpiry: true }
      }),
      prisma.car.findMany({
        take: 5,
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          basePrice: true,
          status: true,
          createdAt: true
        }
      }),
      prisma.lead.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          buyerName: true,
          buyerPhone: true,
          type: true,
          status: true,
          createdAt: true,
          car: { select: { title: true } }
        }
      })
    ]);

    res.json({
      inventory: {
        available: availableCars,
        total: totalCars,
        soldAllTime,
        soldThisMonth,
        recent: recentInventory
      },
      leads: {
        openInquiries,
        newInquiries,
        openViewings,
        openByStatus: openByStatus.map(row => ({ status: row.status, count: row._count.id })),
        recent: recentLeads
      },
      actionQueues: {
        pendingPayments,
        pendingApprovalCars,
        newSellRequests,
        expiringReservations
      }
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard overview' });
  }
};


// Export commissions to CSV
export const exportCommissions = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const { CSVExporter } = await import('../utils/csvExport');
    
    const dateFilter = startDate && endDate ? {
      createdAt: {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      }
    } : {};

    // Get all sold cars with seller info
    const soldCars = await prisma.car.findMany({
      where: {
        status: 'SOLD',
        ...dateFilter
      },
      include: {
        seller: { select: { name: true, phone: true } },
        maker: { select: { name: true } },
        model: { select: { name: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Transform data for CSV
    const csvData = soldCars.map(car => ({
      'Car ID': car.id.substring(0, 8),
      'Car Title': car.title,
      'Maker': car.maker?.name || '',
      'Model': car.model?.name || '',
      'Year': car.year,
      'Sale Price': CSVExporter.formatCurrency(car.basePrice),
      'Commission Amount': CSVExporter.formatCurrency(car.commissionAmount || 0),
      'Seller Name': car.seller?.name || '',
      'Seller Phone': car.seller?.phone || '',
      'Sale Date': CSVExporter.formatDate(car.updatedAt),
      'Status': car.status
    }));

    const csv = CSVExporter.toCSV(csvData);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=commissions_${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Export commissions error:', error);
    res.status(500).json({ error: 'Failed to export commissions' });
  }
};

// Export leads to CSV
export const exportLeads = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, status, type } = req.query;
    const { CSVExporter } = await import('../utils/csvExport');
    
    const filters: any = {};
    
    if (startDate && endDate) {
      filters.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      };
    }
    
    if (status) filters.status = status;
    if (type) filters.type = type;

    const leads = await prisma.lead.findMany({
      where: filters,
      include: {
        car: {
          select: {
            title: true,
            basePrice: true,
            maker: { select: { name: true } },
            model: { select: { name: true } }
          }
        },
        customer: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Transform data for CSV
    const csvData = leads.map(lead => ({
      'Lead ID': lead.id.substring(0, 8),
      'Type': lead.type,
      'Status': lead.status,
      'Buyer Name': lead.buyerName,
      'Buyer Phone': lead.buyerPhone,
      'Buyer Email': lead.buyerEmail || '',
      'Customer Account': lead.customer?.email || 'Guest',
      'Car': lead.car?.title || '',
      'Maker': (lead.car as any)?.maker?.name || '',
      'Model': (lead.car as any)?.model?.name || '',
      'Car Price': lead.car ? CSVExporter.formatCurrency(lead.car.basePrice) : '',
      'Lead Source': lead.leadSource || '',
      'Payment Status': lead.paymentStatus || '',
      'Message': lead.message || '',
      'Created': CSVExporter.formatDateTime(lead.createdAt),
      'Updated': CSVExporter.formatDateTime(lead.updatedAt)
    }));

    const csv = CSVExporter.toCSV(csvData);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=leads_${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Export leads error:', error);
    res.status(500).json({ error: 'Failed to export leads' });
  }
};

// Export sales report to CSV
export const exportSalesReport = async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    const { CSVExporter } = await import('../utils/csvExport');
    
    const dateFilter = startDate && endDate ? {
      updatedAt: {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string)
      }
    } : {};

    const soldCars = await prisma.car.findMany({
      where: {
        status: 'SOLD',
        ...dateFilter
      },
      include: {
        seller: { select: { name: true, phone: true, district: true } },
        maker: { select: { name: true } },
        model: { select: { name: true } },
        bodyType: { select: { name: true } },
        leads: {
          where: { status: 'CLOSED_WON' },
          select: {
            buyerName: true,
            buyerPhone: true,
            createdAt: true
          },
          take: 1
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    const csvData = soldCars.map(car => {
      const lead = car.leads[0];
      return {
        'Sale Date': CSVExporter.formatDate(car.updatedAt),
        'Car ID': car.id.substring(0, 8),
        'Title': car.title,
        'Maker': car.maker?.name || '',
        'Model': car.model?.name || '',
        'Body Type': car.bodyType?.name || '',
        'Year': car.year,
        'Mileage': car.mileage || '',
        'Sale Price': CSVExporter.formatCurrency(car.basePrice),
        'Commission': CSVExporter.formatCurrency(car.commissionAmount || 0),
        'Net to Seller': CSVExporter.formatCurrency(car.basePrice - (car.commissionAmount || 0)),
        'Seller Name': car.seller?.name || '',
        'Seller Location': car.seller?.district || '',
        'Buyer Name': lead?.buyerName || '',
        'Buyer Phone': lead?.buyerPhone || '',
        'Lead Created': lead ? CSVExporter.formatDate(lead.createdAt) : '',
        'Days to Sale': lead ? Math.floor((car.updatedAt.getTime() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24)) : ''
      };
    });

    const csv = CSVExporter.toCSV(csvData);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=sales_report_${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Export sales report error:', error);
    res.status(500).json({ error: 'Failed to export sales report' });
  }
};

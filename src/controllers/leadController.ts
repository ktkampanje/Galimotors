import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { getSiteUrl } from "../lib/siteUrl";
import { validateMalawianPhone, sanitizePhone } from "../middleware/sanitize";
import notificationService from "../services/notificationService";
import { buildWhatsAppUrl } from "../lib/whatsapp";
import { getAdminWhatsApp } from "../lib/businessContact";

// Display name of the authenticated admin, for message attribution. Several
// admins can work the same lead; every admin-authored message and offer is
// stamped so a colleague picking the thread up can see who said what.
const getAdminName = async (req: Request): Promise<string | null> => {
  const userId = (req as any).user?.userId;
  if (!userId) return null;
  const admin = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  return admin?.name || null;
};

const getCustomerId = (req: Request) =>
  (req as any).customer?.customerId || (req as any).customer?.id;

export const createInquiryLead = async (req: Request, res: Response) => {
  try {
    const { carId, buyerName, buyerPhone, message, leadSource, negotiationPrice, buyerDistrict, carDistrict, roundTripDistanceKm, calculatedTotalCost, paymentAmount, proofOfPaymentUrl } = req.body;

    // A viewing booking arrives with proof of payment attached and is created
    // as PAID_VIEWING_REQUEST in one atomic call (no follow-up PATCH needed)
    const isPaidViewing = !!proofOfPaymentUrl;

    // 1. Strict Malawian Phone Validation
    const sanitizedPhone = sanitizePhone(buyerPhone);
    if (!sanitizedPhone || !validateMalawianPhone(sanitizedPhone)) {
      return res.status(400).json({
        message:
          "Invalid Malawian phone number. Enter 10 digits starting with 08 or 09, e.g. 0952456789.",
        error: "INVALID_PHONE",
      });
    }

    // 2. Check if CAPTCHA warning should be shown in response
    const showCaptchaWarning = (req as any).showCaptchaWarning;

    // 3. Auth is optional — guests submit with name + phone, and registration
    // later claims their leads by phone. When the customer IS signed in, the
    // account's email is attached so the admin gets a full contact record.
    const customerId = getCustomerId(req) || null;
    let buyerEmail: string | null = null;
    if (customerId) {
      const account = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { email: true },
      });
      buyerEmail = account?.email || null;
    }

    // 4. Save Lead to CRM with lead source tracking, optional customer link, and optional initial negotiation
    const parsedNegotiationPrice = negotiationPrice ? parseFloat(negotiationPrice) : null;
    
    const lead = await prisma.lead.create({
      data: {
        carId,
        buyerName,
        buyerPhone: sanitizedPhone,
        buyerEmail,
        message,
        type: isPaidViewing ? "PAID_VIEWING_REQUEST" : "INQUIRY",
        status: "NEW",
        proofOfPaymentUrl: proofOfPaymentUrl || undefined,
        paymentStatus: isPaidViewing ? "PENDING_VERIFICATION" : undefined,
        leadSource: leadSource || "direct", // Track where the lead came from
        customerId, // Link to customer if authenticated
        // Add initial negotiation if requested
        lastCounterOfferPrice: parsedNegotiationPrice,
        lastCounterOfferAt: parsedNegotiationPrice ? new Date() : undefined,
        negotiationStatus: parsedNegotiationPrice ? "ACTIVE" : undefined,
        negotiationHistory: parsedNegotiationPrice ? {
          create: {
            type: "CUSTOMER_COUNTER",
            senderName: buyerName,
            offeredPrice: parsedNegotiationPrice,
            message: message || "Initial negotiation request",
            status: "PENDING"
          }
        } : undefined,
        // Viewing Details
        buyerDistrict,
        carDistrict,
        roundTripDistanceKm,
        calculatedTotalCost,
        paymentAmount,
        viewingMessages: (calculatedTotalCost !== undefined && calculatedTotalCost !== null) ? {
          create: [
            {
              type: "CUSTOMER_REQUEST",
              sender: "customer",
              senderName: buyerName,
              message: message || "I would like to book a viewing for this vehicle.",
              costBreakdown: JSON.stringify({ totalCost: calculatedTotalCost })
            },
            ...(isPaidViewing ? [{
              type: "CUSTOMER_PAYMENT",
              sender: "customer",
              senderName: buyerName,
              message: "I have uploaded the proof of payment.",
            }] : [])
          ]
        } : undefined
      },
      include: {
        car: { select: { title: true, basePrice: true } },
        customer: { select: { id: true, name: true, email: true } },
      },
    });

    // 5. Increment inquiry count on car
    await prisma.car.update({
      where: { id: carId },
      data: { inquiriesCount: { increment: 1 } },
    });

    // 6. Send notification to customer
    const customerNotification = notificationService.templates.inquiryReceived(
      buyerName,
      lead.car.title,
    );
    await notificationService.sendNotification({
      to: sanitizedPhone,
      message: customerNotification.message,
      subject: customerNotification.subject,
      type: "whatsapp",
    });

    // 7. Alert the business. notifyAdmin fans out to email AND WhatsApp, so
    //    the lead still lands while automated WhatsApp is unconfigured — this
    //    previously required a WhatsApp number and then sent nothing.
    //    adminWhatsApp is still resolved here for the click-to-chat URL below.
    const adminWhatsApp = await getAdminWhatsApp();
    const adminNotification = isPaidViewing
      ? notificationService.templates.paymentPending(
          lead.car.title,
          buyerName,
          Number(paymentAmount) || Number(calculatedTotalCost) || 0,
        )
      : notificationService.templates.newInquiry(
          lead.car.title,
          buyerName,
          sanitizedPhone,
        );
    await notificationService.notifyAdmin(
      adminNotification.subject,
      adminNotification.message,
    );

    // 8. Return lead object with WhatsApp URL
    const waMessage = `Hi GaliMotors! I'm interested in the ${lead.car.title} (ID: ${lead.carId.substring(0, 5)}). My name is ${buyerName}. Please share more details.`;
    const waUrl = buildWhatsAppUrl(adminWhatsApp, waMessage);

    res.status(201).json({
      lead,
      message: "Lead captured successfully",
      whatsappUrl: waUrl,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to process inquiry" });
  }
};

// Lead.type partitions the two admin screens:
//   INQUIRY              -> Customer Inquiries (unpaid, needs a quote)
//   PAID_VIEWING_REQUEST -> Viewings (paid workflow)
//   PAID_RESERVATION     -> Viewings (paid workflow)
// Exported so both the controller and callers share one definition rather
// than each re-deriving the split.
export const PAID_LEAD_TYPES = ["PAID_VIEWING_REQUEST", "PAID_RESERVATION"];

// The full shape the admin lead screens render. Shared so that every endpoint
// returning a lead sends the SAME payload — handlers that returned a trimmed
// lead caused the UI to blank its conversation and vehicle panels on save.
export const LEAD_DETAIL_INCLUDE = {
  car: {
    select: {
      id: true,
      title: true,
      basePrice: true,
      // Seller's bottom line — safe here: these routes are admin-only.
      // Shown so the admin can see the negotiating room on a lead.
      sellerAskingPrice: true,
      status: true,
      district: true,
      year: true,
      mileage: true,
      registrationNumber: true,
      maker: { select: { name: true } },
      model: { select: { name: true } },
      images: {
        select: { url: true, isPrimary: true },
        orderBy: { isPrimary: "desc" as const },
        take: 1,
      },
      // Surfaced so an admin handling a viewing request can call the
      // people who physically hold the car and confirm it is still
      // available, without leaving the screen.
      seller: {
        select: {
          name: true,
          phone: true,
          sellerType: true,
          district: true,
          verifiedByPlatform: true,
        },
      },
      attendant: {
        select: {
          name: true,
          phone: true,
          market: { select: { name: true, district: true } },
        },
      },
      market: { select: { name: true, district: true } },
    },
  },
  negotiationHistory: { orderBy: { createdAt: "asc" as const } },
  viewingMessages: { orderBy: { createdAt: "asc" as const } },
};

export const getLeads = async (req: Request, res: Response) => {
  try {
    // Optional ?type= filter. Accepts a single type or a comma-separated list,
    // so each admin screen can fetch only its own rows instead of pulling the
    // whole table and discarding most of it client-side. Omitting it returns
    // everything, preserving the previous behaviour for existing callers.
    const typeParam = typeof req.query.type === "string" ? req.query.type.trim() : "";
    const types = typeParam
      ? typeParam.split(",").map((t) => t.trim()).filter(Boolean)
      : [];

    const leads = await prisma.lead.findMany({
      ...(types.length > 0 && { where: { type: { in: types } } }),
      include: LEAD_DETAIL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch leads" });
  }
};

export const updateLeadPayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { proofOfPaymentUrl, buyerPhone } = req.body;

    // Validate lead exists
    const existingLead = await prisma.lead.findUnique({
      where: { id },
      include: { car: { select: { title: true, basePrice: true } } },
    });
    if (!existingLead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Validate Malawian phone format if provided. Uses the shared validator
    // rather than a local regex copy, which had already drifted behind it.
    if (buyerPhone && !validateMalawianPhone(sanitizePhone(buyerPhone) || "")) {
      return res
        .status(400)
        .json({ message: "Invalid Malawian phone number format" });
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        proofOfPaymentUrl,
        paymentStatus: "PENDING_VERIFICATION",
        type: "PAID_VIEWING_REQUEST", // Update lead type
        ...(buyerPhone && { buyerPhone }),
        viewingMessages: {
          create: {
            type: "CUSTOMER_PAYMENT",
            sender: "customer",
            senderName: existingLead.buyerName,
            message: "I have uploaded the proof of payment.",
          }
        }
      },
    });

    // Alert the business about the pending payment.
    const adminNotification = notificationService.templates.paymentPending(
      existingLead.car.title,
      existingLead.buyerName,
      Number(existingLead.car.basePrice),
    );
    await notificationService.notifyAdmin(
      adminNotification.subject,
      adminNotification.message,
    );

    res.json(lead);
  } catch (error) {
    res.status(400).json({ message: "Failed to update lead payment" });
  }
};

// Update lead status (for admin workflow)
export const updateLeadStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // First fetch the lead to get current message
    const existingLead = await prisma.lead.findUnique({ where: { id } });
    if (!existingLead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        status,
        // Notes go to the internal field. They used to be appended to
        // `message` — the customer's own words — which corrupted the inquiry
        // and made staff remarks render as customer speech in the thread.
        ...(notes && {
          adminNotes: existingLead.adminNotes
            ? `${existingLead.adminNotes}\n\n${notes}`
            : notes,
        }),
      },
      // Full shape: the admin UI re-renders the selected lead from this
      // response, and a trimmed payload blanked its conversation and
      // vehicle panels until the next refetch.
      include: LEAD_DETAIL_INCLUDE,
    });

    res.json(lead);
  } catch (error) {
    res.status(400).json({ message: "Failed to update lead status" });
  }
};

// Verify payment (admin action)
export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approved, rejectionReason } = req.body;

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        car: {
          include: {
            seller: true,
          },
        },
      },
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const adminName = await getAdminName(req);

    if (approved) {
      // Approve payment
      const updatedLead = await prisma.lead.update({
        where: { id },
        data: {
          paymentStatus: "VERIFIED",
          paymentVerifiedAt: new Date(),
          paymentVerifiedBy: (req as any).user?.userId,
          viewingMessages: {
            create: {
              type: "ADMIN_PAYMENT_VERIFIED",
              sender: "admin",
              senderName: adminName,
              message: "Payment verified successfully. We will schedule a viewing shortly.",
            }
          }
        },
      });

      // 1. Send WhatsApp notification to customer
      const customerNotification =
        notificationService.templates.paymentVerified(
          lead.buyerName,
          lead.car.title,
        );
      await notificationService.sendNotification({
        to: lead.buyerPhone,
        message: customerNotification.message,
        subject: customerNotification.subject,
        type: "whatsapp",
      });

      // 2. Send SMS fallback to customer
      await notificationService.sendNotification({
        to: lead.buyerPhone,
        message: `Payment verified for ${lead.car.title}. We'll contact you to schedule viewing. - GaliMotors`,
        subject: "Payment Verified",
        type: "sms",
      });

      // 3. Notify seller via SMS
      if (lead.car.seller?.phone) {
        await notificationService.sendNotification({
          to: lead.car.seller.phone,
          message: `Payment verified for ${lead.car.title}. Buyer: ${lead.buyerName} (${lead.buyerPhone}). Viewing scheduled.`,
          subject: "Payment Verified - Viewing Scheduled",
          type: "sms",
        });
      }

      res.json({
        message: "Payment verified successfully",
        lead: updatedLead,
      });
    } else {
      // Reject payment
      const updatedLead = await prisma.lead.update({
        where: { id },
        data: {
          paymentStatus: "REJECTED",
          paymentRejectionReason: rejectionReason,
          message: `${lead.message || ""}\n\nPayment Rejected: ${rejectionReason}`,
          viewingMessages: {
            create: {
              type: "ADMIN_PAYMENT_REJECTED",
              sender: "admin",
              senderName: adminName,
              message: `Payment rejected: ${rejectionReason}`,
            }
          }
        },
      });

      // 1. Send WhatsApp notification to customer with rejection reason
      const customerNotification =
        notificationService.templates.paymentRejected(
          lead.buyerName,
          rejectionReason || "Payment verification failed",
        );
      await notificationService.sendNotification({
        to: lead.buyerPhone,
        message: customerNotification.message,
        subject: customerNotification.subject,
        type: "whatsapp",
      });

      // 2. Send SMS fallback to customer
      await notificationService.sendNotification({
        to: lead.buyerPhone,
        message: `Payment rejected: ${rejectionReason}. Please re-upload or contact us. - GaliMotors`,
        subject: "Payment Rejected",
        type: "sms",
      });

      res.json({
        message: "Payment rejected",
        lead: updatedLead,
      });
    }
  } catch (error) {
    res.status(400).json({ message: "Failed to verify payment" });
  }
};

// Get pending payment verifications (admin queue)
export const getPendingPayments = async (req: Request, res: Response) => {
  try {
    const leads = await prisma.lead.findMany({
      where: {
        paymentStatus: "PENDING_VERIFICATION",
      },
      select: {
        id: true,
        buyerName: true,
        buyerPhone: true,
        buyerEmail: true,
        message: true,
        proofOfPaymentUrl: true,
        calculatedTotalCost: true,
        paymentAmount: true,
        createdAt: true,
        car: {
          select: {
            id: true,
            title: true,
            basePrice: true,
            images: {
              select: {
                url: true,
                isPrimary: true
              }
            },
          },
        },
      },
      orderBy: { createdAt: "asc" }, // Oldest first
    });

    res.json(leads);
  } catch (error) {
    console.error('Failed to fetch pending payments:', error);
    res
      .status(500)
      .json({ message: "Failed to fetch pending payments" });
  }
};
// Get prioritized leads using lead scoring algorithm
export const getPrioritizedLeads = async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.query;

    const leadScoringService = (await import("../services/leadScoringService"))
      .default;
    const result = await leadScoringService.getPrioritizedLeads(Number(limit));

    res.json(result);
  } catch (error) {
    console.error("Failed to get prioritized leads:", error);
    res.status(500).json({ error: "Failed to get prioritized leads" });
  }
};

// Get lead score for a specific lead
export const getLeadScore = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const leadScoringService = (await import("../services/leadScoringService"))
      .default;
    const scoring = await leadScoringService.calculateLeadScore(id);

    res.json(scoring);
  } catch (error) {
    console.error("Failed to get lead score:", error);
    res.status(500).json({ error: "Failed to calculate lead score" });
  }
};

// Get lead scoring insights for admin dashboard
export const getLeadScoringInsights = async (req: Request, res: Response) => {
  try {
    const leadScoringService = (await import("../services/leadScoringService"))
      .default;
    const insights = await leadScoringService.getLeadScoringInsights();

    res.json(insights);
  } catch (error) {
    console.error("Failed to get lead scoring insights:", error);
    res.status(500).json({ message: "Failed to get lead scoring insights" });
  }
};

// Track call attempt (for click-to-call)
export const trackCallAttempt = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { phone, contactName, timestamp } = req.body;
    const adminUserId = (req as any).user?.id;

    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Append call attempt to message/notes
    const callNote = `\n[Call Attempt] ${new Date(timestamp).toLocaleString()} - Admin called ${contactName || "customer"} at ${phone}`;

    await prisma.lead.update({
      where: { id },
      data: {
        message: `${lead.message || ""}${callNote}`,
      },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: adminUserId,
        action: "CALL_ATTEMPT",
        entityType: "Lead",
        entityId: id,
        newValue: `Called ${contactName || "customer"} at ${phone}`,
        ipAddress: req.ip || "unknown",
      },
    });

    res.json({ message: "Call attempt logged" });
  } catch (error) {
    console.error("Track call attempt error:", error);
    res.status(500).json({ message: "Failed to track call attempt" });
  }
};

// Get lead timeline (all activity history)
export const getLeadTimeline = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        car: { select: { title: true } },
      },
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Fetch activity logs for this lead
    const activityLogs = await prisma.activityLog.findMany({
      where: {
        entityType: "Lead",
        entityId: id,
      },
      orderBy: { createdAt: "desc" },
    });

    // Build timeline events
    const events = [];

    // Lead creation event
    events.push({
      id: `created-${lead.id}`,
      type: "CREATED",
      timestamp: lead.createdAt.toISOString(),
      description: "Lead Created",
      details: `${lead.buyerName} inquired about ${lead.car?.title || "a vehicle"}`,
    });

    // Status change events from activity logs
    const statusChanges = activityLogs.filter(
      (log) => log.action === "UPDATE_LEAD_STATUS",
    );
    statusChanges.forEach((log) => {
      events.push({
        id: log.id,
        type: "STATUS_CHANGE",
        timestamp: log.createdAt.toISOString(),
        description: "Status Updated",
        details: log.newValue || "Status changed",
        user: log.userId ? "Admin" : undefined,
      });
    });

    // Call attempt events
    const callAttempts = activityLogs.filter(
      (log) => log.action === "CALL_ATTEMPT",
    );
    callAttempts.forEach((log) => {
      events.push({
        id: log.id,
        type: "CALL",
        timestamp: log.createdAt.toISOString(),
        description: "Call Attempt",
        details: log.newValue || "Admin called customer",
        user: log.userId ? "Admin" : undefined,
      });
    });

    // Payment events
    const paymentEvents = activityLogs.filter(
      (log) =>
        log.action === "VERIFY_PAYMENT" || log.action === "REJECT_PAYMENT",
    );
    paymentEvents.forEach((log) => {
      events.push({
        id: log.id,
        type: "PAYMENT",
        timestamp: log.createdAt.toISOString(),
        description:
          log.action === "VERIFY_PAYMENT"
            ? "Payment Verified"
            : "Payment Rejected",
        details: log.newValue || "",
        user: log.userId ? "Admin" : undefined,
      });
    });

    // Parse notes from lead message field
    if (lead.message) {
      const noteMatches = lead.message.match(/\[Call Attempt\][^\n]*/g);
      if (noteMatches) {
        noteMatches.forEach((note, index) => {
          const timestampMatch = note.match(
            /\d{1,2}\/\d{1,2}\/\d{4},\s*\d{1,2}:\d{2}:\d{2}\s*[AP]M/,
          );
          events.push({
            id: `note-${index}`,
            type: "NOTE",
            timestamp: timestampMatch
              ? new Date(timestampMatch[0]).toISOString()
              : lead.createdAt.toISOString(),
            description: "Admin Note",
            details: note.replace(/\[Call Attempt\]\s*/, ""),
          });
        });
      }
    }

    // Sort all events by timestamp (newest first)
    events.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    res.json(events);
  } catch (error) {
    console.error("Get lead timeline error:", error);
    res.status(500).json({ message: "Failed to fetch lead timeline" });
  }
};

// Get inquiries for the authenticated customer
export const getMyInquiries = async (req: Request, res: Response) => {
  try {
    const customer = (req as any).customer;

    if (!customer) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const inquiries = await prisma.lead.findMany({
      where: {
        customerId: getCustomerId(req),
      },
      include: {
        car: {
          select: {
            id: true,
            title: true,
            basePrice: true,
            images: true,
            maker: { select: { name: true } },
            model: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(inquiries);
  } catch (error) {
    console.error("Failed to fetch my inquiries:", error);
    res.status(500).json({ message: "Failed to fetch my inquiries" });
  }
};

// ============== QUOTE & NEGOTIATION SYSTEM ============== //

// Helper: find lead by reference number (secure public access)
const findLeadByReference = async (reference: string) => {
  return prisma.lead.findUnique({
    where: { referenceNumber: reference },
    include: {
      car: {
        select: {
          id: true,
          title: true,
          basePrice: true,
          year: true,
          mileage: true,
          fuelType: true,
          transmission: true,
          condition: true,
          district: true,
          maker: { select: { name: true } },
          model: { select: { name: true } },
          bodyType: { select: { name: true } },
          images: true,
        },
      },
      negotiationHistory: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
};

// Valid status transitions for state machine
const VALID_QUOTE_ACTIONS: Record<string, string[]> = {
  accept: ["QUOTE_SENT", "NEGOTIATION"],
  decline: ["QUOTE_SENT", "NEGOTIATION", "NEW"],
  counter: ["QUOTE_SENT", "NEGOTIATION"],
  adminRespond: ["NEGOTIATION"],
};

// Send quote to customer (Admin action)
export const sendQuote = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { adminResponse, quotedPrice, paymentTerms } = req.body;

    if (!quotedPrice || isNaN(parseFloat(quotedPrice))) {
      return res.status(400).json({ message: "A valid quoted price is required" });
    }

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        car: {
          select: {
            title: true,
            basePrice: true,
            maker: { select: { name: true } },
            model: { select: { name: true } },
          },
        },
      },
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const parsedPrice = parseFloat(quotedPrice);

    // Save the admin's quote as a negotiation trail entry
    await prisma.negotiationOffer.create({
      data: {
        leadId: id,
        type: "ADMIN_QUOTE",
        senderName: await getAdminName(req),
        offeredPrice: parsedPrice,
        proposedTerms: paymentTerms || null,
        message: adminResponse || null,
        status: "PENDING",
      },
    });

    // Update lead with quote information
    const updatedLead = await prisma.lead.update({
      where: { id },
      data: {
        adminResponse,
        quotedPrice: parsedPrice,
        paymentTerms,
        quoteSentAt: new Date(),
        status: "QUOTE_SENT",
        negotiationStatus: "ACTIVE",
      },
      include: {
        ...LEAD_DETAIL_INCLUDE,
      },
    });

    // Generate WhatsApp message for admin to send
    const whatsappMessage = `Hi ${lead.buyerName}! 👋\n\nYour quote for ${lead.car.maker?.name} ${lead.car.model?.name} (${lead.car.title}) is ready!\n\n💰 Price: MK ${parsedPrice.toLocaleString()}\n${paymentTerms ? `💳 Payment: ${paymentTerms}\n` : ""}${adminResponse ? `\n📝 ${adminResponse}\n` : ""}\n🔗 View & respond: ${getSiteUrl()}/quote/${lead.referenceNumber}\n\nReply to this message to proceed!\n\n- GaliMotors Team`;

    res.json({
      message: "Quote prepared successfully",
      lead: updatedLead,
      whatsappMessage,
      // null when the lead has no usable phone, so the UI can hide the button
      // instead of opening WhatsApp with no recipient.
      whatsappUrl: buildWhatsAppUrl(lead.buyerPhone, whatsappMessage),
    });
  } catch (error) {
    console.error("Send quote error:", error);
    res.status(500).json({ message: "Failed to send quote" });
  }
};

// Get quote by reference number (Public - no auth needed)
export const getQuoteByReference = async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;
    const lead = await findLeadByReference(reference);

    if (!lead) {
      return res.status(404).json({ message: "Quote not found" });
    }

    // Track that customer viewed the quote
    if (!lead.customerViewedAt) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { customerViewedAt: new Date() },
      });
    }

    // Build the full conversation trail
    const conversation = buildConversationTrail(lead);

    res.json({
      ...lead,
      conversation,
    });
  } catch (error) {
    console.error("Get quote by reference error:", error);
    res.status(500).json({ message: "Failed to fetch quote" });
  }
};

// Build ordered conversation trail from lead data
function buildConversationTrail(lead: any) {
  const trail: any[] = [];

  // 1. Customer's initial inquiry
  trail.push({
    id: `inquiry-${lead.id}`,
    type: "CUSTOMER_INQUIRY",
    sender: "customer",
    senderName: lead.buyerName,
    message: lead.message || `I'm interested in the ${lead.car?.title}`,
    timestamp: lead.createdAt,
  });

  // 2. All negotiation offers (admin quotes, customer counters, admin responses)
  if (lead.negotiationHistory) {
    for (const offer of lead.negotiationHistory) {
      const isAdmin = offer.type === "ADMIN_QUOTE" || offer.type === "ADMIN_COUNTER_RESPONSE";
      trail.push({
        id: offer.id,
        type: offer.type,
        sender: isAdmin ? "admin" : "customer",
        senderName: isAdmin ? "GaliMotors" : lead.buyerName,
        message: offer.message,
        offeredPrice: offer.offeredPrice,
        proposedTerms: offer.proposedTerms,
        status: offer.status,
        timestamp: offer.createdAt,
      });
    }
  }

  // 3. If quote was accepted or declined, add that as a trail entry
  if (lead.status === "QUOTE_ACCEPTED") {
    trail.push({
      id: `accepted-${lead.id}`,
      type: "QUOTE_ACCEPTED",
      sender: "customer",
      senderName: lead.buyerName,
      message: "I accept this quote! Please proceed.",
      timestamp: lead.updatedAt,
    });
  } else if (lead.status === "CLOSED_LOST") {
    trail.push({
      id: `declined-${lead.id}`,
      type: "QUOTE_DECLINED",
      sender: "customer",
      senderName: lead.buyerName,
      message: "Quote declined.",
      timestamp: lead.updatedAt,
    });
  }

  return trail.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// Accept quote (Customer action — by reference number)
export const acceptQuote = async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;
    const lead = await findLeadByReference(reference);

    if (!lead) {
      return res.status(404).json({ message: "Quote not found" });
    }

    // Status validation
    if (!VALID_QUOTE_ACTIONS.accept.includes(lead.status)) {
      return res.status(400).json({
        message: `Cannot accept quote in '${lead.status}' status. Quote must be in QUOTE_SENT or NEGOTIATION status.`,
      });
    }

    // Save acceptance in trail
    await prisma.negotiationOffer.create({
      data: {
        leadId: lead.id,
        type: "CUSTOMER_COUNTER",
        senderName: lead.buyerName,
        message: "I accept this quote. Please proceed with next steps.",
        status: "ACCEPTED",
      },
    });

    const updatedLead = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: "QUOTE_ACCEPTED",
        negotiationStatus: "ACCEPTED",
      },
    });

    // Alert the business on both channels.
    const adminMessage = `🎉 Quote Accepted!\n\n${lead.buyerName} accepted the quote for ${lead.car.title}\n\n💰 Price: MK ${(lead.quotedPrice || lead.car.basePrice).toLocaleString()}\n📞 Phone: ${lead.buyerPhone}\n🔗 Ref: ${lead.referenceNumber}\n\nContact them to proceed!`;

    await notificationService.notifyAdmin(
      "Quote Accepted - GaliMotors Admin",
      adminMessage,
    );

    res.json({
      message: "Quote accepted successfully",
      lead: updatedLead,
    });
  } catch (error) {
    console.error("Accept quote error:", error);
    res.status(500).json({ message: "Failed to accept quote" });
  }
};

// Decline quote (Customer action — by reference number)
export const declineQuote = async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;
    const { reason } = req.body;
    const lead = await findLeadByReference(reference);

    if (!lead) {
      return res.status(404).json({ message: "Quote not found" });
    }

    // Status validation
    if (!VALID_QUOTE_ACTIONS.decline.includes(lead.status)) {
      return res.status(400).json({
        message: `Cannot decline quote in '${lead.status}' status.`,
      });
    }

    const declineMessage = reason || "No reason provided";

    // Save decline in trail
    await prisma.negotiationOffer.create({
      data: {
        leadId: lead.id,
        type: "CUSTOMER_COUNTER",
        senderName: lead.buyerName,
        message: `Quote declined: ${declineMessage}`,
        status: "REJECTED",
      },
    });

    const updatedLead = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: "CLOSED_LOST",
        negotiationStatus: "REJECTED",
      },
    });

    // Alert the business on both channels.
    const adminMessage = `⚠️ Quote Declined\n\n${lead.buyerName} declined the quote for ${lead.car.title}\n\n📝 Reason: ${declineMessage}\n📞 Phone: ${lead.buyerPhone}\n🔗 Ref: ${lead.referenceNumber}`;

    await notificationService.notifyAdmin(
      "Quote Declined - GaliMotors Admin",
      adminMessage,
    );

    res.json({
      message: "Quote declined",
      lead: updatedLead,
    });
  } catch (error) {
    console.error("Decline quote error:", error);
    res.status(500).json({ message: "Failed to decline quote" });
  }
};

// Submit customer counter-offer (by reference number)
export const submitCounterOffer = async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;
    const { counterPrice, counterTerms, counterMessage } = req.body;
    const lead = await findLeadByReference(reference);

    if (!lead) {
      return res.status(404).json({ message: "Quote not found" });
    }

    // Status validation
    if (!VALID_QUOTE_ACTIONS.counter.includes(lead.status)) {
      return res.status(400).json({
        message: `Cannot counter-offer in '${lead.status}' status.`,
      });
    }

    // Create negotiation offer record
    const negotiationOffer = await prisma.negotiationOffer.create({
      data: {
        leadId: lead.id,
        type: "CUSTOMER_COUNTER",
        senderName: lead.buyerName,
        offeredPrice: counterPrice ? parseFloat(counterPrice) : undefined,
        proposedTerms: counterTerms || null,
        message: counterMessage || null,
        status: "PENDING",
      },
    });

    // Update lead
    const updatedLead = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        status: "NEGOTIATION",
        lastCounterOfferPrice: counterPrice ? parseFloat(counterPrice) : undefined,
        lastCounterOfferTerms: counterTerms,
        lastCounterOfferAt: new Date(),
        negotiationStatus: "ACTIVE",
      },
      include: {
        car: { select: { title: true, basePrice: true } },
        negotiationHistory: { orderBy: { createdAt: "asc" } },
      },
    });

    // Alert the business on both channels.
    const adminMessage = `💬 New Counter-Offer!\n\n${lead.buyerName} counter-offered on ${lead.car.title}\n\n${counterPrice ? `💰 Their Price: MK ${parseFloat(counterPrice).toLocaleString()}\n` : ""}${counterTerms ? `💳 Terms: ${counterTerms}\n` : ""}${counterMessage ? `📝 Message: ${counterMessage}\n` : ""}\n📞 Phone: ${lead.buyerPhone}\n🔗 Ref: ${lead.referenceNumber}\n\nRespond in admin panel.`;

    await notificationService.notifyAdmin(
      "Counter-Offer Received - GaliMotors Admin",
      adminMessage,
    );

    // Click-to-chat link for the CUSTOMER to send this offer to GaliMotors.
    // Built with buildWhatsAppUrl rather than string concatenation: the
    // hand-rolled version here produced "wa.me/null" whenever no business
    // number was configured. Null instead means the UI omits the button.
    const adminWhatsApp = await getAdminWhatsApp();
    const customerWhatsAppMessage = `Hi GaliMotors! 👋\n\nI'm responding to my quote for the ${lead.car.title} (Ref: ${lead.referenceNumber}).\n\n${counterPrice ? `💰 My Offer: MK ${parseFloat(counterPrice).toLocaleString()}\n` : ""}${counterTerms ? `💳 Terms: ${counterTerms}\n` : ""}${counterMessage ? `\n📝 ${counterMessage}\n` : ""}`;
    const whatsappUrl = buildWhatsAppUrl(adminWhatsApp, customerWhatsAppMessage);

    // Build updated conversation
    const conversation = buildConversationTrail(updatedLead);

    res.status(201).json({
      message: "Counter-offer submitted successfully",
      lead: updatedLead,
      negotiationOffer,
      conversation,
      whatsappMessage: customerWhatsAppMessage,
      whatsappUrl,
    });
  } catch (error) {
    console.error("Counter-offer error:", error);
    res.status(500).json({ message: "Failed to submit counter-offer" });
  }
};

// Get full conversation trail by reference (Public)
export const getQuoteConversation = async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;
    const lead = await findLeadByReference(reference);

    if (!lead) {
      return res.status(404).json({ message: "Quote not found" });
    }

    const conversation = buildConversationTrail(lead);

    res.json({
      referenceNumber: lead.referenceNumber,
      status: lead.status,
      negotiationStatus: lead.negotiationStatus,
      quotedPrice: lead.quotedPrice,
      lastCounterOfferPrice: lead.lastCounterOfferPrice,
      conversation,
    });
  } catch (error) {
    console.error("Get quote conversation error:", error);
    res.status(500).json({ message: "Failed to fetch conversation" });
  }
};

// Get negotiation history for a lead (Admin — by lead ID)
export const getNegotiationHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        car: { select: { title: true, basePrice: true } },
        negotiationHistory: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const conversation = buildConversationTrail(lead);

    res.json({
      leadId: lead.id,
      referenceNumber: lead.referenceNumber,
      carTitle: lead.car?.title,
      basePrice: lead.car?.basePrice,
      customerName: lead.buyerName,
      currentPrice: lead.quotedPrice,
      lastCounterOfferPrice: lead.lastCounterOfferPrice,
      negotiationStatus: lead.negotiationStatus,
      history: lead.negotiationHistory,
      conversation,
    });
  } catch (error) {
    console.error("Get negotiation history error:", error);
    res.status(500).json({ message: "Failed to fetch negotiation history" });
  }
};

// Admin respond to counter-offer
export const respondToCounterOffer = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { responsePrice, responseTerms, responseMessage, status } = req.body;

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        car: { select: { title: true, basePrice: true } },
        negotiationHistory: true,
      },
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Create admin response as a negotiation trail entry
    const adminResponseEntry = await prisma.negotiationOffer.create({
      data: {
        leadId: id,
        type: "ADMIN_COUNTER_RESPONSE",
        senderName: await getAdminName(req),
        offeredPrice: responsePrice ? parseFloat(responsePrice) : undefined,
        proposedTerms: responseTerms || null,
        message: responseMessage || null,
        status: status || "PENDING",
      },
    });

    // Determine new lead status based on admin's action
    const newNegotiationStatus = status === "ACCEPTED" ? "ACCEPTED" : status === "REJECTED" ? "REJECTED" : "ACTIVE";
    const newLeadStatus = status === "ACCEPTED" ? "QUOTE_ACCEPTED" : status === "REJECTED" ? "CLOSED_LOST" : "NEGOTIATION";

    // Update lead
    const updatedLead = await prisma.lead.update({
      where: { id },
      data: {
        quotedPrice: responsePrice ? parseFloat(responsePrice) : lead.quotedPrice,
        paymentTerms: responseTerms || lead.paymentTerms,
        adminResponseToCounterOffer: responseMessage,
        adminResponse: responseMessage,
        negotiationStatus: newNegotiationStatus,
        status: newLeadStatus,
      },
      include: LEAD_DETAIL_INCLUDE,
    });

    // Generate WhatsApp message for admin to send to customer
    const whatsappMessage = `Hi ${lead.buyerName}! 👋\n\nWe've responded to your offer on ${lead.car.title}.\n\n${responsePrice ? `💰 Our Price: MK ${parseFloat(responsePrice).toLocaleString()}\n` : ""}${responseTerms ? `💳 Terms: ${responseTerms}\n` : ""}${responseMessage ? `\n📝 ${responseMessage}\n` : ""}\n🔗 View & respond: ${getSiteUrl()}/quote/${lead.referenceNumber}\n\n- GaliMotors Team`;

    res.json({
      message: "Response sent successfully",
      lead: updatedLead,
      adminResponse: adminResponseEntry,
      whatsappMessage,
      whatsappUrl: buildWhatsAppUrl(lead.buyerPhone, whatsappMessage),
    });
  } catch (error) {
    console.error("Admin counter-offer response error:", error);
    res.status(500).json({ message: "Failed to send response" });
  }
};

// Get lead with full negotiation details (Admin only)
export const getLeadDetails = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        car: {
          select: {
            id: true,
            title: true,
            basePrice: true,
            year: true,
            mileage: true,
            fuelType: true,
            transmission: true,
            bodyType: { select: { name: true } },
          },
        },
        negotiationHistory: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const conversation = buildConversationTrail(lead);

    res.json({
      id: lead.id,
      referenceNumber: lead.referenceNumber,
      buyerName: lead.buyerName,
      buyerPhone: lead.buyerPhone,
      buyerEmail: lead.buyerEmail,
      initialMessage: lead.message,
      type: lead.type,
      status: lead.status,
      leadSource: lead.leadSource,
      car: lead.car,
      quotedPrice: lead.quotedPrice,
      adminResponse: lead.adminResponse,
      paymentTerms: lead.paymentTerms,
      quoteSentAt: lead.quoteSentAt,
      customerViewedAt: lead.customerViewedAt,
      negotiationStatus: lead.negotiationStatus,
      lastCounterOfferPrice: lead.lastCounterOfferPrice,
      lastCounterOfferTerms: lead.lastCounterOfferTerms,
      lastCounterOfferAt: lead.lastCounterOfferAt,
      adminResponseToCounterOffer: lead.adminResponseToCounterOffer,
      negotiationHistory: lead.negotiationHistory,
      conversation,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    });
  } catch (error) {
    console.error("Get lead details error:", error);
    res.status(500).json({ message: "Failed to fetch lead details" });
  }
};

// ========================================================== //
// ============== VIEWING CONVERSATION SYSTEM =============== //
// ========================================================== //

/**
 * Build a structured conversation trail from a lead and its viewing messages
 */
const buildViewingConversationTrail = (lead: any) => {
  const trail: any[] = [];
  
  // 1. Initial request from customer
  trail.push({
    id: `req-${lead.id}`,
    type: "CUSTOMER_REQUEST",
    sender: "customer",
    title: "Viewing Request",
    content: lead.message || "Requested to view this vehicle",
    timestamp: lead.createdAt,
    metadata: {
      buyerDistrict: lead.buyerDistrict,
      carDistrict: lead.carDistrict,
      roundTripDistanceKm: lead.roundTripDistanceKm,
      calculatedTotalCost: lead.calculatedTotalCost
    }
  });

  // 2. Add all viewing messages
  if (lead.viewingMessages && lead.viewingMessages.length > 0) {
    lead.viewingMessages.forEach((msg: any) => {
      let title = "";
      if (msg.type === "CUSTOMER_REQUEST") title = "Viewing Request Update";
      else if (msg.type === "ADMIN_COST_QUOTE") title = "Viewing Cost Estimate";
      else if (msg.type === "CUSTOMER_PAYMENT") title = "Payment Uploaded";
      else if (msg.type === "ADMIN_PAYMENT_VERIFIED") title = "Payment Verified";
      else if (msg.type === "ADMIN_PAYMENT_REJECTED") title = "Payment Rejected";
      else if (msg.type === "ADMIN_VIEWING_SCHEDULED") title = "Viewing Scheduled";
      else if (msg.type === "CUSTOMER_MESSAGE") title = "Message from You";
      else if (msg.type === "ADMIN_MESSAGE") title = "Message from Admin";
      else title = "Message";

      trail.push({
        id: msg.id,
        type: msg.type,
        sender: msg.sender,
        // Lets the customer page show which team member replied.
        senderName: msg.senderName || null,
        title,
        content: msg.message,
        timestamp: msg.createdAt,
        metadata: {
          costBreakdown: msg.costBreakdown ? JSON.parse(msg.costBreakdown) : null,
          scheduledDate: msg.scheduledDate,
          scheduledTime: msg.scheduledTime,
          scheduledLocation: msg.scheduledLocation,
        }
      });
    });
  }

  // Sort by timestamp
  return trail.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
};

export const getViewingByReference = async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;

    const lead = await prisma.lead.findUnique({
      where: { referenceNumber: reference },
      include: {
        car: {
          include: {
            images: { take: 1, orderBy: { isPrimary: "desc" } },
            maker: { select: { name: true } },
            model: { select: { name: true } },
          },
        },
        viewingMessages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!lead) return res.status(404).json({ message: "Viewing request not found" });

    // Only allow viewing if type is related to viewing
    if (!lead.type.includes("VIEWING")) {
        return res.status(400).json({ message: "Not a viewing request" });
    }

    const conversation = buildViewingConversationTrail(lead);

    res.json({
      id: lead.id,
      referenceNumber: lead.referenceNumber,
      status: lead.status,
      paymentStatus: lead.paymentStatus,
      paymentAmount: lead.paymentAmount,
      buyerName: lead.buyerName,
      buyerPhone: lead.buyerPhone,
      car: lead.car,
      conversation,
    });
  } catch (error) {
    console.error("Get viewing error:", error);
    res.status(500).json({ message: "Failed to fetch viewing request" });
  }
};

export const getViewingConversation = async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;
    const lead = await prisma.lead.findUnique({
      where: { referenceNumber: reference },
      include: { viewingMessages: { orderBy: { createdAt: "asc" } } },
    });
    if (!lead) return res.status(404).json({ message: "Viewing request not found" });
    const conversation = buildViewingConversationTrail(lead);
    res.json(conversation);
  } catch (error) {
    console.error("Get viewing conversation error:", error);
    res.status(500).json({ message: "Failed to fetch viewing conversation" });
  }
};

export const addViewingMessage = async (req: Request, res: Response) => {
  try {
    const { reference } = req.params;
    const { message } = req.body;

    const lead = await prisma.lead.findUnique({
      where: { referenceNumber: reference },
      include: { car: true }
    });
    if (!lead) return res.status(404).json({ message: "Viewing request not found" });

    const newMsg = await prisma.viewingMessage.create({
      data: {
        leadId: lead.id,
        type: "CUSTOMER_MESSAGE",
        sender: "customer",
        senderName: lead.buyerName,
        message,
      }
    });
    
    // Alert the business on both channels.
    await notificationService.notifyAdmin(
      "New Viewing Message - GaliMotors Admin",
      `New message on Viewing Request ${lead.referenceNumber} for ${lead.car.title} from ${lead.buyerName}:\n\n"${message}"`,
    );

    res.json(newMsg);
  } catch (error) {
    console.error("Add viewing message error:", error);
    res.status(500).json({ message: "Failed to add viewing message" });
  }
};

export const adminRespondViewing = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { message, scheduledDate, scheduledTime, scheduledLocation } = req.body;

    const lead = await prisma.lead.findUnique({ where: { id }, include: { car: true } });
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const isScheduling = !!(scheduledDate && scheduledTime && scheduledLocation);

    const newMsg = await prisma.viewingMessage.create({
      data: {
        leadId: lead.id,
        type: isScheduling ? "ADMIN_VIEWING_SCHEDULED" : "ADMIN_MESSAGE",
        sender: "admin",
        senderName: await getAdminName(req),
        message,
        scheduledDate,
        scheduledTime,
        scheduledLocation,
      }
    });

    if (isScheduling) {
      await prisma.lead.update({
        where: { id },
        data: { status: "VIEWING_SCHEDULED" }
      });
    }

    // Send WhatsApp to customer with link to view
    const frontendUrl = getSiteUrl();
    const viewingUrl = `${frontendUrl}/viewing/${lead.referenceNumber}`;
    
    await notificationService.sendNotification({
      to: lead.buyerPhone,
      message: `Hi ${lead.buyerName}, GaliMotors has responded to your viewing request for the ${lead.car.title}.\n\nView update here: ${viewingUrl}`,
      subject: "Viewing Request Update",
      type: "whatsapp",
    });

    res.json(newMsg);
  } catch (error) {
    console.error("Admin respond viewing error:", error);
    res.status(500).json({ message: "Failed to respond" });
  }
};

export const adminSendViewingCostQuote = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { costBreakdown, message } = req.body;

    const lead = await prisma.lead.findUnique({ where: { id }, include: { car: true } });
    if (!lead) return res.status(404).json({ message: "Lead not found" });

    const newMsg = await prisma.viewingMessage.create({
      data: {
        leadId: lead.id,
        type: "ADMIN_COST_QUOTE",
        sender: "admin",
        senderName: await getAdminName(req),
        message,
        costBreakdown: JSON.stringify(costBreakdown),
      }
    });
    
    if (costBreakdown && costBreakdown.totalCost) {
        await prisma.lead.update({
            where: { id },
            data: { 
                calculatedTotalCost: costBreakdown.totalCost,
                paymentAmount: costBreakdown.totalCost
            }
        });
    }

    // Send WhatsApp to customer with link to view
    const frontendUrl = getSiteUrl();
    const viewingUrl = `${frontendUrl}/viewing/${lead.referenceNumber}`;
    
    await notificationService.sendNotification({
      to: lead.buyerPhone,
      message: `Hi ${lead.buyerName}, GaliMotors has sent a viewing cost estimate for the ${lead.car.title}.\n\nView details here: ${viewingUrl}`,
      subject: "Viewing Cost Estimate",
      type: "whatsapp",
    });

    res.json(newMsg);
  } catch (error) {
    console.error("Admin viewing cost quote error:", error);
    res.status(500).json({ message: "Failed to send cost quote" });
  }
};


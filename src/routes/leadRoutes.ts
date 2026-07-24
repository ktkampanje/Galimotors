import { Router } from "express";
import { createInquiryLead, getLeads, updateLeadPayment, updateLeadStatus, verifyPayment, getPendingPayments, getPrioritizedLeads, getLeadScore, getLeadScoringInsights, trackCallAttempt, getLeadTimeline, getMyInquiries, sendQuote, getQuoteByReference, getQuoteConversation, acceptQuote, declineQuote, submitCounterOffer, getNegotiationHistory, respondToCounterOffer, getLeadDetails, getViewingByReference, getViewingConversation, addViewingMessage, adminRespondViewing, adminSendViewingCostQuote } from "../controllers/leadController";
import { authenticate, authorize } from "../middleware/auth";
import { inquiryRateLimit, guestActionRateLimit } from "../middleware/security";
import { phoneRateLimit } from "../middleware/phoneRateLimit";
import { optionalCustomerAuth, authenticateCustomer } from "../middleware/customerAuth";

const router = Router();

// Guests may submit inquiries and book viewings with just name + phone —
// forcing registration up front loses customers in this market. Tracking is
// preserved through the phone number: registration claims any guest leads
// with the same phone (see registerCustomer), so history is never orphaned
// for someone who later creates an account. (IP + phone rate limited.)
router.post("/inquire", inquiryRateLimit, phoneRateLimit, optionalCustomerAuth, createInquiryLead);

// Customer route to get their own inquiries
router.get("/my-inquiries", authenticateCustomer, getMyInquiries);

// ============== QUOTE SYSTEM ROUTES ============== //

// Public route to view quote by reference number (no auth needed)
router.get("/quote/:reference", getQuoteByReference);

// Public route to get full conversation trail by reference
router.get("/quote/:reference/conversation", getQuoteConversation);

// Public routes for customer actions on quotes (by REFERENCE NUMBER — secure).
// Throttled: unguessable reference gates access; this only blunts spam.
router.post("/quote/:reference/accept", guestActionRateLimit, acceptQuote);
router.post("/quote/:reference/decline", guestActionRateLimit, declineQuote);
router.post("/quote/:reference/counter-offer", guestActionRateLimit, submitCounterOffer);

// Admin route to send quote (by lead ID — behind admin auth)
router.post("/:id/send-quote", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), sendQuote);

// Admin route to get negotiation history (by lead ID — behind admin auth)
router.get("/:id/negotiation-history", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), getNegotiationHistory);

// Admin route to respond to counter-offer (by lead ID — behind admin auth)
router.post("/:id/respond-to-counter", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), respondToCounterOffer);

// Admin route to get full lead details including negotiation
router.get("/:id/details", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), getLeadDetails);

// ===================================================== //

// ============== VIEWING SYSTEM ROUTES ============== //

// Public route to view viewing request by reference number
router.get("/viewing/:reference", getViewingByReference);

// Public route to get full viewing conversation trail by reference
router.get("/viewing/:reference/conversation", getViewingConversation);

// Public route for customer to send message in viewing conversation
router.post("/viewing/:reference/message", guestActionRateLimit, addViewingMessage);

// Admin route to respond to viewing request
router.post("/:id/viewing-respond", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), adminRespondViewing);

// Admin route to send viewing cost quote
router.post("/:id/viewing-cost-quote", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), adminSendViewingCostQuote);

// ===================================================== //

// Public route to update lead with POP (used for Viewings/Reservations).
// Only ever sets PENDING_VERIFICATION; an admin verifies separately.
router.patch("/:id/payment", guestActionRateLimit, updateLeadPayment);

// Admin route to update lead status
router.patch("/:id/status", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), updateLeadStatus);

// Admin route to track call attempt
router.post("/:id/call-attempt", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), trackCallAttempt);

// Admin route to get lead timeline
router.get("/:id/timeline", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), getLeadTimeline);

// Admin route to verify/reject payment
router.post("/:id/verify-payment", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), verifyPayment);

// Admin route to get pending payment verifications
router.get("/pending-payments", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), getPendingPayments);

// Admin route to manage leads
router.get("/", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), getLeads);

// Lead scoring routes
router.get("/prioritized", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), getPrioritizedLeads);
router.get("/scoring-insights", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), getLeadScoringInsights);
router.get("/:id/score", authenticate, authorize(["SUPER_ADMIN", "SUB_ADMIN"]), getLeadScore);

export default router;


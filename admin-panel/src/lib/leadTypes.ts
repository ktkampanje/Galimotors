/**
 * Lead.type partitions the two admin screens. Defined once here so the two
 * pages cannot drift into overlapping or leaving a gap between them.
 *
 *   INQUIRY              -> Customer Inquiries (unpaid, awaiting a quote)
 *   PAID_VIEWING_REQUEST -> Viewings (paid workflow)
 *   PAID_RESERVATION     -> Viewings (paid workflow)
 *
 * Reserving a car flips its lead to PAID_RESERVATION, so reservations must be
 * grouped with viewings — otherwise a lead an admin is actively working
 * disappears from Viewings the moment the car is reserved against it.
 *
 * Mirrors PAID_LEAD_TYPES in src/controllers/leadController.ts.
 */
export const PAID_LEAD_TYPES = ['PAID_VIEWING_REQUEST', 'PAID_RESERVATION'] as const;

export const INQUIRY_LEAD_TYPES = ['INQUIRY'] as const;

/** Human label for a lead type, used where both kinds appear in one list. */
export const leadTypeLabel = (type: string): string => {
  switch (type) {
    case 'PAID_VIEWING_REQUEST': return 'Viewing';
    case 'PAID_RESERVATION': return 'Reservation';
    case 'INQUIRY': return 'Inquiry';
    default: return type;
  }
};

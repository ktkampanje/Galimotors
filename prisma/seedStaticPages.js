/**
 * Seeds the editable footer/support pages.
 *
 * Content uses a markdown-lite syntax rendered to React elements client-side:
 *   ## Heading      -> section heading
 *   ### Subheading  -> sub heading
 *   - item          -> bullet
 *   blank line      -> new paragraph
 *
 * Text marked [TODO: ...] needs real business detail before launch and is
 * meant to be edited in the admin panel (Content Pages), not here. Re-running
 * this script will NOT overwrite pages you have already edited.
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const pages = [
  {
    slug: "how-to-buy",
    title: "How to Buy",
    subtitle: "From finding a vehicle to driving it home.",
    content: `## 1. Find your vehicle

Browse the full inventory from the homepage. Use the filters in the sidebar to narrow by make, body type, condition, district, year and price.

Every listing shows the asking price in Kwacha, the year, mileage, and whether the vehicle is duty paid and has a Blue Book available.

## 2. Check the details

Open a listing to see the full photo set, specifications and seller information.

- Vehicles marked **Platform Inspected** have been physically checked by our team
- **Duty Paid** means import duty has already been settled
- **Blue Book Available** means the registration book is on hand
- Prices marked **Negotiable** are open to reasonable offers

## 3. Make an enquiry

Use the enquiry form on any listing, or contact us directly on WhatsApp or by phone. Tell us which vehicle you are interested in and we will confirm availability.

We will respond with a written quote covering the vehicle price and any additional costs that apply.

## 4. Book a viewing

Once you are satisfied with the quote, book an official viewing through the listing page. Viewings are scheduled at a confirmed time and location.

A booking fee applies to secure the appointment. [TODO: confirm your viewing fee, whether it is refundable, and whether it is deducted from the purchase price.]

## 5. Inspect the vehicle

Inspect the vehicle in person at the agreed time. We encourage you to bring your own mechanic.

Take your time. Check the body, engine, interior, tyres and documentation against what was listed.

## 6. Payment and handover

Payment can be made by bank transfer, Airtel Money or TNM Mpamba. Account details are provided with your quote and shown at booking.

[TODO: describe your handover process — who transfers ownership, how long registration takes, what the buyer receives on the day.]

## Questions?

Call or WhatsApp us using the contact details at the bottom of any page. We are happy to walk you through any step.`,
  },
  {
    slug: "import-services",
    title: "Import Services",
    subtitle: "Sourcing vehicles to order from overseas.",
    content: `## What we do

If the vehicle you want is not in our current inventory, we can source it to order and handle the import process end to end.

[TODO: confirm which countries you import from — commonly Japan, UK, Singapore, South Africa — and your typical shipping route.]

## How it works

### 1. Tell us what you need

Share the make, model, year range, maximum mileage, transmission, and your budget. The more specific you are, the closer the match.

### 2. We source and quote

We search available stock and send you options with photos, specifications and auction or inspection grades where available.

Your quote will set out the vehicle cost and each additional charge separately, so you can see exactly what you are paying for.

### 3. You confirm and deposit

Once you approve a vehicle, a deposit secures it. [TODO: confirm your deposit percentage and whether it is refundable.]

### 4. Shipping and clearing

We handle shipping, customs clearance and duty payment. We keep you updated at each stage.

[TODO: confirm your typical timeline from order to delivery — buyers will ask this first.]

### 5. Delivery

The vehicle is registered and handed over to you. [TODO: confirm whether you deliver outside Lilongwe and any cost for that.]

## What affects the final cost

- The vehicle purchase price at source
- Shipping and freight
- Import duty and taxes
- Clearing and port charges
- Registration
- Our service fee

We quote each of these separately. You will not be surprised by a charge that was not in your quote.

## Start an import enquiry

Contact us on WhatsApp or by phone with your requirements and we will begin the search.`,
  },
  {
    slug: "faqs",
    title: "Frequently Asked Questions",
    subtitle: "Common questions from buyers and sellers.",
    content: `## Buying

### Are your prices negotiable?

Some are. Listings marked **Negotiable** are open to reasonable offers. Make your offer through the enquiry form or on WhatsApp.

### What does "duty paid" mean?

It means import duty on the vehicle has already been settled, so you will not face a further duty bill after purchase. Listings state this clearly.

### What does "Foreign Used (IT)" mean?

IT refers to a vehicle imported into Malawi that was previously used overseas, as distinct from a brand new vehicle or one used locally in Malawi.

### Can I inspect a vehicle before buying?

Yes, and we encourage it. Book an official viewing from the listing page. You are welcome to bring your own mechanic.

### Do you offer a warranty?

[TODO: state your warranty position clearly — whether any vehicles carry a warranty, and if so which and for how long. Buyers ask this often.]

### What payment methods do you accept?

Bank transfer, Airtel Money and TNM Mpamba. Account details are provided with your quote.

### Can I trade in my current vehicle?

[TODO: confirm whether you accept trade-ins and how you value them.]

## Selling

### How do I sell my car through GaliMotors?

Use the Sell Your Car link and send us your vehicle details. We will come back to you with a valuation.

### What does it cost to list?

[TODO: confirm your seller commission or listing fee structure.]

### How long does it take to sell?

This depends on the vehicle, condition and asking price. We will give you a realistic estimate when we value it.

## Viewings

### Is the viewing fee refundable?

[TODO: confirm your refund policy — this is the single most common question about viewings.]

### Can I reschedule a viewing?

[TODO: confirm your rescheduling policy and any notice period required.]

## Still need help?

Contact us on WhatsApp or by phone using the details at the bottom of any page.`,
  },
  {
    slug: "terms",
    title: "Terms of Service",
    subtitle: "The terms governing your use of GaliMotors.",
    content: `_Last updated: [TODO: insert date when you finalise these terms.]_

**These terms are a working template and are not yet legally reviewed. Have a qualified legal practitioner in Malawi review them before you rely on them.**

## 1. About us

GaliMotors is a vehicle brokerage operating in Malawi.

[TODO: insert your registered company name, company registration number, and registered business address.]

## 2. What we do

We list vehicles for sale, connect buyers with sellers, arrange viewings, and provide import sourcing services.

[TODO: state clearly whether you sell as principal, act as agent for sellers, or both. This distinction determines who is legally responsible to the buyer and matters a great deal.]

## 3. Using this website

By using this website you agree to use it lawfully and not to misuse it, interfere with its operation, or attempt unauthorised access.

You are responsible for keeping your account details secure and for activity under your account.

## 4. Listings and information

We take care to describe vehicles accurately. Specifications, mileage and condition are provided in good faith based on information available to us.

[TODO: state the extent to which you warrant listing accuracy, and what happens if a listing turns out to be materially wrong.]

Listing prices are subject to change and availability. A listing is not a binding offer to sell.

## 5. Viewings and bookings

Viewing appointments require a booking fee.

[TODO: set out the fee, whether it is refundable, in what circumstances it is refunded, and your rescheduling and no-show policy.]

## 6. Payment

Accepted payment methods are set out in your quote.

[TODO: set out when payment is due, what happens on late or failed payment, and at what point a vehicle is considered sold.]

## 7. Passing of ownership

[TODO: state when ownership and risk pass to the buyer, and who is responsible for registration and transfer.]

## 8. Vehicle condition

[TODO: state your position on vehicle condition — whether vehicles are sold as-seen, what inspection means, and what recourse a buyer has after purchase. This is the clause most likely to be disputed, so it needs to be precise.]

## 9. Limitation of liability

[TODO: this clause must be drafted by a legal practitioner. Limitation of liability wording that is not enforceable under Malawian law offers you no protection.]

## 10. Governing law

These terms are governed by the laws of Malawi.

## 11. Changes to these terms

We may update these terms. The current version is always available on this page.

## 12. Contact

Questions about these terms can be sent to us using the contact details at the bottom of any page.`,
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    subtitle: "How we handle your personal information.",
    content: `_Last updated: [TODO: insert date when you finalise this policy.]_

**This policy is a working template and is not yet legally reviewed. Have a qualified legal practitioner in Malawi review it before you rely on it.**

## 1. Who we are

GaliMotors is a vehicle brokerage operating in Malawi and is responsible for the personal information described in this policy.

[TODO: insert your registered company name and registered business address.]

## 2. Information we collect

When you create an account or make an enquiry we collect:

- Your name
- Your phone number
- Your email address
- Your district

When you book a viewing we additionally collect:

- Your chosen appointment details
- Payment reference information you provide

We also record which vehicles you view and save, so we can show you your recently viewed and saved cars.

[TODO: confirm this list is complete and matches what you actually store. Add anything collected offline, such as copies of identity documents taken at handover.]

## 3. How we use your information

We use your information to:

- Respond to your enquiries and send you quotes
- Arrange and confirm viewing appointments
- Process payments
- Keep your saved and recently viewed vehicles available to you
- Contact you about a transaction you have started

[TODO: state whether you use contact details for marketing, and if so how a customer opts out.]

## 4. Who we share it with

[TODO: list who receives customer data. At minimum this is likely to include your payment providers and, for imports, shipping and clearing agents. Customers are entitled to know this.]

We do not sell your personal information.

## 5. How long we keep it

[TODO: state your retention periods — how long you keep enquiry records, completed transaction records, and account data after an account becomes inactive.]

## 6. Security

We take reasonable measures to protect your information against unauthorised access, loss and misuse.

[TODO: describe your actual safeguards in plain terms. Do not claim protections you do not have in place.]

## 7. Your rights

You may request a copy of the personal information we hold about you, ask us to correct it if it is wrong, or ask us to delete it.

[TODO: confirm how a customer makes such a request and how quickly you will respond.]

## 8. Cookies and local storage

This website stores information in your browser to keep you signed in and to remember vehicles you have viewed or saved.

[TODO: confirm whether you use any analytics or advertising trackers. If you do, they must be disclosed here.]

## 9. Changes to this policy

We may update this policy. The current version is always available on this page.

## 10. Contact

Questions about this policy, or requests relating to your information, can be sent to us using the contact details at the bottom of any page.`,
  },
];

async function main() {
  let created = 0;
  let skipped = 0;

  for (const page of pages) {
    const existing = await prisma.staticPage.findUnique({
      where: { slug: page.slug },
    });

    if (existing) {
      // Never clobber copy an admin has already edited.
      skipped += 1;
      console.log(`skip   ${page.slug} (already exists)`);
      continue;
    }

    await prisma.staticPage.create({ data: page });
    created += 1;
    console.log(`create ${page.slug}`);
  }

  console.log(`\nDone. ${created} created, ${skipped} left untouched.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("Seed failed:", e);
  await prisma.$disconnect();
  process.exit(1);
});

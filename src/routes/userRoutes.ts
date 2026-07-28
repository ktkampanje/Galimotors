import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { hashPassword, comparePassword, validatePasswordStrength, sanitizeEmail } from "../utils/auth";
import activityLogService from "../services/activityLogService";

const router = Router();

/**
 * Staff account management.
 *
 * Roles a super admin can hand out here: SUB_ADMIN, SELLER, MARKET_ATTENDANT.
 *  - SUPER_ADMIN is never creatable: the sole super admin is enforced from the
 *    server environment (SUPER_ADMIN_EMAIL) on every boot — any extra super
 *    would be demoted automatically, so offering it would only mislead.
 *  - CUSTOMER accounts come from the storefront registration flow, not here.
 *
 * A SELLER or MARKET_ATTENDANT login is useless without a linked profile —
 * every permission check resolves through Seller.userId / MarketAttendant
 * .userId. So creation REQUIRES the profile: either link an existing
 * unclaimed profile or create one, atomically with the user row.
 */
const CREATABLE_ROLES = ["SUB_ADMIN", "SELLER", "MARKET_ATTENDANT"];
const STAFF_ROLES = ["SUPER_ADMIN", "SUB_ADMIN", "SELLER", "MARKET_ATTENDANT"];

const isEnvSuperAdmin = (email: string) => {
  const managed = process.env.SUPER_ADMIN_EMAIL;
  return !!managed && sanitizeEmail(managed) === sanitizeEmail(email);
};

const profileInclude = {
  sellerProfile: {
    select: {
      id: true, name: true, district: true, phone: true, sellerType: true,
      market: { select: { id: true, name: true } },
    },
  },
  attendantProfile: {
    select: {
      id: true, name: true, phone: true,
      market: { select: { id: true, name: true } },
    },
  },
} as const;

const publicUser = (u: any) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  createdAt: u.createdAt,
  managed: isEnvSuperAdmin(u.email),
  sellerProfile: u.sellerProfile ?? null,
  attendantProfile: u.attendantProfile ?? null,
});

/**
 * Resolve the seller/attendant profile side of a create or role change.
 * Returns a function to run inside the transaction after the user row exists,
 * or a validation error message.
 */
const buildProfileStep = async (
  role: string,
  body: any,
): Promise<{ error: string } | { run: (tx: any, userId: string, userName: string) => Promise<void> }> => {
  if (role === "SELLER") {
    if (body.linkSellerId) {
      const seller = await prisma.seller.findUnique({ where: { id: body.linkSellerId }, select: { id: true, userId: true, name: true } });
      if (!seller) return { error: "The selected seller profile no longer exists." };
      if (seller.userId) return { error: `Seller "${seller.name}" is already linked to another login.` };
      return {
        run: async (tx, userId) => {
          // Handing out a login implies approval — an unapproved seller
          // cannot list cars, which would make the account pointless.
          await tx.seller.update({ where: { id: seller.id }, data: { userId, sellerStatus: "APPROVED" } });
        },
      };
    }
    const { phone, district } = body;
    if (!phone || !district) return { error: "A new seller profile needs a phone number and district." };
    return {
      run: async (tx, userId, userName) => {
        await tx.seller.create({
          data: {
            name: userName,
            phone: String(phone),
            district: String(district),
            sellerType: body.sellerType === "DEALER" ? "DEALER" : "INDIVIDUAL",
            marketId: body.marketId || null,
            sellerStatus: "APPROVED",
            userId,
          },
        });
      },
    };
  }

  if (role === "MARKET_ATTENDANT") {
    if (body.linkAttendantId) {
      const attendant = await prisma.marketAttendant.findUnique({ where: { id: body.linkAttendantId }, select: { id: true, userId: true, name: true } });
      if (!attendant) return { error: "The selected attendant profile no longer exists." };
      if (attendant.userId) return { error: `Attendant "${attendant.name}" is already linked to another login.` };
      return { run: async (tx, userId) => { await tx.marketAttendant.update({ where: { id: attendant.id }, data: { userId } }); } };
    }
    const { phone, marketId } = body;
    if (!phone) return { error: "A new attendant profile needs a phone number." };
    if (!marketId) return { error: "A market attendant must be assigned to a market." };
    const market = await prisma.market.findUnique({ where: { id: marketId }, select: { id: true } });
    if (!market) return { error: "The selected market no longer exists." };
    return {
      run: async (tx, userId, userName) => {
        await tx.marketAttendant.create({ data: { name: userName, phone: String(phone), marketId, userId } });
      },
    };
  }

  return { run: async () => { /* SUB_ADMIN needs no profile */ } };
};

// ── Own profile (declared BEFORE /:id, which would otherwise swallow "profile") ──

router.get("/profile", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: profileInclude,
    });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(publicUser(user));
  } catch (error) {
    console.error("Failed to fetch user profile:", error);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

router.put("/profile", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, currentPassword, newPassword } = req.body;
    const existing = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!existing) return res.status(404).json({ error: "User not found" });

    const updateData: any = {};
    if (name) updateData.name = String(name);

    if (newPassword) {
      if (isEnvSuperAdmin(existing.email)) {
        return res.status(400).json({ error: "This account's password is set by the server configuration (SUPER_ADMIN_PASSWORD) and cannot be changed here." });
      }
      if (!currentPassword) return res.status(400).json({ error: "Current password is required to set a new password" });
      if (!(await comparePassword(currentPassword, existing.password))) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }
      const strength = validatePasswordStrength(newPassword);
      if (!strength.valid) return res.status(400).json({ error: strength.errors.join(" ") });
      updateData.password = await hashPassword(newPassword);
    }

    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: updateData,
      include: profileInclude,
    });

    await activityLogService.logFromRequest(req, "UPDATE_PROFILE", "User", existing.id,
      { name: existing.name }, { name: updated.name });

    res.json(publicUser(updated));
  } catch (error) {
    console.error("Failed to update profile:", error);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// ── Staff administration (SUPER_ADMIN only) ─────────────────────────────

router.get("/", authenticate, authorize(["SUPER_ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: STAFF_ROLES } },
      include: profileInclude,
      orderBy: { createdAt: "desc" },
    });
    await activityLogService.logFromRequest(req, "VIEW_USERS", "User");
    res.json(users.map(publicUser));
  } catch (error) {
    console.error("Failed to fetch users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

/** Unclaimed profiles the create form can link a new login to. */
router.get("/linkable-profiles", authenticate, authorize(["SUPER_ADMIN"]), async (_req: AuthRequest, res: Response) => {
  try {
    const [sellers, attendants] = await Promise.all([
      prisma.seller.findMany({
        where: { userId: null },
        select: { id: true, name: true, phone: true, district: true, sellerType: true, market: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.marketAttendant.findMany({
        where: { userId: null },
        select: { id: true, name: true, phone: true, market: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
    ]);
    res.json({ sellers, attendants });
  } catch (error) {
    console.error("Failed to fetch linkable profiles:", error);
    res.status(500).json({ error: "Failed to fetch linkable profiles" });
  }
});

router.post("/", authenticate, authorize(["SUPER_ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "Name, email, password and role are all required" });
    }
    if (!CREATABLE_ROLES.includes(role)) {
      return res.status(400).json({ error: `Role must be one of: ${CREATABLE_ROLES.join(", ")}. The super admin account is managed by the server configuration.` });
    }

    const cleanEmail = sanitizeEmail(String(email));
    if (await prisma.user.findUnique({ where: { email: cleanEmail } })) {
      return res.status(400).json({ error: "An account with this email already exists" });
    }

    const strength = validatePasswordStrength(String(password));
    if (!strength.valid) return res.status(400).json({ error: strength.errors.join(" ") });

    const profileStep = await buildProfileStep(role, req.body);
    if ("error" in profileStep) return res.status(400).json({ error: profileStep.error });

    const hashed = await hashPassword(String(password));
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name: String(name), email: cleanEmail, password: hashed, role },
      });
      await profileStep.run(tx, user.id, user.name);
      return user;
    });

    const withProfile = await prisma.user.findUnique({ where: { id: created.id }, include: profileInclude });

    await activityLogService.logFromRequest(req, "CREATE_USER", "User", created.id, null,
      { name: created.name, email: created.email, role: created.role });

    res.status(201).json(publicUser(withProfile));
  } catch (error) {
    console.error("Failed to create user:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.put("/:id", authenticate, authorize(["SUPER_ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, password, role } = req.body;

    const existing = await prisma.user.findUnique({ where: { id }, include: profileInclude });
    if (!existing || !STAFF_ROLES.includes(existing.role)) {
      return res.status(404).json({ error: "User not found" });
    }
    if (isEnvSuperAdmin(existing.email)) {
      return res.status(400).json({ error: "The super admin account is managed by the server configuration (SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD) and cannot be edited here." });
    }

    const updateData: any = {};
    if (name) updateData.name = String(name);

    if (email) {
      const cleanEmail = sanitizeEmail(String(email));
      if (cleanEmail !== existing.email) {
        if (await prisma.user.findUnique({ where: { email: cleanEmail } })) {
          return res.status(400).json({ error: "An account with this email already exists" });
        }
        updateData.email = cleanEmail;
      }
    }

    if (password) {
      const strength = validatePasswordStrength(String(password));
      if (!strength.valid) return res.status(400).json({ error: strength.errors.join(" ") });
      updateData.password = await hashPassword(String(password));
    }

    // Role changes keep the profile links coherent: leaving SELLER/ATTENDANT
    // releases the profile (so it can be re-linked later); switching into one
    // of those roles requires a profile, same as creation.
    let profileStep: { run: (tx: any, userId: string, userName: string) => Promise<void> } | null = null;
    if (role && role !== existing.role) {
      if (!CREATABLE_ROLES.includes(role)) {
        return res.status(400).json({ error: `Role must be one of: ${CREATABLE_ROLES.join(", ")}` });
      }
      updateData.role = role;
      if (["SELLER", "MARKET_ATTENDANT"].includes(role)) {
        const step = await buildProfileStep(role, req.body);
        if ("error" in step) return res.status(400).json({ error: step.error });
        profileStep = step;
      }
    } else if (
      // Repair path: accounts created before profile linking existed can be
      // SELLER/ATTENDANT with no profile — which scopes them to nothing.
      // Editing such an account with link/create details attaches one.
      ((existing.role === "SELLER" && !existing.sellerProfile) ||
        (existing.role === "MARKET_ATTENDANT" && !existing.attendantProfile)) &&
      (req.body.linkSellerId || req.body.linkAttendantId || req.body.phone)
    ) {
      const step = await buildProfileStep(existing.role, req.body);
      if ("error" in step) return res.status(400).json({ error: step.error });
      profileStep = step;
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (updateData.role && updateData.role !== existing.role) {
        if (existing.role === "SELLER" && existing.sellerProfile) {
          await tx.seller.update({ where: { id: existing.sellerProfile.id }, data: { userId: null } });
        }
        if (existing.role === "MARKET_ATTENDANT" && existing.attendantProfile) {
          await tx.marketAttendant.update({ where: { id: existing.attendantProfile.id }, data: { userId: null } });
        }
      }
      const user = await tx.user.update({ where: { id }, data: updateData });
      if (profileStep) await profileStep.run(tx, user.id, user.name);
      return user;
    });

    const withProfile = await prisma.user.findUnique({ where: { id }, include: profileInclude });

    await activityLogService.logFromRequest(req, "UPDATE_USER", "User", id,
      { name: existing.name, email: existing.email, role: existing.role },
      { name: updated.name, email: updated.email, role: updated.role });

    res.json(publicUser(withProfile));
  } catch (error) {
    console.error("Failed to update user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.delete("/:id", authenticate, authorize(["SUPER_ADMIN"]), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (req.user!.userId === id) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }

    const target = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true, role: true } });
    if (!target || !STAFF_ROLES.includes(target.role)) {
      return res.status(404).json({ error: "User not found" });
    }
    if (isEnvSuperAdmin(target.email)) {
      return res.status(400).json({ error: "The super admin account is managed by the server configuration and cannot be deleted." });
    }

    // Seller/attendant profiles release automatically (userId → null via the
    // relation's onDelete: SetNull) — the profile and its cars stay intact.
    await prisma.user.delete({ where: { id } });

    await activityLogService.logFromRequest(req, "DELETE_USER", "User", id, target, null);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Failed to delete user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

export default router;

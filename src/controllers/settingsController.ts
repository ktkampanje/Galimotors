import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { toWhatsAppNumber } from "../lib/whatsapp";
import { invalidateBusinessContactCache } from "../lib/businessContact";

export const getGlobalSettings = async (req: Request, res: Response) => {
  try {
    const settings = await prisma.globalSettings.findUnique({
      where: { id: "SETTINGS_SINGLETON" },
    });
    
    // If no settings exist yet, return defaults
    if (!settings) {
      return res.json({
        driverAllowance: 15000,
        accommodationFee: 25000,
        adminWhatsApp: '265990000000',
        adminPhone: '265990000000',
        businessEmail: 'info@galimotors.com',
        bankName: 'National Bank of Malawi',
        bankAccountName: 'GaliMotors Ltd',
        bankAccountNumber: '100 234 5678',
        airtelMoneyName: '',
        airtelMoneyNumber: '',
        tnmMpambaName: '',
        tnmMpambaNumber: ''
      });
    }
    
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch settings" });
  }
};

export const updateGlobalSettings = async (req: Request, res: Response) => {
  try {
    const {
      driverAllowance, accommodationFee, adminWhatsApp, adminPhone, businessEmail,
      bankName, bankAccountName, bankAccountNumber,
      airtelMoneyName, airtelMoneyNumber,
      tnmMpambaName, tnmMpambaNumber,
      facebookUrl, businessAddress, metaPixelId
    } = req.body;

    // Pixel IDs are 15-16 digit numbers from Meta Events Manager. Empty
    // clears the setting and disables tracking entirely.
    if (metaPixelId !== undefined && metaPixelId !== "" &&
        !/^\d{15,16}$/.test(String(metaPixelId).trim())) {
      return res.status(400).json({
        message: "Meta Pixel ID must be the 15-16 digit number from Events Manager.",
        field: "metaPixelId",
      });
    }

    // A Facebook value must at least look like a facebook.com link — a typo'd
    // URL in the footer is worse than no icon. Empty string clears (hides) it.
    if (facebookUrl !== undefined && facebookUrl !== "" &&
        !/^https?:\/\/(www\.)?(facebook\.com|fb\.com)\/.+/i.test(String(facebookUrl).trim())) {
      return res.status(400).json({
        message: "Facebook link must be a full facebook.com URL, e.g. https://facebook.com/galimotors",
        field: "facebookUrl",
      });
    }
    
    // Contact numbers are normalised to digits-only international form before
    // storage, and rejected outright if unusable. These values are read back
    // to build wa.me links and to address notifications, so accepting free
    // text here would produce links that silently reach nobody.
    const normalisedWhatsApp =
      adminWhatsApp !== undefined ? toWhatsAppNumber(adminWhatsApp) : undefined;
    const normalisedPhone =
      adminPhone !== undefined ? toWhatsAppNumber(adminPhone) : undefined;

    if (adminWhatsApp !== undefined && !normalisedWhatsApp) {
      return res.status(400).json({
        message:
          "WhatsApp number is not a valid Malawian number. Use 0885086757, 265885086757 or +265 885 086 757.",
        field: "adminWhatsApp",
      });
    }
    if (adminPhone !== undefined && !normalisedPhone) {
      return res.status(400).json({
        message:
          "Phone number is not a valid Malawian number. Use 0885086757, 265885086757 or +265 885 086 757.",
        field: "adminPhone",
      });
    }

    // Build update object with only provided fields
    const updateData: any = {};
    if (driverAllowance !== undefined) updateData.driverAllowance = driverAllowance;
    if (accommodationFee !== undefined) updateData.accommodationFee = accommodationFee;
    if (normalisedWhatsApp !== undefined) updateData.adminWhatsApp = normalisedWhatsApp;
    if (normalisedPhone !== undefined) updateData.adminPhone = normalisedPhone;
    if (businessEmail !== undefined) updateData.businessEmail = businessEmail;
    
    if (bankName !== undefined) updateData.bankName = bankName;
    if (bankAccountName !== undefined) updateData.bankAccountName = bankAccountName;
    if (bankAccountNumber !== undefined) updateData.bankAccountNumber = bankAccountNumber;
    
    if (airtelMoneyName !== undefined) updateData.airtelMoneyName = airtelMoneyName;
    if (airtelMoneyNumber !== undefined) updateData.airtelMoneyNumber = airtelMoneyNumber;
    
    if (tnmMpambaName !== undefined) updateData.tnmMpambaName = tnmMpambaName;
    if (tnmMpambaNumber !== undefined) updateData.tnmMpambaNumber = tnmMpambaNumber;

    if (facebookUrl !== undefined) updateData.facebookUrl = String(facebookUrl).trim();
    if (businessAddress !== undefined) updateData.businessAddress = String(businessAddress).trim();
    if (metaPixelId !== undefined) updateData.metaPixelId = String(metaPixelId).trim();
    
    const settings = await prisma.globalSettings.upsert({
      where: { id: "SETTINGS_SINGLETON" },
      update: updateData,
      create: { 
        id: "SETTINGS_SINGLETON", 
        driverAllowance: driverAllowance || 15000, 
        accommodationFee: accommodationFee || 25000,
        adminWhatsApp: normalisedWhatsApp || '265990000000',
        adminPhone: normalisedPhone || '265990000000',
        businessEmail: businessEmail || 'info@galimotors.com',
        bankName: bankName || 'National Bank of Malawi',
        bankAccountName: bankAccountName || 'GaliMotors Ltd',
        bankAccountNumber: bankAccountNumber || '100 234 5678',
        airtelMoneyName: airtelMoneyName || '',
        airtelMoneyNumber: airtelMoneyNumber || '',
        tnmMpambaName: tnmMpambaName || '',
        tnmMpambaNumber: tnmMpambaNumber || ''
      },
    });
    
    // Drop the cached numbers so a change takes effect on the next
    // notification rather than after the TTL expires.
    invalidateBusinessContactCache();

    res.json(settings);
  } catch (error) {
    res.status(400).json({ message: "Failed to update settings" });
  }
};

export const getFuelPrices = async (req: Request, res: Response) => {
  try {
    const prices = await prisma.fuelPrice.findMany();
    res.json(prices);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch fuel prices" });
  }
};

export const updateFuelPrice = async (req: Request, res: Response) => {
  try {
    const { fuelType, pricePerLitre } = req.body;
    
    const price = await prisma.fuelPrice.upsert({
      where: { fuelType },
      update: { pricePerLitre, lastUpdated: new Date() },
      create: { fuelType, pricePerLitre },
    });
    
    res.json(price);
  } catch (error) {
    res.status(400).json({ message: "Failed to update fuel price" });
  }
};

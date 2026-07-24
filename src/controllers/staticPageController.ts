import { Request, Response } from "express";
import prisma from "../lib/prisma";

// Public: list pages for nav/footer wiring. Content is omitted — callers that
// only need titles should not pull full page bodies.
export const getStaticPages = async (_req: Request, res: Response) => {
  try {
    const pages = await prisma.staticPage.findMany({
      select: { id: true, slug: true, title: true, subtitle: true, updatedAt: true },
      orderBy: { title: "asc" },
    });
    res.json(pages);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pages" });
  }
};

// Public: fetch a single page by slug for rendering.
export const getStaticPageBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const page = await prisma.staticPage.findUnique({ where: { slug } });

    if (!page) {
      return res.status(404).json({ message: "Page not found" });
    }

    res.json(page);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch page" });
  }
};

// Admin: update a page's copy. Slug is intentionally not editable — it is
// referenced by hardcoded routes and footer links, so renaming it would
// silently break them.
export const updateStaticPage = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { title, subtitle, content } = req.body;

    if (typeof title === "string" && !title.trim()) {
      return res.status(400).json({ message: "Title cannot be empty" });
    }
    if (typeof content === "string" && !content.trim()) {
      return res.status(400).json({ message: "Content cannot be empty" });
    }

    const existing = await prisma.staticPage.findUnique({ where: { slug } });
    if (!existing) {
      return res.status(404).json({ message: "Page not found" });
    }

    const page = await prisma.staticPage.update({
      where: { slug },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(subtitle !== undefined && { subtitle: subtitle?.trim() || null }),
        ...(content !== undefined && { content }),
      },
    });

    res.json(page);
  } catch (error) {
    res.status(500).json({ message: "Failed to update page" });
  }
};

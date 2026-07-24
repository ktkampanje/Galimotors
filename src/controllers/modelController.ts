import { Request, Response } from "express";
import prisma from "../lib/prisma";

export const createModel = async (req: Request, res: Response) => {
  try {
    const { name, makerId } = req.body;
    const model = await prisma.model.create({
      data: { name, makerId },
    });
    res.status(201).json(model);
  } catch (error) {
    res.status(500).json({ message: "Failed to create model" });
  }
};

export const getModelsByMaker = async (req: Request, res: Response) => {
  try {
    const { makerId } = req.params;
    const models = await prisma.model.findMany({
      where: { makerId },
    });
    res.json(models);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch models" });
  }
};

export const updateModel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const model = await prisma.model.update({
      where: { id },
      data: { name },
    });
    res.json(model);
  } catch (error) {
    res.status(500).json({ message: "Failed to update model" });
  }
};

export const deleteModel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.model.delete({ where: { id } });
    res.json({ message: "Model deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete model" });
  }
};

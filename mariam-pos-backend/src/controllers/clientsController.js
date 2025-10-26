import pkg from "@prisma/client";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

export const getClients = async (req, res) => {
  const clients = await prisma.client.findMany({ orderBy: { id: "desc" } });
  res.json(clients);
};

export const createClient = async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "El nombre es obligatorio" });

  const newCategory = await prisma.client.create({ data: { name } });
  res.status(201).json(newCategory);
};
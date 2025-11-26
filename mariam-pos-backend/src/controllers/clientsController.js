import pkg from "@prisma/client";
const { PrismaClient } = pkg;
const prisma = new PrismaClient();

export const getClients = async (req, res) => {
  try {
    const { search } = req.query;
    
    // Obtener todos los clientes
    let clients = await prisma.client.findMany({
      orderBy: { name: "asc" },
    });
    
    // Filtrar por búsqueda si se proporciona (SQLite no soporta case-insensitive directamente)
    if (search) {
      const searchLower = search.toLowerCase();
      clients = clients.filter(
        (client) =>
          client.name.toLowerCase().includes(searchLower) ||
          (client.alias && client.alias.toLowerCase().includes(searchLower)) ||
          (client.phone && client.phone.toLowerCase().includes(searchLower))
      );
    }
    
    res.json(clients);
  } catch (error) {
    console.error("Error al obtener clientes:", error);
    res.status(500).json({ error: "Error al obtener clientes" });
  }
};

export const getClientById = async (req, res) => {
  try {
    const { id } = req.params;
    const client = await prisma.client.findUnique({
      where: { id },
    });

    if (!client) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    res.json(client);
  } catch (error) {
    console.error("Error al obtener cliente:", error);
    res.status(500).json({ error: "Error al obtener cliente" });
  }
};

export const createClient = async (req, res) => {
  try {
    const { name, alias, phone, allowCredit, creditLimit } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "El nombre es obligatorio" });
    }

    const newClient = await prisma.client.create({
      data: {
        name: name.trim(),
        alias: alias?.trim() || null,
        phone: phone?.trim() || null,
        allowCredit: allowCredit === true || allowCredit === "true",
        creditLimit: creditLimit ? parseFloat(creditLimit) : 0,
      },
    });
    res.status(201).json(newClient);
  } catch (error) {
    console.error("Error al crear cliente:", error);
    res.status(500).json({ error: "Error al crear cliente" });
  }
};

export const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, alias, phone, allowCredit, creditLimit } = req.body;

    const existingClient = await prisma.client.findUnique({
      where: { id },
    });

    if (!existingClient) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (alias !== undefined) updateData.alias = alias?.trim() || null;
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (allowCredit !== undefined) updateData.allowCredit = allowCredit === true || allowCredit === "true";
    if (creditLimit !== undefined) updateData.creditLimit = parseFloat(creditLimit) || 0;

    const updatedClient = await prisma.client.update({
      where: { id },
      data: updateData,
    });

    res.json(updatedClient);
  } catch (error) {
    console.error("Error al actualizar cliente:", error);
    res.status(500).json({ error: "Error al actualizar cliente" });
  }
};

export const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    const existingClient = await prisma.client.findUnique({
      where: { id },
    });

    if (!existingClient) {
      return res.status(404).json({ error: "Cliente no encontrado" });
    }

    await prisma.client.delete({
      where: { id },
    });

    res.json({ message: "Cliente eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar cliente:", error);
    res.status(500).json({ error: "Error al eliminar cliente" });
  }
};
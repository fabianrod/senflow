import { Collection, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";

export const collectionsRepo = {
  async create(userId: string, name: string): Promise<Collection> {
    return prisma.collection.create({
      data: {
        userId,
        name,
      },
    });
  },

  async listByUserId(userId: string): Promise<Collection[]> {
    return prisma.collection.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  async findByIdForUser(collectionId: string, userId: string): Promise<Collection | null> {
    return prisma.collection.findFirst({
      where: { id: collectionId, userId },
    });
  },

  async rename(collectionId: string, name: string): Promise<Collection> {
    return prisma.collection.update({
      where: { id: collectionId },
      data: { name },
    });
  },

  async remove(collectionId: string): Promise<void> {
    await prisma.collection.delete({ where: { id: collectionId } });
  },

  async addContacts(collectionId: string, contactIds: string[]): Promise<void> {
    await prisma.$transaction(
      contactIds.map((contactId) =>
        prisma.collectionContact.upsert({
          where: {
            collectionId_contactId: {
              collectionId,
              contactId,
            },
          },
          create: { collectionId, contactId },
          update: {},
        }),
      ),
    );
  },

  async removeContact(collectionId: string, contactId: string): Promise<void> {
    await prisma.collectionContact.delete({
      where: {
        collectionId_contactId: {
          collectionId,
          contactId,
        },
      },
    });
  },

  async listContacts(collectionId: string) {
    return prisma.collectionContact.findMany({
      where: { collectionId },
      include: { contact: true },
      orderBy: {
        contact: {
          rowIndex: "asc",
        },
      },
    });
  },

  async ensureContactsOwnedByUser(userId: string, contactIds: string[]): Promise<string[]> {
    const contacts = await prisma.contact.findMany({
      where: {
        userId,
        id: { in: contactIds },
      },
      select: { id: true },
    });
    return contacts.map((item) => item.id);
  },
};

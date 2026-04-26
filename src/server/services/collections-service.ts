import { Collection } from "@prisma/client";
import { collectionsRepo } from "@/server/repositories/collections-repo";

export const collectionsService = {
  async createCollection(userId: string, name: string): Promise<Collection> {
    const safeName = name.trim();
    if (!safeName) {
      throw new Error("El nombre de la coleccion es obligatorio.");
    }
    return collectionsRepo.create(userId, safeName);
  },

  async listCollections(userId: string): Promise<Collection[]> {
    return collectionsRepo.listByUserId(userId);
  },

  async renameCollection(userId: string, collectionId: string, name: string): Promise<Collection> {
    const collection = await collectionsRepo.findByIdForUser(collectionId, userId);
    if (!collection) {
      throw new Error("Coleccion no encontrada.");
    }
    const safeName = name.trim();
    if (!safeName) {
      throw new Error("El nombre de la coleccion es obligatorio.");
    }
    return collectionsRepo.rename(collectionId, safeName);
  },

  async deleteCollection(userId: string, collectionId: string): Promise<void> {
    const collection = await collectionsRepo.findByIdForUser(collectionId, userId);
    if (!collection) {
      throw new Error("Coleccion no encontrada.");
    }
    await collectionsRepo.remove(collectionId);
  },

  async assignContacts(userId: string, collectionId: string, contactIds: string[]): Promise<number> {
    const collection = await collectionsRepo.findByIdForUser(collectionId, userId);
    if (!collection) {
      throw new Error("Coleccion no encontrada.");
    }
    const deduped = [...new Set(contactIds.map((id) => id.trim()).filter(Boolean))];
    const allowed = await collectionsRepo.ensureContactsOwnedByUser(userId, deduped);
    if (allowed.length === 0) {
      return 0;
    }
    await collectionsRepo.addContacts(collectionId, allowed);
    return allowed.length;
  },

  async unassignContact(userId: string, collectionId: string, contactId: string): Promise<void> {
    const collection = await collectionsRepo.findByIdForUser(collectionId, userId);
    if (!collection) {
      throw new Error("Coleccion no encontrada.");
    }
    await collectionsRepo.removeContact(collectionId, contactId);
  },

  async listCollectionContacts(userId: string, collectionId: string) {
    const collection = await collectionsRepo.findByIdForUser(collectionId, userId);
    if (!collection) {
      throw new Error("Coleccion no encontrada.");
    }
    const rows = await collectionsRepo.listContacts(collectionId);
    return rows.map((row) => row.contact);
  },
};

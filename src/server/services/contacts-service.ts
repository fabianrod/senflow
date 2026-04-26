import { Contact } from "@prisma/client";
import { ContactRecord } from "@/server/common/types";
import { contactsRepo } from "@/server/repositories/contacts-repo";

export type ImportUserContactsInput = {
  userId: string;
  contacts: ContactRecord[];
  sourceFileName?: string;
};

export const contactsService = {
  async createContact(input: {
    userId: string;
    name?: string | null;
    phoneRaw?: string | null;
    phoneNormalized?: string | null;
    data: string;
    sourceFileName?: string | null;
    rowIndex?: number | null;
  }): Promise<Contact> {
    return contactsRepo.create(input);
  },

  async importUserContacts(input: ImportUserContactsInput): Promise<string[]> {
    if (input.contacts.length === 0) {
      return [];
    }
    return contactsRepo.bulkInsertAndReturnIds(input);
  },

  async listUserContacts(userId: string, limit = 100): Promise<Contact[]> {
    return contactsRepo.listByUserId(userId, limit);
  },

  async getUserContactById(contactId: string, userId: string): Promise<Contact | null> {
    return contactsRepo.findByIdForUser(contactId, userId);
  },

  async updateUserContact(
    userId: string,
    contactId: string,
    input: {
      name?: string | null;
      phoneRaw?: string | null;
      phoneNormalized?: string | null;
      data?: string;
    },
  ): Promise<Contact> {
    const existing = await contactsRepo.findByIdForUser(contactId, userId);
    if (!existing) {
      throw new Error("Contacto no encontrado.");
    }
    return contactsRepo.update(contactId, input);
  },

  async deleteUserContact(userId: string, contactId: string): Promise<void> {
    const existing = await contactsRepo.findByIdForUser(contactId, userId);
    if (!existing) {
      throw new Error("Contacto no encontrado.");
    }
    await contactsRepo.remove(contactId);
  },
};

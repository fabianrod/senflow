import { Contact, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";
import { ContactRecord } from "@/server/common/types";

export type CreateContactInput = {
  userId: string;
  name?: string | null;
  phoneRaw?: string | null;
  phoneNormalized?: string | null;
  data: string;
  sourceFileName?: string | null;
  rowIndex?: number | null;
};

export type ImportContactsInput = {
  userId: string;
  contacts: ContactRecord[];
  sourceFileName?: string;
};

function toCreateManyData(input: ImportContactsInput): Prisma.ContactCreateManyInput[] {
  return input.contacts.map((contact) => ({
    userId: input.userId,
    name: contact.name || null,
    phoneRaw: contact.phoneRaw || null,
    phoneNormalized: contact.phoneNormalized || null,
    data: JSON.stringify(contact),
    sourceFileName: input.sourceFileName ?? null,
    rowIndex: contact.rowIndex,
  }));
}

export const contactsRepo = {
  async create(input: CreateContactInput): Promise<Contact> {
    return prisma.contact.create({
      data: input,
    });
  },

  async bulkInsert(input: ImportContactsInput): Promise<number> {
    const result = await prisma.contact.createMany({
      data: toCreateManyData(input),
    });
    return result.count;
  },

  async bulkInsertAndReturnIds(input: ImportContactsInput): Promise<string[]> {
    const created = await prisma.contact.createManyAndReturn({
      data: toCreateManyData(input),
      select: { id: true },
    });
    return created.map((item) => item.id);
  },

  async listByUserId(userId: string, limit = 100): Promise<Contact[]> {
    return prisma.contact.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  async findByIdForUser(contactId: string, userId: string): Promise<Contact | null> {
    return prisma.contact.findFirst({
      where: {
        id: contactId,
        userId,
      },
    });
  },

  async update(
    contactId: string,
    data: {
      name?: string | null;
      phoneRaw?: string | null;
      phoneNormalized?: string | null;
      data?: string;
    },
  ): Promise<Contact> {
    return prisma.contact.update({
      where: { id: contactId },
      data,
    });
  },

  async remove(contactId: string): Promise<void> {
    await prisma.contact.delete({
      where: { id: contactId },
    });
  },
};

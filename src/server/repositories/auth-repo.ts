import { User } from "@prisma/client";
import { prisma } from "@/server/db/client";

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  name: string;
};

export type PublicUser = Pick<User, "id" | "email" | "name" | "createdAt" | "updatedAt">;

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const authRepo = {
  async createUser(input: CreateUserInput): Promise<PublicUser> {
    const user = await prisma.user.create({
      data: input,
    });
    return toPublicUser(user);
  },

  async findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  },

  async findUserById(id: string): Promise<PublicUser | null> {
    const user = await prisma.user.findUnique({
      where: { id },
    });
    return user ? toPublicUser(user) : null;
  },
};

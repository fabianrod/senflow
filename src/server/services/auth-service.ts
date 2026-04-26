import { PublicUser, authRepo } from "@/server/repositories/auth-repo";

export type RegisterUserInput = {
  email: string;
  passwordHash: string;
  name: string;
};

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export const authService = {
  async registerUser(input: RegisterUserInput): Promise<PublicUser> {
    const email = normalizeEmail(input.email);
    const existing = await authRepo.findUserByEmail(email);
    if (existing) {
      throw new Error("El correo ya esta registrado.");
    }

    return authRepo.createUser({
      email,
      passwordHash: input.passwordHash,
      name: input.name.trim(),
    });
  },

  async getUserForLogin(email: string) {
    return authRepo.findUserByEmail(normalizeEmail(email));
  },

  async getPublicUserById(id: string): Promise<PublicUser | null> {
    return authRepo.findUserById(id);
  },
};

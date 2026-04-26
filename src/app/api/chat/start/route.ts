import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/server/auth/current-user";
import { accountsRepo } from "@/server/repositories/accounts-repo";
import { contactsService } from "@/server/services/contacts-service";
import { chatsService } from "@/server/services/chats-service";
import { sessionManager } from "@/server/session/session-manager";

type StartChatBody = {
  accountId?: string;
  contactId?: string;
};

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as StartChatBody;
  const accountId = body.accountId?.trim();
  const contactId = body.contactId?.trim();
  if (!accountId || !contactId) {
    return NextResponse.json(
      { ok: false, error: "Debes indicar accountId y contactId." },
      { status: 400 },
    );
  }

  const account = await accountsRepo.findByIdForUser(accountId, user.id);
  if (!account) {
    return NextResponse.json({ ok: false, error: "Cuenta no encontrada." }, { status: 404 });
  }

  const contact = await contactsService.getUserContactById(contactId, user.id);
  if (!contact) {
    return NextResponse.json({ ok: false, error: "Contacto no encontrado." }, { status: 404 });
  }

  try {
    const chat = await chatsService.startConversationFromContact({
      accountId: account.id,
      contactId: contact.id,
      contactPhoneNormalized: contact.phoneNormalized,
    });
    sessionManager.markExpectedReplyTarget(account.id, chat.id);
    return NextResponse.json({ ok: true, data: { chatId: chat.id } });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo iniciar la conversacion.",
      },
      { status: 400 },
    );
  }
}

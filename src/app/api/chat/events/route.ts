import { getAuthenticatedUser } from "@/server/auth/current-user";
import { accountsRepo } from "@/server/repositories/accounts-repo";
import { chatEventBus } from "@/server/chat/chat-events";
import { sessionManager } from "@/server/session/session-manager";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: "No autenticado." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId")?.trim();
  if (!accountId) {
    return new Response(JSON.stringify({ ok: false, error: "Debes indicar accountId." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const account = await accountsRepo.findByIdForUser(accountId, user.id);
  if (!account) {
    return new Response(JSON.stringify({ ok: false, error: "Cuenta no encontrada." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  sessionManager.ensureRealtimeListeners(account.id);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const writeEvent = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const unsubscribe = chatEventBus.subscribe(account.id, (event) => {
        writeEvent(event);
      });

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 15000);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

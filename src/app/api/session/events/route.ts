import { getAuthenticatedUser } from "@/server/auth/current-user";
import { ensureSessionAccountForUser } from "@/server/session/session-account";
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
  const accountIdParam = url.searchParams.get("accountId")?.trim() || "default";
  const account = await ensureSessionAccountForUser(user.id, accountIdParam);

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const writeEvent = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      writeEvent({
        type: "session.updated",
        accountId: account.id,
        state: sessionManager.getState(account.id),
      });

      const unsubscribe = sessionManager.onSessionUpdate(account.id, (event) => {
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
    cancel() {
      // cleanup handled by abort listener
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

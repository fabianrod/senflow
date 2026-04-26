import { campaignEventBus } from "@/server/campaign/campaign-events";
import { campaignManager } from "@/server/campaign/campaign-manager";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const writeEvent = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      writeEvent({
        type: "campaign.progress",
        payload: campaignManager.getProgressSnapshot(),
        timestamp: new Date().toISOString(),
      });

      const unsubscribe = campaignEventBus.subscribe((event) => {
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

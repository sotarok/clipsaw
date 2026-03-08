import { NextRequest } from "next/server";
import { splitEvents } from "@/lib/split";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const eventName = projectId
        ? `progress:${projectId}`
        : "progress";

      const handler = (data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
          // Close on complete
          const d = data as { status?: string };
          if (d.status === "complete") {
            setTimeout(() => {
              try { controller.close(); } catch { /* ignore */ }
            }, 100);
          }
        } catch {
          /* ignore */
        }
      };

      splitEvents.on(eventName, handler);

      // Cleanup on disconnect
      request.signal.addEventListener("abort", () => {
        splitEvents.off(eventName, handler);
        try { controller.close(); } catch { /* ignore */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

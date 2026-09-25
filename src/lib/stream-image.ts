import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";

type ImagePayload = {
  type?: string;
  b64_json?: string;
  error?: { message?: string };
};

export async function streamImage(
  endpoint: string,
  input: Record<string, unknown>,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
  headers?: Record<string, string>,
): Promise<void> {
  const send = (stream: boolean) => {
    const payload: Record<string, unknown> = { ...input, stream };
    if (!stream) delete payload.partial_images;
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(payload),
    });
  };

  const response = await send(true);
  if (!response.ok || !response.body) {
    throw new Error(`Image generation failed: ${response.status} ${await response.text().catch(() => "")}`);
  }

  let sawAnyEvent = false;
  let sawCompleted = false;
  let streamError: string | undefined;
  const parser = createParser({
    onEvent(event) {
      let payload: ImagePayload | undefined;
      try {
        payload = JSON.parse(event.data) as ImagePayload;
      } catch {
        payload = undefined;
      }

      if (event.event === "error" || payload?.type === "error") {
        sawAnyEvent = true;
        streamError = payload?.error?.message ?? "Image generation failed";
        return;
      }

      const type = event.event || payload?.type;
      if (type !== "image_generation.partial_image" && type !== "image_generation.completed") return;
      sawAnyEvent = true;
      if (!payload?.b64_json) {
        streamError = "Image event contained no image";
        return;
      }

      const isFinal = type === "image_generation.completed";
      flushSync(() => onFrame(`data:image/png;base64,${payload.b64_json}`, isFinal));
      if (isFinal) sawCompleted = true;
    },
  });

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      parser.feed(chunk.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  if (streamError) throw new Error(streamError);
  if (!sawAnyEvent) {
    const replay = await send(false);
    if (!replay.ok) {
      throw new Error(`Image generation failed: ${replay.status} ${await replay.text().catch(() => "")}`);
    }
    const json = (await replay.json()) as { data?: { b64_json?: string }[] };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("Image generation returned no image");
    onFrame(`data:image/png;base64,${b64}`, true);
    return;
  }
  if (!sawCompleted) throw new Error("Image stream ended without a completed event");
}
export type ImageConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
  format: "openai" | "gemini-chat" | "generate-content";
};

export const profileAvatarImageSettings = {
  baseURL: "https://ai.gateway.lovable.dev",
  model: "openai/gpt-image-2.5-sunburst",
  format: "openai",
} as const satisfies Omit<ImageConfig, "apiKey">;

export function generateImage(config: ImageConfig, prompt: string, stream = true, signal?: AbortSignal) {
  const body = {
    model: config.model,
    prompt,
    ...(stream ? { stream: true, partial_images: 1 } : {}),
  };

  return fetch(`${config.baseURL}/v1/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: signal ?? null,
  });
}
const API_URL = "/api/chat";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type StreamOptions = {
  messages: ChatMessage[];
  model?: string;
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void;
};

export async function createChatCompletion(options: {
  messages: ChatMessage[];
  model?: string;
  signal?: AbortSignal;
}) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: options.model ?? "LongCat-Flash-Chat",
      messages: options.messages
    }),
    signal: options.signal
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`请求失败: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("未获取到模型响应内容");
  }

  return content as string;
}

export async function streamChatCompletion(options: StreamOptions) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: options.model ?? "LongCat-Flash-Chat",
      messages: options.messages,
      stream: true
    }),
    signal: options.signal
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`请求失败: ${response.status} ${errorText}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream")) {
    const text = await response.text();
    if (text) options.onChunk?.(text);
    return text;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    return "";
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") {
        return full;
      }
      try {
        const data = JSON.parse(payload);
        const delta = data?.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          options.onChunk?.(delta);
        }
      } catch (error) {
        // ignore invalid chunk
      }
    }
  }

  return full;
}

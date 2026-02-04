const API_URL = "/api/chat";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
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

const API_URL = "https://api.longcat.chat/openai/v1/chat/completions";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function createChatCompletion(options: {
  messages: ChatMessage[];
  model?: string;
  signal?: AbortSignal;
}) {
  const apiKey = import.meta.env.VITE_LONGCAT_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 VITE_LONGCAT_API_KEY，请在环境变量中配置。");
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: options.model ?? "LongCat-Flash-Chat",
      messages: options.messages,
      stream: false
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

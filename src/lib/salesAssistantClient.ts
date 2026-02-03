import type { ScriptRequest, ScriptResponse, ScriptSuggestion } from "../types/salesAssistant";
import { createChatCompletion } from "./longcatClient";

const FALLBACK_SUGGESTION: ScriptSuggestion = {
  coreValue: "暂无建议",
  objectionResponse: "",
  caseAnalogy: "",
  nextStep: ""
};

function buildPrompt(request: ScriptRequest) {
  const objections = request.objections
    .map((item, index) => `${index + 1}. ${item.detail ?? item.topic}`)
    .join("\n");

  return `你是一名服务零售销售助手。请基于以下信息给出话术建议，严格输出 JSON（不要添加额外文字/Markdown）。\n\n必须包含四段式字段：coreValue、objectionResponse、caseAnalogy、nextStep。每个字段用 1-2 句简洁表达；如果信息不足请填“待补充”。\n\n商户画像：\n- 行业：${request.merchant.industry}\n- 规模：${request.merchant.scale}\n- 商圈：${request.merchant.businessDistrict}\n- 关注点：${request.merchant.focusAreas.join("、")}\n- 补充：${request.merchant.notes || "无"}\n\n意向产品：${request.productId}\n\n商户疑义：\n${objections || "暂无"}\n\n请输出 JSON，字段为 coreValue、objectionResponse、caseAnalogy、nextStep。`;
}

function extractJsonPayload(rawText: string) {
  const trimmed = rawText.trim();
  const match = trimmed.match(/\{[\s\S]*\}/);
  return match ? match[0] : trimmed;
}

function tryParseSuggestion(rawText: string): ScriptSuggestion {
  const cleaned = rawText
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(extractJsonPayload(cleaned));
    return {
      coreValue: parsed.coreValue ?? rawText,
      objectionResponse: parsed.objectionResponse ?? "",
      caseAnalogy: parsed.caseAnalogy ?? "",
      nextStep: parsed.nextStep ?? ""
    };
  } catch (error) {
    return {
      ...FALLBACK_SUGGESTION,
      coreValue: rawText
    };
  }
}

export async function generateScriptAdvice(
  request: ScriptRequest
): Promise<ScriptResponse> {
  const content = await createChatCompletion({
    messages: [{ role: "user", content: buildPrompt(request) }]
  });

  return {
    suggestion: tryParseSuggestion(content),
    rawText: content
  };
}

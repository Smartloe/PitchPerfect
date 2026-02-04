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

function buildNotesPrompt(industry: string, productId: string) {
  return `你是一名服务零售销售助手。请基于行业与意向产品，生成 3-5 条“补充说明”建议，帮助新人销售快速补充商户背景。\n\n要求：\n1. 输出 JSON 数组（不要加额外文字/Markdown）\n2. 每条建议 12-20 个字，口吻专业\n3. 与行业与产品强相关\n\n行业：${industry}\n意向产品：${productId}\n`;
}

export async function generateNotesSuggestions(options: {
  industry: string;
  productId: string;
}): Promise<string[]> {
  const content = await createChatCompletion({
    messages: [
      {
        role: "user",
        content: buildNotesPrompt(options.industry, options.productId)
      }
    ]
  });

  const cleaned = content
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    const payload = JSON.parse(cleaned);
    if (Array.isArray(payload)) {
      return payload.map((item) => String(item)).filter(Boolean).slice(0, 6);
    }
  } catch (error) {
    // fall through
  }

  return cleaned
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\\d.\\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 6);
}

export type DrillScore = {
  score: number;
  feedback: string;
  highlight: string;
  improve: string;
};

export type DrillReport = {
  summary: string;
  strengths: string[];
  improvements: string[];
  nextSteps: string[];
};

function buildDrillQuestionsPrompt(options: {
  industry: string;
  productId: string;
  focusAreas: string[];
  notes?: string;
}) {
  return `你是商户 Agent。请基于行业、意向产品与关注点，生成 5-7 条商户提问，覆盖交易、流量、案例、成本与推进动作等主题。\n\n要求：\n1. 只输出 JSON 数组\n2. 每条问题 12-22 字\n3. 语气口吻真实\n\n行业：${options.industry}\n意向产品：${options.productId}\n关注点：${options.focusAreas.join("、")}\n补充：${options.notes || "无"}\n`;
}

export async function generateDrillQuestions(options: {
  industry: string;
  productId: string;
  focusAreas: string[];
  notes?: string;
}): Promise<string[]> {
  const content = await createChatCompletion({
    messages: [
      {
        role: "user",
        content: buildDrillQuestionsPrompt(options)
      }
    ]
  });

  const cleaned = content
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    const payload = JSON.parse(cleaned);
    if (Array.isArray(payload)) {
      return payload.map((item) => String(item)).filter(Boolean).slice(0, 7);
    }
  } catch (error) {
    // fall through
  }

  return cleaned
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\\d.\\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 7);
}

function buildFollowUpPrompt(options: {
  industry: string;
  productId: string;
  question: string;
  answer: string;
}) {
  return `你是商户 Agent。基于以下回答内容，请提出 2-3 条补充追问，聚焦细节与量化价值。\n\n要求：\n1. 只输出 JSON 数组\n2. 每条问题 12-22 字\n3. 语气保持真实\n\n行业：${options.industry}\n意向产品：${options.productId}\n原问题：${options.question}\n销售回答：${options.answer}\n`;
}

export async function generateFollowUpQuestions(options: {
  industry: string;
  productId: string;
  question: string;
  answer: string;
}): Promise<string[]> {
  const content = await createChatCompletion({
    messages: [{ role: "user", content: buildFollowUpPrompt(options) }]
  });

  const cleaned = content
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    const payload = JSON.parse(cleaned);
    if (Array.isArray(payload)) {
      return payload.map((item) => String(item)).filter(Boolean).slice(0, 3);
    }
  } catch (error) {
    // fall through
  }

  return cleaned
    .split(/\n+/)
    .map((line) => line.replace(/^[-*\\d.\\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

function buildScorePrompt(options: {
  industry: string;
  productId: string;
  question: string;
  answer: string;
}) {
  return `你是销售教练。请对销售回答进行评分并给出简短反馈。\n\n要求：\n1. 只输出 JSON，不要额外文字\n2. 字段：score(0-100), feedback(一句话), highlight(一句话), improve(一句话)\n3. 评分关注：是否回应疑义、是否量化价值、是否推动下一步\n\n行业：${options.industry}\n意向产品：${options.productId}\n商户问题：${options.question}\n销售回答：${options.answer}\n`;
}

export async function scoreSalesAnswer(options: {
  industry: string;
  productId: string;
  question: string;
  answer: string;
}): Promise<DrillScore> {
  const content = await createChatCompletion({
    messages: [{ role: "user", content: buildScorePrompt(options) }]
  });

  const cleaned = content
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(extractJsonPayload(cleaned));
    const score = Number(parsed.score);
    return {
      score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 60,
      feedback: parsed.feedback ?? "已评分",
      highlight: parsed.highlight ?? "表达清晰",
      improve: parsed.improve ?? "补充具体行动建议"
    };
  } catch (error) {
    return {
      score: 60,
      feedback: "系统兜底评分",
      highlight: "表达清晰",
      improve: "补充价值与推进动作"
    };
  }
}

function buildReportPrompt(options: {
  industry: string;
  productId: string;
  records: Array<{ question: string; answer: string; score: number }>;
}) {
  const content = options.records
    .map(
      (item, index) =>
        `${index + 1}. Q:${item.question}\nA:${item.answer}\nScore:${item.score}`
    )
    .join("\n\n");

  return `你是销售教练，请输出本次演练的整体报告。\n\n要求：\n1. 只输出 JSON\n2. 字段：summary, strengths(数组), improvements(数组), nextSteps(数组)\n3. summary 1-2 句\n\n行业：${options.industry}\n意向产品：${options.productId}\n\n记录：\n${content}\n`;
}

export async function generateDrillReport(options: {
  industry: string;
  productId: string;
  records: Array<{ question: string; answer: string; score: number }>;
}): Promise<DrillReport> {
  const content = await createChatCompletion({
    messages: [{ role: "user", content: buildReportPrompt(options) }]
  });

  const cleaned = content
    .trim()
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/, "")
    .trim();

  try {
    const parsed = JSON.parse(extractJsonPayload(cleaned));
    return {
      summary: parsed.summary ?? "演练完成",
      strengths: Array.isArray(parsed.strengths)
        ? parsed.strengths.map(String).filter(Boolean)
        : [],
      improvements: Array.isArray(parsed.improvements)
        ? parsed.improvements.map(String).filter(Boolean)
        : [],
      nextSteps: Array.isArray(parsed.nextSteps)
        ? parsed.nextSteps.map(String).filter(Boolean)
        : []
    };
  } catch (error) {
    return {
      summary: "演练完成",
      strengths: [],
      improvements: [],
      nextSteps: []
    };
  }
}

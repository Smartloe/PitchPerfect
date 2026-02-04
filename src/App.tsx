import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent
} from "react";
import { productCatalog } from "./data/productCatalog";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import type {
  MerchantObjection,
  MerchantProfile,
  ProductId,
  ScriptSuggestion
} from "./types/salesAssistant";
import {
  generateNotesSuggestions,
  generateDrillQuestions,
  generateDrillReport,
  generateFollowUpQuestions,
  scoreSalesAnswerStream,
  generateScriptAdvice
} from "./lib/salesAssistantClient";

const flowSteps = [
  {
    role: "新人销售",
    goal: "输入商户画像，明确对话目标与意向产品。"
  },
  {
    role: "商户 Agent",
    goal: "抛出疑义与挑战，聚焦交易、流量与案例。"
  },
  {
    role: "销售助手 Agent",
    goal: "基于画像与产品给出话术建议，推进签约。"
  }
];

const focusOptions = [
  "交易提升",
  "流量增长",
  "案例背书",
  "投放成本",
  "留资效率"
];

const scaleOptions = ["1-5人", "6-15人", "16-50人", "50+人"];

const sampleProfiles = [
  {
    id: "coffee-shop",
    label: "社区咖啡馆",
    profile: {
      industry: "咖啡",
      scale: "6-15人",
      businessDistrict: "社区生活圈",
      focusAreas: ["交易提升", "案例背书"],
      notes: "周末客流高峰明显，想提升复购"
    },
    productId: "online-sales" as ProductId,
    question: "线上下单会不会影响到店体验？"
  },
  {
    id: "fitness-studio",
    label: "精品健身工作室",
    profile: {
      industry: "健身",
      scale: "16-50人",
      businessDistrict: "写字楼商圈",
      focusAreas: ["流量增长", "投放成本"],
      notes: "希望吸引白领新客"
    },
    productId: "ad-campaign" as ProductId,
    question: "投放周期和起量速度怎么样？"
  },
  {
    id: "dessert-store",
    label: "甜品店",
    profile: {
      industry: "甜品",
      scale: "1-5人",
      businessDistrict: "购物中心",
      focusAreas: ["留资效率", "交易提升"],
      notes: "想沉淀节假日新客联系方式"
    },
    productId: "lead-collection" as ProductId,
    question: "留资后可以带来多少次复购？"
  }
];

type FormState = MerchantProfile & {
  productId: ProductId;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

type HistoryItem = {
  id: string;
  createdAt: string;
  snapshot: FormState;
  question: string;
  suggestion: ScriptSuggestion;
};

type DrillItem = {
  question: string;
  answer: string;
  score?: number;
  feedback?: string;
  highlight?: string;
  improve?: string;
  kind?: "main" | "followup";
};

type DrillReport = {
  summary: string;
  strengths: string[];
  improvements: string[];
  nextSteps: string[];
};

const requiredFieldLabels: Record<keyof FormState, string> = {
  industry: "行业",
  scale: "规模",
  businessDistrict: "商圈",
  focusAreas: "关注点",
  notes: "补充说明",
  productId: "意向产品"
};

export default function App() {
  const [form, setForm] = useState<FormState>({
    industry: "",
    scale: "",
    businessDistrict: "",
    focusAreas: [],
    notes: "",
    productId: productCatalog[0]?.id ?? "online-sales"
  });
  const [merchantQuestion, setMerchantQuestion] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [assistantError, setAssistantError] = useState("");
  const [assistantSuggestion, setAssistantSuggestion] =
    useState<ScriptSuggestion | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [notesSuggestions, setNotesSuggestions] = useState<string[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [notesVisible, setNotesVisible] = useState(false);
  const [drillActive, setDrillActive] = useState(false);
  const [drillQuestions, setDrillQuestions] = useState<string[]>([]);
  const [drillIndex, setDrillIndex] = useState(0);
  const [drillAnswer, setDrillAnswer] = useState("");
  const [drillItems, setDrillItems] = useState<DrillItem[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillError, setDrillError] = useState("");
  const [drillReport, setDrillReport] = useState<DrillReport | null>(null);
  const [drillQuestionsLoading, setDrillQuestionsLoading] = useState(false);
  const [drillQuestionSource, setDrillQuestionSource] = useState<
    "ai" | "default" | ""
  >("");
  const [drillStreamText, setDrillStreamText] = useState("");
  const historyRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const drillChatRef = useRef<HTMLDivElement>(null);

  const selectedProduct = useMemo(
    () => productCatalog.find((item) => item.id === form.productId),
    [form.productId]
  );

  const completion = useMemo(() => {
    const required: Array<keyof FormState> = [
      "industry",
      "scale",
      "businessDistrict",
      "focusAreas",
      "productId"
    ];
    const filled = required.filter((field) => {
      if (field === "focusAreas") {
        return form.focusAreas.length > 0;
      }
      return String(form[field]).trim().length > 0;
    }).length;
    const percent = Math.round((filled / required.length) * 100);
    return { filled, total: required.length, percent };
  }, [form]);

  useEffect(() => {
    if (!historyRef.current) return;
    historyRef.current.scrollTo({
      top: historyRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [history]);

  useEffect(() => {
    if (!drillChatRef.current) return;
    drillChatRef.current.scrollTo({
      top: drillChatRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [drillItems, drillIndex, drillLoading]);

  useEffect(() => {
    setNotesSuggestions([]);
    setNotesError("");
  }, [form.industry, form.productId]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(""), 2000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const handleChange = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleFocus = (value: string) => {
    setForm((prev) => {
      const exists = prev.focusAreas.includes(value);
      const focusAreas = exists
        ? prev.focusAreas.filter((item) => item !== value)
        : [...prev.focusAreas, value];
      return { ...prev, focusAreas };
    });
  };

  const setScale = (value: string) => {
    setForm((prev) => ({ ...prev, scale: value }));
  };

  const setProduct = (value: ProductId) => {
    setForm((prev) => ({ ...prev, productId: value }));
  };

  const resetForm = () => {
    setForm({
      industry: "",
      scale: "",
      businessDistrict: "",
      focusAreas: [],
      notes: "",
      productId: productCatalog[0]?.id ?? "online-sales"
    });
    setMerchantQuestion("");
    setErrors({});
    setSubmitError("");
    setAssistantError("");
    setAssistantSuggestion(null);
  };

  const applySampleProfile = (sample: (typeof sampleProfiles)[number]) => {
    setForm({
      industry: sample.profile.industry,
      scale: sample.profile.scale,
      businessDistrict: sample.profile.businessDistrict,
      focusAreas: sample.profile.focusAreas,
      notes: sample.profile.notes ?? "",
      productId: sample.productId
    });
    setMerchantQuestion(sample.question);
    setErrors({});
    setSubmitError("");
    setAssistantError("");
    setAssistantSuggestion(null);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const applyHistory = (item: HistoryItem) => {
    setForm(item.snapshot);
    setMerchantQuestion(item.question);
    setAssistantSuggestion(item.suggestion);
    setAssistantError("");
    setSubmitError("");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const validate = (): FormErrors => {
    const nextErrors: FormErrors = {};
    if (!form.industry.trim()) nextErrors.industry = "请输入行业";
    if (!form.scale.trim()) nextErrors.scale = "请选择规模";
    if (!form.businessDistrict.trim())
      nextErrors.businessDistrict = "请输入商圈";
    if (!form.productId) nextErrors.productId = "请选择意向产品";
    if (form.focusAreas.length === 0)
      nextErrors.focusAreas = "请至少选择一个关注点";
    return nextErrors;
  };

  const buildObjections = (): MerchantObjection[] => {
    if (!selectedProduct) return [];
    const base = selectedProduct.questions.map((question) => ({
      topic: "常见疑义",
      detail: question
    }));
    if (merchantQuestion.trim()) {
      base.unshift({ topic: "商户提问", detail: merchantQuestion.trim() });
    }
    return base;
  };

  const renderValue = (value: string) => {
    return value.trim() ? value : "待补充";
  };

  const fetchNotesSuggestions = async () => {
    if (!form.industry.trim() || !form.productId) {
      setNotesError("请先填写行业并选择意向产品");
      return;
    }
    setNotesLoading(true);
    setNotesError("");
    try {
      const suggestions = await generateNotesSuggestions({
        industry: form.industry,
        productId: form.productId
      });
      setNotesSuggestions(suggestions);
      if (suggestions.length === 0) {
        setNotesError("未生成可用建议，请稍后重试");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "生成失败，请稍后重试";
      setNotesError(message);
    } finally {
      setNotesLoading(false);
    }
  };

  const handleNotesFocus = () => {
    setNotesVisible(true);
    if (notesSuggestions.length === 0 && !notesLoading) {
      fetchNotesSuggestions();
    }
  };

  const handleNotesBlur = () => {
    window.setTimeout(() => setNotesVisible(false), 150);
  };

  const applyNoteSuggestion = (text: string) => {
    setForm((prev) => ({
      ...prev,
      notes: prev.notes ? `${prev.notes}\n${text}` : text
    }));
  };

  const loadDrillQuestions = async () => {
    if (!form.industry.trim() || !selectedProduct) {
      setDrillError("请先填写行业并选择意向产品");
      return [];
    }
    setDrillQuestionsLoading(true);
    setDrillError("");
    try {
      const questions = await generateDrillQuestions({
        industry: form.industry,
        productId: form.productId,
        focusAreas: form.focusAreas,
        notes: form.notes
      });
      if (questions.length >= 3) {
        setDrillQuestionSource("ai");
        setDrillQuestions(questions);
        return questions;
      }
      setDrillQuestionSource("default");
      setDrillQuestions(selectedProduct.questions.slice(0, 7));
      setDrillError("生成问题不足，已使用默认问题");
      return selectedProduct.questions.slice(0, 7);
    } catch (error) {
      setDrillQuestionSource("default");
      setDrillQuestions(selectedProduct.questions.slice(0, 7));
      setDrillError("生成失败，已使用默认问题");
      return selectedProduct.questions.slice(0, 7);
    } finally {
      setDrillQuestionsLoading(false);
    }
  };

  const startDrill = async () => {
    const questions = await loadDrillQuestions();
    if (questions.length === 0) return;
    setDrillItems(
      questions.map((question) => ({ question, answer: "", kind: "main" }))
    );
    setDrillIndex(0);
    setDrillAnswer("");
    setDrillActive(true);
    setDrillReport(null);
  };

  const computeFallbackReport = (items: DrillItem[]): DrillReport => {
    const scored = items.filter((item) => typeof item.score === "number");
    const avg = scored.length
      ? Math.round(
          scored.reduce((sum, item) => sum + (item.score ?? 0), 0) /
            scored.length
        )
      : 0;
    const sorted = [...scored].sort(
      (a, b) => (b.score ?? 0) - (a.score ?? 0)
    );
    const strengths = sorted.slice(0, 2).map((item) => {
      return `在“${item.question}”的回答得分 ${item.score}，表达较为清晰`;
    });
    const improvements = sorted.slice(-2).map((item) => {
      return `“${item.question}”可补充量化价值与推进动作`;
    });
    return {
      summary: `本次演练完成，平均得分 ${avg} 分。`,
      strengths: strengths.length ? strengths : ["表达完整度较好"],
      improvements: improvements.length ? improvements : ["补充具体案例与下一步动作"],
      nextSteps: ["继续练习高频疑义的结构化回答", "准备 1-2 个同类案例"]
    };
  };

  const finishDrill = async (items: DrillItem[]) => {
    const scored = items.filter((item) => typeof item.score === "number");
    if (scored.length === 0) {
      setDrillReport(computeFallbackReport(items));
      return;
    }
    try {
      const report = await generateDrillReport({
        industry: form.industry,
        productId: form.productId,
        records: scored.map((item) => ({
          question: item.question,
          answer: item.answer,
          score: item.score ?? 0
        }))
      });
      if (
        !report.summary &&
        report.strengths.length === 0 &&
        report.improvements.length === 0
      ) {
        setDrillReport(computeFallbackReport(items));
      } else {
        setDrillReport(report);
      }
    } catch (error) {
      setDrillReport(computeFallbackReport(items));
    }
  };

  const shouldFollowUp = (score: number, answer: string) => {
    const normalized = answer.trim();
    const tooShort = normalized.length < 30;
    return score < 70 || tooShort;
  };

  const submitDrillAnswer = async () => {
    if (!drillActive) return;
    if (!drillAnswer.trim()) {
      setDrillError("请输入回答后再提交");
      return;
    }
    const currentItem = drillItems[drillIndex];
    const question = currentItem?.question || "";
    setDrillLoading(true);
    setDrillStreamText("");
    setDrillError("");
    try {
      const score = await scoreSalesAnswerStream({
        industry: form.industry,
        productId: form.productId,
        question,
        answer: drillAnswer.trim(),
        onChunk: (chunk) => {
          setDrillStreamText((prev) => prev + chunk);
        }
      });
      const baseItems = drillItems.map((item, index) =>
        index === drillIndex
          ? {
              ...item,
              question,
              answer: drillAnswer.trim(),
              score: score.score,
              feedback: score.feedback,
              highlight: score.highlight,
              improve: score.improve
            }
          : item
      );
      let updatedItems = baseItems;
      if (shouldFollowUp(score.score, drillAnswer)) {
        try {
          const followUps = await generateFollowUpQuestions({
            industry: form.industry,
            productId: form.productId,
            question,
            answer: drillAnswer.trim()
          });
          if (followUps.length > 0) {
            const followUpItems: DrillItem[] = followUps.map((item) => ({
              question: item,
              answer: "",
              kind: "followup"
            }));
            updatedItems = [
              ...baseItems.slice(0, drillIndex + 1),
              ...followUpItems,
              ...baseItems.slice(drillIndex + 1)
            ];
          }
        } catch (error) {
          setDrillError("追问生成失败，已继续下一题");
        }
      }
      setDrillItems(updatedItems);
      setDrillAnswer("");
      if (drillIndex + 1 < updatedItems.length) {
        setDrillIndex((prev) => prev + 1);
      } else {
        setDrillActive(false);
        finishDrill(updatedItems);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "评分失败，请重试";
      setDrillError(message);
    } finally {
      setDrillLoading(false);
    }
  };

  const buildCopyText = (suggestion: ScriptSuggestion) => {
    return [
      `核心价值：${renderValue(suggestion.coreValue)}`,
      `应对疑义：${renderValue(suggestion.objectionResponse)}`,
      `案例类比：${renderValue(suggestion.caseAnalogy)}`,
      `推进动作：${renderValue(suggestion.nextStep)}`
    ].join("\n");
  };

  const handleCopy = async () => {
    if (!assistantSuggestion) return;
    try {
      await navigator.clipboard.writeText(buildCopyText(assistantSuggestion));
      setCopyMessage("已复制");
    } catch (error) {
      setCopyMessage("复制失败");
    } finally {
      setTimeout(() => setCopyMessage(""), 1800);
    }
  };

  const runGeneration = async () => {
    setIsSubmitting(true);
    setAssistantError("");
    setCopyMessage("");
    setSuccessMessage("");
    try {
      const response = await generateScriptAdvice({
        merchant: {
          industry: form.industry,
          scale: form.scale,
          businessDistrict: form.businessDistrict,
          focusAreas: form.focusAreas,
          notes: form.notes
        },
        productId: form.productId,
        objections: buildObjections()
      });
      setAssistantSuggestion(response.suggestion);
      setSuccessMessage("话术已生成");
      setHistory((prev) =>
        [
          ...prev,
          {
            id: `${Date.now()}`,
            createdAt: new Date().toLocaleString("zh-CN"),
            snapshot: form,
            question: merchantQuestion.trim(),
            suggestion: response.suggestion
          }
        ].slice(-5)
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "生成失败，请稍后重试。";
      setAssistantError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitFromShortcut = () => {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSubmitError("请完善必填信息后再提交。");
      return;
    }
    setSubmitError("");
    runGeneration();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitFromShortcut();
  };

  const handleQuestionKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      submitFromShortcut();
    }
  };

  const errorSummary = Object.keys(errors).map((key) => {
    const field = key as keyof FormState;
    return requiredFieldLabels[field];
  });

  const visibleDrillItems = drillActive
    ? drillItems.slice(0, drillIndex + 1)
    : drillItems;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="flex flex-col gap-3">
        <span className="inline-flex w-fit items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
          PitchPerfect · 新人销售话术助手
        </span>
        <h1 className="text-3xl font-semibold text-slate-900 font-['Rubik']">
          更快完成商户沟通准备
        </h1>
        <p className="text-base text-slate-600">
          通过画像 + 产品 + 疑义三步，快速生成可复制的话术建议。
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 font-['Rubik']">
          三方对话流程
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {flowSteps.map((step) => (
            <div
              key={step.role}
              className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4"
            >
              <p className="text-sm font-semibold text-slate-800">{step.role}</p>
              <p className="mt-2 text-sm text-slate-600">{step.goal}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section
          ref={formRef}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 font-['Rubik']">
              商户画像表单
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>
                完成度 {completion.filled}/{completion.total}
              </span>
              <span>{completion.percent}%</span>
            </div>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-slate-900 transition-all"
              style={{ width: `${completion.percent}%` }}
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">示例画像：</span>
            {sampleProfiles.map((sample) => (
              <button
                key={sample.id}
                type="button"
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-400"
                onClick={() => applySampleProfile(sample)}
              >
                {sample.label}
              </button>
            ))}
            <button
              type="button"
              className="ml-auto rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 transition hover:border-slate-400"
              onClick={resetForm}
            >
              清空表单
            </button>
          </div>

          {errorSummary.length > 0 && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              <p className="font-semibold">请补充以下信息：</p>
              <ul className="mt-2 list-disc pl-5">
                {errorSummary.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="industry">行业</Label>
              <Input
                id="industry"
                placeholder="例如：咖啡、轻食、健身"
                value={form.industry}
                onChange={(event) => handleChange("industry", event.target.value)}
              />
              {errors.industry && (
                <p className="text-xs text-red-500">{errors.industry}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>规模</Label>
              <div className="grid grid-cols-2 gap-2">
                {scaleOptions.map((option) => {
                  const active = form.scale === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                      }`}
                      onClick={() => setScale(option)}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {errors.scale && (
                <p className="text-xs text-red-500">{errors.scale}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="district">商圈</Label>
              <Input
                id="district"
                placeholder="例如：中山路 / 世纪广场"
                value={form.businessDistrict}
                onChange={(event) =>
                  handleChange("businessDistrict", event.target.value)
                }
              />
              {errors.businessDistrict && (
                <p className="text-xs text-red-500">
                  {errors.businessDistrict}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>关注点</Label>
              <div className="flex flex-wrap gap-2">
                {focusOptions.map((option) => {
                  const active = form.focusAreas.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                      }`}
                      onClick={() => toggleFocus(option)}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {errors.focusAreas && (
                <p className="text-xs text-red-500">{errors.focusAreas}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>意向产品</Label>
              <div
                role="radiogroup"
                className="grid gap-3 md:grid-cols-3"
              >
                {productCatalog.map((product) => {
                  const active = form.productId === product.id;
                  return (
                    <button
                      key={product.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                      }`}
                      onClick={() => setProduct(product.id)}
                    >
                      <p className="font-semibold">{product.name}</p>
                      <p className="mt-1 text-xs opacity-80">
                        {product.summary}
                      </p>
                    </button>
                  );
                })}
              </div>
              {errors.productId && (
                <p className="text-xs text-red-500">{errors.productId}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">补充说明</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder="记录商户特别关注的点或已有痛点..."
                value={form.notes}
                onChange={(event) => handleChange("notes", event.target.value)}
                onFocus={handleNotesFocus}
                onBlur={handleNotesBlur}
              />
              <div className="flex items-center justify-end text-xs text-slate-500">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500 transition hover:border-slate-400"
                  onClick={fetchNotesSuggestions}
                  disabled={notesLoading}
                >
                  {notesLoading ? "生成中..." : "重新生成"}
                </button>
              </div>
              {notesError && (
                <p className="text-xs text-red-500">{notesError}</p>
              )}
              {notesVisible && notesSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {notesSuggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 transition hover:border-slate-400"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applyNoteSuggestion(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {submitError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {submitError}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "生成中..." : "生成话术建议"}
              </Button>
              {successMessage && (
                <span className="text-sm text-emerald-600">
                  {successMessage}
                </span>
              )}
              <span className="text-xs text-slate-400">
                提示：在商户提问区按 Ctrl/Command + Enter 可快速生成
              </span>
            </div>
          </form>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 font-['Rubik']">
              商户提问区
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              可填写商户的具体疑义，系统会优先纳入话术建议。
            </p>
            <Textarea
              className="mt-4"
              rows={4}
              placeholder="例如：我们担心投放后成本太高，具体ROI能看到吗？"
              value={merchantQuestion}
              onChange={(event) => setMerchantQuestion(event.target.value)}
              onKeyDown={handleQuestionKeyDown}
            />
            {!merchantQuestion.trim() && (
              <p className="mt-2 text-xs text-slate-400">
                当前为空，将默认使用常见疑义作为输入。
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 font-['Rubik']">
              常见疑义
            </h2>
            {selectedProduct ? (
              <div className="mt-4">
                <p className="text-sm font-semibold text-slate-800">
                  {selectedProduct.name}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {selectedProduct.summary}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedProduct.questions.map((question) => (
                    <button
                      key={question}
                      type="button"
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 transition hover:border-slate-400"
                      onClick={() => setMerchantQuestion(question)}
                    >
                      {question}
                    </button>
                  ))}
                </div>
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
                  {selectedProduct.questions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">暂无可用产品信息。</p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 font-['Rubik']">
                话术建议
              </h2>
              {assistantSuggestion && !assistantError && (
                <div className="flex items-center gap-2">
                  {copyMessage && (
                    <span className="text-xs text-slate-500">{copyMessage}</span>
                  )}
                  <Button
                    type="button"
                    className="bg-slate-800 hover:bg-slate-700"
                    onClick={handleCopy}
                    disabled={isSubmitting}
                  >
                    复制话术
                  </Button>
                </div>
              )}
            </div>
            {assistantError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                <p>{assistantError}</p>
                <Button
                  type="button"
                  className="mt-3 bg-red-600 hover:bg-red-500"
                  onClick={runGeneration}
                  disabled={isSubmitting}
                >
                  重新生成
                </Button>
              </div>
            )}

            {!assistantError && isSubmitting && (
              <p className="mt-4 text-sm text-slate-500">生成中，请稍候...</p>
            )}

            {!assistantError && !isSubmitting && assistantSuggestion && (
              <div className="mt-4 space-y-4 text-sm text-slate-700">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    核心价值
                  </p>
                  <p className="mt-1">
                    {renderValue(assistantSuggestion.coreValue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    应对疑义
                  </p>
                  <p className="mt-1">
                    {renderValue(assistantSuggestion.objectionResponse)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    案例类比
                  </p>
                  <p className="mt-1">
                    {renderValue(assistantSuggestion.caseAnalogy)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    推进动作
                  </p>
                  <p className="mt-1">
                    {renderValue(assistantSuggestion.nextStep)}
                  </p>
                </div>
              </div>
            )}

            {!assistantError && !isSubmitting && !assistantSuggestion && (
              <p className="mt-4 text-sm text-slate-500">
                填写商户画像并提交后，这里会展示生成的话术建议。
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 font-['Rubik']">
              历史记录区
            </h2>
            {history.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">暂无生成记录。</p>
            ) : (
              <div
                ref={historyRef}
                className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1"
              >
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm transition hover:border-slate-200"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{item.createdAt}</span>
                        <span>·</span>
                        <span>{item.snapshot.productId}</span>
                        <span>·</span>
                        <span>{item.snapshot.industry}</span>
                      </div>
                      <button
                        type="button"
                        className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500 transition hover:border-slate-400"
                        onClick={() => applyHistory(item)}
                      >
                        回填
                      </button>
                    </div>
                    {item.question && (
                      <p className="mt-2 text-slate-600">
                        商户提问：{item.question}
                      </p>
                    )}
                    <p className="mt-2 text-slate-700">
                      核心价值：{renderValue(item.suggestion.coreValue)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <section className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 font-['Rubik']">
                销售演练系统
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                商户连续提问，你逐题回答并获取评分，完成后生成报告。
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
            {drillItems.length > 0 && (
              <span>
                进度 {Math.min(drillIndex + 1, drillItems.length)}/
                {drillItems.length}
              </span>
            )}
              {drillQuestionSource && (
                <span>
                  问题来源：{drillQuestionSource === "ai" ? "AI" : "默认"}
                </span>
              )}
              <Button
                type="button"
                onClick={startDrill}
                disabled={drillLoading || drillQuestionsLoading}
              >
                {drillQuestionsLoading
                  ? "生成中..."
                  : drillActive
                    ? "重新开始"
                    : "开始演练"}
              </Button>
            </div>
          </div>

        {drillError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {drillError}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>对话流</span>
              {drillItems.length > 0 && (
                <span>
                  当前问题 {Math.min(drillIndex + 1, drillItems.length)}/
                  {drillItems.length}
                </span>
              )}
            </div>
            <div
              ref={drillChatRef}
              className="mt-4 max-h-[420px] space-y-4 overflow-y-auto pr-2"
            >
              {visibleDrillItems.length === 0 ? (
                <p className="text-sm text-slate-500">
                  点击“开始演练”生成对话内容。
                </p>
              ) : (
                visibleDrillItems.map((item, index) => (
                  <div key={`${item.question}-${index}`} className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 h-8 w-8 rounded-full bg-slate-900 text-center text-xs font-semibold leading-8 text-white">
                        商
                      </div>
                      <div className="max-w-[80%] rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                        <p>{item.question}</p>
                        {item.kind === "followup" && (
                          <span className="mt-2 inline-flex rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                            补充追问
                          </span>
                        )}
                      </div>
                    </div>
                    {item.answer && (
                      <div className="flex items-start justify-end gap-3">
                        <div className="max-w-[80%] rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-sm">
                          <p className="text-xs text-slate-300">你的回答</p>
                          <p className="mt-2 whitespace-pre-line text-white">
                            {item.answer}
                          </p>
                          {item.score !== undefined && (
                            <p className="mt-2 text-xs text-slate-300">
                              评分 {item.score} · {item.highlight}
                            </p>
                          )}
                        </div>
                        <div className="mt-1 h-8 w-8 rounded-full bg-blue-600 text-center text-xs font-semibold leading-8 text-white">
                          我
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="mt-4 space-y-2">
              <Label htmlFor="drill-answer">你的回答</Label>
              <Textarea
                id="drill-answer"
                rows={3}
                className="bg-white"
                placeholder="用 2-3 句回应商户疑义，并给出推进动作..."
                value={drillAnswer}
                onChange={(event) => setDrillAnswer(event.target.value)}
                disabled={!drillActive}
              />
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-xs text-slate-400">
                  建议回答包括价值、案例与下一步动作
                </span>
                <Button
                  type="button"
                  onClick={submitDrillAnswer}
                  disabled={!drillActive || drillLoading}
                >
                  {drillLoading ? "评分中..." : "提交并评分"}
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">
                评分记录
              </p>
              {drillLoading && (
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
                  <p className="text-xs text-slate-400">AI 实时反馈</p>
                  <p className="mt-2 whitespace-pre-line text-slate-700">
                    {drillStreamText || "生成中..."}
                  </p>
                </div>
              )}
              {drillItems.filter((item) => item.score !== undefined).length ===
              0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  暂无评分记录。
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {drillItems
                    .filter((item) => item.score !== undefined)
                    .map((item) => (
                      <div
                        key={item.question}
                        className="rounded-xl border border-slate-200 bg-white p-3 text-sm"
                      >
                        <p className="text-xs text-slate-400">
                          得分 {item.score}
                          {item.kind === "followup" && " · 追问"}
                        </p>
                        <p className="mt-1 text-slate-700">{item.question}</p>
                        <p className="mt-2 text-slate-600">
                          亮点：{item.highlight}
                        </p>
                        <p className="mt-1 text-slate-600">
                          建议：{item.improve}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase text-slate-500">
                演练报告
              </p>
              {drillReport ? (
                <div className="mt-3 space-y-3 text-sm text-slate-700">
                  <p>{drillReport.summary}</p>
                  <div>
                    <p className="text-xs font-semibold text-slate-500">
                      亮点
                    </p>
                    {drillReport.strengths.length === 0 ? (
                      <p className="mt-1 text-slate-500">暂无</p>
                    ) : (
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {drillReport.strengths.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500">
                      改进建议
                    </p>
                    {drillReport.improvements.length === 0 ? (
                      <p className="mt-1 text-slate-500">暂无</p>
                    ) : (
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {drillReport.improvements.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-500">
                      下一步
                    </p>
                    {drillReport.nextSteps.length === 0 ? (
                      <p className="mt-1 text-slate-500">暂无</p>
                    ) : (
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {drillReport.nextSteps.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  完成所有问题后生成报告。
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { productCatalog } from "./data/productCatalog";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Select } from "./components/ui/select";
import { Textarea } from "./components/ui/textarea";
import type {
  MerchantObjection,
  MerchantProfile,
  ProductId,
  ScriptSuggestion
} from "./types/salesAssistant";
import { generateScriptAdvice } from "./lib/salesAssistantClient";

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
  productName: string;
  industry: string;
  question: string;
  suggestion: ScriptSuggestion;
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
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [assistantError, setAssistantError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [assistantSuggestion, setAssistantSuggestion] =
    useState<ScriptSuggestion | null>(null);
  const [merchantQuestion, setMerchantQuestion] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const historyRef = useRef<HTMLDivElement>(null);

  const selectedProduct = useMemo(
    () => productCatalog.find((item) => item.id === form.productId),
    [form.productId]
  );

  useEffect(() => {
    if (!historyRef.current) return;
    historyRef.current.scrollTo({
      top: historyRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [history]);

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

  const runGeneration = async () => {
    setIsSubmitting(true);
    setAssistantError("");
    setCopyMessage("");
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
      setHistory((prev) =>
        [
          ...prev,
          {
            id: `${Date.now()}`,
            createdAt: new Date().toLocaleString("zh-CN"),
            productName: selectedProduct?.name ?? form.productId,
            industry: form.industry,
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
  };

  const renderValue = (value: string) => {
    return value.trim() ? value : "待补充";
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setSubmitError("请完善必填信息后再提交。");
      return;
    }

    setSubmitError("");
    await runGeneration();
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <header className="flex flex-col gap-3">
        <span className="inline-flex w-fit items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
          PitchPerfect · 新人销售话术助手
        </span>
        <h1 className="text-3xl font-semibold text-slate-900">
          产品范围与对话流程
        </h1>
        <p className="text-base text-slate-600">
          录入商户画像并选择意向产品，系统会输出商户常见疑义，帮助新人销售
          抓住关键点。
        </p>
      </header>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">三方对话流程</h2>
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

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">商户画像表单</h2>
            {isSubmitting && (
              <span className="text-xs font-medium text-slate-500">
                正在生成建议...
              </span>
            )}
          </div>
          <div className="mt-4">
            <p className="text-xs text-slate-500">示例画像一键填充：</p>
            <div className="mt-2 flex flex-wrap gap-2">
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
            </div>
          </div>

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
              <Label htmlFor="scale">规模</Label>
              <Select
                id="scale"
                value={form.scale}
                onChange={(event) => handleChange("scale", event.target.value)}
              >
                <option value="">请选择规模</option>
                <option value="1-5人">1-5人</option>
                <option value="6-15人">6-15人</option>
                <option value="16-50人">16-50人</option>
                <option value="50+人">50+人</option>
              </Select>
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
              <Label htmlFor="product">意向产品</Label>
              <Select
                id="product"
                value={form.productId}
                onChange={(event) =>
                  handleChange("productId", event.target.value as ProductId)
                }
              >
                {productCatalog.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </Select>
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
              />
            </div>

            {submitError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {submitError}
              </div>
            )}

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "生成中..." : "生成话术建议"}
            </Button>
          </form>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">商户提问区</h2>
            <p className="mt-2 text-sm text-slate-600">
              可填写商户的具体疑义，系统会优先纳入话术建议。
            </p>
            <Textarea
              className="mt-4"
              rows={4}
              placeholder="例如：我们担心投放后成本太高，具体ROI能看到吗？"
              value={merchantQuestion}
              onChange={(event) => setMerchantQuestion(event.target.value)}
            />
            {!merchantQuestion.trim() && (
              <p className="mt-2 text-xs text-slate-400">
                当前为空，将默认使用常见疑义作为输入。
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">常见疑义</h2>
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
              <h2 className="text-lg font-semibold text-slate-900">话术建议</h2>
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
            <h2 className="text-lg font-semibold text-slate-900">历史记录区</h2>
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
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>{item.createdAt}</span>
                      <span>·</span>
                      <span>{item.productName}</span>
                      <span>·</span>
                      <span>{item.industry}</span>
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
    </main>
  );
}

import { useMemo, useState, type FormEvent } from "react";
import { productCatalog } from "./data/productCatalog";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Select } from "./components/ui/select";
import { Textarea } from "./components/ui/textarea";
import type { MerchantProfile, ProductId } from "./types/salesAssistant";

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

type FormState = MerchantProfile & {
  productId: ProductId;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

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

  const selectedProduct = useMemo(
    () => productCatalog.find((item) => item.id === form.productId),
    [form.productId]
  );

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setSubmitError("请完善必填信息后再提交。");
      return;
    }

    setSubmitError("");
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
    }, 700);
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
      </div>
    </main>
  );
}

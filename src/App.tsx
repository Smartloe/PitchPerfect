import { useMemo, useState } from "react";
import { productCatalog } from "./data/productCatalog";

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

export default function App() {
  const [selectedId, setSelectedId] = useState(productCatalog[0]?.id ?? "");

  const selectedProduct = useMemo(
    () => productCatalog.find((item) => item.id === selectedId),
    [selectedId]
  );

  return (
    <main>
      <header>
        <span className="badge">PitchPerfect · 新人销售话术助手</span>
        <h1>产品范围与对话流程</h1>
        <p>
          选择产品类型，快速查看商户常见疑义。用于新人销售在首轮沟通中
          抓住重点。
        </p>
      </header>

      <section>
        <h2>三方对话流程</h2>
        <div className="flow">
          {flowSteps.map((step) => (
            <div className="flow-card" key={step.role}>
              <strong>{step.role}</strong>
              <p>{step.goal}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2>产品选择</h2>
        <p>选择意向产品，系统会呈现对应的常见疑义。</p>
        <select
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {productCatalog.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>

        {selectedProduct ? (
          <div>
            <h3>{selectedProduct.name}</h3>
            <p>{selectedProduct.summary}</p>
            <ul>
              {selectedProduct.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p>暂无可用产品信息。</p>
        )}
      </section>
    </main>
  );
}

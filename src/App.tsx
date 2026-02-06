import {
  useCallback,
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
import { cn } from "./lib/cn";
import {
  clearAuth,
  getStoredAuth,
  loginAccount,
  registerAccount,
  saveMemoryEntry,
  storeAuth
} from "./lib/authClient";

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

const navItems = [
  {
    id: "dashboard",
    label: "首页",
    description: "仪表盘",
    icon: "dashboard"
  },
  {
    id: "training",
    label: "训练",
    description: "对话模拟",
    icon: "training"
  },
  {
    id: "cases",
    label: "案例库",
    description: "成功案例",
    icon: "cases"
  },
  {
    id: "toolbox",
    label: "工具箱",
    description: "模板收藏",
    icon: "toolbox"
  },
  {
    id: "profile",
    label: "个人中心",
    description: "成长数据",
    icon: "profile"
  }
] as const;

const trainingTabs = [
  {
    id: "assistant",
    label: "话术生成",
    description: "生成可复制话术"
  },
  {
    id: "drill",
    label: "销售演练",
    description: "模拟对话与评分"
  }
] as const;

const caseLibrary = [
  {
    id: "case-fitness",
    title: "写字楼健身工作室首周引流",
    industry: "健身",
    district: "写字楼商圈",
    summary: "白领午间时段专项投放 + 体验课留资，提升转化效率。",
    result: "7天新增线索 45 个，转化 12 单。",
    highlights: ["分时段预算控制", "短周期验证素材转化", "体验课引导成交"],
    script:
      "我们先用白领午间高峰做 7 天投放，预算分段控制，先看咨询成本，再逐步放量。"
  },
  {
    id: "case-dessert",
    title: "甜品店节假日复购提升",
    industry: "甜品",
    district: "购物中心",
    summary: "节假日套餐 + 留资提醒，复购率显著提升。",
    result: "节假日复购率提升 28%。",
    highlights: ["高频节日套餐", "会员留资提醒", "到店转化跟进"],
    script:
      "我们把节假日套餐和留资权益绑定，先拉高到店意向，再用短信提醒完成二次转化。"
  },
  {
    id: "case-coffee",
    title: "社区咖啡馆周末客流优化",
    industry: "咖啡",
    district: "社区生活圈",
    summary: "周末套餐 + 线上下单，缓解排队并提升客单。",
    result: "周末客单提升 18%，线上单占比 35%。",
    highlights: ["线上点单分流", "套餐联动", "社群复购"],
    script:
      "先把周末热销套餐上线并引导线上下单，分流排队压力，同时提升客单。"
  },
  {
    id: "case-beauty",
    title: "美容工作室投放成本下降",
    industry: "美容",
    district: "社区生活圈",
    summary: "素材 A/B 测试 + 分层投放，降低平均获客成本。",
    result: "获客成本下降 22%。",
    highlights: ["素材快速试错", "预算分层", "低成本人群扩量"],
    script:
      "先用 2 套素材做 3 天试投放，保留转化高的素材后逐步扩量。"
  }
];

const toolboxTemplates = [
  {
    id: "tpl-open",
    category: "开场破冰",
    title: "商圈痛点切入",
    content:
      "先帮您把写字楼白领的午间需求跑通，确保每一笔投放都有到店目标。"
  },
  {
    id: "tpl-value",
    category: "价值阐述",
    title: "交易增长",
    content:
      "我们会把预算拆成小周期验证，先跑通转化路径，再逐步放量保障投入产出。"
  },
  {
    id: "tpl-case",
    category: "案例背书",
    title: "同业案例",
    content:
      "附近同类型门店用分时段投放 + 体验课留资，7 天新增线索 40+。"
  },
  {
    id: "tpl-cost",
    category: "成本控制",
    title: "预算可控",
    content:
      "预算可以按天设置，先小额试跑，成本达标再逐步加码。"
  },
  {
    id: "tpl-next",
    category: "推进动作",
    title: "下一步推进",
    content:
      "我们先安排 3 天试投放，回收数据后一起确认是否扩大预算。"
  },
  {
    id: "tpl-retention",
    category: "留资转化",
    title: "留资话术",
    content:
      "我们把留资动作放在高意向节点，后续用福利提醒完成到店。"
  }
];

const achievementTracks = [
  {
    id: "ach-streak",
    title: "连续训练 3 天",
    description: "保持每日练习节奏",
    progress: 66
  },
  {
    id: "ach-score",
    title: "平均得分 80+",
    description: "回答结构稳定",
    progress: 45
  },
  {
    id: "ach-scripts",
    title: "收藏 5 条话术",
    description: "建立个人话术库",
    progress: 20
  }
];

const cardBaseStyles =
  "relative overflow-hidden border border-white/70 bg-[linear-gradient(160deg,rgba(255,255,255,0.9),rgba(244,248,255,0.72))] ring-1 ring-white/[0.65] backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-20 before:bg-gradient-to-b before:from-white/60 before:to-transparent after:pointer-events-none after:absolute after:inset-0 after:border after:border-white/[0.55] after:shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]";

const cardBase = cn(
  cardBaseStyles,
  "rounded-3xl shadow-[0_26px_64px_rgba(15,23,42,0.12)] after:rounded-[24px]"
);
const cardSoft = cn(
  cardBaseStyles,
  "rounded-2xl bg-[linear-gradient(165deg,rgba(255,255,255,0.88),rgba(247,250,255,0.72))] shadow-[0_18px_44px_rgba(15,23,42,0.1)] after:rounded-[20px]"
);
const cardGhost = cn(
  cardBaseStyles,
  "rounded-2xl bg-[linear-gradient(165deg,rgba(255,255,255,0.78),rgba(242,246,255,0.65))] shadow-[0_14px_30px_rgba(15,23,42,0.08)] after:rounded-[18px]"
);
const hoverLift =
  "transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_68px_rgba(15,23,42,0.16)]";
const pillBase =
  "inline-flex items-center rounded-full border border-white/70 bg-white/80 px-3 py-1 text-xs font-semibold tracking-[0.01em] text-slate-600 shadow-[0_10px_22px_rgba(15,23,42,0.08)] backdrop-blur-md transition duration-200 hover:-translate-y-0.5 hover:border-blue-200 active:border-blue-600 active:bg-blue-600 active:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200";
const pillSubtle =
  "inline-flex items-center rounded-full border border-white/60 bg-white/[0.72] px-2.5 py-0.5 text-xs font-medium text-slate-500 shadow-[0_8px_18px_rgba(15,23,42,0.07)] backdrop-blur transition duration-200 hover:border-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200";

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

type NavId = (typeof navItems)[number]["id"];
type TrainingTab = (typeof trainingTabs)[number]["id"];

const requiredFieldLabels: Record<keyof FormState, string> = {
  industry: "行业",
  scale: "规模",
  businessDistrict: "商圈",
  focusAreas: "关注点",
  notes: "补充说明",
  productId: "意向产品"
};

function useTimeout(callback: () => void, delay: number, deps: React.DependencyList) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const timer = setTimeout(() => callbackRef.current(), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

type IconName =
  | "dashboard"
  | "training"
  | "cases"
  | "toolbox"
  | "profile"
  | "spark"
  | "play"
  | "bookmark"
  | "mic"
  | "trend"
  | "search"
  | "filter";

const Icon = ({ name, className }: { name: IconName; className?: string }) => {
  const base = "h-5 w-5";
  const classes = cn(base, className);
  const props = {
    className: classes,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
  };
  switch (name) {
    case "dashboard":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="8" height="8" rx="1.5" />
          <rect x="13" y="3" width="8" height="5" rx="1.5" />
          <rect x="13" y="10" width="8" height="11" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" />
        </svg>
      );
    case "training":
      return (
        <svg {...props}>
          <path d="M21 12a7 7 0 0 1-7 7H7l-4 3V7a4 4 0 0 1 4-4h7a7 7 0 0 1 7 7Z" />
        </svg>
      );
    case "cases":
      return (
        <svg {...props}>
          <path d="M4 5a3 3 0 0 1 3-3h11v18H7a3 3 0 0 0-3 3Z" />
          <path d="M8 5h7" />
          <path d="M8 9h7" />
          <path d="M8 13h5" />
        </svg>
      );
    case "toolbox":
      return (
        <svg {...props}>
          <path d="M9 4h6l1 3h4v4H4V7h4l1-3Z" />
          <path d="M4 11h16v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
          <path d="M10 15h4" />
        </svg>
      );
    case "profile":
      return (
        <svg {...props}>
          <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );
    case "spark":
      return (
        <svg {...props}>
          <path d="m12 2 1.7 4.6L18 8l-4.3 1.4L12 14l-1.7-4.6L6 8l4.3-1.4L12 2Z" />
        </svg>
      );
    case "play":
      return (
        <svg {...props}>
          <path d="M7 5v14l11-7Z" />
        </svg>
      );
    case "bookmark":
      return (
        <svg {...props}>
          <path d="M7 4h10a1 1 0 0 1 1 1v16l-6-3-6 3V5a1 1 0 0 1 1-1Z" />
        </svg>
      );
    case "mic":
      return (
        <svg {...props}>
          <rect x="9" y="3" width="6" height="10" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v3" />
          <path d="M8 21h8" />
        </svg>
      );
    case "trend":
      return (
        <svg {...props}>
          <path d="m4 16 6-6 4 4 6-7" />
          <path d="M16 7h4v4" />
        </svg>
      );
    case "search":
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      );
    case "filter":
      return (
        <svg {...props}>
          <path d="M4 5h16l-6 7v5l-4 2v-7Z" />
        </svg>
      );
    default:
      return null;
  }
};

const SkeletonLine = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "h-3 w-full rounded-full bg-slate-200/80 animate-pulse",
      className
    )}
  />
);

const SkeletonCard = ({ lines = 3 }: { lines?: number }) => (
  <div className={cn(cardSoft, "p-4")}>
    <SkeletonLine className="w-20" />
    {Array.from({ length: lines }).map((_, index) => (
      <SkeletonLine key={index} className={index === lines - 1 ? "w-4/5" : ""} />
    ))}
  </div>
);

function getToneColor(tone: "blue" | "emerald" | "slate"): string {
  switch (tone) {
    case "emerald":
      return "stroke-emerald-500";
    case "slate":
      return "stroke-slate-400";
    default:
      return "stroke-blue-500";
  }
}

const EmptyIllustration = ({ tone }: { tone: "blue" | "emerald" | "slate" }) => {
  const color = getToneColor(tone);
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
      <svg
        className={cn("h-7 w-7", color)}
        viewBox="0 0 24 24"
        fill="none"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="5" width="16" height="14" rx="3" />
        <path d="M8 10h8" />
        <path d="M8 14h5" />
      </svg>
    </div>
  );
};

const EmptyState = ({
  title,
  description,
  tone = "blue",
  actionLabel,
  onAction
}: {
  title: string;
  description: string;
  tone?: "blue" | "emerald" | "slate";
  actionLabel?: string;
  onAction?: () => void;
}) => (
  <div className={cn(cardSoft, "flex items-start gap-4 p-4")}>
    <EmptyIllustration tone={tone} />
    <div className="flex-1">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-2 text-xs text-slate-500">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          className="mt-3 text-xs font-semibold text-blue-600 transition hover:text-blue-500"
          onClick={onAction}
        >
          {actionLabel}
        </button>
      )}
    </div>
  </div>
);

export default function App() {
  const [activePage, setActivePage] = useState<NavId>("dashboard");
  const [trainingTab, setTrainingTab] = useState<TrainingTab>("assistant");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [authUser, setAuthUser] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [memoryNotice, setMemoryNotice] = useState("");
  const [authDrawerOpen, setAuthDrawerOpen] = useState(false);
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
  const [recordingActive, setRecordingActive] = useState(false);
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
  const [savedScripts, setSavedScripts] = useState<HistoryItem[]>([]);
  const [activeCaseId, setActiveCaseId] = useState(
    caseLibrary[0]?.id ?? ""
  );
  const [caseIndustry, setCaseIndustry] = useState("全部");
  const [caseDistrict, setCaseDistrict] = useState("全部");
  const [toolboxQuery, setToolboxQuery] = useState("");
  const [toolboxCategory, setToolboxCategory] = useState("全部");
  const [favoriteTemplates, setFavoriteTemplates] = useState<string[]>([]);
  const [toolboxNotice, setToolboxNotice] = useState("");
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

  const pageMeta: Record<NavId, { title: string; description: string }> = {
    dashboard: {
      title: "首页仪表盘",
      description: "快速进入训练、查看进度与案例推荐。"
    },
    training: {
      title: "训练中心",
      description: "模拟对话并获得实时指导，提升成交能力。"
    },
    cases: {
      title: "案例库",
      description: "按行业与商圈筛选高质量成交案例。"
    },
    toolbox: {
      title: "话术工具箱",
      description: "一键调用模板话术，构建个人话术库。"
    },
    profile: {
      title: "个人中心",
      description: "掌握训练成果与成长路线。"
    }
  };

  const caseIndustries = useMemo(
    () => ["全部", ...Array.from(new Set(caseLibrary.map((item) => item.industry)))],
    []
  );
  const caseDistricts = useMemo(
    () => ["全部", ...Array.from(new Set(caseLibrary.map((item) => item.district)))],
    []
  );
  const filteredCases = useMemo(() => {
    return caseLibrary.filter((item) => {
      const industryMatch =
        caseIndustry === "全部" || item.industry === caseIndustry;
      const districtMatch =
        caseDistrict === "全部" || item.district === caseDistrict;
      return industryMatch && districtMatch;
    });
  }, [caseIndustry, caseDistrict]);
  const activeCase = useMemo(() => {
    return (
      caseLibrary.find((item) => item.id === activeCaseId) ||
      filteredCases[0] ||
      caseLibrary[0]
    );
  }, [activeCaseId, filteredCases]);

  const toolboxCategories = useMemo(
    () => [
      "全部",
      ...Array.from(new Set(toolboxTemplates.map((item) => item.category)))
    ],
    []
  );
  const visibleTemplates = useMemo(() => {
    return toolboxTemplates.filter((item) => {
      const categoryMatch =
        toolboxCategory === "全部" || item.category === toolboxCategory;
      const queryMatch =
        !toolboxQuery.trim() ||
        item.title.includes(toolboxQuery.trim()) ||
        item.content.includes(toolboxQuery.trim());
      return categoryMatch && queryMatch;
    });
  }, [toolboxCategory, toolboxQuery]);

  const scoredItems = useMemo(
    () => drillItems.filter((item) => typeof item.score === "number"),
    [drillItems]
  );
  const averageScore = useMemo(() => {
    if (scoredItems.length === 0) return 0;
    const sum = scoredItems.reduce((acc, item) => acc + (item.score ?? 0), 0);
    return Math.round(sum / scoredItems.length);
  }, [scoredItems]);

  const guidanceTips = useMemo(() => {
    const tips = [
      "结构建议：价值-案例-推进动作三段式。",
      "用 1 句交代收益，再给 1 句下一步动作。"
    ];
    if (form.focusAreas.includes("投放成本")) {
      tips.push("强调预算可控与分阶段投放，降低试错成本。");
    }
    if (form.focusAreas.includes("案例背书")) {
      tips.push("补充附近商家案例，增强信任感。");
    }
    if (form.focusAreas.includes("流量增长")) {
      tips.push("明确预期流量区间与起量节奏。");
    }
    return tips.slice(0, 4);
  }, [form.focusAreas]);

  const getScoreTone = (score?: number) => {
    if (typeof score !== "number") {
      return { badge: "bg-slate-100 text-slate-500" };
    }
    if (score >= 85) {
      return { badge: "bg-emerald-100 text-emerald-700" };
    }
    if (score >= 70) {
      return { badge: "bg-blue-100 text-blue-700" };
    }
    return { badge: "bg-orange-100 text-orange-700" };
  };

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
    const stored = getStoredAuth();
    if (stored.token && stored.username) {
      setAuthToken(stored.token);
      setAuthUser(stored.username);
    }
  }, []);

  useTimeout(() => setToolboxNotice(""), 1800, [toolboxNotice]);
  useTimeout(() => setMemoryNotice(""), 1800, [memoryNotice]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activePage]);

  useTimeout(() => setSuccessMessage(""), 2000, [successMessage]);

  useEffect(() => {
    if (filteredCases.length === 0) return;
    if (!filteredCases.some((item) => item.id === activeCaseId)) {
      setActiveCaseId(filteredCases[0].id);
    }
  }, [filteredCases, activeCaseId]);

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
      const drillLedger = [
        `- 行业：${form.industry || "待补充"}`,
        `- 意向产品：${selectedProduct?.name || form.productId}`,
        `- 商户问题：${question}`,
        `- 你的回答：${drillAnswer.trim()}`,
        `- 得分：${score.score}`,
        `- 亮点：${score.highlight}`,
        `- 改进建议：${score.improve}`
      ].join("\n");
      const drillSummary = `行业${form.industry} 产品${selectedProduct?.name || form.productId} 问题${question} 得分${score.score} 亮点${score.highlight}`;
      void recordMemory({
        title: "演练问答",
        ledger: drillLedger,
        summarySource: drillSummary
      });
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

  const handleSaveScript = () => {
    if (!assistantSuggestion) return;
    const record: HistoryItem = {
      id: `saved-${Date.now()}`,
      createdAt: new Date().toLocaleString("zh-CN"),
      snapshot: form,
      question: merchantQuestion.trim(),
      suggestion: assistantSuggestion
    };
    setSavedScripts((prev) => [record, ...prev].slice(0, 8));
    setSuccessMessage("已保存到话术库");
  };

  const handleTemplateCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setToolboxNotice("模板已复制");
    } catch (error) {
      setToolboxNotice("复制失败");
    }
  };

  const handleCaseCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setToolboxNotice("案例话术已复制");
    } catch (error) {
      setToolboxNotice("复制失败");
    }
  };

  const handleAuthSubmit = async () => {
    setAuthLoading(true);
    setAuthError("");
    try {
      const username = authForm.username.trim();
      const password = authForm.password;
      if (!username || !password) {
        setAuthError("请输入账号与密码");
        return;
      }
      const response =
        authMode === "register"
          ? await registerAccount(username, password)
          : await loginAccount(username, password);
      setAuthUser(response.username);
      setAuthToken(response.token);
      storeAuth(response.token, response.username);
      setAuthForm({ username: "", password: "" });
      setAuthDrawerOpen(false);
      setMemoryNotice("已登录，可保存记忆");
    } catch (error) {
      const message = error instanceof Error ? error.message : "登录失败";
      setAuthError(message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    clearAuth();
    setAuthUser("");
    setAuthToken("");
    setMemoryNotice("已退出登录");
  };

  const recordMemory = async (entry: {
    title: string;
    ledger: string;
    summarySource: string;
  }) => {
    if (!authToken) return;
    try {
      await saveMemoryEntry(authToken, entry);
    } catch (error) {
      setMemoryNotice("记忆保存失败");
    }
  };

  const toggleFavoriteTemplate = (id: string) => {
    setFavoriteTemplates((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const goToTraining = (tab: TrainingTab = "assistant") => {
    setActivePage("training");
    setTrainingTab(tab);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleSampleStart = (sample: (typeof sampleProfiles)[number]) => {
    applySampleProfile(sample);
    setActivePage("training");
    setTrainingTab("assistant");
    setSidebarOpen(true);
  };

  const toggleRecording = () => {
    setRecordingActive((prev) => !prev);
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
      const objectionText =
        merchantQuestion.trim() ||
        selectedProduct?.questions[0] ||
        "常见疑义";
      const ledger = [
        `- 行业：${form.industry || "待补充"}`,
        `- 规模：${form.scale || "待补充"}`,
        `- 商圈：${form.businessDistrict || "待补充"}`,
        `- 关注点：${form.focusAreas.join("、") || "待补充"}`,
        `- 商户疑义：${objectionText}`,
        `- 话术建议：`,
        `  - 核心价值：${renderValue(response.suggestion.coreValue)}`,
        `  - 应对疑义：${renderValue(response.suggestion.objectionResponse)}`,
        `  - 案例类比：${renderValue(response.suggestion.caseAnalogy)}`,
        `  - 推进动作：${renderValue(response.suggestion.nextStep)}`
      ].join("\n");
      const summarySource = `行业${form.industry} 商圈${form.businessDistrict} 关注点${form.focusAreas.join("、")} 疑义${objectionText} 话术要点${renderValue(response.suggestion.coreValue)} ${renderValue(response.suggestion.nextStep)}`;
      void recordMemory({
        title: "话术生成",
        ledger,
        summarySource
      });
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

  const recentHistory = useMemo(
    () => history.slice(-3).reverse(),
    [history]
  );

  const merchantSummary = [
    { label: "行业", value: form.industry || "待补充" },
    { label: "规模", value: form.scale || "待补充" },
    { label: "商圈", value: form.businessDistrict || "待补充" },
    {
      label: "产品",
      value: selectedProduct?.name || form.productId || "待补充"
    }
  ];

  const assistantPanel = (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="space-y-6">
        <section className={cn(cardBase, "p-5", hoverLift)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                商户疑义
              </p>
              <p className="mt-1 text-sm text-slate-600">
                输入具体疑义或直接选取常见问题。
              </p>
            </div>
            <span className="text-xs text-slate-400">
              Ctrl/Command + Enter 生成
            </span>
          </div>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="merchant-question">商户提问</Label>
              <Textarea
                id="merchant-question"
                rows={4}
                placeholder="例如：担心投放后成本太高，具体ROI能看到吗？"
                value={merchantQuestion}
                onChange={(event) => setMerchantQuestion(event.target.value)}
                onKeyDown={handleQuestionKeyDown}
              />
              {!merchantQuestion.trim() && (
                <p className="text-xs text-slate-400">
                  当前为空，将默认使用常见疑义作为输入。
                </p>
              )}
            </div>
            <div className={cn(cardSoft, "p-4")}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">
                  常见疑义
                </p>
                {selectedProduct && (
                  <span className="text-xs text-slate-400">
                    {selectedProduct.name}
                  </span>
                )}
              </div>
              {selectedProduct ? (
                <div className="mt-3 space-y-3">
                  <p className="text-xs text-slate-500">
                    {selectedProduct.summary}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedProduct.questions.map((question) => (
                      <button
                        key={question}
                        type="button"
                        className={cn(pillBase, "cursor-pointer")}
                        onClick={() => setMerchantQuestion(question)}
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-500">暂无可用产品信息。</p>
              )}
            </div>
          </div>
        </section>

        <section className={cn(cardBase, "p-5", hoverLift)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 font-['Rubik']">
                话术建议
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                输出结构化话术，支持一键复制与收藏。
              </p>
            </div>
            {assistantSuggestion && !assistantError && (
              <div className="flex items-center gap-2">
                {copyMessage && (
                  <span className="text-xs text-slate-500">
                    {copyMessage}
                  </span>
                )}
                <Button
                  type="button"
                  className="bg-slate-100 text-slate-700 hover:bg-slate-200"
                  onClick={handleSaveScript}
                  disabled={isSubmitting}
                >
                  保存话术
                </Button>
                <Button
                  type="button"
                  className="bg-blue-600 hover:bg-blue-500"
                  onClick={handleCopy}
                  disabled={isSubmitting}
                >
                  复制话术
                </Button>
              </div>
            )}
          </div>

          {assistantError && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
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
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          )}

          {!assistantError && !isSubmitting && assistantSuggestion && (
            <div className="mt-4 grid gap-4 text-sm text-slate-700">
              <div className={cn(cardSoft, "p-4")}>
                <p className="text-xs font-semibold uppercase text-slate-500">
                  核心价值
                </p>
                <p className="mt-2">
                  {renderValue(assistantSuggestion.coreValue)}
                </p>
              </div>
              <div className={cn(cardSoft, "p-4")}>
                <p className="text-xs font-semibold uppercase text-slate-500">
                  应对疑义
                </p>
                <p className="mt-2">
                  {renderValue(assistantSuggestion.objectionResponse)}
                </p>
              </div>
              <div className={cn(cardSoft, "p-4")}>
                <p className="text-xs font-semibold uppercase text-slate-500">
                  案例类比
                </p>
                <p className="mt-2">
                  {renderValue(assistantSuggestion.caseAnalogy)}
                </p>
              </div>
              <div className={cn(cardSoft, "p-4")}>
                <p className="text-xs font-semibold uppercase text-slate-500">
                  推进动作
                </p>
                <p className="mt-2">
                  {renderValue(assistantSuggestion.nextStep)}
                </p>
              </div>
            </div>
          )}

          {!assistantError && !isSubmitting && !assistantSuggestion && (
            <div className="mt-4">
              <EmptyState
                title="暂无话术建议"
                description="填写商户信息后点击生成，即可获得结构化话术。"
                actionLabel="回到表单"
                onAction={() =>
                  formRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                  })
                }
              />
            </div>
          )}
        </section>
      </div>

      <div className="space-y-6">
        <section className={cn(cardBase, "p-5", hoverLift)}>
          <p className="text-xs font-semibold uppercase text-slate-500">
            实时指导工具
          </p>
          <p className="mt-2 text-sm text-slate-600">
            根据关注点输出即时指导，帮助你快速调整话术结构。
          </p>
          <div className="mt-4 space-y-3">
            {guidanceTips.map((tip) => (
              <div
                key={tip}
                className={cn(
                  cardGhost,
                  "flex items-start gap-3 px-3 py-2 text-sm text-slate-600"
                )}
              >
                <span className="mt-2 h-2 w-2 rounded-full bg-blue-500" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </section>

        <section className={cn(cardBase, "p-5", hoverLift)}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                推荐案例
              </p>
              <p className="mt-2 text-sm text-slate-600">
                快速查看同类型门店的成功打法。
              </p>
            </div>
            <button
              type="button"
              className="text-xs font-semibold text-blue-600 transition hover:text-blue-500"
              onClick={() => setActivePage("cases")}
            >
              查看更多
            </button>
          </div>
          {activeCase ? (
            <div className={cn(cardSoft, "mt-4 p-4 text-sm text-slate-700")}>
              <p className="font-semibold">{activeCase.title}</p>
              <p className="mt-2 text-slate-600">{activeCase.summary}</p>
              <p className="mt-2 text-xs text-slate-500">
                {activeCase.result}
              </p>
              <div className="mt-3 flex items-center justify-between">
                <span
                  className={cn(
                    pillSubtle,
                    "border-blue-100/80 bg-blue-100/90 text-blue-700 shadow-none"
                  )}
                >
                  {activeCase.industry}
                </span>
                <button
                  type="button"
                  className="text-xs text-blue-600 transition hover:text-blue-500"
                  onClick={() => handleCaseCopy(activeCase.script)}
                >
                  复制案例话术
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="暂无推荐案例"
                description="完善画像后将自动推荐相似商户案例。"
              />
            </div>
          )}
        </section>

        <section className={cn(cardBase, "p-5", hoverLift)}>
          <h3 className="text-base font-semibold text-slate-900 font-['Rubik']">
            最近话术记录
          </h3>
          {history.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                tone="slate"
                title="暂无话术记录"
                description="生成话术后将自动沉淀在这里。"
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {recentHistory.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    cardGhost,
                    "p-3 text-sm transition hover:border-blue-200"
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{item.createdAt}</span>
                    <button
                      type="button"
                      className="text-blue-600 transition hover:text-blue-500"
                      onClick={() => applyHistory(item)}
                    >
                      回填
                    </button>
                  </div>
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
  );

  const drillPanel = (
    <section className={cn(cardBase, "p-5", hoverLift)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 font-['Rubik']">
            销售演练系统
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            商户连续提问，你逐题回答并获取评分，完成后生成报告。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
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
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          {drillError}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className={cn(cardSoft, "p-4")}>
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
            className="mt-4 max-h-[420px] space-y-4 overflow-y-auto rounded-2xl bg-gradient-to-br from-white/60 via-white/40 to-blue-50/40 p-3 pr-2 shadow-inner"
          >
            {drillQuestionsLoading ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-8 w-8 rounded-full bg-slate-200" />
                  <div className="w-3/4 rounded-2xl border border-white/60 bg-white/70 p-3 shadow-sm">
                    <SkeletonLine />
                    <SkeletonLine className="w-2/3" />
                  </div>
                </div>
                <div className="flex items-start justify-end gap-3">
                  <div className="w-2/3 rounded-2xl bg-blue-100/70 p-3">
                    <SkeletonLine className="w-1/2" />
                    <SkeletonLine />
                  </div>
                  <div className="mt-1 h-8 w-8 rounded-full bg-emerald-100" />
                </div>
              </div>
            ) : visibleDrillItems.length === 0 ? (
              <div className="p-2">
                <EmptyState
                  tone="slate"
                  title="准备开始演练"
                  description="点击开始演练，生成商户提问对话。"
                />
              </div>
            ) : (
              visibleDrillItems.map((item, index) => (
                <div key={`${item.question}-${index}`} className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 h-8 w-8 rounded-full bg-slate-900 text-center text-xs font-semibold leading-8 text-white shadow-sm">
                      商
                    </div>
                    <div className="max-w-[80%] rounded-2xl border border-white/70 bg-white/[0.85] px-4 py-3 text-sm text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur">
                      <p>{item.question}</p>
                      {item.kind === "followup" && (
                        <span className="mt-2 inline-flex rounded-full bg-orange-100/80 px-2 py-0.5 text-xs text-orange-700">
                          补充追问
                        </span>
                      )}
                    </div>
                  </div>
                  {item.answer && (
                    <div className="flex items-start justify-end gap-3">
                      <div className="max-w-[80%] rounded-2xl bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600 px-4 py-3 text-sm text-white shadow-[0_12px_30px_rgba(37,99,235,0.35)] ring-1 ring-white/40">
                        <p className="text-xs text-blue-100">你的回答</p>
                        <p className="mt-2 whitespace-pre-line text-white">
                          {item.answer}
                        </p>
                        {item.score !== undefined && (
                          <p className="mt-2 text-xs text-blue-100">
                            评分 {item.score} · {item.highlight}
                          </p>
                        )}
                      </div>
                      <div className="mt-1 h-8 w-8 rounded-full bg-emerald-500 text-center text-xs font-semibold leading-8 text-white shadow-sm">
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
          <div className={cn(cardSoft, "p-4")}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-slate-500">
                录音与评估
              </p>
              <button
                type="button"
                className={cn(pillBase, "cursor-pointer")}
                onClick={toggleRecording}
              >
                {recordingActive ? "停止录音" : "开始录音"}
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              录音功能支持复盘语速与表达逻辑，便于评估表现。
            </p>
            <div className={cn(pillSubtle, "mt-3 gap-2")}>
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  recordingActive ? "bg-emerald-500" : "bg-slate-300"
                )}
              />
              {recordingActive ? "录音中..." : "待开始"}
            </div>
          </div>

          <div className={cn(cardSoft, "p-4")}>
            <p className="text-xs font-semibold uppercase text-slate-500">
              评分记录
            </p>
            {drillLoading && (
              <div className={cn(cardGhost, "mt-3 p-3 text-sm")}>
                <p className="text-xs text-slate-400">AI 实时反馈</p>
                <p className="mt-2 whitespace-pre-line text-slate-700">
                  {drillStreamText || "生成中..."}
                </p>
              </div>
            )}
            {scoredItems.length === 0 ? (
              <div className="mt-3">
                <EmptyState
                  tone="slate"
                  title="暂无评分记录"
                  description="提交回答后将自动生成评分。"
                />
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {scoredItems.map((item) => {
                  const tone = getScoreTone(item.score);
                  return (
                    <div
                      key={item.question}
                      className={cn(cardGhost, "p-3 text-sm")}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
                            tone.badge
                          )}
                        >
                          得分 {item.score}
                          {item.kind === "followup" && " · 追问"}
                        </span>
                        <span className="text-xs text-slate-400">评分记录</span>
                      </div>
                      <p className="mt-2 text-slate-700">{item.question}</p>
                      <p className="mt-2 text-slate-600">
                        亮点：{item.highlight}
                      </p>
                      <p className="mt-1 text-slate-600">
                        建议：{item.improve}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={cn(cardSoft, "p-4")}>
            <p className="text-xs font-semibold uppercase text-slate-500">
              演练报告
            </p>
            {drillReport ? (
              <div className="mt-3 space-y-3 text-sm text-slate-700">
                <p>{drillReport.summary}</p>
                <div>
                  <p className="text-xs font-semibold text-slate-500">亮点</p>
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
  );

  const trainingContent = (
    <div className="space-y-6">
      <section className={cn(cardBase, "p-5", hoverLift)}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-600">
              训练中心
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-900 font-['Rubik']">
              选择训练模式
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              话术生成适合快速准备，销售演练适合模拟真实对话。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {trainingTabs.map((tab) => {
              const active = trainingTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={cn(
                    pillBase,
                    "px-4 py-2 text-sm font-semibold",
                    active
                      ? "border-blue-600 bg-blue-600 text-white shadow-[0_12px_24px_rgba(37,99,235,0.25)]"
                      : "text-slate-600 hover:border-blue-200"
                  )}
                  onClick={() => setTrainingTab(tab.id)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                商户信息侧边栏
              </p>
              <p className="mt-1 text-sm text-slate-600">
                可折叠，随时补充画像信息。
              </p>
            </div>
            <button
              type="button"
              className={cn(pillBase, "cursor-pointer")}
              onClick={() => setSidebarOpen((prev) => !prev)}
            >
              {sidebarOpen ? "收起" : "展开"}
            </button>
          </div>

          {sidebarOpen ? (
            <section
              ref={formRef}
              className={cn(cardBase, "p-5", hoverLift)}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900 font-['Rubik']">
                  商户画像表单
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>
                    完成度 {completion.filled}/{completion.total}
                  </span>
                  <span>{completion.percent}%</span>
                </div>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-blue-600 transition-all"
                  style={{ width: `${completion.percent}%` }}
                />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">示例画像：</span>
                {sampleProfiles.map((sample) => (
                  <button
                    key={sample.id}
                    type="button"
                    className={cn(pillBase, "cursor-pointer")}
                    onClick={() => applySampleProfile(sample)}
                  >
                    {sample.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={cn(pillSubtle, "ml-auto cursor-pointer")}
                  onClick={resetForm}
                >
                  清空表单
                </button>
              </div>

              {errorSummary.length > 0 && (
                <div className="mt-5 rounded-2xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-600">
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
                    onChange={(event) =>
                      handleChange("industry", event.target.value)
                    }
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
                        className={cn(
                          "rounded-xl border px-3 py-2 text-sm font-medium transition",
                          active
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-white/60 bg-white/75 text-slate-600 hover:border-blue-200"
                        )}
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
                          className={cn(
                            pillBase,
                            active
                              ? "border-blue-600 bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.25)]"
                              : "text-slate-600 hover:border-blue-200"
                          )}
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
                  <div role="radiogroup" className="grid gap-3">
                    {productCatalog.map((product) => {
                      const active = form.productId === product.id;
                      return (
                        <button
                          key={product.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                        className={cn(
                          "rounded-xl border px-4 py-3 text-left text-sm transition",
                          active
                            ? "border-blue-600 bg-blue-600 text-white"
                            : "border-white/60 bg-white/75 text-slate-600 hover:border-blue-200"
                        )}
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
                      className={cn(pillSubtle, "cursor-pointer")}
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
                          className={cn(pillBase, "cursor-pointer")}
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
                  <div className="rounded-2xl border border-red-200 bg-red-50/90 px-3 py-2 text-sm text-red-600">
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
          ) : (
            <div className={cn(cardBase, "p-5", hoverLift)}>
              <p className="text-sm font-semibold text-slate-900">
                商户信息已收起
              </p>
              <p className="mt-2 text-sm text-slate-600">
                当前已填写 {completion.filled}/{completion.total} 项信息。
              </p>
              <div className="mt-4 grid gap-2 text-xs text-slate-500">
                {merchantSummary.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-xl border border-slate-100/70 bg-white/70 px-3 py-2"
                  >
                    <span>{item.label}</span>
                    <span className="font-medium text-slate-700">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                className="mt-4 w-full bg-blue-600 hover:bg-blue-500"
                onClick={() => setSidebarOpen(true)}
              >
                展开并编辑
              </Button>
            </div>
          )}
        </aside>

        <div className="space-y-6">
          {trainingTab === "assistant" ? assistantPanel : drillPanel}
        </div>
      </div>
    </div>
  );

  const casesContent = (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className={cn(cardBase, "p-5", hoverLift)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              智能推荐案例
            </p>
            <p className="mt-1 text-sm text-slate-600">
              按行业与商圈筛选，快速找到可复用打法。
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {toolboxNotice && <span>{toolboxNotice}</span>}
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-500">行业</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {caseIndustries.map((industry) => {
                const active = caseIndustry === industry;
                return (
                  <button
                    key={industry}
                    type="button"
                    className={cn(
                      pillBase,
                      active
                        ? "border-blue-600 bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.25)]"
                        : "text-slate-600 hover:border-blue-200"
                    )}
                    onClick={() => setCaseIndustry(industry)}
                  >
                    {industry}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500">商圈</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {caseDistricts.map((district) => {
                const active = caseDistrict === district;
                return (
                  <button
                    key={district}
                    type="button"
                    className={cn(
                      pillBase,
                      active
                        ? "border-blue-600 bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.25)]"
                        : "text-slate-600 hover:border-blue-200"
                    )}
                    onClick={() => setCaseDistrict(district)}
                  >
                    {district}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {filteredCases.length === 0 ? (
            <EmptyState
              title="暂无匹配案例"
              description="尝试调整行业或商圈筛选条件。"
            />
          ) : (
            filteredCases.map((item) => {
              const active = activeCase?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-left text-sm transition",
                    active
                      ? "border-blue-600 bg-blue-50/80 shadow-[0_12px_24px_rgba(37,99,235,0.15)]"
                      : "border-white/70 bg-white/80 shadow-[0_10px_20px_rgba(15,23,42,0.06)] hover:border-blue-200"
                  )}
                  onClick={() => setActiveCaseId(item.id)}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-800">{item.title}</p>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">
                      推荐
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {item.industry} · {item.district}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">{item.summary}</p>
                </button>
              );
            })
          )}
        </div>
      </section>

      <section className={cn(cardBase, "p-5", hoverLift)}>
        {activeCase ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">
                案例详情
              </p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900 font-['Rubik']">
                {activeCase.title}
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                {activeCase.summary}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {activeCase.result}
              </p>
            </div>
            <div className={cn(cardSoft, "p-4")}>
              <p className="text-xs font-semibold text-slate-500">关键打法</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {activeCase.highlights.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className={cn(cardSoft, "p-4")}>
              <p className="text-xs font-semibold text-slate-500">推荐话术</p>
              <p className="mt-2 text-sm text-slate-700">{activeCase.script}</p>
              <div className="mt-4 flex items-center justify-between">
                <span
                  className={cn(
                    pillSubtle,
                    "border-blue-100/80 bg-blue-100/90 text-blue-700 shadow-none"
                  )}
                >
                  {activeCase.industry}
                </span>
                <Button
                  type="button"
                  className="bg-blue-600 hover:bg-blue-500"
                  onClick={() => handleCaseCopy(activeCase.script)}
                >
                  复制话术
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">请选择一个案例查看详情。</p>
        )}
      </section>
    </div>
  );

  const toolboxContent = (
    <div className="space-y-6">
      <section className={cn(cardBase, "p-5", hoverLift)}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              话术工具箱
            </p>
            <p className="mt-1 text-sm text-slate-600">
              搜索、收藏并一键调用模板话术。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Icon
                name="search"
                className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400"
              />
              <Input
                className="pl-9"
                placeholder="搜索话术关键词"
                value={toolboxQuery}
                onChange={(event) => setToolboxQuery(event.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {toolboxCategories.map((category) => {
            const active = toolboxCategory === category;
            return (
              <button
                key={category}
                type="button"
                className={cn(
                  pillBase,
                  active
                    ? "border-blue-600 bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.25)]"
                    : "text-slate-600 hover:border-blue-200"
                )}
                onClick={() => setToolboxCategory(category)}
              >
                {category}
              </button>
            );
          })}
        </div>
        {toolboxNotice && (
          <p className="mt-3 text-xs text-emerald-600">{toolboxNotice}</p>
        )}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {visibleTemplates.map((item) => {
            const favorite = favoriteTemplates.includes(item.id);
            return (
              <div
                key={item.id}
                className={cn(cardSoft, "p-4", hoverLift)}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      pillSubtle,
                      "border-blue-100/80 bg-blue-100/90 text-blue-700 shadow-none"
                    )}
                  >
                    {item.category}
                  </span>
                  <button
                    type="button"
                    className={cn(
                      "text-xs font-semibold transition",
                      favorite ? "text-emerald-600" : "text-slate-500"
                    )}
                    onClick={() => toggleFavoriteTemplate(item.id)}
                  >
                    {favorite ? "已收藏" : "收藏"}
                  </button>
                </div>
                <p className="mt-3 font-semibold text-slate-800">
                  {item.title}
                </p>
                <p className="mt-2 text-sm text-slate-600">{item.content}</p>
                <div className="mt-4 flex items-center justify-between">
                  <Button
                    type="button"
                    className="bg-blue-600 hover:bg-blue-500"
                    onClick={() => handleTemplateCopy(item.content)}
                  >
                    一键使用
                  </Button>
                  <button
                    type="button"
                    className="text-xs text-slate-500 transition hover:text-blue-600"
                    onClick={() => handleTemplateCopy(item.content)}
                  >
                    复制内容
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={cn(cardBase, "p-5", hoverLift)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              话术收藏夹
            </p>
            <p className="mt-1 text-sm text-slate-600">
              你收藏的高分话术将展示在这里。
            </p>
          </div>
          <span className="text-xs text-slate-500">
            已收藏 {savedScripts.length} 条
          </span>
        </div>
        {savedScripts.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              tone="emerald"
              title="暂无收藏话术"
              description="在话术建议中点击“保存话术”即可沉淀。"
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {savedScripts.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-100/70 bg-white/70 p-4 text-sm shadow-sm"
              >
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{item.createdAt}</span>
                  <button
                    type="button"
                    className="text-blue-600 transition hover:text-blue-500"
                    onClick={() =>
                      handleTemplateCopy(buildCopyText(item.suggestion))
                    }
                  >
                    复制
                  </button>
                </div>
                <p className="mt-2 text-slate-700">
                  {renderValue(item.suggestion.coreValue)}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  const profileContent = (
    <div className="space-y-6">
      <section className={cn(cardBase, "p-5", hoverLift)}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              账号与记忆
            </p>
            <p className="mt-1 text-sm text-slate-600">
              账号登录后会自动记录对话记忆并保存为 Markdown。
            </p>
          </div>
          {authUser && (
            <button
              type="button"
              className="text-xs text-slate-500 transition hover:text-blue-600"
              onClick={handleLogout}
            >
              退出登录
            </button>
          )}
        </div>
        {memoryNotice && (
          <p className="mt-3 text-xs text-emerald-600">{memoryNotice}</p>
        )}
        {authUser ? (
          <div className={cn(cardSoft, "mt-4 p-4 text-sm text-slate-700")}>
            <p>
              当前账号：<span className="font-semibold">{authUser}</span>
            </p>
            <p className="mt-2 text-xs text-slate-500">
              记忆将保存到服务器目录 <span className="font-semibold">server/memory</span>
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {["login", "register"].map((mode) => {
                  const active = authMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      className={cn(
                        pillBase,
                        active
                          ? "border-blue-600 bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.25)]"
                          : "text-slate-600 hover:border-blue-200"
                      )}
                      onClick={() =>
                        setAuthMode(mode as "login" | "register")
                      }
                    >
                      {mode === "login" ? "登录" : "注册"}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth-username">账号</Label>
                <Input
                  id="auth-username"
                  placeholder="3-16 位字母/数字/下划线"
                  value={authForm.username}
                  onChange={(event) =>
                    setAuthForm((prev) => ({
                      ...prev,
                      username: event.target.value
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auth-password">密码</Label>
                <Input
                  id="auth-password"
                  type="password"
                  placeholder="至少 6 位"
                  value={authForm.password}
                  onChange={(event) =>
                    setAuthForm((prev) => ({
                      ...prev,
                      password: event.target.value
                    }))
                  }
                />
              </div>
              {authError && (
                <p className="text-xs text-red-600">{authError}</p>
              )}
              <Button
                type="button"
                className="w-full bg-blue-600 hover:bg-blue-500"
                onClick={handleAuthSubmit}
                disabled={authLoading}
              >
                {authLoading
                  ? "处理中..."
                  : authMode === "login"
                    ? "登录并开始记忆"
                    : "注册并开始记忆"}
              </Button>
            </div>
            <div className={cn(cardSoft, "p-4 text-sm text-slate-600")}>
              <p className="font-semibold text-slate-700">记忆类型说明</p>
              <ul className="mt-2 space-y-2 text-xs">
                <li>流水账：每次对话的完整记录。</li>
                <li>持久记忆：AI 精炼后的关键要点。</li>
              </ul>
            </div>
          </div>
        )}
      </section>

      <section className={cn(cardBase, "p-5", hoverLift)}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              个人中心
            </p>
            <p className="mt-1 text-sm text-slate-600">
              查看训练数据与成长进度。
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span
              className={cn(
                pillSubtle,
                "border-blue-100/80 bg-blue-100/90 text-blue-700 shadow-none"
              )}
            >
              平均得分 {averageScore}
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-700">
              收藏 {savedScripts.length}
            </span>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className={cn(cardSoft, "p-4")}>
            <p className="text-xs text-slate-500">累计话术生成</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {history.length}
            </p>
          </div>
          <div className={cn(cardSoft, "p-4")}>
            <p className="text-xs text-slate-500">演练评分记录</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {scoredItems.length}
            </p>
          </div>
          <div className={cn(cardSoft, "p-4")}>
            <p className="text-xs text-slate-500">平均得分</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {averageScore}
            </p>
          </div>
        </div>
      </section>

      <section className={cn(cardBase, "p-5", hoverLift)}>
        <p className="text-xs font-semibold uppercase text-slate-500">
          成就系统
        </p>
        <div className="mt-4 space-y-4">
          {achievementTracks.map((track) => (
            <div key={track.id} className={cn(cardSoft, "p-4")}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-800">{track.title}</p>
                  <p className="text-xs text-slate-500">
                    {track.description}
                  </p>
                </div>
                <span className="text-xs text-slate-500">
                  {track.progress}%
                </span>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${track.progress}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={cn(cardBase, "p-5", hoverLift)}>
        <p className="text-xs font-semibold uppercase text-slate-500">
          个性化设置
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label
            className={cn(
              cardGhost,
              "flex items-center justify-between px-4 py-3 text-sm text-slate-700"
            )}
          >
            <span>训练提醒通知</span>
            <input type="checkbox" defaultChecked />
          </label>
          <label
            className={cn(
              cardGhost,
              "flex items-center justify-between px-4 py-3 text-sm text-slate-700"
            )}
          >
            <span>演练完成后自动生成报告</span>
            <input type="checkbox" defaultChecked />
          </label>
          <label
            className={cn(
              cardGhost,
              "flex items-center justify-between px-4 py-3 text-sm text-slate-700"
            )}
          >
            <span>开启 AI 指导提示</span>
            <input type="checkbox" defaultChecked />
          </label>
          <label
            className={cn(
              cardGhost,
              "flex items-center justify-between px-4 py-3 text-sm text-slate-700"
            )}
          >
            <span>保存对话历史</span>
            <input type="checkbox" defaultChecked />
          </label>
        </div>
      </section>
    </div>
  );

  const dashboardContent = (
    <div className="space-y-6">
      <section className={cn(cardBase, "p-6", hoverLift)}>
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-blue-600">
              欢迎回来
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900 font-['Rubik']">
              今天开始一次高质量训练
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              选择画像快速生成话术，或直接进入演练对话。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => goToTraining("assistant")}>
              <span className="mr-2 inline-flex">
                <Icon name="spark" className="h-4 w-4" />
              </span>
              快速生成话术
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-500 focus-visible:ring-emerald-200"
              onClick={() => goToTraining("drill")}
            >
              <span className="mr-2 inline-flex">
                <Icon name="play" className="h-4 w-4" />
              </span>
              进入销售演练
            </Button>
          </div>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className={cn(cardSoft, "relative overflow-hidden p-4")}>
            <div className="pointer-events-none absolute -right-6 top-0 h-24 w-24 rounded-full bg-blue-200/50 blur-2xl" />
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Icon name="training" className="h-4 w-4 text-blue-600" />
              快速开始训练
            </div>
            <p className="mt-2 text-sm text-slate-600">
              选择一个画像，系统会自动填充并进入话术生成。
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {sampleProfiles.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  className={cn(pillBase, "cursor-pointer")}
                  onClick={() => handleSampleStart(sample)}
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>
          <div className={cn(cardSoft, "relative overflow-hidden p-4")}>
            <div className="pointer-events-none absolute -right-6 top-0 h-24 w-24 rounded-full bg-emerald-200/50 blur-2xl" />
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Icon name="trend" className="h-4 w-4 text-blue-600" />
              个性化指导
            </div>
            <p className="mt-2 text-sm text-slate-600">
              系统会根据关注点给出即时指导与改进建议。
            </p>
            <ul className="mt-3 space-y-2 text-xs text-slate-600">
              {guidanceTips.map((tip) => (
                <li key={tip} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className={cn(cardSoft, "relative overflow-hidden p-4")}>
            <div className="pointer-events-none absolute -right-6 top-0 h-24 w-24 rounded-full bg-indigo-200/40 blur-2xl" />
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Icon name="bookmark" className="h-4 w-4 text-blue-600" />
              保存优秀话术
            </div>
            <p className="mt-2 text-sm text-slate-600">
              一键收藏高分话术，沉淀个人素材库。
            </p>
            <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
              <span>已收藏 {savedScripts.length} 条</span>
              <button
                type="button"
                className="text-blue-600 transition hover:text-blue-500"
                onClick={() => setActivePage("toolbox")}
              >
                查看话术库
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className={cn(cardGhost, "relative overflow-hidden p-4", hoverLift)}>
          <div className="pointer-events-none absolute -right-10 top-2 h-20 w-20 rounded-full bg-blue-100/70 blur-2xl" />
          <p className="text-xs text-slate-500">话术生成</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {history.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            最近生成 {history[history.length - 1]?.createdAt ?? "暂无"}
          </p>
        </div>
        <div className={cn(cardGhost, "relative overflow-hidden p-4", hoverLift)}>
          <div className="pointer-events-none absolute -right-10 top-2 h-20 w-20 rounded-full bg-emerald-100/70 blur-2xl" />
          <p className="text-xs text-slate-500">演练评分</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {averageScore}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            已完成 {scoredItems.length} 条评分
          </p>
        </div>
        <div className={cn(cardGhost, "relative overflow-hidden p-4", hoverLift)}>
          <div className="pointer-events-none absolute -right-10 top-2 h-20 w-20 rounded-full bg-blue-200/40 blur-2xl" />
          <p className="text-xs text-slate-500">收藏话术</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {savedScripts.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            便于复用与分享
          </p>
        </div>
        <div className={cn(cardGhost, "relative overflow-hidden p-4", hoverLift)}>
          <div className="pointer-events-none absolute -right-10 top-2 h-20 w-20 rounded-full bg-indigo-200/40 blur-2xl" />
          <p className="text-xs text-slate-500">画像完成度</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {completion.percent}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {completion.filled}/{completion.total} 项
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className={cn(cardBase, "p-5", hoverLift)}>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 font-['Rubik']">
              最近训练记录
            </h3>
            <button
              type="button"
              className="text-xs text-blue-600 transition hover:text-blue-500"
              onClick={() => setActivePage("training")}
            >
              查看训练中心
            </button>
          </div>
          {recentHistory.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                tone="slate"
                title="暂无训练记录"
                description="完成一次话术生成即可在此查看记录。"
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {recentHistory.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-slate-100/70 bg-white/70 p-3 text-sm shadow-sm"
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{item.createdAt}</span>
                    <span>{item.snapshot.productId}</span>
                  </div>
                  <p className="mt-2 text-slate-700">
                    核心价值：{renderValue(item.suggestion.coreValue)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={cn(cardBase, "p-5", hoverLift)}>
          <p className="text-xs font-semibold uppercase text-slate-500">
            进度概览
          </p>
          <div className="mt-4 space-y-4 text-sm text-slate-600">
            <div>
              <div className="flex items-center justify-between">
                <span>画像完善度</span>
                <span>{completion.percent}%</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100/70">
                <div
                  className="h-2 rounded-full bg-blue-600"
                  style={{ width: `${completion.percent}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span>演练平均得分</span>
                <span>{averageScore}</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100/70">
                <div
                  className="h-2 rounded-full bg-emerald-500"
                  style={{ width: `${Math.min(averageScore, 100)}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <span>收藏话术</span>
                <span>{savedScripts.length} 条</span>
              </div>
              <div className="mt-2 h-2 w-full rounded-full bg-slate-100/70">
                <div
                  className="h-2 rounded-full bg-blue-400"
                  style={{
                    width: `${Math.min(savedScripts.length * 20, 100)}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  const pageContent = {
    dashboard: dashboardContent,
    training: trainingContent,
    cases: casesContent,
    toolbox: toolboxContent,
    profile: profileContent
  }[activePage];

  return (
    <div className="app-shell relative min-h-screen overflow-hidden bg-transparent text-slate-900">
      <div className="pointer-events-none absolute -right-16 -top-36 h-96 w-96 rounded-full bg-blue-300/35 blur-3xl" />
      <div className="pointer-events-none absolute left-10 top-28 h-72 w-72 rounded-full bg-emerald-200/35 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-44 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-amber-200/30 blur-3xl" />

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-white/[0.65] bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(239,246,255,0.72))] px-7 py-8 shadow-[0_34px_78px_rgba(15,23,42,0.16)] ring-1 ring-white/70 backdrop-blur-2xl md:flex">
        <div>
          <span
            className={cn(
              pillBase,
              "border-blue-100/90 bg-gradient-to-r from-blue-50 to-cyan-50 text-blue-700 shadow-[0_8px_20px_rgba(37,99,235,0.16)]"
            )}
          >
            PitchPerfect
          </span>
          <h1 className="mt-4 text-xl font-semibold tracking-[0.02em] text-slate-900">
            新人销售话术助手
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            AI 驱动的销售训练平台
          </p>
        </div>
        <nav className="mt-9 space-y-2.5">
          {navItems.map((item) => {
            const active = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "group flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-left text-sm font-semibold transition-all duration-200",
                  active
                    ? "border-white/[0.85] bg-white/[0.85] text-blue-700 shadow-[0_14px_30px_rgba(15,23,42,0.11)]"
                    : "text-slate-600 hover:-translate-y-0.5 hover:border-white/[0.65] hover:bg-white/70"
                )}
                onClick={() => setActivePage(item.id)}
              >
                <span
                  className={cn(
                    "inline-flex h-8 w-8 items-center justify-center rounded-xl border transition",
                    active
                      ? "border-blue-100 bg-blue-50/90 text-blue-600 shadow-[0_10px_18px_rgba(37,99,235,0.2)]"
                      : "border-white/70 bg-white/70 text-slate-400 group-hover:border-blue-100 group-hover:text-blue-500"
                  )}
                >
                  <Icon name={item.icon} className="h-4 w-4" />
                </span>
                <div>
                  <p>{item.label}</p>
                  <p
                    className={cn(
                      "text-xs",
                      active ? "text-blue-500/90" : "text-slate-400"
                    )}
                  >
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </nav>
        <div className={cn(cardSoft, "mt-auto p-4")}>
          <p className="text-xs font-semibold text-slate-600">快速入口</p>
          <p className="mt-2 text-sm text-slate-500">
            立即开始一次对话式训练。
          </p>
          <Button
            type="button"
            className="mt-3 w-full"
            size="lg"
            onClick={() => goToTraining("assistant")}
          >
            开始训练
          </Button>
        </div>
      </aside>

      <div className="relative z-10 md:pl-72">
        <header className="sticky top-0 z-20 border-b border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(248,251,255,0.78))] shadow-[0_14px_34px_rgba(15,23,42,0.1)] backdrop-blur-2xl">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                {pageMeta[activePage].title}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {pageMeta[activePage].description}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activePage !== "training" && (
                <Button type="button" onClick={() => goToTraining("assistant")}>
                  开始训练
                </Button>
              )}
              {authUser ? (
                <span className={cn(pillSubtle, "hidden sm:inline-flex")}>
                  已登录：{authUser}
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAuthDrawerOpen(true)}
                >
                  登录/注册
                </Button>
              )}
              <div className={cn(pillSubtle, "hidden gap-2 sm:flex")}>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                实时在线
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-6 pb-28 pt-20 md:pb-12">
          {pageContent}
        </main>
      </div>

      <nav className="fixed bottom-3 left-3 right-3 z-30 grid grid-cols-5 items-center rounded-2xl border border-white/70 bg-white/[0.82] px-2 py-2 shadow-[0_16px_36px_rgba(15,23,42,0.16)] backdrop-blur-xl md:hidden">
        {navItems.map((item) => {
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border border-transparent px-1 py-2 text-[11px] font-medium transition-all duration-200",
                active
                  ? "border-white/90 bg-white/[0.85] text-blue-600 shadow-[0_10px_22px_rgba(15,23,42,0.12)]"
                  : "text-slate-500 hover:border-white/70 hover:bg-white/70"
              )}
              onClick={() => setActivePage(item.id)}
            >
              <Icon
                name={item.icon}
                className={cn(
                  "h-4 w-4",
                  active ? "text-blue-600" : "text-slate-400"
                )}
              />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Auth Drawer */}
      {authDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm"
          onClick={() => setAuthDrawerOpen(false)}
        >
          <div
            className="absolute right-0 top-0 h-full w-full max-w-md border-l border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(241,247,255,0.82))] p-6 shadow-[0_24px_60px_rgba(15,23,42,0.2)] backdrop-blur-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                {authMode === "login" ? "登录" : "注册"}
              </h2>
              <button
                type="button"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-white hover:text-slate-700"
                onClick={() => setAuthDrawerOpen(false)}
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="mt-8 space-y-6">
              <div className="flex flex-wrap gap-2">
                {["login", "register"].map((mode) => {
                  const active = authMode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      className={cn(
                        pillBase,
                        active
                          ? "border-blue-600 bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-[0_12px_26px_rgba(37,99,235,0.3)]"
                          : "text-slate-600 hover:border-blue-200"
                      )}
                      onClick={() =>
                        setAuthMode(mode as "login" | "register")
                      }
                    >
                      {mode === "login" ? "登录" : "注册"}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="drawer-username">账号</Label>
                  <Input
                    id="drawer-username"
                    placeholder="3-16 位字母/数字/下划线"
                    value={authForm.username}
                    onChange={(event) =>
                      setAuthForm((prev) => ({
                        ...prev,
                        username: event.target.value
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="drawer-password">密码</Label>
                  <Input
                    id="drawer-password"
                    type="password"
                    placeholder="至少 6 位"
                    value={authForm.password}
                    onChange={(event) =>
                      setAuthForm((prev) => ({
                        ...prev,
                        password: event.target.value
                      }))
                    }
                  />
                </div>
              </div>

              {authError && (
                <p className="text-sm text-red-600">{authError}</p>
              )}

              <Button
                type="button"
                className="w-full"
                size="lg"
                onClick={handleAuthSubmit}
                disabled={authLoading}
              >
                {authLoading
                  ? "处理中..."
                  : authMode === "login"
                    ? "登录"
                    : "注册"}
              </Button>

              <div className={cn(cardSoft, "p-4 text-sm text-slate-600")}>
                <p className="font-semibold text-slate-700">记忆功能说明</p>
                <p className="mt-2 text-xs text-slate-500">
                  登录后会自动记录对话记忆，保存为持久记忆文件供后续使用。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

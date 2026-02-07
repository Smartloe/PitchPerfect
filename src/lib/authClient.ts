type AuthResponse = {
  token: string;
  username: string;
};

export type MemoryEntry = {
  title: string;
  ledger: string;
  summarySource: string;
};

export type GrowthRecordPayload = {
  question: string;
  snapshot: unknown;
  suggestion: unknown;
};

export type DrillScorePayload = {
  question: string;
  answer: string;
  score: number;
  feedback?: string;
  highlight?: string;
  improve?: string;
  industry?: string;
  productId?: string;
};

export type GrowthSnapshotResponse = {
  history: Array<{
    id: string;
    createdAt: string;
    snapshot: Record<string, unknown>;
    question: string;
    suggestion: Record<string, unknown>;
  }>;
  savedScripts: Array<{
    id: string;
    createdAt: string;
    snapshot: Record<string, unknown>;
    question: string;
    suggestion: Record<string, unknown>;
  }>;
  stats: {
    totalGenerations: number;
    totalSavedScripts: number;
    drillScoreCount: number;
    drillAverageScore: number;
  };
};

const TOKEN_KEY = "pitchperfect_token";
const USER_KEY = "pitchperfect_user";

export function getStoredAuth() {
  if (typeof window === "undefined") return { token: "", username: "" };
  return {
    token: window.localStorage.getItem(TOKEN_KEY) || "",
    username: window.localStorage.getItem(USER_KEY) || ""
  };
}

export function storeAuth(token: string, username: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, username);
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

async function postJson<T>(url: string, body: unknown, token?: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMessage =
      typeof data?.error === "string" ? data.error : "请求失败";
    throw new Error(errorMessage);
  }
  return data as T;
}

export async function registerAccount(
  username: string,
  password: string
): Promise<AuthResponse> {
  const data = await postJson<AuthResponse>("/api/auth/register", {
    username,
    password
  });
  return data;
}

export async function loginAccount(
  username: string,
  password: string
): Promise<AuthResponse> {
  const data = await postJson<AuthResponse>("/api/auth/login", {
    username,
    password
  });
  return data;
}

export async function saveMemoryEntry(token: string, entry: MemoryEntry) {
  return postJson<{ ok: boolean }>("/api/memory", entry, token);
}

export async function fetchGrowthSnapshot(
  token: string
): Promise<GrowthSnapshotResponse> {
  return postJson<GrowthSnapshotResponse>("/api/growth/snapshot", {}, token);
}

export async function saveScriptGeneration(
  token: string,
  record: GrowthRecordPayload
) {
  return postJson<{ ok: boolean }>("/api/growth/script-generation", record, token);
}

export async function saveSavedScript(token: string, record: GrowthRecordPayload) {
  return postJson<{ ok: boolean }>("/api/growth/saved-script", record, token);
}

export async function saveDrillScore(token: string, payload: DrillScorePayload) {
  return postJson<{ ok: boolean }>("/api/growth/drill-score", payload, token);
}

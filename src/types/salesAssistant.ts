export type ProductId = "online-sales" | "lead-collection" | "ad-campaign";

export interface Product {
  id: ProductId;
  name: string;
  summary: string;
  questions: string[];
}

export interface MerchantProfile {
  industry: string;
  scale: string;
  businessDistrict: string;
  focusAreas: string[];
  notes?: string;
}

export interface MerchantObjection {
  topic: string;
  detail?: string;
}

export interface ScriptSuggestion {
  coreValue: string;
  objectionResponse: string;
  caseAnalogy: string;
  nextStep: string;
}

export interface ScriptRequest {
  merchant: MerchantProfile;
  productId: ProductId;
  objections: MerchantObjection[];
}

export interface ScriptResponse {
  suggestion: ScriptSuggestion;
  rawText?: string;
}

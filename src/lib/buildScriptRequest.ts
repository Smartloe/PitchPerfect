import type {
  MerchantObjection,
  MerchantProfile,
  ProductId,
  ScriptRequest
} from "../types/salesAssistant";

export function buildScriptRequest(
  merchant: MerchantProfile,
  productId: ProductId,
  objections: MerchantObjection[]
): ScriptRequest {
  return {
    merchant,
    productId,
    objections
  };
}

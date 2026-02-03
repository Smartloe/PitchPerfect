import type { MerchantObjection, MerchantProfile } from "../types/salesAssistant";

export const emptyMerchantProfile: MerchantProfile = {
  industry: "",
  scale: "",
  businessDistrict: "",
  focusAreas: []
};

export const sampleObjections: MerchantObjection[] = [
  { topic: "成交提升", detail: "能带来多少新增交易？" },
  { topic: "流量获取", detail: "附近有没有类似商家案例？" }
];

/** 医疗科普演示语料 + 合规拦截（非诊疗） */

export type MedicalDoc = {
  id: string;
  title: string;
  text: string;
};

export const MEDICAL_DOCS: MedicalDoc[] = [
  {
    id: "med-bp-01",
    title: "高血压健康科普手册",
    text: "健康科普：保持低盐饮食、规律运动、戒烟限酒有助于血压管理。宣教建议定期监测血压并记录。本内容仅供科普，不构成诊断或用药指导。",
  },
  {
    id: "med-dm-01",
    title: "糖尿病宣教问答",
    text: "健康科普：均衡饮食与适量运动是糖尿病日常管理宣教重点。出现口渴、多尿等不适应及时到院就诊评估。本机器人不提供诊断、开药或治疗方案。",
  },
  {
    id: "med-guide-01",
    title: "院内导诊引导说明",
    text: "导诊引导：内科门诊一般位于门诊楼 2 层；抽血处位于 1 层检验中心。请携带就诊卡与身份证。急诊请直接前往急诊通道。",
  },
  {
    id: "med-hand-01",
    title: "术后康复宣教摘要",
    text: "宣教资料：术后按医护交代保持伤口清洁干燥，按时复诊。如有异常出血、剧烈疼痛或发热，请立即就医。此处仅转述宣教要点，非诊疗建议。",
  },
];

const BLOCK =
  /诊断|确诊|开药|处方|用药剂量|吃什么药|怎么治|治疗方案|能治好吗|是不是癌症|手术方案/;

export function isBlockedMedicalQuery(msg: string) {
  return BLOCK.test(msg);
}

export function searchMedical(query: string, topK = 3) {
  const tokens = query.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/).filter((t) => t.length > 1);
  return MEDICAL_DOCS.map((d) => {
    const hay = `${d.title} ${d.text}`.toLowerCase();
    let score = 0;
    for (const t of tokens) if (hay.includes(t)) score += 1;
    if (/血压|高血压/.test(query) && hay.includes("血压")) score += 2;
    if (/糖尿|血糖/.test(query) && hay.includes("糖尿")) score += 2;
    if (/导诊|门诊|抽血/.test(query) && hay.includes("导诊")) score += 2;
    if (/术后|康复|伤口/.test(query) && hay.includes("术后")) score += 2;
    return { ...d, score, snippet: d.text.slice(0, 90) };
  })
    .filter((d) => d.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

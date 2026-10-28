/** 迷你知识库语料：用于无外部依赖的 RAG 演示 */
export type LabDoc = {
  id: string;
  title: string;
  role: "维保" | "故障码" | "安全" | "工程" | "行程" | "审批";
  text: string;
};

export const LAB_DOCS: LabDoc[] = [
  {
    id: "doc-pump-01",
    title: "液压泵日常维保手册",
    role: "维保",
    text: "液压泵开机前检查油位与滤芯。运转噪声异常时先停机，检查联轴器对中与进油管路是否吸入空气。更换液压油周期为每 2000 小时或按污染度检测结果提前更换。禁止在泄压未完成时拆卸高压管接头。",
  },
  {
    id: "doc-code-e42",
    title: "故障码 E42 说明",
    role: "故障码",
    text: "故障码 E42 表示温度传感器开路或信号超限。常见原因：线束断路、接插件氧化、传感器本体损坏。处理步骤：1) 断电检查线束连续性；2) 测量传感器阻值是否在规格范围；3) 更换传感器后清除故障码并路试确认。",
  },
  {
    id: "doc-safety-01",
    title: "车间作业安全要点",
    role: "安全",
    text: "进入车间必须佩戴安全帽与防护鞋。起重作业期间禁止站立在吊物下方。电气柜维护需先挂牌上锁（LOTO）。发现液压泄漏立即隔离区域并上报班组长，禁止用明火靠近泄漏点。",
  },
  {
    id: "doc-sse-01",
    title: "SSE 流式接口工程约定",
    role: "工程",
    text: "服务端推送使用 SSE，事件类型包含 status、message、error、done。客户端采用 fetch + ReadableStream 解析，以便携带 JSON Body 与鉴权头。页面卸载必须 AbortController 取消，避免继续消耗模型与占满协程。反代需关闭缓冲并配置保活。",
  },
  {
    id: "doc-rag-01",
    title: "私域 RAG 空结果策略",
    role: "工程",
    text: "企业知识库场景禁止在无召回时编造维保结论。召回为空应明确返回「资料不足/未命中」，并提示补充文档或换关键词。混合召回可采用 BM25 + 向量，并对故障码字段加权。引用片段需可溯源到文档标题。",
  },
  {
    id: "doc-agent-01",
    title: "两阶段 Agent 编排说明",
    role: "工程",
    text: "Research→Planner 两阶段：Research 收集约束与外部摘要，Planner 产出结构化方案。开放域检索建议设置约 3 秒软超时，超时则跳过检索继续规划，避免外部依赖卡死主链路。自由无限循环不适用于政务填表，应使用受约束状态机与最大迭代次数。",
  },
  {
    id: "doc-trip-01",
    title: "TripPal 行程规划能力边界",
    role: "行程",
    text: "TripPal 对外以可嵌入 SDK 交付：宿主传入城市/天数等业务参数即可获取 SSE 流式结构化行程。不做无限自由 Agent 循环；地理跳点通过规则清洗与输出契约降低风险；幻觉只能降低概率。SDK 暂未发布 npm。",
  },
  {
    id: "doc-archive-01",
    title: "园区扶持档案审批流程",
    role: "审批",
    text: "企业扶持材料申报支持多级审批、退回重提与版本留存。账号按行级 + 角色 RBAC 隔离数据。状态变更使用事务保证一致性；支持批量导出归档，满足政企追溯要求。",
  },
  {
    id: "doc-java-01",
    title: "Java Spring Boot 接口约定",
    role: "工程",
    text: "业务接口统一返回 code/message/data/requestId。鉴权使用 JWT；热点指标可 Redis 缓存；大屏统计走预聚合避免扫明细。前后端按契约联调，异常码与日志可定位。",
  },
];

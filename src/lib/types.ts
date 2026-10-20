export type BuildPlan = {
  title: string;
  summary: string;
  productType: "website" | "web_app" | "landing" | "tool";
  pages: { name: string; purpose: string }[];
  features: string[];
  styleDirection: string;
  acceptanceChecks: string[];
};

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  kind: "chat" | "plan" | "status" | "error";
  content: string;
  plan?: BuildPlan;
  createdAt: string;
};

export type AppVersion = {
  id: string;
  label: string;
  html: string;
  createdAt: string;
  note?: string;
};

export type Project = {
  id: string;
  userId: string;
  title: string;
  status: "idle" | "planning" | "awaiting_approval" | "building" | "ready" | "failed";
  plan: BuildPlan | null;
  messages: Message[];
  versions: AppVersion[];
  activeVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type User = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
};

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
};

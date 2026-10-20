import { promises as fs } from "fs";
import path from "path";
import type { Project, User } from "./types";

/** Vercel / serverless 根目录只读，可写目录用 /tmp */
const DATA_DIR = process.env.VERCEL
  ? path.join("/tmp", "atoms-demo-data")
  : path.join(process.cwd(), "data");

type Store = {
  users: User[];
  projects: Project[];
  shares: Record<string, { projectId: string; versionId: string; html: string; title: string; createdAt: string }>;
};

type GlobalStore = typeof globalThis & {
  __atomsStore?: Store;
  __atomsStoreLoaded?: boolean;
};

const g = globalThis as GlobalStore;

function emptyStore(): Store {
  return { users: [], projects: [], shares: {} };
}

function memory(): Store {
  if (!g.__atomsStore) g.__atomsStore = emptyStore();
  return g.__atomsStore;
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function load(): Promise<Store> {
  const store = memory();
  if (g.__atomsStoreLoaded) return store;

  try {
    await ensureDir();
    const raw = await fs.readFile(path.join(DATA_DIR, "store.json"), "utf8");
    const parsed = JSON.parse(raw) as Store;
    store.users = parsed.users ?? [];
    store.projects = parsed.projects ?? [];
    store.shares = parsed.shares ?? {};
  } catch {
    // first run or cold start without prior file
  }

  g.__atomsStoreLoaded = true;
  return store;
}

async function save(store: Store) {
  g.__atomsStore = store;
  try {
    await ensureDir();
    await fs.writeFile(path.join(DATA_DIR, "store.json"), JSON.stringify(store, null, 2), "utf8");
  } catch {
    // 内存仍可用；无盘环境不阻断主流程
  }
}

export async function getStore() {
  return load();
}

export async function findUserByEmail(email: string) {
  const store = await load();
  return store.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function findUserById(id: string) {
  const store = await load();
  return store.users.find((u) => u.id === id) ?? null;
}

export async function createUser(user: User) {
  const store = await load();
  store.users.push(user);
  await save(store);
  return user;
}

export async function listProjects(userId: string) {
  const store = await load();
  return store.projects
    .filter((p) => p.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getProject(id: string, userId?: string) {
  const store = await load();
  const project = store.projects.find((p) => p.id === id);
  if (!project) return null;
  if (userId && project.userId !== userId) return null;
  return project;
}

export async function upsertProject(project: Project) {
  const store = await load();
  const idx = store.projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) store.projects[idx] = project;
  else store.projects.push(project);
  await save(store);
  return project;
}

export async function deleteProject(id: string, userId: string) {
  const store = await load();
  const before = store.projects.length;
  store.projects = store.projects.filter((p) => !(p.id === id && p.userId === userId));
  await save(store);
  return store.projects.length < before;
}

export async function createShare(token: string, payload: Store["shares"][string]) {
  const store = await load();
  store.shares[token] = payload;
  await save(store);
  return payload;
}

export async function getShare(token: string) {
  const store = await load();
  return store.shares[token] ?? null;
}

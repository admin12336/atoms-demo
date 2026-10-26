# -*- coding: utf-8 -*-
import http.cookiejar
import json
import random
import urllib.request as ur

BASE = "http://localhost:3000"
checks = []


def add(name, ok, detail=""):
    checks.append((name, bool(ok), detail))
    print(("PASS" if ok else "FAIL"), name, "|", detail)


def post_json(path, data, opener=None):
    body = json.dumps(data).encode("utf-8")
    req = ur.Request(
        BASE + path,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    opener = opener or ur.build_opener()
    try:
        with opener.open(req, timeout=40) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except ur.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            payload = json.loads(raw)
        except Exception:
            payload = {"error": raw}
        return e.code, payload


def get_json(path, opener=None):
    req = ur.Request(BASE + path, method="GET")
    opener = opener or ur.build_opener()
    try:
        with opener.open(req, timeout=20) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except ur.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            payload = json.loads(raw)
        except Exception:
            payload = {"error": raw}
        return e.code, payload


def get_text(path):
    with ur.urlopen(BASE + path, timeout=20) as r:
        return r.status, r.read().decode("utf-8", "replace")


# RAG empty
st, d = post_json("/api/lab/rag", {"query": "火星发动机说明书xyz999", "topK": 3})
add(
    "rag_empty",
    st == 200 and len(d.get("hits", [])) == 0 and "资料不足" in d.get("answer", ""),
    f"hits={len(d.get('hits', []))} ans={d.get('answer', '')[:80]}",
)

# SSE content
st, body = get_text("/api/lab/sse?topic=demo")
add(
    "sse_events",
    "event: status" in body and "event: message" in body and "event: done" in body,
    f"len={len(body)}",
)

# planner soft timeout
st, d = post_json(
    "/api/lab/planner",
    {"goal": "上海三日游", "researchDelayMs": 4000, "softTimeoutMs": 700},
)
add(
    "planner_soft_timeout",
    d.get("research", {}).get("reason") == "soft_timeout"
    and d.get("plan", {}).get("phases", [{}])[0].get("status") == "skipped",
    str(d.get("research")),
)

# demo agent flow with cookies
cj = http.cookiejar.CookieJar()
opener = ur.build_opener(ur.HTTPCookieProcessor(cj))
email = f"test{random.randint(10000, 99999)}@example.com"
st, d = post_json(
    "/api/auth/register",
    {"email": email, "password": "Test1234!", "displayName": "tester"},
    opener,
)
user_ok = bool(d.get("user") or d.get("ok") or d.get("id"))
add("register", st == 200 and user_ok, json.dumps(d, ensure_ascii=False)[:160])

st, d = get_json("/api/auth/me", opener)
add(
    "auth_me_demo",
    st == 200 and d.get("user") is not None,
    json.dumps(d, ensure_ascii=False)[:160],
)

# create project - inspect API shape
try:
    st, d = post_json("/api/projects", {"title": "习惯打卡 demo"}, opener)
    pid = None
    if isinstance(d.get("project"), dict):
        pid = d["project"].get("id")
    pid = pid or d.get("id")
    add("create_project", st == 200 and bool(pid), json.dumps(d, ensure_ascii=False)[:200])
except Exception as e:
    # maybe GET list / different body
    add("create_project", False, repr(e))
    pid = None

if pid:
    st, d = post_json(
        f"/api/projects/{pid}/agent",
        {"action": "plan", "content": "做一个带 localStorage 的习惯打卡"},
        opener,
    )
    plan = (d.get("project") or {}).get("plan")
    add("agent_plan_demo", st == 200 and bool(plan), f"status={(d.get('project') or {}).get('status')}")

    st, d = post_json(f"/api/projects/{pid}/agent", {"action": "build"}, opener)
    vers = (d.get("project") or {}).get("versions") or []
    html = vers[-1].get("html") if vers else ""
    add("agent_build_demo", st == 200 and bool(html), f"versions={len(vers)} html_len={len(html or '')}")

# pages
for path in ("/", "/lab", "/studio"):
    st, text = get_text(path)
    add(f"page_{path}", st == 200, f"len={len(text)}")

st, text = get_text("/")
add("home_has_lab_nav", "/lab" in text, "nav /lab")

fail = sum(1 for _, ok, _ in checks if not ok)
print("---")
print(f"SUMMARY fail={fail} total={len(checks)}")

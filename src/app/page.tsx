import Link from "next/link";
import styles from "./page.module.css";

export default function HomePage() {
  return (
    <div className={styles.shell}>
      <nav className={styles.nav}>
        <div className={styles.brand}>
          Atoms <span>Demo</span>
        </div>
        <div className={styles.navActions}>
          <Link className={styles.btnGhost} href="/login">
            登录
          </Link>
          <Link className={styles.btn} href="/register">
            开始构建
          </Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>ROOT 笔试 · 对标 atoms.dev 工作流</p>
          <h1>一句话，生成可点的网页</h1>
          <p className={styles.lead}>
            用自然语言描述想法。Emma 产出产品方案，你批准后 Alex 生成可交互单页应用，右侧即时预览，支持对话迭代、版本回滚与分享。
          </p>
          <div className={styles.ctaRow}>
            <Link className={styles.btn} href="/register">
              注册并进入工坊
            </Link>
            <Link className={styles.btnGhost} href="/login">
              已有账号
            </Link>
          </div>
        </div>

        <aside className={styles.panel}>
          <h2>主流程</h2>
          <p>Mike 协调状态机 · Emma 规划 · Alex 工程生成</p>
          <ol className={styles.flow}>
            <li>
              <span className={styles.idx}>1</span>
              <div>
                <strong>描述需求</strong>
                <span>例如：做一个带 localStorage 的习惯打卡</span>
              </div>
            </li>
            <li>
              <span className={styles.idx}>2</span>
              <div>
                <strong>批准方案</strong>
                <span>确认页面、功能、视觉与验收点</span>
              </div>
            </li>
            <li>
              <span className={styles.idx}>3</span>
              <div>
                <strong>预览迭代</strong>
                <span>沙箱 iframe 内真实点击，继续对话改版</span>
              </div>
            </li>
          </ol>
        </aside>
      </section>

      <section className={styles.section}>
        <h3>笔试要求对照</h3>
        <div className={styles.grid}>
          <article className={styles.card}>
            <h4>真实交互 UI</h4>
            <p>生成物是完整 HTML 应用，在沙箱中可增删、筛选、切换主题。</p>
          </article>
          <article className={styles.card}>
            <h4>数据持久化</h4>
            <p>用户与项目写入服务端 JSON 存储；生成应用内数据用 localStorage。</p>
          </article>
          <article className={styles.card}>
            <h4>第三方能力</h4>
            <p>接入 OpenAI 兼容大模型（DeepSeek）与 Open-Meteo 天气 API。</p>
          </article>
        </div>
      </section>
    </div>
  );
}

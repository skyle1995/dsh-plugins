import puppeteer from "puppeteer-core";
const TOKEN = process.env.DSH_TEST_TOKEN ?? "";
if (TOKEN === "") throw new Error("用法: DSH_TEST_TOKEN=<token> node test/browser/e2e-editor2.mjs");
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: "new",
  args: ["--no-sandbox", "--window-size=1600,1000"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
const errors = [];
page.on("pageerror", (err) => errors.push("[pageerror] " + String(err).slice(0, 400)));
page.on("console", (msg) => { if (msg.type() === "error") errors.push("[console.error] " + msg.text().slice(0, 300)); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function clickContaining(text, timeout = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const found = await page.evaluate((t) => {
      const els = [...document.querySelectorAll("button, [role=button]")];
      const el = els.find((e) => (e.getAttribute("aria-label") || "").includes(t) || e.innerText.includes(t));
      if (!el) return false;
      el.click();
      return true;
    }, text);
    if (found) return true;
    await sleep(400);
  }
  return false;
}
await page.goto(`http://127.0.0.1:4321/?token=${TOKEN}`, { waitUntil: "networkidle2", timeout: 60000 });
await sleep(6000);
// 打开右侧边栏
await clickContaining("打开右侧边栏"); await sleep(3000);
const guide = await page.evaluate(() => ({
  guideEntries: [...document.querySelectorAll("[data-sidebar-right-guide-entry]")].map((e) => e.getAttribute("data-sidebar-right-guide-entry")),
  btns: [...document.querySelectorAll("button")].map((b) => (b.getAttribute("aria-label") || b.innerText.trim().slice(0, 20))).filter(Boolean).slice(-15),
}));
console.log("GUIDE:", JSON.stringify(guide, null, 2));
// 点击文件入口（guide 里的「文件」）
await clickContaining("工作区文件"); await sleep(6000);
const tree = await page.evaluate(() => ({
  hasTree: document.querySelectorAll('[data-files-state="tree"]').length,
  root: document.querySelector('[data-files-state="tree"]')?.getAttribute("data-files-root"),
  rows: [...document.querySelectorAll("[data-files-path]")].map((e) => e.getAttribute("data-files-path")).slice(0, 12),
}));
console.log("TREE:", JSON.stringify(tree, null, 2));
// 右键 sample.ts
const menuOpened = await page.evaluate(() => {
  const rows = [...document.querySelectorAll("[data-files-path]")];
  const row = rows.find((e) => e.getAttribute("data-files-path").includes("sample.ts"));
  if (!row) return { ok: false, rows: rows.map((e) => e.getAttribute("data-files-path")) };
  const rect = row.getBoundingClientRect();
  row.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: rect.left + 60, clientY: rect.top + 10 }));
  return { ok: true };
});
console.log("CTX:", JSON.stringify(menuOpened));
await sleep(1500);
const menuItems = await page.evaluate(() => [...document.querySelectorAll('[role="menu"] [role="menuitem"]')].map((e) => e.innerText.trim()));
console.log("MENU ITEMS:", JSON.stringify(menuItems));
await clickContaining("编辑", 5000); await sleep(7000);
const editor = await page.evaluate(() => {
  const root = document.querySelector(".dfa-editor-root");
  const ta = document.querySelector(".dfa-code-input");
  const pre = document.querySelector(".dfa-code-highlight");
  const mm = document.querySelector(".dfa-code-minimap");
  const canvas = document.querySelector(".dfa-code-minimap-canvas");
  const r = (el) => el ? { w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height } : null;
  return {
    root: r(root), rootH: root ? getComputedStyle(root).height : null,
    ta: r(ta), taClientH: ta?.clientHeight, taScrollH: ta?.scrollHeight,
    preChildren: pre?.children.length, gutterNums: document.querySelectorAll(".dfa-code-gutter-num").length,
    mm: r(mm), canvasAttr: canvas ? { w: canvas.width, h: canvas.height } : null,
    tabTitle: document.querySelector('[data-sidebar-right-tab] span')?.innerText.slice(0, 20),
  };
});
console.log("EDITOR TAB:", JSON.stringify(editor, null, 2));
await page.screenshot({ path: "/tmp/e2e-editor-tab.png" });
await page.evaluate(() => {
  const ta = document.querySelector(".dfa-code-input");
  ta.scrollTop = 150 * 20;
  ta.dispatchEvent(new Event("scroll"));
});
await sleep(800);
const scrolled = await page.evaluate(() => {
  const ta = document.querySelector(".dfa-code-input");
  const pre = document.querySelector(".dfa-code-highlight");
  const viewport = document.querySelector(".dfa-code-viewport");
  const spans = [...pre.children];
  const vr = viewport.getBoundingClientRect();
  // 可见性验证：渲染窗口里必须有行与视口可见区相交（视觉层）
  const visible = spans.filter((span) => {
    const r = span.getBoundingClientRect();
    return r.bottom > vr.top && r.top < vr.bottom;
  });
  // 行号可见性
  const nums = [...document.querySelectorAll(".dfa-code-gutter-num")].filter((n) => {
    const r = n.getBoundingClientRect();
    return r.bottom > vr.top && r.top < vr.bottom;
  });
  // 原生滚动条加宽验证
  const scrollbarWidth = getComputedStyle(ta, "::-webkit-scrollbar").width;
  // 对齐验证：滚动后可见行的视口位置 = 视口顶 + top - scrollTop
  const firstVisible = visible[0];
  let alignError = null;
  if (firstVisible) {
    const expected = vr.top + Number(firstVisible.style.top.replace("px", "")) - ta.scrollTop;
    alignError = Math.abs(firstVisible.getBoundingClientRect().top - expected);
  }
  return {
    scrollTop: ta.scrollTop,
    spanCount: spans.length,
    visibleSpanCount: visible.length,
    visibleNumCount: nums.length,
    firstVisibleText: visible[0]?.textContent.slice(0, 50),
    alignErrorPx: alignError,
    scrollbarWidth,
  };
});
console.log("AFTER SCROLL:", JSON.stringify(scrolled, null, 2));
// tab 切换保持性：切到文件 tab 再切回，滚动位置与预览应保留（keepMounted）
await clickContaining("工作区文件"); await sleep(2500);
await clickContaining("sample.ts"); await sleep(2500);
const persisted = await page.evaluate(() => {
  const ta = document.querySelector(".dfa-code-input");
  return {
    scrollTop: ta?.scrollTop ?? null,
  };
});
console.log("TAB SWITCH PERSIST:", JSON.stringify(persisted, null, 2));
// 自动换行开关：点击「自动换行」→ wrap=soft、行号隐藏、换行层生效
await clickContaining("自动换行"); await sleep(1200);
const wrapState = await page.evaluate(() => {
  const ta = document.querySelector(".dfa-code-input");
  const wrapPre = document.querySelector(".dfa-code-wrap");
  return {
    wrapAttr: ta?.getAttribute("wrap"),
    hasWrapLayer: !!wrapPre,
    gutterHidden: document.querySelectorAll(".dfa-code-gutter").length === 0,
    wrapPreStyle: wrapPre ? { whiteSpace: getComputedStyle(wrapPre).whiteSpace, width: getComputedStyle(wrapPre).width } : null,
  };
});
console.log("WRAP TOGGLE:", JSON.stringify(wrapState, null, 2));
await page.screenshot({ path: "/tmp/e2e-editor-scrolled.png" });
console.log("ERRORS:", JSON.stringify(errors.slice(0, 12), null, 2));
await browser.close();

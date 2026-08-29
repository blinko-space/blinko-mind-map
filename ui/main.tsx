import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import MindElixir, { type MindElixirData, type MindElixirInstance, type NodeObj } from "mind-elixir";
import { zh_CN, zh_TW, en } from "mind-elixir/i18n";
import { customViewPresentation, getCustomViewHost, type CustomViewHost } from "@blinko-cloud/cli/custom-view";
import "mind-elixir/style.css";
import "./styles.css";
import {
  MAP_TYPE_KEY,
  createMindMap,
  flattenNodeText,
  outlineToMindMap,
  parseAiOutline,
  parseMindMap,
  serializeMindMap,
  type MindMapDocument,
} from "./model";

type EntityRecord<T = unknown> = {
  id: string; typeKey: string; data: T; version: number; trashedAt: string | null;
  createdAt: string; updatedAt: string;
};
type Entities = {
  create<T>(input: { typeKey: string; data: T; idempotencyKey?: string }): Promise<EntityRecord<T>>;
  query<T>(query: { typeKey: string; status?: "active" | "trashed" | "all"; sort?: { field: string; direction: "asc" | "desc" }; cursor?: string; limit?: number }): Promise<{ items: EntityRecord<T>[]; nextCursor: string | null }>;
  update<T>(id: string, input: { data: T; baseVersion: number }): Promise<EntityRecord<T>>;
  trash(id: string, baseVersion: number): Promise<EntityRecord>;
};
type MindMapHost = CustomViewHost & {
  entities: Entities;
  ai: { generate(input: { prompt: string; system?: string; maxOutputTokens?: number }): Promise<{ text: string }> };
};

type Copy = Record<string, string>;
const COPY: Record<string, Copy> = {
  en: {
    title:"Blinko Mind Map", search:"Search maps", newMap:"New map", untitled:"Untitled map", emptyTitle:"Turn an idea into a map", emptyBody:"Create your first mind map. Its title and node text will also be available in Blinko search.", create:"Create map", noResults:"No maps match your search.", loading:"Loading maps…", saveSaved:"Saved", saveSaving:"Saving…", saveDirty:"Unsaved changes", saveFailed:"Could not save", conflict:"This map changed elsewhere. Your draft is still here.", reload:"Reload latest", saveCopy:"Save as copy", copySuffix:"copy", undo:"Undo", redo:"Redo", fit:"Fit map", center:"Center map", ai:"Create with AI", aiTitle:"AI mind map", aiNew:"Create a new map", aiExpand:"Expand selected branch", aiPrompt:"What would you like to map?", aiPromptExpand:"What should this branch cover?", aiHint:"AI returns an editable outline and uses your configured Blinko AI provider.", generate:"Generate", generating:"Generating…", cancel:"Cancel", delete:"Delete map", deleteTitle:"Delete this map?", deleteBody:"The map moves to Blinko trash and can be restored from account data tools.", deleteConfirm:"Move to trash", deleteFailed:"Could not delete this map.", aiFailed:"AI could not generate a valid outline. Check AI settings and try again.", aiInstall:"Install this local App release before testing AI.", selectNode:"Select a node first to expand a branch.", tooLarge:"This map is too large to save.", invalidMap:"This map could not be opened.", nodes:"nodes", lastEdited:"Edited {time}", addChild:"Add child", keyboardHint:"Tab adds a child · Enter adds a sibling · Space drags the canvas", retry:"Retry"
  },
  "zh-CN": {
    title:"Blinko 导图", search:"搜索导图", newMap:"新建导图", untitled:"未命名导图", emptyTitle:"把一个想法变成导图", emptyBody:"创建你的第一张思维导图。标题和节点文字也会进入 Blinko 搜索。", create:"创建导图", noResults:"没有匹配的导图。", loading:"正在加载导图…", saveSaved:"已保存", saveSaving:"正在保存…", saveDirty:"有未保存更改", saveFailed:"保存失败", conflict:"这张导图已在别处更新，你的草稿仍保留在这里。", reload:"载入最新版本", saveCopy:"另存为副本", copySuffix:"副本", undo:"撤销", redo:"重做", fit:"适应画布", center:"居中", ai:"使用 AI 创建", aiTitle:"AI 生成导图", aiNew:"创建新导图", aiExpand:"扩展选中分支", aiPrompt:"你想梳理什么主题？", aiPromptExpand:"这个分支应该包含哪些内容？", aiHint:"AI 会返回可继续编辑的大纲，并使用你在 Blinko 中配置的 AI 服务。", generate:"生成", generating:"正在生成…", cancel:"取消", delete:"删除导图", deleteTitle:"删除这张导图？", deleteBody:"导图会移入 Blinko 回收站，之后可通过账号数据工具恢复。", deleteConfirm:"移入回收站", deleteFailed:"无法删除这张导图。", aiFailed:"AI 没有生成有效大纲，请检查 AI 设置后重试。", aiInstall:"请先安装这个本地 App 版本，再测试 AI。", selectNode:"请先选中一个节点，再扩展分支。", tooLarge:"导图过大，无法保存。", invalidMap:"无法打开这张导图。", nodes:"个节点", lastEdited:"编辑于 {time}", addChild:"添加子节点", keyboardHint:"Tab 添加子节点 · Enter 添加同级节点 · 空格拖动画布", retry:"重试"
  },
  "zh-TW": {
    title:"Blinko 導圖", search:"搜尋導圖", newMap:"新增導圖", untitled:"未命名導圖", emptyTitle:"把一個想法變成導圖", emptyBody:"建立你的第一張心智圖。標題和節點文字也會進入 Blinko 搜尋。", create:"建立導圖", noResults:"沒有符合的導圖。", loading:"正在載入導圖…", saveSaved:"已儲存", saveSaving:"正在儲存…", saveDirty:"有未儲存變更", saveFailed:"儲存失敗", conflict:"這張導圖已在其他地方更新，你的草稿仍保留在這裡。", reload:"載入最新版本", saveCopy:"另存為副本", copySuffix:"副本", undo:"復原", redo:"重做", fit:"符合畫布", center:"置中", ai:"使用 AI 建立", aiTitle:"AI 產生導圖", aiNew:"建立新導圖", aiExpand:"擴展選取分支", aiPrompt:"你想整理什麼主題？", aiPromptExpand:"這個分支應該包含哪些內容？", aiHint:"AI 會回傳可繼續編輯的大綱，並使用你在 Blinko 中設定的 AI 服務。", generate:"產生", generating:"正在產生…", cancel:"取消", delete:"刪除導圖", deleteTitle:"刪除這張導圖？", deleteBody:"導圖會移到 Blinko 垃圾桶，之後可透過帳號資料工具還原。", deleteConfirm:"移到垃圾桶", deleteFailed:"無法刪除這張導圖。", aiFailed:"AI 沒有產生有效大綱，請檢查 AI 設定後再試。", aiInstall:"請先安裝這個本機 App 版本，再測試 AI。", selectNode:"請先選取一個節點，再擴展分支。", tooLarge:"導圖太大，無法儲存。", invalidMap:"無法開啟這張導圖。", nodes:"個節點", lastEdited:"編輯於 {time}", addChild:"新增子節點", keyboardHint:"Tab 新增子節點 · Enter 新增同層節點 · 空白鍵拖動畫布", retry:"重試"
  },
};

const presentation = customViewPresentation();
const locale = presentation.locale.toLowerCase().startsWith("zh")
  ? (/-(tw|hk|mo)|hant/.test(presentation.locale.toLowerCase()) ? "zh-TW" : "zh-CN") : "en";
const t = (key: string, values: Record<string, string | number> = {}) =>
  (COPY[locale]?.[key] || COPY.en![key] || key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ""));
const host = getCustomViewHost() as MindMapHost;

const paths: Record<string, ReactNode> = {
  plus:<><path d="M12 5v14M5 12h14"/></>, search:<><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>, undo:<><path d="M9 8 5 12l4 4"/><path d="M5 12h8a6 6 0 0 1 6 6"/></>, redo:<><path d="m15 8 4 4-4 4"/><path d="M19 12h-8a6 6 0 0 0-6 6"/></>, fit:<><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></>, center:<><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/></>, sparkles:<><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z"/><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z"/></>, trash:<><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></>, menu:<><path d="M4 7h16M4 12h16M4 17h16"/></>, close:<><path d="m6 6 12 12M18 6 6 18"/></>, network:<><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/></>, copy:<><path d="M8 8h10v10H8z"/><path d="M6 15H4V4h11v2"/></>, reload:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M18 12a6 6 0 0 0-10-4L5 11M6 12a6 6 0 0 0 10 4l3-3"/></>, chevron:<><path d="m9 18 6-6-6-6"/></>,
};
function Icon({ name, size = 18 }: { name: keyof typeof paths; size?: number }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function countNodes(document: MindMapDocument): number {
  return document.nodeText ? document.nodeText.split("\n").filter(Boolean).length : 0;
}

function relativeTime(value: string): string {
  const delta = new Date(value).getTime() - Date.now();
  const abs = Math.abs(delta);
  const [amount, unit] = abs < 60_000 ? [Math.round(delta / 1_000), "second"]
    : abs < 3_600_000 ? [Math.round(delta / 60_000), "minute"]
      : abs < 86_400_000 ? [Math.round(delta / 3_600_000), "hour"] : [Math.round(delta / 86_400_000), "day"];
  try { return new Intl.RelativeTimeFormat(presentation.locale, { numeric: "auto" }).format(amount, unit as Intl.RelativeTimeFormatUnit); }
  catch { return new Date(value).toLocaleDateString(presentation.locale); }
}

function findNode(root: NodeObj, nodeId: string): NodeObj | undefined {
  if (root.id === nodeId) return root;
  for (const child of root.children ?? []) { const found = findNode(child, nodeId); if (found) return found; }
  return undefined;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(_error: Error, _info: ErrorInfo) { host.state(false, t("invalidMap")); }
  render() { return this.state.failed ? <main className="fatal" role="alert">{t("invalidMap")}</main> : this.props.children; }
}

function App() {
  const [records, setRecords] = useState<EntityRecord<MindMapDocument>[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "dirty" | "saving" | "error" | "conflict">("saved");
  const [mobileList, setMobileList] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<"new" | "expand">("new");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const mapElement = useRef<HTMLDivElement>(null);
  const mind = useRef<MindElixirInstance>();
  const active = useRef<EntityRecord<MindMapDocument>>();
  const recordsRef = useRef(records);
  const saveTimer = useRef<number>();
  const dirty = useRef(false);
  const saving = useRef(false);
  const pendingSave = useRef(false);
  const recordsById = useMemo(() => new Map(records.map((record) => [record.id, record])), [records]);
  const current = activeId ? recordsById.get(activeId) : undefined;
  recordsRef.current = records;
  active.current = current;

  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase(presentation.locale);
    return value ? records.filter((record) => `${record.data.title}\n${record.data.nodeText}`.toLocaleLowerCase(presentation.locale).includes(value)) : records;
  }, [query, records]);

  const load = async () => {
    setLoading(true); setLoadError(false);
    try {
      const items: EntityRecord<MindMapDocument>[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < 10; page += 1) {
        const result = await host.entities.query<MindMapDocument>({
          typeKey: MAP_TYPE_KEY, status: "active", sort: { field: "updatedAt", direction: "desc" },
          ...(cursor ? { cursor } : {}), limit: 100,
        });
        items.push(...result.items);
        if (!result.nextCursor) break;
        cursor = result.nextCursor;
      }
      setRecords(items); recordsRef.current = items;
      setActiveId((selected) => selected && items.some((item) => item.id === selected) ? selected : items[0]?.id);
    } catch { setLoadError(true); }
    finally { setLoading(false); }
  };

  const persist = async () => {
    window.clearTimeout(saveTimer.current);
    if (!dirty.current || saving.current || !active.current || !mind.current) return;
    saving.current = true; dirty.current = false; setSaveState("saving");
    const record = active.current;
    try {
      const data = mind.current.getData();
      const timestamp = new Date().toISOString();
      const nextData: MindMapDocument = {
        ...record.data,
        title: record.data.title.trim().slice(0, 240) || t("untitled"),
        document: serializeMindMap(data),
        nodeText: flattenNodeText(data),
        updatedAt: timestamp,
      };
      const updated = await host.entities.update<MindMapDocument>(record.id, { data: nextData, baseVersion: record.version });
      setRecords((items) => items.map((item) => item.id === updated.id ? updated : item).sort((a, b) => b.data.updatedAt.localeCompare(a.data.updatedAt)));
      active.current = updated; setSaveState("saved");
    } catch (error) {
      dirty.current = true;
      const message = error instanceof Error ? error.message : "";
      setSaveState(message.includes("VERSION_CONFLICT") ? "conflict" : message.includes("MAP_TOO_LARGE") ? "error" : "error");
    } finally {
      saving.current = false;
      if (pendingSave.current) { pendingSave.current = false; window.setTimeout(() => void persist(), 0); }
    }
  };

  const scheduleSave = () => {
    dirty.current = true; setSaveState("dirty"); window.clearTimeout(saveTimer.current);
    if (saving.current) { pendingSave.current = true; return; }
    saveTimer.current = window.setTimeout(() => void persist(), 850);
  };

  const createMap = async (title = t("untitled"), data = createMindMap(title)) => {
    const timestamp = new Date().toISOString();
    const value: MindMapDocument = { title, nodeText: flattenNodeText(data), document: serializeMindMap(data), createdAt: timestamp, updatedAt: timestamp };
    const created = await host.entities.create<MindMapDocument>({
      typeKey: MAP_TYPE_KEY, data: value, idempotencyKey: `mind-map:${crypto.randomUUID()}`,
    });
    setRecords((items) => [created, ...items]); recordsRef.current = [created, ...recordsRef.current];
    setActiveId(created.id); setMobileList(false); return created;
  };

  const selectMap = async (id: string) => {
    if (id === activeId) { setMobileList(false); return; }
    await persist(); setActiveId(id); setMobileList(false); setSaveState("saved");
  };

  const updateTitle = (title: string) => {
    if (!activeId) return;
    setRecords((items) => items.map((record) => record.id === activeId ? { ...record, data: { ...record.data, title } } : record));
    if (active.current) active.current = { ...active.current, data: { ...active.current.data, title } };
    scheduleSave();
  };

  const saveAsCopy = async () => {
    if (!active.current || !mind.current) return;
    const data = mind.current.getData();
    await createMap(`${active.current.data.title} (${t("copySuffix")})`, data);
    setSaveState("saved"); dirty.current = false;
  };

  const removeCurrent = async () => {
    const record = active.current;
    if (!record) return;
    try {
      await host.entities.trash(record.id, record.version);
      const next = recordsRef.current.filter((item) => item.id !== record.id);
      setRecords(next); recordsRef.current = next; setActiveId(next[0]?.id); setDeleteOpen(false); dirty.current = false;
    } catch { setDeleteOpen(false); setSaveState("error"); }
  };

  const openAi = (mode: "new" | "expand") => {
    if (mode === "expand" && !mind.current?.currentNode) { setAiError(t("selectNode")); setAiMode(mode); setAiOpen(true); return; }
    setAiMode(mode); setAiPrompt(""); setAiError(""); setAiOpen(true);
  };

  const runAi = async () => {
    const prompt = aiPrompt.trim(); if (!prompt || aiBusy) return;
    const selected = mind.current?.currentNode?.nodeObj;
    if (aiMode === "expand" && !selected) { setAiError(t("selectNode")); return; }
    setAiBusy(true); setAiError("");
    try {
      const task = aiMode === "expand"
        ? `Expand the mind-map branch named ${JSON.stringify(selected!.topic)} for this request: ${prompt}`
        : `Create a mind map for this request: ${prompt}`;
      const result = await host.ai.generate({
        prompt: task,
        system: "Return only strict JSON in the shape {\"topic\":\"root\",\"children\":[{\"topic\":\"child\",\"children\":[]}]} with concise node topics. Use at most 6 levels and 60 nodes. No Markdown fences, explanations, HTML, links, or extra keys.",
        maxOutputTokens: 2_000,
      });
      const outline = parseAiOutline(result.text);
      if (aiMode === "new") {
        const data = outlineToMindMap(outline);
        await createMap(outline.topic, data);
      } else {
        const data = mind.current!.getData();
        const target = findNode(data.nodeData, selected!.id);
        if (!target) throw new Error("SELECTED_NODE_MISSING");
        const generated = outlineToMindMap(outline).nodeData;
        target.children = [...(target.children ?? []), ...(generated.children?.length ? generated.children : [generated])];
        mind.current!.refresh(data); mind.current!.clearHistory?.(); scheduleSave();
      }
      setAiOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setAiError(message.includes("AI_REQUIRES_INSTALLED_APP") ? t("aiInstall") : t("aiFailed"));
    } finally { setAiBusy(false); }
  };

  useEffect(() => { document.title = t("title"); void load(); return () => { window.clearTimeout(saveTimer.current); mind.current?.destroy(); }; }, []);

  useEffect(() => {
    const record = current;
    mind.current?.destroy(); mind.current = undefined;
    if (!record || !mapElement.current) return;
    try {
      const data = parseMindMap(record.data.document);
      const dark = presentation.theme === "dark";
      const instance = new MindElixir({
        el: mapElement.current,
        direction: data.direction ?? MindElixir.SIDE,
        editable: true,
        toolBar: false,
        keypress: true,
        allowUndo: true,
        overflowHidden: true,
        compact: true,
        contextMenu: { locale: locale === "zh-TW" ? zh_TW : locale === "zh-CN" ? zh_CN : en, focus: true, link: false },
        theme: {
          name: dark ? "Blinko Dark" : "Blinko Light", type: dark ? "dark" : "light",
          palette: dark ? ["#f4c84b", "#8c83ff", "#64b5f6", "#ff8a80", "#81c784", "#ba68c8"] : ["#bd9400", "#7268dd", "#318bd0", "#d65c58", "#4f9b5c", "#9a4ca9"],
          cssVar: {
            "--main-color": dark ? "#e6e6e8" : "#34353a", "--main-bgcolor": dark ? "#24252a" : "#ffffff",
            "--main-bgcolor-transparent": dark ? "rgba(36,37,42,.92)" : "rgba(255,255,255,.92)",
            "--color": dark ? "#e7e7e8" : "#25262b", "--bgcolor": dark ? "#0b0b0c" : "#ffffff",
            "--selected": dark ? "#ffe45c" : "#bd9400", "--accent-color": dark ? "#ffe45c" : "#bd9400",
            "--root-color": "#4a3900", "--root-bgcolor": "#ffe45c", "--root-border-color": "#ffe45c",
            "--root-radius": "16px", "--main-radius": "12px", "--topic-padding": "6px 10px",
            "--panel-color": dark ? "#e7e7e8" : "#25262b", "--panel-bgcolor": dark ? "#202126" : "#ffffff",
            "--panel-border-color": dark ? "rgba(255,255,255,.08)" : "rgba(20,20,25,.08)",
            "--node-gap-x": "18px", "--node-gap-y": "8px", "--main-gap-x": "42px", "--main-gap-y": "20px", "--map-padding": "120px",
          },
        },
      });
      instance.init(data); instance.bus.addListener("operation", scheduleSave); mind.current = instance;
      requestAnimationFrame(() => instance.scaleFit());
    } catch { setSaveState("error"); }
    return () => { mind.current?.destroy(); mind.current = undefined; };
  }, [activeId]);

  useEffect(() => { host.state(saveState === "saving", current?.data.title || t("title")); }, [current?.data.title, saveState]);

  const saveLabel = saveState === "saving" ? t("saveSaving") : saveState === "dirty" ? t("saveDirty") : saveState === "saved" ? t("saveSaved") : t("saveFailed");

  return <main className="app-shell">
    <aside className={`map-list${mobileList ? " mobile-open" : ""}`} aria-label={t("title")}>
      <div className="list-brand"><span className="brand-mark"><Icon name="network" size={19}/></span><strong>{t("title")}</strong><button className="mobile-close icon-button" aria-label={t("cancel")} onClick={()=>setMobileList(false)}><Icon name="close"/></button></div>
      <button className="new-button" onClick={()=>void createMap()}><Icon name="plus"/><span>{t("newMap")}</span></button>
      <label className="search-field"><Icon name="search" size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={t("search")} aria-label={t("search")}/></label>
      <div className="map-rows">
        {loading ? <div className="list-state">{t("loading")}</div> : loadError ? <button className="list-state retry" onClick={()=>void load()}>{t("retry")}</button> : filtered.length ? filtered.map(record=><button key={record.id} className={`map-row${record.id===activeId?" active":""}`} onClick={()=>void selectMap(record.id)}><span className="row-icon"><Icon name="network" size={16}/></span><span className="row-copy"><strong>{record.data.title||t("untitled")}</strong><small>{countNodes(record.data)} {t("nodes")} · {relativeTime(record.data.updatedAt)}</small></span><Icon name="chevron" size={15}/></button>) : <div className="list-state">{query?t("noResults"):""}</div>}
      </div>
    </aside>
    <section className="workspace">
      <header className="workspace-bar">
        <button className="mobile-menu icon-button" aria-label={t("title")} onClick={()=>setMobileList(true)}><Icon name="menu"/></button>
        {current ? <input className="title-input" value={current.data.title} maxLength={240} aria-label={t("untitled")} onChange={event=>updateTitle(event.target.value)}/> : <strong className="workspace-title">{t("title")}</strong>}
        {current && <span className={`save-status ${saveState}`} role="status"><i/>{saveLabel}</span>}
        <div className="toolbar-actions">
          <button className="icon-button" title={t("undo")} aria-label={t("undo")} disabled={!current} onClick={()=>mind.current?.undo()}><Icon name="undo"/></button>
          <button className="icon-button" title={t("redo")} aria-label={t("redo")} disabled={!current} onClick={()=>mind.current?.redo()}><Icon name="redo"/></button>
          <button className="icon-button" title={t("fit")} aria-label={t("fit")} disabled={!current} onClick={()=>mind.current?.scaleFit()}><Icon name="fit"/></button>
          <button className="icon-button optional" title={t("center")} aria-label={t("center")} disabled={!current} onClick={()=>mind.current?.toCenter()}><Icon name="center"/></button>
          <button className="ai-button" onClick={()=>openAi("new")}><Icon name="sparkles" size={17}/><span>{t("ai")}</span></button>
          <button className="icon-button danger" title={t("delete")} aria-label={t("delete")} disabled={!current} onClick={()=>setDeleteOpen(true)}><Icon name="trash"/></button>
        </div>
      </header>
      {saveState === "conflict" && <div className="conflict-banner" role="alert"><span>{t("conflict")}</span><button onClick={()=>void load()}><Icon name="reload" size={15}/>{t("reload")}</button><button onClick={()=>void saveAsCopy()}><Icon name="copy" size={15}/>{t("saveCopy")}</button></div>}
      <div className="canvas-wrap">
        {current ? <><div ref={mapElement} className="mind-map-canvas"/><div className="canvas-hints"><button onClick={()=>mind.current?.currentNode&&void mind.current.addChild(mind.current.currentNode)}><Icon name="plus" size={14}/>{t("addChild")}</button><button onClick={()=>openAi("expand")}><Icon name="sparkles" size={14}/>{t("aiExpand")}</button><span>{t("keyboardHint")}</span></div></> : !loading && <div className="empty-state"><span className="empty-art"><Icon name="network" size={34}/></span><h1>{t("emptyTitle")}</h1><p>{t("emptyBody")}</p><button className="new-button empty-create" onClick={()=>void createMap()}><Icon name="plus"/>{t("create")}</button></div>}
      </div>
    </section>
    {mobileList && <button className="scrim" aria-label={t("cancel")} onClick={()=>setMobileList(false)}/>}
    {aiOpen && <div className="dialog-backdrop" onMouseDown={event=>event.target===event.currentTarget&&setAiOpen(false)}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="ai-title"><div className="dialog-head"><span className="dialog-icon"><Icon name="sparkles"/></span><div><h2 id="ai-title">{t("aiTitle")}</h2><p>{aiMode==="new"?t("aiNew"):t("aiExpand")}</p></div><button className="icon-button" aria-label={t("cancel")} onClick={()=>setAiOpen(false)}><Icon name="close"/></button></div><textarea autoFocus value={aiPrompt} maxLength={4000} placeholder={aiMode==="new"?t("aiPrompt"):t("aiPromptExpand")} onChange={event=>setAiPrompt(event.target.value)} onKeyDown={event=>{if((event.metaKey||event.ctrlKey)&&event.key==="Enter")void runAi();}}/><p className="ai-hint">{t("aiHint")}</p>{aiError&&<p className="dialog-error" role="alert">{aiError}</p>}<div className="dialog-actions"><button className="secondary-button" onClick={()=>setAiOpen(false)}>{t("cancel")}</button><button className="primary-button" disabled={!aiPrompt.trim()||aiBusy} onClick={()=>void runAi()}>{aiBusy?<span className="spinner"/>:<Icon name="sparkles" size={16}/>} {aiBusy?t("generating"):t("generate")}</button></div></section></div>}
    {deleteOpen && <div className="dialog-backdrop"><section className="dialog compact" role="alertdialog" aria-modal="true" aria-labelledby="delete-title"><div className="dialog-head"><span className="dialog-icon danger"><Icon name="trash"/></span><div><h2 id="delete-title">{t("deleteTitle")}</h2><p>{t("deleteBody")}</p></div></div><div className="dialog-actions"><button className="secondary-button" onClick={()=>setDeleteOpen(false)}>{t("cancel")}</button><button className="delete-button" onClick={()=>void removeCurrent()}>{t("deleteConfirm")}</button></div></section></div>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<AppErrorBoundary><App/></AppErrorBoundary>);

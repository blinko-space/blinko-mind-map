import { Component, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import MindElixir, { type MindElixirData, type MindElixirInstance, type NodeObj, type Topic } from "mind-elixir";
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
type CanvasMenuState = { x: number; y: number; selectedNodeId?: string };

type Copy = Record<string, string>;
const COPY: Record<string, Copy> = {
  en: {
    title:"Blinko Mind Map", search:"Search maps", newMap:"New map", untitled:"Untitled map", emptyTitle:"Turn an idea into a map", emptyBody:"Create your first mind map. Its title and node text will also be available in Blinko search.", create:"Create map", noResults:"No maps match your search.", loading:"Loading maps…", saveSaved:"Saved", saveSaving:"Saving…", saveDirty:"Unsaved changes", saveFailed:"Could not save", conflict:"This map changed elsewhere. Your draft is still here.", reload:"Reload latest", saveCopy:"Save as copy", copySuffix:"copy", undo:"Undo", redo:"Redo", fit:"Fit map", center:"Center map", ai:"Create with AI", aiTitle:"AI mind map", aiNew:"Create a new map", aiExpand:"Expand selected branch", aiPrompt:"What would you like to map?", aiPromptExpand:"What should this branch cover?", aiHint:"AI returns an editable outline and uses your configured Blinko AI provider.", generate:"Generate", generating:"Generating…", cancel:"Cancel", delete:"Delete map", deleteTitle:"Delete this map?", deleteBody:"The map moves to Blinko trash and can be restored from account data tools.", deleteConfirm:"Move to trash", deleteFailed:"Could not delete this map.", aiFailed:"AI could not generate a valid outline. Check AI settings and try again.", aiNotConfigured:"Configure a chat model in Blinko AI settings, then try again.", aiInstall:"Install this local App release before testing AI.", selectNode:"Select a node first to expand a branch.", tooLarge:"This map is too large to save.", invalidMap:"This map could not be opened.", nodes:"nodes", lastEdited:"Edited {time}", addChild:"Add child", keyboardHint:"Tab adds a child · Enter adds a sibling · Space drags the canvas", retry:"Retry"
  },
  "zh-CN": {
    title:"Blinko 导图", search:"搜索导图", newMap:"新建导图", untitled:"未命名导图", emptyTitle:"把一个想法变成导图", emptyBody:"创建你的第一张思维导图。标题和节点文字也会进入 Blinko 搜索。", create:"创建导图", noResults:"没有匹配的导图。", loading:"正在加载导图…", saveSaved:"已保存", saveSaving:"正在保存…", saveDirty:"有未保存更改", saveFailed:"保存失败", conflict:"这张导图已在别处更新，你的草稿仍保留在这里。", reload:"载入最新版本", saveCopy:"另存为副本", copySuffix:"副本", undo:"撤销", redo:"重做", fit:"适应画布", center:"居中", ai:"使用 AI 创建", aiTitle:"AI 生成导图", aiNew:"创建新导图", aiExpand:"扩展选中分支", aiPrompt:"你想梳理什么主题？", aiPromptExpand:"这个分支应该包含哪些内容？", aiHint:"AI 会返回可继续编辑的大纲，并使用你在 Blinko 中配置的 AI 服务。", generate:"生成", generating:"正在生成…", cancel:"取消", delete:"删除导图", deleteTitle:"删除这张导图？", deleteBody:"导图会移入 Blinko 回收站，之后可通过账号数据工具恢复。", deleteConfirm:"移入回收站", deleteFailed:"无法删除这张导图。", aiFailed:"AI 没有生成有效大纲，请检查 AI 设置后重试。", aiNotConfigured:"请先在 Blinko 的 AI 设置中配置对话模型，再重试。", aiInstall:"请先安装这个本地 App 版本，再测试 AI。", selectNode:"请先选中一个节点，再扩展分支。", tooLarge:"导图过大，无法保存。", invalidMap:"无法打开这张导图。", nodes:"个节点", lastEdited:"编辑于 {time}", addChild:"添加子节点", keyboardHint:"Tab 添加子节点 · Enter 添加同级节点 · 空格拖动画布", retry:"重试"
  },
  "zh-TW": {
    title:"Blinko 導圖", search:"搜尋導圖", newMap:"新增導圖", untitled:"未命名導圖", emptyTitle:"把一個想法變成導圖", emptyBody:"建立你的第一張心智圖。標題和節點文字也會進入 Blinko 搜尋。", create:"建立導圖", noResults:"沒有符合的導圖。", loading:"正在載入導圖…", saveSaved:"已儲存", saveSaving:"正在儲存…", saveDirty:"有未儲存變更", saveFailed:"儲存失敗", conflict:"這張導圖已在其他地方更新，你的草稿仍保留在這裡。", reload:"載入最新版本", saveCopy:"另存為副本", copySuffix:"副本", undo:"復原", redo:"重做", fit:"符合畫布", center:"置中", ai:"使用 AI 建立", aiTitle:"AI 產生導圖", aiNew:"建立新導圖", aiExpand:"擴展選取分支", aiPrompt:"你想整理什麼主題？", aiPromptExpand:"這個分支應該包含哪些內容？", aiHint:"AI 會回傳可繼續編輯的大綱，並使用你在 Blinko 中設定的 AI 服務。", generate:"產生", generating:"正在產生…", cancel:"取消", delete:"刪除導圖", deleteTitle:"刪除這張導圖？", deleteBody:"導圖會移到 Blinko 垃圾桶，之後可透過帳號資料工具還原。", deleteConfirm:"移到垃圾桶", deleteFailed:"無法刪除這張導圖。", aiFailed:"AI 沒有產生有效大綱，請檢查 AI 設定後再試。", aiNotConfigured:"請先在 Blinko 的 AI 設定中設定對話模型，再重試。", aiInstall:"請先安裝這個本機 App 版本，再測試 AI。", selectNode:"請先選取一個節點，再擴展分支。", tooLarge:"導圖太大，無法儲存。", invalidMap:"無法開啟這張導圖。", nodes:"個節點", lastEdited:"編輯於 {time}", addChild:"新增子節點", keyboardHint:"Tab 新增子節點 · Enter 新增同層節點 · 空白鍵拖動畫布", retry:"重試"
  },
};

const presentation = customViewPresentation();
const locale = presentation.locale.toLowerCase().startsWith("zh")
  ? (/-(tw|hk|mo)|hant/.test(presentation.locale.toLowerCase()) ? "zh-TW" : "zh-CN") : "en";
const t = (key: string, values: Record<string, string | number> = {}) =>
  (COPY[locale]?.[key] || COPY.en![key] || key).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ""));
const INTERACTION_COPY: Record<string, Copy> = {
  en: {
    zoomIn:"Zoom in", zoomOut:"Zoom out", resetZoom:"Reset zoom", guide:"How to use Blinko Mind Map",
    guideTitle:"Build your map naturally", guideIntro:"Everything saves automatically while you work.",
    guideNodes:"Double-click a node to edit it. Drag a branch onto another node to reorganize it.",
    guideCanvas:"Drag empty canvas space to move around. Scroll to zoom, or use the controls in the lower-left corner.",
    guideKeys:"Select a node and press Tab for a child, Enter for a sibling, or Delete to remove it. The top trash button deletes the whole map.",
    guideDone:"Start mapping", keyboardHint:"Drag canvas · Right-click to add · Scroll to zoom · Tab child · Enter sibling",
    renameMap:"Rename map", renameMapTitle:"Rename this map", mapName:"Map name", saveName:"Save name",
    newBranch:"New main branch", newChild:"Add child to selected node", renameNode:"Rename node", duplicateBranch:"Duplicate branch",
    canvasMenuHint:"Right-click a node for more editing actions.", newNodeName:"New node",
  },
  "zh-CN": {
    zoomIn:"放大", zoomOut:"缩小", resetZoom:"重置缩放", guide:"Blinko 导图使用指引",
    guideTitle:"自然地整理你的想法", guideIntro:"编辑过程中会自动保存，不需要手动操作。",
    guideNodes:"双击节点可以编辑；把分支拖到另一个节点上，可以重新整理结构。",
    guideCanvas:"按住画布空白处拖动即可平移，滚轮可以缩放，也可以使用左下角的缩放控件。",
    guideKeys:"选中节点后，Tab 添加子节点、Enter 添加同级节点、Delete 删除节点。顶部垃圾桶删除整张导图。",
    guideDone:"开始绘制", keyboardHint:"拖动画布 · 右键新建 · 滚轮缩放 · Tab 子节点 · Enter 同级节点",
    renameMap:"重命名导图", renameMapTitle:"重命名这张导图", mapName:"导图名称", saveName:"保存名称",
    newBranch:"新建主分支", newChild:"为选中节点添加子节点", renameNode:"重命名节点", duplicateBranch:"复制分支",
    canvasMenuHint:"右键点击节点可使用更多编辑操作。", newNodeName:"新节点",
  },
  "zh-TW": {
    zoomIn:"放大", zoomOut:"縮小", resetZoom:"重設縮放", guide:"Blinko 導圖使用指引",
    guideTitle:"自然地整理你的想法", guideIntro:"編輯過程會自動儲存，不需要手動操作。",
    guideNodes:"雙擊節點可以編輯；把分支拖到另一個節點上，可以重新整理結構。",
    guideCanvas:"按住畫布空白處拖動即可平移，滾輪可以縮放，也可以使用左下角的縮放控制。",
    guideKeys:"選取節點後，Tab 新增子節點、Enter 新增同層節點、Delete 刪除節點。頂部垃圾桶刪除整張導圖。",
    guideDone:"開始繪製", keyboardHint:"拖動畫布 · 右鍵新增 · 滾輪縮放 · Tab 子節點 · Enter 同層節點",
    renameMap:"重新命名導圖", renameMapTitle:"重新命名這張導圖", mapName:"導圖名稱", saveName:"儲存名稱",
    newBranch:"新增主分支", newChild:"為選取節點新增子節點", renameNode:"重新命名節點", duplicateBranch:"複製分支",
    canvasMenuHint:"右鍵點擊節點可使用更多編輯操作。", newNodeName:"新節點",
  },
};
const interactionText = (key: string) => INTERACTION_COPY[locale]?.[key] || INTERACTION_COPY.en![key] || key;
const host = getCustomViewHost() as MindMapHost;

const paths: Record<string, ReactNode> = {
  plus:<><path d="M12 5v14M5 12h14"/></>, minus:<><path d="M5 12h14"/></>, search:<><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>, undo:<><path d="M9 8 5 12l4 4"/><path d="M5 12h8a6 6 0 0 1 6 6"/></>, redo:<><path d="m15 8 4 4-4 4"/><path d="M19 12h-8a6 6 0 0 0-6 6"/></>, fit:<><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></>, center:<><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/></>, help:<><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.2 2.1c-.7.3-1 .8-1 1.5v.4M12 17h.01"/></>, pencil:<><path d="m4 20 4.2-1 10.7-10.7a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z"/><path d="m14.5 7 3 3"/></>, sparkles:<><path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z"/><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z"/></>, trash:<><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></>, menu:<><path d="M4 7h16M4 12h16M4 17h16"/></>, close:<><path d="m6 6 12 12M18 6 6 18"/></>, network:<><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6"/></>, copy:<><path d="M8 8h10v10H8z"/><path d="M6 15H4V4h11v2"/></>, reload:<><path d="M20 7v5h-5M4 17v-5h5"/><path d="M18 12a6 6 0 0 0-10-4L5 11M6 12a6 6 0 0 0 10 4l3-3"/></>, chevron:<><path d="m9 18 6-6-6-6"/></>,
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
  const [guideOpen, setGuideOpen] = useState(false);
  const [scalePercent, setScalePercent] = useState(100);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [canvasMenu, setCanvasMenu] = useState<CanvasMenuState>();
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
      setAiError(message.includes("AI_REQUIRES_INSTALLED_APP") ? t("aiInstall")
        : message.includes("CHAT_NOT_CONFIGURED") ? t("aiNotConfigured") : t("aiFailed"));
    } finally { setAiBusy(false); }
  };

  const zoomBy = (amount: number) => {
    const instance = mind.current;
    if (instance) instance.scale(instance.scaleVal + amount);
  };

  const dismissGuide = () => {
    setGuideOpen(false);
    void host.storage.set("mind-map.guide-v1", true).catch(() => undefined);
  };

  const openRename = () => {
    setRenameDraft(active.current?.data.title || t("untitled"));
    setRenameOpen(true);
  };

  const saveRename = () => {
    const title = renameDraft.trim().slice(0, 240) || t("untitled");
    updateTitle(title); setRenameOpen(false);
  };

  const addFromCanvas = async (selectedNodeId?: string) => {
    const instance = mind.current; if (!instance) return;
    const target = instance.findEle(selectedNodeId || instance.nodeData.id);
    setCanvasMenu(undefined);
    await instance.addChild(target);
  };

  useEffect(() => {
    document.title = t("title");
    void load();
    void host.storage.get("mind-map.guide-v1").then((dismissed) => { if (dismissed !== true) setGuideOpen(true); }).catch(() => setGuideOpen(true));
    return () => { window.clearTimeout(saveTimer.current); mind.current?.destroy(); };
  }, []);

  useEffect(() => {
    const record = current;
    mind.current?.destroy(); mind.current = undefined;
    if (!record || !mapElement.current) return;
    try {
      const data = parseMindMap(record.data.document);
      const dark = presentation.theme === "dark";
      let instance: MindElixirInstance;
      instance = new MindElixir({
        el: mapElement.current,
        direction: data.direction ?? MindElixir.SIDE,
        editable: true,
        toolBar: false,
        keypress: true,
        allowUndo: true,
        overflowHidden: false,
        mouseSelectionButton: 2,
        newTopicName: interactionText("newNodeName"),
        handleWheel: (event) => {
          event.preventDefault(); event.stopPropagation();
          const delta = Math.max(-0.14, Math.min(0.14, -event.deltaY * 0.0025));
          if (delta) instance.scale(instance.scaleVal + delta, { x: event.clientX, y: event.clientY });
        },
        compact: true,
        contextMenu: {
          locale: locale === "zh-TW" ? zh_TW : locale === "zh-CN" ? zh_CN : en,
          focus: true,
          link: true,
          extend: [
            { name: interactionText("renameNode"), key: "F2", onclick: () => {
              const menu = instance.container.querySelector<HTMLElement>(".context-menu"); if (menu) menu.hidden = true;
              if (instance.currentNode) void instance.beginEdit(instance.currentNode);
            } },
            { name: interactionText("duplicateBranch"), onclick: () => {
              const menu = instance.container.querySelector<HTMLElement>(".context-menu"); if (menu) menu.hidden = true;
              const node = instance.currentNode;
              if (node?.nodeObj.parent) void instance.copyNode(node, instance.findEle(node.nodeObj.parent.id));
            } },
          ],
        },
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
      instance.init(data); instance.bus.addListener("operation", scheduleSave);
      instance.bus.addListener("scale", (value: number) => setScalePercent(Math.round(value * 100)));
      mind.current = instance;
      const pan = { active: false, pointerId: -1, x: 0, y: 0 };
      const pointerDown = (event: PointerEvent) => {
        const target = event.target instanceof Element ? event.target : null;
        if (event.button !== 0 || event.pointerType !== "mouse" || target?.closest("me-tpc, me-epd, .svg-label, .circle, #input-box, .context-menu")) return;
        event.preventDefault(); event.stopImmediatePropagation(); setCanvasMenu(undefined);
        pan.active = true; pan.pointerId = event.pointerId; pan.x = event.clientX; pan.y = event.clientY;
        instance.container.classList.add("blinko-panning"); instance.container.setPointerCapture(event.pointerId);
      };
      const pointerMove = (event: PointerEvent) => {
        if (!pan.active || event.pointerId !== pan.pointerId) return;
        event.preventDefault(); event.stopImmediatePropagation();
        instance.move(event.clientX - pan.x, event.clientY - pan.y);
        pan.x = event.clientX; pan.y = event.clientY;
      };
      const pointerEnd = (event: PointerEvent) => {
        if (!pan.active || event.pointerId !== pan.pointerId) return;
        event.preventDefault(); event.stopImmediatePropagation(); pan.active = false;
        instance.container.classList.remove("blinko-panning");
        if (instance.container.hasPointerCapture(event.pointerId)) instance.container.releasePointerCapture(event.pointerId);
      };
      instance.container.addEventListener("pointerdown", pointerDown, true);
      instance.container.addEventListener("pointermove", pointerMove, true);
      instance.container.addEventListener("pointerup", pointerEnd, true);
      instance.container.addEventListener("pointercancel", pointerEnd, true);
      const contextMenu = (event: MouseEvent) => {
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest("me-tpc, .context-menu")) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const selected = instance.currentNode?.nodeObj;
        setCanvasMenu({
          x: Math.max(8, Math.min(event.clientX, window.innerWidth - 236)),
          y: Math.max(8, Math.min(event.clientY, window.innerHeight - 148)),
          selectedNodeId: selected?.parent ? selected.id : undefined,
        });
      };
      mapElement.current.addEventListener("contextmenu", contextMenu, true);
      const resizeObserver = new ResizeObserver(() => requestAnimationFrame(() => instance.scaleFit()));
      resizeObserver.observe(mapElement.current);
      requestAnimationFrame(() => instance.scaleFit());
      return () => {
        resizeObserver.disconnect();
        instance.container.removeEventListener("pointerdown", pointerDown, true);
        instance.container.removeEventListener("pointermove", pointerMove, true);
        instance.container.removeEventListener("pointerup", pointerEnd, true);
        instance.container.removeEventListener("pointercancel", pointerEnd, true);
        mapElement.current?.removeEventListener("contextmenu", contextMenu, true);
        if (mind.current === instance) { instance.destroy(); mind.current = undefined; }
      };
    } catch { setSaveState("error"); }
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
        {current ? <><input className="title-input" value={current.data.title} maxLength={240} aria-label={interactionText("mapName")} onChange={event=>updateTitle(event.target.value)}/><button className="icon-button rename-map-button" title={interactionText("renameMap")} aria-label={interactionText("renameMap")} onClick={openRename}><Icon name="pencil" size={16}/></button></> : <strong className="workspace-title">{t("title")}</strong>}
        {current && <span className={`save-status ${saveState}`} role="status"><i/>{saveLabel}</span>}
        <div className="toolbar-actions">
          <button className="icon-button" title={t("undo")} aria-label={t("undo")} disabled={!current} onClick={()=>mind.current?.undo()}><Icon name="undo"/></button>
          <button className="icon-button" title={t("redo")} aria-label={t("redo")} disabled={!current} onClick={()=>mind.current?.redo()}><Icon name="redo"/></button>
          <button className="icon-button" title={t("fit")} aria-label={t("fit")} disabled={!current} onClick={()=>mind.current?.scaleFit()}><Icon name="fit"/></button>
          <button className="icon-button optional" title={t("center")} aria-label={t("center")} disabled={!current} onClick={()=>mind.current?.toCenter()}><Icon name="center"/></button>
          <button className="icon-button" title={interactionText("guide")} aria-label={interactionText("guide")} onClick={()=>setGuideOpen(true)}><Icon name="help"/></button>
          <button className="ai-button" onClick={()=>openAi("new")}><Icon name="sparkles" size={17}/><span>{t("ai")}</span></button>
          <button className="icon-button danger" title={t("delete")} aria-label={t("delete")} disabled={!current} onClick={()=>setDeleteOpen(true)}><Icon name="trash"/></button>
        </div>
      </header>
      {saveState === "conflict" && <div className="conflict-banner" role="alert"><span>{t("conflict")}</span><button onClick={()=>void load()}><Icon name="reload" size={15}/>{t("reload")}</button><button onClick={()=>void saveAsCopy()}><Icon name="copy" size={15}/>{t("saveCopy")}</button></div>}
      <div className="canvas-wrap">
        {current ? <><div ref={mapElement} className="mind-map-canvas"/><div className="zoom-controls"><button title={interactionText("zoomOut")} aria-label={interactionText("zoomOut")} onClick={()=>zoomBy(-.1)}><Icon name="minus" size={15}/></button><button className="zoom-value" title={interactionText("resetZoom")} aria-label={interactionText("resetZoom")} onClick={()=>{mind.current?.scale(1);mind.current?.toCenter();}}>{scalePercent}%</button><button title={interactionText("zoomIn")} aria-label={interactionText("zoomIn")} onClick={()=>zoomBy(.1)}><Icon name="plus" size={15}/></button></div><div className="canvas-hints"><button onClick={()=>{const instance=mind.current;if(!instance)return;void instance.addChild(instance.currentNode??instance.findEle(instance.nodeData.id));}}><Icon name="plus" size={14}/>{t("addChild")}</button><button onClick={()=>openAi("expand")}><Icon name="sparkles" size={14}/>{t("aiExpand")}</button><span>{interactionText("keyboardHint")}</span></div></> : !loading && <div className="empty-state"><span className="empty-art"><Icon name="network" size={34}/></span><h1>{t("emptyTitle")}</h1><p>{t("emptyBody")}</p><button className="new-button empty-create" onClick={()=>void createMap()}><Icon name="plus"/>{t("create")}</button></div>}
      </div>
    </section>
    {canvasMenu && <div className="context-backdrop" onPointerDown={()=>setCanvasMenu(undefined)}><div className="canvas-context-menu" role="menu" aria-label={interactionText("newBranch")} style={{ left: canvasMenu.x, top: canvasMenu.y }} onPointerDown={event=>event.stopPropagation()}><button role="menuitem" onClick={()=>void addFromCanvas()}><Icon name="network" size={17}/><span>{interactionText("newBranch")}</span><kbd>Enter</kbd></button>{canvasMenu.selectedNodeId&&<button role="menuitem" onClick={()=>void addFromCanvas(canvasMenu.selectedNodeId)}><Icon name="plus" size={17}/><span>{interactionText("newChild")}</span><kbd>Tab</kbd></button>}<p>{interactionText("canvasMenuHint")}</p></div></div>}
    {mobileList && <button className="scrim" aria-label={t("cancel")} onClick={()=>setMobileList(false)}/>}
    {renameOpen && <div className="dialog-backdrop"><section className="dialog compact rename-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-title"><div className="dialog-head"><span className="dialog-icon"><Icon name="pencil"/></span><div><h2 id="rename-title">{interactionText("renameMapTitle")}</h2><p>{interactionText("mapName")}</p></div><button type="button" className="icon-button" aria-label={t("cancel")} onClick={()=>setRenameOpen(false)}><Icon name="close"/></button></div><input className="rename-input" autoFocus value={renameDraft} maxLength={240} aria-label={interactionText("mapName")} onFocus={event=>event.currentTarget.select()} onChange={event=>setRenameDraft(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"&&!event.nativeEvent.isComposing)saveRename();}}/><div className="dialog-actions"><button type="button" className="secondary-button" onClick={()=>setRenameOpen(false)}>{t("cancel")}</button><button type="button" className="primary-button" onClick={saveRename}>{interactionText("saveName")}</button></div></section></div>}
    {guideOpen && <div className="dialog-backdrop guide-backdrop"><section className="dialog guide-dialog" role="dialog" aria-modal="true" aria-labelledby="guide-title"><div className="dialog-head"><span className="dialog-icon"><Icon name="network"/></span><div><h2 id="guide-title">{interactionText("guideTitle")}</h2><p>{interactionText("guideIntro")}</p></div><button className="icon-button" aria-label={t("cancel")} onClick={dismissGuide}><Icon name="close"/></button></div><div className="guide-list"><div><span>1</span><p>{interactionText("guideNodes")}</p></div><div><span>2</span><p>{interactionText("guideCanvas")}</p></div><div><span>3</span><p>{interactionText("guideKeys")}</p></div></div><div className="dialog-actions"><button className="primary-button" onClick={dismissGuide}>{interactionText("guideDone")}</button></div></section></div>}
    {aiOpen && <div className="dialog-backdrop" onMouseDown={event=>event.target===event.currentTarget&&setAiOpen(false)}><section className="dialog" role="dialog" aria-modal="true" aria-labelledby="ai-title"><div className="dialog-head"><span className="dialog-icon"><Icon name="sparkles"/></span><div><h2 id="ai-title">{t("aiTitle")}</h2><p>{aiMode==="new"?t("aiNew"):t("aiExpand")}</p></div><button className="icon-button" aria-label={t("cancel")} onClick={()=>setAiOpen(false)}><Icon name="close"/></button></div><textarea autoFocus value={aiPrompt} maxLength={4000} placeholder={aiMode==="new"?t("aiPrompt"):t("aiPromptExpand")} onChange={event=>setAiPrompt(event.target.value)} onKeyDown={event=>{if((event.metaKey||event.ctrlKey)&&event.key==="Enter")void runAi();}}/><p className="ai-hint">{t("aiHint")}</p>{aiError&&<p className="dialog-error" role="alert">{aiError}</p>}<div className="dialog-actions"><button className="secondary-button" onClick={()=>setAiOpen(false)}>{t("cancel")}</button><button className="primary-button" disabled={!aiPrompt.trim()||aiBusy} onClick={()=>void runAi()}>{aiBusy?<span className="spinner"/>:<Icon name="sparkles" size={16}/>} {aiBusy?t("generating"):t("generate")}</button></div></section></div>}
    {deleteOpen && <div className="dialog-backdrop"><section className="dialog compact" role="alertdialog" aria-modal="true" aria-labelledby="delete-title"><div className="dialog-head"><span className="dialog-icon danger"><Icon name="trash"/></span><div><h2 id="delete-title">{t("deleteTitle")}</h2><p>{t("deleteBody")}</p></div></div><div className="dialog-actions"><button className="secondary-button" onClick={()=>setDeleteOpen(false)}>{t("cancel")}</button><button className="delete-button" onClick={()=>void removeCurrent()}>{t("deleteConfirm")}</button></div></section></div>}
  </main>;
}

createRoot(document.getElementById("root")!).render(<AppErrorBoundary><App/></AppErrorBoundary>);

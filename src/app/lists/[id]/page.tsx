"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Navbar } from "@/components/navbar";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import {
  Plus, Search, Filter, ArrowUpDown, MoreHorizontal,
  Trash2, UserPlus, Users, ArrowLeft, CheckCircle2,
  Circle, Clock, Loader2, ChevronDown, User, X, Shield,
  Calendar, Tag, ChevronRight, LayoutList, Columns,
} from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

// ===== Types =====

type UserBrief = {
  id: string; name: string; username: string; email: string; avatarUrl: string | null;
};

type TagBrief = { id: string; name: string; color: string | null };

type TaskTag = { tag: TagBrief };

type Task = {
  id: string; title: string; notes: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "high" | "medium" | "low";
  dueDate: string | null; listId: string; assigneeId: string | null;
  assignee: UserBrief | null;
  parentTaskId: string | null;
  childTasks: Task[];
  taskTags: TaskTag[];
  createdAt: string; updatedAt: string;
};

type ListData = {
  id: string; name: string; description: string | null;
  _count: { tasks: number; members: number };
  members: { role: Role; userId: string; user: UserBrief }[];
  currentUserRole: Role;
};

type TagItem = { id: string; name: string; color: string | null; _count: { taskTags: number } };

const STATUS_CONFIG = {
  todo: { label: "待办", icon: Circle, color: "text-slate-400" },
  in_progress: { label: "进行中", icon: Clock, color: "text-blue-500" },
  done: { label: "已完成", icon: CheckCircle2, color: "text-green-500" },
} as const;

const PRIORITY_CONFIG = {
  high: { label: "高", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  medium: { label: "中", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  low: { label: "低", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
} as const;

const TAG_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
];

// ===== Page =====

export default function ListDetailPage() {
  const { data: session, status: authStatus } = useSession();
  const params = useParams();
  const router = useRouter();
  const listId = params.id as string;

  const [list, setList] = useState<ListData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [loading, setLoading] = useState(true);

  // View
  const [isBoardView, setIsBoardView] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("priority");
  const [sortOrder, setSortOrder] = useState("desc");

  // Dialogs
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editTaskOpen, setEditTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [descExpanded, setDescExpanded] = useState(false);

  // New task form
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");
  const [newDueDate, setNewDueDate] = useState("");
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [newParentId, setNewParentId] = useState("");
  const [newTagInput, setNewTagInput] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newNotes, setNewNotes] = useState("");
  const [editTagInput, setEditTagInput] = useState("");
  const [saving, setSaving] = useState(false);

  const currentRole = list?.currentUserRole;
  const isAdmin = currentRole === "creator" || currentRole === "admin";

  const fetchData = useCallback(async () => {
    try {
      const [listRes, tasksRes, tagsRes] = await Promise.all([
        fetch(`/api/lists/${listId}`),
        fetch(`/api/lists/${listId}/tasks?status=${statusFilter}&tagId=${tagFilter}&myTasks=${myTasksOnly}&search=${encodeURIComponent(search)}&sortBy=${sortBy}&sortOrder=${sortOrder}`),
        fetch(`/api/lists/${listId}/tags`),
      ]);
      if (listRes.ok) setList(await listRes.json());
      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (tagsRes.ok) setTags(await tagsRes.json());
    } catch (err) { console.error("Fetch error", err); }
    finally { setLoading(false); }
  }, [listId, statusFilter, tagFilter, myTasksOnly, search, sortBy, sortOrder]);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (authStatus === "unauthenticated") { router.push("/login"); return; }
    fetchData();
  }, [authStatus, fetchData, router]);

  function toggleExpand(taskId: string) {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: newTitle, priority: newPriority,
        dueDate: newDueDate || null, assigneeId: newAssigneeId || null,
        parentTaskId: newParentId || null,
        notes: newNotes || null,
        tagNames: newTags,
      };
      const res = await fetch(`/api/lists/${listId}/tasks`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        resetForm();
        fetchData();
      }
    } catch { }
    finally { setSaving(false); }
  }

  function resetForm() {
    setNewTaskOpen(false); setNewTitle(""); setNewPriority("medium");
    setNewDueDate(""); setNewAssigneeId(""); setNewParentId("");
    setNewTagInput(""); setNewTags([]); setNewNotes("");
  }

  function addTagToForm(tag: string) {
    if (tag.trim() && !newTags.includes(tag.trim()) && newTags.length < 10) {
      setNewTags([...newTags, tag.trim()]);
      setNewTagInput("");
    }
  }

  function removeTagFromForm(tag: string) {
    setNewTags(newTags.filter(t => t !== tag));
  }

  async function updateTaskStatus(taskId: string, status: string) {
    await fetch(`/api/lists/${listId}/tasks/${taskId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchData();
  }

  async function deleteTask(taskId: string) {
    await fetch(`/api/lists/${listId}/tasks/${taskId}`, { method: "DELETE" });
    fetchData();
  }

  function openEditTask(task: Task) {
    setEditingTask(task);
    setEditTaskOpen(true);
  }

  async function saveEditTask(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTask) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/lists/${listId}/tasks/${editingTask.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingTask.title,
          priority: editingTask.priority,
          dueDate: editingTask.dueDate || null,
          assigneeId: editingTask.assigneeId || null,
          tagNames: (editingTask.taskTags || []).map(tt => tt.tag.name),
        }),
      });
      if (res.ok) {
        setEditTaskOpen(false);
        setEditingTask(null);
        fetchData();
      }
    } catch { }
    finally { setSaving(false); }
  }

  function renderTaskCard(task: Task) {
    const StatusIcon = STATUS_CONFIG[task.status].icon;
    const hasChildren = task.childTasks && task.childTasks.length > 0;
    const isExpanded = expandedTasks.has(task.id);
    const taskTags = task.taskTags || [];

    return (
      <div key={task.id}>
        <Card
          className={cn(
          "flex items-center gap-3 p-3 transition-colors hover:bg-accent/50 overflow-hidden cursor-pointer",
          task.status === "done" && "opacity-60",
        )}
          onClick={() => router.push(`/lists/${listId}/tasks/${task.id}`)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); updateTaskStatus(task.id, task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "done" : "todo"); }}
            className={STATUS_CONFIG[task.status].color}
          >
            <StatusIcon className="size-5" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {hasChildren && (
                <button onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }} className="text-muted-foreground">
                  <ChevronRight className={cn("size-4 transition-transform", isExpanded && "rotate-90")} />
                </button>
              )}
              <Link href={`/lists/${listId}/tasks/${task.id}`} className={cn("font-medium break-words hover:underline", task.status === "done" && "line-through")}>
                {task.title}
              </Link>
              <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", PRIORITY_CONFIG[task.priority].color)}>
                {PRIORITY_CONFIG[task.priority].label}
              </Badge>
              {taskTags.map(tt => (
                <Badge key={tt.tag.id} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {tt.tag.name}
                </Badge>
              ))}
              {hasChildren && (
                <span className="text-xs text-muted-foreground">{task.childTasks.length} 子任务</span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {task.assignee && <span className="flex items-center gap-1"><User className="size-3" />{task.assignee.name}</span>}
              {task.dueDate && <span className="flex items-center gap-1"><Calendar className="size-3" />{format(new Date(task.dueDate), "MM/dd", { locale: zhCN })}</span>}
            </div>
          </div>
        </Card>

        {/* Subtasks */}
        {hasChildren && isExpanded && (
          <div className="ml-6 border-l-2 border-border pl-4 space-y-1 mt-1">
            {task.childTasks.map(child => (
              <Card key={child.id} className={cn(
                "flex items-center gap-2 p-2 text-sm transition-colors hover:bg-accent/50 overflow-hidden",
                child.status === "done" && "opacity-60",
              )}>
                <button
                  onClick={() => updateTaskStatus(child.id, child.status === "todo" ? "in_progress" : child.status === "in_progress" ? "done" : "todo")}
                  className={STATUS_CONFIG[child.status].color}
                >
                  {(() => { const SI = STATUS_CONFIG[child.status].icon; return <SI className="size-4" />; })()}
                </button>
                <span className={cn("flex-1 break-words", child.status === "done" && "line-through")}>{child.title}</span>
                {(child.taskTags || []).map(tt => (
                  <Badge key={tt.tag.id} variant="secondary" className="text-[10px] px-1 py-0">{tt.tag.name}</Badge>
                ))}
                {child.assignee && <span className="text-xs text-muted-foreground">{child.assignee.name}</span>}
                {isAdmin && (
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => deleteTask(child.id)}>
                    <X className="size-3 text-muted-foreground" />
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Board view rendering
  function renderBoard() {
    const columns = [
      { key: "todo", label: "待办", icon: Circle, color: "text-slate-400", bgHover: "hover:bg-slate-50 dark:hover:bg-slate-900/30" },
      { key: "in_progress", label: "进行中", icon: Clock, color: "text-blue-500", bgHover: "hover:bg-blue-50 dark:hover:bg-blue-900/20" },
      { key: "done", label: "已完成", icon: CheckCircle2, color: "text-green-500", bgHover: "hover:bg-green-50 dark:hover:bg-green-900/20" },
    ] as const;

    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {columns.map(col => {
          const ColIcon = col.icon;
          const colTasks = tasks.filter(t => t.status === col.key);
          return (
            <div key={col.key} className="space-y-2">
              <div className="flex items-center gap-2 py-2 font-medium text-sm">
                <ColIcon className={cn("size-4", col.color)} />
                {col.label}
                <Badge variant="secondary" className="ml-auto">{colTasks.length}</Badge>
              </div>
              <div className="space-y-2 min-h-[200px]">
                {colTasks.map(task => (
                  <Card key={task.id} className={cn("p-3 cursor-pointer overflow-hidden", col.bgHover, task.status === "done" && "opacity-60")}
                    onClick={() => router.push(`/lists/${listId}/tasks/${task.id}`)}>
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/lists/${listId}/tasks/${task.id}`} className={cn("text-sm font-medium break-words hover:underline", task.status === "done" && "line-through")}>{task.title}</Link>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <Badge variant="secondary" className={cn("text-[10px] px-1 py-0", PRIORITY_CONFIG[task.priority].color)}>
                        {PRIORITY_CONFIG[task.priority].label}
                      </Badge>
                      {(task.taskTags || []).map(tt => (
                        <Badge key={tt.tag.id} variant="secondary" className="text-[10px] px-1 py-0">{tt.tag.name}</Badge>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      {task.assignee && <span className="flex items-center gap-1"><User className="size-3" />{task.assignee.name}</span>}
                      {task.dueDate && <span className="flex items-center gap-1"><Calendar className="size-3" />{format(new Date(task.dueDate), "MM/dd", { locale: zhCN })}</span>}
                      {(task.childTasks || []).length > 0 && (
                        <span>{task.childTasks.length}/{task.childTasks.filter(c => c.status === "done").length} 子任务</span>
                      )}
                    </div>
                  </Card>
                ))}
                {colTasks.length === 0 && (
                  <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">暂无任务</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (authStatus === "loading" || loading) {
    return (
      <div><Navbar />
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-6 w-48 mb-8" />
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-lg mb-2" />)}
        </main>
      </div>
    );
  }

  if (!list) {
    return (
      <div><Navbar />
        <main className="container mx-auto px-4 py-8 text-center max-w-4xl">
          <p className="text-muted-foreground">清单不存在或无权访问</p>
          <Button variant="link" onClick={() => router.push("/dashboard")} className="mt-4">返回仪表盘</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")} className="mb-2 -ml-2 text-muted-foreground">
            <ArrowLeft className="size-4" />返回
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold break-words">{list.name}</h1>
              {list.description && (
                <div className="mt-1">
                  <p className={cn("text-muted-foreground break-words", !descExpanded && "line-clamp-1")}>
                    {list.description}
                  </p>
                  {list.description.length > 80 && (
                    <button
                      onClick={() => setDescExpanded(!descExpanded)}
                      className="text-xs text-primary hover:underline mt-0.5"
                    >
                      {descExpanded ? "收起" : "展开全部"}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setMemberDialogOpen(true)}>
                <Users className="size-4" />
                <span className="hidden sm:inline">{list._count.members} 成员</span>
              </Button>
              {isAdmin && (
                <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline"><UserPlus className="size-4" /><span className="hidden sm:inline">管理成员</span></Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>管理成员</DialogTitle>
                      <DialogDescription>添加或管理清单成员及权限</DialogDescription>
                    </DialogHeader>
                    <MemberManager listId={listId} members={list.members} onUpdate={fetchData} />
                  </DialogContent>
                </Dialog>
              )}
            </div>
            {currentRole === "creator" && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  if (!confirm("确定要删除此清单吗？所有任务和成员数据将被永久删除。")) return;
                  try {
                    await fetch(`/api/lists/${listId}`, { method: "DELETE" });
                    router.push("/dashboard");
                  } catch { alert("删除失败"); }
                }}
              >
                <Trash2 className="size-4" />删除清单
              </Button>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索任务..." className="pl-9"
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={statusFilter} onValueChange={v => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[110px]">
              <Filter className="size-3.5" />
              <span className="text-xs">{statusFilter ? STATUS_CONFIG[statusFilter as keyof typeof STATUS_CONFIG]?.label : "全部状态"}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="todo">待办</SelectItem>
              <SelectItem value="in_progress">进行中</SelectItem>
              <SelectItem value="done">已完成</SelectItem>
            </SelectContent>
          </Select>

          {tags.length > 0 && (
            <Select value={tagFilter} onValueChange={v => setTagFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-[100px]">
                <Tag className="size-3.5" />
                <span className="text-xs max-w-[55px] truncate inline-block">{tagFilter ? tags.find(t => t.id === tagFilter)?.name || "标签" : "标签"}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">标签</SelectItem>
                {tags.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button variant={myTasksOnly ? "default" : "outline"} size="sm" onClick={() => setMyTasksOnly(!myTasksOnly)}>
            <User className="size-3.5" />{myTasksOnly ? "我的" : "只看我的"}
          </Button>

          <ViewToggle isBoard={isBoardView} onToggle={() => setIsBoardView(!isBoardView)} />

          <select className="h-9 rounded-md border bg-background px-2 py-1 text-xs cursor-pointer text-foreground"
            value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="priority">按优先级</option>
            <option value="dueDate">按截止日期</option>
            <option value="createdAt">按创建时间</option>
          </select>

          <Button variant="ghost" size="icon" onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}>
            <ArrowUpDown className="size-4" />
          </Button>

          <Dialog open={newTaskOpen} onOpenChange={(open) => { setNewTaskOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="size-4" />新建任务</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{newParentId ? "添加子任务" : "创建任务"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={createTask} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">任务标题</Label>
                  <Input id="title" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="任务描述..." maxLength={60} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>优先级</Label>
                    <Select value={newPriority} onValueChange={v => setNewPriority(v as "high"|"medium"|"low")}>
                      <SelectTrigger><span>{PRIORITY_CONFIG[newPriority].label}</span></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">高</SelectItem>
                        <SelectItem value="medium">中</SelectItem>
                        <SelectItem value="low">低</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>截止日期</Label>
                    <Input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>负责人</Label>
                  <Select value={newAssigneeId} onValueChange={setNewAssigneeId}>
                    <SelectTrigger><span>{newAssigneeId ? "已选择" : "未指派（可选）"}</span></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">未指派</SelectItem>
                      {list.members.map(m => (
                        <SelectItem key={m.userId} value={m.userId}>{m.user.name} (@{m.user.username})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label>描述（可选）</Label>
                  <textarea
                    className="w-full min-h-[60px] rounded-md border bg-transparent px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                    value={newNotes}
                    onChange={e => setNewNotes(e.target.value)}
                    maxLength={5000}
                    placeholder="添加任务描述..."
                  />
                </div>

                {/* Tags input */}
                <div className="space-y-2">
                  <Label>标签</Label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {newTags.map(tag => (
                      <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                        {tag}
                        <button type="button" onClick={() => removeTagFromForm(tag)} className="hover:text-destructive"><X className="size-3" /></button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="输入标签名，回车添加" maxLength={30}
                      value={newTagInput}
                      onChange={e => setNewTagInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTagToForm(newTagInput); } }}
                    />
                    <Button type="button" variant="secondary" onClick={() => addTagToForm(newTagInput)}>添加</Button>
                  </div>
                </div>

                <Button type="submit" disabled={saving} className="w-full">
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {saving ? "创建中..." : (newParentId ? "添加子任务" : "创建任务")}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit Task Dialog */}
          <Dialog open={editTaskOpen} onOpenChange={(open) => { setEditTaskOpen(open); if (!open) setEditingTask(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>编辑任务</DialogTitle>
              </DialogHeader>
              {editingTask && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>标题</Label>
                    <Input value={editingTask.title} onChange={e => setEditingTask({ ...editingTask, title: e.target.value })} maxLength={60} required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>优先级</Label>
                      <Select value={editingTask.priority} onValueChange={v => setEditingTask({ ...editingTask, priority: v as "high"|"medium"|"low" })}>
                        <SelectTrigger><span>{PRIORITY_CONFIG[editingTask.priority].label}</span></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">高</SelectItem>
                          <SelectItem value="medium">中</SelectItem>
                          <SelectItem value="low">低</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>截止日期</Label>
                      <Input type="date" value={editingTask.dueDate ? editingTask.dueDate.substring(0, 10) : ""} onChange={e => setEditingTask({ ...editingTask, dueDate: e.target.value ? new Date(e.target.value).toISOString() : null })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>负责人</Label>
                    <Select value={editingTask.assigneeId || ""} onValueChange={v => setEditingTask({ ...editingTask, assigneeId: v || null })}>
                      <SelectTrigger><span>{editingTask.assigneeId ? "已选择" : "未指派"}</span></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">未指派</SelectItem>
                        {list.members.map(m => (
                          <SelectItem key={m.userId} value={m.userId}>{m.user.name} (@{m.user.username})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Edit tags */}
                  <div className="space-y-2">
                    <Label>标签</Label>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(editingTask.taskTags || []).map(tt => (
                        <Badge key={tt.tag.id} variant="secondary" className="gap-1 pr-1">
                          {tt.tag.name}
                          <button type="button" onClick={() => setEditingTask({ ...editingTask, taskTags: editingTask.taskTags.filter(t => t.tag.id !== tt.tag.id) })} className="hover:text-destructive"><X className="size-3" /></button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="输入标签名，回车添加" maxLength={30} value={editTagInput} onChange={e => setEditTagInput(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const name = editTagInput.trim(); if (name && !editingTask.taskTags.some(tt => tt.tag.name === name)) { setEditingTask({ ...editingTask, taskTags: [...editingTask.taskTags, { tag: { id: "", name, color: null } }] }); setEditTagInput(""); } } }} />
                      <Button type="button" variant="secondary" onClick={() => { const name = editTagInput.trim(); if (name && !editingTask.taskTags.some(tt => tt.tag.name === name)) { setEditingTask({ ...editingTask, taskTags: [...editingTask.taskTags, { tag: { id: "", name, color: null } }] }); setEditTagInput(""); } }}>添加</Button>
                    </div>
                  </div>
                  <Button disabled={saving} className="w-full" onClick={() => saveEditTask(new Event("submit") as unknown as React.FormEvent)}>
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    保存
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        {/* Content */}
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="size-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">还没有任务</p>
            <Button variant="link" onClick={() => setNewTaskOpen(true)} className="mt-2">创建第一个任务</Button>
          </div>
        ) : isBoardView ? (
          renderBoard()
        ) : (
          <div className="space-y-2">{tasks.map(renderTaskCard)}</div>
        )}
      </main>
    </div>
  );
}

// ===== View Toggle =====

function ViewToggle({ isBoard, onToggle }: { isBoard: boolean; onToggle: () => void }) {
  return (
    <Button variant="outline" size="icon" onClick={onToggle} title={isBoard ? "切换到列表视图" : "切换到看板视图"}>
      {isBoard ? <LayoutList className="size-4" /> : <Columns className="size-4" />}
    </Button>
  );
}

// ===== Member Manager =====

function MemberManager({ listId, members, onUpdate }: {
  listId: string;
  members: ListData["members"];
  onUpdate: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserBrief[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"admin"|"member">("member");
  const [error, setError] = useState("");

  async function searchUsers() {
    if (!searchQuery.trim()) return;
    setSearching(true); setError("");
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}&listId=${listId}`);
      if (res.ok) {
        const data: UserBrief[] = await res.json();
        // Filter out already existing members
        const existingIds = new Set(members.map(m => m.userId));
        const filtered = data.filter(u => !existingIds.has(u.id));
        setSearchResults(filtered);
        if (filtered.length === 0) setError("未找到用户或已是成员");
      }
    } catch { setError("搜索失败"); }
    finally { setSearching(false); }
  }

  async function addMember(user: UserBrief) {
    if (!user) return;
    setError("");
    try {
      const res = await fetch(`/api/lists/${listId}/members`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, role: selectedRole }),
      });
      if (res.ok) { setSearchQuery(""); setSearchResults([]); onUpdate(); }
      else { const d = await res.json(); setError(d.error || "添加失败"); }
    } catch { setError("添加失败"); }
  }

  async function removeMember(userId: string) {
    await fetch(`/api/lists/${listId}/members/${userId}`, { method: "DELETE" });
    onUpdate();
  }

  async function changeRole(userId: string, role: string) {
    await fetch(`/api/lists/${listId}/members/${userId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    onUpdate();
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">当前成员</Label>
        {members.map(m => (
          <div key={m.userId} className="flex items-center justify-between rounded-lg border p-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{m.user.name.slice(0,1).toUpperCase()}</AvatarFallback></Avatar>
              <div><p className="text-sm font-medium">{m.user.name}</p><p className="text-xs text-muted-foreground">@{m.user.username}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{ROLE_LABELS[m.role]}</Badge>
              {m.role !== "creator" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="size-3.5" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => changeRole(m.userId, "admin")}><Shield className="size-3.5" />设为管理者</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => changeRole(m.userId, "member")}><User className="size-3.5" />设为参与者</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => removeMember(m.userId)} className="text-destructive"><X className="size-3.5" />移除</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2 border-t pt-4">
        <Label className="text-xs text-muted-foreground">添加成员</Label>
        <div className="flex gap-2">
          <Input placeholder="搜索用户名、姓名或邮箱..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && searchUsers()} />
          <Select value={selectedRole} onValueChange={v => setSelectedRole(v as "admin"|"member")}>
            <SelectTrigger className="w-[90px]"><span>{selectedRole === "admin" ? "管理者" : "参与者"}</span></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">管理者</SelectItem>
              <SelectItem value="member">参与者</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={searchUsers} disabled={searching} variant="secondary">{searching ? <Loader2 className="size-4 animate-spin" /> : "搜索"}</Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {searchResults.map(user => (
          <div key={user.id} className="flex items-center justify-between rounded-lg border p-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{user.name.slice(0,1).toUpperCase()}</AvatarFallback></Avatar>
              <div><p className="text-sm font-medium">{user.name}</p><p className="text-xs text-muted-foreground">@{user.username} · {user.email}</p></div>
            </div>
            <Button size="sm" onClick={() => addMember(user)}><Plus className="size-3.5" />添加</Button>
          </div>
        ))}
      </div>
    </div>
  );
}

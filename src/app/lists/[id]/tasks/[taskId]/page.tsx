"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Navbar } from "@/components/navbar";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Circle, Clock, CheckCircle2, User, Calendar,
  Tag, Loader2, Trash2, ChevronRight, Plus, MoreHorizontal, X,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

type UserBrief = { id: string; name: string; username: string; avatarUrl: string | null };
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
  createdAt: string;
};

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

export default function TaskDetailPage() {
  const { data: session, status: authStatus } = useSession();
  const params = useParams();
  const router = useRouter();
  const listId = params.id as string;
  const taskId = params.taskId as string;

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPriority, setEditPriority] = useState<"high" | "medium" | "low">("medium");
  const [editDueDate, setEditDueDate] = useState("");
  const [editAssigneeId, setEditAssigneeId] = useState("");
  const [editStatus, setEditStatus] = useState<"todo" | "in_progress" | "done">("todo");
  const [saving, setSaving] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [members, setMembers] = useState<UserBrief[]>([]);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);

  async function fetchRole() {
    try {
      const res = await fetch(`/api/lists/${listId}`);
      if (res.ok) {
        const data = await res.json();
        setUserRole(data.currentUserRole);
      }
    } catch {}
  }

  async function fetchTask() {
    try {
      const res = await fetch(`/api/lists/${listId}/tasks/${taskId}`);
      if (res.ok) {
        const data = await res.json();
        setTask(data);
        setEditTitle(data.title);
        setEditNotes(data.notes || "");
        setEditPriority(data.priority);
        setEditDueDate(data.dueDate ? data.dueDate.substring(0, 10) : "");
        setEditAssigneeId(data.assigneeId || "");
        setEditStatus(data.status);
        setEditTags((data.taskTags || []).map((tt: TaskTag) => tt.tag.name));
      } else if (res.status === 404) {
        router.push(`/lists/${listId}`);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function fetchMembers() {
    try {
      const res = await fetch(`/api/lists/${listId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.map((m: { user: UserBrief }) => m.user));
      }
    } catch (e) { console.error(e); }
  }

  useEffect(() => {
    if (authStatus === "unauthenticated") { router.push("/login"); return; }
    if (authStatus === "authenticated") {
      fetchTask();
      fetchMembers();
      fetchRole();
    }
  }, [authStatus]);

  const isAdmin = userRole === "creator" || userRole === "admin";

  async function saveTask() {
    setSaving(true);
    try {
      const res = await fetch(`/api/lists/${listId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          notes: editNotes || null,
          priority: editPriority,
          status: editStatus,
          dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
          assigneeId: editAssigneeId || null,
          tagNames: editTags,
        }),
      });
      if (res.ok) {
        setEditing(false);
        fetchTask();
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function addSubtask() {
    if (!newSubtaskTitle.trim()) return;
    setAddingSubtask(true);
    try {
      await fetch(`/api/lists/${listId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newSubtaskTitle, parentTaskId: taskId }),
      });
      setNewSubtaskTitle("");
      fetchTask();
    } catch (e) { console.error(e); }
    finally { setAddingSubtask(false); }
  }

  async function updateSubtaskStatus(childId: string, status: string) {
    await fetch(`/api/lists/${listId}/tasks/${childId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchTask();
  }

  async function deleteSubtask(childId: string) {
    await fetch(`/api/lists/${listId}/tasks/${childId}`, { method: "DELETE" });
    fetchTask();
  }

  if (loading) {
    return (
      <div><Navbar /><main className="container mx-auto px-4 py-8 max-w-2xl">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-6 w-32 mb-8" />
        <Skeleton className="h-40 rounded-lg" />
      </main></div>
    );
  }

  if (!task) return null;

  const StatusIcon = STATUS_CONFIG[task.status].icon;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => router.push(`/lists/${listId}`)} className="mb-4 -ml-2 text-muted-foreground">
          <ArrowLeft className="size-4" />返回清单
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const next = task.status === "todo" ? "in_progress" : task.status === "in_progress" ? "done" : "todo";
                setEditStatus(next);
                fetch(`/api/lists/${listId}/tasks/${taskId}`, {
                  method: "PATCH", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ status: next }),
                }).then(fetchTask);
              }}
              className={STATUS_CONFIG[task.status].color}
            >
              <StatusIcon className="size-6" />
            </button>
            <div>
              {editing ? (
                <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} maxLength={60} className="text-xl font-bold" />
              ) : (
                <h1 className="text-xl font-bold break-words">{task.title}</h1>
              )}
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                <Badge variant="secondary" className={cn("text-xs", PRIORITY_CONFIG[task.priority].color)}>
                  {PRIORITY_CONFIG[task.priority].label}
                </Badge>
                <span>{STATUS_CONFIG[task.status].label}</span>
              </div>
            </div>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => editing ? saveTask() : setEditing(true)} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : (editing ? "保存" : "编辑")}
            </Button>
          )}
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground">负责人</Label>
            {editing ? (
              <Select value={editAssigneeId} onValueChange={setEditAssigneeId}>
                <SelectTrigger className="mt-1 h-8 text-sm"><span>{editAssigneeId ? "已选择" : "未指派"}</span></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">未指派</SelectItem>
                  {members.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="mt-1 flex items-center gap-1">{task.assignee ? <><User className="size-3.5" />{task.assignee.name}</> : "无"}</p>
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">截止日期</Label>
            {editing ? (
              <Input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} className="mt-1 h-8 text-sm" />
            ) : (
              <p className="mt-1 flex items-center gap-1">{task.dueDate ? <><Calendar className="size-3.5" />{format(new Date(task.dueDate), "yyyy-MM-dd", { locale: zhCN })}</> : "无"}</p>
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">优先级</Label>
            {editing ? (
              <Select value={editPriority} onValueChange={v => setEditPriority(v as "high"|"medium"|"low")}>
                <SelectTrigger className="mt-1 h-8 text-sm"><span>{PRIORITY_CONFIG[editPriority].label}</span></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">高</SelectItem>
                  <SelectItem value="medium">中</SelectItem>
                  <SelectItem value="low">低</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="mt-1">{PRIORITY_CONFIG[task.priority].label}</p>
            )}
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">状态</Label>
            {editing ? (
              <Select value={editStatus} onValueChange={v => setEditStatus(v as "todo"|"in_progress"|"done")}>
                <SelectTrigger className="mt-1 h-8 text-sm"><span>{STATUS_CONFIG[editStatus].label}</span></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">待办</SelectItem>
                  <SelectItem value="in_progress">进行中</SelectItem>
                  <SelectItem value="done">已完成</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="mt-1">{STATUS_CONFIG[task.status].label}</p>
            )}
          </div>
        </div>

        {/* Tags */}
        <div className="mb-6">
          <Label className="text-xs text-muted-foreground">标签</Label>
          {editing ? (
            <div className="mt-1 space-y-2">
              <div className="flex flex-wrap gap-1">
                {editTags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                    {tag}
                    <button onClick={() => setEditTags(editTags.filter(t => t !== tag))} className="hover:text-destructive"><X className="size-3" /></button>
                  </Badge>
                ))}
                {editTags.length === 0 && <span className="text-sm text-muted-foreground">无</span>}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="输入标签名，回车添加"
                  value={editTagInput}
                  onChange={e => setEditTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); const name = editTagInput.trim(); if (name && !editTags.includes(name)) { setEditTags([...editTags, name]); setEditTagInput(""); } } }}
                  maxLength={30}
                  className="h-8 text-sm"
                />
                <Button type="button" size="sm" variant="secondary" onClick={() => { const name = editTagInput.trim(); if (name && !editTags.includes(name)) { setEditTags([...editTags, name]); setEditTagInput(""); } }}>添加</Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1 mt-1">
              {(task.taskTags || []).length > 0 ? task.taskTags.map(tt => (
                <Badge key={tt.tag.id} variant="secondary" className="text-xs">{tt.tag.name}</Badge>
              )) : <span className="text-sm text-muted-foreground">无</span>}
            </div>
          )}
        </div>

        {/* Description / Notes */}
        <div className="mb-6">
          <Label className="text-xs text-muted-foreground">描述</Label>
          {editing ? (
            <textarea
              className="mt-1 w-full min-h-[80px] rounded-md border bg-transparent px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              maxLength={5000}
              placeholder="添加任务描述..."
            />
          ) : (
            <p className="mt-1 text-sm whitespace-pre-wrap break-words">{task.notes || "无"}</p>
          )}
        </div>

        {/* Subtasks */}
        <div className="mb-6">
          <Label className="text-xs text-muted-foreground">子任务 ({task.childTasks?.length || 0})</Label>
          <div className="mt-2 space-y-1">
            {task.childTasks?.map(child => {
              const ChildIcon = STATUS_CONFIG[child.status].icon;
              return (
                <div key={child.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                  <button onClick={() => updateSubtaskStatus(child.id, child.status === "todo" ? "in_progress" : child.status === "in_progress" ? "done" : "todo")} className={STATUS_CONFIG[child.status].color}>
                    <ChildIcon className="size-4" />
                  </button>
                  <span className={cn("flex-1 break-words", child.status === "done" && "line-through")}>{child.title}</span>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteSubtask(child.id)}>
                      <X className="size-3 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              );
            })}
            {(!task.childTasks || task.childTasks.length === 0) && (
              <p className="text-sm text-muted-foreground">无</p>
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <Input
              placeholder="添加子任务..."
              value={newSubtaskTitle}
              onChange={e => setNewSubtaskTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") addSubtask(); }}
              maxLength={60}
              className="h-8 text-sm"
            />
            <Button size="sm" variant="secondary" onClick={addSubtask} disabled={addingSubtask}>
              {addingSubtask ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
            </Button>
          </div>
        </div>

        {/* Delete */}
        {isAdmin && (
        <div className="border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            onClick={async () => {
              if (!confirm("确定删除此任务？")) return;
              await fetch(`/api/lists/${listId}/tasks/${taskId}`, { method: "DELETE" });
              router.push(`/lists/${listId}`);
            }}
          >
            <Trash2 className="size-4" />删除任务
          </Button>
        </div>
        )}
      </main>
    </div>
  );
}

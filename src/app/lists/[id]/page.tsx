"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Navbar } from "@/components/navbar";
import { cn } from "@/lib/utils";
import { ROLE_LABELS, type Role, type MemberInfo } from "@/lib/permissions";
import {
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  MoreHorizontal,
  Trash2,
  UserPlus,
  Users,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  ChevronDown,
  User,
  X,
  Shield,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

type UserBrief = {
  id: string;
  name: string;
  username: string;
  email: string;
  avatarUrl: string | null;
};

type Task = {
  id: string;
  title: string;
  notes: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "high" | "medium" | "low";
  dueDate: string | null;
  listId: string;
  assigneeId: string | null;
  assignee: UserBrief | null;
  createdAt: string;
  updatedAt: string;
};

type ListData = {
  id: string;
  name: string;
  description: string | null;
  _count: { tasks: number; members: number };
  members: {
    role: Role;
    userId: string;
    user: UserBrief;
  }[];
  currentUserRole: Role;
};

const STATUS_CONFIG = {
  todo: { label: "待办", icon: Circle, color: "text-slate-400" },
  in_progress: { label: "进行中", icon: Clock, color: "text-blue-500" },
  done: { label: "已完成", icon: CheckCircle2, color: "text-green-500" },
};

const PRIORITY_CONFIG = {
  high: { label: "高", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  medium: { label: "中", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  low: { label: "低", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
};

export default function ListDetailPage() {
  const { data: session, status: authStatus } = useSession();
  const params = useParams();
  const router = useRouter();
  const listId = params.id as string;

  const [list, setList] = useState<ListData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [myTasksOnly, setMyTasksOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("priority");
  const [sortOrder, setSortOrder] = useState("desc");

  // Dialogs
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);

  // New task form
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"high" | "medium" | "low">("medium");
  const [newDueDate, setNewDueDate] = useState("");
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [saving, setSaving] = useState(false);

  const currentRole = list?.currentUserRole;

  const fetchData = useCallback(async () => {
    try {
      const [listRes, tasksRes] = await Promise.all([
        fetch(`/api/lists/${listId}`),
        fetch(
          `/api/lists/${listId}/tasks?status=${statusFilter}&myTasks=${myTasksOnly}&search=${search}&sortBy=${sortBy}&sortOrder=${sortOrder}`,
        ),
      ]);

      if (listRes.ok) setList(await listRes.json());
      if (tasksRes.ok) setTasks(await tasksRes.json());
      else if (tasksRes.status === 403) router.push("/dashboard");
    } catch (err) {
      console.error("Fetch error", err);
    } finally {
      setLoading(false);
    }
  }, [listId, statusFilter, myTasksOnly, search, sortBy, sortOrder, router]);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (authStatus === "unauthenticated") {
      router.push("/login");
      return;
    }
    fetchData();
  }, [authStatus, fetchData, router]);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/lists/${listId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          priority: newPriority,
          dueDate: newDueDate || null,
          assigneeId: newAssigneeId || null,
        }),
      });

      if (res.ok) {
        setNewTaskOpen(false);
        setNewTitle("");
        setNewPriority("medium");
        setNewDueDate("");
        setNewAssigneeId("");
        fetchData();
      }
    } catch (err) {
      console.error("Create task error", err);
    } finally {
      setSaving(false);
    }
  }

  async function updateTaskStatus(taskId: string, status: "todo" | "in_progress" | "done") {
    try {
      await fetch(`/api/lists/${listId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchData();
    } catch (err) {
      console.error("Update task error", err);
    }
  }

  async function deleteTask(taskId: string) {
    try {
      await fetch(`/api/lists/${listId}/tasks/${taskId}`, { method: "DELETE" });
      fetchData();
    } catch (err) {
      console.error("Delete task error", err);
    }
  }

  async function updateTaskField(taskId: string, field: string, value: string) {
    try {
      await fetch(`/api/lists/${listId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      fetchData();
    } catch (err) {
      console.error("Update task error", err);
    }
  }

  const isAdmin = currentRole === "creator" || currentRole === "admin";

  if (authStatus === "loading" || loading) {
    return (
      <div>
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-6 w-48 mb-8" />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg mb-2" />
          ))}
        </main>
      </div>
    );
  }

  if (!list) {
    return (
      <div>
        <Navbar />
        <main className="container mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground">清单不存在或无权访问</p>
          <Button variant="link" onClick={() => router.push("/dashboard")} className="mt-4">
            返回仪表盘
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard")}
            className="mb-2 -ml-2 text-muted-foreground"
          >
            <ArrowLeft className="size-4" />
            返回
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">{list.name}</h1>
              {list.description && (
                <p className="text-muted-foreground mt-1">{list.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMemberDialogOpen(true)}
              >
                <Users className="size-4" />
                <span className="hidden sm:inline">
                  {list._count.members} 成员
                </span>
              </Button>
              {isAdmin && (
                <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <UserPlus className="size-4" />
                      <span className="hidden sm:inline">管理成员</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>管理成员</DialogTitle>
                      <DialogDescription>
                        添加或管理清单成员及权限
                      </DialogDescription>
                    </DialogHeader>
                    <MemberManager
                      listId={listId}
                      members={list.members}
                      onUpdate={fetchData}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索任务..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[120px]">
              <Filter className="size-3.5" />
              <span>{statusFilter ? STATUS_CONFIG[statusFilter as keyof typeof STATUS_CONFIG]?.label : "全部状态"}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="todo">待办</SelectItem>
              <SelectItem value="in_progress">进行中</SelectItem>
              <SelectItem value="done">已完成</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={myTasksOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setMyTasksOnly(!myTasksOnly)}
          >
            <User className="size-3.5" />
            {myTasksOnly ? "我的" : "只看我的"}
          </Button>

          <select
            className="h-9 rounded-md border bg-transparent px-3 py-1 text-sm cursor-pointer"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="priority">按优先级</option>
            <option value="dueDate">按截止日期</option>
            <option value="createdAt">按创建时间</option>
          </select>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          >
            <ArrowUpDown className="size-4" />
          </Button>

          <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                新建任务
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建任务</DialogTitle>
              </DialogHeader>
              <form onSubmit={createTask} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">任务标题</Label>
                  <Input
                    id="title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="任务描述..."
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>优先级</Label>
                    <Select value={newPriority} onValueChange={(v) => setNewPriority(v as "high" | "medium" | "low")}>
                      <SelectTrigger>
                        <span>{PRIORITY_CONFIG[newPriority].label}</span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">高</SelectItem>
                        <SelectItem value="medium">中</SelectItem>
                        <SelectItem value="low">低</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>截止日期</Label>
                    <Input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>负责人</Label>
                  <Select value={newAssigneeId} onValueChange={setNewAssigneeId}>
                    <SelectTrigger>
                      <span>{newAssigneeId ? "已选择" : "未指派（可选）"}</span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">未指派</SelectItem>
                      {list.members.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.user.name} (@{m.user.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" disabled={saving} className="w-full">
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {saving ? "创建中..." : "创建任务"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Task List */}
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="size-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">还没有任务</p>
            <Button variant="link" onClick={() => setNewTaskOpen(true)} className="mt-2">
              创建第一个任务
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => {
              const StatusIcon = STATUS_CONFIG[task.status].icon;
              return (
                <Card
                  key={task.id}
                  className={cn(
                    "flex items-center gap-3 p-4 transition-colors hover:bg-accent/50",
                    task.status === "done" && "opacity-60",
                  )}
                >
                  {/* Status toggle */}
                  <button
                    onClick={() =>
                      updateTaskStatus(
                        task.id,
                        task.status === "todo"
                          ? "in_progress"
                          : task.status === "in_progress"
                            ? "done"
                            : "todo",
                      )
                    }
                    className={STATUS_CONFIG[task.status].color}
                  >
                    <StatusIcon className="size-5" />
                  </button>

                  {/* Title + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "font-medium truncate",
                          task.status === "done" && "line-through",
                        )}
                      >
                        {task.title}
                      </span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          PRIORITY_CONFIG[task.priority].color,
                        )}
                      >
                        {PRIORITY_CONFIG[task.priority].label}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {task.assignee && (
                        <span className="flex items-center gap-1">
                          <User className="size-3" />
                          {task.assignee.name}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {format(new Date(task.dueDate), "MM/dd", { locale: zhCN })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {isAdmin && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => deleteTask(task.id)} className="text-destructive">
                          <Trash2 className="size-4" />
                          删除任务
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

// ====== Member Manager Component ======

function MemberManager({
  listId,
  members,
  onUpdate,
}: {
  listId: string;
  members: ListData["members"];
  onUpdate: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserBrief[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"admin" | "member">("member");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  async function searchUsers() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError("");
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
        if (data.length === 0) setError("未找到用户");
      }
    } catch {
      setError("搜索失败");
    } finally {
      setSearching(false);
    }
  }

  async function addMember(userId: string) {
    setAdding(true);
    setError("");
    try {
      const res = await fetch(`/api/lists/${listId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, role: selectedRole }),
      });

      if (res.ok) {
        setSearchQuery("");
        setSearchResults([]);
        onUpdate();
      } else {
        const data = await res.json();
        setError(data.error || "添加失败");
      }
    } catch {
      setError("添加失败");
    } finally {
      setAdding(false);
    }
  }

  async function removeMember(userId: string) {
    try {
      await fetch(`/api/lists/${listId}/members/${userId}`, { method: "DELETE" });
      onUpdate();
    } catch {
      console.error("Remove error");
    }
  }

  async function changeRole(userId: string, role: string) {
    try {
      await fetch(`/api/lists/${listId}/members/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      onUpdate();
    } catch {
      console.error("Role update error");
    }
  }

  return (
    <div className="space-y-4">
      {/* Current members */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">当前成员</Label>
        {members.map((m) => (
          <div
            key={m.userId}
            className="flex items-center justify-between rounded-lg border p-2"
          >
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">
                  {m.user.name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{m.user.name}</p>
                <p className="text-xs text-muted-foreground">@{m.user.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {ROLE_LABELS[m.role]}
              </Badge>
              {m.role !== "creator" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      <MoreHorizontal className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => changeRole(m.userId, "admin")}>
                      <Shield className="size-3.5" />
                      设为管理者
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => changeRole(m.userId, "member")}>
                      <User className="size-3.5" />
                      设为参与者
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => removeMember(m.userId)}
                      className="text-destructive"
                    >
                      <X className="size-3.5" />
                      移除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add member */}
      <div className="space-y-2 border-t pt-4">
        <Label className="text-xs text-muted-foreground">添加成员</Label>
        <div className="flex gap-2">
          <Input
            placeholder="搜索用户名、姓名或邮箱..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchUsers()}
          />
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as "admin" | "member")}>
            <SelectTrigger className="w-[90px]">
              <span>{selectedRole === "admin" ? "管理者" : "参与者"}</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">管理者</SelectItem>
              <SelectItem value="member">参与者</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={searchUsers} disabled={searching} variant="secondary">
            {searching ? <Loader2 className="size-4 animate-spin" /> : "搜索"}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {searchResults.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between rounded-lg border p-2"
          >
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs">
                  {user.name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">
                  @{user.username} · {user.email}
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => addMember(user.id)} disabled={adding}>
              <Plus className="size-3.5" />
              添加
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

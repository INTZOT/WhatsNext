"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Navbar } from "@/components/navbar";
import { Plus, Users, CheckSquare, Loader2 } from "lucide-react";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

type ListItem = {
  id: string;
  name: string;
  description: string | null;
  _count: { tasks: number; members: number };
  createdAt: string;
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [lists, setLists] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinId, setJoinId] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }
    fetchLists();
  }, [status, router]);

  async function fetchLists() {
    try {
      const res = await fetch("/api/lists");
      if (res.ok) {
        const data = await res.json();
        setLists(data);
      }
    } catch (err) {
      console.error("Failed to fetch lists", err);
    } finally {
      setLoading(false);
    }
  }

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, description: newDesc || undefined }),
      });

      if (res.ok) {
        const list = await res.json();
        setLists((prev) => [list, ...prev]);
        setDialogOpen(false);
        setNewName("");
        setNewDesc("");
        router.push(`/lists/${list.id}`);
      }
    } catch (err) {
      console.error("Failed to create list", err);
    } finally {
      setCreating(false);
    }
  }

  async function joinList(e: React.FormEvent) {
    e.preventDefault();
    if (!joinId.trim()) return;
    setJoining(true);
    setJoinError("");
    try {
      const res = await fetch("/api/lists/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listId: joinId.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setJoinOpen(false);
        setJoinId("");
        fetchLists();
      } else {
        setJoinError(data.error || "加入失败");
      }
    } catch {
      setJoinError("加入失败，请稍后重试");
    } finally {
      setJoining(false);
    }
  }

  if (status === "loading") {
    return (
      <div>
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold"></h1>
            <p className="text-muted-foreground mt-1">
              欢迎回来，{session?.user?.name}
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" />
                新建清单
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建新清单</DialogTitle>
                <DialogDescription>
                  创建一个新的团队待办清单，你将自动成为创建者
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={createList} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">清单名称</Label>
                  <Input
                    id="name"
                    placeholder="例如：Q3 研发计划"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={50}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">描述（可选）</Label>
                  <Input
                    id="desc"
                    placeholder="简要说明清单的用途"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    maxLength={1000}
                  />
                </div>
                <Button type="submit" disabled={creating} className="w-full">
                  {creating && <Loader2 className="size-4 animate-spin" />}
                  {creating ? "创建中..." : "创建清单"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="size-4" />
                加入清单
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>加入清单</DialogTitle>
                <DialogDescription>
                  输入清单 ID 即可直接加入为参与者
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={joinList} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="listId">清单 ID</Label>
                  <Input
                    id="listId"
                    placeholder="粘贴清单 ID"
                    value={joinId}
                    onChange={(e) => setJoinId(e.target.value)}
                    required
                  />
                </div>
                {joinError && (
                  <p className="text-sm text-destructive">{joinError}</p>
                )}
                <Button type="submit" disabled={joining} className="w-full">
                  {joining && <Loader2 className="size-4 animate-spin" />}
                  {joining ? "加入中..." : "加入"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : lists.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckSquare className="size-16 text-muted-foreground/30 mb-4" />
            <h2 className="text-xl font-semibold mb-2">还没有清单</h2>
            <p className="text-muted-foreground mb-6 max-w-sm">
              创建你的第一个团队待办清单，开始高效协作
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              新建清单
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((list) => (
              <Link key={list.id} href={`/lists/${list.id}`}>
                <Card className="h-full cursor-pointer transition-shadow hover:shadow-md overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-lg break-words">{list.name}</CardTitle>
                    {list.description && (
                      <CardDescription className="line-clamp-2 break-words">
                        {list.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CheckSquare className="size-3.5" />
                        {list._count.tasks} 任务
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="size-3.5" />
                        {list._count.members} 成员
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

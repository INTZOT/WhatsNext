import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTaskSchema, taskQuerySchema } from "@/lib/validations";
import { getMemberInfo } from "@/lib/permissions";
import { Prisma } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id } = await params;
    const member = await getMemberInfo(id, session.user.id);
    if (!member) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const url = new URL(req.url);
    const query = taskQuerySchema.parse({
      status: url.searchParams.get("status") || undefined,
      priority: url.searchParams.get("priority") || undefined,
      myTasks: url.searchParams.get("myTasks") || undefined,
      search: url.searchParams.get("search") || undefined,
      sortBy: url.searchParams.get("sortBy") || "priority",
      sortOrder: url.searchParams.get("sortOrder") || "desc",
    });

    const where: Prisma.TaskWhereInput = { listId: id };

    if (query.status) {
      where.status = query.status;
    }
    if (query.priority) {
      where.priority = query.priority;
    }
    if (query.myTasks === "true") {
      where.assigneeId = session.user.id;
    }
    if (query.search) {
      where.title = { contains: query.search, mode: "insensitive" };
    }

    // Sort mapping
    const orderBy: Prisma.TaskOrderByWithRelationInput[] = [];
    const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };

    if (query.sortBy === "priority") {
      // We sort by priority field + dueDate as tiebreaker
      orderBy.push({ createdAt: query.sortOrder });
    } else if (query.sortBy === "dueDate") {
      orderBy.push({ dueDate: { sort: query.sortOrder, nulls: "last" } });
    } else {
      orderBy.push({ createdAt: query.sortOrder });
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy,
      include: {
        assignee: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });

    // Post-process priority sort (since Prisma can't sort by custom enum)
    if (query.sortBy === "priority") {
      const desc = query.sortOrder === "desc";
      tasks.sort((a, b) => {
        const diff = (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0);
        return desc ? -diff : diff;
      });
    }

    return NextResponse.json(tasks);
  } catch (error) {
    console.error("Get tasks error:", error);
    return NextResponse.json({ error: "获取任务失败" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id } = await params;
    const member = await getMemberInfo(id, session.user.id);
    if (!member) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "输入验证失败", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const task = await prisma.task.create({
      data: {
        title: parsed.data.title,
        notes: parsed.data.notes,
        status: parsed.data.status,
        priority: parsed.data.priority,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        listId: id,
        assigneeId: parsed.data.assigneeId || null,
      },
      include: {
        assignee: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Create task error:", error);
    return NextResponse.json({ error: "创建任务失败" }, { status: 500 });
  }
}

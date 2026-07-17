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
      tagId: url.searchParams.get("tagId") || undefined,
      myTasks: url.searchParams.get("myTasks") || undefined,
      search: url.searchParams.get("search") || undefined,
      sortBy: url.searchParams.get("sortBy") || "priority",
      sortOrder: url.searchParams.get("sortOrder") || "desc",
    });

    // Only return top-level tasks (no parentTaskId)
    const where: Prisma.TaskWhereInput = {
      listId: id,
      parentTaskId: null,
    };

    if (query.status) {
      where.status = query.status;
    }
    if (query.priority) {
      where.priority = query.priority;
    }
    if (query.tagId) {
      where.taskTags = { some: { tagId: query.tagId } };
    }
    if (query.myTasks === "true") {
      where.assigneeId = session.user.id;
    }
    if (query.search) {
      where.title = { contains: query.search, mode: "insensitive" };
    }

    const orderBy: Prisma.TaskOrderByWithRelationInput[] = [];
    const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };

    if (query.sortBy === "priority") {
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
        childTasks: {
          include: {
            assignee: {
              select: { id: true, name: true, username: true, avatarUrl: true },
            },
            taskTags: {
              include: {
                tag: { select: { id: true, name: true, color: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        taskTags: {
          include: {
            tag: { select: { id: true, name: true, color: true } },
          },
        },
      },
    });

    // Post-process priority sort
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

    // Handle tags: find or create
    const tagNames = parsed.data.tagNames || [];
    const tagConnections = await Promise.all(
      tagNames.map(async (name) => {
        const tag = await prisma.tag.upsert({
          where: { name_listId: { name, listId: id } },
          update: {},
          create: { name, listId: id },
        });
        return { tagId: tag.id };
      }),
    );

    const task = await prisma.task.create({
      data: {
        title: parsed.data.title,
        notes: parsed.data.notes,
        status: parsed.data.status,
        priority: parsed.data.priority,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        listId: id,
        assigneeId: parsed.data.assigneeId || null,
        parentTaskId: parsed.data.parentTaskId || null,
        taskTags: {
          create: tagConnections,
        },
      },
      include: {
        assignee: {
          select: { id: true, name: true, username: true, avatarUrl: true },
        },
        childTasks: {
          include: {
            assignee: {
              select: { id: true, name: true, username: true, avatarUrl: true },
            },
            taskTags: {
              include: { tag: { select: { id: true, name: true, color: true } } },
            },
          },
        },
        taskTags: {
          include: { tag: { select: { id: true, name: true, color: true } } },
        },
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Create task error:", error);
    return NextResponse.json({ error: "创建任务失败" }, { status: 500 });
  }
}

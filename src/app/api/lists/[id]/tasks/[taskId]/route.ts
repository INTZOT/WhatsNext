import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateTaskSchema } from "@/lib/validations";
import {
  getMemberInfo,
  canModifyTask,
  canDeleteTask,
  canAssignTask,
} from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id, taskId } = await params;
    const member = await getMemberInfo(id, session.user.id);
    if (!member) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: { select: { id: true, name: true, username: true, avatarUrl: true } },
        childTasks: {
          include: {
            assignee: { select: { id: true, name: true, username: true, avatarUrl: true } },
            taskTags: { include: { tag: { select: { id: true, name: true, color: true } } } },
          },
          orderBy: { createdAt: "asc" },
        },
        taskTags: { include: { tag: { select: { id: true, name: true, color: true } } } },
      },
    });

    if (!task || task.listId !== id) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Get task error:", error);
    return NextResponse.json({ error: "获取任务失败" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id, taskId } = await params;
    const member = await getMemberInfo(id, session.user.id);
    if (!member) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: { childTasks: { select: { id: true } } },
    });

    if (!existingTask || existingTask.listId !== id) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    if (!canModifyTask(member, existingTask.assigneeId)) {
      return NextResponse.json({ error: "无权限修改此任务" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "输入验证失败", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
    if (parsed.data.priority !== undefined) updateData.priority = parsed.data.priority;
    if (parsed.data.dueDate !== undefined) {
      updateData.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
    }
    if (parsed.data.assigneeId !== undefined) {
      if (!canAssignTask(member) && parsed.data.assigneeId !== existingTask.assigneeId) {
        return NextResponse.json(
          { error: "只有管理者可以指派任务" },
          { status: 403 },
        );
      }
      // Validate new assignee is a list member
      if (parsed.data.assigneeId && parsed.data.assigneeId !== existingTask.assigneeId) {
        const isMember = await prisma.listMember.findUnique({
          where: { userId_listId: { userId: parsed.data.assigneeId, listId: id } },
        });
        if (!isMember) {
          return NextResponse.json({ error: "负责人不在清单成员中" }, { status: 400 });
        }
      }
      updateData.assigneeId = parsed.data.assigneeId;
    }

    // Handle tags
    if (parsed.data.tagNames !== undefined) {
      const tagNames = parsed.data.tagNames.map(n => n.trim()).filter(Boolean);
      // Delete existing tag connections
      await prisma.taskTag.deleteMany({ where: { taskId } });
      // Find or create tags and connect
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
      await prisma.taskTag.createMany({
        data: tagConnections.map((t) => ({ taskId, tagId: t.tagId })),
      });
    }

    // Cascade completion: mark all subtasks as done
    const cascadeDone =
      parsed.data.status === "done" &&
      existingTask.childTasks.length > 0;

    if (cascadeDone) {
      await prisma.task.updateMany({
        where: { parentTaskId: taskId, status: { not: "done" } },
        data: { status: "done" },
      });
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
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
          orderBy: { createdAt: "asc" },
        },
        taskTags: {
          include: { tag: { select: { id: true, name: true, color: true } } },
        },
      },
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("Update task error:", error);
    return NextResponse.json({ error: "更新任务失败" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id, taskId } = await params;
    const member = await getMemberInfo(id, session.user.id);
    if (!canDeleteTask(member)) {
      return NextResponse.json({ error: "无权限删除任务" }, { status: 403 });
    }

    const existingTask = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!existingTask || existingTask.listId !== id) {
      return NextResponse.json({ error: "任务不存在" }, { status: 404 });
    }

    // Cascading delete handled by Prisma (childTasks and taskTags are cascade: delete)
    await prisma.task.delete({ where: { id: taskId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete task error:", error);
    return NextResponse.json({ error: "删除任务失败" }, { status: 500 });
  }
}

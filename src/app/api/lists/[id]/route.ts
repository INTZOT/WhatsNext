import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateListSchema } from "@/lib/validations";
import { getMemberInfo, canManageList, canDeleteList } from "@/lib/permissions";

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
      return NextResponse.json({ error: "无权限访问" }, { status: 403 });
    }

    const list = await prisma.todoList.findUnique({
      where: { id },
      include: {
        _count: { select: { tasks: true, members: true } },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                username: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    if (!list) {
      return NextResponse.json({ error: "清单不存在" }, { status: 404 });
    }

    return NextResponse.json({ ...list, currentUserRole: member.role });
  } catch (error) {
    console.error("Get list error:", error);
    return NextResponse.json({ error: "获取清单失败" }, { status: 500 });
  }
}

export async function PATCH(
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
    if (!canManageList(member)) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateListSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "输入验证失败", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const list = await prisma.todoList.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(list);
  } catch (error) {
    console.error("Update list error:", error);
    return NextResponse.json({ error: "更新清单失败" }, { status: 500 });
  }
}

export async function DELETE(
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
    if (!canDeleteList(member)) {
      return NextResponse.json({ error: "只有创建者可以删除清单" }, { status: 403 });
    }

    await prisma.todoList.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete list error:", error);
    return NextResponse.json({ error: "删除清单失败" }, { status: 500 });
  }
}

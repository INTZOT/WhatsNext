import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMemberInfo, canManageMembers, canChangeRole } from "@/lib/permissions";
import { updateMemberRoleSchema } from "@/lib/validations";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id, userId } = await params;
    const member = await getMemberInfo(id, session.user.id);
    if (!canChangeRole(member)) {
      return NextResponse.json({ error: "只有创建者可以修改成员角色" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateMemberRoleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "无效的角色" },
        { status: 400 },
      );
    }

    // Cannot change yourself
    if (userId === session.user.id) {
      return NextResponse.json({ error: "不能修改自己的角色" }, { status: 400 });
    }

    const updated = await prisma.listMember.update({
      where: { userId_listId: { userId, listId: id } },
      data: { role: parsed.data.role },
      include: {
        user: {
          select: {
            id: true, name: true, username: true, email: true, avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update member error:", error);
    return NextResponse.json({ error: "更新成员角色失败" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { id, userId } = await params;
    const member = await getMemberInfo(id, session.user.id);
    if (!canManageMembers(member)) {
      return NextResponse.json({ error: "无权限移除成员" }, { status: 403 });
    }

    // Cannot remove yourself
    if (userId === session.user.id) {
      return NextResponse.json({ error: "不能移除自己" }, { status: 400 });
    }

    await prisma.listMember.delete({
      where: { userId_listId: { userId, listId: id } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove member error:", error);
    return NextResponse.json({ error: "移除成员失败" }, { status: 500 });
  }
}

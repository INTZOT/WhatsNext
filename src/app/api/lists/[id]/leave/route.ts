import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMemberInfo } from "@/lib/permissions";

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
    if (!member) {
      return NextResponse.json({ error: "你不是该清单成员" }, { status: 403 });
    }

    // Creator cannot leave, must delete the list
    if (member.role === "creator") {
      return NextResponse.json(
        { error: "创建者不能退出清单，请删除清单" },
        { status: 400 },
      );
    }

    await prisma.listMember.delete({
      where: { userId_listId: { userId: session.user.id, listId: id } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Leave list error:", error);
    return NextResponse.json({ error: "退出清单失败" }, { status: 500 });
  }
}

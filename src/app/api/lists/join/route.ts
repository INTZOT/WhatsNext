import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { listId } = await req.json();

    if (!listId) {
      return NextResponse.json({ error: "清单 ID 不能为空" }, { status: 400 });
    }

    // Check list exists
    const list = await prisma.todoList.findUnique({ where: { id: listId } });
    if (!list) {
      return NextResponse.json({ error: "清单不存在" }, { status: 404 });
    }

    // Check if already a member
    const existing = await prisma.listMember.findUnique({
      where: { userId_listId: { userId: session.user.id, listId } },
    });
    if (existing) {
      return NextResponse.json({ error: "你已经是该清单的成员" }, { status: 409 });
    }

    await prisma.listMember.create({
      data: {
        userId: session.user.id,
        listId,
        role: "member",
      },
    });

    return NextResponse.json({ success: true, listId }, { status: 200 });
  } catch (error) {
    console.error("Join list error:", error);
    return NextResponse.json({ error: "加入清单失败" }, { status: 500 });
  }
}

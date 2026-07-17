import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addMemberSchema } from "@/lib/validations";
import { getMemberInfo, canManageMembers } from "@/lib/permissions";

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

    const members = await prisma.listMember.findMany({
      where: { listId: id },
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
      orderBy: { joinedAt: "asc" },
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error("Get members error:", error);
    return NextResponse.json({ error: "获取成员列表失败" }, { status: 500 });
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
    if (!canManageMembers(member)) {
      return NextResponse.json({ error: "无权限添加成员" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = addMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "输入验证失败", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Find user by query (username, name, or email)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { contains: parsed.data.query } },
          { name: { contains: parsed.data.query } },
          { email: { contains: parsed.data.query } },
        ],
      },
      select: { id: true, name: true, username: true, email: true, avatarUrl: true },
    });

    if (!user) {
      return NextResponse.json({ error: "未找到用户" }, { status: 404 });
    }

    // Check if already a member
    const existing = await prisma.listMember.findUnique({
      where: { userId_listId: { userId: user.id, listId: id } },
    });

    if (existing) {
      return NextResponse.json({ error: "该用户已是清单成员" }, { status: 409 });
    }

    const newMember = await prisma.listMember.create({
      data: {
        userId: user.id,
        listId: id,
        role: parsed.data.role,
      },
      include: {
        user: {
          select: { id: true, name: true, username: true, email: true, avatarUrl: true },
        },
      },
    });

    return NextResponse.json(newMember, { status: 201 });
  } catch (error) {
    console.error("Add member error:", error);
    return NextResponse.json({ error: "添加成员失败" }, { status: 500 });
  }
}

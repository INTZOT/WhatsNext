import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTagSchema } from "@/lib/validations";
import { getMemberInfo } from "@/lib/permissions";

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

    const tags = await prisma.tag.findMany({
      where: { listId: id },
      include: { _count: { select: { taskTags: true } } },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(tags);
  } catch (error) {
    console.error("Get tags error:", error);
    return NextResponse.json({ error: "获取标签失败" }, { status: 500 });
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
    const parsed = createTagSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "输入验证失败", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const tag = await prisma.tag.upsert({
      where: { name_listId: { name: parsed.data.name, listId: id } },
      update: {},
      create: { name: parsed.data.name, listId: id, color: parsed.data.color },
    });

    return NextResponse.json(tag, { status: 201 });
  } catch (error) {
    console.error("Create tag error:", error);
    return NextResponse.json({ error: "创建标签失败" }, { status: 500 });
  }
}

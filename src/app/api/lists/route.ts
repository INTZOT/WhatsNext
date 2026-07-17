import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createListSchema } from "@/lib/validations";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const lists = await prisma.todoList.findMany({
      where: {
        members: {
          some: { userId: session.user.id },
        },
      },
      include: {
        _count: {
          select: {
            tasks: true,
            members: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(lists);
  } catch (error) {
    console.error("Get lists error:", error);
    return NextResponse.json({ error: "获取清单失败" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createListSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "输入验证失败", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const list = await prisma.todoList.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        members: {
          create: {
            userId: session.user.id,
            role: "creator",
          },
        },
      },
      include: {
        _count: { select: { tasks: true, members: true } },
      },
    });

    return NextResponse.json(list, { status: 201 });
  } catch (error) {
    console.error("Create list error:", error);
    return NextResponse.json({ error: "创建清单失败" }, { status: 500 });
  }
}

import { z } from "zod";

// ============ 用户验证 ============

export const registerSchema = z.object({
  name: z.string().min(1, "姓名不能为空").max(100),
  username: z
    .string()
    .min(3, "用户名至少 3 个字符")
    .max(30, "用户名最多 30 个字符")
    .regex(/^[a-zA-Z0-9_]+$/, "用户名只能包含字母、数字和下划线"),
  email: z.string().email("邮箱格式不正确"),
  password: z
    .string()
    .min(8, "密码至少 8 个字符")
    .max(100)
    .regex(/[A-Z]/, "密码需包含至少一个大写字母")
    .regex(/[0-9]/, "密码需包含至少一个数字"),
});

export const loginSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(1, "密码不能为空"),
});

// ============ 清单验证 ============

export const createListSchema = z.object({
  name: z.string().min(1, "清单名称不能为空").max(50),
  description: z.string().max(1000).optional(),
});

export const updateListSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).optional(),
});

// ============ 成员验证 ============

export const addMemberSchema = z.object({
  query: z.string().min(1, "搜索关键词不能为空").optional(),
  userId: z.string().optional(),
  role: z.enum(["admin", "member"]).default("member"),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(["admin", "member"]),
});

// ============ 任务验证 ============

export const createTaskSchema = z.object({
  title: z.string().min(1, "任务标题不能为空").max(60),
  notes: z.string().max(5000).optional(),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  parentTaskId: z.string().optional().nullable(),
  tagNames: z.array(z.string().max(30)).max(10).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(60).optional(),
  notes: z.string().max(5000).optional(),
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  tagNames: z.array(z.string().max(30)).max(10).optional(),
});

// ============ 排序/筛选 ============

export const taskQuerySchema = z.object({
  status: z.enum(["todo", "in_progress", "done"]).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  tagId: z.string().optional(),
  myTasks: z.enum(["true", "false"]).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["priority", "dueDate", "createdAt"]).default("priority"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const createTagSchema = z.object({
  name: z.string().min(1, "标签名不能为空").max(30).transform(v => v.trim()),
  color: z.string().optional(),
});

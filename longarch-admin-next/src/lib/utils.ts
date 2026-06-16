import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * cn — shadcn/ui 标配类名合并工具
 * ------------------------------------------------------------
 *  · clsx 处理条件类名 (支持对象 / 数组 / 假值过滤)
 *  · twMerge 合并冲突 Tailwind 类 (如 px-2 px-4 → px-4)
 * ============================================================ */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

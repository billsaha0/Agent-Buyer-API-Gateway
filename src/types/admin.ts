import { z } from "zod";
import type { AuditLog } from "@/generated/prisma/client";

export const CreateProductSchema = z.object({
  name: z.string().min(2),
  price: z.number().positive(), // in paise
  stock: z.number().int().min(0),
  category: z.string().min(2),
  description: z.string().min(10),
});

export const UpdateProductSchema = z.object({
  name: z.string().min(2).optional(),
  price: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  category: z.string().min(2).optional(),
  description: z.string().min(10).optional(),
});

export type AuditLogWithSession = Omit<AuditLog, "timestamp"> & {
  timestamp: Date | string;
  session: {
    agentName: string;
  };
};

export type LogStreamEvent =
  | { type: "ping" }
  | { type: "logs"; data: AuditLogWithSession[] };
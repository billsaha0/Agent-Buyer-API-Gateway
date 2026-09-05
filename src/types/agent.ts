import { z } from "zod";

export const SearchRequestSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  query: z.string().min(2, "Search query must be at least 2 characters"),
  maxPrice: z.number().positive().optional(), // In paise
  limit: z.number().int().min(1).max(20).default(5),
});

export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export interface SearchResultProduct {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  description: string;
  similarityScore: number;
}

export const CheckoutRequestSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  productId: z.uuid("Invalid product ID format"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  idempotencyKey: z.uuid("Idempotency key must be a valid UUID"),
});

export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;
import { z } from "zod";

export const collectionFormSchema = z.object({
  name: z.string().trim().min(2, "Give the collection a name").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens")
    .max(60)
    .optional()
    .or(z.literal("")),
  description: z.string().trim().max(500),
});
export type CollectionFormValues = z.infer<typeof collectionFormSchema>;

export interface CollectionDTO {
  id: string;
  name: string;
  slug: string;
  description?: string;
  type: "manual" | "smart";
  propertyIds: string[];
  propertyCount: number;
  coverImage?: string;
  views: number;
  createdAt: string;
  updatedAt: string;
}

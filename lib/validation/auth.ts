import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required").min(8, "Password must be at least 8 characters"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const passwordRule = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use at most 72 characters")
  .regex(/[a-zA-Z]/, "Include at least one letter")
  .regex(/\d/, "Include at least one number");

export const whatsappNumberSchema = z
  .string()
  .trim()
  .min(1, "WhatsApp number is required")
  .refine((value) => normalizePhone(value) !== null, "Enter a valid mobile number with country code, e.g. +91 98765 43210");

export const brokerProfileFields = {
  businessName: z.string().trim().min(2, "Business name is required").max(120),
  whatsappNumber: whatsappNumberSchema,
  city: z.string().trim().min(2, "City is required").max(60),
};

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Full name is required").max(120),
    ...brokerProfileFields,
    email: z.string().trim().min(1, "Email is required").email("Enter a valid email address"),
    password: passwordRule,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match",
  });
export type RegisterInput = z.infer<typeof registerSchema>;

/** Google sign-ups complete their broker profile on /onboarding. */
export const onboardingSchema = z.object(brokerProfileFields);
export type OnboardingInput = z.infer<typeof onboardingSchema>;

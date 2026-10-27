import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);
// bcrypt processes at most 72 bytes; reject longer input instead of truncating it.
export const passwordSchema = z.string().min(12, "Use at least 12 characters.").refine(
  (value) => new TextEncoder().encode(value).length <= 72,
  "Password must be at most 72 bytes (use fewer characters).",
);
export const loginSchema = z.object({ email: emailSchema, password: passwordSchema });
export const registrationSchema = loginSchema.extend({
  name: z.string().trim().min(2, "Enter your name (at least 2 characters).").max(80),
  confirmPassword: z.string().min(1, "Confirm your password."),
  syntheticOnly: z.literal("on", { error: "Confirm that you will use synthetic data only." }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match. Please enter the same password in both fields.",
  path: ["confirmPassword"],
});

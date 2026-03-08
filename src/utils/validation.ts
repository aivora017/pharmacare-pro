import { z } from "zod"

export const MedicineSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  generic_name: z.string().min(2, "Generic name required"),
  schedule: z.enum(["OTC","H","H1","X","Narcotic"]),
  default_gst_rate: z.number().min(0).max(28),
  reorder_level: z.number().int().min(0),
  reorder_quantity: z.number().int().min(1),
})

export const CustomerSchema = z.object({
  name: z.string().min(2, "Name required"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Enter valid 10-digit mobile number").optional().or(z.literal("")),
  email: z.string().email("Enter valid email").optional().or(z.literal("")),
})

export const SupplierSchema = z.object({
  name: z.string().min(2, "Supplier name required"),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Invalid GSTIN format").optional().or(z.literal("")),
})

export const LoginSchema = z.object({
  email: z.string().email("Enter valid email"),
  password: z.string().min(1, "Password required"),
})

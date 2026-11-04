import { z } from "zod";

export const ApplicantSubmitSchema = z.object({
  companySlug: z.string().min(1, "Company slug is required"),
  candidateAccountId: z.string().uuid().optional(),
  jobRoleId: z.string().uuid("Invalid job role"),
  roleCategoryId: z.string().uuid("Invalid role category"),
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
  email: z.string().email("Invalid email address"),
  fatherOrHusband: z.string().min(2, "Father / Husband name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  presentAddress: z.string().min(5, "Present address is required"),
  permanentAddress: z.string().min(5, "Permanent address is required"),
  aadhaarNumber: z.string().regex(/^\d{12}$/, "Aadhaar must be exactly 12 digits"),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format"),
  armsLicenseNo: z.string().min(1, "Gun licence number is required"),
  armsExpiryDate: z.string().optional(),
  exServiceNo: z.string().min(1, "Ex-serviceman number is required"),
  formData: z.record(z.string(), z.any()).default({}),
  documents: z.any().optional().default([]),
});

export const StatusUpdateSchema = z.object({
  applicantId: z.string().uuid(),
  status: z.enum(["SHORTLISTED", "REJECTED"]),
  remark: z.string().min(1, "Remark is required when changing status"),
});

export const AddRemarkSchema = z.object({
  applicantId: z.string().uuid(),
  remark: z.string().min(2, "Remark cannot be blank"),
});

export const ApproveApplicantSchema = z.object({
  applicantId: z.string().uuid(),
  siteId: z.string().uuid().optional(),
  basicRate: z.number().positive("Basic rate must be greater than 0"),
  divisorDays: z.number().int().min(20).max(31).default(26),
  uan: z.string().optional(),
  esicNo: z.string().optional(),
  remark: z.string().min(2, "Approval remark is required"),
});

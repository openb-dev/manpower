import { z } from "zod";

export const ApplicantSubmitSchema = z.object({
  companySlug: z.string().min(1, "Company is required."),
  candidateAccountId: z.string().uuid().optional(),
  jobRoleId: z.string().uuid("Please select a trade."),
  roleCategoryId: z.string().uuid("Please select a job category."),
  fullName: z.string().min(2, "Please enter your full name."),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit mobile number."),
  email: z.string().email("Please enter a valid email address."),
  fatherOrHusband: z.string().min(2, "Please enter Father / Husband name."),
  dateOfBirth: z.string().min(1, "Please enter your date of birth."),
  gender: z.enum(["MALE", "FEMALE", "OTHER"], { error: "Please select gender." }),
  presentAddress: z.string().min(5, "Please enter present address."),
  permanentAddress: z.string().min(5, "Please enter permanent address."),
  aadhaarNumber: z.string().regex(/^\d{12}$/, "Aadhaar number must be exactly 12 digits."),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Please enter a valid PAN number (e.g. ABCDE1234F)."),
  armsLicenseNo: z.string().min(1, "Please enter Gun Licence Number (use NA if not applicable)."),
  armsExpiryDate: z.string().optional(),
  exServiceNo: z.string().min(1, "Please enter Ex-serviceman number (use NA if not applicable)."),
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

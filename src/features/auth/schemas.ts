import { z } from "zod";
const digits=(value:string)=>value.trim().replace(/[\u0660-\u0669]/g,d=>String(d.charCodeAt(0)-0x0660)).replace(/[\u06f0-\u06f9]/g,d=>String(d.charCodeAt(0)-0x06f0)).replace(/[^\d]/g,"");
export const loginSchema=z.object({email:z.string().email("Enter a valid email"),password:z.string().min(8),role:z.enum(["student","teacher","admin"])});
export const studentRegistrationSchema=z.object({
  fullName:z.string().trim().min(3).max(120),email:z.string().email(),password:z.string().min(8).max(72),
  age:z.coerce.number().int().min(5).max(100),address:z.string().trim().min(5).max(300),
  mobile:z.string().transform(digits).pipe(z.string().min(10).max(15)),
  guardianMobile:z.string().transform(digits).pipe(z.string().min(10).max(15)),
  nationalId:z.string().transform(digits).pipe(z.string().regex(/^\d{14}$/,"National ID must contain 14 digits")),
});
export function normalizeNationalId(value:string){return digits(value)}

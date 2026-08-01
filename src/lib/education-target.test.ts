import {describe,expect,it} from "vitest";
import {americanCategoryLabel,educationTargetSchema,invitationEducationTargetSchema,nationalGradeLabel} from "./education-target";
describe("education targeting",()=>{
 it.each(["classified","sat","est"] as const)("accepts American %s",americanCategory=>expect(educationTargetSchema.safeParse({educationSystem:"american",americanCategory,nationalGrade:null}).success).toBe(true));
 it("rejects American without a category",()=>expect(educationTargetSchema.safeParse({educationSystem:"american",americanCategory:null,nationalGrade:null}).success).toBe(false));
 it.each(["sensor_1","sensor_2","sensor_3"] as const)("accepts National %s",nationalGrade=>expect(educationTargetSchema.safeParse({educationSystem:"national",americanCategory:null,nationalGrade}).success).toBe(true));
 it("rejects National without a grade",()=>expect(educationTargetSchema.safeParse({educationSystem:"national",americanCategory:null,nationalGrade:null}).success).toBe(false));
 it("uses friendly labels",()=>{expect(nationalGradeLabel("sensor_2")).toBe("Senior 2");expect(americanCategoryLabel("sat")).toBe("SAT")});
 it("allows an American invitation without narrowing access to a category",()=>expect(invitationEducationTargetSchema.safeParse({educationSystem:"american",nationalGrade:null}).success).toBe(true));
 it("still requires a grade for a National invitation",()=>expect(invitationEducationTargetSchema.safeParse({educationSystem:"national",nationalGrade:null}).success).toBe(false));
});

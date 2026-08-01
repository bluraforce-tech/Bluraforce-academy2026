import {describe,expect,it} from "vitest";
import {authCookieName,scopeForPath} from "./auth-scope";

describe("role-isolated auth sessions",()=>{
 it("uses a separate cookie namespace for every role",()=>{
  expect(new Set([authCookieName("student"),authCookieName("teacher"),authCookieName("admin")]).size).toBe(3);
 });
 it.each([
  ["/student/teachers","student"],
  ["/auth/student/login","student"],
  ["/teacher/dashboard","teacher"],
  ["/auth/teacher/login","teacher"],
  ["/admin/dashboard","admin"],
  ["/auth/admin/login","admin"],
  ["/api/exams/attempts/id/submit","student"],
 ] as const)("maps %s to the %s session",(path,scope)=>expect(scopeForPath(path)).toBe(scope));
 it("uses the referring portal for otherwise neutral paths",()=>{
  expect(scopeForPath("/","http://localhost:3000/teacher/dashboard")).toBe("teacher");
 });
});

import {describe,expect,it} from "vitest";
import {exactSetScore} from "./exams/scoring";
import {extractYouTubeId} from "./videos/youtube";
import {normalizeNationalId} from "./auth/schemas";
describe("critical domain rules",()=>{
 it("normalizes Arabic National ID digits",()=>expect(normalizeNationalId("٢٩٨-٠١٠١ ١٢٣٤٥٦٧")).toBe("29801011234567"));
 it("scores exact single and multiple choice sets",()=>{expect(exactSetScore(["a"],["a"],2)).toBe(2);expect(exactSetScore(["a"],["a","b"],2)).toBe(0);expect(exactSetScore(["b","a"],["a","b"],2)).toBe(2)});
 it("accepts supported YouTube links only",()=>{expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");expect(extractYouTubeId("https://youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");expect(extractYouTubeId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull()});
});

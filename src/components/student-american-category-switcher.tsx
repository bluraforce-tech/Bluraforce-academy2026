import Link from "next/link";
import { americanCategoryLabel, AMERICAN_CATEGORIES, type AmericanCategory } from "@/lib/education-target";

export function StudentAmericanCategorySwitcher({basePath,selected}:{basePath:string;selected:AmericanCategory}) {
  return <section className="panel student-category-switcher"><div className="student-category-copy"><small>Content filter</small><h2>What are you studying now?</h2><p>You can switch anytime. Your account has access to all three categories.</p></div><nav aria-label="American content category">{AMERICAN_CATEGORIES.map(category=><Link key={category.value} aria-current={category.value===selected?"page":undefined} className={category.value===selected?"active":""} href={`${basePath}?category=${category.value}`}>{americanCategoryLabel(category.value)}</Link>)}</nav></section>;
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MaterialForm } from "@/features/materials/material-form";
import { getTeacherMaterialStudents } from "@/lib/teacher-material-students";

export default async function Page(){const students=await getTeacherMaterialStudents();return <main className="app-content exam-page"><Link className="back-link" href="/teacher/study-notes"><ArrowLeft/>Back to Study Notes</Link><header><h1>Add Study Note</h1></header><MaterialForm kind="study_note" students={students}/></main>}

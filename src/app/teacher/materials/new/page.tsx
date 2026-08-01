import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MaterialForm } from "@/features/materials/material-form";
import { getTeacherMaterialStudents } from "@/lib/teacher-material-students";

export default async function Page(){const students=await getTeacherMaterialStudents();return <main className="app-content exam-page"><Link className="back-link" href="/teacher/materials"><ArrowLeft/>Back to Material Books</Link><header><h1>Add Material Book</h1></header><MaterialForm kind="material_book" students={students}/></main>}

"use client";

import { useState } from "react";

type Point = { label: string; value: number };
type TeacherRedemption = {
  teacherId: string;
  name: string;
  total: number;
  thisMonth: number;
  codes: Array<{id:string;code:string;educationSystem:"american"|"national"|null;americanCategory:string|null;nationalGrade:string|null;redeemedAt:string}>;
};

function Bars({ data, color = "blue" }: { data: Point[]; color?: "blue" | "navy" }) {
  const max = Math.max(1, ...data.map((point) => point.value));
  return (
    <div className="analytics-bars">
      {data.map((point) => (
        <div className="analytics-bar-item" key={point.label}>
          <div className="analytics-value">{point.value}</div>
          <div
            className={`analytics-bar ${color}`}
            style={{ height: `${Math.max(4, (point.value / max) * 100)}%` }}
          />
          <small>{point.label}</small>
        </div>
      ))}
    </div>
  );
}

export function AdminGrowthAnalytics({
  dailyStudents,
  monthlyStudents,
  monthlyRedemptions,
  teacherRedemptions,
}: {
  dailyStudents: Point[];
  monthlyStudents: Point[];
  monthlyRedemptions: Point[];
  teacherRedemptions: TeacherRedemption[];
}) {
  const [period, setPeriod] = useState<"day" | "month">("day");
  const [system,setSystem]=useState<"all"|"national"|"american">("all");
  const [selectedYears,setSelectedYears]=useState<number[]>([]);
  const [selectedMonths,setSelectedMonths]=useState<number[]>([]);
  const registrations = period === "day" ? dailyStudents : monthlyStudents;
  const years=[...new Set(teacherRedemptions.flatMap(teacher=>teacher.codes.map(code=>new Date(code.redeemedAt).getFullYear())))].sort((a,b)=>b-a);
  const months=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const toggle=(value:number,values:number[],setValues:(values:number[])=>void)=>setValues(values.includes(value)?values.filter(item=>item!==value):[...values,value]);
  const categoryLabel=(code:TeacherRedemption["codes"][number])=>code.educationSystem==="american"?(({classified:"Classified",sat:"SAT",est:"EST"} as Record<string,string>)[code.americanCategory??""]??"American"):code.educationSystem==="national"?(({sensor_1:"Senior 1",sensor_2:"Senior 2",sensor_3:"Senior 3"} as Record<string,string>)[code.nationalGrade??""]??"National"):"Needs classification";

  return (
    <section className="admin-analytics">
      <article className="panel analytics-card">
        <div className="analytics-heading">
          <div>
            <small>Student growth</small>
            <h2>New student registrations</h2>
            <p>{period === "day" ? "Last 30 days" : "Last 12 months"}</p>
          </div>
          <div className="period-switch">
            <button className={period === "day" ? "active" : ""} onClick={() => setPeriod("day")}>By day</button>
            <button className={period === "month" ? "active" : ""} onClick={() => setPeriod("month")}>By month</button>
          </div>
        </div>
        <Bars data={registrations} />
      </article>

      <article className="panel analytics-card">
        <div className="analytics-heading">
          <div>
            <small>Code conversions</small>
            <h2>Students redeeming codes</h2>
            <p>Unique students by month · Last 12 months</p>
          </div>
        </div>
        <Bars data={monthlyRedemptions} color="navy" />
      </article>

      <article className="panel analytics-card teacher-redemptions">
        <div className="analytics-heading">
          <div>
            <small>Teacher performance</small>
            <h2>Redeemed codes by teacher</h2>
            <p>Every redeemed code grouped by teacher and education category</p>
          </div>
          <div className="redemption-filter" aria-label="Filter redeemed codes"><button className={system==="all"?"active":""} onClick={()=>setSystem("all")}>All</button><button className={system==="national"?"active":""} onClick={()=>setSystem("national")}>National</button><button className={system==="american"?"active":""} onClick={()=>setSystem("american")}>American</button></div>
        </div>
        <div className="redemption-date-filters">
          <div><strong>Years</strong><div>{years.map(year=><button type="button" className={selectedYears.includes(year)?"active":""} aria-pressed={selectedYears.includes(year)} onClick={()=>toggle(year,selectedYears,setSelectedYears)} key={year}>{year}</button>)}</div></div>
          <div><strong>Months</strong><div>{months.map((month,index)=><button type="button" className={selectedMonths.includes(index)?"active":""} aria-pressed={selectedMonths.includes(index)} onClick={()=>toggle(index,selectedMonths,setSelectedMonths)} key={month}>{month}</button>)}</div></div>
          {(selectedYears.length>0||selectedMonths.length>0)&&<button className="clear-date-filter" type="button" onClick={()=>{setSelectedYears([]);setSelectedMonths([])}}>Clear dates</button>}
        </div>
        <div className="teacher-redemption-grid">
          {teacherRedemptions.map((teacher) => {const dateCodes=teacher.codes.filter(code=>{const date=new Date(code.redeemedAt);return (selectedYears.length===0||selectedYears.includes(date.getFullYear()))&&(selectedMonths.length===0||selectedMonths.includes(date.getMonth()))}),codes=dateCodes.filter(code=>system==="all"||code.educationSystem===system),nationalCount=dateCodes.filter(code=>code.educationSystem==="national").length,americanCount=dateCodes.filter(code=>code.educationSystem==="american").length;return <article className="teacher-redemption-card" key={teacher.teacherId}>
              <div className="teacher-redemption-head"><div><small>Teacher</small><h3>{teacher.name}</h3></div><strong>{codes.length}</strong></div>
              <div className="teacher-code-summary"><span>{teacher.thisMonth} this month</span><span>{teacher.total} all time</span><span className="national-count">{nationalCount} National</span><span className="american-count">{americanCount} American</span></div>
              <div className="redeemed-code-list">{codes.map(code=><div className="redeemed-code" key={code.id}><div><b>{code.code}</b><small>{new Date(code.redeemedAt).toLocaleDateString()}</small></div><span className={`code-category ${code.educationSystem??"unknown"}`}>{code.educationSystem==="american"?"American":"National"} · {categoryLabel(code)}</span></div>)}{codes.length===0&&<p>No {system==="all"?"redeemed":system} codes.</p>}</div>
            </article>})}
        </div>
        {teacherRedemptions.length === 0 && <p className="analytics-empty">No teachers found.</p>}
      </article>
    </section>
  );
}

"use client";

import { useState } from "react";

type Point = { label: string; value: number };
type TeacherRedemption = {
  teacherId: string;
  name: string;
  total: number;
  thisMonth: number;
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
  const registrations = period === "day" ? dailyStudents : monthlyStudents;

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
            <p>Separate totals for every teacher</p>
          </div>
        </div>
        <div className="redemption-table">
          <div className="redemption-row header">
            <span>Teacher</span><span>This month</span><span>All time</span>
          </div>
          {teacherRedemptions.map((teacher) => (
            <div className="redemption-row" key={teacher.teacherId}>
              <strong>{teacher.name}</strong>
              <span>{teacher.thisMonth}</span>
              <b>{teacher.total}</b>
            </div>
          ))}
        </div>
        {teacherRedemptions.length === 0 && <p className="analytics-empty">No teachers found.</p>}
      </article>
    </section>
  );
}

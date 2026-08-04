import Dashboard from "@/app/[role]/dashboard/page";

export default function AdminDashboardPage(){
 return <Dashboard params={Promise.resolve({role:"admin"})}/>;
}

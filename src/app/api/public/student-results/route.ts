import {NextResponse} from "next/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {findPublicStudentResults,isResultsOtpVerified,normalizeResultsIdentifier,resultsLookupKey} from "@/lib/public-results";
export const dynamic="force-dynamic";
const responseHeaders={"Cache-Control":"no-store, private","X-Content-Type-Options":"nosniff"};
export async function POST(request:Request){
 let body:unknown;try{body=await request.json()}catch{return NextResponse.json({error:"invalid_request"},{status:400,headers:responseHeaders})}
 const raw=typeof body==="object"&&body!==null&&"identifier" in body?String((body as {identifier:unknown}).identifier):"",identifier=normalizeResultsIdentifier(raw);
 if(identifier.length<10||identifier.length>15)return NextResponse.json({error:"invalid_request"},{status:400,headers:responseHeaders});
 const forwarded=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),admin=createAdminClient();
 const [clientLimit,identifierLimit]=await Promise.all([admin.rpc("consume_public_results_rate_limit",{p_key_hash:resultsLookupKey(`ip:${forwarded??"unknown"}`),p_limit:12,p_window_seconds:900}),admin.rpc("consume_public_results_rate_limit",{p_key_hash:resultsLookupKey(`id:${identifier}`),p_limit:5,p_window_seconds:900})]);
 if(clientLimit.error||identifierLimit.error){console.error("Public results rate limiter failed");return NextResponse.json({error:"temporarily_unavailable"},{status:503,headers:responseHeaders})}
 if(!clientLimit.data||!identifierLimit.data)return NextResponse.json({error:"rate_limited"},{status:429,headers:{...responseHeaders,"Retry-After":"900"}});
 if(!await isResultsOtpVerified(request))return NextResponse.json({error:"otp_required"},{status:403,headers:responseHeaders});
 try{return NextResponse.json({students:await findPublicStudentResults(identifier)},{headers:responseHeaders})}catch(error){console.error("Public results lookup failed",error instanceof Error?error.message:"unknown");return NextResponse.json({error:"temporarily_unavailable"},{status:503,headers:responseHeaders})}
}

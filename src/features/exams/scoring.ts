export function exactSetScore(selected:string[],correct:string[],points:number){
  const a=[...new Set(selected)].sort(),b=[...new Set(correct)].sort();
  return a.length===b.length&&a.every((v,i)=>v===b[i])?points:0;
}

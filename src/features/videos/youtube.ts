const ID=/^[A-Za-z0-9_-]{11}$/;
export function extractYouTubeId(input:string){
  let url:URL; try{url=new URL(input)}catch{return null}
  const host=url.hostname.replace(/^www\./,"").toLowerCase(); let id:string|null=null;
  if(host==="youtu.be") id=url.pathname.split("/")[1]||null;
  else if(["youtube.com","m.youtube.com"].includes(host)){
    if(url.pathname==="/watch") id=url.searchParams.get("v");
    else {const match=url.pathname.match(/^\/(?:embed|shorts)\/([^/?]+)/);id=match?.[1]||null}
  }
  return id&&ID.test(id)?id:null;
}

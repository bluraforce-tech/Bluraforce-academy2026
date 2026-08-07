import { Fragment, type ReactNode } from "react";

type Node = { tag?: string; children: Array<Node|string> };
const allowed = new Set(["b","strong","i","em","u","s","strike"]);
function parse(value:string):Node{
  const root:Node={children:[]},stack=[root],tokens=value.split(/(<\/?[a-z]+(?:\s[^>]*)?>)/gi);
  for(const token of tokens){
    const match=token.match(/^<\/?([a-z]+)/i);
    if(!match){stack.at(-1)!.children.push(token);continue}
    const tag=match[1].toLowerCase(),closing=token.startsWith("</");
    if(tag==="br"){stack.at(-1)!.children.push("\n");continue}
    if(tag==="div"||tag==="p"){if(closing)stack.at(-1)!.children.push("\n");continue}
    if(!allowed.has(tag))continue;
    if(closing){if(stack.length>1)stack.pop();continue}
    const node:Node={tag,children:[]};stack.at(-1)!.children.push(node);stack.push(node);
  }
  return root;
}
function render(node:Node|string,key:string):ReactNode{
  if(typeof node==="string")return node;
  const children=node.children.map((child,index)=><Fragment key={`${key}-${index}`}>{render(child,`${key}-${index}`)}</Fragment>);
  if(node.tag==="b"||node.tag==="strong")return <strong>{children}</strong>;
  if(node.tag==="i"||node.tag==="em")return <em>{children}</em>;
  if(node.tag==="u")return <u>{children}</u>;
  if(node.tag==="s"||node.tag==="strike")return <s>{children}</s>;
  return children;
}
export function FormattedQuestionText({text}:{text:string}){return <>{render(parse(text),"question")}</>}

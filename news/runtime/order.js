// A shared order keeps the portal list and the public feed consistent.
export function orderNews(posts,order=[]){
 const ranks=new Map((Array.isArray(order)?order:[]).map((id,index)=>[id,index]));
 return [...posts].sort((a,b)=>(ranks.get(a.id)??Infinity)-(ranks.get(b.id)??Infinity)||b.publishedAt.localeCompare(a.publishedAt)||a.id.localeCompare(b.id));
}

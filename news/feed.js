import {repositoryPosts,mergePosts,postArticle,el} from './shared.js?v=20261103';
import {firebaseConfig} from '../firebase-config.js';
let cached=null,until=0,dispose=[],pending=null;
export async function renderNews(target){
 if(pending)return pending;
 pending=(async()=>{try{if(!cached||Date.now()>until){const [source,edits]=await Promise.all([repositoryPosts(),fetch(`https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/newsFeed`,{signal:AbortSignal.timeout(10000)}).then(r=>{if(!r.ok)throw Error('News updates are temporarily unavailable.');return r.json()}).catch(()=>null)]);cached={posts:mergePosts(source,edits?.posts||[],edits?.hiddenSourceFiles||[]),offline:!edits};until=Date.now()+(edits?60000:10000)}dispose.forEach(fn=>fn());dispose=[];target.replaceChildren();if(cached.offline)target.append(el('p','news-notice','Showing repository news. Portal updates are temporarily unavailable.'));for(const post of cached.posts){const item=postArticle(post);target.append(item.element);dispose.push(item.dispose)}if(!cached.posts.length)target.append(el('p','','No news posts yet.'))}catch{target.replaceChildren(el('p','','News could not load. Reopen Community to retry.'))}finally{pending=null}})();return pending;
}

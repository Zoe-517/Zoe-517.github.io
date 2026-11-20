let replyLetterRecord = null;
let articleDiscussionRecord = null;
let articleDiscussionSession = 0;
let articleReplyId = null;
let articleSendId = null;
let articleCommentBusy = false;
const articleDrafts = new Map();
// Article visibility is now taken from the full cloud article, never a stale local registry.
function syncArticleAccess() { return Promise.resolve(); }
function openLetterReply(record) {
  if (!isAuthor || visitor || !record) return;
  replyLetterRecord = record;
  $('replySender').textContent = record.nickname ? '来自 '+record.nickname : '一位朋友的来信';
  $('replyOriginal').replaceChildren(element('h3',record.title),...(record.body===record.title&&!record.richBody?[]:[storedContent(record)]));
  const form=$('letterReplyForm');
  form.elements.reply.value=record.reply || '';
  form.elements.visibility.value=record.visibility;
  $('letterReplyStatus').textContent='';
  $('letterReplyEditor').showModal();
}
$('letterReplyForm').onsubmit=async event=>{
  event.preventDefault();
  if (!isAuthor || visitor || !replyLetterRecord) return;
  const form=event.currentTarget,record=replyLetterRecord;
  if (form.elements.visibility.value==='public' && !form.elements.reply.value.trim()) { $('letterReplyStatus').textContent='公开来信前，请先填写回复。';return; }
  form.inert=true;
  try {
    await cloudApi('/api/letters',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...record,reply:form.elements.reply.value,visibility:form.elements.visibility.value})});
    await loadLetters();view();$('letterReplyEditor').close();
  } catch(error) { $('letterReplyStatus').textContent=error.message; }
  finally { form.inert=false; }
};
$('letterReplyEditor').addEventListener('cancel',event=>{if($('letterReplyForm').inert)event.preventDefault();});
$('openSentLetters').onclick=async()=>{
  $('question').close();$('sentLetters').showModal();$('sentLetterList').replaceChildren();$('sentLettersStatus').textContent='正在读取来信…';
  try {
    const rows=await cloudApi('/api/my-letters',{headers:commentHeaders()});
    $('sentLetterList').replaceChildren(...rows.map(record=>{
      const row=element('article','');
      row.append(element('h3',record.title),element('p',record.reply?'Zoe 回复：'+record.reply:'等待 Zoe 回复'),button('编辑我的来信',()=>{
        $('sentLetters').close();const form=$('askForm');form.reset();form.dataset.letterId=record.id;form.dataset.senderEdit='true';form.elements.message.value=record.body;form.elements.nickname.value=record.nickname || '';$('askHeading').textContent='编辑我的来信';$('question').showModal();
      }));return row;
    }));
    $('sentLettersStatus').textContent=rows.length?'':'当前账号或浏览器还没有可编辑的来信。较早寄出且未记录写信人身份的来信，仍保留原文。';
  } catch(error) { $('sentLettersStatus').textContent=error.message; }
};
$('question').addEventListener('close',()=>{if(!$('askForm').inert){$('askForm').reset();delete $('askForm').dataset.senderEdit;delete $('askForm').dataset.letterId;$('askHeading').textContent='给己己写封信';}});
function storeArticleDraft() {
  if (!articleDiscussionRecord) return;
  const form=$('articleCommentForm');articleDrafts.set(articleDiscussionRecord.id,{body:form.elements.body.value,nickname:form.elements.nickname.value,replyId:articleReplyId,sendId:articleSendId});
}
function setArticleReply(id, name='') {
  articleReplyId=id;articleSendId=null;
  $('articleReplyTarget').hidden=$('cancelArticleReply').hidden=!id;
  $('articleReplyTarget').textContent=id?'回复 '+name:'';
}
async function openArticleDiscussion(record) {
  storeArticleDraft();
  articleDiscussionRecord=record;const session=++articleDiscussionSession;
  const draft=articleDrafts.get(record.id),form=$('articleCommentForm');
  form.elements.body.value=draft?.body||'';form.elements.nickname.value=draft?.nickname||'';
  setArticleReply(draft?.replyId||null,'这条留言');articleSendId=draft?.sendId||null;
  form.elements.nickname.closest('label').hidden=isAuthor&&!visitor;
  $('articleCommentStatus').textContent='';
  $('articleCommentList').replaceChildren(element('p','正在读取留言…'));
  try { await syncArticleAccess(); await loadArticleComments(session); }
  catch(error) { if(session===articleDiscussionSession)$('articleCommentStatus').textContent=error.message; }
}
async function loadArticleComments(session=articleDiscussionSession) {
  if (!articleDiscussionRecord) return;
  const record=articleDiscussionRecord;
  let rows=await cloudApi('/api/article-comments?entry='+encodeURIComponent(record.id),{headers:commentHeaders()});
  if (session!==articleDiscussionSession) return;
  if(isAuthor&&visitor) rows=rows.filter(row=>row.visibility==='public');
  const list=$('articleCommentList');
  const render=row=>{
    const node=element('div','');node.className='article-comment'+(row.parentId?' is-reply':'');
    node.append(element('small',(row.author?'Zoe · 作者':row.nickname)+' · '+(row.visibility==='public'?'公开':'仅自己与 Zoe 可见')),element('p',row.body));
    const actions=element('div','');actions.className='actions';
    if(isAuthor&&!visitor&&!row.parentId) {
      actions.append(button('回复',()=>{setArticleReply(row.id,row.nickname);$('articleCommentForm').elements.body.focus();}),button(row.visibility==='public'?'设为私密':'公开这条留言',()=>articleCommentAction(row,{action:'visibility',visibility:row.visibility==='public'?'private':'public'})));
    }
    if(row.canManage&&!(isAuthor&&visitor)) actions.append(button('删除',()=>{if(confirm('删除这条留言？'))articleCommentAction(row,{action:'delete'});}));
    node.append(actions);return node;
  };
  const ordered=[];
  for(const root of rows.filter(row=>!row.parentId)) {ordered.push(render(root),...rows.filter(row=>row.parentId===root.id).map(render));}
  list.replaceChildren(...ordered);
  if(!ordered.length)list.append(element('p','还没有留言，写下第一句话吧。'));
}
async function articleCommentAction(row,data) {
  if(articleCommentBusy)return;articleCommentBusy=true;const session=articleDiscussionSession;
  $('articleCommentList').inert=true;
  try {await cloudApi('/api/article-comment-actions',{method:'POST',headers:{'Content-Type':'application/json',...commentHeaders()},body:JSON.stringify({entryId:row.entryId,id:row.id,...data})});await loadArticleComments(session);}
  catch(error){if(session===articleDiscussionSession)$('articleCommentStatus').textContent=error.message;}
  finally{articleCommentBusy=false;$('articleCommentList').inert=false;}
}
$('articleCommentForm').onsubmit=async event=>{
  event.preventDefault();if(articleCommentBusy||!articleDiscussionRecord)return;
  articleCommentBusy=true;const form=event.currentTarget,session=articleDiscussionSession,entryId=articleDiscussionRecord.id;
  form.inert=true;$('articleCommentStatus').textContent='正在发送…';
  const wasReply=Boolean(articleReplyId);
  const body=form.elements.body.value.trim();articleSendId ||= crypto.randomUUID();
  try {
    await cloudApi('/api/article-comments',{method:'POST',headers:{'Content-Type':'application/json',...commentHeaders()},body:JSON.stringify({id:articleSendId,entryId,body,nickname:form.elements.nickname.value,parentId:articleReplyId})});
    if(session===articleDiscussionSession) {form.elements.body.value='';setArticleReply(null);storeArticleDraft();await loadArticleComments(session);$('articleCommentStatus').textContent=wasReply?'回复已保存，可见范围跟随原评论。':'已保存，留言默认私密。';}
  } catch(error){if(session===articleDiscussionSession)$('articleCommentStatus').textContent=error.message;}
  finally{articleCommentBusy=false;form.inert=false;}
};
$('articleCommentForm').addEventListener('input',()=>{articleSendId=null;storeArticleDraft();});
$('cancelArticleReply').onclick=()=>{setArticleReply(null);storeArticleDraft();};
$('refreshArticleComments').onclick=()=>loadArticleComments().catch(error=>{$('articleCommentStatus').textContent=error.message;});
$('articleReader').addEventListener('close',()=>{storeArticleDraft();articleDiscussionSession++;});

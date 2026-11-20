const entryTrashKey = 'zoe-deleted-entries-v1';
let deletingEntry = null;
let entryActionBusy = false;
function localEntryTrash() {
  try { return JSON.parse(localStorage.getItem(entryTrashKey) || '[]').filter(record => !records.some(active => active.id === record.id)); }
  catch { return []; }
}
function askDeleteEntry(record) {
  if (!record || !isAuthor || visitor || entryActionBusy) return;
  deletingEntry = record;
  $('entryDeleteHeading').textContent = record.category === categories[3] ? '删除这封来信？' : '删除这篇文章？';
  $('entryDeleteTitle').textContent = record.title;
  $('entryDeleteStatus').textContent = '';
  $('entryDeleteConfirm').showModal();
}
function trashLocalEntry(record) {
  const trashBefore = localEntryTrash();
  localStorage.setItem(entryTrashKey, JSON.stringify([{...record,deletedAt:new Date().toISOString()},...trashBefore.filter(item=>item.id!==record.id)]));
  if (!save(records.filter(item=>item.id!==record.id))) {
    try { localStorage.setItem(entryTrashKey,JSON.stringify(trashBefore)); } catch {}
    throw new Error('内容尚未删除，请稍后重试。');
  }
}
function restoreLocalEntry(record) {
  const {deletedAt,...restored}=record;
  if (!save([...records.filter(item=>item.id!==record.id),restored])) throw new Error('暂时无法恢复，请稍后重试。');
  // The active copy is saved first, so an interrupted cleanup cannot lose it.
  try { localStorage.setItem(entryTrashKey,JSON.stringify(localEntryTrash().filter(item=>item.id!==record.id))); } catch {}
}
async function changeLetterState(record, action) {
  await cloudApi('/api/letter-actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:record.id,action,...(record.id==='qa'?{record}:{})})});
  await loadLetters();
}
$('confirmEntryDelete').onclick = async () => {
  if (!isAuthor || visitor || entryActionBusy || !deletingEntry) return;
  entryActionBusy=true; $('confirmEntryDelete').disabled=$('cancelEntryDelete').disabled=true;
  $('entryDeleteStatus').textContent='正在删除…';
  try {
    if(deletingEntry.category===categories[3]) await changeLetterState(deletingEntry,'delete');
    else await changeArticleState(deletingEntry,'delete');
    $('articleReader').close(); $('letterReader').close(); $('editor').close();
    $('entryDeleteConfirm').close(); view();
  } catch(error) { $('entryDeleteStatus').textContent=error.message; }
  finally { entryActionBusy=false; $('confirmEntryDelete').disabled=$('cancelEntryDelete').disabled=false; }
};
$('cancelEntryDelete').onclick=()=>{if(!entryActionBusy)$('entryDeleteConfirm').close();};
$('entryDeleteConfirm').addEventListener('cancel',event=>{if(entryActionBusy)event.preventDefault();});
function renderEntryTrash() {
  const items=[...cloudDeletedLetters,...cloudDeletedArticles].sort((a,b)=>(b.deletedAt||'').localeCompare(a.deletedAt||''));
  $('entryTrashList').replaceChildren(...items.map(record=>{
    const row=element('article','');
    row.append(element('small',record.category),element('h3',record.title));
    const restore=button('恢复',async()=>{
      if(entryActionBusy)return;
      entryActionBusy=true; $('entryTrashList').inert=true;
      $('entryTrashStatus').textContent='正在恢复…';
      try {
        if(record.category===categories[3])await changeLetterState(record,'restore');else await changeArticleState(record,'restore');
        view();renderEntryTrash();
      } catch(error){$('entryTrashStatus').textContent=error.message;}
      finally{entryActionBusy=false;$('entryTrashList').inert=false;}
    });
    row.append(restore);return row;
  }));
  $('entryTrashStatus').textContent=items.length?'文章与来信均可从云端恢复。':'没有已删除的内容。';
}
$('openEntryTrash').onclick=async()=>{
  if(!isAuthor||visitor)return;
  $('entryTrash').showModal();$('entryTrashStatus').textContent='正在读取…';
  try{await Promise.all([loadLetters(),loadArticles()]);renderEntryTrash();}catch(error){$('entryTrashStatus').textContent=error.message;}
};
$('closeEntryTrash').onclick=()=>{if(!entryActionBusy)$('entryTrash').close();};
$('entryTrash').addEventListener('cancel',event=>{if(entryActionBusy)event.preventDefault();});

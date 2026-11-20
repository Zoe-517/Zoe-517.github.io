let cloudArticles = [];
let cloudDeletedArticles = [];
let articlesReady = false;
let migratingArticles = null;
let migrationMessage = '';
const articleMigrationKey = 'zoe-articles-cloud-migrated-v1';
function readLegacyArticles() {
  const raw = localStorage.getItem(storageKey);
  const saved = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(saved)) throw new Error('本机文章备份无法读取，请勿清理浏览器数据。');
  return saved.filter(record => record.category !== categories[3]);
}
async function migrateLocalArticles(force=false) {
  if (!isAuthor || (!localStorage.getItem(storageKey) && !localStorage.getItem(entryTrashKey))) return;
  if (migratingArticles) return migratingArticles;
  migratingArticles = (async()=>{
    const source=(localStorage.getItem(storageKey)||'')+'\n'+(localStorage.getItem(entryTrashKey)||'');
    const sourceHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source))),byte=>byte.toString(16).padStart(2,'0')).join('');
    if(!force&&localStorage.getItem(articleMigrationKey)===sourceHash)return;
    const active=readLegacyArticles();
    let trash=[];
    try { trash=JSON.parse(localStorage.getItem(entryTrashKey)||'[]').filter(record=>record.category!==categories[3]&&!active.some(row=>row.id===record.id)); }
    catch { throw new Error('已删除文章的本机备份无法读取，请勿清理浏览器数据。'); }
    const all=[...trash.map(record=>({record,deleted:true})),...active.map(record=>({record,deleted:false}))];
    for(let index=0;index<all.length;index++) {
      $('articleSyncStatus').textContent='正在将本机文章同步到云端 '+(index+1)+' / '+all.length+'…';
      const item=all[index];
      const seed=examples.find(example=>example.id===item.record.id);
      const unchanged=seed && ['title','body','visibility'].every(key=>seed[key]===item.record[key]) && !item.record.richBody && !item.record.blocks;
      await cloudApi('/api/articles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({record:item.record,deleted:item.deleted,mode:unchanged&&!item.deleted?'seed':'import'})});
    }
    try { localStorage.setItem(articleMigrationKey,sourceHash); } catch {}
    migrationMessage='本机文章已同步到云端，原浏览器备份已保留。';
  })();
  try { await migratingArticles; } finally { migratingArticles=null; }
}
async function loadArticles() {
  let rows=await cloudApi('/api/articles');
  if(isAuthor){await migrateLocalArticles(rows.length===0);rows=await cloudApi('/api/articles');}
  cloudArticles=rows.filter(row=>!row.deleted);
  cloudDeletedArticles=isAuthor?rows.filter(row=>row.deleted):[];
  records=[...cloudArticles,...records.filter(record=>record.category===categories[3])];
  articlesReady=true;
  $('articleSyncStatus').textContent=migrationMessage || (isAuthor?'文章已保存到云端，手机和电脑登录同一账号可查看。':'正在阅读已公开的云端文章。');
  $('retryArticleSync').hidden=true;
}
async function saveCloudArticle(record) {
  if(!articlesReady)throw new Error('请先完成文章云端同步，再保存新内容。');
  const saved=await cloudApi('/api/articles',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({record,expectedRevision:record.revision})});
  records=[saved,...records.filter(row=>row.id!==saved.id)];
  cloudArticles=[saved,...cloudArticles.filter(row=>row.id!==saved.id)];
  $('articleSyncStatus').textContent='文章已保存到云端。';
  return saved;
}
async function changeArticleState(record,action) {
  await cloudApi('/api/article-actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:record.id,action,expectedRevision:record.revision})});
  await loadArticles();
}
$('retryArticleSync').onclick=async()=>{
  $('retryArticleSync').disabled=true;
  try{await loadArticles();view();}
  catch(error){$('articleSyncStatus').textContent='文章未完成同步：'+error.message;$('retryArticleSync').hidden=!isAuthor;}
  finally{$('retryArticleSync').disabled=false;}
};

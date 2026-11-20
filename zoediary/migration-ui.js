let importingCloudBackup=false;
$('openMigration').onclick=async()=>{
  if(!isAuthor)return;
  $('authorCenter').close();
  $('migrationPanel').showModal();
  try{const status=await cloudApi('/api/migration/status');$('migrationStatus').textContent=status.complete?'数据已完整导入并校验。':'云端现有 '+status.count+' 个数据对象。';$('chooseMigration').disabled=!status.importEnabled || Boolean(status.complete);}
  catch(error){$('migrationStatus').textContent=error.message;}
};
$('chooseMigration').onclick=()=>{if(isAuthor && !importingCloudBackup)$('migrationFile').click();};
$('migrationPanel').addEventListener('cancel',event=>{if(importingCloudBackup)event.preventDefault();});
$('migrationPanel').querySelector('[data-close]').addEventListener('click',event=>{if(importingCloudBackup){event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
async function* backupLines(file){
  const reader=file.stream().getReader(),decoder=new TextDecoder();let pending='';
  try{while(true){const {value,done}=await reader.read();pending+=done?decoder.decode():decoder.decode(value,{stream:true});let end;while((end=pending.indexOf('\n'))!==-1){const line=pending.slice(0,end);pending=pending.slice(end+1);if(line.trim())yield JSON.parse(line);}if(pending.length>12*1024*1024)throw new Error('备份记录过大。');if(done)break;}if(pending.trim())yield JSON.parse(pending);}
  finally{reader.releaseLock();}
}
$('migrationFile').onchange=async event=>{
  const file=event.target.files[0];event.target.value='';if(!file || !isAuthor || importingCloudBackup)return;
  importingCloudBackup=true;$('chooseMigration').disabled=true;
  let count=0,header=null,complete=null;
  try{
    for await(const record of backupLines(file)){
      if(complete)throw new Error('备份结尾存在多余内容。');
      if(!header){if(record.type!=='header' || record.format!=='zoe-diary-cloud-v1')throw new Error('请选择原网站导出的完整云端备份。');header=record;continue;}
      if(record.type==='object'){await cloudApi('/api/migration/record',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(record)});count++;$('migrationStatus').textContent='正在安全导入 '+count+' / '+header.count+'…';}
      else if(record.type==='complete')complete=record;
      else throw new Error('备份文件格式无效。');
    }
    if(!complete || count!==header.count || complete.count!==count)throw new Error('备份文件不完整。原网站内容仍保留，请重新导出后继续。');
    await cloudApi('/api/migration/finalize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(complete)});
    $('migrationStatus').textContent='全部 '+count+' 个数据对象已导入，并逐一通过校验。';
    await initializeCloud();
  }catch(error){$('migrationStatus').textContent=error.message+' 已成功导入的相同数据会在重试时自动跳过。';$('chooseMigration').disabled=false;}
  finally{importingCloudBackup=false;}
};
const authError=new URL(location.href).searchParams.get('auth_error');
if(authError){
  $('loginMessage').textContent=authError==='not_owner'?'这个 Google 账号没有作者权限，请选择 Zoe 指定的账号。':'登录没有完成，请重新使用 Google 登录。';
  const cleaned=new URL(location.href);cleaned.searchParams.delete('auth_error');history.replaceState(null,'',cleaned.pathname+cleaned.search+cleaned.hash);
  showAccountLogin();
}

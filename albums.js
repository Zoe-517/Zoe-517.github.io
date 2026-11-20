// Native adaptation of the supplied Originkit Swipe Stack and Live Chat interactions.
// Uncropped, frameless photos in a layered stack, with a 50px swipe threshold.
const albumDialog = document.getElementById('albumReader');
const stack = document.getElementById('swipeStack');
const commentForm = document.getElementById('commentForm');
const commentList = document.getElementById('photoComments');
const commentDrafts = new Map();
const commentCache = new Map();
let readingAlbum = null;
let readingPhoto = 0;
let commentEpoch = 0;
let commentTimer = 0;
let replyTo = null;
let sendingComment = false;
let changingPhoto = false;
let photoDrag = null;
let outgoingAnimation = null;
let commentRequestId = null;
let albumSession = 0;
const commentBrowserKey = (() => {
  let key;
  try { key = localStorage.getItem('zoe-comment-browser-key'); } catch {}
  if (!/^[a-f0-9]{64}$/.test(key || '')) {
    key = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2,'0')).join('');
    try { localStorage.setItem('zoe-comment-browser-key', key); } catch {}
  }
  return key;
})();
const commentHeaders = () => ({'X-Comment-Key':commentBrowserKey});

function albumPhoto() { return readingAlbum?.photos[readingPhoto]; }
function saveCommentDraft() {
  const photo = albumPhoto();
  if (photo) commentDrafts.set(photo.id, { body: commentForm.elements.body.value, nickname: commentForm.elements.nickname.value, replyTo, requestId: commentRequestId });
}
function updateReplyContext() {
  $('replyContext').hidden = !replyTo;
  $('replyContext').querySelector('span').textContent = replyTo ? '回复 ' + replyTo.nickname : '';
  $('commentBodyLabel').textContent = replyTo ? '写下你的回复' : '写一条评论';
  $('sendComment').textContent = replyTo ? '发送回复 ↗' : '发送评论 ↗';
}
function openAlbum(album) {
  if (!album?.photos.length) return;
  ++albumSession;
  readingAlbum = album;
  readingPhoto = 0;
  $('openAlbumManager').hidden=!isAuthor || visitor || album.id==='welcome-album';
  $('albumHeading').textContent = album.title;
  const date = album.createdAt ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(album.createdAt)) : album.date;
  $('albumMeta').textContent = [date, album.photos.length + ' 张照片'].filter(Boolean).join(' · ');
  if (!albumDialog.open) albumDialog.showModal();
  showAlbumPhoto(false);
  albumDialog.scrollTop = 0;
  clearInterval(commentTimer);
  commentTimer = setInterval(() => { if (albumDialog.open && !sendingComment && document.visibilityState === 'visible') loadPhotoComments(false); }, 20000);
}
function renderPhotoStack() {
  const photos = readingAlbum.photos;
  stack.replaceChildren();
  const amount = Math.min(4, photos.length);
  for (let depth = amount - 1; depth >= 0; depth--) {
    const photo = photos[(readingPhoto + depth) % photos.length];
    const card = document.createElement('figure');
    card.className = 'stack-photo';
    card.style.zIndex = String(amount - depth);
    card.style.transform = 'translate3d(calc(' + depth + ' * var(--stack-step, 16px)),' + -depth * 10 + 'px,' + -depth * 10 + 'px) rotate(calc(' + depth + ' * var(--stack-tilt, 3deg))) scale(' + (1 - depth * .045) + ')';
    if (depth === 0) card.dataset.top = 'true';
    else card.setAttribute('aria-hidden', 'true');
    const img = new Image();
    img.src = photo.src;
    img.alt = photo.caption || '动态照片 ' + (readingPhoto + 1);
    img.draggable = false;
    if (depth === 0) {
      img.onload = () => {
        if (!stack.contains(card) || !img.naturalWidth || !img.naturalHeight) return;
        const ratio = img.naturalWidth / img.naturalHeight;
        stack.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
        stack.style.width = ratio < 1 ? 'min(100%, ' + (572 * ratio) + 'px, ' + (62.4 * ratio) + 'svh)' : 'min(100%, 570px)';
      };
    }
    card.append(img);
    stack.append(card);
  }
  stack.setAttribute('aria-label', '这组照片，第 ' + (readingPhoto + 1) + ' 张，共 ' + photos.length + ' 张，可左右滑动');
  stack.tabIndex = 0;
  $('albumCount').textContent = String(readingPhoto + 1).padStart(2, '0') + ' / ' + String(photos.length).padStart(2, '0');
  $('albumPrev').disabled = $('albumNext').disabled = photos.length < 2;
  $('photoCaption').textContent = albumPhoto().caption || '';
  $('photoAuthorActions').hidden = !isAuthor || visitor || !/^[a-f0-9]{64}$/.test(albumPhoto().id);
  $('photoManageStatus').textContent = '';
}
function showAlbumPhoto(remember = true) {
  if (remember) saveCommentDraft();
  renderPhotoStack();
  const draft = commentDrafts.get(albumPhoto().id);
  commentForm.elements.body.value = draft?.body || '';
  commentForm.elements.nickname.value = draft?.nickname || sessionStorage.getItem('zoe-comment-nickname') || '';
  commentForm.elements.nickname.closest('label').hidden = isAuthor && !visitor;
  replyTo = draft?.replyTo || null;
  commentRequestId = draft?.requestId || null;
  updateReplyContext();
  commentList.replaceChildren();
  renderPhotoComments(commentCache.get(albumPhoto().id) || []);
  $('commentStatus').textContent = '正在读取留言…';
  loadPhotoComments(true);
}
async function turnAlbumPhoto(step) {
  if (sendingComment || changingPhoto || !readingAlbum || readingAlbum.photos.length < 2) return;
  changingPhoto = true;
  const session = albumSession;
  saveCommentDraft();
  const top = stack.querySelector('[data-top]');
  if (!motionPreference.matches && top) {
    const distance = Math.max(220, stack.clientWidth * .9) * (step > 0 ? -1 : 1);
    outgoingAnimation = top.animate([{ transform: top.style.transform, opacity: 1 }, { transform: 'translateX(' + distance + 'px) rotate(' + (step > 0 ? -16 : 16) + 'deg)', opacity: 0 }], { duration: 220, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' });
    await outgoingAnimation.finished.catch(() => {});
    outgoingAnimation = null;
  }
  if (albumDialog.open && session === albumSession) {
    readingPhoto = (readingPhoto + step + readingAlbum.photos.length) % readingAlbum.photos.length;
    showAlbumPhoto(false);
    albumDialog.scrollTop = 0;
  }
  changingPhoto = false;
}
function renderPhotoComments(comments) {
  const known = new Set([...commentList.children].map(node => node.dataset.commentId));
  const byId = new Map(comments.map(comment => [comment.id, comment]));
  const nodes = comments.map((comment, index) => {
    const row = element('div', '');
    row.className = 'chat-message' + (comment.author ? ' from-zoe' : '');
    row.dataset.commentId = comment.id;
    const meta = element('div', '');
    meta.className = 'chat-meta';
    meta.append(element('strong', comment.nickname));
    if (comment.author) meta.append(element('span', '作者'));
    const time = element('time', new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(comment.createdAt)));
    time.dateTime = comment.createdAt;
    meta.append(time);
    const bubble = element('div', '');
    bubble.className = 'chat-bubble';
    const parent = byId.get(comment.parentId);
    if (parent) bubble.append(element('blockquote', '回复 ' + parent.nickname + '：' + (parent.deleted ? '这条评论已删除' : parent.body.slice(0, 70))));
    bubble.append(element('p', comment.deleted ? '这条评论已删除' : comment.body));
    if (comment.edited && !comment.deleted) meta.append(element('small','已编辑'));
    row.classList.toggle('comment-deleted', Boolean(comment.deleted));
    const reply = button('回复', () => {
      if (sendingComment) return;
      replyTo = { id: comment.id, nickname: comment.nickname };
      commentRequestId = null;
      updateReplyContext();
      $('commentBody').focus();
      saveCommentDraft();
    });
    reply.type = 'button'; reply.className = 'chat-reply';
    reply.setAttribute('aria-label', '回复 ' + comment.nickname + ' 的评论');
    const actions = element('div',''); actions.className = 'comment-actions';
    if (!comment.deleted) {
      const like = button((comment.liked ? '♥ ' : '♡ ') + (comment.likes || 0), () => updateCommentAction(comment, 'like', {liked:!comment.liked}));
      like.type = 'button'; like.className = 'comment-like';
      like.setAttribute('aria-pressed',String(Boolean(comment.liked)));
      like.setAttribute('aria-label',(comment.liked ? '取消点赞' : '点赞') + ' ' + comment.nickname + ' 的评论，' + (comment.likes || 0) + ' 个赞');
      actions.append(reply, like);
    }
    if (comment.canManage && (!isAuthor || !visitor)) {
      if (comment.deleted) actions.append(button('恢复评论', () => updateCommentAction(comment,'restore')));
      else {
        actions.append(button('编辑', () => openCommentEditor(comment,'edit')));
        actions.append(button('删除', () => openCommentEditor(comment,'delete')));
      }
    }
    row.append(meta, bubble, actions);
    row.dataset.appear = String(!known.has(comment.id));
    return row;
  });
  const nearBottom = commentList.scrollHeight - commentList.scrollTop - commentList.clientHeight < 70;
  const oldScroll = commentList.scrollTop;
  commentList.replaceChildren(...nodes);
  if (!nodes.length) commentList.append(element('p', '还没有留言，来写下第一句吧。'));
  if (nearBottom) commentList.scrollTop = commentList.scrollHeight;
  else commentList.scrollTop = oldScroll;
  if (!motionPreference.matches) nodes.filter(node => node.dataset.appear === 'true').forEach((node, index) => node.animate([
    { opacity: 0, transform: 'translateY(10px) scale(.85)' },
    { opacity: 1, transform: 'translateY(0) scale(1)' }
  ], { duration: 300, delay: Math.min(index * 70, 350), easing: 'cubic-bezier(.16,1,.3,1)' }));
}
async function loadPhotoComments(showStatus = false) {
  const photo = albumPhoto();
  if (!photo || !albumDialog.open) return;
  const epoch = ++commentEpoch;
  if (showStatus) $('commentStatus').textContent = '正在读取留言…';
  try {
    const comments = await cloudApi('/api/comments?photo=' + encodeURIComponent(photo.id), {headers:commentHeaders()});
    if (epoch !== commentEpoch || !albumDialog.open || photo.id !== albumPhoto()?.id) return;
    commentCache.set(photo.id, comments);
    renderPhotoComments(comments);
    $('commentStatus').textContent = comments.length ? comments.length + ' 条留言与回复' : '';
  } catch (error) { if (epoch === commentEpoch && albumDialog.open) $('commentStatus').textContent = error.message + ' 点击刷新可重试。'; }
}
commentForm.addEventListener('input', () => { commentRequestId = null; saveCommentDraft(); });
commentForm.onsubmit = async event => {
  event.preventDefault();
  const photo = albumPhoto();
  const body = commentForm.elements.body.value.trim();
  if (!photo || !body || sendingComment) return;
  sendingComment = true;
  commentForm.inert = true;
  $('closeAlbum').disabled = true;
  commentForm.querySelector('.comment-sending').hidden = false;
  commentRequestId ||= crypto.randomUUID();
  saveCommentDraft();
  $('commentStatus').textContent = '正在发送…';
  try {
    const nickname = commentForm.elements.nickname.value.trim();
    await cloudApi('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json', ...commentHeaders() }, body: JSON.stringify({ id: commentRequestId, photoId: photo.id, body, nickname, parentId: replyTo?.id || null }) });
    sessionStorage.setItem('zoe-comment-nickname', nickname);
    commentForm.elements.body.value = '';
    replyTo = null;
    commentRequestId = null;
    updateReplyContext();
    saveCommentDraft();
    await loadPhotoComments(true);
    commentList.scrollTop = commentList.scrollHeight;
  } catch (error) { $('commentStatus').textContent = error.message + ' 内容已保留，可以重试。'; }
  finally {
    sendingComment = false;
    commentForm.inert = false;
    $('closeAlbum').disabled = false;
    commentForm.querySelector('.comment-sending').hidden = true;
  }
};
$('cancelReply').onclick = () => { replyTo = null; commentRequestId = null; updateReplyContext(); saveCommentDraft(); };
$('refreshComments').onclick = () => { if (!sendingComment) loadPhotoComments(true); };
$('albumPrev').onclick = () => turnAlbumPhoto(-1);
$('albumNext').onclick = () => turnAlbumPhoto(1);
$('closeAlbum').onclick = () => albumDialog.close();
albumDialog.addEventListener('cancel', event => { if (sendingComment) event.preventDefault(); });
albumDialog.addEventListener('close', () => {
  ++albumSession;
  saveCommentDraft();
  ++commentEpoch;
  clearInterval(commentTimer);
  outgoingAnimation?.cancel();
  photoDrag = null;
});
stack.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); turnAlbumPhoto(event.key === 'ArrowLeft' ? -1 : 1); }
});
stack.addEventListener('pointerdown', event => {
  if (sendingComment || changingPhoto || readingAlbum.photos.length < 2 || (event.pointerType === 'mouse' && event.button !== 0)) return;
  photoDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, moving: false };
});
stack.addEventListener('pointermove', event => {
  if (!photoDrag || photoDrag.id !== event.pointerId) return;
  const dx = event.clientX - photoDrag.x;
  const dy = event.clientY - photoDrag.y;
  if (!photoDrag.moving && (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy))) return;
  if (!photoDrag.moving) stack.setPointerCapture(event.pointerId);
  photoDrag.moving = true;
  photoDrag.dx = dx;
  event.preventDefault();
  const top = stack.querySelector('[data-top]');
  top.style.transition = 'none';
  top.style.transform = 'translateX(' + dx * .8 + 'px) rotate(' + dx / 24 + 'deg) scale(1.025)';
});
function endPhotoDrag(event) {
  if (!photoDrag || photoDrag.id !== event.pointerId) return;
  const { dx, moving } = photoDrag;
  photoDrag = null;
  if (moving && event.type !== 'pointercancel' && Math.abs(dx) > 50) turnAlbumPhoto(dx < 0 ? 1 : -1);
  else {
    const top = stack.querySelector('[data-top]');
    if (top) { top.style.transition = motionPreference.matches ? 'none' : 'transform 300ms cubic-bezier(.16,1,.3,1)'; top.style.transform = 'translate3d(0,0,0)'; }
  }
}
stack.addEventListener('pointerup', endPhotoDrag);
stack.addEventListener('pointercancel', endPhotoDrag);
stack.addEventListener('lostpointercapture', endPhotoDrag);

// Author-only cloud photo management. Deletion is reversible and keeps comments.
let managingPhoto = false;
let editingPhotoId = null;
const photoTextForm = $('photoTextForm');
const canManagePhoto = () => isAuthor && !visitor && /^[a-f0-9]{64}$/.test(albumPhoto()?.id || '');
function setPhotoManagementBusy(busy) {
  managingPhoto = busy;
  photoTextForm.inert = busy;
  $('confirmPhotoDelete').disabled = $('cancelPhotoDelete').disabled = busy;
}
async function managePhoto(data) {
  return cloudApi('/api/photo-management', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(data) });
}
async function refreshReadingAlbum() {
  const albumId = readingAlbum?.id;
  const photoId = albumPhoto()?.id;
  const previousIndex = readingPhoto;
  await loadUpdates();
  const fresh = updates.find(update => update.album.id === albumId)?.album;
  if (!fresh) { albumDialog.close(); return; }
  readingAlbum = fresh;
  const samePhoto = fresh.photos.findIndex(photo => photo.id === photoId);
  readingPhoto = samePhoto < 0 ? Math.min(previousIndex, fresh.photos.length - 1) : samePhoto;
  $('albumHeading').textContent = fresh.title;
  $('albumMeta').textContent = new Intl.DateTimeFormat('zh-CN', {timeZone:'America/Los_Angeles', year:'numeric', month:'long', day:'numeric'}).format(new Date(fresh.createdAt)) + ' · ' + fresh.photos.length + ' 张照片';
  showAlbumPhoto(false);
}
$('editPhotoText').onclick = () => {
  if (!canManagePhoto() || sendingComment || changingPhoto || managingPhoto) return;
  editingPhotoId = albumPhoto().id;
  photoTextForm.elements.title.value = readingAlbum.title;
  photoTextForm.elements.caption.value = albumPhoto().caption;
  $('photoTextStatus').textContent = '';
  $('photoTextEditor').showModal();
};
$('cancelPhotoText').onclick = () => { if (!managingPhoto) $('photoTextEditor').close(); };
$('photoTextEditor').addEventListener('cancel', event => { if (managingPhoto) event.preventDefault(); });
photoTextForm.onsubmit = async event => {
  event.preventDefault();
  if (managingPhoto || !canManagePhoto() || albumPhoto().id !== editingPhotoId) return;
  saveCommentDraft();
  setPhotoManagementBusy(true);
  $('photoTextStatus').textContent = '正在保存到云端…';
  try {
    await managePhoto({ action:'edit', id:editingPhotoId, albumId:readingAlbum.id, title:photoTextForm.elements.title.value, caption:photoTextForm.elements.caption.value });
    await refreshReadingAlbum();
    $('photoTextEditor').close();
    $('photoManageStatus').textContent = '文字已保存到云端。';
  } catch (error) { $('photoTextStatus').textContent = error.message; }
  finally { setPhotoManagementBusy(false); }
};
$('deletePhoto').onclick = () => {
  if (!canManagePhoto() || sendingComment || changingPhoto || managingPhoto) return;
  editingPhotoId = albumPhoto().id;
  $('photoDeleteStatus').textContent = '';
  $('photoDeleteConfirm').showModal();
};
$('cancelPhotoDelete').onclick = () => { if (!managingPhoto) $('photoDeleteConfirm').close(); };
$('photoDeleteConfirm').addEventListener('cancel', event => { if (managingPhoto) event.preventDefault(); });
$('confirmPhotoDelete').onclick = async () => {
  if (managingPhoto || !canManagePhoto() || albumPhoto().id !== editingPhotoId) return;
  saveCommentDraft();
  setPhotoManagementBusy(true);
  $('photoDeleteStatus').textContent = '正在移除…';
  try {
    await managePhoto({action:'delete',id:editingPhotoId});
    await refreshReadingAlbum();
    $('photoDeleteConfirm').close();
    $('photoManageStatus').textContent = '已移除，可在“已删除照片”中恢复。';
  } catch (error) { $('photoDeleteStatus').textContent = error.message; }
  finally { setPhotoManagementBusy(false); }
};
let restoringPhoto = false;
async function renderPhotoTrash() {
  $('photoTrashStatus').textContent = '正在读取…';
  const photos = await cloudApi('/api/photo-trash');
  $('photoTrashList').replaceChildren(...photos.map(photo => {
    const item = element('div', ''); item.className = 'trash-photo';
    const image = new Image(); image.src = photo.src; image.alt = photo.caption || '已删除照片';
    const restore = button('恢复照片', async () => {
      if (restoringPhoto) return;
      restoringPhoto = true; $('photoTrashList').inert = true;
      $('photoTrashStatus').textContent = '正在恢复…';
      try { await managePhoto({action:'restore', id:photo.id}); await loadUpdates(); await renderPhotoTrash(); }
      catch (error) { $('photoTrashStatus').textContent = error.message; }
      finally { restoringPhoto = false; $('photoTrashList').inert = false; }
    });
    item.append(image, element('p',photo.caption || '未添加说明'),restore); return item;
  }));
  $('photoTrashStatus').textContent = photos.length ? '恢复后会回到原来的照片组，留言也会保留。' : '没有已删除的照片。';
}
$('openPhotoTrash').onclick = async () => {
  if (!isAuthor || visitor) return;
  $('photoTrash').showModal();
  try { await renderPhotoTrash(); } catch (error) { $('photoTrashStatus').textContent = error.message; }
};
$('closePhotoTrash').onclick = () => { if (!restoringPhoto) $('photoTrash').close(); };
$('photoTrash').addEventListener('cancel', event => { if (restoringPhoto) event.preventDefault(); });

let commentActionBusy = false;
let commentBeingEdited = null;
let commentEditMode = 'edit';
function openCommentEditor(comment, action) {
  if (commentActionBusy || sendingComment) return;
  commentBeingEdited = {id:comment.id,photoId:albumPhoto().id};
  commentEditMode = action;
  $('commentEditorHeading').textContent = action === 'delete' ? '删除这条评论？' : '编辑评论';
  $('commentEditLabel').hidden = action === 'delete';
  $('commentDeleteNote').hidden = action !== 'delete';
  $('commentEditForm').elements.body.value = comment.body;
  $('commentEditForm').elements.body.required = action !== 'delete';
  $('saveCommentEdit').textContent = action === 'delete' ? '删除评论' : '保存评论';
  $('commentEditStatus').textContent = '';
  $('commentEditor').showModal();
}
async function sendCommentAction(comment, action, extra = {}) {
  await cloudApi('/api/comment-actions',{method:'POST',headers:{'Content-Type':'application/json',...commentHeaders()},body:JSON.stringify({id:comment.id,photoId:comment.photoId || albumPhoto().id,action,...extra})});
}
async function updateCommentAction(comment, action, extra = {}) {
  if (commentActionBusy) return;
  const photoId = albumPhoto().id;
  commentActionBusy = true; commentList.inert = true;
  try {
    await sendCommentAction({...comment,photoId},action,extra);
    if (albumPhoto()?.id === photoId && albumDialog.open) await loadPhotoComments(true);
  } catch (error) { if (albumPhoto()?.id === photoId) $('commentStatus').textContent = error.message; }
  finally { commentActionBusy = false; commentList.inert = false; }
}
$('commentEditForm').onsubmit = async event => {
  event.preventDefault();
  if (commentActionBusy || !commentBeingEdited) return;
  commentActionBusy = true; $('commentEditForm').inert = true;
  $('commentEditStatus').textContent = '正在保存…';
  try {
    await sendCommentAction(commentBeingEdited,commentEditMode,{body:$('commentEditForm').elements.body.value});
    if (albumPhoto()?.id === commentBeingEdited.photoId && albumDialog.open) {
      if (commentEditMode === 'delete' && replyTo?.id === commentBeingEdited.id) { replyTo = null; updateReplyContext(); saveCommentDraft(); }
      await loadPhotoComments(true);
    }
    $('commentEditor').close();
  } catch (error) { $('commentEditStatus').textContent = error.message; }
  finally { commentActionBusy = false; $('commentEditForm').inert = false; }
};
$('cancelCommentEdit').onclick = () => { if (!commentActionBusy) $('commentEditor').close(); };
$('commentEditor').addEventListener('cancel',event=>{if(commentActionBusy)event.preventDefault();});

// Manage the current upload batch without replacing its coverflow entry or comments.
let managingAlbum = false;
let managedAlbumId = null;
let managedAlbumTitle = '';
let pendingAlbumUploads = [];
let managerLayoutRevision=0;
let managerCoverId=null;
let albumSortDrag=null;
function drawAlbumManager() {
  const album=updates.find(update=>update.album.id===managedAlbumId)?.album;
  managerLayoutRevision=album?.layoutRevision || 0;
  managerCoverId=album?.coverId || album?.photos[0]?.id || null;
  $('albumManagerTitle').textContent=album?album.title+' · '+album.photos.length+' 张照片':managedAlbumTitle+' · 0 张照片';
  $('albumManagerGrid').replaceChildren(...(album?.photos || []).map((photo,index)=>{
    const item=element('div','');item.className='album-manager-photo';item.dataset.photoId=photo.id;
    const handle=button('⠿ 拖动排序',()=>{});handle.type='button';handle.className='album-sort-handle';handle.setAttribute('aria-label','拖动排序，第 '+(index+1)+' 张照片');
    handle.onpointerdown=event=>beginAlbumSort(event,item,handle);
    handle.onkeydown=event=>{if(['ArrowLeft','ArrowUp','ArrowRight','ArrowDown'].includes(event.key)){event.preventDefault();moveAlbumPhoto(photo.id,['ArrowLeft','ArrowUp'].includes(event.key)?-1:1);}};
    const position=element('span','第 '+(index+1)+' 张');position.className='album-photo-position';
    const cover=button(photo.id===managerCoverId?'当前封面':'设为封面',()=>saveAlbumLayout(managerOrderIds(),photo.id));cover.type='button';cover.className='album-set-cover';cover.disabled=photo.id===managerCoverId;cover.setAttribute('aria-pressed',String(photo.id===managerCoverId));
    const moves=element('div','');moves.className='album-order-actions';
    const previous=button('前移',()=>moveAlbumPhoto(photo.id,-1)),next=button('后移',()=>moveAlbumPhoto(photo.id,1));
    previous.type=next.type='button';previous.disabled=index===0;next.disabled=index===(album?.photos.length || 0)-1;previous.setAttribute('aria-label','前移第 '+(index+1)+' 张照片');next.setAttribute('aria-label','后移第 '+(index+1)+' 张照片');moves.append(previous,next);
    const image=new Image();image.src=photo.src;image.alt=photo.caption || '组内照片';image.loading='lazy';
    let armed=false;
    const cancel=button('取消',()=>{armed=false;remove.textContent='删除照片';cancel.hidden=true;});cancel.type='button';cancel.hidden=true;
    const remove=button('删除照片',async()=>{
      if(managingAlbum)return;
      if(!armed){armed=true;remove.textContent='确认删除';cancel.hidden=false;return;}
      setAlbumBusy(true);$('albumManagerStatus').textContent='正在删除…';
      try {
        await managePhoto({action:'delete',id:photo.id});
        await refreshReadingAlbum();drawAlbumManager();
        $('albumManagerStatus').textContent='已删除，可在“已删除照片”恢复。';
      } catch(error){$('albumManagerStatus').textContent=error.message;}
      finally{setAlbumBusy(false);}
    });remove.type='button';
    item.append(handle,position,image,cover,moves,element('p',photo.caption || '未添加说明'),remove,cancel);return item;
  }));
  $('appendAlbumPhotos').disabled=managingAlbum;
}
function setAlbumBusy(busy) {
  managingAlbum=busy;
  $('albumManagerGrid').inert=busy;
  $('appendAlbumPhotos').disabled=$('closeAlbumManager').disabled=busy;
}
function openAlbumManager() {
  if(!isAuthor || visitor || !readingAlbum || readingAlbum.id==='welcome-album' || managingAlbum || albumSortDrag)return;
  managedAlbumId=readingAlbum.id;managedAlbumTitle=readingAlbum.title;pendingAlbumUploads=[];
  $('albumManagerStatus').textContent='';drawAlbumManager();$('albumManager').showModal();
}
$('openAlbumManager').onclick=$('manageAlbumFromPhoto').onclick=openAlbumManager;
$('closeAlbumManager').onclick=()=>{cancelAlbumSort();if(!managingAlbum){$('albumManager').close();const album=updates.find(row=>row.album.id===managedAlbumId)?.album;if(album&&!albumDialog.open)openAlbum(album);}};
$('albumManager').addEventListener('cancel',event=>{if(managingAlbum)event.preventDefault();cancelAlbumSort();});
$('albumManager').addEventListener('close',cancelAlbumSort);
$('appendAlbumPhotos').onclick=()=>{if(!managingAlbum)$('albumNewPhotos').click();};
$('albumNewPhotos').onchange=async event=>{
  const files=Array.from(event.target.files);event.target.value='';
  if(!files.length || managingAlbum || !isAuthor || visitor)return;
  if(files.length>50){$('albumManagerStatus').textContent='每次最多追加 50 张照片。';return;}
  setAlbumBusy(true);
  const albumId=managedAlbumId;
  try {
    // Retain uploaded IDs across a partial failure so retrying never loses a photo.
    for(let index=0;index<files.length;index++) {
      $('albumManagerStatus').textContent='正在上传 '+(index+1)+' / '+files.length+'…';
      const src=await processPhoto(files[index]);
      const result=await uploadCloudPhoto(src,files[index].name.replace(/\.[^.]+$/,''));
      pendingAlbumUploads.push(result.id);
    }
    const result=await cloudApi('/api/album-management',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:albumId,photoIds:[...new Set(pendingAlbumUploads)]})});
    pendingAlbumUploads=[];managedAlbumId=result.id;
    if(readingAlbum)readingAlbum.id=result.id;
    await refreshReadingAlbum();drawAlbumManager();
    $('albumManagerStatus').textContent='新照片已添加到这一组并保存到云端。';
  } catch(error) {
    // Successfully uploaded photos remain in cloud storage even if attaching fails.
    await loadUpdates().catch(()=>{});
    $('albumManagerStatus').textContent=error.message+' 已上传的照片已保留在云端，可重新选择照片后重试。';
  } finally{setAlbumBusy(false);}
};

function managerOrderIds() { return [...$('albumManagerGrid').children].map(node=>node.dataset.photoId); }
async function saveAlbumLayout(orderIds,coverId=managerCoverId,focusId=null) {
  if(managingAlbum || !isAuthor || visitor || !orderIds.length)return;
  const albumId=managedAlbumId,expectedRevision=managerLayoutRevision;
  setAlbumBusy(true);$('albumManagerStatus').textContent='正在保存顺序与封面…';
  try {
    await cloudApi('/api/album-layout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:albumId,orderIds,coverId,expectedRevision})});
    await refreshReadingAlbum();drawAlbumManager();
    $('albumManagerStatus').textContent='顺序与封面已保存到云端，手机和电脑会同步显示。';
  } catch(error) {
    await refreshReadingAlbum().catch(()=>{});drawAlbumManager();
    $('albumManagerStatus').textContent=error.message+' 如网络中断，请重新打开照片管理核对保存结果。';
  } finally {
    setAlbumBusy(false);
    if(focusId && $('albumManager').open) [...$('albumManagerGrid').children].find(node=>node.dataset.photoId===focusId)?.querySelector('.album-sort-handle')?.focus({preventScroll:true});
  }
}
function moveAlbumPhoto(id,step) {
  if(managingAlbum || albumSortDrag)return;
  const ids=managerOrderIds(),index=ids.indexOf(id),target=index+step;
  if(index<0 || target<0 || target>=ids.length)return;
  [ids[index],ids[target]]=[ids[target],ids[index]];
  // Move immediately, then confirm the same order with the cloud.
  const nodes=new Map([...$('albumManagerGrid').children].map(node=>[node.dataset.photoId,node]));
  $('albumManagerGrid').append(...ids.map(id=>nodes.get(id)));
  saveAlbumLayout(ids,managerCoverId,id);
}
function beginAlbumSort(event,item,handle) {
  if(managingAlbum || albumSortDrag || (event.pointerType==='mouse' && event.button!==0))return;
  event.preventDefault();
  handle.setPointerCapture(event.pointerId);
  handle.setAttribute('aria-pressed','true');
  albumSortDrag={pointerId:event.pointerId,item,handle,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,rect:item.getBoundingClientRect(),original:managerOrderIds(),ghost:null,frame:0};
}
function paintAlbumSort() {
  const drag=albumSortDrag;if(!drag)return;
  if(!drag.ghost) {
    drag.ghost=drag.item.cloneNode(true);drag.ghost.className='album-manager-photo album-sort-ghost';drag.ghost.setAttribute('aria-hidden','true');drag.ghost.inert=true;
    Object.assign(drag.ghost.style,{left:drag.rect.left+'px',top:drag.rect.top+'px',width:drag.rect.width+'px',height:drag.rect.height+'px'});
    $('albumManager').append(drag.ghost);drag.item.classList.add('is-drag-source');
    $('albumManagerStatus').textContent='拖到想放的位置，松手后自动保存。';
  }
  const dialog=$('albumManager'),bounds=dialog.getBoundingClientRect();
  if(drag.y<bounds.top+65)dialog.scrollTop-=10;
  else if(drag.y>bounds.bottom-65)dialog.scrollTop+=10;
  placeAlbumSort(drag);
  drag.ghost.style.transform='translate3d('+(drag.x-drag.startX)+'px,'+(drag.y-drag.startY)+'px,0)';
  drag.frame=requestAnimationFrame(paintAlbumSort);
}
function placeAlbumSort(drag) {
  const target=document.elementFromPoint(drag.x,drag.y)?.closest('#albumManagerGrid > .album-manager-photo');
  if(target && target!==drag.item) {
    const nodes=[...$('albumManagerGrid').children];
    if(nodes.indexOf(drag.item)<nodes.indexOf(target))target.after(drag.item);else target.before(drag.item);
    drag.handle.setPointerCapture(drag.pointerId);
    [...$('albumManagerGrid').children].forEach((node,index)=>{node.querySelector('.album-photo-position').textContent='第 '+(index+1)+' 张';});
  }
}
document.addEventListener('pointermove',event=>{
  const drag=albumSortDrag;if(!drag || event.pointerId!==drag.pointerId)return;
  drag.x=event.clientX;drag.y=event.clientY;
  if(!drag.frame && Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>7)drag.frame=requestAnimationFrame(paintAlbumSort);
  if(drag.frame)event.preventDefault();
},{passive:false});
function finishAlbumSort(event) {
  const drag=albumSortDrag;if(!drag || event.pointerId!==drag.pointerId)return;
  drag.x=event.clientX;drag.y=event.clientY;
  if(Math.hypot(drag.x-drag.startX,drag.y-drag.startY)>7)placeAlbumSort(drag);
  const next=managerOrderIds(),moved=next.join(',')!==drag.original.join(',');
  albumSortDrag=null;cancelAnimationFrame(drag.frame);drag.ghost?.remove();drag.item.classList.remove('is-drag-source');drag.handle.setAttribute('aria-pressed','false');
  if(drag.handle.hasPointerCapture(drag.pointerId))drag.handle.releasePointerCapture(drag.pointerId);
  if(moved)saveAlbumLayout(next,managerCoverId,drag.item.dataset.photoId);
  else {$('albumManagerStatus').textContent='顺序未改变。';drawAlbumManager();}
}
function cancelAlbumSort() {
  const drag=albumSortDrag;if(!drag)return;
  albumSortDrag=null;cancelAnimationFrame(drag.frame);drag.ghost?.remove();drag.item.classList.remove('is-drag-source');drag.handle.setAttribute('aria-pressed','false');
  if(drag.handle.hasPointerCapture(drag.pointerId))drag.handle.releasePointerCapture(drag.pointerId);
  drawAlbumManager();
}
document.addEventListener('pointerup',finishAlbumSort);
document.addEventListener('pointercancel',cancelAlbumSort);

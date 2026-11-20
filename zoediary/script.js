const categories=['课堂与活动','我的思考','随心记录','朋友问答'];
const examples=[];
const $=id=>document.getElementById(id),storageKey='jiji-fieldnotes-v1';
let records=JSON.parse(localStorage.getItem(storageKey)??JSON.stringify(examples));
let visitor = true, filter = '全部', editing = null;
let isAuthor = false;
let cloudLetters = [];
let cloudDeletedLetters = [];
let cloudReady = false;
let entryCovers = new Map();
function save(next){try{localStorage.setItem(storageKey,JSON.stringify(next));records=next;return true}catch{alert('暂时无法保存。浏览器存储可能已满，请减少照片后再试。');return false}}
function element(tag,value){const node=document.createElement(tag);node.textContent=value;return node}
function button(label,action){const node=element('button',label);node.onclick=action;return node}
function view(){
 if (typeof renderAuthorEntry === 'function') renderAuthorEntry();
 $('mode').hidden = !isAuthor;
 $('addUpdate').hidden = !isAuthor || visitor;
 $('openPhotoTrash').hidden = !isAuthor || visitor;
 $('openEntryTrash').hidden = !isAuthor || visitor;
 $('mode').textContent=visitor?'返回作者视角':'切换访客预览';$('new').hidden=visitor;document.body.classList.toggle('visitor',visitor);
 $('view').textContent=visitor?'访客预览 · 仅显示公开内容':'作者视角 · 含私人记录';
 $('tabs').replaceChildren(...['全部',...categories].map(category=>{const tab=button(category,()=>{filter=category;view()});tab.className=filter===category?'primary':'';tab.setAttribute('aria-pressed',String(filter===category));return tab}));
 const visible = visibleEntries(records, visitor);
 const letters = visible.filter(record => record.category === categories[3]);
 $('letterHighlights').replaceChildren(...letters.slice(0, 3).map(createEnvelope));
 if (!letters.length) $('letterHighlights').append(element('p', '暂时没有公开来信，写下想问我的事吧。'));
 $('allLetters').textContent = '全部来信 / All letters (' + letters.length + ') ↗';
 const shown=visible.filter(record=>record.category!==categories[3]&&(filter==='全部'||record.category===filter));
 $('entries').replaceChildren(...shown.map(record => {
   const row = element('article', '');
   row.dataset.category = record.category;
   row.append(createTicketSticker(record));
   const detail = categoryDetails.find(category => category.title === record.category);
   row.append(element('small', record.category + ' / ' + (detail?.english || '') + (visitor ? '' : record.visibility === 'public' ? ' · 公开' : ' · 仅自己可见')), element('time', entryDateLabel(record)), element('h3', record.title));
   const excerpt = element('p', openingParagraph(record));
   excerpt.className = 'entry-excerpt';
   row.append(excerpt);
   row.append(button('阅读全文 / Read ↗', () => openDiaryEntry(record, shown)));
   if (!visitor && isAuthor) row.append(button('编辑', () => edit(record)), button('删除', () => askDeleteEntry(record)));
   return row;
 }));
 if(!shown.length)$('entries').append(element('p',filter===categories[3]?'朋友来信已置顶，点击「全部来信」浏览。':'这个栏目暂时没有可显示的内容。'));
 refreshChapterCovers();
 document.dispatchEvent(new Event('diary:records-changed'));
}
const fields=$('editForm').elements,prose=$('prose');let cursor=null,selectedPhoto=null,uploading=false;
function cleanContent(source){const result=document.createDocumentFragment(),tags=new Set(['P','DIV','BR','H4','B','STRONG','I','EM','UL','OL','LI','IMG']);function copy(node,parent){if(node.nodeType===Node.TEXT_NODE){parent.append(node.cloneNode());return}if(node.nodeType!==Node.ELEMENT_NODE)return;if(!tags.has(node.tagName)){node.childNodes.forEach(child=>copy(child,parent));return}const next=document.createElement(node.tagName);if(node.tagName==='IMG'){const src=node.getAttribute('src')||'';if(!/^data:image\/(webp|png|jpeg);base64,[a-z0-9+/=]+$/i.test(src))return;next.src=src;next.alt=node.alt;next.draggable=false;next.style.width=Math.min(100,Math.max(10,parseInt(node.style.width,10)||100))+'%';next.dataset.align=['left','right','center'].includes(node.dataset.align)?node.dataset.align:'center'}if(['left','center','right'].includes(node.style.textAlign))next.style.textAlign=node.style.textAlign;node.childNodes.forEach(child=>copy(child,next));parent.append(next)}source.childNodes.forEach(node=>copy(node,result));return result}
function storedContent(record){if(record.richBody!=null){const template=document.createElement('template');template.innerHTML=record.richBody;return cleanContent(template.content)}const holder=document.createElement('div');for(const block of record.blocks??[{type:'text',value:record.body??''}]){if(block.type==='image'){const img=document.createElement('img');img.src=block.value;img.alt=block.alt||'';img.style.width=block.layout==='small'?'50%':'100%';holder.append(img);continue}const line=element(block.type==='heading'?'h4':'p',block.value);line.style.textAlign=block.layout==='center'?'center':'left';holder.append(line)}return cleanContent(holder)}
function appendContent(row,record){const body=element('div','');body.className='article-prose';body.append(storedContent(record));row.append(body)}
function openingParagraph(record) {
  const source = storedContent(record);
  const paragraphs = [];
  let current = '';
  function flush() { const text = current.replace(/\s+/g, ' ').trim(); if (text) paragraphs.push(text); current = ''; }
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const parts = node.textContent.split(/\r?\n/);
      parts.forEach((part, index) => { if (index) flush(); current += part; });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;
    if (node.nodeName === 'IMG' || node.nodeName === 'H4') return;
    const block = ['P', 'DIV', 'LI', 'UL', 'OL'].includes(node.nodeName);
    if (block || node.nodeName === 'BR') flush();
    node.childNodes.forEach(walk);
    if (block) flush();
  }
  walk(source); flush();
  return paragraphs[0] || '';
}
document.addEventListener('selectionchange',()=>{const selection=getSelection();if(selection.rangeCount&&prose.contains(selection.getRangeAt(0).commonAncestorContainer))cursor=selection.getRangeAt(0).cloneRange()});
function restoreCursor(){prose.focus();const selection=getSelection(),range=document.createRange();range.selectNodeContents(prose);range.collapse(false);selection.removeAllRanges();selection.addRange(cursor&&prose.contains(cursor.commonAncestorContainer)?cursor:range)}
function selectPhoto(img){selectedPhoto?.removeAttribute('data-selected');selectedPhoto=img;$('imageTools').hidden=!img;if(img){img.dataset.selected='true';$('imageSize').value=parseInt(img.style.width,10)||100;$('imagePercent').value=$('imageSize').value+'%';$('imageAlt').value=img.alt}}
prose.onclick=event=>selectPhoto(event.target instanceof HTMLImageElement?event.target:null);prose.oninput=()=>{if(selectedPhoto&&!prose.contains(selectedPhoto))selectPhoto(null)};prose.onpaste=event=>{event.preventDefault();document.execCommand('insertText',false,event.clipboardData.getData('text/plain'))};prose.ondrop=event=>event.preventDefault();
document.querySelectorAll('[data-format]').forEach(control=>{control.onmousedown=event=>event.preventDefault();control.onclick=()=>{restoreCursor();selectPhoto(null);document.execCommand(control.dataset.format,false,control.dataset.value??null)}});
$('photo').onmousedown=event=>event.preventDefault();$('photo').onclick=()=>$('photos').click();$('imageSize').oninput=()=>{if(selectedPhoto)selectedPhoto.style.width=$('imageSize').value+'%';$('imagePercent').value=$('imageSize').value+'%'};$('imageAlt').oninput=()=>{if(selectedPhoto)selectedPhoto.alt=$('imageAlt').value};document.querySelectorAll('[data-image-align]').forEach(control=>{control.onclick=()=>{if(selectedPhoto)selectedPhoto.dataset.align=control.dataset.imageAlign}});$('removePhoto').onclick=()=>{selectedPhoto?.remove();selectPhoto(null);prose.focus()};
async function processPhoto(file,max=1400,quality=.8){const url=URL.createObjectURL(file);try{const img=new Image();img.src=url;await img.decode();const ratio=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/webp',quality)}finally{URL.revokeObjectURL(url)}}
$('photos').onchange=async event=>{const files=Array.from(event.target.files);event.target.value='';if(!files.length)return;uploading=true;$('photo').disabled=true;const form=$('editForm');form.inert=true;try{const results=await Promise.allSettled(files.map(file=>processPhoto(file)));const images=results.filter(result=>result.status==='fulfilled').map(result=>result.value);form.inert=false;if(images.length&&$('editor').open){restoreCursor();getSelection().collapseToEnd();const holder=document.createElement('div');for(const src of images){const img=document.createElement('img');img.src=src;img.alt='';img.style.width='65%';img.dataset.align='center';img.draggable=false;holder.append(img)}holder.append(document.createTextNode(' '));document.execCommand('insertHTML',false,holder.innerHTML)}if(images.length!==files.length)alert('部分照片无法读取，请尝试 JPG、PNG 或 WebP。')}finally{form.inert=false;uploading=false;$('photo').disabled=false}};
$('editor').addEventListener('cancel',event=>{if(uploading)event.preventDefault()});for(const category of categories)fields.category.add(new Option(category,category));function showReply(){const qa=fields.category.value===categories[3];$('replyLabel').hidden=!qa;fields.reply.required=qa&&fields.visibility.value==='public';$('topicLabel').hidden=fields.category.value!==categories[0]}fields.category.onchange=fields.visibility.onchange=showReply;
function localDateInput(stamp) { const date = new Date(stamp); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function edit(record){if(record?.category===categories[3]){openLetterReply(record);return;}editing=record;$('editHeading').textContent=record?'编辑内容':'写一篇';fields.title.value=record?.title??'';fields.category.value=record?.category??(categories.includes(filter)?filter:categories[0]);fields.topic.value=record?classTopicOf(record):($('journalPage').dataset.topic||classTopics[0]);fields.publishedAt.value=record?(entryTimestamp(record)?localDateInput(entryTimestamp(record)):''):localDateInput(Date.now());cursor=null;selectPhoto(null);prose.replaceChildren(...(record?[storedContent(record)]:[]));fields.reply.value=record?.reply??'';fields.visibility.value=record?.visibility??'private';showReply();$('editor').showModal()}
$('editForm').onsubmit = async event => {
  event.preventDefault();
  if (!isAuthor || uploading) return;
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const content = element('div', '');
  content.append(cleanContent(prose));
  if (!data.title.trim() || (!content.textContent.trim() && !content.querySelector('img')) || (fields.reply.required && !data.reply.trim())) {
    alert('请填写标题、正文，并为公开问答填写回复。');
    return;
  }
  const record = { ...editing, ...data, id: editing?.id ?? crypto.randomUUID(), richBody: content.innerHTML, body: content.textContent.trim(),
    topic: data.category === categories[0] ? data.topic : null,
    createdAt: editing ? (editing.createdAt || null) : new Date().toISOString(),
    publishedAt: data.publishedAt ? new Date(data.publishedAt).toISOString() : (editing?.publishedAt || editing?.createdAt || null),
    updatedAt: new Date().toISOString()
  };
  const submit = event.submitter;
  submit.disabled = true;
  try {
    await syncCoverVisibility(record);
    if (record.category === categories[3]) {
      await cloudApi('/api/letters', { method: 'POST', body: JSON.stringify(record), headers: { 'Content-Type': 'application/json' } });
      await loadLetters();
    } else {
      await saveCloudArticle(record);
    }
    filter = record.category;
    $('editor').close();
    view();
    document.dispatchEvent(new CustomEvent('diary:entry-saved', { detail: { id: record.id } }));
    if ($('journalPage').hidden) $('notes').scrollIntoView();
  } catch (error) { alert(error.message); }
  finally { submit.disabled = false; }
};
$('askForm').onsubmit = async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const submit = event.submitter;
  submit.disabled = true;
  try {
    await cloudApi('/api/letters', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...commentHeaders() },
      body: JSON.stringify({ action:form.dataset.senderEdit?'sender-edit':undefined, id: form.dataset.letterId || (form.dataset.letterId = crypto.randomUUID()), body: data.get('message').trim(), nickname: data.get('nickname').trim() })
    });
    await form.animate([
      { transform: 'perspective(1000px) rotateX(0deg)', opacity: 1 },
      { transform: 'perspective(1000px) rotateX(20deg) scale(.94)', opacity: .25 }
    ], { duration: motionPreference.matches ? 1 : 350, easing: 'cubic-bezier(.23,1,.32,1)' }).finished;
    form.reset();
    delete form.dataset.letterId;
    delete form.dataset.senderEdit;
    $('askHeading').textContent='给己己写封信';
    $('question').close();
    await loadLetters();
    filter = categories[3];
    view();
    $('notes').scrollIntoView();
    $('cloudNotice').textContent = '信已寄出，己己回复并公开后会出现在这里。';
  } catch (error) { alert(error.message); }
  finally { submit.disabled = false; }
};
document.querySelectorAll('[data-close]').forEach(node=>node.onclick=()=>node.closest('dialog').close());$('mode').onclick=()=>{visitor=!visitor;view();($('journalPage').hidden?$('notes'):$('journalPage')).scrollIntoView()};$('ask').onclick=()=>$('question').showModal();$('new').onclick=()=>edit(null);

const motionPreference=matchMedia('(prefers-reduced-motion: reduce)'),scrollMotion=motionPreference.matches?'instant':'smooth',track=$('coverTrack');
const covers=[['课','一堂课结束后，还有哪些问题值得接着问？','#FFE88D','#002676'],['想','把还在琢磨的事，慢慢写清楚。','#D9CEFF','#431170'],['记','记下在伯克利生活时，偶然留意到的小事。','#B3E59A','#00553A'],['问','把你想问的事留在这里。','#FFCFE5','#770747']];let currentCover=0;
covers.forEach(([mark,description,background,ink],index)=>{
 const info=categoryDetails[index], panel=element('div','');panel.className='cover cover-with-photo';panel.style.setProperty('--cover-bg',background);panel.style.setProperty('--cover-ink',ink);
 const image=new Image();image.src=info.image;image.alt='';image.loading='lazy';image.className='cover-photo';image.style.objectPosition=info.position;
 const copy=element('div','');copy.className='cover-copy';const open=button('进入栏目 / Explore ↗',()=>openJournal(index));open.setAttribute('aria-label','进入'+info.title+'栏目');
 copy.append(element('small',String(index+1).padStart(2,'0')+' / FIELD NOTES'),element('h2',categories[index]),element('span',info.english),element('p',description),open);
 panel.append(image,copy);track.append(panel);
 const customize=button('编辑栏目封面',()=>openCategoryCover(index));customize.type='button';customize.className='cover-edit';customize.hidden=true;copy.append(customize);
});
function refreshChapterCovers() {
  [...track.children].forEach((panel, index) => {
    const info = categoryDetails[index], cover = entryCovers.get('category-' + info.key);
    const image = panel.querySelector('.cover-photo');
    image.src = cover?.image || info.image;
    image.style.objectPosition = cover?.image ? 'center' : info.position;
    image.hidden = cover?.mode === 'text';
    panel.classList.toggle('cover-text-mode', cover?.mode === 'text');
    panel.querySelector('h2').textContent = cover?.title || info.title;
    panel.querySelector('.cover-copy > span').textContent = cover?.subtitle || info.english;
    panel.querySelector('.cover-edit').hidden = !isAuthor || visitor;
  });
}
function updateCover(){currentCover=Math.min(covers.length-1,Math.max(0,Math.round(track.scrollTop/track.clientHeight)||0));$('coverCount').textContent=String(currentCover+1).padStart(2,'0')+' / 04';$('coverPrev').disabled=currentCover===0;$('coverNext').disabled=currentCover===covers.length-1}
function turnCover(direction){const target=track.children[currentCover+direction];if(target)track.scrollTo({top:target.offsetTop,behavior:scrollMotion})}
track.addEventListener('scroll',updateCover,{passive:true});track.addEventListener('keydown',event=>{if(event.key==='ArrowUp'||event.key==='ArrowDown'){event.preventDefault();turnCover(event.key==='ArrowUp'?-1:1)}});$('coverPrev').onclick=()=>turnCover(-1);$('coverNext').onclick=()=>turnCover(1);$('browse').onclick=()=>$('covers').scrollIntoView({behavior:scrollMotion});updateCover();

const updatesKey='jiji-latest-updates-v1';
const starterUpdates=[
 {id:'u1',src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#4821aa"/><stop offset="1" stop-color="#edbdf2"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="650" cy="260" r="170" fill="#ffd34e"/><text x="70" y="900" font-family="serif" font-size="82" fill="#fff8e9">BERKELEY</text></svg>'),caption:'抵达 Berkeley',date:'2026.11'},
 {id:'u2',src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100"><rect width="100%" height="100%" fill="#d5f4e3"/><path d="M0 850 Q250 500 470 770 T900 580 V1100 H0Z" fill="#283a31"/><circle cx="220" cy="250" r="110" fill="#ffdbdf"/><text x="70" y="1000" font-family="serif" font-size="70" fill="#fff8e9">FIELD NOTES</text></svg>'),caption:'校园里的秋天',date:'2026.11'},
 {id:'u3',src:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100"><rect width="100%" height="100%" fill="#ffeb9d"/><rect x="120" y="130" width="660" height="760" rx="18" fill="#4821aa" transform="rotate(-5 450 510)"/><text x="210" y="500" font-family="serif" font-size="96" fill="#fff8e9">NEW</text><text x="210" y="610" font-family="serif" font-size="96" fill="#fff8e9">UPDATE</text></svg>'),caption:'新的手记开始了',date:'2026.11'}
];
const starterAlbum = { id: 'welcome-album', title: '新的手记开始了', date: '2026.11', photos: starterUpdates };
function albumCovers(albums) {
  return albums.map(album => ({
    id: album.id, src: (album.photos.find(photo=>photo.id===album.coverId) || album.photos[0]).src, caption: album.title,
    date: (album.createdAt ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' }).format(new Date(album.createdAt)) : album.date) + ' · ' + album.photos.length + ' 张照片',
    album
  }));
}
let updates = albumCovers([starterAlbum]);
let cloudUpdates = [];
const gallery = $('coverflow');
const updateRail = gallery.querySelector('.update-rail');
const updateStage = gallery.querySelector('.update-stage');
const photoCount = $('updateCount');
const photoPrev = $('updatePrev');
const photoNext = $('updateNext');
let updateCards = [];
let snapPoints = [];
let activeUpdate = 0;
let updateStep = 1;
let updateFrame = 0;
let drag = null;
let suppressGalleryClick = false;


function paintUpdates() {
  updateFrame = 0;
  if (!updateCards.length) return;

  // The track is the source of truth for the card positions, including mid-drag.
  const last = updateCards.length - 1;
  const progress = Math.max(0, Math.min(last, gallery.scrollLeft / updateStep));
  const fraction = progress % 1;
  const flat = motionPreference.matches;
  const center = flat ? progress : Math.floor(progress) + fraction ** 2 * (3 - 2 * fraction);
  activeUpdate = Math.round(progress);

  updateCards.forEach((card, index) => {
    let offset = index - center;
    // At the ends, expose a neighbor on both sides as in the reference.
    if (!flat && updateCards.length > 2) {
      if (offset > updateCards.length / 2) offset -= updateCards.length;
      if (offset < -updateCards.length / 2) offset += updateCards.length;
    }
    const distance = Math.abs(offset);
    const edge = Math.max(1.65, Math.min(2.75, updateCards.length / 2));
    const opacity = Math.max(0, Math.min(1, (edge - distance) / .28));
    const shown = flat || opacity > 0;
    card.style.visibility = shown ? 'visible' : 'hidden';
    if (!shown) return;

    const lean = Math.max(-1, Math.min(1, offset));
    const scale = Math.max(.6, 1 - distance * .2);
    const x = offset * updateStep;
    card.style.transform = flat
      ? `translate(-50%, -50%) translateX(${x}px)`
      : `translate(-50%, -50%) translate3d(${x}px, 0, ${-100 * distance}px) rotateY(${-30 * lean}deg) rotateZ(${7 * lean}deg) scale(${scale})`;
    card.style.zIndex = String(100 - Math.round(distance * 10));
    card.style.opacity = flat ? '1' : String(opacity);
    card.style.setProperty('--update-shade', flat ? '0' : String(Math.min(.48, distance * .28)));
    const selected = index === activeUpdate;
    const pick = card.querySelector('button');
    pick.tabIndex = selected ? 0 : -1;
    if (selected) pick.setAttribute('aria-current', 'true');
    else pick.removeAttribute('aria-current');
  });

  const counter = String(activeUpdate + 1).padStart(2, '0') + ' / ' + String(updateCards.length).padStart(2, '0');
  if (photoCount.textContent !== counter) photoCount.textContent = counter;
}

function layoutUpdates(index = activeUpdate) {
  const width = gallery.clientWidth;
  const cardWidth = updateCards[0]?.offsetWidth || width;
  updateStep = Math.max(1, Math.round(motionPreference.matches ? cardWidth + 12 : cardWidth * (260 / 432)));
  updateRail.style.setProperty('--update-track-width', `${width + updateStep * Math.max(0, updateCards.length - 1)}px`);
  updateRail.style.setProperty('--update-viewport', `${width}px`);
  snapPoints.forEach((point, position) => { point.style.left = `${position * updateStep}px`; });
  gallery.scrollTo({ left: index * updateStep, behavior: 'instant' });
  paintUpdates();
}

function selectUpdate(index, instant = false) {
  if (updates.length < 2) return;
  const wraps = index < 0 || index >= updates.length;
  const next = (index + updates.length) % updates.length;
  gallery.scrollTo({
    left: next * updateStep,
    behavior: instant || wraps || motionPreference.matches ? 'instant' : 'smooth'
  });
}

function renderUpdates() {
  updateCards = updates.map((update, index) => {
    const card = document.createElement('figure');
    card.className = 'update-card';

    const image = new Image();
    image.src = update.src;
    image.alt = update.caption || '最新动态照片';
    image.draggable = false;

    const caption = element('figcaption', update.caption || 'Latest update');
    caption.append(element('time', update.date));
    caption.append(element('span', '查看这组照片 ↗'));
    const pick = button('', () => { if (index !== activeUpdate) selectUpdate(index); else openAlbum(update.album); });
    pick.setAttribute('aria-label', '查看照片组：' + image.alt);
    pick.className = 'update-pick';
    pick.type = 'button';
    card.append(image, caption, pick);
    return card;
  });

  snapPoints.forEach(point => point.remove());
  snapPoints = updateCards.map(() => {
    const point = document.createElement('span');
    point.className = 'update-snap';
    point.setAttribute('aria-hidden', 'true');
    return point;
  });
  updateRail.append(...snapPoints);
  updateStage.replaceChildren(...updateCards);
  photoPrev.disabled = photoNext.disabled = updates.length < 2;
  if (!updates.length) {
    const empty = element('div', '还没有最新照片。');
    empty.className = 'update-empty';
    updateStage.append(empty);
    photoCount.textContent = '00 / 00';
  }
  layoutUpdates(0);
}

gallery.addEventListener('scroll', () => {
  if (!updateFrame) updateFrame = requestAnimationFrame(paintUpdates);
}, { passive: true });
new ResizeObserver(() => layoutUpdates()).observe(gallery);
motionPreference.addEventListener('change', () => layoutUpdates());

photoPrev.onclick = () => selectUpdate(activeUpdate - 1);
photoNext.onclick = () => selectUpdate(activeUpdate + 1);
gallery.addEventListener('keydown', event => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  gallery.focus({ preventScroll: true });
  selectUpdate(activeUpdate + (event.key === 'ArrowLeft' ? -1 : 1), true);
  paintUpdates();
});

// Touch and trackpad use the browser's horizontal scroll. Pointer capture
// starts only after a mouse drag, so a simple click can still select a card.
gallery.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'mouse' || event.button !== 0 || updates.length < 2) return;
  drag = { id: event.pointerId, start: event.clientX, left: gallery.scrollLeft, moved: false };
});
gallery.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.id) return;
  if (event.buttons !== 1) {
    endUpdateDrag(event);
    return;
  }
  const distance = drag.start - event.clientX;
  if (!drag.moved && Math.abs(distance) < 6) return;
  if (!drag.moved) {
    gallery.setPointerCapture(event.pointerId);
    gallery.classList.add('is-dragging');
    drag.moved = true;
  }
  gallery.scrollLeft = drag.left + distance;
});
function endUpdateDrag(event) {
  if (!drag || event.pointerId !== drag.id) return;
  if (drag.moved) {
    suppressGalleryClick = true;
    setTimeout(() => { suppressGalleryClick = false; }, 0);
    const nearest = Math.round(gallery.scrollLeft / updateStep);
    gallery.classList.remove('is-dragging');
    selectUpdate(nearest);
  }
  drag = null;
}
gallery.addEventListener('pointerup', endUpdateDrag);
gallery.addEventListener('click', event => { if (suppressGalleryClick) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
gallery.addEventListener('pointercancel', endUpdateDrag);
gallery.addEventListener('lostpointercapture', endUpdateDrag);
gallery.addEventListener('pointerleave', event => {
  if (drag && !drag.moved) endUpdateDrag(event);
});

$('addUpdate').onclick = () => $('updateEditor').showModal();
$('updateForm').elements.images.addEventListener('change', () => { delete $('updateForm').dataset.albumId; });
$('updateEditor').addEventListener('cancel', event => { if ($('updateForm').querySelector('.primary').disabled) event.preventDefault(); });
$('updateForm').onsubmit = async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const files = Array.from(form.elements.images.files);
  const caption = form.elements.caption.value.trim();
  const submit = form.querySelector('.primary');
  if (!files.length || submit.disabled || !isAuthor) return;
  if (files.length > 50) { alert('每组最多选择 50 张照片，请分批上传。'); return; }
  submit.disabled = true;
  form.querySelector('[data-close]').disabled = true;
  try {
    const albumId = form.dataset.albumId || (form.dataset.albumId = crypto.randomUUID());
    const photoIds = [];
    for (let index = 0; index < files.length; index++) {
      submit.textContent = '上传中 ' + (index + 1) + ' / ' + files.length;
      const src = await processPhoto(files[index], 1200, .78);
      const photo = await uploadCloudPhoto(src, caption || files[index].name.replace(/\.[^.]+$/, ''));
      photoIds.push(photo.id);
    }
    await cloudApi('/api/albums', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: albumId, title: caption, photoIds }) });
    await loadUpdates();
    form.reset();
    delete form.dataset.albumId;
    $('updateEditor').close();
    $('updates').scrollIntoView({ behavior: scrollMotion });
  } catch (error) {
    await loadUpdates().catch(() => {});
    alert(error.message + ' 已上传成功的照片会保留，重新提交会自动跳过重复照片。');
  } finally {
    submit.disabled = false;
    form.querySelector('[data-close]').disabled = false;
    submit.textContent = '添加到首页';
  }
};

async function cloudApi(path, options = {}) {
  let response;
  try { response = await fetch(window.ZoePages.apiUrl(path), { cache: 'no-store', signal: AbortSignal.timeout(25000), ...options }); }
  catch { throw new Error('云端连接暂时中断，请稍后重试。'); }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '云端请求失败，请重试。');
  return window.ZoePages.mapData(data);
}
async function uploadCloudPhoto(src, caption) {
  const blob = await (await fetch(src)).blob();
  const form = new FormData();
  form.append('image', blob, 'photo.webp');
  form.append('caption', caption);
  return cloudApi('/api/updates', { method: 'POST', body: form });
}
async function loadUpdates() {
  const albums = await cloudApi('/api/albums');
  cloudUpdates = albums.flatMap(album => album.photos);
  updates = albumCovers(albums);
  renderUpdates();
}
async function loadLetters() {
  const all = await cloudApi('/api/letters');
  cloudDeletedLetters = isAuthor ? all.filter(letter => letter.deleted) : [];
  cloudLetters = all.filter(letter => !letter.deleted);
  const local = records.filter(record => record.category !== categories[3]);
  const seed = examples.filter(record => record.category === categories[3] && !all.some(letter => letter.id === record.id));
  records = [...local, ...cloudLetters, ...seed];
}
async function loadEntryCovers() {
  const covers = await cloudApi('/api/entry-covers');
  entryCovers = new Map(covers.map(cover => [cover.id, cover]));
}
async function initializeCloud() {
  try {
    const session = await cloudApi('/api/session');
    isAuthor = session.author;
    visitor = !isAuthor;
    const results=await Promise.allSettled([loadUpdates(), loadLetters(), loadEntryCovers(), loadArticles()]);
    cloudReady = true;
    const failed=results.find(result=>result.status==='rejected');
    $('cloudNotice').textContent = failed?failed.reason.message:'文章、照片、评论与朋友来信已连接云端。';
    if(results[3].status==='rejected'){$('articleSyncStatus').textContent='文章未完成云端同步：'+results[3].reason.message;$('retryArticleSync').hidden=!isAuthor;}
    $('importLocal').hidden = !isAuthor || !localPhotos().length;
    $('importLetters').hidden = !isAuthor || !localLetters().length;
  } catch (error) {
    $('cloudNotice').textContent = error.message;
    if(!articlesReady){$('articleSyncStatus').textContent='文章未完成云端同步：'+error.message;$('retryArticleSync').hidden=!isAuthor;}
  }
  view();
  if (typeof finishAuthorSignIn === 'function') finishAuthorSignIn();
}
function localPhotos() {
  try { return JSON.parse(localStorage.getItem(updatesKey) || '[]').filter(photo => photo.src?.startsWith('data:image/') && !photo.src.startsWith('data:image/svg')); }
  catch { return []; }
}
function localLetters() {
  try { return JSON.parse(localStorage.getItem(storageKey) || '[]').filter(record => record.category === categories[3] && !examples.some(example => example.id === record.id) && !cloudLetters.some(letter => letter.id === record.id)); }
  catch { return []; }
}
$('importLocal').onclick = async event => {
  event.target.disabled = true;
  try {
    const photos = localPhotos();
    if (photos.length > 50) throw new Error('本机旧照片超过 50 张，请通过上传照片分批导入。');
    const photoIds = [];
    for (const photo of photos) photoIds.push((await uploadCloudPhoto(photo.src, photo.caption)).id);
    if (photoIds.length) await cloudApi('/api/albums', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'imported-local-photos', title: '从旧手记带来的照片', photoIds }) });
    await loadUpdates();
    event.target.hidden = true;
    $('cloudNotice').textContent = '本机旧照片已同步到云端。';
  } catch (error) { alert(error.message); }
  finally { event.target.disabled = false; }
};
$('importLetters').onclick = async event => {
  event.target.disabled = true;
  try {
    for (const letter of localLetters()) await cloudApi('/api/letters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(letter) });
    await loadLetters();
    view();
    event.target.hidden = true;
  } catch (error) { alert(error.message); }
  finally { event.target.disabled = false; }
};
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && cloudReady) {
    Promise.all([loadUpdates(), loadLetters(), loadEntryCovers(), loadArticles()]).then(view).catch(() => {});
  }
});
view();
renderUpdates();
document.addEventListener('DOMContentLoaded',initializeCloud,{once:true});

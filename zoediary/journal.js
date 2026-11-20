// The supplied recording uses a flat horizontal gallery: the middle poster grows,
// neighboring posters shrink and fade, with captions underneath. Native scroll owns the position.
const journalPage = $('journalPage');
const journalGallery = $('journalGallery');
const journalRail = journalGallery.querySelector('.journal-rail');
const journalStage = journalGallery.querySelector('.journal-stage');
let journalCategory = 0;
let journalTopic = classTopics[0];
let journalPosts = [];
let journalCards = [];
let journalSnaps = [];
let journalActive = 0;
let journalStep = 1;
let journalFrame = 0;
let journalDrag = null;
let suppressJournalClick = false;
let readerPosts = [];
let readerRecord = null;
const editJournalCover = button('编辑这张封面', () => { if (journalPosts[journalActive]) openEntryCover(journalPosts[journalActive]); });
editJournalCover.id = 'editJournalCover';
editJournalCover.type = 'button';
editJournalCover.hidden = true;
journalPage.querySelector('.journal-hint').before(editJournalCover);

function fillCoverPoster(target, record, info, cover = {}) {
  target.replaceChildren();
  const letter = record.category === categories[3] && !record.isCategoryCover;
  target.classList.toggle('is-letter-cover', letter);
  if (letter) {
    target.classList.remove('is-text-cover');
    target.append(createLetterArtwork(record));
    if (target.id === 'entryCoverPreview' && (cover.title || cover.subtitle)) {
      const copy = element('div',''); copy.className = 'letter-art-caption';
      if (cover.title) copy.append(element('h3',cover.title));
      if (cover.subtitle) copy.append(element('p',cover.subtitle));
      target.append(copy);
    }
    return;
  }
  const textOnly = cover.mode === 'text';
  target.classList.toggle('is-text-cover', textOnly);
  if (!textOnly) {
    const inlinePhoto = storedContent(record).querySelector('img');
    const image = new Image();
    image.src = cover.image || inlinePhoto?.src || info.image;
    image.alt = '';
    image.draggable = false;
    image.style.objectPosition = cover.image || inlinePhoto ? 'center' : info.position;
    target.append(image);
  }
  if (cover.title || cover.subtitle || textOnly) {
    const copy = element('div', ''); copy.className = 'poster-cover-words';
    copy.append(element('h3', cover.title || record.title));
    if (cover.subtitle) copy.append(element('p', cover.subtitle));
    target.append(copy);
  }
}

function openJournal(index, topic = classTopics[0]) {
  const route = '#journal/' + categoryDetails[index].key + (index === 0 ? '/' + (topic === classTopics[1] ? 'beyond-lecture' : 'economics') : '');
  if (location.hash === route) applyJournalRoute();
  else location.hash = route;
}
function applyJournalRoute() {
  const [, key, topic] = location.hash.replace(/^#/, '').split('/');
  const index = location.hash.startsWith('#journal/') ? categoryDetails.findIndex(info => info.key === key) : -1;
  const wasJournal = !journalPage.hidden;
  $('homeMain').hidden = index >= 0;
  journalPage.hidden = index < 0;
  document.body.classList.toggle('journal-active', index >= 0);
  $('articleReader').close();
  $('letterReader').close();
  if (index < 0) {
    if (wasJournal) { filter = '全部'; view(); $('notes').scrollIntoView({ behavior: 'instant' }); $('notes').focus({ preventScroll: true }); }
    return;
  }
  journalCategory = index;
  journalPage.dataset.category = categoryDetails[index].key;
  journalTopic = topic === 'beyond-lecture' ? classTopics[1] : classTopics[0];
  filter = categories[index];
  journalPage.dataset.topic = index === 0 ? journalTopic : '';
  journalActive = 0;
  renderJournal();
  window.scrollTo({ top: 0, behavior: 'instant' });
  journalPage.focus({ preventScroll: true });
}
function renderJournal() {
  if (journalPage.hidden) return;
  const info = categoryDetails[journalCategory];
  $('journalTitle').textContent = info.title;
  $('journalEnglish').textContent = info.english;
  $('journalDescription').textContent = info.description;
  $('writeLetterFromJournal').hidden = journalCategory !== 3;
  $('journalTabs').replaceChildren(...categoryDetails.map((category, index) => {
    const tab = button(category.title, () => openJournal(index));
    tab.type = 'button';
    tab.setAttribute('aria-pressed', String(index === journalCategory));
    return tab;
  }));
  $('classTopics').hidden = journalCategory !== 0;
  $('classTopics').replaceChildren(...classTopics.map((topic, index) => {
    const tab = button('', () => openJournal(0, topic));
    tab.type = 'button';
    tab.append(element('span', topic), element('small', index ? '课堂之外' : 'Little Economics'));
    tab.setAttribute('aria-pressed', String(journalTopic === topic));
    return tab;
  }));
  const previousId = journalPosts[journalActive]?.id;
  journalPosts = categoryEntries(records, info.title, visitor, journalCategory === 0 ? journalTopic : null);
  journalActive = Math.max(0, journalPosts.findIndex(record => record.id === previousId));
  journalCards = journalPosts.map((record, index) => {
    const card = element('figure', '');
    card.className = 'journal-card';
    const poster = button('', () => {
      if (index !== journalActive) selectJournal(index);
      else openDiaryEntry(record, journalPosts);
    });
    poster.type = 'button';
    poster.className = 'journal-poster';
    poster.setAttribute('aria-label', (record.category === categories[3] ? '拆开来信：' : '阅读文章：') + record.title);
    fillCoverPoster(poster, record, info, entryCovers.get(record.id));
    const caption = element('figcaption', '');
    const cover = entryCovers.get(record.id);
    caption.append(element('h2', record.category === categories[3] ? cover?.title || record.title : record.title), element('p', entryDateLabel(record)));
    if (record.category === categories[3] && cover?.subtitle) caption.append(element('p', cover.subtitle));
    if (isAuthor && !visitor && record.category===categories[3]) { const reply=button('回复',()=>openLetterReply(record)); reply.className='gallery-reply-entry';caption.append(reply); }
    if (isAuthor && !visitor) { const remove = button(record.category === categories[3] ? '删除来信' : '删除文章', () => askDeleteEntry(record)); remove.className = 'gallery-delete-entry'; caption.append(remove); }
    card.append(poster, caption);
    return card;
  });
  journalSnaps.forEach(point => point.remove());
  journalSnaps = journalCards.map(() => {
    const point = element('span', '');
    point.className = 'journal-snap'; point.setAttribute('aria-hidden', 'true');
    return point;
  });
  journalRail.append(...journalSnaps);
  journalStage.replaceChildren(...journalCards);
  $('journalEmpty').hidden = Boolean(journalPosts.length);
  journalGallery.hidden = !journalPosts.length;
  $('journalGallerySection').querySelector('.journal-gallery-controls').hidden = !journalPosts.length;
  $('journalGallerySection').querySelector('.journal-hint').hidden = !journalPosts.length;
  $('writeInTopic').hidden = !isAuthor || visitor;
  editJournalCover.hidden = !isAuthor || visitor || !journalPosts.length;
  layoutJournal();
}
function paintJournal() {
  journalFrame = 0;
  if (!journalCards.length || journalPage.hidden) return;
  const progress = Math.max(0, Math.min(journalCards.length - 1, journalGallery.scrollLeft / journalStep));
  const part = progress % 1;
  const center = Math.floor(progress) + part * part * (3 - 2 * part);
  journalActive = Math.round(progress);
  journalCards.forEach((card, index) => {
    const offset = index - center;
    const distance = Math.abs(offset);
    const flat = motionPreference.matches;
    card.style.transform = 'translate(-50%, -50%) translateX(' + offset * journalStep + 'px) scale(' + (flat ? 1 : Math.max(.48, 1 - distance * .23)) + ')';
    card.style.opacity = flat ? '1' : String(Math.max(.12, 1 - distance * .32));
    card.style.zIndex = String(50 - Math.round(distance * 10));
    card.style.visibility = distance > 3.5 ? 'hidden' : 'visible';
    const current = index === journalActive;
    const pick = card.querySelector('button');
    pick.tabIndex = current ? 0 : -1;
    pick.setAttribute('aria-current', String(current));
    const reply = card.querySelector('.gallery-reply-entry');
    if (reply) reply.tabIndex = current ? 0 : -1;
    const remove = card.querySelector('.gallery-delete-entry');
    if (remove) remove.tabIndex = current ? 0 : -1;
    card.querySelector('figcaption').style.opacity = current ? '1' : '0';
  });
  $('journalCount').textContent = String(journalActive + 1).padStart(2, '0') + ' / ' + String(journalCards.length).padStart(2, '0');
  $('journalPrev').disabled = journalActive === 0;
  $('journalNext').disabled = journalActive === journalCards.length - 1;
}
function layoutJournal() {
  if (journalPage.hidden || !journalCards.length) return;
  const width = journalGallery.clientWidth;
  journalStep = Math.max(1, Math.round(journalCards[0].offsetWidth * (motionPreference.matches ? 1.08 : .78)));
  journalRail.style.width = width + journalStep * Math.max(0, journalCards.length - 1) + 'px';
  journalStage.style.width = width + 'px';
  journalSnaps.forEach((point, index) => { point.style.left = index * journalStep + 'px'; });
  journalGallery.scrollTo({ left: journalActive * journalStep, behavior: 'instant' });
  paintJournal();
}
function selectJournal(index, instant = false) {
  if (!journalCards.length) return;
  const next = Math.min(journalCards.length - 1, Math.max(0, index));
  journalGallery.scrollTo({ left: next * journalStep, behavior: instant || motionPreference.matches ? 'instant' : 'smooth' });
}
function openDiaryEntry(record, collection = null) {
  if (record.category === categories[3]) { openEnvelope(record); return; }
  readerRecord = record;
  readerPosts = collection || categoryEntries(records, record.category, visitor, record.category === categories[0] ? classTopicOf(record) : null);
  const index = readerPosts.findIndex(item => item.id === record.id);
  const info = categoryDetails.find(category => category.title === record.category);
  $('articleCategory').textContent = record.category + ' / ' + (info?.english || '') + (record.category === categories[0] ? ' · ' + classTopicOf(record) : '');
  $('articleHeading').textContent = record.title;
  $('articleDate').textContent = entryDateLabel(record) + (!visitor && record.visibility !== 'public' ? ' · 仅自己可见' : '');
  $('articleBody').replaceChildren(storedContent(record));
  $('editArticle').hidden = !isAuthor || visitor;
  $('editArticleCover').hidden = !isAuthor || visitor;
  $('deleteArticleEntry').hidden = !isAuthor || visitor;
  $('previousArticle').disabled = index <= 0;
  $('nextArticle').disabled = index < 0 || index >= readerPosts.length - 1;
  const reader = $('articleReader');
  if (!reader.open) reader.showModal();
  reader.scrollTop = 0;
  openArticleDiscussion(record);
}
$('previousArticle').onclick = () => { const index = readerPosts.findIndex(record => record.id === readerRecord?.id); if (index > 0) openDiaryEntry(readerPosts[index - 1], readerPosts); };
$('deleteArticleEntry').onclick = () => { if(readerRecord) askDeleteEntry(readerRecord); };
$('nextArticle').onclick = () => { const index = readerPosts.findIndex(record => record.id === readerRecord?.id); if (index >= 0 && index < readerPosts.length - 1) openDiaryEntry(readerPosts[index + 1], readerPosts); };
$('editArticle').onclick = () => { $('articleReader').close(); edit(readerRecord); };
$('editArticleCover').onclick = () => { $('articleReader').close(); openEntryCover(readerRecord); };
$('closeArticle').onclick = () => $('articleReader').close();
$('allLetters').onclick = () => openJournal(3);
$('writeLetterFromJournal').onclick = () => $('question').showModal();
$('backToDiary').onclick = () => { location.hash = 'notes'; };
$('writeInTopic').onclick = () => edit(null);
$('journalPrev').onclick = () => selectJournal(journalActive - 1);
$('journalNext').onclick = () => selectJournal(journalActive + 1);
journalGallery.addEventListener('scroll', () => { if (!journalFrame) journalFrame = requestAnimationFrame(paintJournal); }, { passive: true });
journalGallery.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); selectJournal(journalActive + (event.key === 'ArrowLeft' ? -1 : 1), true); }
});
journalGallery.addEventListener('pointerdown', event => {
  if (event.pointerType === 'mouse' && event.button === 0 && journalPosts.length > 1) journalDrag = { id: event.pointerId, x: event.clientX, left: journalGallery.scrollLeft, moved: false };
});
journalGallery.addEventListener('pointermove', event => {
  if (!journalDrag || journalDrag.id !== event.pointerId) return;
  if (event.buttons !== 1) { finishJournalDrag(event); return; }
  const distance = journalDrag.x - event.clientX;
  if (!journalDrag.moved && Math.abs(distance) < 6) return;
  if (!journalDrag.moved) { journalGallery.setPointerCapture(event.pointerId); journalDrag.moved = true; journalGallery.classList.add('is-dragging'); }
  journalGallery.scrollLeft = journalDrag.left + distance;
});
function finishJournalDrag(event) {
  if (!journalDrag || event.pointerId !== journalDrag.id) return;
  if (journalDrag.moved) {
    journalGallery.classList.remove('is-dragging');
    suppressJournalClick = true;
    setTimeout(() => { suppressJournalClick = false; }, 0);
    selectJournal(Math.round(journalGallery.scrollLeft / journalStep));
  }
  journalDrag = null;
}
journalGallery.addEventListener('pointerup', finishJournalDrag);
journalGallery.addEventListener('pointercancel', finishJournalDrag);
journalGallery.addEventListener('lostpointercapture', finishJournalDrag);
journalGallery.addEventListener('pointerleave', event => { if (journalDrag && !journalDrag.moved) finishJournalDrag(event); });
journalGallery.addEventListener('click', event => { if (suppressJournalClick) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
new ResizeObserver(layoutJournal).observe(journalGallery);
motionPreference.addEventListener('change', layoutJournal);
document.addEventListener('diary:records-changed', renderJournal);
document.addEventListener('diary:entry-saved', event => {
  if (journalPage.hidden) return;
  const index = journalPosts.findIndex(record => record.id === event.detail.id);
  if (index >= 0) selectJournal(index, true);
});
window.addEventListener('hashchange', applyJournalRoute);
applyJournalRoute();

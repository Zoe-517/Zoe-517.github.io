const coverDialog = $('coverEditor');
const coverForm = $('coverForm');
let editingCoverRecord = null;
let currentCoverImage = '';
let coverPreviewUrl = '';
let savingCover = false;

function openCategoryCover(index) {
  const info = categoryDetails[index];
  openEntryCover({ id: 'category-' + info.key, title: info.title, category: info.title, visibility: 'public', isCategoryCover: true });
}
function openEntryCover(record) {
  if (!record || !isAuthor || visitor) return;
  editingCoverRecord = record;
  const cover = entryCovers.get(record.id) || {};
  coverForm.reset();
  coverForm.elements.mode.value = cover.mode || 'auto';
  coverForm.elements.title.value = cover.title || '';
  coverForm.elements.subtitle.value = cover.subtitle || '';
  currentCoverImage = cover.image || '';
  const letter = record.category === categories[3] && !record.isCategoryCover;
  coverForm.elements.mode.closest('label').hidden = letter;
  coverForm.elements.image.closest('label').hidden = letter;
  if (letter) { coverForm.elements.mode.value = 'auto'; currentCoverImage = ''; }
  $('coverEditorHeading').textContent = record.isCategoryCover ? '编辑栏目封面' : letter ? '编辑信封文字' : '编辑文章封面';
  $('coverSaveStatus').textContent = '';
  updateCoverPreview();
  coverDialog.showModal();
}
function releaseCoverPreview() {
  if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
  coverPreviewUrl = '';
}
function updateCoverPreview() {
  if (!editingCoverRecord) return;
  const info = categoryDetails.find(category => category.title === editingCoverRecord.category) || categoryDetails[0];
  fillCoverPoster($('entryCoverPreview'), editingCoverRecord, info, {
    mode: coverForm.elements.mode.value,
    image: coverPreviewUrl || currentCoverImage,
    title: coverForm.elements.title.value.trim(),
    subtitle: coverForm.elements.subtitle.value.trim()
  });
}
coverForm.addEventListener('input', updateCoverPreview);
coverForm.elements.image.addEventListener('change', () => {
  releaseCoverPreview();
  const file = coverForm.elements.image.files[0];
  if (file) { coverPreviewUrl = URL.createObjectURL(file); coverForm.elements.mode.value = 'image'; }
  updateCoverPreview();
});
$('resetEntryCover').onclick = () => {
  coverForm.reset(); currentCoverImage = ''; releaseCoverPreview(); updateCoverPreview();
};
async function writeEntryCover(settings, file = null) {
  const form = new FormData();
  form.append('settings', JSON.stringify(settings));
  if (file) {
    const src = await processPhoto(file, 1400, .82);
    form.append('image', await (await fetch(src)).blob(), 'cover.webp');
  }
  return cloudApi('/api/entry-covers', { method: 'POST', body: form });
}
async function syncCoverVisibility(record) {
  const cover = entryCovers.get(record.id);
  if (!cover || cover.visibility === record.visibility) return;
  const updated = await writeEntryCover({ ...cover, visibility: record.visibility });
  entryCovers.set(updated.id, updated);
}
coverForm.onsubmit = async event => {
  event.preventDefault();
  if (!isAuthor || visitor || !editingCoverRecord || savingCover) return;
  savingCover = true; coverForm.inert = true;
  $('coverSaveStatus').textContent = '正在保存封面…';
  try {
    const cover = await writeEntryCover({
      id: editingCoverRecord.id, mode: coverForm.elements.mode.value,
      image: currentCoverImage, title: coverForm.elements.title.value.trim(),
      subtitle: coverForm.elements.subtitle.value.trim(), visibility: editingCoverRecord.visibility
    }, coverForm.elements.image.files[0]);
    entryCovers.set(cover.id, cover);
    view();
    coverDialog.close();
  } catch (error) { $('coverSaveStatus').textContent = error.message + ' 编辑内容已保留，可以重试。'; }
  finally { savingCover = false; coverForm.inert = false; }
};
$('closeCoverEditor').onclick = $('cancelEntryCover').onclick = () => coverDialog.close();
coverDialog.addEventListener('cancel', event => { if (savingCover) event.preventDefault(); });
coverDialog.addEventListener('close', releaseCoverPreview);

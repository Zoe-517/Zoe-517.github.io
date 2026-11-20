// The server session is the only authority for showing author tools.
let authorPanelTab = 'articles';
function renderAuthorEntry() {
  for (const id of ['authorEntry', 'footerAuthor']) $(id).hidden = !isAuthor;
  for (const id of ['loginEntry', 'footerLogin']) $(id).hidden = isAuthor;
  if (!isAuthor && $('authorCenter').open) $('authorCenter').close();
  if (isAuthor && $('authorCenter').open) renderAuthorCenter();
}
function showAccountLogin() {
  const returnTo = new URL(location.href);
  returnTo.searchParams.set('author', '1');
  $('accountSignIn').href = window.ZoePages.authorOrigin + '/auth/login?return_to=' + encodeURIComponent(returnTo.pathname + returnTo.search + returnTo.hash);
  $('loginPanel').showModal();
}
function finishAuthorSignIn() {
  const url = new URL(location.href);
  if (url.searchParams.get('author') !== '1') return;
  url.searchParams.delete('author');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  if (isAuthor) openAuthorCenter();
  else {
    $('loginMessage').textContent = '当前账号尚未被识别为 Zoe 的作者账号。请使用 Zoe 指定的 Google 账号登录；其他账号可以继续浏览公开内容。';
    showAccountLogin();
  }
}
function openAuthorCenter() {
  if (!isAuthor) return;
  visitor = false;
  view();
  renderAuthorCenter();
  if (!$('authorCenter').open) $('authorCenter').showModal();
}
function leaveAuthorCenter(action) {
  if (!isAuthor) return;
  $('authorCenter').close();
  visitor = false;
  view();
  action();
}
function authorRow(title, detail) {
  const row = element('div', '');
  row.className = 'author-content-row';
  const copy = element('div', '');
  copy.append(element('h3', title), element('small', detail));
  row.append(copy);
  return row;
}
function renderAuthorCenter() {
  if (!isAuthor) return;
  $('authorArticleTab').setAttribute('aria-pressed', String(authorPanelTab === 'articles'));
  $('authorPhotoTab').setAttribute('aria-pressed', String(authorPanelTab === 'photos'));
  $('authorArticleList').hidden = authorPanelTab !== 'articles';
  $('authorAlbumList').hidden = authorPanelTab !== 'photos';
  const articles = records.filter(row => row.category !== categories[3]).sort((a,b) => entryTimestamp(b) - entryTimestamp(a));
  $('authorArticleList').replaceChildren(...articles.map(record => {
    const row = authorRow(record.title, record.category + ' · ' + (record.visibility === 'public' ? '公开' : '仅自己可见'));
    row.append(button('编辑文章', () => leaveAuthorCenter(() => edit(record))));
    return row;
  }));
  const albums = updates.filter(row => row.album && row.album.id !== 'welcome-album');
  $('authorAlbumList').replaceChildren(...albums.map(item => {
    const album = item.album;
    const row = authorRow(album.title, album.photos.length + ' 张照片');
    const photo = album.photos.find(photo => photo.id === album.coverId) || album.photos[0];
    if (photo) {
      const image = document.createElement('img');
      image.src = photo.src;
      image.alt = '';
      image.loading = 'lazy';
      row.prepend(image);
    }
    row.append(button('管理照片', () => leaveAuthorCenter(() => { openAlbum(album); openAlbumManager(); })));
    return row;
  }));
  if (!articles.length) $('authorArticleList').append(element('p', articlesReady ? '还没有文章，写下第一篇吧。' : '文章正在从云端读取，请稍候。'));
  if (!albums.length) $('authorAlbumList').append(element('p', '还没有照片组，可以先上传一组照片。'));
  $('authorCenterStatus').textContent = !cloudReady ? '正在连接云端…' : !articlesReady ? '文章尚未完成同步，请稍后重试。' : '';
  $('authorWrite').disabled = !articlesReady;
  $('authorUpload').disabled = !cloudReady;
}
$('loginEntry').onclick = $('footerLogin').onclick = showAccountLogin;
$('authorEntry').onclick = $('footerAuthor').onclick = openAuthorCenter;
$('authorWrite').onclick = () => leaveAuthorCenter(() => edit(null));
$('authorUpload').onclick = () => leaveAuthorCenter(() => $('updateEditor').showModal());
$('authorLetters').onclick = () => leaveAuthorCenter(() => { location.hash = '#journal/letters'; });
$('authorArticleTab').onclick = () => { authorPanelTab = 'articles'; renderAuthorCenter(); };
$('authorPhotoTab').onclick = () => { authorPanelTab = 'photos'; renderAuthorCenter(); };

let selectedLetter = null;
let openingLetter = false;
let letterDrag = null;
let letterTear = 0;
let letterSession = 0;

function createEnvelope(record) {
  const card = element('article', '');
  card.className = 'letter-card';
  card.dataset.category = '朋友问答';
  const seal = createLetterArtwork(record);
  card.append(element('small', visitor ? '朋友来信' : record.visibility === 'public' ? '朋友来信 · 公开' : '朋友来信 · 仅自己可见'));
  card.append(seal, element('h3', record.title));
  card.append(button('拆开来信 ↗', () => openEnvelope(record)));
  if (isAuthor && !visitor) card.append(button('回复', () => edit(record)), button('删除来信', () => askDeleteEntry(record)));
  return card;
}

function tornPolygon(bottom) {
  let seed = 11;
  const edge = [];
  for (let index = 0; index <= 240; index++) {
    seed = seed * 16807 % 2147483647;
    const arc = Math.sin((index % 4) / 4 * Math.PI) * 2;
    const y = 12 + arc * .3 + (seed / 2147483647 - .5) * .3;
    edge.push((index / 240 * 100) + '% ' + y + '%');
  }
  return 'polygon(' + (bottom ? '0% 100%,100% 100%,' + edge.reverse().join(',') : '0% 0%,100% 0%,' + edge.reverse().join(',')) + ')';
}

function openEnvelope(record) {
  selectedLetter = record;
  letterSession++;
  openingLetter = false;
  letterTear = 0;
  const dialog = document.getElementById('letterReader');
  const sender = document.getElementById('letterSender');
  const name = String(record.nickname || '').trim();
  sender.hidden = !name;
  sender.textContent = name ? '来自 ' + name + ' · A letter from a friend' : '';
  dialog.dataset.stationery = String(stationeryIndex(record, 6));
  dialog.dataset.envelope = String(stationeryIndex(record, 8));
  dialog.querySelector('.envelope-front .wax-seal').textContent = ['♥','✉','✿','୨୧','〰','★','✿','✿'][stationeryIndex(record,8)];
  dialog.querySelector('.paper-ornament').innerHTML = paperOrnament(stationeryIndex(record, 6));
  document.getElementById('replyLetterEntry').hidden = !isAuthor || visitor;
  document.getElementById('deleteLetterEntry').hidden = !isAuthor || visitor;
  dialog.classList.remove('letter-out', 'letter-open');
  dialog.querySelectorAll('.envelope-scene *').forEach(node => node.getAnimations().forEach(animation => animation.cancel()));
  const strip = document.getElementById('tearStrip');
  strip.disabled = false;
  strip.style.transform = '';
  strip.style.opacity = '';
  strip.style.clipPath = tornPolygon(false);
  dialog.querySelector('.envelope-front').style.clipPath = tornPolygon(true);
  dialog.querySelector('.letter-content').hidden = true;
  dialog.querySelector('.tear-hint').textContent = '拖动撕条，或点击撕开信封';
  dialog.querySelector('.letter-date').textContent = record.createdAt ? new Date(record.createdAt).toLocaleDateString('zh-CN') : '朋友来信';
  dialog.querySelector('.letter-content h3').textContent = record.title;
  dialog.querySelector('.letter-message').replaceChildren(record.body === record.title && !record.richBody ? document.createTextNode('') : storedContent(record));
  const reply = dialog.querySelector('.letter-reply');
  reply.textContent = record.reply ? '己己回复\n' + record.reply : '这封信等待己己回复。';
  dialog.showModal();
}

async function revealLetter() {
  if (openingLetter) return;
  openingLetter = true;
  const session = letterSession;
  const dialog = document.getElementById('letterReader');
  const strip = document.getElementById('tearStrip');
  const paper = dialog.querySelector('.folded-letter');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  strip.disabled = true;
  const play = (node, frames, duration) => node.animate(frames, {
    duration: reduced ? 1 : duration, fill: 'forwards', easing: 'cubic-bezier(.23,1,.32,1)'
  }).finished.catch(() => {});
  await play(strip, [
    { transform: strip.style.transform || 'translateX(0) rotate(0deg)', opacity: 1 },
    { transform: 'translateX(-110%) rotate(-12deg)', opacity: 0 }
  ], 400);
  if (!dialog.open || session !== letterSession) return;
  dialog.classList.add('letter-out');
  await play(paper, [{ transform: 'translateY(0)' }, { transform: 'translateY(-95px)' }], 500);
  if (!dialog.open || session !== letterSession) return;
  await Promise.all([
    play(paper.querySelector('.fold-top'), [{ transform: 'rotateX(-165deg)' }, { transform: 'rotateX(0deg)' }], 450),
    play(paper.querySelector('.fold-bottom'), [{ transform: 'rotateX(165deg)' }, { transform: 'rotateX(0deg)' }], 450)
  ]);
  if (!dialog.open || session !== letterSession) return;
  dialog.classList.add('letter-open');
  const content = dialog.querySelector('.letter-content');
  content.hidden = false;
  content.focus({ preventScroll: true });
  dialog.querySelector('.tear-hint').textContent = '';
}

document.getElementById('closeLetter').onclick = () => document.getElementById('letterReader').close();
document.getElementById('deleteLetterEntry').onclick = () => { if(selectedLetter) askDeleteEntry(selectedLetter); };
document.getElementById('replyLetterEntry').onclick=()=>{document.getElementById('letterReader').close();openLetterReply(selectedLetter);};
const strip = document.getElementById('tearStrip');
strip.onclick = revealLetter;
document.querySelector('#letterReader .envelope-front').onclick = revealLetter;
strip.addEventListener('pointerdown', event => {
  if (openingLetter) return;
  letterDrag = event.clientX;
  strip.setPointerCapture(event.pointerId);
});
strip.addEventListener('pointermove', event => {
  if (letterDrag === null || openingLetter) return;
  const width = strip.clientWidth;
  letterTear = Math.max(0, Math.min(1, (letterDrag - event.clientX) / width));
  strip.style.transformOrigin = (100 * (1 - letterTear)) + '% 100%';
  strip.style.transform = 'translateX(' + (-letterTear * 45) + '%) rotate(' + (-letterTear * 12) + 'deg) rotateY(' + (letterTear * 80) + 'deg)';
});
function releaseStrip(event) {
  if (letterDrag === null) return;
  letterDrag = null;
  if (strip.hasPointerCapture(event.pointerId)) strip.releasePointerCapture(event.pointerId);
  if (letterTear >= 1 / 3) revealLetter();
  else {
    const animation = strip.animate([{ transform: strip.style.transform }, { transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.23,1,.32,1)' });
    strip.style.transform = '';
    animation.finished.catch(() => {});
  }
}
strip.addEventListener('pointerup', releaseStrip);
strip.addEventListener('pointercancel', releaseStrip);
strip.addEventListener('click', event => {
  if (letterTear > .01 && !openingLetter) {
    event.stopImmediatePropagation();
    letterTear = 0;
  }
}, true);

// Original hand-drawn stationery, with different constructions as well as colors.
let envelopeArtCount = 0;
function createLetterArtwork(record) {
  const variant=stationeryIndex(record,8);
  const palettes=[
    ['#f7efdc','#e9dfc7','#e8b7b7','#c8b99e','#c1787c'],
    ['#e8f0ef','#c6d9df','#a9c5d0','#99b1bb','#527c99'],
    ['#e4ebdb','#cad6b9','#e7dfc6','#a6b598','#7d9272'],
    ['#b55d52','#904a43','#efdec5','#8f4c42','#f2d8bc'],
    ['#d5b28c','#b99a77','#f6ead2','#af9270','#82664c'],
    ['#dce6ed','#c0d0df','#eedeb5','#9eb3c4','#697e9b'],
    ['#fffaf0','#e8e1d3','#e8ddc6','#c6bdaa','#b59a60'],
    ['#f0d7ce','#dfbeb5','#eadbc3','#c6a89b','#a97a7b']
  ];
  const [paper,shade,lining,edge,accent]=palettes[variant], id='letter-art-'+(++envelopeArtCount);
  const heart=`<path d="M259 235C232 221 238 199 252 207C261 190 287 209 259 235Z" fill="${accent}" stroke="${edge}" stroke-width="1.2"/><path d="M248 210Q245 215 251 220" fill="none" stroke="#ffe8dc" stroke-width="2" opacity=".65"/>`;
  const daisy=(x,y,scale=1)=>`<g transform="translate(${x} ${y}) scale(${scale})"><path d="M0 38Q-5 17 0 0M-1 24L-14 13" stroke="#81906c" fill="none" stroke-width="2"/><ellipse cx="-12" cy="14" rx="4" ry="9" fill="#a2b18b" transform="rotate(-45 -12 14)"/><g fill="#fff9e8">${Array.from({length:7},(_,i)=>`<ellipse cx="0" cy="-7" rx="3" ry="6" transform="rotate(${i*360/7})"/>`).join('')}</g><circle r="4" fill="#d9bb6e"/></g>`;
  const star=(x,y,size,color=accent)=>`<path d="m0-12 3.5 8 9 .8-7 6 2 9-7.5-4.8-8 4.8 2-9-7-6 9-.8Z" transform="translate(${x} ${y}) scale(${size})" fill="${color}" opacity=".8"/>`;
  const stamp=`<g transform="translate(387 134) rotate(7)"><path d="M0 0H49V57H0Z" fill="#fff8e5" stroke="${accent}" stroke-width="2" stroke-dasharray="2 3"/><rect x="6" y="7" width="37" height="42" fill="${lining}"/><path d="M14 36Q25 15 36 36M16 40H34" stroke="${accent}" fill="none" stroke-width="2"/><text x="24" y="48" font-family="Georgia" font-size="7" text-anchor="middle" fill="${accent}">POST</text></g>`;
  const baseOpen=`<path d="M48 130Q45 122 54 115L247 23Q258 18 270 24L468 115Q478 121 474 131L473 315Q469 321 461 321L59 319Q47 317 47 309Z" fill="${shade}" stroke="${edge}" stroke-width="2"/><path d="M55 121L255 31Q260 28 266 32L467 122L263 227Z" fill="url(#${id}-lining)" stroke="${edge}" stroke-width="1.5"/><path d="M106 85L414 81L420 257L102 261Z" fill="#fffaf0" stroke="#d9cfba" stroke-width="1.2"/><path d="M135 115L276 113M135 130L365 127M136 144L343 142" stroke="#bfb49e" stroke-width="1.1" opacity=".5"/><path d="M49 128L259 231L473 126L471 311L51 311Z" fill="${paper}" stroke="${edge}" stroke-width="1.7"/><path d="M50 130L208 231L54 313M472 129L310 231L469 313" fill="${shade}" fill-opacity=".2" stroke="${edge}" stroke-width="1.1"/><path d="M51 313L244 198Q257 189 271 198L469 315Q267 323 51 313Z" fill="${paper}" stroke="${edge}" stroke-width="1.4"/>`;
  const baseClosed=`<path d="M50 105Q43 105 45 115L47 309Q47 317 58 317L465 318Q475 317 474 309L476 116Q476 106 465 105Z" fill="${paper}" stroke="${edge}" stroke-width="2"/><path d="M49 112L253 238L473 111M51 312L218 208M470 313L307 208" fill="none" stroke="${edge}" stroke-width="1.4"/><path d="M50 108L465 109L270 235Q260 242 249 234Z" fill="${shade}" fill-opacity=".5" stroke="${edge}" stroke-width="1.4"/>`;
  let art;
  if(variant===1) art=baseClosed+`<path d="M57 119H466M57 306H465" stroke="#6d91a7" stroke-width="7" stroke-dasharray="14 18"/><path d="M73 119H466M73 306H465" stroke="#bf7d73" stroke-width="7" stroke-dasharray="14 18"/>`+stamp+`<circle cx="118" cy="168" r="26" fill="none" stroke="#98aaa9" stroke-width="1.3"/><path d="M90 165H145M90 171H145M152 160q26-8 52 0t52 0M152 174q26-8 52 0t52 0" fill="none" stroke="#98aaa9" stroke-width="1"/>`;
  else if(variant===3) art=baseClosed+`<path d="M248 108V317M49 211H473" stroke="#efdbc0" stroke-width="10"/><path d="M248 108V317M49 211H473" stroke="#b45b53" stroke-width="3" stroke-dasharray="3 4"/><path d="M251 210Q181 138 174 176Q168 213 251 210Q318 143 328 175Q340 209 251 210M250 211L214 261M251 211L292 262" fill="none" stroke="#f1dfc7" stroke-width="9"/><path d="M250 210Q196 162 184 178M251 210Q302 163 319 179" stroke="#a3524d" fill="none" stroke-width="1.5"/>`;
  else if(variant===4) art=`<path d="M67 133L451 85L478 302L95 335Z" fill="${shade}" stroke="${edge}" stroke-width="2"/><g transform="rotate(-7 260 190)"><path d="M96 48H420V304H96Z" fill="#e7d8ba" stroke="${edge}"/><path d="M83 39H407V291H83Z" fill="#fbf5e7" stroke="#ccbea3"/><path d="M116 77H370M116 91H339M116 106H359" stroke="#d3c7ad"/><path d="M254 40V292M84 187H407" stroke="#99795b" stroke-width="2.5"/><path d="M254 188Q208 136 204 160Q193 188 254 188Q301 139 308 162Q316 189 254 188M254 189L226 232M254 189L280 226" fill="none" stroke="#99795b" stroke-width="3"/></g>`;
  else if(variant===6) art=baseClosed+`<path d="M50 108L465 109L270 235Q260 242 249 234Z" fill="#fffaf0" stroke="${edge}"/><circle cx="260" cy="236" r="26" fill="#c3a66d" stroke="#a88b51" stroke-width="3"/><circle cx="260" cy="236" r="20" fill="none" stroke="#f0dca9" stroke-width="1.5"/><path d="M248 244Q240 230 253 224Q266 212 273 231Q285 242 268 247Z" fill="none" stroke="#8c7548" stroke-width="2"/>`;
  else {
    art=baseOpen+heart;
    if(variant===2) art+=daisy(372,247,.9)+daisy(399,260,.65)+daisy(350,268,.62)+daisy(99,71,.85);
    else if(variant===5) art+=[[88,173,.6],[150,272,.45],[368,261,.7],[410,199,.5],[328,295,.4],[187,165,.45]].map(([x,y,s])=>star(x,y,s)).join('')+star(358,62,1.2,'#d7b771');
    else if(variant===7) art+=daisy(396,246,1.1)+daisy(370,270,.7)+daisy(420,269,.65);
    else art+=`<g stroke="${accent}" fill="none" opacity=".55"><path d="M384 272Q392 260 399 271Q408 260 413 273Q405 283 399 286Z"/><path d="M423 247Q429 238 433 246Q440 239 445 248L433 258Z"/></g>`;
  }
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('letter-artwork');svg.dataset.variant=String(variant);svg.setAttribute('viewBox','0 0 520 365');svg.setAttribute('aria-hidden','true');
  svg.innerHTML=`<defs><pattern id="${id}-lining" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="${lining}"/><path d="M0 5H20M5 0V20" stroke="#fff" stroke-width="4" opacity=".2"/></pattern><filter id="${id}-texture"><feTurbulence baseFrequency=".6" numOctaves="3" seed="11" result="noise"/><feColorMatrix in="noise" type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".075"/></feComponentTransfer><feComposite in2="SourceGraphic" operator="in" result="paperNoise"/><feBlend in="SourceGraphic" in2="paperNoise" mode="multiply"/></filter><filter id="${id}-shadow" x="-20%" y="-25%" width="150%" height="160%"><feDropShadow dy="8" stdDeviation="7" flood-color="#76634c" flood-opacity=".13"/></filter></defs><g transform="rotate(${variant%2?2:-2} 260 195)" filter="url(#${id}-shadow)"><g filter="url(#${id}-texture)" stroke-linecap="round" stroke-linejoin="round">${art}</g>${variant!==4?`<text x="81" y="284" fill="${variant===3?'#f3e2ca':'#867d68'}" font-family="Georgia,serif" font-size="14" font-style="italic">A letter, just for you</text>`:''}</g>`;
  return svg;
}

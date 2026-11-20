// Stable stationery choices and original, decorative ticket illustrations.
function stationeryIndex(record, count = 8) {
  let hash = 0;
  for (const char of String(record.id || record.title || 'note')) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % count;
}
function createTicketSticker(record) {
  const palettes = [['#eeb9c5','#885367','FIELD NOTES'],['#aabfb0','#3d6152','GOOD FOR ONE'],['#ead2a4','#8b6338','ADMIT ONE'],['#bcc7df','#4f6084','A LITTLE MOMENT'],['#dda89b','#8e5148','DIARY PASS'],['#ddd3bd','#6e6b53','TICKET TO ANYWHERE']];
  const [paper,ink,title] = palettes[stationeryIndex(record, palettes.length)];
  const serial = String([...String(record.id)].reduce((sum,c)=>sum+c.charCodeAt(0)*37,0)%100000).padStart(5,'0');
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 228 104');svg.setAttribute('aria-hidden','true');svg.classList.add('entry-ticket');
  svg.innerHTML = `<path d="M10 8H218V24Q208 25 208 35Q209 45 218 46V58Q208 59 208 69Q209 79 218 80V96H10V80Q20 78 20 69Q20 60 10 58V46Q20 44 20 35Q20 26 10 24Z" fill="${paper}" stroke="#fffaf0" stroke-width="5"/><path d="M27 17H198V87H27Z" fill="none" stroke="${ink}" stroke-width=".8" opacity=".65"/><path d="M180 17V87" stroke="${ink}" stroke-dasharray="2 3" opacity=".65"/><text x="103" y="37" text-anchor="middle" fill="${ink}" font-family="Georgia,serif" font-size="10" letter-spacing="1.2">ZOE'S DIARY</text><text x="103" y="61" text-anchor="middle" fill="${ink}" font-family="Georgia,serif" font-weight="bold" font-size="${title.length>15?11:16}">${title}</text><text x="103" y="78" text-anchor="middle" fill="${ink}" font-family="Georgia,serif" font-size="8" letter-spacing="1">BERKELEY · 2026</text><text x="195" y="53" text-anchor="middle" transform="rotate(90 195 53)" fill="${ink}" font-family="monospace" font-size="9">${serial}</text>`;
  return svg;
}
function paperOrnament(style) {
  const star = '<path d="m24 3 6 15 17 1-13 11 4 17-14-9-15 9 4-17L0 19l18-1Z"/>';
  if (style === 0) return '<svg viewBox="0 0 110 70"><path d="M22 8H88V32H22Z" fill="#d8a5a4" transform="rotate(8 55 20)"/><path d="M51 8V40Q51 53 63 53Q75 53 75 40V9" fill="none" stroke="#b76f73" stroke-width="5"/><path d="M5 57l18-22 16 25-19-7Z" fill="#c1b49c"/></svg>';
  if (style === 1) return '<svg viewBox="0 0 110 70"><path d="M54 60Q46 24 68 8M54 44L32 24M59 25L84 11" stroke="#82976b" fill="none" stroke-width="2"/><ellipse cx="34" cy="24" rx="6" ry="13" fill="#9eaf86" transform="rotate(-45 34 24)"/><ellipse cx="82" cy="12" rx="6" ry="13" fill="#a5b58f" transform="rotate(45 82 12)"/></svg>';
  if (style === 2) return '<svg viewBox="0 0 110 70"><path d="M24 20H88V43H24Z" fill="#c2aa73"/><path d="M44 21V11Q44 1 56 1Q68 1 68 11V21" fill="#c2aa73"/><circle cx="56" cy="9" r="3" fill="#fff9e9"/><path d="M25 35H87" stroke="#8e7642"/><g transform="translate(5 30) scale(.65)" fill="#91a5bc">'+star+'</g></svg>';
  if (style === 3) return '<svg viewBox="0 0 110 70"><g transform="translate(7 12) scale(.85)" fill="#92a6bf">'+star+'</g><g transform="translate(60 32) scale(.62)" fill="#dfc48e">'+star+'</g></svg>';
  if (style === 4) return '<svg viewBox="0 0 110 70"><path d="M24 58V28Q9 4 33 6Q54-6 77 7Q99 9 86 28V58Z" fill="#dcae6b" stroke="#b17a3f" stroke-width="3"/><path d="M33 49V27Q22 11 39 15Q57 4 74 16Q84 17 77 28V49Z" fill="#f9e2ac"/><text x="55" y="37" text-anchor="middle" font-family="Georgia" font-size="12" fill="#96653d">NOTE</text></svg>';
  return '<svg viewBox="0 0 110 70"><path d="M54 19Q31 6 23 27Q12 62 48 61Q61 67 74 58Q97 29 76 17Q65 12 54 19Z" fill="#b65343"/><path d="M54 25Q36 15 30 31Q21 56 48 55Q63 60 70 52Q87 28 73 24Q62 18 54 25Z" fill="#fff0ce"/><path d="M55 18L54 2" stroke="#8c6c44" stroke-width="5"/><ellipse cx="68" cy="7" rx="13" ry="5" transform="rotate(-25 68 7)" fill="#9aa56a"/></svg>';
}

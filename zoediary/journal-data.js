const categoryDetails = [
  { key: 'classes', title: '课堂与活动', english: 'Class & Beyond', image: '/zoediary/asset-covers-letters.jpg', position: '50% 20%', description: '一堂课结束后，还有哪些问题值得接着问？' },
  { key: 'thoughts', title: '我的思考', english: 'Notes to Self', image: '/zoediary/asset-covers-thoughts.jpg', position: '50% 58%', description: '把还在琢磨的事，慢慢写清楚。' },
  { key: 'moments', title: '随心记录', english: 'Little Moments', image: '/zoediary/asset-covers-moments.jpg', position: '50% 55%', description: '记下在伯克利生活时，偶然留意到的小事。' },
  { key: 'letters', title: '朋友问答', english: 'Letters & Replies', image: '/zoediary/asset-covers-classes.jpg', position: '50% 62%', description: '把你想问的事留在这里。' }
];
const classTopics = ['有趣的经济学小知识', 'beyond lecture'];
function classTopicOf(record) { return record.topic === classTopics[1] ? classTopics[1] : classTopics[0]; }
function entryTimestamp(record) {
  const stamp = Date.parse(record.publishedAt || record.createdAt || record.date || '');
  return Number.isFinite(stamp) ? stamp : 0;
}
function newestEntries(records) {
  return records.map((record, index) => ({ record, index })).sort((a, b) => entryTimestamp(b.record) - entryTimestamp(a.record) || a.index - b.index).map(item => item.record);
}
function visibleEntries(records, visitor) { return newestEntries(records.filter(record => !visitor || record.visibility === 'public')); }
function categoryEntries(records, category, visitor, topic) {
  return visibleEntries(records, visitor).filter(record => record.category === category && (category !== categoryDetails[0].title || !topic || classTopicOf(record) === topic));
}
function entryDateLabel(record) {
  const stamp = entryTimestamp(record);
  return stamp ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'America/Los_Angeles', year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(stamp)) : '早期手记 · Earlier notes';
}

const $ = (selector) => document.querySelector(selector);
const state = { words: [], selected: null, mistakes: [], bookWords: [] };
const getApiKey = () => sessionStorage.getItem('deepseek_api_key') || '';
const lookupCache = new Map();
const fallback = {
  curious: ['adj.', '好奇的；求知欲强的', 'She was curious about how the machine worked.'],
  resilient: ['adj.', '有韧性的；能迅速恢复的', 'Children are often remarkably resilient.'],
  deliberate: ['adj.', '故意的；深思熟虑的', 'His answer was calm and deliberate.'],
  discover: ['v.', '发现；找到', 'We discover something new every day.'],
  language: ['n.', '语言；表达方式', 'Language connects people across cultures.'],
  practice: ['n. / v.', '练习；实践', 'A little practice makes a big difference.'],
  meaningful: ['adj.', '有意义的；重要的', 'Small habits can lead to meaningful change.']
};
const sampleText = 'Every new language opens a door to a different way of seeing the world. When we read with curiosity, unfamiliar words become invitations rather than obstacles. A few minutes of deliberate practice each day can turn a difficult passage into a meaningful conversation with another mind.';

function initIcons() { if (window.lucide) lucide.createIcons(); }
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2400); }
function updateStats() { $('#wordCount').textContent = state.words.length; $('#mistakeCount').textContent = state.mistakes.length; $('#bookCount').textContent = state.bookWords.length; $('#mistakePill').textContent = state.mistakes.length; }

function renderPassage(text) {
  const words = text.match(/[A-Za-z]+(?:['-][A-Za-z]+)?/g) || [];
  state.words = [...new Set(words.map(w => w.toLowerCase()))];
  const html = text.replace(/[A-Za-z]+(?:['-][A-Za-z]+)?/g, (word) => `<span class="word" data-word="${word.toLowerCase()}">${word}</span>`);
  $('#passage').innerHTML = html;
  $('#passageMeta').textContent = `${state.words.length} 个独立单词 · 点击单词查看释义`;
  $('#passageHint').classList.remove('hidden');
  $('#passage').querySelectorAll('.word').forEach(el => el.addEventListener('click', () => selectWord(el.dataset.word, el)));
  updateStats(); initIcons();
}

async function selectWord(word, element) {
  document.querySelectorAll('.word.selected').forEach(el => el.classList.remove('selected'));
  if (element) element.classList.add('selected');
  state.selected = word;
  $('#dictionaryEmpty').classList.add('hidden'); $('#wordResult').classList.remove('hidden');
  $('#resultWord').textContent = word; $('#resultPhonetic').textContent = '/ — /'; $('#resultDefinition').textContent = '正在查询释义…'; $('#resultExample').textContent = '正在准备例句…';
  setSavedState();
  if (lookupCache.has(word)) { paintDefinition(word, ...lookupCache.get(word)); return; }
  const local = fallback[word];
  if (local) { lookupCache.set(word, [local[0], local[1], local[2], '/ local /']); paintDefinition(word, ...lookupCache.get(word)); return; }
  const requests = [fetchDictionaryDefinition(word).then(result => ({ value: [result.pos, result.definition, result.example, result.phonetic] }))];
  if (getApiKey()) requests.push(fetchDeepSeekDefinition(word).then(result => ({ value: [result.pos, result.definition, result.example, result.phonetic] })));
  try {
    const result = await Promise.any(requests.map(request => Promise.race([request, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3500))])));
    if (state.selected !== word) return;
    lookupCache.set(word, result.value); paintDefinition(word, ...result.value);
  } catch { if (state.selected === word) paintDefinition(word, 'word', '暂未找到在线释义，请结合上下文理解。', 'Keep meeting new words in context.', '/ — /'); }
}
async function fetchDictionaryDefinition(word) {
  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (!response.ok) throw new Error('not found');
  const data = await response.json(); const item = data[0]; const meaning = item.meanings?.[0]; const definition = meaning?.definitions?.[0];
  return { pos: meaning?.partOfSpeech || 'word', definition: definition?.definition || '暂无释义', example: definition?.example || 'Keep meeting new words in context.', phonetic: item.phonetic || '/ — /' };
}
async function fetchDeepSeekDefinition(word) {
  const response = await fetch('https://api.deepseek.com/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getApiKey()}` }, body: JSON.stringify({ model: 'deepseek-chat', temperature: 0.2, messages: [{ role: 'system', content: '你是英语学习词典。只返回 JSON，不要 Markdown。字段必须是 pos、definition、example、phonetic。definition 用简洁中文，example 保持英文。' }, { role: 'user', content: `解释单词：${word}` }] }) });
  if (!response.ok) throw new Error('DeepSeek request failed');
  const data = await response.json(); const raw = data.choices?.[0]?.message?.content || ''; const clean = raw.replace(/^```json\s*|\s*```$/g, '').trim(); const parsed = JSON.parse(clean);
  return { pos: parsed.pos || 'word', definition: parsed.definition || '暂无释义', example: parsed.example || 'Keep meeting new words in context.', phonetic: parsed.phonetic || '/ — /' };
}
function paintDefinition(word, pos, definition, example, phonetic) { $('#resultWord').textContent = word; $('#resultPos').textContent = pos; $('#resultDefinition').textContent = definition; $('#resultExample').textContent = example; $('#resultPhonetic').textContent = phonetic; setSavedState(); }
function setSavedState() { const saved = state.mistakes.some(item => item.word === state.selected); $('#savedState').textContent = saved ? '已在错题组中' : '尚未加入错题组'; $('#addMistake').classList.toggle('saved', saved); $('#quickAdd').innerHTML = saved ? '<i data-lucide="check"></i>已加入' : '<i data-lucide="plus"></i>加入错题组'; initIcons(); }

function addMistake() { if (!state.selected) return toast('请先点击一个单词'); if (!state.mistakes.some(item => item.word === state.selected)) { state.mistakes.push({ word: state.selected, definition: $('#resultDefinition').textContent }); renderMistakes(); toast(`“${state.selected}”已加入错题组`); } setSavedState(); }
function renderMistakes() { const list = $('#mistakeList'); if (!state.mistakes.length) list.innerHTML = '<div class="list-empty"><i data-lucide="bookmark"></i><span>还没有收藏的单词</span></div>'; else list.innerHTML = state.mistakes.map((item, i) => `<div class="mistake-item"><div><div class="mistake-word">${item.word}</div><div class="mistake-definition">${item.definition}</div></div><button class="remove-word" data-index="${i}" title="移除"><i data-lucide="x"></i></button></div>`).join(''); list.querySelectorAll('.remove-word').forEach(btn => btn.addEventListener('click', () => { state.mistakes.splice(Number(btn.dataset.index), 1); renderMistakes(); setSavedState(); })); updateStats(); initIcons(); }
function download(filename, content) { const blob = new Blob([content], { type: 'text/plain;charset=utf-8' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); URL.revokeObjectURL(link.href); }

$('#sampleBtn').addEventListener('click', () => { renderPassage(sampleText); toast('示例文段已载入'); });
$('#copyText').addEventListener('click', async () => { const text = $('#passage').innerText.trim(); if (!text || text === '识别结果会显示在这里') return toast('暂无可复制的文段'); await navigator.clipboard?.writeText(text); toast('全文已复制'); });
$('#addMistake').addEventListener('click', addMistake); $('#quickAdd').addEventListener('click', addMistake);
$('#clearMistakes').addEventListener('click', () => { state.mistakes = []; renderMistakes(); setSavedState(); toast('错题组已清空'); });
$('#exportMistakes').addEventListener('click', () => { if (!state.mistakes.length) return toast('错题组还是空的'); download('lingua-lens-错题本.txt', state.mistakes.map(item => item.word).join('\n')); toast('错题本已导出'); });

const input = $('#imageInput'); const dropzone = $('#dropzone');
function showFile(file) { if (!file || !file.type.startsWith('image/')) return toast('请选择 JPG、PNG 或 WEBP 图片'); const reader = new FileReader(); reader.onload = e => { $('#preview').src = e.target.result; $('#fileName').textContent = file.name; $('#previewWrap').classList.remove('hidden'); dropzone.classList.add('hidden'); $('#ocrBtn').disabled = false; }; reader.readAsDataURL(file); }
input.addEventListener('change', e => showFile(e.target.files[0])); $('#browseBtn').addEventListener('click', e => { e.preventDefault(); input.click(); }); $('#removeImage').addEventListener('click', () => { input.value = ''; $('#previewWrap').classList.add('hidden'); dropzone.classList.remove('hidden'); $('#ocrBtn').disabled = true; });
['dragenter','dragover'].forEach(type => dropzone.addEventListener(type, e => { e.preventDefault(); dropzone.classList.add('dragover'); })); ['dragleave','drop'].forEach(type => dropzone.addEventListener(type, e => { e.preventDefault(); dropzone.classList.remove('dragover'); })); dropzone.addEventListener('drop', e => showFile(e.dataTransfer.files[0]));
$('#ocrBtn').addEventListener('click', async () => { const file = input.files[0]; if (!file) return; $('#ocrBtn').disabled = true; $('#progress').classList.remove('hidden'); try { const result = await Tesseract.recognize(file, 'eng', { logger: message => { if (message.status === 'recognizing text') { const pct = Math.round((message.progress || 0) * 100); $('#progressBar').style.width = `${pct}%`; $('#progressText').textContent = `正在识别… ${pct}%`; } } }); const text = result.data.text.trim(); if (!text) throw new Error('empty'); renderPassage(text); $('#progressText').textContent = '识别完成'; toast('英文提取完成'); } catch { $('#progressText').textContent = '识别失败，请换一张更清晰的图片'; toast('识别失败，请重试'); } finally { $('#ocrBtn').disabled = false; } });

$('#bookInput').addEventListener('change', e => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = ev => { const words = ev.target.result.split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(Boolean); state.bookWords = [...new Set(words.filter(w => /^[a-z]+(?:['-][a-z]+)?$/.test(w)))]; const status = $('#bookStatus'); status.classList.remove('hidden'); if (state.bookWords.length < 20) { status.classList.add('error'); status.textContent = `已识别 ${state.bookWords.length} 个单词，还需要至少 ${20 - state.bookWords.length} 个`; $('#exportBook').disabled = true; } else { status.classList.remove('error'); status.textContent = `识别成功 · ${state.bookWords.length} 个单词，可生成词书`; $('#exportBook').disabled = false; } updateStats(); }; reader.readAsText(file); });
$('#exportBook').addEventListener('click', () => { download('lingua-lens-词书.txt', state.bookWords.join('\n')); toast('词书 TXT 已生成'); });
const apiModal = $('#apiModal'); const apiInput = $('#apiKey');
$('#apiSettings').addEventListener('click', () => { apiInput.value = sessionStorage.getItem('deepseek_api_key') || ''; apiModal.classList.remove('hidden'); apiInput.focus(); });
$('#closeApi').addEventListener('click', () => apiModal.classList.add('hidden'));
$('#saveApi').addEventListener('click', () => { const key = apiInput.value.trim(); if (key) sessionStorage.setItem('deepseek_api_key', key); else sessionStorage.removeItem('deepseek_api_key'); apiModal.classList.add('hidden'); toast(key ? 'DeepSeek 已启用' : 'DeepSeek 已关闭'); });
$('#clearApi').addEventListener('click', () => { apiInput.value = ''; sessionStorage.removeItem('deepseek_api_key'); toast('API Key 已清除'); });
$('#toggleKey').addEventListener('click', () => { apiInput.type = apiInput.type === 'password' ? 'text' : 'password'; });
apiModal.addEventListener('click', e => { if (e.target === apiModal) apiModal.classList.add('hidden'); });
renderMistakes(); initIcons();

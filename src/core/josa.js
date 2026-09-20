// 한국어 조사 자동 선택. UI 문장이 "열린 탭로" 처럼 어색해지는 걸 막는다.

const PAIRS = {
  '으로': ['으로', '로'],
  '은': ['은', '는'],
  '이': ['이', '가'],
  '을': ['을', '를'],
  '과': ['과', '와'],
};

/** 마지막 글자에 받침이 있으면 true. 한글이 아니면 null. */
export function hasFinalConsonant(word) {
  const last = String(word ?? '').trim().slice(-1);
  if (!last) return null;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  const jong = (code - 0xac00) % 28;
  // 'ㄹ' 받침은 '으로/로' 선택에서 받침 없는 것처럼 취급한다.
  return { has: jong !== 0, rieul: jong === 8 };
}

/** 단어 뒤에 붙일 조사를 고른다. 한글이 아니면 받침 있는 쪽을 쓴다(무난한 기본값). */
export function josa(word, form) {
  const pair = PAIRS[form];
  if (!pair) return form;
  const final = hasFinalConsonant(word);
  if (!final) return pair[0];
  if (form === '으로' && final.rieul) return pair[1];
  return final.has ? pair[0] : pair[1];
}

/** "열린 탭" + "으로" → "열린 탭으로" */
export function withJosa(word, form) {
  return `${word}${josa(word, form)}`;
}

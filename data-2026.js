/* 2026 真题补丁：统一 10 道真题的题干标记写法。
   data.js 长内容在线推送时，题 61 的题干出现过 1 个坏字符，
   这里在 app.js 渲染之前覆盖 f31–f40 的题干，保证显示干净。 */
(function () {
  var stems = [
    'Yesterday, they go(A) to(B) the library to(C) study(D) English.',
    'He said afterward(A) that it had been(B) the most(C) unforgettable experiences(D) of his life.',
    'She is(A) a(B) honest person who never lies(C), even(D) when it is hard.',
    'Francis is bounded(A) and determined(B) to win at least(C) five races(D) this year.',
    'This educational method is(A) so(B) effective as(C) the previous one(D).',
    'The government(A) needs to(B) recognize(C) fully(D) the dimensions of the problem.',
    'The teacher praised(A) my sister and I(B) for our excellent work(C) on that project(D).',
    'Each(A) visitor(B) were allowed(C) about one minute(D) to view the pandas.',
    'What(A) we should(B) protect the Great Wall is(C) of(D) every citizen.',
    'The cooperation on intellectual(A) property protection will be(B) continuously(C) deepen(D).'
  ];
  if (typeof FIX === 'undefined') return;
  for (var i = 0; i < stems.length; i++) {
    if (FIX[30 + i]) FIX[30 + i][2] = stems[i];
  }
})();

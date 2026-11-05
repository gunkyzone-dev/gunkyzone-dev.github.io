(function () {
  function normalizePath(value) {
    let normalized = String(value || '').trim();
    for (let i = 0; i < 2; i++) {
      if (!/%[0-9A-Fa-f]{2}/.test(normalized)) break;
      try {
        normalized = decodeURIComponent(normalized);
      } catch (_) {
        break;
      }
    }
    return normalized.replace(/^['"]|['"]$/g, '');
  }

  window.resolveSiteUrl = function (value) {
    const normalized = normalizePath(value);
    if (!normalized) return '';
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(normalized)) return normalized;
    return `/${normalized.replace(/^\.?\//, '')}`;
  };
})();
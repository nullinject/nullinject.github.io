const filterButtons = [...document.querySelectorAll('[data-filter]')];
const postRows = [...document.querySelectorAll('.archive-list [data-category]')];
for (const button of filterButtons) {
  button.addEventListener('click', () => {
    const filter = button.dataset.filter;
    for (const other of filterButtons) other.setAttribute('aria-pressed', String(other === button));
    for (const row of postRows) row.hidden = filter !== 'all' && row.dataset.category !== filter;
    document.querySelector('#filter-status').textContent = `显示 ${postRows.filter(row => !row.hidden).length} 篇文章`;
  });
}

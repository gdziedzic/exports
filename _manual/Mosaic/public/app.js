// Progressive enhancement only. Every page must be fully usable with this
// file absent - navigation, forms, sorting, filtering, pagination, and CRUD
// all work via plain links and form posts. This script only adds
// conveniences (column visibility toggles, per-block refresh, scroll
// position preservation, nicer delete confirmations) on top of that.
(function () {
  document.documentElement.classList.remove('no-js');
  document.documentElement.classList.add('js');

  // Bulk row selection: a "select all" checkbox toggles every row checkbox
  // in the same table. Without this script, rows are still selectable one
  // by one - this is a convenience, not a requirement for the feature to work.
  document.querySelectorAll('[data-select-all-rows]').forEach((selectAll) => {
    const form = selectAll.closest('form');
    if (!form) return;
    const rowCheckboxes = () => form.querySelectorAll('input[type="checkbox"][name="rowKey"]');
    selectAll.addEventListener('change', () => {
      rowCheckboxes().forEach((cb) => {
        cb.checked = selectAll.checked;
      });
    });
    form.addEventListener('change', (e) => {
      if (e.target === selectAll || e.target.name !== 'rowKey') return;
      const boxes = [...rowCheckboxes()];
      selectAll.checked = boxes.length > 0 && boxes.every((cb) => cb.checked);
    });
  });

  // Generated SQL/INSERT output: select the full contents on focus, so a
  // click + Ctrl/Cmd-A + Ctrl/Cmd-C copies everything in one go. Without
  // this the text is still fully readable and selectable manually.
  document.querySelectorAll('[data-select-on-focus]').forEach((el) => {
    el.addEventListener('focus', () => el.select());
  });
})();

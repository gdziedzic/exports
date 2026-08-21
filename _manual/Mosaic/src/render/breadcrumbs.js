import { html, buildPath } from './escape.js';

export function breadcrumbs(items) {
  return html`<nav class="breadcrumbs" aria-label="Breadcrumb">
    ${items.map((item, i) => html`${i > 0 ? ' / ' : ''}${item.href ? html`<a href="${item.href}">${item.label}</a>` : item.label}`)}
  </nav>`;
}

export function sourceBreadcrumbs(source) {
  return [{ label: 'Sources', href: '/' }, { label: source.name }];
}

export function tableBreadcrumbs(source, tableName, extra = []) {
  return [
    { label: 'Sources', href: '/' },
    { label: source.name, href: buildPath('sources', source.id) },
    { label: tableName },
    ...extra,
  ];
}

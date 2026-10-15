import { h } from '../dom.js';

// "Mer"-menyn på mobilen: listar de sidor som inte får plats i bottenmenyn.
export function moreView({ routes }) {
  return h('section', {},
    h('h2', {}, 'Mer'),
    h('ul', { class: 'menu-list' }, Object.entries(routes)
      .filter(([, r]) => !r.primary && !r.hidden)
      .map(([key, r]) => h('li', {}, h('a', { href: `#${key}` },
        h('span', { class: 'nav-icon', 'aria-hidden': 'true' }, r.icon), r.label)))));
}

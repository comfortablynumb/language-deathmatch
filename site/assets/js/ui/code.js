/* Code viewer: file tabs, line numbers, highlight.js, copy button. */
import * as format from '../lib/format.js';

const e = format.escapeHtml;

let counter = 0;

function highlighted(file) {
  const language = window.hljs && hljs.getLanguage(file.highlight) ? file.highlight : 'plaintext';

  if (language === 'plaintext') {
    return e(file.content);
  }

  return hljs.highlight(file.content, { language, ignoreIllegals: true }).value;
}

function gutter(file) {
  return Array.from({ length: Math.max(file.lines, 1) }, (_, i) => i + 1).join('\n');
}

function fileTab(file, index, viewerId) {
  return `<button type="button" role="tab" class="tab whitespace-nowrap" data-file="${index}"
    id="${viewerId}-tab-${index}" aria-controls="${viewerId}-panel-${index}" aria-selected="${index === 0}">
    ${e(file.path)}${file.role === 'source' ? '' : '<span class="text-[10px] tracking-wide text-ink-3 uppercase">build</span>'}
  </button>`;
}

function filePanel(file, index, viewerId) {
  return `<div role="tabpanel" id="${viewerId}-panel-${index}" aria-labelledby="${viewerId}-tab-${index}"
    class="code-view max-h-[640px] overflow-auto" ${index === 0 ? '' : 'hidden'}>
    <div class="gutter" aria-hidden="true"><pre>${gutter(file)}</pre></div>
    <pre><code class="hljs language-${e(file.highlight)}">${highlighted(file)}</code></pre>
  </div>`;
}

/** Returns the viewer HTML; call mount() after inserting it. */
export function viewer(files) {
  const id = `code-${++counter}`;
  const tabs = files.map((file, i) => fileTab(file, i, id)).join('');
  const panels = files.map((file, i) => filePanel(file, i, id)).join('');

  return `<div class="card overflow-hidden" data-code-viewer="${id}">
    <div class="flex items-end justify-between gap-4 border-b border-line bg-raised/40 px-4 pt-3">
      <div class="flex gap-5 overflow-x-auto overflow-y-hidden" role="tablist" aria-label="Files">${tabs}</div>
      <button type="button" class="mb-2 shrink-0 rounded-md border border-line px-2.5 py-1 text-xs text-ink-2 hover:text-ink"
        data-copy>Copy</button>
    </div>
    ${panels}
  </div>`;
}

/** Binds tab switching and copy for every viewer inside $root; files by viewer order. */
export function mount($root, filesPerViewer) {
  $root.find('[data-code-viewer]').each(function (index) {
    const $viewer = $(this);
    const files = filesPerViewer[index];

    $viewer.on('click', '[data-file]', function () {
      const selected = Number($(this).data('file'));
      $viewer.find('[data-file]').attr('aria-selected', (i) => String(i === selected));
      $viewer.find('[role=tabpanel]').attr('hidden', (i) => (i === selected ? null : 'hidden'));
    });

    $viewer.on('click', '[data-copy]', function () {
      const selected = Number($viewer.find('[data-file][aria-selected=true]').data('file')) || 0;
      copy(files[selected].content, $(this));
    });
  });
}

function copy(text, $button) {
  const done = (label) => {
    $button.text(label);
    setTimeout(() => $button.text('Copy'), 1500);
  };

  if (!navigator.clipboard) {
    done('Unavailable');
    return;
  }

  navigator.clipboard.writeText(text).then(() => done('Copied ✓'), () => done('Failed'));
}

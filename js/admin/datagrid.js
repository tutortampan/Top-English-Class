export class DataGrid {
  constructor({ container, data = [], columns = [], pageSize = 50, searchKeys = [], emptyStateHtml = '<p>No records found.</p>', bulkActions = false, onBulkAction = null, onRowClick = null, stickyActionCol = false }) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.rawData = data;
    this.filteredData = [...data];
    // Add default hidden property if not present
    this.columns = columns.map(c => ({...c, hidden: !!c.hidden}));
    this.pageSize = pageSize;
    this.currentPage = 1;
    this.searchKeys = searchKeys;
    this.emptyStateHtml = emptyStateHtml;
    this.sortKey = null;
    this.sortAsc = true;
    this.bulkActions = bulkActions;
    this.selectedIds = new Set();
    this.onBulkAction = onBulkAction;
    this.onRowClick = onRowClick;
    this.stickyActionCol = stickyActionCol;
    
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="datagrid-toolbar" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; gap:1rem; flex-wrap:wrap;">
        <div class="datagrid-search" style="flex:1; min-width:200px; display:flex; gap:0.5rem; align-items:center;">
          <div class="datagrid-search-wrap" style="position:relative; max-width:320px; width:100%;">
            <input type="text" class="form-control datagrid-search-input" placeholder="Search... (Ctrl+K)" style="width:100%; padding-right:2rem;" />
            <button type="button" class="datagrid-search-clear hidden" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:transparent; border:none; color:var(--clr-text-3); cursor:pointer; font-size:0.85rem; padding:2px 4px;" title="Clear search">âœ•</button>
          </div>
          <div class="datagrid-columns-dropdown" style="position:relative;">
            <button class="btn btn-secondary btn-sm datagrid-cols-btn" style="height:100%;">Columns</button>
            <div class="datagrid-cols-menu hidden" style="position:absolute; top:100%; left:0; background:var(--clr-bg-2); border:1px solid var(--clr-border); padding:0.5rem; border-radius:8px; z-index:100; min-width:150px; box-shadow:0 10px 20px rgba(0,0,0,0.3);">
            </div>
          </div>
        </div>
        <div class="datagrid-actions" style="display:flex; gap:0.5rem; align-items:center;">
          <span class="datagrid-count text-muted text-sm" style="margin-right:1rem;"></span>
          ${this.bulkActions ? `<button class="btn btn-secondary btn-sm datagrid-bulk-btn hidden">Bulk Action (<span class="datagrid-bulk-count">0</span>)</button>` : ''}
        </div>
      </div>
      <div class="table-wrap" style="overflow-x:auto;">
        <table class="datagrid-table" style="width:100%; position:relative;">
          <thead class="datagrid-thead">
          </thead>
          <tbody class="datagrid-tbody"></tbody>
        </table>
      </div>
      <div class="datagrid-pagination" style="display:flex; justify-content:center; align-items:center; gap:0.5rem; margin-top:1rem;">
      </div>
    `;

    this.thead = this.container.querySelector('.datagrid-thead');
    this.tbody = this.container.querySelector('.datagrid-tbody');
    this.searchInput = this.container.querySelector('.datagrid-search-input');
    this.searchClearBtn = this.container.querySelector('.datagrid-search-clear');
    this.paginationContainer = this.container.querySelector('.datagrid-pagination');
    this.countLabel = this.container.querySelector('.datagrid-count');
    this.colsMenu = this.container.querySelector('.datagrid-cols-menu');
    this.colsBtn = this.container.querySelector('.datagrid-cols-btn');

    if (this.searchKeys && this.searchKeys.length > 0) {
      let searchDebounceTimer = null;
      this.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchDebounceTimer);
        const query = e.target.value;
        this.searchClearBtn?.classList.toggle('hidden', !query);
        searchDebounceTimer = setTimeout(() => {
          this.currentPage = 1;
          this.filterData(query);
          this.render();
        }, 150);
      });

      this.searchClearBtn?.addEventListener('click', () => {
        this.searchInput.value = '';
        this.searchClearBtn.classList.add('hidden');
        this.currentPage = 1;
        this.filterData('');
        this.render();
        this.searchInput.focus();
      });

      // Quick keyboard shortcut: Ctrl+K or Cmd+K focuses search
      this._keyHandler = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
          if (document.body.contains(this.searchInput)) {
            e.preventDefault();
            this.searchInput.focus();
            this.searchInput.select();
          }
        }
      };
      document.addEventListener('keydown', this._keyHandler);
    } else {
      const searchWrap = this.container.querySelector('.datagrid-search-wrap');
      if (searchWrap) searchWrap.style.display = 'none';
      else this.searchInput.style.display = 'none';
    }

    // Toggle columns menu
    this.colsBtn.addEventListener('click', () => {
      this.colsMenu.classList.toggle('hidden');
    });

    // Hide menu when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.colsBtn.contains(e.target) && !this.colsMenu.contains(e.target)) {
        this.colsMenu.classList.add('hidden');
      }
    });

    if (this.bulkActions) {
      const bulkBtn = this.container.querySelector('.datagrid-bulk-btn');
      bulkBtn.addEventListener('click', () => {
        if (this.onBulkAction) {
          this.onBulkAction(this.getSelection());
        }
      });
    }

    this.renderHeaders();
    this.render();
  }

  renderHeaders() {
    // Update columns menu
    this.colsMenu.innerHTML = this.columns.map((col, idx) => `
      <label style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem; font-size:0.85rem; cursor:pointer;">
        <input type="checkbox" class="datagrid-col-toggle" data-idx="${idx}" ${!col.hidden ? 'checked' : ''} />
        ${col.label}
      </label>
    `).join('');

    this.colsMenu.querySelectorAll('.datagrid-col-toggle').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        this.columns[idx].hidden = !e.target.checked;
        this.renderHeaders();
        this.render();
      });
    });

    // Render <thead>
    const visibleCols = this.columns.filter(c => !c.hidden);
    let html = '<tr>';
    if (this.bulkActions) {
      html += `<th style="width:40px; text-align:center; position:sticky; left:0; z-index:10; background:var(--clr-bg-2);"><input type="checkbox" class="datagrid-select-all" /></th>`;
    }
    
    visibleCols.forEach((col, visibleIdx) => {
      const isStickyRight = this.stickyActionCol && visibleIdx === visibleCols.length - 1;
      const stickyStyle = isStickyRight ? 'position:sticky; right:0; z-index:10; background:var(--clr-bg-2);' : '';
      html += `
        <th class="${col.align ? `text-${col.align}` : 'text-left'} ${col.sortable ? 'datagrid-sortable' : ''}" 
            data-key="${col.key || ''}" 
            data-idx="${this.columns.indexOf(col)}"
            draggable="true"
            style="${col.sortable ? 'cursor:pointer; user-select:none;' : ''} ${col.width ? `width:${col.width};` : ''} ${stickyStyle}">
          ${col.label} ${col.sortable ? `<span class="sort-icon">${this.sortKey === col.key ? (this.sortAsc ? 'â†‘' : 'â†“') : 'â‡…'}</span>` : ''}
        </th>
      `;
    });
    html += '</tr>';
    this.thead.innerHTML = html;

    // Attach Sorting
    this.thead.querySelectorAll('.datagrid-sortable').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (!key) return;
        if (this.sortKey === key) {
          this.sortAsc = !this.sortAsc;
        } else {
          this.sortKey = key;
          this.sortAsc = true;
        }
        this.sortData();
        this.renderHeaders();
        this.render();
      });
    });

    // Attach Drag and Drop for Reordering
    let draggedIdx = null;
    this.thead.querySelectorAll('th[draggable="true"]').forEach(th => {
      th.addEventListener('dragstart', (e) => {
        draggedIdx = parseInt(th.dataset.idx);
        e.dataTransfer.effectAllowed = 'move';
        th.style.opacity = '0.5';
      });
      th.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        th.style.borderLeft = '2px solid var(--clr-primary)';
      });
      th.addEventListener('dragleave', (e) => {
        th.style.borderLeft = '';
      });
      th.addEventListener('dragend', () => {
        th.style.opacity = '1';
        this.thead.querySelectorAll('th').forEach(t => t.style.borderLeft = '');
      });
      th.addEventListener('drop', (e) => {
        e.preventDefault();
        th.style.borderLeft = '';
        const targetIdx = parseInt(th.dataset.idx);
        if (draggedIdx !== null && draggedIdx !== targetIdx) {
          const colToMove = this.columns.splice(draggedIdx, 1)[0];
          const newIdx = this.columns.indexOf(this.columns.find((_, i) => i === targetIdx));
          this.columns.splice(newIdx !== -1 ? newIdx : targetIdx, 0, colToMove);
          this.renderHeaders();
          this.render();
        }
      });
    });

    if (this.bulkActions) {
      this.selectAllCb = this.container.querySelector('.datagrid-select-all');
      if (this.selectAllCb) {
        this.selectAllCb.addEventListener('change', (e) => {
          const checked = e.target.checked;
          const rowCbs = this.tbody.querySelectorAll('.datagrid-row-cb');
          rowCbs.forEach(cb => {
            cb.checked = checked;
            if (checked) this.selectedIds.add(cb.value);
            else this.selectedIds.delete(cb.value);
          });
          this.updateBulkUI();
        });
      }
    }
  }

  filterData(query) {
    if (!query || !query.trim()) {
      this.filteredData = [...this.rawData];
    } else {
      const q = query.toLowerCase().trim();
      this.filteredData = this.rawData.filter(row => {
        return this.searchKeys.some(key => {
          const val = String(row[key] || '').toLowerCase();
          return val.includes(q);
        });
      });
    }
    this.sortData();
  }

  sortData() {
    if (!this.sortKey) return;
    this.filteredData.sort((a, b) => {
      let valA = a[this.sortKey];
      let valB = b[this.sortKey];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      
      if (valA < valB) return this.sortAsc ? -1 : 1;
      if (valA > valB) return this.sortAsc ? 1 : -1;
      return 0;
    });
  }

  getSelection() {
    return Array.from(this.selectedIds);
  }

  updateBulkUI() {
    if (!this.bulkActions) return;
    const btn = this.container.querySelector('.datagrid-bulk-btn');
    const count = this.container.querySelector('.datagrid-bulk-count');
    if (this.selectedIds.size > 0) {
      btn.classList.remove('hidden');
      count.textContent = this.selectedIds.size;
    } else {
      btn.classList.add('hidden');
    }
  }

  updateData(newData) {
    this.rawData = newData;
    this.filterData(this.searchInput.value);
    this.render();
  }

  render() {
    this.countLabel.textContent = `${this.filteredData.length} records`;
    this.tbody.innerHTML = '';
    const visibleCols = this.columns.filter(c => !c.hidden);
    
    if (this.filteredData.length === 0) {
      const colSpan = visibleCols.length + (this.bulkActions ? 1 : 0);
      this.tbody.innerHTML = `<tr><td colspan="${colSpan}">${this.emptyStateHtml}</td></tr>`;
      this.renderPagination(0);
      return;
    }

    const totalPages = Math.ceil(this.filteredData.length / this.pageSize);
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    const pageData = this.filteredData.slice(start, end);

    pageData.forEach(row => {
      const tr = document.createElement('tr');
      if (this.onRowClick) {
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', (e) => {
          // Avoid triggering row click if they clicked a checkbox or a button inside the row
          if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
          this.onRowClick(row);
        });
      }

      if (this.bulkActions) {
        const tdCb = document.createElement('td');
        tdCb.style.textAlign = 'center';
        tdCb.style.position = 'sticky';
        tdCb.style.left = '0';
        tdCb.style.background = 'var(--clr-bg-1)';
        tdCb.style.zIndex = '5';
        tdCb.innerHTML = `<input type="checkbox" class="datagrid-row-cb" value="${row.id}" ${this.selectedIds.has(String(row.id)) ? 'checked' : ''} />`;
        tdCb.querySelector('input').addEventListener('change', (e) => {
          if (e.target.checked) this.selectedIds.add(String(row.id));
          else this.selectedIds.delete(String(row.id));
          this.updateBulkUI();
        });
        tr.appendChild(tdCb);
      }

      visibleCols.forEach((col, visibleIdx) => {
        const td = document.createElement('td');
        if (col.align) td.classList.add(`text-${col.align}`);
        
        const isStickyRight = this.stickyActionCol && visibleIdx === visibleCols.length - 1;
        if (isStickyRight) {
          td.style.position = 'sticky';
          td.style.right = '0';
          td.style.background = 'var(--clr-bg-1)';
          td.style.zIndex = '5';
        }

        if (col.render) {
          const content = col.render(row);
          if (content instanceof HTMLElement) td.appendChild(content);
          else td.innerHTML = content;
        } else if (col.key) {
          td.textContent = row[col.key] ?? '';
        }
        tr.appendChild(td);
      });
      this.tbody.appendChild(tr);
    });

    if (this.bulkActions && this.selectAllCb) {
      this.selectAllCb.checked = pageData.length > 0 && pageData.every(r => this.selectedIds.has(String(r.id)));
    }

    this.renderPagination(totalPages);
  }

  renderPagination(totalPages) {
    this.paginationContainer.innerHTML = '';
    if (totalPages <= 1) return;

    const createBtn = (text, page, disabled = false, active = false) => {
      const btn = document.createElement('button');
      btn.className = `btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`;
      btn.textContent = text;
      btn.disabled = disabled;
      if (!disabled && !active) {
        btn.addEventListener('click', () => {
          this.currentPage = page;
          this.render();
        });
      }
      return btn;
    };

    this.paginationContainer.appendChild(createBtn('Â«', 1, this.currentPage === 1));
    this.paginationContainer.appendChild(createBtn('â€¹', this.currentPage - 1, this.currentPage === 1));

    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(totalPages, this.currentPage + 2);
    
    if (this.currentPage <= 2) endPage = Math.min(5, totalPages);
    if (this.currentPage >= totalPages - 1) startPage = Math.max(1, totalPages - 4);

    for (let i = startPage; i <= endPage; i++) {
      this.paginationContainer.appendChild(createBtn(String(i), i, false, this.currentPage === i));
    }

    this.paginationContainer.appendChild(createBtn('â€º', this.currentPage + 1, this.currentPage === totalPages));
    this.paginationContainer.appendChild(createBtn('Â»', totalPages, this.currentPage === totalPages));
  }
}

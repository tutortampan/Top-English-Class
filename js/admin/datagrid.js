export class DataGrid {
  constructor({ container, data = [], columns = [], pageSize = 50, searchKeys = [], emptyStateHtml = '<p>No records found.</p>', bulkActions = false }) {
    this.container = typeof container === 'string' ? document.getElementById(container) : container;
    this.rawData = data;
    this.filteredData = [...data];
    this.columns = columns;
    this.pageSize = pageSize;
    this.currentPage = 1;
    this.searchKeys = searchKeys;
    this.emptyStateHtml = emptyStateHtml;
    this.sortKey = null;
    this.sortAsc = true;
    this.bulkActions = bulkActions;
    this.selectedIds = new Set();
    
    this.init();
  }

  init() {
    this.container.innerHTML = `
      <div class="datagrid-toolbar" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; gap:1rem; flex-wrap:wrap;">
        <div class="datagrid-search" style="flex:1; min-width:200px;">
          <input type="text" class="form-control datagrid-search-input" placeholder="Search..." style="max-width:300px; width:100%;" />
        </div>
        <div class="datagrid-actions" style="display:flex; gap:0.5rem; align-items:center;">
          <span class="datagrid-count text-muted text-sm" style="margin-right:1rem;"></span>
          ${this.bulkActions ? `<button class="btn btn-secondary btn-sm datagrid-bulk-btn hidden">Bulk Action (<span class="datagrid-bulk-count">0</span>)</button>` : ''}
        </div>
      </div>
      <div class="table-wrap">
        <table class="datagrid-table" style="width:100%;">
          <thead>
            <tr>
              ${this.bulkActions ? `<th style="width:40px; text-align:center;"><input type="checkbox" class="datagrid-select-all" /></th>` : ''}
              ${this.columns.map(col => `
                <th class="${col.align ? `text-${col.align}` : 'text-left'} ${col.sortable ? 'datagrid-sortable' : ''}" data-key="${col.key || ''}" style="${col.sortable ? 'cursor:pointer; user-select:none;' : ''} ${col.width ? `width:${col.width}` : ''}">
                  ${col.label} ${col.sortable ? '<span class="sort-icon">⇅</span>' : ''}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody class="datagrid-tbody"></tbody>
        </table>
      </div>
      <div class="datagrid-pagination" style="display:flex; justify-content:center; align-items:center; gap:0.5rem; margin-top:1rem;">
      </div>
    `;

    this.tbody = this.container.querySelector('.datagrid-tbody');
    this.searchInput = this.container.querySelector('.datagrid-search-input');
    this.paginationContainer = this.container.querySelector('.datagrid-pagination');
    this.countLabel = this.container.querySelector('.datagrid-count');

    if (this.searchKeys && this.searchKeys.length > 0) {
      this.searchInput.addEventListener('input', (e) => {
        this.currentPage = 1;
        this.filterData(e.target.value);
        this.render();
      });
    } else {
      this.searchInput.style.display = 'none';
    }

    this.container.querySelectorAll('.datagrid-sortable').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (!key) return;
        if (this.sortKey === key) {
          this.sortAsc = !this.sortAsc;
        } else {
          this.sortKey = key;
          this.sortAsc = true;
        }
        
        this.container.querySelectorAll('.sort-icon').forEach(icon => icon.textContent = '⇅');
        th.querySelector('.sort-icon').textContent = this.sortAsc ? '↑' : '↓';
        
        this.sortData();
        this.render();
      });
    });

    if (this.bulkActions) {
      this.selectAllCb = this.container.querySelector('.datagrid-select-all');
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

    this.render();
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
    this.countLabel.textContent = \`\${this.filteredData.length} records\`;
    this.tbody.innerHTML = '';
    
    if (this.filteredData.length === 0) {
      const colSpan = this.columns.length + (this.bulkActions ? 1 : 0);
      this.tbody.innerHTML = \`<tr><td colspan="\${colSpan}">\${this.emptyStateHtml}</td></tr>\`;
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
      if (this.bulkActions) {
        const tdCb = document.createElement('td');
        tdCb.style.textAlign = 'center';
        tdCb.innerHTML = \`<input type="checkbox" class="datagrid-row-cb" value="\${row.id}" \${this.selectedIds.has(String(row.id)) ? 'checked' : ''} />\`;
        tdCb.querySelector('input').addEventListener('change', (e) => {
          if (e.target.checked) this.selectedIds.add(String(row.id));
          else this.selectedIds.delete(String(row.id));
          this.updateBulkUI();
        });
        tr.appendChild(tdCb);
      }

      this.columns.forEach(col => {
        const td = document.createElement('td');
        if (col.align) td.classList.add(\`text-\${col.align}\`);
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
      btn.className = \`btn btn-sm \${active ? 'btn-primary' : 'btn-secondary'}\`;
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

    this.paginationContainer.appendChild(createBtn('«', 1, this.currentPage === 1));
    this.paginationContainer.appendChild(createBtn('‹', this.currentPage - 1, this.currentPage === 1));

    let startPage = Math.max(1, this.currentPage - 2);
    let endPage = Math.min(totalPages, this.currentPage + 2);
    
    if (this.currentPage <= 2) endPage = Math.min(5, totalPages);
    if (this.currentPage >= totalPages - 1) startPage = Math.max(1, totalPages - 4);

    for (let i = startPage; i <= endPage; i++) {
      this.paginationContainer.appendChild(createBtn(String(i), i, false, this.currentPage === i));
    }

    this.paginationContainer.appendChild(createBtn('›', this.currentPage + 1, this.currentPage === totalPages));
    this.paginationContainer.appendChild(createBtn('»', totalPages, this.currentPage === totalPages));
  }
}

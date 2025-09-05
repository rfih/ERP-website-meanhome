function openModal(id){ document.getElementById(id).style.display='block'; }
function closeModal(id){ document.getElementById(id).style.display='none'; }
function toggleDetails(orderId){
  const el = document.getElementById('details-'+orderId);
  el.style.display = (el.style.display==='none'||!el.style.display) ? 'table-row-group' : 'none';
}

function submitOrder(){
  const payload = {
    demand_date: document.getElementById('m-demand').value.trim(),
    delivery: document.getElementById('m-delivery').value.trim(),
    manufacture_code: document.getElementById('m-code').value.trim(),
    customer: document.getElementById('m-customer').value.trim(),
    product: document.getElementById('m-product').value.trim(),
    quantity: parseInt(document.getElementById('m-qty').value||'0',10),
    datecreate: document.getElementById('m-datecreate').value.trim(),
    fengbian: document.getElementById('m-fengbian').value.trim(),
    wallpaper: document.getElementById('m-wallpaper').value.trim(),
    jobdesc: document.getElementById('m-jobdesc').value.trim(),
    initial_tasks: []
  };
  const stationRows = document.querySelectorAll("#station-planner .row");
  payload.initial_tasks = [];

  for (const row of stationRows) {
    const sel = row.querySelector(".station-select");
    const inp = row.querySelector(".task-name-input");
    const inpCustom = row.querySelector(".custom-station-input");
    const groupVal = (sel.value === "__custom__")
      ? (inpCustom.value || "").trim()
      : sel.value;
    const taskVal = (inp.value || "").trim();
    if (groupVal && taskVal) {
      payload.initial_tasks.push({ group: groupVal, task: taskVal });;
    }
  }
  
  if(!payload.customer || !payload.product || !payload.quantity){
    alert('請填寫 客戶/產品/數量'); return;
  }
  fetch('/add_order',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)})
    .then(r=>r.json()).then(j=>{ if(j.success){ closeModal('modal-order'); } else alert(j.message||'新增失敗'); });
}

function openTaskModal(orderId){
  document.getElementById('t-order-id').value = orderId;

  // reset fields
  const sel = document.getElementById('t-group-select');
  const custom = document.getElementById('t-group-custom');
  if (sel && custom) {
    sel.value = "";
    custom.value = "";
    custom.style.display = 'none';
  }
  document.getElementById('t-task').value = "";
  document.getElementById('t-qty').value = "";

  openModal('modal-task');
}

(function wireAddTaskGroupSelect(){
  const sel = document.getElementById('t-group-select');
  const custom = document.getElementById('t-group-custom');
  if (!sel || !custom) return;
  sel.addEventListener('change', () => {
    if (sel.value === '__custom__') {
      custom.style.display = '';
      custom.focus();
    } else {
      custom.style.display = 'none';
      custom.value = '';
    }
  });
})();

function submitTask(){
  const sel = document.getElementById('t-group-select');
  const custom = document.getElementById('t-group-custom');

  const groupVal = (sel.value === '__custom__')
    ? (custom.value || '').trim()
    : (sel.value || '').trim();

  const payload = {
    order_id: parseInt(document.getElementById('t-order-id').value,10),
    group: groupVal,
    task: document.getElementById('t-task').value.trim(),
    quantity: parseInt(document.getElementById('t-qty').value||'0',10),
    completed: 0
  };

  if(!payload.group || !payload.task || !payload.quantity){
    alert('請填寫完整資料'); return;
  }

  fetch('/add_task',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  })
  .then(r=>r.json())
  .then(j=>{ if(j.success){ closeModal('modal-task'); } else alert(j.message||'新增失敗'); });
} 

function updateTask(taskId, orderId){
  const input = document.getElementById('done-'+taskId);
  const val = parseInt((input && input.value) || '0', 10);

  fetch('/update_task', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ task_id: taskId, order_id: orderId, completed: val })
  })
  .then(r => r.json())
  .then(j => {
    if (!j.success) throw 0;

    const row = document.getElementById('task-'+taskId);
    if (!row) return;

    // read the quantity from a data- attribute, not from a column index
    const qty = parseInt(row.dataset.qty || '0', 10);
    const completed = j.completed || 0;
    const rem = Math.max(0, qty - completed);

    // update input
    if (input) input.value = completed;

    // update "remaining" cell (works in both pages)
    const remEl = row.querySelector('.remaining');
    if (remEl) remEl.textContent = rem;

    // update the per-task progress bar
    const fill = row.querySelector('.progress-fill');
    if (fill) fill.style.width = (qty ? (completed/qty)*100 : 0) + '%';

    // update the order bar on the main page (no-op on /stations)
    if (orderId) updateOrderProgress(orderId);

    toast('已更新');
  })
  .catch(() => alert('更新失敗'));
}

function updateOrderProgress(orderId){
  // find all task rows inside this order’s details block and sum totals
  const tbody = document.getElementById('details-'+orderId);
  if (!tbody) return;

  let done = 0, total = 0;
  tbody.querySelectorAll('tr[id^="task-"]').forEach(tr => {
    const qty = parseInt(tr.children[2].textContent || '0', 10);
    const comp = parseInt(tr.querySelector('input[type="number"]')?.value || '0', 10);
    total += qty;
    done  += comp;
  });

  // top row bar: #order-{orderId} .progress-fill
  const bar = document.querySelector(`#order-${orderId} .progress-fill`);
  if (bar) bar.style.width = (total ? (done/total)*100 : 0) + '%';
}

function fmt(dt){ return dt ? new Date(dt).toLocaleString() : '-' }

function showHistory(taskId){
  openModal("modal-history");
  const box = document.getElementById("history-content");
  box.innerHTML = "<p>Loading...</p>";

  fetch(`/task-history/${taskId}`)
    .then(r => r.json())
    .then(data => {
      if (!data || !data.length) { box.innerHTML = "<p>No updates recorded yet.</p>"; return; }

      let html = "";
      for (const item of data) {
        const kind = item.note || "update";
        const hasRun = kind === "stop"; // completed run
        const delta = (item.delta !== null && item.delta !== undefined) ? item.delta : null;
        const pace = (hasRun && item.duration_minutes && delta)
          ? (delta * 60 / item.duration_minutes).toFixed(1) : null;

        html += `
          <div style="padding:8px 10px;border-bottom:1px solid #e5e5e5">
            ${kind === 'start' ? '動作: start' : kind === 'stop' ? '動作: stop' : '動作: update'}<br>
            ${delta !== null ? `本次: ${delta}　` : ''}總計: ${item.completed ?? '-'}<br>
            記錄時間: ${fmt(item.timestamp)}<br>
            ${hasRun ? `開始時間: ${fmt(item.start_time)}<br>` : ''}
            ${hasRun ? `結束時間: ${fmt(item.stop_time)}<br>` : ''}
            ${hasRun ? `所需時間: ${item.duration_minutes ?? '-'} 分鐘${pace ? `（效率: ${pace}/hr）` : ''}` : ''}
          </div>`;
      }
      box.innerHTML = html;
    })
    .catch(() => { box.innerHTML = "<p>Error loading history.</p>";});
}

function editTask(id, orderId, group, task, quantity) {
  document.getElementById("edit-task-id").value = id;
  document.getElementById("edit-order-id").value = orderId;
  document.getElementById("edit-name").value = task;
  document.getElementById("edit-qty").value = quantity;

  const sel = document.getElementById("edit-group-select");
  const custom = document.getElementById("edit-group-custom");

  // reset
  if (custom) { custom.style.display = 'none'; custom.value = ''; }
  if (sel) {
    // try to match a built-in option
    let matched = false;
    for (const opt of sel.options) {
      if (opt.value && opt.value !== '__custom__' && opt.value === group) {
        sel.value = opt.value;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // fall back to custom
      sel.value = group ? '__custom__' : '';
      if (group) {
        custom.style.display = '';
        custom.value = group;
      }
    }
  }

  openModal("modal-edit-task");
}

function submitEditTask() {
  const sel = document.getElementById('edit-group-select');
  const custom = document.getElementById('edit-group-custom');
  const groupVal = (sel.value === '__custom__')
    ? (custom.value || '').trim()
    : (sel.value || '').trim();

  const payload = {
    task_id: parseInt(document.getElementById("edit-task-id").value),
    order_id: parseInt(document.getElementById("edit-order-id").value),
    group: groupVal,
    task: document.getElementById("edit-name").value.trim(),
    quantity: parseInt(document.getElementById("edit-qty").value || '0', 10)
  };

  if (!payload.group || !payload.task || !payload.quantity) {
    alert("請填寫完整資料");
    return;
  }

  fetch("/update_task_info", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  .then(r => r.json())
  .then(j => {
    if (j.success) {
      closeModal("modal-edit-task");
      toast('已更新');
    } else {
      alert(j.message || "更新失敗");
    }
  })
  .catch(()=> alert("更新失敗"));
}

function deleteTask(taskId, orderId) {
  if (!confirm("Are you sure you want to delete this task?")) return;

  fetch("/delete_task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_id: taskId, order_id: orderId })
  }).then(r => r.json()).then(j => {
    if (j.success);
    else alert(j.message || "刪除失敗");
  });
}

(function wireEditTaskGroupSelect(){
  const sel = document.getElementById('edit-group-select');
  const custom = document.getElementById('edit-group-custom');
  if (!sel || !custom) return;
  sel.addEventListener('change', () => {
    if (sel.value === '__custom__') {
      custom.style.display = '';
      custom.focus();
    } else {
      custom.style.display = 'none';
      custom.value = '';
    }
  });
})();


function deleteOrder(orderId) {
  if (!confirm("Are you sure you want to delete this order and all its tasks?")) return;

  fetch("/delete_order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: orderId })
  }).then(r => r.json()).then(j => {
    if (j.success);
    else alert(j.message || "刪除失敗");
  });
}

function addPlannedStation() {
  const container = document.getElementById("station-planner");
  const tmpl = document.getElementById("station-template");
  const frag = tmpl.content.cloneNode(true);

  // wire up the new row’s custom toggle
  const row = frag.querySelector('.row');
  const sel = row.querySelector('.station-select');
  const custom = row.querySelector('.custom-station-input');
  sel.addEventListener('change', () => {
    if (sel.value === '__custom__') {
      custom.style.display = '';
      custom.focus();
    } else {
      custom.style.display = 'none';
      custom.value = '';
    }
  });

  container.appendChild(frag);
}

// ---- helpers -------------------------------------------------
function toast(msg){
  const el = document.createElement('div');
  el.textContent = msg;
  el.style.cssText =
    'position:fixed;right:16px;bottom:16px;background:#343a40;color:#fff;' +
    'padding:8px 12px;border-radius:6px;opacity:.95;z-index:2000';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function setRunningUI(taskId, running){
  const row = document.getElementById('task-'+taskId);
  if (!row) return;

  // toggle buttons
  const startBtn = row.querySelector('button[onclick^="startTask"]');
  const stopBtn  = row.querySelector('button[onclick^="stopTask"]');
  if (startBtn) startBtn.disabled = running;
  if (stopBtn)  stopBtn.disabled  = !running;

  // animate the per-task bar
  const fill = row.querySelector('.progress-fill');
  if (fill) fill.classList.toggle('running', running);

  // optional: status text if you added it
  const status = row.querySelector('.task-status');
  if (status){
    status.classList.toggle('running', running);
    status.innerHTML = running
      ? '<span class="dot"></span><span>Running</span>'
      : '<span class="dot"></span><span>Idle</span>';
  }

  // optional: row highlight
  row.classList.toggle('is-running', running);
}

function startTask(taskId){
  fetch('/update_task_timer', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ task_id: taskId, action: 'start' })
  })
  .then(r => r.json())
  .then(j => {
    if (!j.success) throw new Error(j.message || 'start failed');
    setRunningUI(taskId, true); toast('已開始'); 
  })
  .catch(err => { console.error(err); alert('Start failed'); });
}

function stopTask(taskId){
  fetch('/update_task_timer', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ task_id: taskId, action: 'stop' })
  })
  .then(r => r.json())
  .then(j => {
    if (!j.success) throw new Error(j.message || 'stop failed');
    setRunningUI(taskId, false); toast('已停止');
  })
  .catch(err => { console.error(err); alert('Stop failed'); });
}


function toLocal(s) {
  if (!s) return '-';
  let str = s.trim();

  // Ensure ISO shape
  if (!str.includes('T')) str = str.replace(' ', 'T');
  // Normalize UTC offset
  str = str.replace('+00:00', 'Z');
  // Trim fractional seconds to 3 digits (JS Date prefers milliseconds)
  str = str.replace(/\.(\d{3})\d+/, '.$1');

  const d = new Date(str);
  if (isNaN(d)) return s;  // fallback
  return d.toLocaleString();
}

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function updateTaskRowUI(taskId, completed){
  const row = document.getElementById('task-'+taskId);
  if(!row) return;
  const qty = parseInt(row.dataset.qty || '0', 10);
  const rem = Math.max(0, qty - completed);

  // input (server may clamp)
  const input = document.getElementById('done-'+taskId);
  if (input) input.value = completed;

  // progress bar in this row
  const bar = row.querySelector('.progress-fill');
  const pct = qty > 0 ? (completed / qty) * 100 : 0;
  if (bar) bar.style.width = pct + '%';

  // remaining cell
  const remCell = row.querySelector('.remaining');
  if (remCell) remCell.textContent = rem;
}

function recalcOrderProgress(orderId){
  const tbody = document.getElementById('details-'+orderId);
  if(!tbody) return;

  let total = 0, done = 0;

  tbody.querySelectorAll('tr[id^="task-"]').forEach(r=>{
    const qty = parseInt(r.dataset.qty || '0', 10);
    const compInput = r.querySelector('input[id^="done-"]');
    const comp = parseInt((compInput && compInput.value) || '0', 10);
    total += qty;
    done  += clamp(comp, 0, qty);
  });

  const orderRow = document.getElementById('order-'+orderId);
  const bar = orderRow && orderRow.querySelector('.progress-fill');
  if (bar) bar.style.width = (total ? (done/total)*100 : 0) + '%';
}

// optional little feedback
function toast(msg){
  try{
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = 'position:fixed;right:16px;bottom:16px;background:#343a40;color:#fff;padding:8px 12px;border-radius:6px;opacity:.95;z-index:2000';
    document.body.appendChild(el);
    setTimeout(()=>{ el.remove(); }, 1400);
  }catch(e){}
}

function submitImport(){
  const f = document.getElementById('import-file').files[0];
  const sheet = (document.getElementById('import-sheet').value || '').trim();
  if(!f){ alert('請選擇檔案'); return; }

  const fd = new FormData();
  fd.append('file', f);
  // optional: also append sheet in form, but we’ll send via query param
  if (sheet) fd.append('sheet', sheet);

  const url = sheet ? `/import_orders?sheet=${encodeURIComponent(sheet)}` : '/import_orders';

  fetch(url, { method:'POST', body: fd })
    .then(r=>r.json())
    .then(j=>{
      if(j.success){
        toast(`已從「${j.sheet}」匯入 ${j.created} 筆`);
        location.reload();
      } else {
        alert(j.message || '匯入失敗');
      }
    })
    .catch(()=> alert('匯入失敗'));
}

function addPlannedStationTo(containerId){
  const container = document.getElementById(containerId);
  const tmpl = document.getElementById("station-template");
  const frag = tmpl.content.cloneNode(true);

  // custom toggle on this row
  const row = frag.querySelector('.row');
  const sel = row.querySelector('.station-select');
  const custom = row.querySelector('.custom-station-input');
  sel.addEventListener('change', () => {
    if (sel.value === '__custom__') { custom.style.display = ''; custom.focus(); }
    else { custom.style.display = 'none'; custom.value = ''; }
  });

  container.appendChild(frag);
}

// keep existing function working
function addPlannedStation(){ addPlannedStationTo('station-planner'); }


function openBulkTasksModal(orderId){
  document.getElementById('bulk-order-id').value = orderId || '';
  const wrap = document.getElementById('bulk-planner');
  wrap.innerHTML = '';
  // start with 3 empty rows
  addPlannedStationTo('bulk-planner');
  addPlannedStationTo('bulk-planner');
  addPlannedStationTo('bulk-planner');
  openModal('modal-bulk');
}

function submitBulkTasks(){
  const orderId = parseInt(document.getElementById('bulk-order-id').value || '0', 10);
  if(!orderId){ alert('Order 不存在'); return; }

  const rows = document.querySelectorAll('#bulk-planner .row');
  const tasks = [];
  for(const row of rows){
    const sel = row.querySelector('.station-select');
    const custom = row.querySelector('.custom-station-input');
    const name = row.querySelector('.task-name-input');
    const groupVal = (sel.value === '__custom__') ? (custom.value||'').trim() : sel.value;
    const taskVal  = (name.value||'').trim();
    const qtyVal   = 1; // default 1; change to your desired default or add a qty input in the row
    if(groupVal && taskVal){ tasks.push({ group: groupVal, task: taskVal, quantity: qtyVal }); }
  }
  if(!tasks.length){ alert('請新增至少一項'); return; }

  fetch('/add_tasks_bulk', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ order_id: orderId, tasks })
  })
  .then(r=>r.json())
  .then(j=>{
    if(j.success){ closeModal('modal-bulk'); toast('已新增'); location.reload(); }
    else alert(j.message||'新增失敗');
  })
  .catch(()=> alert('新增失敗'));
}

function openEditOrder(orderId){
  const row = document.getElementById('order-'+orderId);
  if(!row) return;
  // fill modal
  document.getElementById('e-id').value         = orderId;
  document.getElementById('e-demand').value     = row.dataset.demand || '';
  document.getElementById('e-delivery').value   = row.dataset.delivery || '';
  document.getElementById('e-code').value       = row.dataset.code || '';
  document.getElementById('e-customer').value   = row.dataset.customer || '';
  document.getElementById('e-product').value    = row.dataset.product || '';
  document.getElementById('e-qty').value        = row.dataset.qty || '';
  document.getElementById('e-datecreate').value = row.dataset.datecreate || '';
  document.getElementById('e-fengbian').value   = row.dataset.fengbian || '';
  document.getElementById('e-wallpaper').value  = row.dataset.wallpaper || '';
  document.getElementById('e-jobdesc').value    = row.dataset.jobdesc || '';
  openModal('modal-edit-order');
}

function submitEditOrder(){
  const payload = {
    order_id: parseInt(document.getElementById('e-id').value, 10),
    demand_date:   (document.getElementById('e-demand').value || '').trim(),
    delivery:      (document.getElementById('e-delivery').value || '').trim(),
    manufacture_code: (document.getElementById('e-code').value || '').trim(),
    customer:      (document.getElementById('e-customer').value || '').trim(),
    product:       (document.getElementById('e-product').value || '').trim(),
    quantity:      parseInt(document.getElementById('e-qty').value || '0', 10),
    datecreate:    (document.getElementById('e-datecreate').value || '').trim(),
    fengbian:      (document.getElementById('e-fengbian').value || '').trim(),
    wallpaper:     (document.getElementById('e-wallpaper').value || '').trim(),
    jobdesc:       (document.getElementById('e-jobdesc').value || '').trim(),
  };

  if(!payload.manufacture_code || !payload.customer || !payload.product){
    alert('請至少填入 製令號碼 / 專案名稱 / 產品名稱'); return;
  }

  fetch('/update_order', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  })
  .then(r=>r.json())
  .then(j=>{
    if(!j.success){ alert(j.message || '更新失敗'); return; }
    // update DOM row
    applyOrderRowUpdate(payload.order_id, j.order);
    closeModal('modal-edit-order');
    toast('已更新訂單');
  })
  .catch(()=> alert('更新失敗'));
}

// helper: write the new values into the row + dataset
function applyOrderRowUpdate(orderId, o){
  const row = document.getElementById('order-'+orderId);
  if(!row || !row.children) return;

  // update dataset (for next edit)
  row.dataset.demand     = o.demand_date || '';
  row.dataset.delivery   = o.delivery || '';
  row.dataset.code       = o.manufacture_code || '';
  row.dataset.customer   = o.customer || '';
  row.dataset.product    = o.product || '';
  row.dataset.qty        = o.quantity ?? 0;
  row.dataset.datecreate = o.datecreate || '';
  row.dataset.fengbian   = o.fengbian || '';
  row.dataset.wallpaper  = o.wallpaper || '';
  row.dataset.jobdesc    = o.jobdesc || '';

  // update visible cells by index:
  // 0: progress | 1: 客戶交期 | 2: 預計出貨 | 3: 製令號碼 | 4: 專案名稱 | 5: 產品名稱
  // 6: 數量     | 7: 派單日   | 8: 封邊     | 9: 面飾     | 10: 作業內容 | 11: 現場組別 | 12: Actions
  const cells = row.children;
  if (cells[1])  cells[1].textContent = o.demand_date || '';
  if (cells[2])  cells[2].textContent = o.delivery || '';
  if (cells[3])  cells[3].textContent = o.manufacture_code || '';
  if (cells[4])  cells[4].textContent = o.customer || '';
  if (cells[5])  cells[5].textContent = o.product || '';
  if (cells[6])  cells[6].textContent = (o.quantity ?? 0);
  if (cells[7])  cells[7].textContent = o.datecreate || '';
  if (cells[8])  cells[8].textContent = o.fengbian || '';
  if (cells[9])  cells[9].textContent = o.wallpaper || '';
  if (cells[10]) cells[10].textContent = o.jobdesc || '';

  // if quantity changed and you want to recompute order progress:
  try { updateOrderProgress(orderId); } catch(e){}
}

function archiveOrder(orderId){
  if(!confirm('Archive this order?')) return;
  fetch('/archive_order', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ order_id: orderId, archive: true })
  })
  .then(r=>r.json()).then(j=>{
    if(j.success){
      const row = document.getElementById('order-'+orderId);
      if(row) row.remove();
      toast('已封存');
    } else alert(j.message||'封存失敗');
  }).catch(()=> alert('封存失敗'));
}

function restoreOrder(orderId){
  fetch('/archive_order', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ order_id: orderId, archive: false })
  })
  .then(r=>r.json()).then(j=>{
    if(j.success){
      const row = document.getElementById('order-'+orderId);
      if(row) row.remove();
      toast('已還原（回到 Active）');
    } else alert(j.message||'還原失敗');
  }).catch(()=> alert('還原失敗'));
}

function toggleSidebar(){
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('overlay');
  const isMobile = window.matchMedia('(max-width: 900px)').matches;

  if (isMobile){
    const open = sb.classList.toggle('open');
    ov?.classList.toggle('show', open);
  } else {
    document.body.classList.toggle('sb-collapsed');
    ov?.classList.remove('show');    // <- critical: no overlay on desktop
  }
}

// tap overlay to close on mobile
document.getElementById('overlay')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('overlay')?.classList.remove('show');
});

// moving to desktop? kill mobile state
window.addEventListener('resize', () => {
  if (!window.matchMedia('(max-width: 900px)').matches){
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('overlay')?.classList.remove('show');
  }
});

// belt-and-suspenders on load
document.addEventListener('DOMContentLoaded', () => {
  if (!window.matchMedia('(max-width: 900px)').matches){
    document.getElementById('overlay')?.classList.remove('show');
  }
});

function finishTask(taskId){
  fetch('/finish_task', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ task_id: taskId })
  })
  .then(r=>r.json())
  .then(j=>{
    if(!j.success){ alert(j.message||'完成失敗'); return; }

    const row = document.getElementById('task-'+taskId);
    // Update UI if the row exists (main page), then if on Stations remove it (we filtered finished anyway)
    if (row){
      // Update input + remaining cell if they exist (main page structure)
      const qty = j.quantity || 0;
      const input = document.getElementById('done-'+taskId);
      if (input) input.value = qty;

      // progress bar to 100%
      const fill = row.querySelector('.progress-fill');
      if (fill) fill.style.width = '100%';

      // remaining cell (main page usually index 5)
      const cells = row.children;
      if (cells && cells[5]) cells[5].textContent = '0';

      // stop running UI
      const startBtn = row.querySelector('button[onclick^="startTask"]');
      const stopBtn  = row.querySelector('button[onclick^="stopTask"]');
      if (startBtn) startBtn.disabled = false;
      if (stopBtn)  stopBtn.disabled  = true;

      const status = row.querySelector('.task-status');
      if (status){
        status.classList.remove('running');
        status.innerHTML = '<span class="dot"></span><span>Idle</span>';
      }

      // On Stations page, remove the finished row from the list
      if (window.location.pathname.startsWith('/stations')){
        row.remove();
      }
    }

    toast && toast('已完成');
  })
  .catch(()=> alert('完成失敗'));
}

// chooses the station from the dropdown
function currentStationName(){
  return (document.querySelector('select[name="group"]')?.value || '').trim();
}

// read / remember the plan date
function getPlanDate(){
  return (document.getElementById('plan-date')?.value || '').trim();
}

function setPlanDate(days){
  const inp = document.getElementById('plan-date');
  const base = inp?.value ? new Date(inp.value) : new Date();
  base.setDate(base.getDate() + (days|0));
  inp.value = base.toISOString().slice(0,10);
}

// bulk plan selected rows (Backlog)
function planSelected(){
  const all = Array.from(document.querySelectorAll('.chk-task:checked'))
                    .map(el => parseInt(el.value, 10))
                    .filter(Boolean);
  if (!all.length){ alert('請先選擇工作'); return; }

  // split finished vs valid
  const finished = all.filter(isFinished);
  const ids = all.filter(id => !isFinished(id));

  if (finished.length){
    alert(`有 ${finished.length} 筆工作已經 100% 完成，已略過。`);
  }
  if (!ids.length) return;

  const station = currentStationName();
  const date = getPlanDate();

  fetch('/stations/plan', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ station, date, task_ids: ids })
  })
  .then(r=>r.json())
  .then(j=>{
    if(!j.success){ alert(j.message||'規劃失敗'); return; }
    // remove added rows from backlog
    (j.added||[]).forEach(tid=> document.getElementById('task-'+tid)?.remove());

    // surface server-side skips (e.g., finished detected on server)
    const skippedFinished = (j.skipped||[]).filter(x => x.reason==='finished').length;
    const skippedExists   = (j.skipped||[]).filter(x => x.reason==='exists').length;
    const msg = [
      `加入 ${ (j.added||[]).length } 筆`,
      skippedFinished ? `略過 ${skippedFinished}（已完成）` : '',
      skippedExists   ? `略過 ${skippedExists}（已在今日）` : ''
    ].filter(Boolean).join('，');
    if (typeof toast==='function') toast(msg);
  })
  .catch(()=> alert('規劃失敗'));
}


// per-row quick plan (Backlog)
function planOne(taskId){
  if (isFinished(taskId)){
    alert('此工作已經 100% 完成，無需加入計畫。');
    return;
  }
  const station = currentStationName();
  const date = getPlanDate();

  fetch('/stations/plan', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ station, date, task_ids: [taskId] })
  })
  .then(r=>r.json())
  .then(j=>{
    if(!j.success){ alert(j.message||'加入失敗'); return; }
    if ((j.added||[]).includes(taskId)){
      document.getElementById('task-'+taskId)?.remove();
      if (typeof toast==='function') toast('已加入計畫');
    } else {
      // handle server skip reasons
      const k = (j.skipped||[]).find(x=>x.id===taskId);
      if (k?.reason === 'finished') alert('此工作已完成，未加入計畫。');
      else if (k?.reason === 'exists') alert('此工作已在該日計畫中。');
      else alert('未加入計畫。');
    }
  })
  .catch(()=> alert('加入失敗'));
}


// select-all in Backlog
function toggleAll(cb){
  document.querySelectorAll('.chk-task').forEach(x => x.checked = cb.checked);
}

function currentStationName(){
  return (document.querySelector('select[name="group"]')?.value || '').trim();
}
function isoToday(){
  // local “today” in YYYY-MM-DD
  const now = new Date();
  const tz = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return tz.toISOString().slice(0, 10);
}

function getPlanDate(){
  // If a date input exists (e.g. on Stations Today), use it; otherwise default to today
  const el = document.getElementById('plan-date');
  const v = (el && el.value || '').trim();
  return v || isoToday();
}


function unplanOne(taskId){
  const station = currentStationName();
  const date = getPlanDate();
  if (!station || !date){ alert('缺少站別或日期'); return; }

  fetch('/stations/unplan', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ station, date, task_ids: [taskId] })
  })
  .then(r=>r.json())
  .then(j=>{
    if (!j.success){ alert(j.message || '移除失敗'); return; }
    if ((j.removed||[]).includes(taskId)){
      document.getElementById('task-'+taskId)?.remove();
      if (typeof toast === 'function') toast('已自今日計畫移除');
    } else {
      if (typeof toast === 'function') toast('不在今日計畫');
    }
  })
  .catch(()=> alert('移除失敗'));
}

function taskRemaining(taskId){
  const row = document.getElementById('task-'+taskId);
  const remEl = row?.querySelector('.remaining');
  const raw = (remEl?.textContent || '').toString();
  const n = parseInt(raw.replace(/[^0-9\-]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}
function isFinished(taskId){
  return taskRemaining(taskId) <= 0; // 0 or negative treated as finished
}

// Plan a single task from the main orders page (index.html)
// station: task's group; day optional ("YYYY-MM-DD"), defaults to today
function planFromMain(taskId, station, day){
  const date = (day || '').trim() || new Date().toISOString().slice(0,10);

  fetch('/stations/plan', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ station, date, task_ids: [taskId] })
  })
  .then(r=>r.json())
  .then(j=>{
    if(!j.success){ alert(j.message || '規劃失敗'); return; }

    const addedCount   = (j.added||[]).length;
    const skipped      = (j.skipped||[]);
    const skippedFin   = skipped.filter(x=>x.reason==='finished').length;
    const skippedExist = skipped.filter(x=>x.reason==='exists').length;

    const msg = [
      addedCount ? `已加入 ${addedCount} 筆` : '',
      skippedFin ? `略過 ${skippedFin}（已完成）` : '',
      skippedExist ? `略過 ${skippedExist}（已在今日）` : ''
    ].filter(Boolean).join('，');
    if (typeof toast === 'function') toast(msg || '完成');

    if (addedCount > 0 || skippedExist > 0){
      const btn = document.getElementById(`plan-btn-${taskId}`);
      if (btn) btn.disabled = true;
      const flag = document.getElementById(`planned-flag-${taskId}`);
      if (flag){ flag.style.display = 'inline-block'; flag.textContent = '已在今日計畫'; }
    }
  })
  .catch(()=> alert('規劃失敗'));
}



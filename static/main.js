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
  const val = parseInt(document.getElementById('done-'+taskId).value || '0', 10);

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

    // task cells: [0]=progress, [1]=組別, [2]=數量, [3]=工作內容, [4]=已完成(input), [5]=剩下
    const qty = parseInt(row.children[2].textContent || '0', 10);
    const completed = j.completed || 0;
    const remaining = Math.max(0, qty - completed);

    // update input + remaining cell
    const input = document.getElementById('done-'+taskId);
    if (input) input.value = completed;
    row.children[5].textContent = remaining;

    // update task progress bar width
    const fill = row.querySelector('.progress-fill');
    const pct = (qty ? (completed / qty) * 100 : 0);
    if (fill) fill.style.width = pct + '%';

    // update the order-level bar
    updateOrderProgress(orderId);

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
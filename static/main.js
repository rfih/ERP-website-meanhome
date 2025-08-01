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
  };
  const stationRows = document.querySelectorAll("#station-planner .row");
  payload.initial_tasks = [];

  for (const row of stationRows) {
    const sel = row.querySelector(".station-select");
    const inp = row.querySelector(".task-name-input");
    if (sel.value && inp.value.trim()) {
      payload.initial_tasks.push({ group: sel.value, task: inp.value.trim() });
    }
  }
  
  if(!payload.customer || !payload.product || !payload.quantity){
    alert('請填寫 客戶/產品/數量'); return;
  }
  fetch('/add_order',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)})
    .then(r=>r.json()).then(j=>{ if(j.success){ closeModal('modal-order'); location.reload(); } else alert(j.message||'新增失敗'); });
}

function openTaskModal(orderId){ document.getElementById('t-order-id').value = orderId; openModal('modal-task'); }

function submitTask(){
  const payload = {
    order_id: parseInt(document.getElementById('t-order-id').value,10),
    group: document.getElementById('t-group').value.trim(),
    task: document.getElementById('t-task').value.trim(),
    quantity: parseInt(document.getElementById('t-qty').value||'0',10),
    completed: 0
  };
  if(!payload.group || !payload.task || !payload.quantity){ alert('請填寫完整資料'); return; }
  fetch('/add_task',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload)})
    .then(r=>r.json()).then(j=>{ if(j.success){ closeModal('modal-task'); location.reload(); } else alert(j.message||'新增失敗'); });
}

function updateTask(taskId, orderId){
  const val = parseInt(document.getElementById('done-'+taskId).value||'0',10);
  fetch('/update_task',{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ task_id:taskId, order_id:orderId, completed:val })})
    .then(r=>r.json()).then(j=>{ if(j.success){ location.reload(); } else alert(j.message||'更新失敗'); });
}

function showHistory(taskId, orderId) {
  openModal('modal-history');
  const box = document.getElementById('history-content');
  box.innerHTML = '<p>Loading...</p>';

  fetch(`/task_history?order_id=${orderId}&task_id=${taskId}`)
    .then(r => r.json())
    .then(j => {
      if (!j.success) {
        box.innerHTML = '<p>Error loading history.</p>';
        return;
      }
      if (j.history.length === 0) {
        box.innerHTML = '<p>No updates recorded yet.</p>';
        return;
      }

      let html = '<table style="width:100%;border-collapse:collapse;margin-top:8px">';
      html += '<tr><th style="text-align:left;padding:4px">Time</th><th style="text-align:right">Change</th><th style="text-align:left">Note</th></tr>';

      for (const h of j.history) {
        const date = new Date(h.timestamp).toLocaleString();
        const delta = h.delta > 0 ? `+${h.delta}` : `${h.delta}`;
        const note = h.note || '';
        html += `<tr>
                  <td style="padding:4px">${date}</td>
                  <td style="text-align:right">${delta}</td>
                  <td>${note}</td>
                 </tr>`;
      }
      html += '</table>';
      box.innerHTML = html;
    });
}

function editTask(id, orderId, group, task, quantity) {
  document.getElementById("edit-task-id").value = id;
  document.getElementById("edit-order-id").value = orderId;
  document.getElementById("edit-group").value = group;
  document.getElementById("edit-name").value = task;
  document.getElementById("edit-qty").value = quantity;
  openModal("modal-edit-task");
}

function submitEditTask() {
  const payload = {
    task_id: parseInt(document.getElementById("edit-task-id").value),
    order_id: parseInt(document.getElementById("edit-order-id").value),
    group: document.getElementById("edit-group").value.trim(),
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
  }).then(r => r.json()).then(j => {
    if (j.success) {
      closeModal("modal-edit-task");
      location.reload();
    } else alert(j.message || "更新失敗");
  });
}

function deleteTask(taskId, orderId) {
  if (!confirm("Are you sure you want to delete this task?")) return;

  fetch("/delete_task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_id: taskId, order_id: orderId })
  }).then(r => r.json()).then(j => {
    if (j.success) location.reload();
    else alert(j.message || "刪除失敗");
  });
}

function deleteOrder(orderId) {
  if (!confirm("Are you sure you want to delete this order and all its tasks?")) return;

  fetch("/delete_order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: orderId })
  }).then(r => r.json()).then(j => {
    if (j.success) location.reload();
    else alert(j.message || "刪除失敗");
  });
}

function addPlannedStation() {
  const container = document.getElementById("station-planner");
  const tmpl = document.getElementById("station-template");
  container.appendChild(tmpl.content.cloneNode(true));
}

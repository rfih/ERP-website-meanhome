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

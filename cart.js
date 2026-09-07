(() => {
  const storageKey = 'kllyncle-resale-cart';
  const endpoint = 'https://formspree.io/f/maqgnzeg';
  let cart = JSON.parse(localStorage.getItem(storageKey) || '[]');

  const style = document.createElement('style');
  style.textContent = `
    .cart-trigger { align-items:center; background:var(--ink); border:0; border-radius:50%; bottom:22px; color:var(--cream); cursor:pointer; display:flex; font:500 12px Inter,sans-serif; height:52px; justify-content:center; position:fixed; right:22px; width:52px; z-index:80; }
    .cart-trigger span { align-items:center; background:var(--mauve-deep); border-radius:50%; display:flex; font-size:10px; height:19px; justify-content:center; position:absolute; right:-3px; top:-3px; width:19px; }
    .cart-overlay { align-items:stretch; background:rgba(36,31,26,.58); display:flex; inset:0; justify-content:flex-end; opacity:0; pointer-events:none; position:fixed; transition:opacity .25s ease; z-index:90; }
    .cart-overlay.open { opacity:1; pointer-events:auto; }
    .cart-panel { background:var(--cream); display:flex; flex-direction:column; max-width:440px; padding:30px; transform:translateX(100%); transition:transform .3s ease; width:100%; }
    .cart-overlay.open .cart-panel { transform:translateX(0); }
    .cart-head { align-items:flex-start; border-bottom:1px solid var(--line); display:flex; justify-content:space-between; padding-bottom:18px; }
    .cart-head h2 { font:450 30px/1 Fraunces,serif; }
    .cart-close { background:transparent; border:1px solid var(--line); border-radius:50%; color:var(--ink); cursor:pointer; font-size:18px; height:36px; width:36px; }
    .cart-items { flex:1; overflow:auto; padding:20px 0; }
    .cart-item { align-items:start; border-bottom:1px solid var(--line); display:grid; gap:12px; grid-template-columns:1fr auto; padding:12px 0; }
    .cart-item strong { display:block; font:450 18px/1.15 Fraunces,serif; }
    .cart-item small { color:var(--ink-soft); display:block; font-size:12px; line-height:1.5; margin-top:5px; }
    .cart-item-price { font:600 17px Fraunces,serif; }
    .cart-remove { background:transparent; border:0; color:var(--mauve-deep); cursor:pointer; font:12px Inter,sans-serif; margin-top:6px; padding:0; text-decoration:underline; }
    .cart-empty { color:var(--ink-soft); font-size:14px; line-height:1.6; padding:25px 0; }
    .cart-form { border-top:1px solid var(--line); padding-top:20px; }
    .cart-form label { color:var(--ink-soft); display:block; font-size:11px; letter-spacing:.08em; margin:0 0 6px; text-transform:uppercase; }
    .cart-form input { background:transparent; border:1px solid var(--line); border-radius:2px; color:var(--ink); font:14px Inter,sans-serif; margin-bottom:12px; padding:11px; width:100%; }
    .cart-submit { background:var(--ink); border:1px solid var(--ink); border-radius:2px; color:var(--cream); cursor:pointer; font:500 12px Inter,sans-serif; letter-spacing:.08em; padding:13px; text-transform:uppercase; width:100%; }
    .cart-submit:disabled { cursor:wait; opacity:.6; }
    .cart-status { color:var(--mauve-deep); font-size:13px; line-height:1.5; margin-top:12px; min-height:18px; }
    @media (max-width:600px) { .cart-panel { max-width:none; padding:24px; } }
  `;
  document.head.appendChild(style);

  const trigger = document.createElement('button');
  trigger.className = 'cart-trigger';
  trigger.type = 'button';
  trigger.setAttribute('aria-label', 'Open resale request cart');
  trigger.innerHTML = 'Bag<span>0</span>';
  document.body.appendChild(trigger);

  const overlay = document.createElement('div');
  overlay.className = 'cart-overlay';
  overlay.innerHTML = `<aside class="cart-panel" role="dialog" aria-modal="true" aria-labelledby="cartTitle"><div class="cart-head"><h2 id="cartTitle">Your request</h2><button class="cart-close" type="button" aria-label="Close request cart">×</button></div><div class="cart-items"></div><form class="cart-form"><label for="cartName">Name</label><input id="cartName" name="name" required><label for="cartEmail">Email</label><input id="cartEmail" name="email" type="email" required><button class="cart-submit" type="submit">Send request</button><div class="cart-status" role="status"></div></form></aside>`;
  document.body.appendChild(overlay);

  const count = trigger.querySelector('span');
  const items = overlay.querySelector('.cart-items');
  const status = overlay.querySelector('.cart-status');
  const form = overlay.querySelector('.cart-form');

  const persist = () => localStorage.setItem(storageKey, JSON.stringify(cart));
  const open = () => overlay.classList.add('open');
  const close = () => overlay.classList.remove('open');

  function render() {
    count.textContent = cart.length;
    if (!cart.length) {
      items.innerHTML = '<p class="cart-empty">Your request is empty. Choose a resale piece to start your message.</p>';
      return;
    }
    items.innerHTML = cart.map((item, index) => `<div class="cart-item"><div><strong>${item.product}</strong><small>${item.brand} | Size ${item.size}<br><button class="cart-remove" type="button" data-index="${index}">Remove</button></small></div><span class="cart-item-price">$${item.price}</span></div>`).join('');
    items.querySelectorAll('.cart-remove').forEach(button => button.addEventListener('click', () => {
      cart.splice(Number(button.dataset.index), 1);
      persist();
      render();
    }));
  }

  document.querySelectorAll('.add-to-cart').forEach(button => button.addEventListener('click', () => {
    const item = { product: button.dataset.product, brand: button.dataset.brand, size: button.dataset.size, price: button.dataset.price };
    if (!cart.some(existing => existing.product === item.product && existing.brand === item.brand && existing.size === item.size)) cart.push(item);
    persist();
    render();
    status.textContent = `${item.product} was added to your request.`;
    open();
  }));

  trigger.addEventListener('click', open);
  overlay.querySelector('.cart-close').addEventListener('click', close);
  overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!cart.length) { status.textContent = 'Add at least one item before sending your request.'; return; }
    const submit = form.querySelector('.cart-submit');
    submit.disabled = true;
    status.textContent = 'Sending your request...';
    const formData = new FormData(form);
    formData.append('_subject', 'New resale request from KLLYNCLE');
    formData.append('requested_items', cart.map(item => `${item.product} | ${item.brand} | Size ${item.size} | $${item.price}`).join('\n'));
    try {
      const response = await fetch(endpoint, { method: 'POST', body: formData, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Request failed');
      status.textContent = 'Request sent. I will follow up with availability and next steps.';
      cart = [];
      persist();
      render();
      form.reset();
    } catch (error) {
      status.textContent = 'Something went wrong. Please try again or email directly.';
    } finally {
      submit.disabled = false;
    }
  });

  render();
})();

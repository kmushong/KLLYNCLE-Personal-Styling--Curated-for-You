(function () {
    var STORAGE_KEY = 'kmCart';
    var scriptURL = 'https://script.google.com/macros/s/AKfycbyXt1-6Y1Ma95ZKtQQNAyTO-XSPZySLn9kr2MY4ZSM-GQCApT3VnqAGBV4AOHuLWJfh/exec';
    var DISCOUNT = 0.20;
    // Keys match the service options in the booking form. Price 0 means quoted after we talk.
    var SERVICES = {
        consultation: { name: 'Style Consultation', price: 0 },
        audit: { name: 'Closet Audit', price: 0 },
        shopping: { name: 'Curated Shopping', price: 0 },
        resale: { name: 'Resale & Donation', price: 0 },
        meet: { name: 'Meet & Greet', price: 5 }
    };
    var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    var drawer = document.getElementById('cart-drawer');
    var backdrop = document.querySelector('.cart-backdrop');
    var toggle = document.querySelector('.cart-toggle');
    var countEl = document.querySelector('.cart-count');
    var list = drawer.querySelector('.cart-items');
    var emptyEl = drawer.querySelector('.cart-empty');
    var foot = drawer.querySelector('.cart-foot');
    var TAX_RATE = 0.06; // Washington, DC sales tax
    var money2 = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    var sumEls = {
        retail: drawer.querySelector('.sum-retail'),
        discount: drawer.querySelector('.sum-discount dd'),
        services: drawer.querySelector('.sum-services dd'),
        tax: drawer.querySelector('.sum-tax'),
        total: drawer.querySelector('.sum-total dd')
    };
    var productRows = drawer.querySelectorAll('.sum-products');
    var servicesRow = drawer.querySelector('.sum-services');
    var serviceSelect = drawer.querySelector('.cart-service-select');
    var checkoutBtn = drawer.querySelector('.cart-checkout');
    var requestForm = drawer.querySelector('.cart-request');
    var statusEl = drawer.querySelector('.cart-status');
    var EMPTY_TEXT = emptyEl.textContent;
    var THANKS_TEXT = 'Thank you! Your request is in. I\u2019ll be in touch within 24 hours.';
    var justSent = false;
    var lastTotal = '';
    var cart = [];

    try { cart = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { cart = []; }

    // Floor to a whole dollar so every price is at least 20% off.
    function myPrice(original) { return Math.floor(original * (1 - DISCOUNT)); }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch (e) {} }

    function isService(item) { return item.type === 'service'; }
    function products() { return cart.filter(function (i) { return !isService(i); }); }
    function services() { return cart.filter(isService); }

    Object.keys(SERVICES).forEach(function (key) {
        var opt = document.createElement('option');
        opt.value = key;
        opt.textContent = SERVICES[key].name + (SERVICES[key].price ? ' \u2014 ' + money.format(SERVICES[key].price) : '');
        serviceSelect.appendChild(opt);
    });

    document.querySelectorAll('.product-card').forEach(function (card) {
        var original = Number(card.dataset.price);
        var mine = myPrice(original);
        card.querySelector('.price-original').textContent = money.format(original);
        card.querySelector('.price-mine').textContent = money.format(mine);
        card.querySelector('.price-save').textContent = Math.round((1 - mine / original) * 100) + '% off';
    });

    function render() {
        var qty = cart.reduce(function (n, i) { return n + i.qty; }, 0);
        countEl.textContent = qty;
        countEl.hidden = qty === 0;
        toggle.setAttribute('aria-label', 'Open cart (' + qty + ' item' + (qty === 1 ? '' : 's') + ')');
        emptyEl.hidden = cart.length > 0;
        emptyEl.textContent = justSent ? THANKS_TEXT : EMPTY_TEXT;
        foot.hidden = cart.length === 0;
        if (cart.length === 0) hideRequestForm();
        list.innerHTML = cart.map(function (item, idx) {
            if (isService(item)) {
                return '<li class="cart-item cart-item-service">' +
                    '<div class="cart-item-info">' +
                        '<small>Service</small>' + esc(item.name) +
                        (item.when ? '<span class="cart-item-when">' + esc(item.when) + '</span>' : '') +
                        '<button type="button" class="cart-remove" data-act="rm" data-idx="' + idx + '" aria-label="Remove ' + esc(item.name) + '">Remove</button>' +
                    '</div>' +
                    '<span class="cart-line-total">' + (item.price ? money.format(item.price) : 'Quoted') + '</span>' +
                '</li>';
            }
            return '<li class="cart-item">' +
                '<img src="' + esc(item.image) + '" alt="">' +
                '<div class="cart-item-info">' +
                    '<a href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer"><small>' + esc(item.brand) + '</small>' + esc(item.name) + '</a>' +
                    '<span class="cart-item-prices">' + money.format(item.price) + '</span>' +
                    '<span class="cart-qty-row">' +
                        '<span class="cart-qty">' +
                            '<button type="button" data-act="dec" data-idx="' + idx + '" aria-label="Decrease quantity">&minus;</button>' +
                            '<span>' + item.qty + '</span>' +
                            '<button type="button" data-act="inc" data-idx="' + idx + '" aria-label="Increase quantity">+</button>' +
                        '</span>' +
                        '<button type="button" class="cart-remove" data-act="rm" data-idx="' + idx + '" aria-label="Remove ' + esc(item.name) + '">Remove</button>' +
                    '</span>' +
                '</div>' +
                '<span class="cart-line-total">' + money.format(item.price * item.qty) + '</span>' +
            '</li>';
        }).join('');
        var s = totals();
        sumEls.retail.textContent = money2.format(s.retail);
        sumEls.discount.textContent = '\u2212' + money2.format(s.discount);
        sumEls.services.textContent = s.services ? money2.format(s.services) : 'Quoted';
        sumEls.tax.textContent = money2.format(s.tax);
        sumEls.total.textContent = money2.format(s.total);
        lastTotal = money2.format(s.total);
        productRows.forEach(function (row) { row.hidden = products().length === 0; });
        servicesRow.hidden = services().length === 0;
    }

    // Subtotal is the retail price; the member discount comes off before tax.
    // Services are not discounted or taxed.
    function totals() {
        var items = products();
        var retail = items.reduce(function (n, i) { return n + i.price * i.qty; }, 0);
        var mine = items.reduce(function (n, i) { return n + myPrice(i.price) * i.qty; }, 0);
        var svc = services().reduce(function (n, i) { return n + i.price; }, 0);
        var tax = Math.round(mine * TAX_RATE * 100) / 100;
        return { retail: retail, discount: retail - mine, tax: tax, services: svc, total: mine + tax + svc, mine: mine };
    }

    function addService(key, when) {
        var def = SERVICES[key];
        if (!def) return;
        var id = 'svc-' + key + '-' + (when || '');
        if (!cart.some(function (i) { return i.id === id; })) {
            cart.push({ id: id, type: 'service', key: key, name: def.name, price: def.price, when: when || '', qty: 1 });
        }
        justSent = false;
        save();
        render();
        toggle.classList.remove('bump');
        void toggle.offsetWidth;
        toggle.classList.add('bump');
    }

    function hideRequestForm() {
        requestForm.hidden = true;
        checkoutBtn.hidden = false;
        statusEl.textContent = '';
    }

    function openCart() {
        drawer.hidden = false;
        backdrop.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
        drawer.querySelector('.cart-close').focus();
    }
    function closeCart() {
        drawer.hidden = true;
        backdrop.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
    }

    toggle.addEventListener('click', function () { drawer.hidden ? openCart() : closeCart(); });
    drawer.querySelector('.cart-close').addEventListener('click', function () { closeCart(); toggle.focus(); });
    backdrop.addEventListener('click', closeCart);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !drawer.hidden) { closeCart(); toggle.focus(); } });

    document.querySelectorAll('.add-to-cart').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var d = btn.closest('.product-card').dataset;
            var existing = cart.filter(function (i) { return i.id === d.id; })[0];
            if (existing) existing.qty += 1;
            else cart.push({ id: d.id, brand: d.brand, name: d.name, price: Number(d.price), url: d.url, image: d.image, qty: 1 });
            justSent = false;
            save();
            render();
            toggle.classList.remove('bump');
            void toggle.offsetWidth;
            toggle.classList.add('bump');
            var label = btn.textContent;
            btn.textContent = 'Added ✓';
            setTimeout(function () { btn.textContent = label; }, 1400);
        });
    });

    list.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-act]');
        if (!b) return;
        var item = cart[Number(b.dataset.idx)];
        if (!item) return;
        if (b.dataset.act === 'inc') item.qty += 1;
        if (b.dataset.act === 'dec') item.qty -= 1;
        if (b.dataset.act === 'rm') item.qty = 0;
        cart = cart.filter(function (i) { return i.qty > 0; });
        save();
        render();
    });

    serviceSelect.parentNode.querySelector('.cart-service-add').addEventListener('click', function () {
        if (!serviceSelect.value) { serviceSelect.focus(); return; }
        addService(serviceSelect.value, '');
        serviceSelect.value = '';
    });

    // Checkout asks for contact details, then emails the request.
    checkoutBtn.addEventListener('click', function () {
        checkoutBtn.hidden = true;
        requestForm.hidden = false;
        requestForm.elements.Name.focus();
    });
    drawer.querySelector('.cart-request-back').addEventListener('click', hideRequestForm);

    function buildMessage(phone, notes) {
        var lines = products().map(function (i) {
            return i.qty + ' x ' + i.brand + ' ' + i.name + ' (' + money.format(myPrice(i.price)) + ' each, retail ' + money.format(i.price) + ') ' + i.url;
        });
        services().forEach(function (i) {
            lines.push('Service: ' + i.name + (i.when ? ' (' + i.when + ')' : '') + ' - ' + (i.price ? money.format(i.price) : 'quoted'));
        });
        var s = totals();
        if (products().length) {
            lines.push('Subtotal: ' + money2.format(s.retail));
            lines.push('Member discount: -' + money2.format(s.discount));
            lines.push('Estimated tax (6%): ' + money2.format(s.tax));
        }
        if (s.services) lines.push('Services: ' + money2.format(s.services));
        lines.push('Total: ' + lastTotal);
        return 'Cart request:\n' + lines.join('\n') + '\nPhone: ' + (phone || 'Not provided') + '\nNotes: ' + (notes || 'None');
    }

    requestForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var f = requestForm.elements;
        if (!f.Name.value.trim() || !f.Email.value.trim() || !f.Email.checkValidity()) {
            statusEl.textContent = 'Please enter your name and a valid email.';
            return;
        }
        var types = [];
        if (products().length) types.push('Product / discount sourcing');
        services().forEach(function (i) { types.push(i.name); });
        var data = new FormData();
        data.append('Name', f.Name.value.trim());
        data.append('Email', f.Email.value.trim());
        data.append('Inquiry Type', types.join(' + '));
        data.append('Message', buildMessage(f.Phone.value.trim(), f.Notes.value.trim()));
        var sendBtn = requestForm.querySelector('.cart-send');
        sendBtn.disabled = true;
        statusEl.textContent = 'Sending...';
        fetch(scriptURL, { method: 'POST', body: data })
            .then(function (response) {
                if (!response.ok) throw new Error('Request failed');
                requestForm.reset();
                cart = [];
                justSent = true;
                save();
                render();
            })
            .catch(function () {
                statusEl.textContent = 'Something went wrong. Please email me directly at kellynicolemushonga@gmail.com.';
            })
            .then(function () { sendBtn.disabled = false; });
    });

    window.kmCart = { addService: addService, open: openCart };
    document.addEventListener('cart:clear', function () { cart = []; save(); render(); });
    render();
})();

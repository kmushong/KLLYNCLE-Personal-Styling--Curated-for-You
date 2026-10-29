(function () {
    var STORAGE_KEY = 'kmCart';
    var HANDOFF_KEY = 'kmCheckout';
    var DISCOUNT = 0.20;
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
        tax: drawer.querySelector('.sum-tax'),
        total: drawer.querySelector('.sum-total dd')
    };
    var lastTotal = '';
    var cart = [];

    try { cart = JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { cart = []; }

    // Floor to a whole dollar so every price is at least 20% off.
    function myPrice(original) { return Math.floor(original * (1 - DISCOUNT)); }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)); } catch (e) {} }

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
        foot.hidden = cart.length === 0;
        list.innerHTML = cart.map(function (item, idx) {
            var mine = myPrice(item.price);
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
        sumEls.tax.textContent = money2.format(s.tax);
        sumEls.total.textContent = money2.format(s.total);
        lastTotal = money2.format(s.total);
    }

    // Subtotal is the retail price; the member discount comes off before tax.
    function totals() {
        var retail = cart.reduce(function (n, i) { return n + i.price * i.qty; }, 0);
        var mine = cart.reduce(function (n, i) { return n + myPrice(i.price) * i.qty; }, 0);
        var tax = Math.round(mine * TAX_RATE * 100) / 100;
        return { retail: retail, discount: retail - mine, tax: tax, total: mine + tax, mine: mine };
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

    function fillContactForm(message) {
        var f = document.forms['submit-to-google-sheet'];
        f.elements['Inquiry Type'].value = 'Product / discount sourcing';
        cartRequest = true;
        updateCustomMessage();
        f.elements['Message'].value = message;
        document.getElementById('contact').scrollIntoView({ behavior: 'smooth' });
    }

    // Checkout pre-fills the contact form with the cart so the order can be confirmed.
    drawer.querySelector('.cart-checkout').addEventListener('click', function () {
        var lines = cart.map(function (i) {
            return i.qty + ' x ' + i.brand + ' ' + i.name + ' (' + money.format(myPrice(i.price)) + ' each, retail ' + money.format(i.price) + ') ' + i.url;
        });
        var s = totals();
        lines.push('Subtotal: ' + money2.format(s.retail));
        lines.push('Member discount: -' + money2.format(s.discount));
        lines.push('Estimated tax (6%): ' + money2.format(s.tax));
        lines.push('Total: ' + lastTotal);
        var message = 'Cart request:\n' + lines.join('\n');
        closeCart();
        if (document.forms['submit-to-google-sheet']) {
            fillContactForm(message);
        } else {
            // Not on the home page: hand the message over to the contact form there.
            try { sessionStorage.setItem(HANDOFF_KEY, message); } catch (e) {}
            window.location.href = 'index.html#contact';
        }
    });

    document.addEventListener('cart:clear', function () { cart = []; save(); render(); });
    render();

    if (document.forms['submit-to-google-sheet']) {
        var pending = null;
        try { pending = sessionStorage.getItem(HANDOFF_KEY); sessionStorage.removeItem(HANDOFF_KEY); } catch (e) {}
        if (pending) fillContactForm(pending);
    }
})();

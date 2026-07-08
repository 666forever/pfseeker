(function (window, $, undefined) {
  'use strict';

  const App = {
    config: { url: 'https://pfps.gg' },
    collection: [],
    elements: {}
  };

  window.App = App;

  /* ───────────────────────────────────────────────────────────
     # Init & Setup
     ─────────────────────────────────────────────────────────── */
  App.init = function () {
    this.cacheElements();
    this.loadCollection();
    this.bindEvents();
    this.deferImages();
    this.setupPagination();
    this.updateCollectionUI();
    this.initCollectionDropdown();
    this.renderCollectionItems();
    this.initMobileToggles();
    this.initDropdowns();
  };

  App.cacheElements = function () {
    this.elements.responseMsg     = document.getElementById('response-message');
    this.elements.collectionCount = $('#collection-count');
    this.elements.collectionItems = $('.collection-items');
  };

  App.loadCollection = function () {
    try {
      const saved = localStorage.getItem('collection');
      this.collection = saved ? JSON.parse(saved) : [];
    } catch {
      this.collection = [];
    }
  };

  App.saveCollection = function () {
    localStorage.setItem('collection', JSON.stringify(this.collection));
  };

  App.updateCollectionUI = function () {
    this.elements.collectionCount
      .toggle(this.collection.length > 0)
      .html(this.collection.length);
  };


  /* ───────────────────────────────────────────────────────────
     # Toast Messages
     ─────────────────────────────────────────────────────────── */
  App.toast = function (msg, opts = {}) {
    const box = this.elements.responseMsg;
    if (!box) {
      alert(msg);
      return;
    }

    const styles = {
      success: "bg-emerald-500/60 text-emerald-100 ring-1 ring-emerald-500/20",
      error:   "bg-red-500/60 text-red-100   ring-1 ring-red-500/20",
      info:    "bg-sky-500/60  text-sky-100    ring-1 ring-sky-500/20"
    };
    const type  = opts.type || 'error';
    const dur   = typeof opts.duration === 'number' ? opts.duration : 4500;

    box.className = `rounded-xl px-4 py-3 mx-4 mt-4 ring-1 ring-zinc-800 text-sm font-medium ${styles[type]}`;
    box.innerHTML = msg;
    box.style.display = 'block';

    clearTimeout(box._timer);
    box._timer = setTimeout(() => { box.style.display = 'none'; }, dur);
  };

  App.toastError   = function (msg) { this.toast(msg, { type: 'error' }); };
  App.toastSuccess = function (msg) { this.toast(msg, { type: 'success' }); };


  /* ───────────────────────────────────────────────────────────
     # AJAX Helpers
     ─────────────────────────────────────────────────────────── */
  App.btnLoading = function ($btn, loadingText = 'Loading...') {
    if (!$btn.length) return () => {};
    const originalHTML = $btn.html();
    $btn.prop('disabled', true).html(`<i class="fa-solid fa-spinner fa-spin me-1"></i> ${loadingText}`);

    return (finalLabel) => {
      $btn.prop('disabled', false).html(finalLabel ?? originalHTML);
    };
  };

  App.ajaxJson = function (opts) {
    return $.ajax({ dataType: 'json', ...opts });
  };


  /* ───────────────────────────────────────────────────────────
     # API Calls
     ─────────────────────────────────────────────────────────── */
  App.cancelListing = function (id, type) {
    this.ajaxJson({
      url: `${this.config.url}/api/listing/cancel`,
      method: 'POST',
      data: { id, type }
    })
    .done((res) => {
      const $msg = $('#edit-message').removeClass('alert-danger alert-success');
      $msg.addClass(res.status === 'success' ? 'alert-success' : 'alert-danger')
        .text(res.message).show();
    })
    .fail(() => this.toastError('An unexpected error occurred.'));
  };


App.approveListing = function (id, type, action, el) {
  const $card = $(el).closest('.approval-item');

  // remove instantly (optimistic UI)
  const $placeholder = $('');
  $card.replaceWith($placeholder);

  this.ajaxJson({
    url: `${this.config.url}/api/approve/` + type,
    method: 'POST',
    data: {
      id: id,
      action: action
    }
  })
  .done((res) => {
    if (res?.status === 'success') {
      $placeholder.remove();
    } else {
      $placeholder.replaceWith($card);
    }
  })
  .fail((xhr) => {
    const msg = xhr.responseJSON?.message || 'Request failed.';
    this.toastError(msg);
  });
};

  App.cl = function (type, id) {

  // fire-and-forget analytics
  $.ajax({
    url: App.config.url + '/api/stats/click',
    method: 'POST',
    data: { type: type, id: id }
  });

  // safe download counter
  let count = parseInt(localStorage.getItem('downloads') || '0', 10);
  count++;

  localStorage.setItem('downloads', count);
};

App.submit = function (opts = {}) {

  const {
    form = '#submit-form',
    button,
    endpoint,
    loading = 'Submitting...',
    success = 'Submitted successfully!',
    appendData = null,
    onSuccess = null
  } = opts;

  const formEl = $(form)[0];

  if (!formEl) {
    this.toastError('Form not found.');
    return;
  }

  const fd = new FormData(formEl);


  const $btn = $(button);

  // optional extra payloads
  if (typeof appendData === 'function') {
    appendData(fd, $btn);
  }

  const done = this.btnLoading($btn, loading);

  this.ajaxJson({

    url: `${this.config.url}${endpoint}`,

    method: 'POST',

    data: fd,

    processData: false,

    contentType: false

  })

  .done((res) => {

    if (res.status !== 'success') {

      this.toastError(res.message || 'Request failed.');

      return;
    }

    this.toastSuccess(success);

    formEl.reset();

    if (typeof onSuccess === 'function') {
     onSuccess(res);
    }
  })

  .fail((xhr) => {

    const msg =
      xhr.responseJSON?.message ||
      'An unexpected error occurred.';

    this.toastError(msg);
  })

  .always(() => done());
};




  /* ───────────────────────────────────────────────────────────
     # Collection Management
     ─────────────────────────────────────────────────────────── */
     /* ───────────────────────────────────────────────────────────
        # Dropdowns
        ─────────────────────────────────────────────────────────── */
     App.initDropdowns = function () {

       class Dropdown {

         constructor(element) {
           this.element = element;
           this.trigger = element.querySelector('[data-dropdown-trigger]');
           this.menu = element.querySelector('[data-dropdown-menu]');

           if (!this.trigger || !this.menu) return;

           this.init();
         }

         init() {

           this.trigger.addEventListener('focus', () => this.open());
           this.trigger.addEventListener('click', () => this.open());

           document.addEventListener('click', (e) => {

             if (!this.element.contains(e.target)) {
               this.close();
             }

           });

         }

         open() {

           this.menu.classList.remove(
             'opacity-0',
             'scale-95',
             'translate-y-2',
             'pointer-events-none'
           );

           this.menu.classList.add(
             'opacity-100',
             'scale-100',
             'translate-y-0'
           );

         }

         close() {

           this.menu.classList.add(
             'opacity-0',
             'scale-95',
             'translate-y-2',
             'pointer-events-none'
           );

           this.menu.classList.remove(
             'opacity-100',
             'scale-100',
             'translate-y-0'
           );

         }

       }

       document.querySelectorAll('[data-dropdown]').forEach(el => {
         new Dropdown(el);
       });

     };

     App.initCollectionDropdown = function () {
       const toggle = document.getElementById('collection-toggle');
       const menu   = document.getElementById('collection-menu');

       if (!toggle || !menu) return;

       toggle.addEventListener('click', (e) => {
         e.stopPropagation();
         menu.classList.toggle('hidden');
       });

       document.addEventListener('click', (e) => {
         if (!menu.contains(e.target) && !toggle.contains(e.target)) {
           menu.classList.add('hidden');
         }
       });
     };

  App.addCollectionItem = function (id) {
    if (!this.collection.includes(id)) this.collection.push(id);
    this.saveCollection();
    this.updateCollectionUI();
    this.renderCollectionItems();
  };

  App.removeCollectionItem = function (id) {
    this.collection = this.collection.filter(x => x !== id);
    this.saveCollection();
    this.updateCollectionUI();
    this.renderCollectionItems();
  };

  App.clearCollectionItems = function () {
    this.collection = [];
    this.saveCollection();
    this.updateCollectionUI();
    this.renderCollectionItems();
  };

  App.renderCollectionItems = function () {

    // find ALL collection containers on the page
    const containers = document.querySelectorAll('[data-collection-items]');

    if (!containers.length) return;

    containers.forEach(container => {

      container.innerHTML = '';

      if (!this.collection || !this.collection.length) {
        container.innerHTML =
          '<div class="text-zinc-500 text-xs col-span-4 text-center py-6">No pfps yet</div>';
        return;
      }

      this.collection.forEach((id) => {

        const img = document.createElement('img');
        img.src = 'https://cdn.pfps.gg/pfps/' + id;
        img.className =
  'w-full aspect-square object-cover rounded-md bg-zinc-800/50 ring-1 ring-zinc-800';
        img.loading = 'lazy';

        container.appendChild(img);
      });

    });
  };

  App.downloadPackItems = function (itemsCsv, packName) {
  const zip = new JSZip();
  let done = 0;
  const outName = (packName || 'pack') + '-pfpsgg-pack.zip';

  const files = (itemsCsv || '')
    .split(',')
    .filter(Boolean)
    .map(f => 'https://cdn.pfps.gg/pfps/' + f);

  if (!files.length) {
    App.toastError('No items to download.');
    return;
  }

  files.forEach(url => {
    const filename = url.split('/').pop();

    JSZipUtils.getBinaryContent(url, (err, data) => {
      if (err) return;

      zip.file(filename, data, { binary: true });

      if (++done === files.length) {
        zip.generateAsync({ type: 'blob' })
          .then(blob => saveAs(blob, outName));
      }
    });
  });
};

App.downloadCollectionItems = function () {

  const zip = new JSZip();
  let done = 0;

  const arr = App.collection;

  const urls = arr.map(id => 'https://cdn.pfps.gg/pfps/' + id);

  urls.forEach(url => {
    const filename = url.split('/').pop();

    JSZipUtils.getBinaryContent(url, (err, data) => {
      if (err) return;

      zip.file(filename, data, { binary: true });

      if (++done === urls.length) {
        zip.generateAsync({ type: 'blob' })
           .then(blob => saveAs(blob, 'pfpsgg-collection.zip'));
      }
    });
  });
};

/* ───────────────────────────────────────────────────────────
   # Smell Check
   ─────────────────────────────────────────────────────────── */

   App.checkIfUserStinky = function (callback) {
     const PROBE_URL = "/ads/ads.js";

     function cssBait() {
       return new Promise((resolve) => {
         try {
           const wrap = document.createElement('div');
           wrap.style.cssText = 'position:absolute;left:-9999px;top:-9999px;';

           const bait = document.createElement('div');
           bait.className = 'ads ad adsbox ad-banner ad-slot sponsored';
           bait.id = 'ad_top_banner';
           bait.style.cssText = 'width:1px;height:1px;';

           const ctrl = document.createElement('div');
           ctrl.className = 'content box';
           ctrl.style.cssText = 'width:1px;height:1px;';

           wrap.appendChild(bait);
           wrap.appendChild(ctrl);
           document.body.appendChild(wrap);

           const hidden = el => {
             try {
               const cs = getComputedStyle(el);

               return cs.display === 'none' || cs.visibility === 'hidden';
             } catch { return false; }
           };

           setTimeout(() => {
             const b1 = hidden(bait), c1 = hidden(ctrl);
             setTimeout(() => {
               const b2 = hidden(bait), c2 = hidden(ctrl);
               wrap.remove();
               const strongCssBlocked = (b1 && b2) && (!c1 && !c2);
               resolve({ strong: strongCssBlocked, weak: (b1 && b2) });
             }, 120);
           }, 80);
         } catch { resolve({ strong: false, weak: false }); }
       });
     }

     async function fetchBait() {
       try {
         const r = await fetch(PROBE_URL, { cache: 'no-store', mode: 'same-origin' });
         const txt = await r.text();
         return (r.ok && /__adsProbeLoaded\s*=\s*true/.test(txt)) ? false : null;
       } catch { return navigator.onLine ? true : null; }
     }

     function scriptBait() {
       return new Promise((resolve) => {
         try {
           const s = document.createElement('script');
           let done = false;
           const finish = v => { if (!done) { done = true; resolve(v); } };
           const to = setTimeout(() => finish(navigator.onLine ? true : null), 6000);

           s.src = PROBE_URL + "?v=" + Date.now();
           s.onload = () => {
             clearTimeout(to);
             const ok = window.__adsProbeLoaded === true;
             try { delete window.__adsProbeLoaded; } catch { window.__adsProbeLoaded = undefined; }
             finish(ok ? false : null);
           };
           s.onerror = () => { clearTimeout(to); finish(navigator.onLine ? true : null); };
           setTimeout(() => { if (!done && (!s.parentNode || !document.head.contains(s))) finish(true); }, 150);
           (document.head || document.documentElement).appendChild(s);
         } catch { resolve(null); }
       });
     }

     function score(sig) {
       let sc = 0;
       if (sig.cssStrong) sc += 2;
       else if (sig.cssWeak) sc += 1;
       if (sig.fetch === true) sc += 2;
       if (sig.script === true) sc += 2;
       return sc;
     }

     async function runPass() {
       const [{ strong, weak }, fetchRes, scriptRes] = await Promise.all([cssBait(), fetchBait(), scriptBait()]);
       return {
         cssStrong: strong,
         cssWeak: weak,
         fetch: fetchRes,
         script: scriptRes,
         score: score({ cssStrong: strong, cssWeak: weak, fetch: fetchRes, script: scriptRes })
       };
     }

     const go = async () => {
       // ensure body exists
       if (document.readyState === 'loading') {
         await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
       }
       const p1 = await runPass();
       if (p1.score >= 2) {
         setTimeout(async () => {
           const p2 = await runPass();
           return callback(p2.score >= 2);
         }, 250);
       } else {
         callback(false);
       }
     };

     go();
 };

  /* ───────────────────────────────────────────────────────────
     # Mobile ui
     ─────────────────────────────────────────────────────────── */


     App.initMobileToggles = function () {

       const searchBtn    = document.getElementById("mobile-search-toggle");
       const menuBtn      = document.getElementById("mobile-menu-toggle");

       const searchPanel  = document.getElementById("mobile-search");

       const menuWrapper  = document.getElementById("mobile-menu");
       const menuPanel    = document.getElementById("mobile-panel");
       const menuOverlay  = document.getElementById("mobile-overlay");

       function closeMenu() {

         if (!menuWrapper || !menuPanel) return;

         menuPanel.classList.add("-translate-x-full");

         setTimeout(() => {
           menuWrapper.classList.add("hidden");
         }, 200);
       }

       function openMenu() {

         if (!menuWrapper || !menuPanel) return;

         menuWrapper.classList.remove("hidden");

         setTimeout(() => {
           menuPanel.classList.remove("-translate-x-full");
         }, 10);
       }

       function closeAll() {

         if (searchPanel) {
           searchPanel.classList.add("hidden");
         }

         closeMenu();
       }

       // Search toggle
       if (searchBtn) {

         searchBtn.addEventListener("click", function (e) {

           e.stopPropagation();

           closeMenu();

           if (searchPanel) {
             searchPanel.classList.toggle("hidden");
           }
         });
       }

       // Menu toggle
       if (menuBtn) {

         menuBtn.addEventListener("click", function (e) {

           e.stopPropagation();

           if (searchPanel) {
             searchPanel.classList.add("hidden");
           }

           if (menuWrapper?.classList.contains("hidden")) {
             openMenu();
           } else {
             closeMenu();
           }
         });
       }

       // Close button
       document.getElementById("mobile-close")
         ?.addEventListener("click", closeMenu);

       // Overlay click
       menuOverlay?.addEventListener("click", closeMenu);

       // Outside click
       document.addEventListener("click", function (e) {

         const clickedSearch =
           searchPanel?.contains(e.target) ||
           searchBtn?.contains(e.target);

         const clickedMenu =
           menuPanel?.contains(e.target) ||
           menuBtn?.contains(e.target);

         if (!clickedSearch && !clickedMenu) {
           closeAll();
         }
       });
     };

  /* ───────────────────────────────────────────────────────────
     # Defer Lazy Images
     ─────────────────────────────────────────────────────────── */
  App.deferImages = function () {
    $('img.lazy').each(function () {
      const $img = $(this);
      const src  = $img.data('src');
      if (src) {
        $img.attr('src', src).parent().removeClass('pulse');
      }
    });
  };


  /* ───────────────────────────────────────────────────────────
     # Pagination
     ─────────────────────────────────────────────────────────── */
     App.setupPagination = function () {
       if (!$('#pagination').length) return;

       const ias = $.ias({
         container: '#items',
         item: '.item',
         pagination: '#pagination',
         next: '.next-page',
         loadOnScroll: true
       });

       ias.extension(new IASSpinnerExtension({
         src: '',
         html: `
           <div class="block w-full mt-8 text-center">

             <div class="inline-flex items-center gap-3 px-5 py-2.5 rounded-full
                         bg-zinc-800/60 backdrop-blur ring-1 ring-zinc-700/50
                         text-sm text-zinc-300 shadow-lg">

               <i class="fa-solid fa-spinner animate-spin text-primary-400"></i>
               <span>Loading more...</span>

             </div>

           </div>
         `
       }));




       ias.on('loaded', () => {

         document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el =>
           new bootstrap.Tooltip(el)
         );

         this.deferImages();

         // Fire GA pageview if GA is present
         const url = window.location.pathname + window.location.search;

         if (typeof gtag === 'function') {
           gtag('event', 'page_view', {
             page_location: window.location.href,
             page_path: url
           });
         } else if (typeof ga === 'function') {
           ga('send', 'pageview', url);
         }

       });


     };


  /* ───────────────────────────────────────────────────────────
     # Event Binding
     ─────────────────────────────────────────────────────────── */
  App.bindEvents = function () {
    $(document)

      .on('click', 'a.item-bump', function (e) {
        e.preventDefault();
        App.bump(this.dataset.id, this.dataset.type);
      })

      .on('click', 'a.item-cancel', function (e) {
        e.preventDefault();
        App.cancelListing(this.dataset.id, this.dataset.type);
        $(`#approval-${this.dataset.id}`).remove();
      })

      .on('click', '.collection', function () {
        App.addCollectionItem(this.dataset.id);
      })

      .on('click', '.remove-collection', function () {
        App.removeCollectionItem(this.dataset.id);
      })


      .on('click', '.clear-collection', function (e) {
  e.preventDefault();

  App.clearCollectionItems();     // wipe storage + state
  App.renderCollectionItems();    // rebuild dropdown
  App.updateCollectionUI();       // update counter badge
})

.on('click', '.report-submit', function (e) {
  e.preventDefault();
  App.submitReport();
})

.on('click', '.approve-listing', function (e) {
  e.preventDefault();
  const id = this.dataset.id;
  const type = this.dataset.type;
  App.approveListing(id, type, 'approve', this);
})

.on('click', '.deny-listing', function (e) {
  e.preventDefault();
  const id = this.dataset.id;
  const type = this.dataset.type;
  App.approveListing(id, type, 'deny', this);
})

.on('click', '.collection-download', function (e) {
  e.preventDefault();

  const $btn = $(this);
  const restore = App.btnLoading($btn, 'Downloading...');

  if (!App.collection || !App.collection.length) {
    App.toastError('Your collection is empty.');
    restore();
    return;
  }

  App.downloadCollectionItems();

  $btn.removeClass('btn-primary').addClass('btn-success');
  restore('<i class="fas fa-check"></i> Downloaded');
})

.on('click', '.pack-download', function (e) {
  e.preventDefault();

  const $btn = $(this);
  const restore = App.btnLoading($btn, 'Downloading...');

  const items = this.dataset.items;
  const name  = this.dataset.name;
  const type  = this.dataset.type;
  const id    = this.dataset.id;

  if (!items) {
    App.toastError('Pack has no items.');
    restore();
    return;
  }

  App.downloadPackItems(items, name);
  App.cl(type, id);

  $btn.removeClass('btn-primary').addClass('btn-success');
  restore('<i class="fas fa-check"></i> Downloaded');
})

      .on('click', '.dl', function () {
        const $btn = $(this);
        const restore = App.btnLoading($btn, 'Downloading...');
        const url  = $btn.attr('data-image');
        const name = $btn.attr('data-name') || 'download';
        const id = $btn.attr('data-id') || 169;

        fetch(url)
        .then(r => r.blob())
        .then(blob => {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = name;
          a.click();

          App.cl('pfp', id);

          restore('<i class="fas fa-check"></i> Downloaded');
        })
        .catch(() => {
          App.toastError('Download failed. Please try again.');
          restore();
        });
      })

      $('a.submit-comment').on('click', function (e) {

        e.preventDefault();

        App.submit({

          button: this,

          endpoint: '/api/submit/comment',

          appendData: (fd, $btn) => {

            fd.append('type', $btn.data('content'));

            fd.append('slug', $btn.data('slug'));
          },

          onSuccess: () => {

            window.location.reload();
          }
        });
      });

      $('a.submit-listing').on('click', function (e) {

        e.preventDefault();

        App.submit({

          button: this,

          endpoint: '/api/submit/listing',

          appendData: (fd, $btn) => {},

          onSuccess: () => {

            window.location.reload();
          }
        });
      });

      $('a.submit-banner').on('click', function (e) {

        e.preventDefault();

        App.submit({

          button: this,

          endpoint: '/api/submit/banner',

          appendData: (fd, $btn) => {},

          onSuccess: () => {

            window.location.reload();
          }
        });
      });

      $('a.submit-settings').on('click', function (e) {

        e.preventDefault();

        App.submit({

          button: this,

          endpoint: '/api/submit/settings',

          appendData: (fd, $btn) => {},

          onSuccess: () => {

            window.location.reload();
          }
        });
      });

      $('a.pack-submit').on('click', function () {
        App.submit({

          button: this,

          endpoint: '/api/submit/pack',

          appendData: (fd, $btn) => {
            fd.append('items', App.collection);
          },

          onSuccess: () => {

            window.location.reload();
          }
        });

      });
    };


  /* ───────────────────────────────────────────────────────────
     # Startup
     ─────────────────────────────────────────────────────────── */
  $(function () {
    App.init();
  });

})(window, jQuery);
